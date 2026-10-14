import express from 'express';
import path from 'path';
import JSZip from 'jszip';
import { extractText } from 'unpdf';

import { getConfig, ensureDir } from '../config';
import { HISTORY_DIR_NAME } from '../services/filesystem';
import { getAllMdFiles, readNote, writeNote, sanitizeFolder, fileExists } from '../services/filesystem';
import { parseFrontmatter, rebuildContent, NoteFrontmatter } from '../services/frontmatter';

const router = express.Router();

const MAX_EXPORT_FILES = 2000;
const MAX_EXPORT_BYTES = 100 * 1024 * 1024;
const MAX_IMPORT_FILES = 1000;
const MAX_IMPORT_FILE_BYTES = 2 * 1024 * 1024;
const MAX_IMPORT_PDF_BYTES = 20 * 1024 * 1024;
const MAX_IMPORT_TOTAL_BYTES = 50 * 1024 * 1024;
const MAX_IMPORT_PAYLOAD_CHARS = 80 * 1024 * 1024; // base64 aprox

// ---------------------------------------------------------------------------
// POST /api/export/zip — descargar notas como ZIP
// Body: { folder?: string } (vacío = todo)
// ---------------------------------------------------------------------------
router.post('/api/export/zip', async (req, res) => {
  try {
    const { folder } = req.body as { folder?: string };
    const config = getConfig();
    await ensureDir(config.noteFolder);

    let baseAbs = config.noteFolder;
    let zipName = 'notas.zip';
    if (typeof folder === 'string' && folder.trim()) {
      let safe: string;
      try {
        safe = sanitizeFolder(folder);
      } catch {
        return res.status(400).json({ error: 'Carpeta inválida' });
      }
      if (!safe) return res.status(400).json({ error: 'Carpeta inválida' });
      baseAbs = path.join(config.noteFolder, safe);
      zipName = `${safe.split('/').pop()}.zip`;
    }

    const files = await getAllMdFiles(baseAbs);
    if (files.length > MAX_EXPORT_FILES) {
      return res.status(400).json({ error: `Demasiados ficheros para exportar (${files.length})` });
    }

    const zip = new JSZip();
    let totalBytes = 0;
    for (const file of files) {
      // getAllMdFiles ya excluye .notas-history
      const rel = path.relative(baseAbs, file.filePath).split(path.sep).join('/');
      if (!rel || rel.startsWith('..')) continue;
      const content = await readNote(file.filePath);
      totalBytes += Buffer.byteLength(content, 'utf-8');
      if (totalBytes > MAX_EXPORT_BYTES) {
        return res.status(400).json({ error: 'Exportación demasiado grande' });
      }
      zip.file(rel, content);
    }

    const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);
    res.setHeader('Content-Length', String(buffer.length));
    res.send(buffer);
  } catch (error: any) {
    res.status(500).json({ error: `Error al exportar: ${error.message}` });
  }
});

interface ImportEntry {
  /** Ruta relativa destino, siempre .md */
  name: string;
  /** Contenido markdown final (con frontmatter) */
  content: string;
}

/** Carpeta (dir) de una ruta relativa con `/`. "" = raíz. */
function dirOf(rel: string): string {
  const i = rel.lastIndexOf('/');
  return i === -1 ? '' : rel.slice(0, i);
}

/** Destino .md para una entrada (.md se conserva, .txt/.pdf se convierten). Null si no soportado. */
function importTargetName(entryName: string): string | null {
  const lower = entryName.toLowerCase();
  if (lower.endsWith('.md')) return entryName;
  if (lower.endsWith('.txt')) return entryName.slice(0, -4) + '.md';
  if (lower.endsWith('.pdf')) return entryName.slice(0, -4) + '.md';
  return null;
}

/** Extensión origen: '.md' | '.txt' | '.pdf'. */
function sourceExt(entryName: string): '.md' | '.txt' | '.pdf' {
  const lower = entryName.toLowerCase();
  if (lower.endsWith('.pdf')) return '.pdf';
  if (lower.endsWith('.txt')) return '.txt';
  return '.md';
}

/** Título legible desde un nombre de fichero: "mis-notas_2" -> "mis notas 2". */
function prettifyTitle(base: string): string {
  const clean = base.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return clean || 'Sin título';
}

/**
 * Normalizar texto importado a .md con frontmatter:
 * - .txt (o .md sin frontmatter): inyecta frontmatter con título del fichero.
 * - .md con frontmatter: conserva todo pero fija folder a la ubicación real.
 */
