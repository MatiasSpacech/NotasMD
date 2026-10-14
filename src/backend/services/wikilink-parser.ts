/**
 * Parser de [[wikilinks]] para referencias cruzadas entre notas
 */

/**
 * Extraer todos los wikilinks [[nota]] de un contenido
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

/**
 * Normalizar un nombre de nota para comparación
 * "Proyecto/Tareas" -> "proyecto/tareas"
 */
export function normalizePath(name: string): string {
  return name
    .toLowerCase()
    .replace(/\.md$/, '')
    .trim();
}

/**
 * Parsear un wikilink completo
 * [[nota]] -> { original: '[[nota]]', target: 'nota', display: 'nota' }
 * [[nota|Título]] -> { original: '[[nota|Título]]', target: 'nota', display: 'Título' }
 */
export function parseWikilink(text: string): { original: string; target: string; display: string } {
  const match = text.match(/^\[\[([^\]]+)\]\]$/);
  if (!match) {
    return { original: text, target: text, display: text };
  }

  const content = match[1];
  const parts = content.split('|');
  const target = parts[0]?.trim() || content;
  const display = parts[1]?.trim() || target;

  return {
    original: text,
    target: normalizePath(target),
    display,
  };
}

/**
 * Detectar wikilinks rotos (referencias a notas que no existen).
 * Soporta alias [[destino|texto]] (solo se compara el destino).
 */
export function findBrokenWikilinks(
  content: string,
  knownNoteIds: string[],
): string[] {
  const wikilinks = extractWikilinks(content);
  const normalizedIds = knownNoteIds.map(normalizePath);
  const broken: string[] = [];

  for (const link of wikilinks) {
    const target = link.split('|')[0]?.trim() || link;
    const normalized = normalizePath(target);
    if (!normalizedIds.includes(normalized)) {
      broken.push(link);
    }
  }

  return broken;
}

/**
 * Parsear el display de un wikilink
 * "nota" -> { link: "nota", title: undefined }
 * "nota|Título" -> { link: "nota", title: "Título" }
 */
export function parseDisplayTitle(text: string): { link: string; title?: string } {
  const parts = text.split('|');
  return {
    link: parts[0]?.trim() || text,
    title: parts[1]?.trim(),
  };
}

/**
 * Reemplazar wikilink en el contenido
 */
export function replaceWikilink(
  content: string,
  oldTarget: string,
  newTarget: string,
): string {
  const regex = new RegExp(`\\[\\[${escapeRegex(oldTarget)}(?:\\|[^\\]]+)?\\]\\]`, 'g');
  return content.replace(regex, `[[${newTarget}]]`);
}

/**
 * Escapar caracteres especiales para regex
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
