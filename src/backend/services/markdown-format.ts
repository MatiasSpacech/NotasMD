import prettier from 'prettier';
import { parseFrontmatter, rebuildContent } from './frontmatter';

/**
 * Auto-formateo Markdown:
 * 1. Protege [[wikilinks]] con placeholders (prettier nunca los toca).
 * 2. Normaliza líneas inequívocas fuera de fences (`#T`→`# T`, `>c`→`> c`, `- [ ]x`→`- [ ] x`).
 * 3. Formatea con prettier (listas, tablas, fences, espacios).
 * 4. Restaura wikilinks.
 *
 * Nota: `#5 ranking` también gana espacio (pasa a ser header). Es el tradeoff
 * documentado de normalizar ATX; el preview del diff lo hace visible.
 */

const PLACE_OPEN = '￰WIKILINK';
const PLACE_CLOSE = '￱';
const WIKILINK_RE = /\[\[[^\]\n]+\]\]/g;

function protectWikilinks(body: string): { text: string; restore: (s: string) => string } {
  const found: string[] = [];
  const text = body.replace(WIKILINK_RE, (m) => {
    found.push(m);
    return `${PLACE_OPEN}${found.length - 1}${PLACE_CLOSE}`;
  });
  const pattern = new RegExp(`${PLACE_OPEN}(\\d+)${PLACE_CLOSE}`, 'g');
  return {
    text,
    restore: (s: string) => s.replace(pattern, (_, i) => found[Number(i)] ?? _),
  };
}

/** Normalizaciones de línea (fuera de bloques cercados). */
function normalizeLines(text: string): string {
  const lines = text.split('\n');
  let inFence = false;
  return lines
    .map((line) => {
      if (/^\s*(`{3,}|~{3,})/.test(line)) {
        inFence = !inFence;
        return line;
      }
      if (inFence) return line;
      // Tareas (cualquier bullet, con o sin espacio): `- [ ]x` -> `- [ ] x`
      const task = line.replace(
        /^(\s{0,3})([-*+]|\d+[.)])\s?\[([ xX])\](?=\S)/u,
        '$1$2 [$3] ',
      );
      if (task !== line) return task;
      // Bullets pegados a letra (`-item` -> `- item`), sin romper énfasis
      // (`*cursiva*`, `-nota-`) ni negativos (`-5`)
      const bullet = line.match(/^(\s{0,3})([-*+])(?=[A-Za-zÀ-ÿ])/u);
      if (bullet) {
        const rest = line.slice(bullet[0].length);
        // `*`/`+`: si hay otro marcador después, es énfasis (`*x* resto`), no lista
        // `-`: solo se respeta cierre con guion al final (`-nota-`)
        const closed =
          bullet[2] === '-'
            ? /^\S.*\S-\s*$/.test(rest)
            : /[*+]/.test(rest);
        if (!closed) return `${bullet[1]}${bullet[2]} ${rest}`;
      }
      return line
        .replace(/^(\s{0,3})(#{1,6})([^#\s])/u, '$1$2 $3')
        .replace(/^(\s{0,3})(>{1,3})([^>\s])/u, '$1$2 $3')
        .replace(/^(\s{0,3})(\d+)([.)])(?=[A-Za-zÀ-ÿ])/u, '$1$2. ');
    })
    .join('\n');
}

/** Formatear solo el cuerpo markdown (sin frontmatter). */
export async function formatMarkdownBody(body: string): Promise<string> {
  const { text, restore } = protectWikilinks(body);
  const formatted = await prettier.format(normalizeLines(text), {
    parser: 'markdown',
    proseWrap: 'preserve',
  });
  return restore(formatted);
}

/**
 * Formatear una nota completa (con frontmatter).
 * El frontmatter se conserva tal cual; solo se formatea el cuerpo.
 */
export async function formatNoteContent(fullContent: string): Promise<{ formatted: string; changed: boolean }> {
  const normalized = fullContent.replace(/\r\n/g, '\n');
  const { frontmatter, body } = parseFrontmatter(normalized);
  // Sin frontmatter explícito, formatear el texto tal cual
  const hasFrontmatter = /^---\n/.test(normalized);
  const formattedBody = await formatMarkdownBody(body);
  const formatted = hasFrontmatter ? rebuildContent(frontmatter, formattedBody) : formattedBody;
  return { formatted, changed: formatted !== normalized };
}
