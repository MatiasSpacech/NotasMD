/**
 * Helpers Markdown puros (Fase 4).
 * Operan sobre { value, start, end } para ser testeables sin DOM.
 * `NoteEditor` los aplica al textarea (propio o el interno de MDEditor).
 */

export interface TextSelection {
  value: string;
  start: number;
  end: number;
}

export interface EditResult {
  value: string;
  /** Posición de cursor/selección a restaurar tras aplicar */
  selStart: number;
  selEnd: number;
}

export const TABLE_SNIPPET =
  '| Header 1 | Header 2 |\n|----------|----------|\n|          |          |\n';

/**
 * Envolver la selección con `before`/`after`.
 * Sin selección, inserta `placeholder` envuelto y lo deja seleccionado.
 */
export function wrapSelection(
  value: string,
  start: number,
  end: number,
  before: string,
  after: string,
  placeholder = 'texto',
): EditResult {
  const s = Math.max(0, Math.min(start, value.length));
  const e = Math.max(0, Math.min(end, value.length));
  const from = Math.min(s, e);
  const to = Math.max(s, e);
  const selected = value.slice(from, to) || placeholder;
  const next = value.slice(0, from) + before + selected + after + value.slice(to);
  const selStart = from + before.length;
  const selEnd = selStart + selected.length;
  return { value: next, selStart, selEnd };
}

/**
 * Añadir `prefix` a cada línea con contenido dentro del rango.
 * Si la selección es de una sola línea, prefija la línea del cursor
 * (aunque el cursor esté en medio de la línea).
 */
export function prefixSelectedLines(
  value: string,
  start: number,
  end: number,
  prefix: string,
): EditResult {
  const s = Math.max(0, Math.min(start, value.length));
  const e = Math.max(0, Math.min(end, value.length));
  const from = Math.min(s, e);
  const to = Math.max(s, e);

  // Extender al inicio de la primera línea y al fin de la última
  const blockStart = value.lastIndexOf('\n', from - 1) + 1;
  const nextNl = value.indexOf('\n', to);
  const blockEnd = nextNl === -1 ? value.length : nextNl;

  const block = value.slice(blockStart, blockEnd);
  const lines = block.split('\n');
  const prefixed = lines
    .map((line) => {
      if (line.trim().length === 0) return line; // no tocar líneas vacías
      if (line.startsWith(prefix)) return line; // idempotente
      return prefix + line;
    })
    .join('\n');

  const next = value.slice(0, blockStart) + prefixed + value.slice(blockEnd);
  const added = prefixed.length - block.length;
  return {
    value: next,
    selStart: from + prefix.length,
    selEnd: to + added,
  };
}

/**
 * Reemplazar la selección con un snippet (tabla, separador, etc.).
 * Sin selección, lo inserta en el cursor.
 */
export function insertSnippet(
  value: string,
  start: number,
  end: number,
  snippet: string,
): EditResult {
  const s = Math.max(0, Math.min(start, value.length));
  const e = Math.max(0, Math.min(end, value.length));
  const from = Math.min(s, e);
  const to = Math.max(s, e);
  const sep = from > 0 && !value.slice(0, from).endsWith('\n') ? '\n' : '';
  const insert = sep + snippet;
  const next = value.slice(0, from) + insert + value.slice(to);
  const pos = from + insert.length;
  return { value: next, selStart: pos, selEnd: pos };
}

/** Contar palabras (para la barra de estado). */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).length;
}
