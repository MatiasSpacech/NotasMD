import express from 'express';
import fs from 'fs';
import path from 'path';

import { getConfig, ensureDir } from '../config';
import {
  parseFrontmatter,
  updateTimestamps,
  rebuildContent,
  NoteFrontmatter,
} from '../services/frontmatter';
import {
  getAllMdFiles,
  getNoteId,
  getNotePath,
  getNoteDirRelative,
  findNoteFileById,
  sanitizeFolder,
  assertValidNoteId,
  fileExists,
  readNote,
  writeNote,
  deleteNote,
  getFileNameWithoutExt,
} from '../services/filesystem';
import { extractWikilinks, normalizePath } from '../services/wikilink-parser';
import { saveVersion } from '../services/versioning';

const router = express.Router();

/**
 * Interfaz de nota expuesta por la API
 */
interface Note {
  id: string;
  title: string;
  folder: string;
  content: string;
  tags: string[];
  created: string;
  updated: string;
  wordCount: number;
}

/**
 * Contar palabras en un texto
 */
function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * Convertir un frontmatter + body a un objeto Note.
 * La carpeta es la ubicación real en disco (el frontmatter puede estar stale).
 */
function noteFromData(
  frontmatter: NoteFrontmatter,
  body: string,
  filePath: string,
  noteFolder: string,
): Note {
  return {
    id: getNoteId(filePath, noteFolder),
    title: frontmatter.title,
    folder: getNoteDirRelative(filePath, noteFolder),
    content: body,
    tags: frontmatter.tags,
    created: frontmatter.created,
    updated: frontmatter.updated,
    wordCount: countWords(body),
  };
}

/**
 * Slugify un título para generar un nombre de fichero.
 * Si el título no produce slug válido, genera uno de fallback.
 */
function slugify(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // eliminar acentos
    .replace(/[^a-z0-9\s-]/g, '') // eliminar caracteres especiales
    .replace(/\s+/g, '-') // espacios a guiones
    .replace(/-+/g, '-') // guiones dobles a simples
    .replace(/^-|-$/g, ''); // guiones al inicio/final
  if (!slug) return `nota-${Date.now()}`;
  // Limitar longitud para paths sanos
  return slug.slice(0, 100);
}

// ---------------------------------------------------------------------------
// GET /api/notes — Listar todas las notas
// ---------------------------------------------------------------------------
router.get('/api/notes', async (req, res) => {
  try {
    const config = getConfig();
    await ensureDir(config.noteFolder);
    const files = await getAllMdFiles(config.noteFolder);

    const notes: Note[] = [];
    for (const file of files) {
      try {
        const content = await readNote(file.filePath);
        const { frontmatter, body } = parseFrontmatter(content);
        notes.push(noteFromData(frontmatter, body, file.filePath, config.noteFolder));
      } catch (fileError: any) {
        // Saltar ficheros corruptos en lugar de romper todo el listado
        console.error(`[routes/notes] Saltando fichero corrupto ${file.filePath}:`, fileError.message);
      }
    }

    res.json({ notes, total: notes.length });
  } catch (error: any) {
    res.status(500).json({ error: `Error al listar notas: ${error.message}` });
  }
});

/**
 * Parte destino de un wikilink (soporta alias [[destino|texto]]).
 */
function wikilinkTarget(link: string): string {
  return link.split('|')[0]?.trim() || link.trim();
}

