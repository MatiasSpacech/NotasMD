/**
 * Motor de autocompletado Markdown (Fase 7, item 48).
 * Detecta patrones antes del cursor y ofrece snippets/inserciones.
 * Los wikilinks `[[` se resuelven antes (vía matchWikiTrigger, Fase 5).
 */

import { TABLE_SNIPPET, EditResult } from './markdown';

export interface LinkNote {
  id: string;
  title: string;
  folder: string;
}

export type MdTriggerKind = 'headers' | 'lists' | 'code' | 'table' | 'hr' | 'bold' | 'image';

export interface MdTrigger {
  kind: MdTriggerKind;
  /** Texto parcial para filtrar (p. ej. query de imagen) */
  query: string;
  /** Rango a reemplazar al aceptar */
  start: number;
  end: number;
  /** Detalle según kind: nº de # | marcador de lista | nº de backticks */
  meta?: string;
}

export interface MdSuggestion {
  key: string;
  label: string;
  hint?: string;
  /** Título legible (image) */
  value?: string;
  /** Destino del enlace (image) */
  target?: string;
}

export const MD_MAX_SUGGESTIONS = 8;

/** ¿Cursor al final de la línea? (los triggers estructurales lo exigen) */
function atEndOfLine(value: string, pos: number): boolean {
  const next = value[pos];
  return next === undefined || next === '\n';
}

/**
 * Detectar un trigger Markdown antes del cursor.
 * Retorna null si no hay ninguno.
 */
