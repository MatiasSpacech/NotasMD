import React from 'react';
import { Folder, FolderOpen, ChevronRight, ChevronDown, Trash2, Pencil, FolderPlus } from 'lucide-react';

export interface FolderNode {
  id: string;
  name: string;
  path: string;
  parent: string | null;
  children: FolderNode[];
  noteCount: number;
}

interface FolderTreeProps {
  folders: FolderNode[];
  expanded: Set<string>;
  onToggle: (path: string) => void;
  /** Render de las notas/contenido dentro de una carpeta */
  renderNotes?: (folderPath: string) => React.ReactNode;
  onDeleteFolder?: (folder: FolderNode) => void;
  /** Renombrar/mover carpeta (prompt con la ruta actual) */
  onRenameFolder?: (folder: FolderNode) => void;
  /** Crear subcarpeta dentro de esta */
  onCreateSubfolder?: (parentPath: string) => void;
  /** Drag & drop (Fase 9): soltar notas para moverlas */
  onDropFolder?: (folderPath: string) => void;
  dragOverPath?: string | null;
  onDragOverFolder?: (folderPath: string | null) => void;
  depth?: number;
}

/**
 * Árbol de carpetas con colapsar/expandir (Fase 3).
 * Solo renderiza carpetas; las notas se inyectan vía `renderNotes`.
 */
export function FolderTree({ folders, expanded, onToggle, renderNotes, onDeleteFolder, onRenameFolder, onCreateSubfolder, onDropFolder, dragOverPath, onDragOverFolder, depth = 0 }: FolderTreeProps) {
  if (folders.length === 0) return null;

  return (
    <div className={depth > 0 ? 'ml-3 border-l border-slate-200 dark:border-slate-800 pl-1' : ''}>
      {folders.map((folder) => {
        const isOpen = expanded.has(folder.path);
        const isDropTarget = onDropFolder != null && dragOverPath === folder.path;
        return (
          <div
            key={folder.id}
            className={`mb-0.5 rounded ${isDropTarget ? 'bg-amber-500/15 outline outline-1 outline-amber-500/60' : ''}`}
            onDragOver={
              onDropFolder
                ? (e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    onDragOverFolder?.(folder.path);
                  }
                : undefined
            }
            onDragLeave={
              onDropFolder
                ? (e) => {
                    const to = e.relatedTarget as Node | null;
                    if (to && e.currentTarget.contains(to)) return;
                    onDragOverFolder?.(null);
                  }
                : undefined
            }
            onDrop={
              onDropFolder
                ? (e) => {
                    e.preventDefault();
                    onDragOverFolder?.(null);
                    onDropFolder(folder.path);
                  }
                : undefined
            }
          >
            <div className="group flex items-center gap-1 w-full">
              <button
                onClick={() => onToggle(folder.path)}
                aria-label={`${isOpen ? 'Colapsar' : 'Expandir'} carpeta ${folder.path}`}
                className="flex items-center gap-1.5 flex-1 min-w-0 px-2 py-1 text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 transition-colors rounded hover:bg-slate-100 dark:hover:bg-slate-800/50"
                title={folder.path}
              >
                {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                {isOpen ? (
                  <FolderOpen size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
                ) : (
                  <Folder size={14} className="text-slate-500 shrink-0" />
                )}
                <span className="truncate">{folder.name}</span>
                <span className="text-slate-500 dark:text-slate-600">({folder.noteCount})</span>
              </button>
              {(onRenameFolder || onDeleteFolder || onCreateSubfolder) && (
                <span className="flex items-center shrink-0">
                  {onCreateSubfolder && (
                    <button
                      onClick={() => onCreateSubfolder(folder.path)}
                      aria-label={`Crear subcarpeta en ${folder.path}`}
                      className="p-1.5 text-slate-400 hover:text-amber-600 dark:text-slate-500 dark:hover:text-amber-400 transition-colors"
                      title={`Crear subcarpeta en ${folder.path}`}
                    >
                      <FolderPlus size={12} aria-hidden="true" />
                    </button>
                  )}                  {onRenameFolder && (
                    <button
                      onClick={() => onRenameFolder(folder)}
                      aria-label={`Renombrar o mover ${folder.path}`}
                      className="p-1.5 text-slate-400 hover:text-amber-600 dark:text-slate-500 dark:hover:text-amber-400 transition-colors"
                      title={`Renombrar o mover ${folder.path}`}
                    >
                      <Pencil size={12} aria-hidden="true" />
                    </button>
                  )}
                  {onDeleteFolder && (
                    <button
                      onClick={() => onDeleteFolder(folder)}
                      aria-label={`Eliminar ${folder.path}`}
                      className="p-1.5 text-slate-400 hover:text-red-600 dark:text-slate-500 dark:hover:text-red-400 transition-colors"
                      title={`Eliminar ${folder.path}`}
                    >
                      <Trash2 size={12} aria-hidden="true" />
                    </button>
                  )}
                </span>
              )}
            </div>
            {isOpen && (
              <div className="mt-0.5">
                {renderNotes?.(folder.path)}
                {folder.children.length > 0 && (
                  <FolderTree
                    folders={folder.children}
                    expanded={expanded}
                    onToggle={onToggle}
                    renderNotes={renderNotes}
                    onDeleteFolder={onDeleteFolder}
                    onRenameFolder={onRenameFolder}
                    onCreateSubfolder={onCreateSubfolder}
                    onDropFolder={onDropFolder}
                    dragOverPath={dragOverPath}
                    onDragOverFolder={onDragOverFolder}
                    depth={depth + 1}
                  />
                )}
                {folder.noteCount === 0 && folder.children.length === 0 && (
                  <p className="ml-7 text-[11px] text-slate-400 dark:text-slate-600 italic">vacía</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default FolderTree;