// ---------------------------------------------------------------------------
// GET /api/notes/:id/backlinks — notas que referencian a esta nota
// ---------------------------------------------------------------------------
router.get('/api/notes/:id/backlinks', async (req, res) => {
  try {
    const { id } = req.params;
    try {
      assertValidNoteId(id);
    } catch {
      return res.status(400).json({ error: 'ID de nota inválido' });
    }
    const config = getConfig();
    const filePath = await findNoteFileById(id, config.noteFolder);

    if (!filePath) {
      return res.status(404).json({ error: 'Nota no encontrada' });
    }

    const targetRaw = await readNote(filePath);
    const { frontmatter: targetFm } = parseFrontmatter(targetRaw);
    const targetNote = noteFromData(targetFm, '', filePath, config.noteFolder);

    // Identidades aceptadas para referenciar a esta nota
    const targetNorms = new Set(
      [
        targetFm.title,
        targetNote.id.replace(/--/g, '/'),
        targetNote.id,
        getFileNameWithoutExt(filePath),
        targetNote.folder ? `${targetNote.folder}/${targetFm.title}` : targetFm.title,
      ].map(normalizePath),
    );

    const files = await getAllMdFiles(config.noteFolder);
    const backlinks: Array<{ id: string; title: string; folder: string; snippet: string }> = [];

    for (const file of files) {
      if (path.resolve(file.filePath) === path.resolve(filePath)) continue; // excluirse a sí misma
      let body = '';
      let fm: NoteFrontmatter | null = null;
      try {
        const raw = await readNote(file.filePath);
        const parsed = parseFrontmatter(raw);
        body = parsed.body;
        fm = parsed.frontmatter;
      } catch {
        continue; // saltar ficheros corruptos
      }
      const links = extractWikilinks(body);
      const hits = links.filter((l) => targetNorms.has(normalizePath(wikilinkTarget(l))));
      if (hits.length === 0) continue;

      // Snippet: primera línea que contiene un [[...]]
      const snippetLine =
        body
          .split('\n')
          .find((line) => line.includes('[['))
          ?.trim()
          .slice(0, 140) ?? '';
      backlinks.push({
        id: getNoteId(file.filePath, config.noteFolder),
        title: fm?.title ?? getFileNameWithoutExt(file.filePath),
        folder: getNoteDirRelative(file.filePath, config.noteFolder),
        snippet: snippetLine,
      });
    }

    res.json({ backlinks, total: backlinks.length });
  } catch (error: any) {
    res.status(500).json({ error: `Error al obtener backlinks: ${error.message}` });
  }
});

// ---------------------------------------------------------------------------
// GET /api/notes/:id — Obtener nota individual
// ---------------------------------------------------------------------------
router.get('/api/notes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    try {
      assertValidNoteId(id);
    } catch {
      return res.status(400).json({ error: 'ID de nota inválido' });
    }
    const config = getConfig();
    const filePath = await findNoteFileById(id, config.noteFolder);

    if (!filePath) {
      return res.status(404).json({ error: 'Nota no encontrada' });
    }

    const content = await readNote(filePath);
    const { frontmatter, body } = parseFrontmatter(content);
    const note = noteFromData(frontmatter, body, filePath, config.noteFolder);

    // Extraer wikilinks del contenido
    const wikilinks = extractWikilinks(body);

    // Obtener todas las notas para verificar wikilinks rotos
    const allFiles = await getAllMdFiles(config.noteFolder);
    const knownIds = allFiles.map((f) => getNoteId(f.filePath, config.noteFolder));
    const knownBasenames = allFiles.map((f) =>
      getFileNameWithoutExt(f.filePath).toLowerCase(),
    );

    // Determinar wikilinks rotos (acepta referencia por id completo o por nombre base;
    // usa la parte destino para soportar alias [[destino|texto]])
    const normalizedKnownIds = knownIds.map(normalizePath);
    const normalizedBasenames = knownBasenames.map(normalizePath);
    const brokenWikilinks = wikilinks.filter(
      (link) =>
        !normalizedKnownIds.includes(normalizePath(wikilinkTarget(link))) &&
        !normalizedBasenames.includes(normalizePath(wikilinkTarget(link))),
    );

    res.json({ note, wikilinks, brokenWikilinks });
  } catch (error: any) {
    res.status(500).json({ error: `Error al obtener nota: ${error.message}` });
  }
});

