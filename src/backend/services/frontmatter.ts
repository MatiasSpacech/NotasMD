import YAML from 'yaml';

/**
 * Interfaz para el frontmatter de una nota
 */
export interface NoteFrontmatter {
  title: string;
  folder: string;
  created: string;
  updated: string;
  tags: string[];
}

/**
 * Separar frontmatter del cuerpo del contenido
 * Formato: ---\nYAML\n---\ncontenido
 */
export function parseFrontmatter(content: string): { frontmatter: NoteFrontmatter; body: string } {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    // Si no tiene frontmatter, retornar valores por defecto
    return {
      frontmatter: createDefaultFrontmatter('Sin título', ''),
      body: content.trim(),
    };
  }

  try {
    const parsed = YAML.parse(match[1]) || {};
    const frontmatter: NoteFrontmatter = {
      title: parsed.title || 'Sin título',
      folder: parsed.folder || '',
      created: parsed.created || new Date().toISOString(),
      updated: parsed.updated || new Date().toISOString(),
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
    };
    const body = match[2] || '';

    return { frontmatter, body };
  } catch (error) {
    console.error('Error parsing frontmatter:', error);
    return {
      frontmatter: createDefaultFrontmatter('Sin título', ''),
      body: content.trim(),
    };
  }
}

/**
 * Construir string de frontmatter YAML
 */
export function buildFrontmatter(frontmatter: NoteFrontmatter): string {
  const yamlStr = YAML.stringify({
    title: frontmatter.title,
    folder: frontmatter.folder,
    created: frontmatter.created,
    updated: frontmatter.updated,
    tags: frontmatter.tags,
  });
  return `---\n${yamlStr}---`;
}

/**
 * Crear frontmatter por defecto
 */
export function createDefaultFrontmatter(title: string, folder: string): NoteFrontmatter {
  const now = new Date().toISOString();
  return {
    title,
    folder,
    created: now,
    updated: now,
    tags: [],
  };
}

/**
 * Actualizar timestamps del frontmatter
 */
export function updateTimestamps(frontmatter: Partial<NoteFrontmatter>): NoteFrontmatter {
  const now = new Date().toISOString();
  return {
    title: frontmatter.title || 'Sin título',
    folder: frontmatter.folder || '',
    created: frontmatter.created || now,
    updated: now,
    tags: frontmatter.tags || [],
  };
}

/**
 * Reconstruir contenido completo con frontmatter actualizado
 */
export function rebuildContent(frontmatter: NoteFrontmatter, body: string): string {
  const fm = buildFrontmatter(frontmatter);
  return `${fm}\n${body.trim()}\n`;
}
