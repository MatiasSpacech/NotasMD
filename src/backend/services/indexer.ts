/**
 * Indexación para búsqueda全文 de notas
 */

/**
 * Estructura de un documento indexado
 */
export interface SearchIndex {
  id: string;
  title: string;
  content: string;
  tags: string[];
  folder: string;
  wordCount: number;
}

/**
 * Indexar una nota para búsqueda
 */
export function indexNote(
  id: string,
  title: string,
  content: string,
  tags: string[],
  folder: string,
): SearchIndex {
  const wordCount = content.split(/\s+/).filter((w) => w.length > 0).length;

  return {
    id,
    title,
    content,
    tags,
    folder,
    wordCount,
  };
}

/**
 * Buscar en el contenido de todas las notas indexadas
 */
export function searchInContent(index: SearchIndex[], query: string): SearchIndex[] {
  const normalizedQuery = query.toLowerCase();
  return index.filter((doc) => doc.content.toLowerCase().includes(normalizedQuery));
}

/**
 * Buscar por título
 */
export function searchInTitle(index: SearchIndex[], query: string): SearchIndex[] {
  const normalizedQuery = query.toLowerCase();
  return index.filter((doc) => doc.title.toLowerCase().includes(normalizedQuery));
}

/**
 * Buscar por tag
 */
export function searchByTag(index: SearchIndex[], tag: string): SearchIndex[] {
  const normalizedTag = tag.toLowerCase();
  return index.filter((doc) => doc.tags.some((t) => t.toLowerCase() === normalizedTag));
}

/**
 * Búsqueda全文 combinada (título + contenido + tags)
 */
export function searchAll(index: SearchIndex[], query: string): SearchIndex[] {
  const normalizedQuery = query.toLowerCase();

  return index
    .map((doc) => {
      let score = 0;

      // Mayor puntaje para coincidencia en título
      if (doc.title.toLowerCase().includes(normalizedQuery)) {
        score += 10;
      }

      // Puntaje por coincidencia en contenido
      const contentMatches = doc.content.toLowerCase().split(normalizedQuery).length - 1;
      score += contentMatches * 2;

      // Puntaje por coincidencia en tags
      if (doc.tags.some((t) => t.toLowerCase().includes(normalizedQuery))) {
        score += 5;
      }

      return { doc, score };
    })
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((result) => result.doc);
}

/**
 * Resaltar texto coincidente
 */
export function highlightText(text: string, query: string): string {
  if (!query.trim()) return text;

  const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}

/**
 * Escapar caracteres para regex
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
