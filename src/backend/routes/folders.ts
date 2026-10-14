import express from 'express';
import path from 'path';
import fs from 'fs';

import { getConfig, ensureDir } from '../config';
import { parseFrontmatter, rebuildContent } from '../services/frontmatter';
import { saveVersion } from '../services/versioning';
import {
  HISTORY_DIR_NAME,
  FolderNode,
  buildFolderTree,
  createFolder,
  deleteFolder,
  dirExists,
  fileExists,
  findNoteFileById,
  folderIdToPath,
  folderPathToId,
  getAllFolders,
  getAllMdFiles,
  getFileNameWithoutExt,
  getNoteId,
  readNote,
  sanitizeFolder,
  writeNote,
} from '../services/filesystem';

const router = express.Router();

// ---------------------------------------------------------------------------
// GET /api/folders — árbol de carpetas con conteo de notas
// ---------------------------------------------------------------------------
router.get('/api/folders', async (req, res) => {
  try {
    const config = getConfig();
    await ensureDir(config.noteFolder);

    const folderPaths = await getAllFolders(config.noteFolder);
    const files = await getAllMdFiles(config.noteFolder);

    // Conteo de notas directas por carpeta según ubicación real en disco
    // (el frontmatter puede estar desincronizado si se movió fuera de la app)
    const directCounts = new Map<string, number>();
    for (const f of files) {
      const folder = f.folder || '';
      directCounts.set(folder, (directCounts.get(folder) ?? 0) + 1);
    }

    const tree: FolderNode[] = buildFolderTree(folderPaths, directCounts);
    const rootNotes = directCounts.get('') ?? 0;

    res.json({ folders: tree, total: folderPaths.length, rootNotes });
  } catch (error: any) {
    res.status(500).json({ error: `Error al listar carpetas: ${error.message}` });
  }
});