function ensureMarkdown(raw: string, targetName: string): string {
  const text = raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const folder = dirOf(targetName);
  const fileName = targetName.slice(targetName.lastIndexOf('/') + 1);
  const title = prettifyTitle(fileName.slice(0, -3));
  if (/^---\n/.test(text)) {
    const { frontmatter, body } = parseFrontmatter(text);
    frontmatter.folder = folder;
    if (!frontmatter.title || frontmatter.title === 'Sin título') frontmatter.title = title;
    return rebuildContent(frontmatter, body);
  }
  const now = new Date().toISOString();
  const fm: NoteFrontmatter = { title, folder, created: now, updated: now, tags: [] };
  return rebuildContent(fm, text);
}

/** ¿Ruta relativa segura (sin traversal, absoluta o reservada)? */
function isSafeRelPath(rel: string): boolean {
  if (!rel || rel.startsWith('/')) return false;
  if (/^[a-zA-Z]:\//.test(rel)) return false;
  const segs = rel.split('/');
  if (segs.some((p) => p === '' || p === '..')) return false;
  if (segs.includes(HISTORY_DIR_NAME)) return false;
  return true;
}

/**
 * Extraer el texto de un PDF y convertirlo a markdown con frontmatter.
 * Lanza Error claro si está corrupto/protegido o sin texto (escaneado).
 */
async function extractPdfMarkdown(data: Buffer, targetName: string): Promise<string> {
  let pages: string[];
  try {
    const result = await extractText(new Uint8Array(data), { mergePages: false });
    pages = Array.isArray(result.text) ? result.text : [result.text];
  } catch {
    throw new Error('No se pudo leer el PDF (¿corrupto o protegido?)');
  }
  const body = pages
    .map((p) => p.replace(/\r\n/g, '\n').replace(/\0/g, '').trim())
    .filter((p) => p.length > 0)
    .map((p, i) => (i === 0 ? p : `<!-- página ${i + 1} -->\n\n${p}`))
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!body) {
    throw new Error('El PDF no contiene texto extraíble (¿escaneado?)');
  }
  return ensureMarkdown(body, targetName);
}

/** Validar y extraer entradas .md/.txt de un ZIP (solo lectura, sin escribir). */
async function parseImportZip(buffer: Buffer): Promise<{ entries: ImportEntry[]; skipped: string[] }> {
  const zip = await JSZip.loadAsync(buffer);
  const entries: ImportEntry[] = [];
  const skipped: string[] = [];
  const seen = new Set<string>();
  let totalBytes = 0;

  const names = Object.keys(zip.files).sort();
  for (const name of names) {
    const entry = zip.files[name];
    if (entry.dir) continue;
    const normalized = name.split('\\').join('/');
    const target = importTargetName(normalized);
    if (!target || !isSafeRelPath(target)) {
      skipped.push(name);
      continue;
    }
    const baseName = target.slice(target.lastIndexOf('/') + 1, -3);
    if (!baseName || baseName.startsWith('.')) {
      skipped.push(name);
      continue;
    }
    // Colisión .md/.txt -> mismo destino dentro del propio ZIP
    if (seen.has(target.toLowerCase())) {
      skipped.push(name);
      continue;
    }
    const data = await entry.async('nodebuffer');
    const cap = sourceExt(normalized) === '.pdf' ? MAX_IMPORT_PDF_BYTES : MAX_IMPORT_FILE_BYTES;
    if (data.length > cap) {
      skipped.push(name);
      continue;
    }
    totalBytes += data.length;
    if (totalBytes > MAX_IMPORT_TOTAL_BYTES || entries.length >= MAX_IMPORT_FILES) {
      skipped.push(name);
      continue;
    }
    seen.add(target.toLowerCase());
    try {
      const content =
        sourceExt(normalized) === '.pdf'
          ? await extractPdfMarkdown(data, target)
          : ensureMarkdown(data.toString('utf-8'), target);
      entries.push({ name: target, content });
    } catch {
      // PDF corrupto/protegido o sin texto → omitido
      skipped.push(name);
    }
  }
  return { entries, skipped };
}

