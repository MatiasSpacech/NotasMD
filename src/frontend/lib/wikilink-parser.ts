/**
 * Parser de [[wikilinks]] para referencias cruzadas entre notas
 * Versión frontend (sin dependencias de backend)
 */

export function extractWikilinks(content: string): string[] {
  const regex = /\[\[([^\]]+)\]\]/g;
  const links: string[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    links.push(match[1].trim());
  }
  return links;
}

export function normalizePath(name: string): string {
  return name.toLowerCase().replace(/\.md$/, '').trim();
}

export function parseWikilink(text: string): { original: string; target: string; display: string } {
  const match = text.match(/^\[\[([^\]]+)\]\]$/);
  if (!match) {
    return { original: text, target: text, display: text };
  }
  const content = match[1];
  const parts = content.split('|');
  const target = parts[0]?.trim() || content;
  const display = parts[1]?.trim() || target;
  return { original: text, target: normalizePath(target), display };
}

export function findBrokenWikilinks(content: string, knownNoteIds: string[]): string[] {
  const wikilinks = extractWikilinks(content);
  const normalizedIds = knownNoteIds.map(normalizePath);
  return wikilinks.filter((link) => {
    const target = link.split('|')[0]?.trim() || link;
    return !normalizedIds.includes(normalizePath(target));
  });
}

export function parseDisplayTitle(text: string): { link: string; title?: string } {
  const parts = text.split('|');
  return { link: parts[0]?.trim() || text, title: parts[1]?.trim() };
}

/**
 * Detectar un trigger de autocompletado `[[...` antes del cursor (Fase 5).
 * Retorna la query y la posición donde empieza el `[[`, o null si no hay trigger.
 * No matchea si ya se cerró con `]]` (los `]` rompen el match).
 */
export function matchWikiTrigger(
  value: string,
  cursor: number,
): { query: string; start: number } | null {
  const safeCursor = Math.max(0, Math.min(cursor, value.length));
  const before = value.slice(0, safeCursor);
  const m = before.match(/\[\[([^\[\]\n]*)$/);
  if (!m) return null;
  return { query: m[1] ?? '', start: safeCursor - m[0].length };
}
