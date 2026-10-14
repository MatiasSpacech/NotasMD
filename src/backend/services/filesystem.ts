import fs from 'fs';
import path from 'path';

/**
 * Servicios de filesystem para gestión de archivos .md
 */

/** Nombre de la carpeta de historial (se excluye del listado de notas) */
export const HISTORY_DIR_NAME = '.notas-history';

/**
 * Leer el contenido de un archivo .md
 */
export async function readNote(filePath: string): Promise<string> {
  try {
    const exists = await fs.promises.stat(filePath).then(() => true).catch(() => false);
    if (!exists) {
      throw new Error(`Archivo no encontrado: ${filePath}`);
    }
    return await fs.promises.readFile(filePath, 'utf-8');
  } catch (error: any) {
    throw new Error(`Error leyendo nota ${filePath}: ${error.message}`);
  }
}

/**
 * Escribir contenido en un archivo .md
 */
export async function writeNote(filePath: string, content: string): Promise<void> {
  try {
    const dir = path.dirname(filePath);
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(filePath, content, 'utf-8');
  } catch (error: any) {
    throw new Error(`Error escribiendo nota ${filePath}: ${error.message}`);
  }
}

/**
 * Eliminar un archivo .md
 */
export async function deleteNote(filePath: string): Promise<void> {
  try {
    const exists = await fs.promises.stat(filePath).then(() => true).catch(() => false);
    if (!exists) {
      throw new Error(`Archivo no encontrado para eliminar: ${filePath}`);
    }
    await fs.promises.unlink(filePath);
  } catch (error: any) {
    throw new Error(`Error eliminando nota ${filePath}: ${error.message}`);
  }
}

/**
 * Obtener nombre de archivo sin extensión
 */
export function getFileNameWithoutExt(filePath: string): string {
  return path.basename(filePath, '.md');
}

/**
 * Convertir una ruta a un ID de nota.
 * El ID codifica la carpeta con `--` como separador:
 * "proyecto-a/mi-nota.md" (relativo a noteFolder) -> "proyecto-a--mi-nota"
 * "mi-nota.md" en raíz -> "mi-nota"
 * Si no se pasa noteFolder, usa el basename (compat con versión anterior).
 */
export function getNoteId(filePath: string, noteFolder?: string): string {
  let rel: string;
  if (noteFolder) {
    rel = path.relative(noteFolder, filePath);
    // Si queda fuera de noteFolder, fallback a basename
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      rel = path.basename(filePath);
    }
  } else {
    rel = path.basename(filePath);
  }
  // Normalizar separadores y quitar extensión .md
  rel = rel.split(path.sep).join('/');
  if (rel.toLowerCase().endsWith('.md')) rel = rel.slice(0, -3);
  const segments = rel.split('/').filter((s) => s.length > 0);
  return segments.join('--');
}

/**
 * Convertir un ID de nota a una ruta.
 * Ej: "proyecto-a--mi-nota" -> "<noteFolder>/proyecto-a/mi-nota.md"
 * Ej: "mi-nota" -> "<noteFolder>/mi-nota.md"
 */
export function getNotePath(id: string, noteFolder: string): string {
  assertValidNoteId(id);
  const rel = id.split('--').join('/');
  return path.join(noteFolder, `${rel}.md`);
}

/**
 * Carpeta relativa de una nota respecto a noteFolder, con `/` como separador.
 * "" = raíz. Es la fuente de verdad (el frontmatter puede quedar desincronizado
 * si los ficheros se mueven fuera de la app).
 */
export function getNoteDirRelative(filePath: string, noteFolder: string): string {
  const rel = path.relative(noteFolder, filePath);
  const dir = path.dirname(rel);
  if (dir === '.' || dir === '' || dir.startsWith('..') || path.isAbsolute(dir)) return '';
  return dir.split(path.sep).join('/');
}

/**
 * Validar que un ID de nota no intenta path traversal.
 */
