import React, { useState, useMemo, useEffect } from 'react';
import { FileText, ChevronRight, ChevronDown, Trash2, Move, MoreVertical, FolderPlus, Folder as FolderIcon } from 'lucide-react';
import { FolderTree, FolderNode } from './FolderTree';
import { PromptDialog } from './PromptDialog';
import { flattenFolderPaths } from '../lib/folder-ids';

interface Note {
  id: string;
  title: string;
  folder: string;
  content: string;
  tags: string[];
  created: string;
  updated: string;
}

interface SidebarProps {
  notes: Note[];
  folders: FolderNode[];
  selectedNoteId: string | null;
  loading?: boolean;
  /** Ancho en px (redimensionable); por defecto 280 */
  width?: number;
  onSelectNote: (id: string) => void;
  onCreateNote: () => void;
  onNewFolder: () => void;
  onMoveNote: (noteId: string, folder: string) => void;
  onDeleteNote: (id: string) => void;
  onDeleteFolder?: (folderId: string) => void;
  onRenameFolder?: (folder: FolderNode) => void;
  onCreateSubfolder?: (parentPath: string) => void;
}

export function Sidebar({
  notes,
  folders,
  selectedNoteId,
  loading,
  width,
  onSelectNote,
  onMoveNote,
  onDeleteNote,
  onDeleteFolder,
  onRenameFolder,
  onCreateSubfolder,
  onNewFolder,
}: SidebarProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [rootOpen, setRootOpen] = useState(true);
  const [noteContextMenu, setNoteContextMenu] = useState<string | null>(null);
  /** Drag & drop (Fase 9, item 58) */
  const [dragNoteId, setDragNoteId] = useState<string | null>(null);
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);
  /** Mover nota (diálogo con datalist; alternativa táctil/teclado al DnD) */
  const [moveTarget, setMoveTarget] = useState<{ noteId: string; folder: string } | null>(null);
  const folderPaths = useMemo(() => flattenFolderPaths(folders), [folders]);

  // Expandir todas las carpetas al cargar por primera vez
  useEffect(() => {
    if (expandedFolders.size === 0 && folders.length > 0) {
      const all = new Set<string>();
      const collect = (nodes: FolderNode[]) => {
        for (const n of nodes) {
          all.add(n.path);
          if (n.children.length > 0) collect(n.children);
        }
      };
      collect(folders);
      setExpandedFolders(all);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folders]);

  const groupedNotes = useMemo(() => {
    return notes.reduce<Record<string, Note[]>>((acc, note) => {
      const folder = note.folder || '';
      if (!acc[folder]) acc[folder] = [];
      acc[folder].push(note);
      return acc;
    }, {});
  }, [notes]);

  const toggleFolder = (folderPath: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderPath)) next.delete(folderPath);
      else next.add(folderPath);
      return next;
    });
  };

  const handleContextMenu = (e: React.MouseEvent, noteId: string) => {
    e.preventDefault();
    setNoteContextMenu(noteId === noteContextMenu ? null : noteId);
  };

  const handleMove = (note: Note) => {
    setMoveTarget({ noteId: note.id, folder: note.folder });
    setNoteContextMenu(null);
  };

  const handleDelete = (noteId: string) => {
    onDeleteNote(noteId);
    setNoteContextMenu(null);
  };

  const clearDrag = () => {
    setDragNoteId(null);
    setDragOverPath(null);
  };

  const dropOnFolder = (folderPath: string) => {
    if (dragNoteId) onMoveNote(dragNoteId, folderPath);
    clearDrag();
  };

  const renderNoteRow = (note: Note) => (
    <div key={note.id} className="relative">
      <div className="group flex items-center gap-0.5">
        <button
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData('text/plain', note.id);
            e.dataTransfer.effectAllowed = 'move';
            setDragNoteId(note.id);
          }}
          onDragEnd={clearDrag}
          onClick={() => onSelectNote(note.id)}
          onContextMenu={(e) => handleContextMenu(e, note.id)}
          title={`${note.title} — arrastra para mover, click derecho para más opciones`}
          className={`flex items-center gap-2 flex-1 min-w-0 px-2 py-1.5 text-sm rounded-md transition-colors cursor-grab active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/70 ${
            selectedNoteId === note.id
              ? 'bg-amber-100 text-amber-900 font-medium dark:bg-amber-500/20 dark:text-amber-300 ring-1 ring-inset ring-amber-500/40'
              : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
          } ${dragNoteId === note.id ? 'opacity-50' : ''}`}
        >
          {selectedNoteId === note.id ? (
            <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
          ) : (
            <FileText size={14} className="shrink-0" aria-hidden="true" />
          )}
          <span className="truncate">{note.title}</span>
        </button>
        <button
          onClick={() => setNoteContextMenu(noteContextMenu === note.id ? null : note.id)}
          aria-label={`Opciones de ${note.title}`}
          title="Opciones"
          className="p-1.5 shrink-0 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-500 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100"
        >
          <MoreVertical size={14} aria-hidden="true" />
        </button>
      </div>
      {noteContextMenu === note.id && (
        <div className="absolute right-0 top-8 z-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-lg py-1 min-w-[140px]">
          <button
            onClick={() => handleMove(note)}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <Move size={14} aria-hidden="true" /> Mover
          </button>
          <button
            onClick={() => handleDelete(note.id)}
            className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-red-600 hover:bg-slate-100 dark:text-red-400 dark:hover:bg-slate-700"
          >
            <Trash2 size={14} aria-hidden="true" /> Eliminar
          </button>
        </div>
      )}
    </div>
  );

  const renderNotesFor = (folderPath: string) => {
    const list = groupedNotes[folderPath] ?? [];
    if (list.length === 0) return null;
    return (
      <div className="ml-7 mt-0.5 space-y-0.5">{list.map(renderNoteRow)}</div>
    );
  };

  const rootNotes = groupedNotes[''] ?? [];
  const folderCount = folders.length > 0 ? countFolders(folders) : 0;

  return (
    <aside
      aria-label="Notas y carpetas"
      style={width ? { width } : undefined}
      className="w-[280px] shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden max-lg:fixed max-lg:inset-y-0 max-lg:left-0 max-lg:z-30 max-lg:shadow-2xl"
    >
      <div className="p-3 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
        <FolderIcon size={15} aria-hidden="true" className="text-amber-600 dark:text-amber-400 shrink-0" />
        <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider flex-1">
          Notas y Carpetas
        </h2>
        <button
          onClick={onNewFolder}
          aria-label="Nueva carpeta"
          title="Nueva carpeta"
          className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-500 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors"
        >
          <FolderPlus size={15} aria-hidden="true" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2" onClick={() => setNoteContextMenu(null)}>
        {/* Notas en raíz (acepta drop para mover a raíz) */}
        <div
          className={`mb-2 rounded ${dragOverPath === '' ? 'bg-amber-500/15 outline outline-1 outline-amber-500/60' : ''}`}
          onDragOver={(e) => {
            if (!dragNoteId) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            setDragOverPath('');
          }}
          onDragLeave={(e) => {
            const to = e.relatedTarget as Node | null;
            if (to && e.currentTarget.contains(to)) return;
            setDragOverPath((prev) => (prev === '' ? null : prev));
          }}
          onDrop={(e) => {
            e.preventDefault();
            dropOnFolder('');
          }}
        >
          <button
            onClick={() => setRootOpen(!rootOpen)}
            className="flex items-center gap-1.5 w-full px-2 py-1 text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
          >
            {rootOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <FolderIcon size={14} className="text-slate-500" />
            <span className="truncate">Sin carpeta</span>
            <span className="text-slate-500 dark:text-slate-600">({rootNotes.length})</span>
          </button>
          {rootOpen && rootNotes.length > 0 && (
            <div className="ml-4 mt-1 space-y-0.5">{rootNotes.map(renderNoteRow)}</div>
          )}
        </div>

        {/* Árbol de carpetas (Fase 3 + drop en Fase 9) */}
        <FolderTree
          folders={folders}
          expanded={expandedFolders}
          onToggle={toggleFolder}
          renderNotes={renderNotesFor}
          onDeleteFolder={onDeleteFolder ? (f) => onDeleteFolder(f.id) : undefined}
          onRenameFolder={onRenameFolder}
          onCreateSubfolder={onCreateSubfolder}
          onDropFolder={dragNoteId ? dropOnFolder : undefined}
          dragOverPath={dragOverPath}
          onDragOverFolder={setDragOverPath}
        />

        {loading && notes.length === 0 && folders.length === 0 && (
          <div className="px-2 py-2 space-y-2" aria-label="Cargando notas">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-7 rounded-md bg-slate-200 dark:bg-slate-800 animate-pulse" />
            ))}
          </div>
        )}
        {!loading && notes.length === 0 && folders.length === 0 && (
          <div className="text-center py-8 text-slate-500 text-sm">
            <p>No hay notas aún</p>
            <p className="text-xs mt-1">Crea una para comenzar</p>
          </div>
        )}
      </div>
      <div className="p-2 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-500 text-center">
        {notes.length} nota{notes.length !== 1 ? 's' : ''} • {folderCount} carpeta
        {folderCount !== 1 ? 's' : ''}
      </div>
      <PromptDialog
        open={moveTarget !== null}
        title={`Mover «${notes.find((n) => n.id === moveTarget?.noteId)?.title ?? ''}»`}
        label="Carpeta destino (vacío = raíz)"
        initialValue={moveTarget?.folder ?? ''}
        placeholder="ej: proyecto/docs"
        suggestions={folderPaths}
        confirmLabel="Mover"
        onConfirm={(folder) => {
          if (moveTarget) onMoveNote(moveTarget.noteId, folder);
          setMoveTarget(null);
        }}
        onCancel={() => setMoveTarget(null)}
      />
    </aside>
  );
}

function countFolders(nodes: FolderNode[]): number {
  let n = 0;
  for (const f of nodes) {
    n += 1 + countFolders(f.children);
  }
  return n;
}

export default Sidebar;
