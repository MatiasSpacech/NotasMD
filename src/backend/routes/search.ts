import express from 'express';

import { getConfig, ensureDir } from '../config';
import { parseFrontmatter } from '../services/frontmatter';
import {
  getAllMdFiles,
  getNoteId,
  readNote,
} from '../services/filesystem';
import {
  SearchIndex,
  indexNote,
  searchAll,
} from '../services/indexer';

const router = express.Router();

type Scope = 'all' | 'title' | 'content' | 'tags';
const SCOPES: Scope[] = ['all', 'title', 'content', 'tags'];
const MAX_QUERY_LEN = 200;

/**
 * Índice en memoria con TTL (Fase 8, item 53):
 * evita re-leer todo el disco en cada tecla del buscador.
 * Se invalida al cambiar la carpeta de notas o cada 3s.
 */
const CACHE_TTL_MS = 3000;
let cache: { folder: string; at: number; docs: SearchIndex[] } = {
  folder: '',
  at: 0,
  docs: [],
};

async function getDocs(noteFolder: string): Promise<SearchIndex[]> {
  const now = Date.now();
  if (cache.folder === noteFolder && now - cache.at < CACHE_TTL_MS) {
    return cache.docs;
  }
  const files = await getAllMdFiles(noteFolder);
  const docs: SearchIndex[] = [];
  for (const file of files) {
    try {
      const raw = await readNote(file.filePath);
      const { frontmatter, body } = parseFrontmatter(raw);
      docs.push(
        indexNote(
          getNoteId(file.filePath, noteFolder),
          frontmatter.title,
          body,
          frontmatter.tags,
          file.folder || '',
        ),
      );
    } catch {
      // saltar ficheros corruptos
    }
  }
  cache = { folder: noteFolder, at: now, docs };
  return docs;
}

/** Puntuación uniforme (misma fórmula que searchAll): título 10, contenido 2/match, tags 5. */
function scoreDoc(doc: SearchIndex, q: string): number {
  let score = 0;
  if (doc.title.toLowerCase().includes(q)) score += 10;
  score += (doc.content.toLowerCase().split(q).length - 1) * 2;
  if (doc.tags.some((t) => t.toLowerCase().includes(q))) score += 5;
  return score;
}

/** Extracto alrededor de la primera coincidencia en el contenido. */
function makeSnippet(content: string, query: string, radius = 70): string {
  const flat = content.replace(/\s+/g, ' ').trim();
  const q = query.toLowerCase().trim();
  if (!q) return flat.slice(0, 140);
  const i = flat.toLowerCase().indexOf(q);
  if (i === -1) return flat.slice(0, 140);
  const start = Math.max(0, i - radius);
  const end = Math.min(flat.length, i + q.length + radius);
  return `${start > 0 ? '…' : ''}${flat.slice(start, end)}${end < flat.length ? '…' : ''}`;
}

// ---------------------------------------------------------------------------
// GET /api/search?q=...&scope=all|title|content|tags
// ---------------------------------------------------------------------------
router.get('/api/search', async (req, res) => {
  try {
    const rawQ = typeof req.query.q === 'string' ? req.query.q : '';
    const query = rawQ.trim().slice(0, MAX_QUERY_LEN);
    if (!query) {
      return res.status(400).json({ error: 'Se requiere el parámetro q' });
    }
    const scope: Scope = SCOPES.includes(req.query.scope as Scope)
      ? (req.query.scope as Scope)
      : 'all';

    const config = getConfig();
    await ensureDir(config.noteFolder);
    const docs = await getDocs(config.noteFolder);
    const q = query.toLowerCase();

    let ranked: SearchIndex[];
    if (scope === 'all') {
      ranked = searchAll(docs, query);
    } else if (scope === 'title') {
      ranked = docs
        .filter((d) => d.title.toLowerCase().includes(q))
        .sort((a, b) => scoreDoc(b, q) - scoreDoc(a, q));
    } else if (scope === 'content') {
      ranked = docs
        .filter((d) => d.content.toLowerCase().includes(q))
        .sort((a, b) => scoreDoc(b, q) - scoreDoc(a, q));
    } else {
      ranked = docs
        .filter((d) => d.tags.some((t) => t.toLowerCase().includes(q)))
        .sort((a, b) => scoreDoc(b, q) - scoreDoc(a, q));
    }

    res.json({
      results: ranked.map((d) => ({
        id: d.id,
        title: d.title,
        folder: d.folder,
        tags: d.tags,
        snippet: makeSnippet(d.content, query),
        score: scoreDoc(d, q),
      })),
      total: ranked.length,
      query,
      scope,
    });
  } catch (error: any) {
    res.status(500).json({ error: `Error en búsqueda: ${error.message}` });
  }
});

export default router;