// ---------------------------------------------------------------------------
// POST /api/notes — Crear nueva nota
// ---------------------------------------------------------------------------
router.post('/api/notes', async (req, res) => {
  try {
    const { title, folder, content, tags } = req.body;

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({ error: 'El título es obligatorio' });
    }

    const config = getConfig();
    let safeFolder = '';
    try {
      safeFolder = folder ? sanitizeFolder(String(folder)) : '';
    } catch {
      return res.status(400).json({ error: 'Nombre de carpeta inválido' });
    }
    const noteContent = typeof content === 'string' ? content : '';
    const noteTags = Array.isArray(tags) ? tags.filter((t) => typeof t === 'string') : [];

    // Generar slug a partir del título y ubicar en la subcarpeta
    const slug = slugify(title.trim());
    const filePath = path.join(config.noteFolder, safeFolder, `${slug}.md`);

    // Verificar que no exista ya
    if (await fileExists(filePath)) {
      return res.status(409).json({ error: 'Ya existe una nota con este título en esa carpeta' });
    }

    // Crear frontmatter (folder refleja la ubicación real en disco)
    const now = new Date().toISOString();
    const frontmatter: NoteFrontmatter = {
      title: title.trim(),
      folder: safeFolder,
      created: now,
      updated: now,
      tags: noteTags,
    };

    // Reconstruir contenido completo
    const fullContent = rebuildContent(frontmatter, noteContent);

    // Escribir archivo (writeNote crea directorios intermedios)
    await writeNote(filePath, fullContent);

    // Retornar nota creada
    const note = noteFromData(frontmatter, noteContent, filePath, config.noteFolder);
    res.status(201).json({ note });
  } catch (error: any) {
    res.status(500).json({ error: `Error al crear nota: ${error.message}` });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/notes/:id — Actualizar nota (soporta rename + mover de carpeta)
// ---------------------------------------------------------------------------
router.put('/api/notes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    try {
      assertValidNoteId(id);
    } catch {
      return res.status(400).json({ error: 'ID de nota inválido' });
    }
    const { title, content, tags, folder } = req.body;

    const config = getConfig();
    const filePath = await findNoteFileById(id, config.noteFolder);

    if (!filePath) {
      return res.status(404).json({ error: 'Nota no encontrada' });
    }

    // Leer nota actual
    const existingContent = await readNote(filePath);
    const { frontmatter: existingFm, body: existingBody } =
      parseFrontmatter(existingContent);

    // Snapshot del estado anterior (Fase 6; best-effort, no bloquea el guardado)
    try {
      await saveVersion(id, existingBody, existingFm, config.historyFolder, config.maxVersions, false);
    } catch (snapError: any) {
      console.error(`[routes/notes] No se pudo versionar ${id}:`, snapError.message);
    }

    // Determinar nuevos valores
    const newTitle =
      typeof title === 'string' && title.trim().length > 0 ? title.trim() : existingFm.title;
    const newContent = content !== undefined ? String(content) : existingBody;
    const newTags =
      tags !== undefined
        ? Array.isArray(tags)
          ? tags.filter((t: unknown) => typeof t === 'string')
          : []
        : existingFm.tags;
    // Carpeta base: la ubicación real (no el frontmatter, que puede estar stale)
    let newFolder = getNoteDirRelative(filePath, config.noteFolder);
    if (folder !== undefined) {
      try {
        newFolder = folder ? sanitizeFolder(String(folder)) : '';
      } catch {
        return res.status(400).json({ error: 'Nombre de carpeta inválido' });
      }
    }

    // Actualizar timestamps
    const updatedFm = updateTimestamps({
      title: newTitle,
      folder: newFolder,
      created: existingFm.created,
      tags: newTags,
    });

    // Reconstruir contenido completo
    const fullContent = rebuildContent(updatedFm, newContent);

    // Calcular nueva ruta: si cambió título -> nuevo slug; si cambió carpeta -> mover
    const titleChanged = newTitle !== existingFm.title;
    const currentSlug = getFileNameWithoutExt(filePath);
    const newSlug = titleChanged ? slugify(newTitle) : currentSlug;
    const newFilePath = path.join(config.noteFolder, newFolder, `${newSlug}.md`);

    if (path.resolve(newFilePath) !== path.resolve(filePath)) {
      // Verificar colisión
      if (await fileExists(newFilePath)) {
        return res.status(409).json({ error: 'Ya existe una nota con ese título en esa carpeta' });
      }
      // Escribir nuevo y borrar antiguo (move/rename)
      await writeNote(newFilePath, fullContent);
      await deleteNote(filePath);

      // Mover también el historial de versiones al nuevo id (Fase 6)
      const newId = getNoteId(newFilePath, config.noteFolder);
      if (newId !== id) {
        try {
          await fs.promises.rename(
            path.join(config.historyFolder, id),
            path.join(config.historyFolder, newId),
          );
        } catch {
          // Sin historial previo → nada que mover
        }
      }

      const updatedNote = noteFromData(updatedFm, newContent, newFilePath, config.noteFolder);
      return res.json({ note: updatedNote });
    }

    // Reescribir el mismo archivo
    await writeNote(filePath, fullContent);

    // Retornar nota actualizada
    const updatedNote = noteFromData(updatedFm, newContent, filePath, config.noteFolder);
    res.json({ note: updatedNote });
  } catch (error: any) {
    res.status(500).json({ error: `Error al actualizar nota: ${error.message}` });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/notes/:id — Eliminar nota
// ---------------------------------------------------------------------------
router.delete('/api/notes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    try {
      assertValidNoteId(id);
    } catch {
      return res.status(400).json({ error: 'ID de nota inválido' });
    }
    const config = getConfig();
    const filePath = await findNoteFileById(id, config.noteFolder);

    if (!filePath) {
      return res.status(404).json({ error: 'Nota no encontrada' });
    }

    await deleteNote(filePath);
    res.json({ success: true, message: 'Nota eliminada' });
  } catch (error: any) {
    res.status(500).json({ error: `Error al eliminar nota: ${error.message}` });
  }
});

export default router;
