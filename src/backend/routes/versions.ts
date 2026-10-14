import express from 'express';

import { getConfig } from '../config';
import { parseFrontmatter } from '../services/frontmatter';
import {
  findNoteFileById,
  assertValidNoteId,
  readNote,
} from '../services/filesystem';
import {
  getVersions,
  getVersion,
  restoreVersion,
  createBookmark,
  assertValidTimestamp,
} from '../services/versioning';

const router = express.Router();

/** Resolver y validar que la nota existe; retorna null si no (ya responde 404). */
async function resolveNote(
  id: string,
  res: express.Response,
): Promise<{ config: ReturnType<typeof getConfig>; filePath: string } | null> {
  try {
    assertValidNoteId(id);
  } catch {
    res.status(400).json({ error: 'ID de nota inválido' });
    return null;
  }
  const config = getConfig();
  const filePath = await findNoteFileById(id, config.noteFolder);
  if (!filePath) {
    res.status(404).json({ error: 'Nota no encontrada' });
    return null;
  }
  return { config, filePath };
}

// ---------------------------------------------------------------------------
// GET /api/notes/:id/versions — listar versiones (metadata + preview)
// ---------------------------------------------------------------------------
router.get('/api/notes/:id/versions', async (req, res) => {
  try {
    const { id } = req.params;
    const resolved = await resolveNote(id, res);
    if (!resolved) return;

    const versions = await getVersions(id, resolved.config.historyFolder);
    res.json({
      versions: versions.map((v) => ({
        timestamp: v.timestamp,
        isBookmark: v.isBookmark,
        title: v.frontmatter.title,
        preview: v.content.slice(0, 200),
      })),
      total: versions.length,
    });
  } catch (error: any) {
    res.status(500).json({ error: `Error al listar versiones: ${error.message}` });
  }
});

// ---------------------------------------------------------------------------
// GET /api/notes/:id/versions/:timestamp — obtener una versión
// ---------------------------------------------------------------------------
router.get('/api/notes/:id/versions/:timestamp', async (req, res) => {
  try {
    const { id, timestamp } = req.params;
    const resolved = await resolveNote(id, res);
    if (!resolved) return;
    try {
      assertValidTimestamp(timestamp);
    } catch {
      return res.status(400).json({ error: 'Timestamp inválido' });
    }

    const version = await getVersion(id, timestamp, resolved.config.historyFolder);
    if (!version) {
      return res.status(404).json({ error: 'Versión no encontrada' });
    }
    res.json({ version });
  } catch (error: any) {
    res.status(500).json({ error: `Error al obtener versión: ${error.message}` });
  }
});

// ---------------------------------------------------------------------------
// POST /api/notes/:id/versions — crear versión manual (bookmark)
// ---------------------------------------------------------------------------
router.post('/api/notes/:id/versions', async (req, res) => {
  try {
    const { id } = req.params;
    const resolved = await resolveNote(id, res);
    if (!resolved) return;

    const raw = await readNote(resolved.filePath);
    const { frontmatter, body } = parseFrontmatter(raw);
    await createBookmark(id, body, frontmatter, resolved.config.historyFolder, resolved.config.maxVersions);

    const versions = await getVersions(id, resolved.config.historyFolder);
    const latest = versions[0];
    res.status(201).json({
      version: latest
        ? {
            timestamp: latest.timestamp,
            isBookmark: latest.isBookmark,
            title: latest.frontmatter.title,
            preview: latest.content.slice(0, 200),
          }
        : null,
    });
  } catch (error: any) {
    res.status(500).json({ error: `Error al crear versión: ${error.message}` });
  }
});

// ---------------------------------------------------------------------------
// POST /api/notes/:id/versions/:timestamp/restore — restaurar versión
// ---------------------------------------------------------------------------
router.post('/api/notes/:id/versions/:timestamp/restore', async (req, res) => {
  try {
    const { id, timestamp } = req.params;
    const resolved = await resolveNote(id, res);
    if (!resolved) return;
    try {
      assertValidTimestamp(timestamp);
    } catch {
      return res.status(400).json({ error: 'Timestamp inválido' });
    }

    const result = await restoreVersion(
      id,
      timestamp,
      resolved.config.historyFolder,
      resolved.config.noteFolder,
      resolved.config.maxVersions,
    );
    if (!result.success) {
      const notFound = result.error?.includes('no encontrada');
      return res.status(notFound ? 404 : 500).json({ error: result.error ?? 'No se pudo restaurar' });
    }
    res.json({ success: true, message: 'Versión restaurada' });
  } catch (error: any) {
    res.status(500).json({ error: `Error al restaurar versión: ${error.message}` });
  }
});

export default router;