export function assertValidNoteId(id: string): void {
  if (!id || typeof id !== 'string') throw new Error('ID de nota inválido');
  if (
    id.includes('..') ||
    id.includes('/') ||
    id.includes('\\') ||
    id === '.' ||
    id.startsWith('--') ||
    id.endsWith('--')
  ) {
    throw new Error(`ID de nota inválido: ${id}`);
  }
}

/**
 * Sanitizar un nombre de carpeta: "a/b", "./a", "a\\" -> "a/b".
 * Lanza si contiene `..` o queda vacía tras sanitizar (salvo cadena vacía = raíz).
 */
export function sanitizeFolder(folder: string): string {
  const normalized = folder.split(path.sep).join('/').split('\\').join('/');
  const parts = normalized
    .split('/')
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  for (const p of parts) {
    if (p === '..' || p === '.' || p.includes('\0')) {
      throw new Error(`Nombre de carpeta inválido: ${folder}`);
    }
  }
  return parts.join('/');
}

/**
 * Buscar el fichero real de una nota por su ID.
 * 1) Intenta la ruta directa (rápido).
 * 2) Fallback: escanea y compara IDs (soporta IDs antiguos de solo-basename).
 * Retorna null si no existe.
 */
export async function findNoteFileById(
  id: string,
  noteFolder: string,
): Promise<string | null> {
  try {
    assertValidNoteId(id);
  } catch {
    return null;
  }
  const direct = getNotePath(id, noteFolder);
  if (await fileExists(direct)) return direct;
  try {
    const files = await getAllMdFiles(noteFolder);
    for (const f of files) {
      if (getNoteId(f.filePath, noteFolder) === id) return f.filePath;
      // Compat: IDs antiguos generados solo con basename
      if (getFileNameWithoutExt(f.filePath) === id) return f.filePath;
    }
  } catch {
    // ignore: si no se puede listar, retornar null
  }
  return null;
}

/**
 * Verificar si un archivo existe
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.promises.stat(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Verificar si un directorio existe
 */
