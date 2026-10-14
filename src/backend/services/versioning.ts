import fs from 'fs';
import path from 'path';
import { NoteFrontmatter, parseFrontmatter, rebuildContent } from './frontmatter';
import { fileExists, writeNote, findNoteFileById } from './filesystem';

/**
 * Estructura de una versión guardada
 */
export interface Version {
  timestamp: string;
  content: string;
  frontmatter: NoteFrontmatter;
  isBookmark: boolean;
}

/**
 * Guardar una versión de una nota
 */
export async function saveVersion(
  noteId: string,
  content: string,
  frontmatter: NoteFrontmatter,
  historyFolder: string,
  maxVersions: number = 50,
  isBookmark: boolean = false,
): Promise<void> {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const versionDir = path.join(historyFolder, noteId);
    // Los bookmarks llevan prefijo para distinguirlos y excluirlos de la limpieza
    const fileName = isBookmark ? `bookmark-${timestamp}.md` : `${timestamp}.md`;
    const versionPath = path.join(versionDir, fileName);

    await fs.promises.mkdir(versionDir, { recursive: true });

    const versionContent = rebuildContent(frontmatter, content);
    await fs.promises.writeFile(versionPath, versionContent);

    // Limpiar versiones antiguas si excede el límite
    await cleanupOldVersions(noteId, historyFolder, maxVersions);
  } catch (error: any) {
    throw new Error(`Error guardando versión: ${error.message}`);
  }
}

/**
 * Obtener todas las versiones de una nota
 */
export async function getVersions(
  noteId: string,
  historyFolder: string,
): Promise<Version[]> {
  try {
    const versionDir = path.join(historyFolder, noteId);
    const exists = await fileExists(versionDir);
    if (!exists) return [];

    const files = await fs.promises.readdir(versionDir);
    const versions: Version[] = [];

    for (const file of files.sort().reverse()) {
      if (!file.endsWith('.md')) continue;
      const filePath = path.join(versionDir, file);
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const { frontmatter, body } = parseFrontmatter(content);

      versions.push({
        timestamp: file.replace('.md', ''),
        content: body,
        frontmatter,
        isBookmark: file.startsWith('bookmark-'),
      });
    }

    return versions;
  } catch (error: any) {
    throw new Error(`Error obteniendo versiones: ${error.message}`);
  }
}

/**
 * Obtener una versión específica.
 * El timestamp se valida para evitar path traversal.
 */
export function assertValidTimestamp(timestamp: string): void {
  if (!timestamp || typeof timestamp !== 'string') throw new Error('Timestamp inválido');
  if (
    timestamp.includes('..') ||
    timestamp.includes('/') ||
    timestamp.includes('\\') ||
    !/^[\w.-]+$/.test(timestamp)
  ) {
    throw new Error(`Timestamp inválido: ${timestamp}`);
  }
}

/**
 * Obtener una versión específica
 */
export async function getVersion(
  noteId: string,
  timestamp: string,
  historyFolder: string,
): Promise<Version | null> {
  try {
    assertValidTimestamp(timestamp);
    const versionPath = path.join(historyFolder, noteId, `${timestamp}.md`);
    const exists = await fileExists(versionPath);
    if (!exists) return null;

    const content = await fs.promises.readFile(versionPath, 'utf-8');
    const { frontmatter, body } = parseFrontmatter(content);

    return {
      timestamp,
      content: body,
      frontmatter,
      isBookmark: timestamp.startsWith('bookmark-'),
    };
  } catch {
    return null;
  }
}

/**
 * Restaurar una versión anterior.
 * Guarda un bookmark del estado actual, restaura el contenido y actualiza `updated`.
 */
export async function restoreVersion(
  noteId: string,
  timestamp: string,
  historyFolder: string,
  noteFolder: string,
  maxVersions = 50,
): Promise<{ success: boolean; error?: string }> {
  try {
    assertValidTimestamp(timestamp);

    // Resolver la ruta real (el noteId codifica subcarpetas con --)
    const currentPath = await findNoteFileById(noteId, noteFolder);
    if (!currentPath) {
      return { success: false, error: 'Nota no encontrada' };
    }

    // 1. Guardar versión bookmark de la nota actual
    const currentContent = await fs.promises.readFile(currentPath, 'utf-8');
    const { frontmatter, body } = parseFrontmatter(currentContent);

    await saveVersion(noteId, body, frontmatter, historyFolder, maxVersions, true);

    // 2. Obtener la versión a restaurar
    const version = await getVersion(noteId, timestamp, historyFolder);
    if (!version) {
      return { success: false, error: `Versión no encontrada: ${timestamp}` };
    }

    // 3. Actualizar la nota con la versión restaurada (con updated=ahora)
    const restoredFm: NoteFrontmatter = { ...version.frontmatter, updated: new Date().toISOString() };
    const restoredContent = rebuildContent(restoredFm, version.content);
    await writeNote(currentPath, restoredContent);

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Crear un bookmark manual
 */
export async function createBookmark(
  noteId: string,
  content: string,
  frontmatter: NoteFrontmatter,
  historyFolder: string,
  maxVersions = 50,
): Promise<void> {
  await saveVersion(noteId, content, frontmatter, historyFolder, maxVersions, true);
}

/**
 * Limpiar versiones antiguas, mantener solo las últimas N
 */
export async function cleanupOldVersions(
  noteId: string,
  historyFolder: string,
  maxVersions: number = 50,
): Promise<void> {
  try {
    const versionDir = path.join(historyFolder, noteId);
    const exists = await fileExists(versionDir);
    if (!exists) return;

    const files = await fs.promises.readdir(versionDir);
    const mdFiles = files.filter((f) => f.endsWith('.md')).sort();

    // Eliminar solo versiones automáticas (no bookmarks)
    const autoVersions = mdFiles.filter((f) => !f.startsWith('bookmark-'));

    if (autoVersions.length > maxVersions) {
      const toDelete = autoVersions.slice(0, autoVersions.length - maxVersions);
      for (const file of toDelete) {
        await fs.promises.unlink(path.join(versionDir, file));
      }
    }
  } catch (error: any) {
    console.error(`Error limpiando versiones: ${error.message}`);
  }
}