export function matchMdTrigger(value: string, cursor: number): MdTrigger | null {
  const pos = Math.max(0, Math.min(cursor, value.length));
  const before = value.slice(0, pos);
  const lineStart = before.lastIndexOf('\n') + 1;
  const line = before.slice(lineStart);
  const eol = atEndOfLine(value, pos);

  // 1. Imagen: ![query  o  ![](query  (sin cerrar)
  let m = line.match(/!\[[^\]\n]*$/);
  if (m && m.index !== undefined) {
    const start = lineStart + m.index;
    const skipParen = value[pos] === ')' ? 1 : 0;
    return { kind: 'image', query: m[0].slice(2), start, end: pos + skipParen };
  }
  m = line.match(/!\[[^\]]*\]\(([^()\n]*)$/);
  if (m && m.index !== undefined) {
    const start = lineStart + m.index;
    const skipParen = value[pos] === ')' ? 1 : 0;
    return { kind: 'image', query: m[1] ?? '', start, end: pos + skipParen };
  }

  // 2. Encabezados: línea con solo 1-3 # (al final de línea)
  m = line.match(/^(#{1,3})$/);
  if (m && eol) {
    return { kind: 'headers', query: m[1], start: lineStart, end: pos, meta: m[1] };
  }

  // 3. Listas: línea `-`, `- `, `1.`, `1. ` (al final de línea)
  m = line.match(/^(-\s?|\d+\.\s?)$/);
  if (m && eol) {
    return { kind: 'lists', query: m[1], start: lineStart, end: pos, meta: m[1] };
  }

  // 4. Separador: línea terminada en `--` (al final de línea)
  if (eol && /(^|\s)--$/.test(line)) {
    return { kind: 'hr', query: '--', start: pos - 2, end: pos };
  }

  // 5. Código: 1-3 backticks al final, sin otro backtick antes en la línea
  m = line.match(/(`{1,3})$/);
  if (m) {
    const rest = line.slice(0, line.length - m[1].length);
    if (!rest.includes('`')) {
      return { kind: 'code', query: m[1], start: pos - m[1].length, end: pos, meta: m[1] };
    }
  }

  // 6. Tabla: primer `|` de la línea (sin otros pipes antes)
  if (line.endsWith('|') && !line.slice(0, -1).includes('|')) {
    return { kind: 'table', query: '|', start: pos - 1, end: pos };
  }

  // 7. Negrita: `**` fresco (tras inicio/espacio, sin `**` previo en la línea)
  m = line.match(/(^|\s)(\*\*)$/);
  if (m) {
    const runStart = pos - 2;
    if (!line.slice(0, runStart - lineStart).includes('**')) {
      return { kind: 'bold', query: '**', start: runStart, end: pos };
    }
  }

  return null;
}

/** Resolver el destino de imagen (con carpeta si el título está duplicado). */
function imageTarget(note: LinkNote, notes: LinkNote[]): string {
  const dupes = notes.filter((n) => n.title === note.title).length;
  return dupes > 1 && note.folder ? `${note.folder}/${note.title}` : note.title;
}

/**
 * Sugerencias para un trigger.
 */
export function getMdSuggestions(trigger: MdTrigger, notes: LinkNote[]): MdSuggestion[] {
  switch (trigger.kind) {
    case 'headers':
      return [
        { key: 'h1', label: '# Encabezado 1', hint: '# ' },
        { key: 'h2', label: '## Encabezado 2', hint: '## ' },
        { key: 'h3', label: '### Encabezado 3', hint: '### ' },
      ];
    case 'lists': {
      const fromOrdered = /^\d/.test(trigger.meta ?? '');
      const items: MdSuggestion[] = [
        { key: 'task', label: 'Tarea', hint: '- [ ] ' },
        fromOrdered
          ? { key: 'ul', label: 'Lista desordenada', hint: '- ' }
          : { key: 'ol', label: 'Lista ordenada', hint: '1. ' },
      ];
      return items;
    }
    case 'code':
      return trigger.meta === '```'
        ? [{ key: 'block', label: 'Bloque de código', hint: '```' }]
        : [
            { key: 'inline', label: 'Código inline', hint: '`código`' },
            { key: 'block', label: 'Bloque de código', hint: '```' },
          ];
    case 'table':
      return [{ key: 'table', label: 'Tabla 2×2', hint: '| H | H |' }];
    case 'hr':
      return [{ key: 'hr', label: 'Separador horizontal', hint: '---' }];
    case 'bold':
      return [{ key: 'bold', label: 'Negrita', hint: '**texto**' }];
    case 'image': {
      const q = trigger.query.toLowerCase();
      return notes
        .filter(
          (n) =>
            !q ||
            n.title.toLowerCase().includes(q) ||
            `${n.folder}/${n.title}`.toLowerCase().includes(q),
        )
        .slice(0, MD_MAX_SUGGESTIONS)
        .map((n) => ({
          key: n.id,
          label: `![${n.title}]`,
          hint: n.folder ? `📁 ${n.folder}` : undefined,
          value: n.title,
          target: imageTarget(n, notes),
        }));
    }
  }
}

const HEADER_INSERT: Record<string, string> = { h1: '# ', h2: '## ', h3: '### ' };
const LIST_INSERT: Record<string, string> = { task: '- [ ] ', ol: '1. ', ul: '- ' };

/**
 * Aplicar una sugerencia: reemplaza el rango del trigger.
 */
export function applyMdSuggestion(
  value: string,
  trigger: MdTrigger,
  suggestion: MdSuggestion,
): EditResult {
  const head = value.slice(0, trigger.start);
  const tail = value.slice(trigger.end);
  const place = (insert: string, selOffset?: number): EditResult => {
    const next = head + insert + tail;
    const pos = trigger.start + (selOffset ?? insert.length);
    return { value: next, selStart: pos, selEnd: pos };
  };

  switch (trigger.kind) {
    case 'headers':
      return place(HEADER_INSERT[suggestion.key] ?? '# ');
    case 'lists':
      return place(LIST_INSERT[suggestion.key] ?? '- [ ] ');
    case 'code':
      if (suggestion.key === 'block') {
        const insert = '```\ncódigo\n```';
        return { value: head + insert + tail, selStart: trigger.start + 4, selEnd: trigger.start + 10 };
      }
      return { value: head + '`código`' + tail, selStart: trigger.start + 1, selEnd: trigger.start + 7 };
    case 'table':
      return place(TABLE_SNIPPET);
    case 'hr':
      return place('---');
    case 'bold':
      return { value: head + '**texto**' + tail, selStart: trigger.start + 2, selEnd: trigger.start + 7 };
    case 'image': {
      const title = suggestion.value ?? 'imagen';
      const insert = `![${title}](${suggestion.target ?? title})`;
      return place(insert);
    }
  }
}