// ---------------------------------------------------------------------------
// POST /api/folders — crear carpeta
// Body: { name } | { path } | { name, parent }
// ---------------------------------------------------------------------------
router.post('/api/folders', async (req, res) => {
  try {
    const { name, path: rawPath, parent } = req.body as {
      name?: string;
      path?: string;
      parent?: string;
    };

    let requested = '';
    if (typeof rawPath === 'string' && rawPath.trim()) requested = rawPath;
    else if (typeof name === 'string' && name.trim()) {
      requested =
        typeof parent === 'string' && parent.trim() ? `${parent}/${name}` : name;
    }

    if (!requested || !requested.trim()) {
      return res.status(400).json({ error: 'Se requiere name o path de la carpeta' });
    }

    let safe: string;
    try {
      safe = sanitizeFolder(requested);
    } catch {
      return res.status(400).json({ error: 'Nombre de carpeta inválido' });
    }
    if (!safe) return res.status(400).json({ error: 'La ruta no puede estar vacía' });
    if (safe === HISTORY_DIR_NAME || safe.startsWith(`${HISTORY_DIR_NAME}/`)) {
      return res.status(400).json({ error: 'Nombre de carpeta reservado' });
    }

    const config = getConfig();
    const absPath = path.join(config.noteFolder, safe);

    if (await dirExists(absPath)) {
      return res.status(409).json({ error: 'La carpeta ya existe' });
    }
    // Evitar colisión con un fichero .md del mismo nombre en el padre
    const parentAbs = path.dirname(absPath);
    const base = path.basename(absPath);
    if (await fileExists(path.join(parentAbs, `${base}.md`))) {
      return res.status(409).json({ error: 'Ya existe una nota con ese nombre' });
    }

    await createFolder(absPath);

    const folder: FolderNode = {
      id: folderPathToId(safe),
      name: base,
      path: safe,
      parent: safe.includes('/') ? safe.slice(0, safe.lastIndexOf('/')) : null,
      children: [],
      noteCount: 0,
    };
    res.status(201).json({ folder });
  } catch (error: any) {
    res.status(500).json({ error: `Error al crear carpeta: ${error.message}` });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/folders/move — mover nota o carpeta
// A) nota: { noteId, folder }
// B) carpeta: { source, target } (también acepta sourceFolder/targetFolder, folderId)
// ---------------------------------------------------------------------------
router.put('/api/folders/move', async (req, res) => {
  try {
    const { noteId, folder, source, target, sourceFolder, targetFolder, folderId } =
      req.body as {
        noteId?: string;
        folder?: string;
        source?: string;
        target?: string;
        sourceFolder?: string;
        targetFolder?: string;
        folderId?: string;
      };

    const config = getConfig();

    // --- Modo A: mover nota ---
    if (typeof noteId === 'string') {
      let safeFolder: string;
      try {
        safeFolder = folder ? sanitizeFolder(String(folder)) : '';
      } catch {
        return res.status(400).json({ error: 'Carpeta destino inválida' });
      }

      const currentPath = await findNoteFileById(noteId, config.noteFolder);
      if (!currentPath) return res.status(404).json({ error: 'Nota no encontrada' });

      const fileName = path.basename(currentPath);
      const newPath = path.join(config.noteFolder, safeFolder, fileName);
      if (path.resolve(newPath) === path.resolve(currentPath)) {
        // Solo actualizar frontmatter si difiere
        const raw = await readNote(currentPath);
        const { frontmatter, body } = parseFrontmatter(raw);
        if (frontmatter.folder !== safeFolder) {
          try {
            await saveVersion(noteId, body, frontmatter, config.historyFolder, config.maxVersions, false);
          } catch (snapError: any) {
            console.error(`[routes/folders] No se pudo versionar ${noteId}:`, snapError.message);
          }
          frontmatter.folder = safeFolder;
          (frontmatter as any).updated = new Date().toISOString();
          await writeNote(currentPath, rebuildContent(frontmatter, body));
        }
        const { frontmatter: fm2, body: b2 } = parseFrontmatter(
          await readNote(currentPath),
        );
        return res.json({
          note: {
            id: getNoteId(currentPath, config.noteFolder),
            title: fm2.title,
            folder: fm2.folder,
            content: b2,
            tags: fm2.tags,
            created: fm2.created,
            updated: fm2.updated,
          },
        });
      }

      if (await fileExists(newPath)) {
        return res.status(409).json({ error: 'Ya existe una nota con ese nombre en destino' });
      }

      const raw = await readNote(currentPath);
      const { frontmatter, body } = parseFrontmatter(raw);
      try {
        await saveVersion(noteId, body, frontmatter, config.historyFolder, config.maxVersions, false);
      } catch (snapError: any) {
        console.error(`[routes/folders] No se pudo versionar ${noteId}:`, snapError.message);
      }
      frontmatter.folder = safeFolder;
      (frontmatter as any).updated = new Date().toISOString();
      await writeNote(newPath, rebuildContent(frontmatter, body));
      await fs.promises.unlink(currentPath);

      // Mover el historial al nuevo id (Fase 6)
      const movedId = getNoteId(newPath, config.noteFolder);
      if (movedId !== noteId) {
        try {
          await fs.promises.rename(
            path.join(config.historyFolder, noteId),
            path.join(config.historyFolder, movedId),
          );
        } catch {
          // Sin historial previo → nada que mover
        }
      }

      const { frontmatter: fm2, body: b2 } = parseFrontmatter(
        await readNote(newPath),
      );
      return res.json({
        note: {
          id: getNoteId(newPath, config.noteFolder),
          title: fm2.title,
          folder: fm2.folder,
          content: b2,
          tags: fm2.tags,
          created: fm2.created,
          updated: fm2.updated,
        },
      });
    }

    // --- Modo B: mover/renombrar carpeta ---
    const rawSource = source ?? sourceFolder ?? folderId;
    const rawTarget = target ?? targetFolder;
    if (typeof rawSource !== 'string' || typeof rawTarget !== 'string') {
      return res.status(400).json({
        error: 'Se requiere noteId+folder (mover nota) o source+target (mover carpeta)',
      });
    }

    let srcRel: string;
    let dstRel: string;
    try {
      // source puede venir como id codificado ("a--b") o como path ("a/b")
      try {
        srcRel = rawSource.includes('/') ? sanitizeFolder(rawSource) : folderIdToPath(rawSource);
      } catch {
        srcRel = sanitizeFolder(rawSource);
      }
      dstRel = sanitizeFolder(rawTarget);
    } catch {
      return res.status(400).json({ error: 'Ruta de carpeta inválida' });
    }
    if (!srcRel) return res.status(400).json({ error: 'La carpeta origen no puede ser la raíz' });
    if (!dstRel) return res.status(400).json({ error: 'La carpeta destino no puede ser la raíz' });
    if (srcRel === dstRel) return res.status(400).json({ error: 'Origen y destino son iguales' });
    if (dstRel === HISTORY_DIR_NAME || dstRel.startsWith(`${HISTORY_DIR_NAME}/`)) {
      return res.status(400).json({ error: 'Nombre de carpeta reservado' });
    }
    if (dstRel === srcRel || dstRel.startsWith(`${srcRel}/`)) {
      return res.status(400).json({ error: 'No se puede mover una carpeta dentro de sí misma' });
    }

    const srcAbs = path.join(config.noteFolder, srcRel);
    const dstAbs = path.join(config.noteFolder, dstRel);
    if (!(await dirExists(srcAbs))) return res.status(404).json({ error: 'Carpeta origen no encontrada' });
    if ((await dirExists(dstAbs)) || (await fileExists(dstAbs))) {
      return res.status(409).json({ error: 'La carpeta destino ya existe' });
    }

    await ensureDir(path.dirname(dstAbs));

    // Capturar notas afectadas ANTES del rename (sus paths aún tienen el prefijo viejo)
    const prevFiles = await getAllMdFiles(config.noteFolder);
    const affected: Array<{ oldRel: string; fileName: string }> = [];
    for (const f of prevFiles) {
      const rel = path.relative(config.noteFolder, f.filePath).split(path.sep).join('/');
      const dirRel = rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '';
      if (dirRel === srcRel || dirRel.startsWith(`${srcRel}/`)) {
        affected.push({ oldRel: rel, fileName: path.basename(f.filePath) });
      }
    }

    await fs.promises.rename(srcAbs, dstAbs);

    // Actualizar frontmatter.folder en la nueva ubicación (con snapshot previo por nota)
    let movedNotes = 0;
    for (const a of affected) {
      const oldDir = a.oldRel.includes('/') ? a.oldRel.slice(0, a.oldRel.lastIndexOf('/')) : '';
      const rest = oldDir === srcRel ? '' : oldDir.slice(srcRel.length);
      const newFolder = `${dstRel}${rest}`;
      const newAbs = path.join(config.noteFolder, newFolder, a.fileName);
      const oldAbs = path.join(config.noteFolder, oldDir, a.fileName);
      const oldId = getNoteId(oldAbs, config.noteFolder);
      const newId = getNoteId(newAbs, config.noteFolder);
      try {
        const raw = await readNote(newAbs);
        const { frontmatter, body } = parseFrontmatter(raw);
        try {
          await saveVersion(oldId, body, frontmatter, config.historyFolder, config.maxVersions, false);
        } catch (snapError: any) {
          console.error(`[routes/folders] No se pudo versionar ${oldId}:`, snapError.message);
        }
        // Mover el historial al nuevo id
        if (newId !== oldId) {
          try {
            await fs.promises.rename(
              path.join(config.historyFolder, oldId),
              path.join(config.historyFolder, newId),
            );
          } catch {
            // Sin historial previo → nada que mover
          }
        }
        if (frontmatter.folder !== newFolder) {
          frontmatter.folder = newFolder;
          (frontmatter as any).updated = new Date().toISOString();
          await writeNote(newAbs, rebuildContent(frontmatter, body));
        }
        movedNotes++;
      } catch {
        // ignorar nota corrupta individual
      }
    }

    const base = dstRel.includes('/') ? dstRel.slice(dstRel.lastIndexOf('/') + 1) : dstRel;
    res.json({
      folder: {
        id: folderPathToId(dstRel),
        name: base,
        path: dstRel,
        parent: dstRel.includes('/') ? dstRel.slice(0, dstRel.lastIndexOf('/')) : null,
        children: [],
        noteCount: movedNotes,
      },
      movedNotes,
    });
  } catch (error: any) {
    res.status(500).json({ error: `Error al mover: ${error.message}` });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/folders/:id — eliminar carpeta (vacía, o ?force=true recursivo)
// ---------------------------------------------------------------------------
router.delete('/api/folders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const force = req.query.force === 'true';

    let rel: string;
    try {
      rel = id.includes('/') ? sanitizeFolder(id) : folderIdToPath(id);
    } catch {
      return res.status(400).json({ error: 'ID de carpeta inválido' });
    }
    if (!rel) return res.status(400).json({ error: 'No se puede eliminar la raíz' });
    if (rel === HISTORY_DIR_NAME || rel.startsWith(`${HISTORY_DIR_NAME}/`)) {
      return res.status(400).json({ error: 'Carpeta reservada' });
    }

    const config = getConfig();
    const absPath = path.join(config.noteFolder, rel);
    if (!(await dirExists(absPath))) {
      return res.status(404).json({ error: 'Carpeta no encontrada' });
    }

    const entries = await fs.promises.readdir(absPath);
    if (entries.length > 0 && !force) {
      // Contar notas y subcarpetas para el mensaje
      const files = await getAllMdFiles(absPath);
      return res.status(409).json({
        error: 'La carpeta no está vacía. Usa ?force=true para eliminarla con su contenido.',
        noteCount: files.length,
        entries: entries.length,
      });
    }

    if (force) {
      await fs.promises.rm(absPath, { recursive: true, force: true });
    } else {
      await deleteFolder(absPath);
    }
    res.json({ success: true, message: 'Carpeta eliminada' });
  } catch (error: any) {
    const msg = String(error?.message ?? error);
    if (msg.includes('no está vacía')) {
      return res.status(409).json({ error: msg });
    }
    res.status(500).json({ error: `Error al eliminar carpeta: ${msg}` });
  }
});

export default router;
