/**
 * IDs de carpeta (Fase 3/9): el path "a/b" se codifica como "a--b"
 * (igual que los IDs de nota).
 */

/** "a/b" -> "a--b" */
export function folderPathToId(folderPath: string): string {
  const clean = folderPath
    .split('\\')
    .join('/')
    .replace(/^\/+|\/+$/g, '');
  if (!clean) return '';
  return clean.split('/').join('--');
}

/**
 * Recalcular el ID de la nota seleccionada tras mover/renombrar una carpeta.
 * Retorna el nuevo ID, o el mismo si la nota no estaba bajo la carpeta movida.
 */
export function remapNoteIdAfterFolderMove(
  selectedNoteId: string | null,
  selectedFolder: string,
  sourcePath: string,
  targetPath: string,
): string | null {
  if (!selectedNoteId) return null;
  const under =
    selectedFolder === sourcePath || selectedFolder.startsWith(`${sourcePath}/`);
  if (!under) return selectedNoteId;
  const sourceId = folderPathToId(sourcePath);
  const targetId = folderPathToId(targetPath);
  if (selectedNoteId === sourceId) return selectedNoteId; // colisión nombre nota/carpeta: no tocar
  if (!selectedNoteId.startsWith(`${sourceId}--`)) return selectedNoteId;
  return targetId + selectedNoteId.slice(sourceId.length);
}

export interface FolderNodeLike {
  path: string;
  children: FolderNodeLike[];
}

/** Aplanar el árbol a paths (para datalist de mover/crear). */
export function flattenFolderPaths(nodes: FolderNodeLike[]): string[] {
  const out: string[] = [];
  const walk = (list: FolderNodeLike[]) => {
    for (const n of list) {
      out.push(n.path);
      if (n.children.length > 0) walk(n.children);
    }
  };
  walk(nodes);
  return out.sort();
}