export async function dirExists(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.promises.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Listar archivos .md en una carpeta (nivel directo)
 */
export async function listFolder(folderPath: string): Promise<string[]> {
  try {
    const entries = await fs.promises.readdir(folderPath, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
      .map((entry) => path.join(folderPath, entry.name));
  } catch (error: any) {
    throw new Error(`Error listando carpeta ${folderPath}: ${error.message}`);
  }
}

/**
 * Listar todos los archivos .md recursivamente.
 * Excluye la carpeta `.notas-history/`.
 * Si la carpeta raíz no existe, retorna [] en lugar de lanzar.
 */
export async function getAllMdFiles(folderPath: string, prefix: string = ''): Promise<Array<{ filePath: string; relativePath: string; folder: string }>> {
  const results: Array<{ filePath: string; relativePath: string; folder: string }> = [];

  let entries;
  try {
    entries = await fs.promises.readdir(folderPath, { withFileTypes: true });
  } catch (error: any) {
    if (error?.code === 'ENOENT') return [];
    throw new Error(`Error buscando archivos en ${folderPath}: ${error.message}`);
  }

  try {
    for (const entry of entries) {
      // Excluir historial de versiones
      if (entry.name === HISTORY_DIR_NAME) continue;
      if (entry.name.startsWith('.notas-history')) continue;

      const fullPath = path.join(folderPath, entry.name);
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        const subResults = await getAllMdFiles(fullPath, relativePath);
        results.push(...subResults);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        results.push({
          filePath: fullPath,
          relativePath: getFileNameWithoutExt(relativePath),
          folder: prefix || '',
        });
      }
    }
  } catch (error: any) {
    throw new Error(`Error buscando archivos en ${folderPath}: ${error.message}`);
  }

  return results;
}

/**
 * Crear una carpeta
 */
export async function createFolder(folderPath: string): Promise<void> {
  try {
    await fs.promises.mkdir(folderPath, { recursive: true });
  } catch (error: any) {
    throw new Error(`Error creando carpeta ${folderPath}: ${error.message}`);
  }
}

/**
 * Nodo del árbol de carpetas (Fase 3).
 * `path` es la ruta relativa con `/` ("" = raíz, no incluida en el árbol).
 * `id` codifica el path con `--` (igual que los IDs de nota).
 */
export interface FolderNode {
  id: string;
  name: string;
  path: string;
  parent: string | null;
  children: FolderNode[];
  noteCount: number;
}

/** Codificar un path de carpeta ("a/b") a id ("a--b") */
export function folderPathToId(folderPath: string): string {
  const clean = folderPath.split('\\').join('/').replace(/^\/+|\/+$/g, '');
  if (!clean) return '';
  return clean.split('/').join('--');
}

/** Decodificar un id de carpeta ("a--b") a path ("a/b"). Lanza si inválido. */
export function folderIdToPath(id: string): string {
  if (!id || typeof id !== 'string') throw new Error('ID de carpeta inválido');
  if (id.includes('..') || id.includes('/') || id.includes('\\')) {
    throw new Error(`ID de carpeta inválido: ${id}`);
  }
  const decoded = id.split('--').join('/');
  // Revalidar con sanitize (permite anidación, prohíbe ..)
  return sanitizeFolder(decoded);
}

/**
 * Listar todas las carpetas (relativas con `/`) bajo noteFolder.
 * Excluye `.notas-history`. Retorna [] si no existe la raíz.
 */
export async function getAllFolders(noteFolder: string): Promise<string[]> {
  const out: string[] = [];

  async function walk(absDir: string, rel: string): Promise<void> {
    let entries;
    try {
      entries = await fs.promises.readdir(absDir, { withFileTypes: true });
    } catch (error: any) {
      if (error?.code === 'ENOENT') return;
      throw error;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name === HISTORY_DIR_NAME) continue;
      if (entry.name.startsWith('.notas-history')) continue;
      const childRel = rel ? `${rel}/${entry.name}` : entry.name;
      out.push(childRel);
      await walk(path.join(absDir, entry.name), childRel);
    }
  }

  await walk(noteFolder, '');
  return out.sort();
}

/**
 * Construir árbol anidado de carpetas con conteo de notas directas.
 * `directCounts`: mapa folderRel -> nº de notas con ese folder exacto.
 */
export function buildFolderTree(
  folderPaths: string[],
  directCounts: Map<string, number> = new Map(),
): FolderNode[] {
  const byPath = new Map<string, FolderNode>();
  const roots: FolderNode[] = [];

  const sorted = [...folderPaths].sort(
    (a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b),
  );

  for (const fp of sorted) {
    const segments = fp.split('/');
    const name = segments[segments.length - 1];
    const parent = segments.length > 1 ? segments.slice(0, -1).join('/') : null;
    const node: FolderNode = {
      id: folderPathToId(fp),
      name,
      path: fp,
      parent,
      children: [],
      noteCount: directCounts.get(fp) ?? 0,
    };
    byPath.set(fp, node);
    if (parent === null) {
      roots.push(node);
    } else {
      const parentNode = byPath.get(parent);
      if (parentNode) parentNode.children.push(node);
      else roots.push(node); // padre no listado (no debería pasar)
    }
  }

  // Ordenar alfabéticamente en cada nivel
  const sortRec = (nodes: FolderNode[]) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name));
    for (const n of nodes) sortRec(n.children);
  };
  sortRec(roots);
  return roots;
}

/**
 * Eliminar una carpeta (vacía)
 */
export async function deleteFolder(folderPath: string): Promise<void> {
  try {
    const entries = await fs.promises.readdir(folderPath);
    if (entries.length > 0) {
      throw new Error(`La carpeta no está vacía: ${folderPath}`);
    }
    await fs.promises.rmdir(folderPath);
  } catch (error: any) {
    throw new Error(`Error eliminando carpeta ${folderPath}: ${error.message}`);
  }
}