// ---------------------------------------------------------------------------
// POST /api/import/zip — importar notas desde un ZIP en base64
// Body: { data: string (base64), overwrite?: boolean }
// ---------------------------------------------------------------------------
router.post('/api/import/zip', async (req, res) => {
  try {
    const { data, overwrite } = req.body as { data?: string; overwrite?: boolean };
    if (typeof data !== 'string' || data.length === 0) {
      return res.status(400).json({ error: 'Se requiere data en base64' });
    }
    if (data.length > MAX_IMPORT_PAYLOAD_CHARS) {
      return res.status(400).json({ error: 'Fichero demasiado grande' });
    }

    let buffer: Buffer;
    try {
      buffer = Buffer.from(data, 'base64');
    } catch {
      return res.status(400).json({ error: 'base64 inválido' });
    }
    if (buffer.length === 0 || buffer.length > MAX_IMPORT_TOTAL_BYTES) {
      return res.status(400).json({ error: 'Fichero vacío o demasiado grande' });
    }

    let parsed: { entries: ImportEntry[]; skipped: string[] };
    try {
      parsed = await parseImportZip(buffer);
    } catch {
      return res.status(400).json({ error: 'ZIP inválido o corrupto' });
    }

    const config = getConfig();
    await ensureDir(config.noteFolder);

    let imported = 0;
    const skipped: string[] = [...parsed.skipped];
    const errors: string[] = [];
    for (const entry of parsed.entries) {
      const absPath = path.join(config.noteFolder, entry.name);
      // Defensa en profundidad: el resultado debe quedar dentro de la carpeta
      if (path.relative(config.noteFolder, absPath).startsWith('..')) {
        skipped.push(entry.name);
        continue;
      }
      try {
        if ((await fileExists(absPath)) && !overwrite) {
          skipped.push(entry.name);
          continue;
        }
        await writeNote(absPath, entry.content);
        imported++;
      } catch (e: any) {
        errors.push(`${entry.name}: ${e.message}`);
      }
    }

    res.json({ imported, skipped: skipped.length, skippedFiles: skipped.slice(0, 20), errors: errors.slice(0, 10) });
  } catch (error: any) {
    res.status(500).json({ error: `Error al importar: ${error.message}` });
  }
});

// ---------------------------------------------------------------------------
// POST /api/import/file — importar un fichero suelto (.md/.txt/.pdf)
// Body texto: { filename: "carpeta/nota.txt", content: "...", overwrite?: boolean }
// Body binario (PDF): { filename: "doc.pdf", data: "<base64>", overwrite?: boolean }
// Los .txt/.pdf se convierten a .md con frontmatter.
// ---------------------------------------------------------------------------
router.post('/api/import/file', async (req, res) => {
  try {
    const { filename, content, data, overwrite } = req.body as {
      filename?: string;
      content?: string;
      data?: string;
      overwrite?: boolean;
    };
    if (typeof filename !== 'string' || !filename.trim()) {
      return res.status(400).json({ error: 'Se requiere filename (.md/.txt/.pdf)' });
    }

    const normalized = filename.trim().split('\\').join('/').replace(/^\/+/, '');
    const target = importTargetName(normalized);
    if (!target || !isSafeRelPath(target)) {
      return res.status(400).json({ error: 'Solo se aceptan ficheros .md, .txt y .pdf con rutas válidas' });
    }
    const dir = dirOf(target);
    if (dir) {
      try {
        sanitizeFolder(dir);
      } catch {
        return res.status(400).json({ error: 'Carpeta inválida' });
      }
    }
    const baseName = target.slice(target.lastIndexOf('/') + 1, -3);
    if (!baseName || baseName.startsWith('.')) {
      return res.status(400).json({ error: 'Nombre de fichero inválido' });
    }

    const ext = sourceExt(normalized);
    let markdown: string;
    if (ext === '.pdf') {
      if (typeof data !== 'string' || data.length === 0) {
        return res.status(400).json({ error: 'El PDF debe enviarse en base64 (data)' });
      }
      if (data.length > MAX_IMPORT_PAYLOAD_CHARS) {
        return res.status(400).json({ error: 'Fichero demasiado grande' });
      }
      const buffer = Buffer.from(data, 'base64');
      if (buffer.length === 0 || buffer.length > MAX_IMPORT_PDF_BYTES) {
        return res.status(400).json({ error: 'Fichero vacío o demasiado grande' });
      }
      try {
        markdown = await extractPdfMarkdown(buffer, target);
      } catch (e: any) {
        return res.status(400).json({ error: e.message });
      }
    } else {
      if (typeof content !== 'string') {
        return res.status(400).json({ error: 'Se requiere content (texto)' });
      }
      if (Buffer.byteLength(content, 'utf-8') > MAX_IMPORT_FILE_BYTES) {
        return res.status(400).json({ error: 'Fichero demasiado grande' });
      }
      markdown = ensureMarkdown(content, target);
    }

    const config = getConfig();
    await ensureDir(config.noteFolder);
    const absPath = path.join(config.noteFolder, target);
    if (path.relative(config.noteFolder, absPath).startsWith('..')) {
      return res.status(400).json({ error: 'Ruta inválida' });
    }
    if ((await fileExists(absPath)) && !overwrite) {
      return res.status(409).json({ error: 'Ya existe una nota en esa ruta (usa overwrite)' });
    }

    await writeNote(absPath, markdown);
    res.status(201).json({ imported: target });
  } catch (error: any) {
    res.status(500).json({ error: `Error al importar: ${error.message}` });
  }
});

export default router;
