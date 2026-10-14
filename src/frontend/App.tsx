import React, { useState, useEffect, useRef, Suspense, lazy, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { NoteEditor } from './components/NoteEditor';
import { NotePreview } from './components/NotePreview';
import { BacklinksPanel } from './components/BacklinksPanel';
import { SearchBar } from './components/SearchBar';
import { Toast } from './components/Toast';
import { ConfirmDialog } from './components/ConfirmDialog';
import { PromptDialog } from './components/PromptDialog';
import type { NoteTemplate } from './lib/templates';
import { remapNoteIdAfterFolderMove, flattenFolderPaths } from './lib/folder-ids';
import { getGlobalAction, isEditableTarget } from './lib/shortcuts';
import { useBacklinks } from './hooks/useBacklinks';
import { useToast } from './hooks/useToast';
import { Moon, Sun, Plus, FolderPlus, Folder, FileText, Link as LinkIcon, History, BookOpen, Download, Upload, Pencil, StickyNote, Settings } from 'lucide-react';
import { ResizeHandle } from './components/ResizeHandle';
import { SettingsDialog } from './components/SettingsDialog';

// Drawers/modales pesados fuera del bundle inicial (Fase 9 optimize)
const VersionHistory = lazy(() => import('./components/VersionHistory'));
const MarkdownHelp = lazy(() => import('./components/MarkdownHelp'));
const TemplatePicker = lazy(() => import('./components/TemplatePicker'));

interface Note {
  id: string;
  title: string;
  folder: string;
  content: string;
  tags: string[];
  created: string;
  updated: string;
}

interface FolderNode {
  id: string;
  name: string;
  path: string;
  parent: string | null;
  children: FolderNode[];
  noteCount: number;
}

type ConfirmState =
  | { kind: 'note'; id: string; title: string }
  | { kind: 'folder'; id: string; path: string }
  | { kind: 'folderForce'; id: string; path: string; count: number };

/** Buscar el path de una carpeta en el árbol por su id */
function findFolderPath(nodes: FolderNode[], id: string): string | null {
  for (const n of nodes) {
    if (n.id === id) return n.path;
    const child = findFolderPath(n.children, id);
    if (child) return child;
  }
  return null;
}

/** Ancho de columna redimensionable con persistencia (resizable columns). */
function usePanelWidth(storageKey: string, def: number, min: number, max: number) {
  const [width, setWidth] = useState(() => {
    try {
      const v = Number(window.localStorage.getItem(storageKey));
      if (Number.isFinite(v)) return Math.min(max, Math.max(min, v));
    } catch {
      // almacenamiento no disponible
    }
    return def;
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, String(width));
    } catch {
      // almacenamiento no disponible
    }
  }, [storageKey, width]);
  const grow = useCallback(
    (dx: number) => setWidth((w) => Math.min(max, Math.max(min, w + dx))),
    [min, max],
  );
  const reset = useCallback(() => setWidth(def), [def]);
  return { width, grow, reset, min, max };
}

export default function App() {
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === 'undefined') return true;
    try {
      const stored = window.localStorage.getItem('notas-theme');
      if (stored) return stored === 'dark';
      if (window.matchMedia?.('(prefers-color-scheme: light)').matches) return false;
    } catch {
      // almacenamiento no disponible
    }
    return true;
  });
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [folders, setFolders] = useState<FolderNode[]>([]);
  // Responsive (item 62): sidebar overlay en <lg, preview oculta en <md al arrancar
  const [sidebarOpen, setSidebarOpen] = useState(
    () => typeof window === 'undefined' || window.innerWidth >= 1024,
  );
  const [previewOpen, setPreviewOpen] = useState(() => {
    if (typeof window === 'undefined') return true;
    try {
      const stored = window.localStorage.getItem('notas-preview-default');
      if (stored === '1') return true;
      if (stored === '0') return false;
    } catch {
      // almacenamiento no disponible
    }
    return window.innerWidth >= 768;
  });
  const [backlinksOpen, setBacklinksOpen] = useState(() => {
    if (typeof window === 'undefined') return true;
    try {
      const stored = window.localStorage.getItem('notas-backlinks-default');
      if (stored === '1') return true;
      if (stored === '0') return false;
    } catch {
      // almacenamiento no disponible
    }
    return true;
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const sidebarPanel = usePanelWidth('notas-sidebar-width', 280, 200, 480);
  const previewPanel = usePanelWidth('notas-preview-width', 320, 240, 640);
  const [rightPanel, setRightPanel] = useState<'history' | 'help' | null>(null);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [editorResetKey, setEditorResetKey] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [folderDialog, setFolderDialog] = useState<null | { mode: 'create'; parent?: string } | { mode: 'rename'; folder: FolderNode }>(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [creatingNote, setCreatingNote] = useState(false);
  const [loadingNotes, setLoadingNotes] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toasts, push: pushToast, dismiss: dismissToast } = useToast();
  /** Errores ya notificados (evita spam de toasts en reintentos de fondo) */
  const errorKeysRef = useRef<Set<string>>(new Set());

  const reportErrorOnce = (key: string, message: string) => {
    if (errorKeysRef.current.has(key)) return;
    errorKeysRef.current.add(key);
    pushToast(message, 'error');
  };

  const selectedNote = notes.find((n) => n.id === selectedNoteId) || null;
  const { backlinks, loading: backlinksLoading, refresh: refreshBacklinks } =
    useBacklinks(selectedNoteId);

  useEffect(() => { fetchNotes(); fetchFolders(); }, []);

  const fetchFolders = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/folders');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setFolders(Array.isArray(data) ? data : (data.folders ?? []));
      errorKeysRef.current.delete('folders');
    } catch (error) {
      console.error('Error fetching folders:', error);
      reportErrorOnce('folders', 'No se pudo conectar con el backend (carpetas)');
    }
  };

  const fetchNotes = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/notes');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setNotes(Array.isArray(data) ? data : (data.notes ?? []));
      errorKeysRef.current.delete('notes');
    } catch (error) {
      console.error('Error fetching notes:', error);
      reportErrorOnce('notes', 'No se pudo conectar con el backend (notas)');
    } finally {
      setLoadingNotes(false);
    }
  };

  const handleCreateNote = async () => {
    // Fase 7: elegir plantilla antes de crear
    setTemplateOpen(true);
  };

  const handlePickTemplate = async (template: NoteTemplate, title: string) => {
    setCreatingNote(true);
    try {
      const response = await fetch('http://localhost:3001/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          folder: '',
          content: template.content(title),
          tags: template.tags,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        pushToast(data.error ?? 'No se pudo crear la nota', 'error');
        return;
      }
      const data = await response.json();
      const note = data.note ?? data;
      setNotes((prev) => [note, ...prev]);
      setSelectedNoteId(note.id);
      setTemplateOpen(false);
      pushToast(`Nota «${note.title}» creada`, 'success');
    } catch (error) {
      console.error('Error creating note:', error);
      pushToast('No se pudo crear la nota', 'error');
    } finally {
      setCreatingNote(false);
    }
  };

  const handleCreateFolder = (parent?: string) => {
    setFolderDialog({ mode: 'create', parent });
  };

  const confirmCreateFolder = async (name: string) => {
    try {
      const res = await fetch('http://localhost:3001/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: name }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        pushToast(data.error ?? 'No se pudo crear la carpeta', 'error');
        return;
      }
      setFolderDialog(null);
      await fetchFolders();
      pushToast(`Carpeta «${name}» creada`, 'success');
    } catch (error) {
      console.error('Error creating folder:', error);
      pushToast('No se pudo crear la carpeta', 'error');
    }
  };

  const handleUpdateNote = async (id: string, content: string) => {
    setIsSaving(true);
    try {
      const res = await fetch(`http://localhost:3001/api/notes/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        pushToast(data.error ?? 'No se pudo guardar la nota', 'error');
        return;
      }
      // Optimista: parchear la nota en estado (sin refetch completo)
      if (data.note) {
        setNotes((prev) => prev.map((n) => (n.id === id ? data.note : n)));
        errorKeysRef.current.delete('save');
      } else {
        await fetchNotes();
      }
    } catch (error) {
      console.error('Error updating note:', error);
      reportErrorOnce('save', 'No se pudo guardar la nota');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteNote = (id: string) => {
    const n = notes.find((x) => x.id === id);
    setConfirm({ kind: 'note', id, title: n?.title ?? 'esta nota' });
  };

  const confirmDeleteNote = async () => {
    if (!confirm || confirm.kind !== 'note') return;
    setConfirmBusy(true);
    try {
      const res = await fetch(`http://localhost:3001/api/notes/${encodeURIComponent(confirm.id)}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        pushToast(data.error ?? 'No se pudo eliminar la nota', 'error');
        return;
      }
      setNotes((prev) => prev.filter((n) => n.id !== confirm.id));
      if (selectedNoteId === confirm.id) setSelectedNoteId(null);
      else if (selectedNoteId) await refreshBacklinks(selectedNoteId);
      setConfirm(null);
      pushToast('Nota eliminada', 'success');
    } catch (error) {
      console.error('Error deleting note:', error);
      pushToast('No se pudo eliminar la nota', 'error');
    } finally {
      setConfirmBusy(false);
    }
  };

  const handleMoveNote = async (noteId: string, targetFolder: string) => {
    try {
      const res = await fetch('http://localhost:3001/api/folders/move', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteId, folder: targetFolder }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        pushToast(data.error ?? 'No se pudo mover la nota', 'error');
        return;
      }
      const data = await res.json().catch(() => null);
      // Si el ID cambió (la nota se movió de carpeta), actualizar selección
      if (data?.note?.id && data.note.id !== noteId) setSelectedNoteId(data.note.id);
      await fetchNotes();
      await fetchFolders();
    } catch (error) {
      console.error('Error moving note:', error);
    }
  };

  const handleDeleteFolder = (folderId: string) => {
    const path = findFolderPath(folders, folderId) ?? folderId;
    setConfirm({ kind: 'folder', id: folderId, path });
  };

  const handleRenameFolder = (folder: FolderNode) => {
    setFolderDialog({ mode: 'rename', folder });
  };

  const confirmRenameFolder = async (target: string) => {
    if (!folderDialog || folderDialog.mode !== 'rename') return;
    const { folder } = folderDialog;
    const trimmed = target.trim().replace(/^\/+|\/+$/g, '');
    if (!trimmed || trimmed === folder.path) {
      setFolderDialog(null);
      return;
    }
    try {
      const res = await fetch('http://localhost:3001/api/folders/move', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: folder.path, target: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        pushToast(data.error ?? 'No se pudo renombrar la carpeta', 'error');
        return;
      }
      await fetchNotes();
      await fetchFolders();
      // La nota seleccionada pudo cambiar de ID con la carpeta
      if (selectedNote) {
        const newId = remapNoteIdAfterFolderMove(
          selectedNoteId,
          selectedNote.folder,
          folder.path,
          data.folder?.path ?? trimmed,
        );
        if (newId && newId !== selectedNoteId) setSelectedNoteId(newId);
      }
      pushToast(`Carpeta renombrada a «${data.folder?.path ?? trimmed}»`, 'success');
      setFolderDialog(null);
    } catch (error) {
      console.error('Error renaming folder:', error);
      pushToast('No se pudo renombrar la carpeta', 'error');
    }
  };

  const confirmDeleteFolder = async (force: boolean) => {
    if (!confirm || (confirm.kind !== 'folder' && confirm.kind !== 'folderForce')) return;
    setConfirmBusy(true);
    try {
      const res = await fetch(
        `http://localhost:3001/api/folders/${encodeURIComponent(confirm.id)}${force ? '?force=true' : ''}`,
        { method: 'DELETE' },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (!force && res.status === 409 && data.noteCount > 0) {
          setConfirm({ kind: 'folderForce', id: confirm.id, path: confirm.path, count: data.noteCount });
          return;
        }
        pushToast(data.error ?? 'No se pudo eliminar la carpeta', 'error');
        return;
      }
      setConfirm(null);
      await fetchFolders();
      await fetchNotes();
      pushToast('Carpeta eliminada', 'success');
    } catch (error) {
      console.error('Error deleting folder:', error);
      pushToast('No se pudo eliminar la carpeta', 'error');
    } finally {
      setConfirmBusy(false);
    }
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    try {
      window.localStorage.setItem('notas-theme', darkMode ? 'dark' : 'light');
    } catch {
      // almacenamiento no disponible
    }
  }, [darkMode]);

  // Atajos globales (Fase 9, item 61). Editor y buscador ya hicieron preventDefault.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const action = getGlobalAction(e);
      if (!action) return;
      if (action === 'openSettings') {
        e.preventDefault();
        setSettingsOpen(true);
        return;
      }
      if (action === 'toggleHistory') {
        e.preventDefault();
        togglePanel('history');
        return;
      }
      if (action === 'toggleHelp') {
        e.preventDefault();
        togglePanel('help');
        return;
      }
      if (action === 'toggleBacklinks') {
        e.preventDefault();
        setBacklinksOpen((v) => !v);
        return;
      }
      // Nueva/eliminar: no robar teclas mientras se escribe
      if (isEditableTarget(e)) return;
      if (action === 'newNote') {
        e.preventDefault();
        setTemplateOpen(true);
        return;
      }
      if (action === 'deleteNote' && selectedNoteId) {
        e.preventDefault();
        handleDeleteNote(selectedNoteId);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch('http://localhost:3001/api/export/zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        pushToast(data.error ?? 'No se pudo exportar', 'error');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'notas.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      pushToast('Notas exportadas (.zip)', 'success');
    } catch (error) {
      console.error('Error exporting:', error);
      pushToast('No se pudo exportar', 'error');
    } finally {
      setExporting(false);
    }
  };

  const readFileAs = (file: File, mode: 'dataUrl' | 'text'): Promise<string> =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error(`No se pudo leer ${file.name}`));
      if (mode === 'text') reader.readAsText(file);
      else reader.readAsDataURL(file);
    });

  /** Importar un ZIP (base64). Retorna {imported, skipped} o null si falló. */
  const importZipFile = async (file: File): Promise<{ imported: number; skipped: number } | null> => {
    const dataUrl = await readFileAs(file, 'dataUrl');
    const base64 = dataUrl.split(',')[1] ?? '';
    const res = await fetch('http://localhost:3001/api/import/zip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: base64 }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      pushToast(data.error ?? `No se pudo importar ${file.name}`, 'error');
      return null;
    }
    return { imported: data.imported ?? 0, skipped: data.skipped ?? 0 };
  };

  /** Importar un .md/.txt/.pdf suelto (los .txt/.pdf se convierten a .md). */
  const importDocFile = async (file: File): Promise<boolean> => {
    const isPdf = /\.pdf$/i.test(file.name);
    const payload = isPdf
      ? { filename: file.name, data: (await readFileAs(file, 'dataUrl')).split(',')[1] ?? '' }
      : { filename: file.name, content: await readFileAs(file, 'text') };
    const res = await fetch('http://localhost:3001/api/import/file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      pushToast(data.error ?? `No se pudo importar ${file.name}`, 'error');
      return false;
    }
    return true;
  };

  const handleImportFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setImporting(true);
    try {
      const zips = files.filter((f) => /\.zip$/i.test(f.name));
      const docs = files.filter((f) => /\.(md|txt|pdf)$/i.test(f.name));
      const others = files.filter((f) => !/\.zip$/i.test(f.name) && !/\.(md|txt|pdf)$/i.test(f.name));
      if (others.length > 0) {
        pushToast(`Omitidos (solo .zip/.md/.txt/.pdf): ${others.map((f) => f.name).join(', ')}`, 'info');
      }
      let imported = 0;
      let skipped = 0;
      let docsOk = 0;
      for (const z of zips) {
        const r = await importZipFile(z);
        if (r) {
          imported += r.imported;
          skipped += r.skipped;
        }
      }
      for (const d of docs) {
        if (await importDocFile(d)) docsOk++;
      }
      if (zips.length > 0 || docs.length > 0) {
        await fetchNotes();
        await fetchFolders();
        const parts: string[] = [];
        if (zips.length > 0) parts.push(`ZIP: ${imported} importadas, ${skipped} omitidas`);
        if (docs.length > 0) parts.push(`${docsOk}/${docs.length} ficheros importados`);
        pushToast(parts.join(' · ') || 'Nada que importar', 'success');
      }
    } catch (error: any) {
      console.error('Error importing:', error);
      pushToast(error?.message ?? 'No se pudo importar', 'error');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleWikilinkClick = (target: string) => {
    const norm = target.toLowerCase().replace(/\.md$/, '').trim();
    const found = notes.find(
      (n) =>
        n.title.toLowerCase() === norm ||
        n.title.toLowerCase().replace(/\.md$/, '') === norm ||
        n.id.toLowerCase() === norm,
    );
    if (found) setSelectedNoteId(found.id);
  };

  const knownTargets = notes.flatMap((n) => [n.title, n.id]);

  const togglePanel = (panel: 'history' | 'help') => {
    setRightPanel((prev) => (prev === panel ? null : panel));
  };
  const closePanel = () => setRightPanel(null);

  const handleHistoryChanged = async () => {
    await fetchNotes();
    setEditorResetKey((k) => k + 1);
    if (selectedNoteId) await refreshBacklinks(selectedNoteId);
  };

  const handleSelectNote = (id: string) => {
    setSelectedNoteId(id);
    setEditingTitle(false);
    // En pantallas con sidebar overlay, cerrarla al elegir nota
    if (typeof window !== 'undefined' && window.innerWidth < 1024) setSidebarOpen(false);
  };

  const startEditingTitle = () => {
    if (!selectedNote) return;
    setTitleDraft(selectedNote.title);
    setEditingTitle(true);
  };

  const saveTitle = async () => {
    if (!selectedNote) {
      setEditingTitle(false);
      return;
    }
    const next = titleDraft.trim();
    if (!next || next === selectedNote.title) {
      setEditingTitle(false);
      return;
    }
    const oldId = selectedNote.id;
    try {
      const res = await fetch(`http://localhost:3001/api/notes/${encodeURIComponent(oldId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        pushToast(data.error ?? 'No se pudo renombrar', 'error');
        return; // mantener edición para corregir
      }
      const note = data.note;
      setNotes((prev) => {
        const without = prev.filter((n) => n.id !== oldId && n.id !== note.id);
        return [note, ...without];
      });
      setSelectedNoteId(note.id);
      setEditingTitle(false);
      pushToast(`Nota renombrada a «${note.title}»`, 'success');
    } catch (error) {
      console.error('Error renaming note:', error);
      pushToast('No se pudo renombrar', 'error');
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      {/* Top Bar */}
      <header className="h-14 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center px-4 gap-3 shrink-0">
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors" title="Toggle sidebar" aria-label="Mostrar/ocultar sidebar">
          <FileText size={18} />
        </button>
        <div className="flex items-center gap-2">
          <h1 className="sr-only">Notas App</h1>
          <span aria-hidden="true" className="grid place-items-center w-7 h-7 rounded-lg bg-amber-500 text-slate-900"><StickyNote size={16} /></span>
          <span className="font-semibold text-slate-800 dark:text-slate-200 hidden sm:inline">Notas App</span>
        </div>
        <div className="flex-1" />
        <SearchBar notes={notes} onOpenNote={(id) => setSelectedNoteId(id)} />
        <div className="flex-1" />
        <button onClick={handleCreateNote} className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-900 font-medium rounded-md text-sm transition-colors" title="Nueva nota (Ctrl+N)">
          <Plus size={16} /><span className="hidden sm:inline">Nueva Nota</span>
        </button>
        <button onClick={() => handleCreateFolder()} className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium rounded-md text-sm transition-colors" title="Nueva carpeta" aria-label="Nueva carpeta">
          <FolderPlus size={16} /><span className="hidden sm:inline">Nueva carpeta</span>
        </button>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors disabled:opacity-50"
          title={exporting ? 'Exportando…' : 'Exportar notas (.zip)'}
          aria-label="Exportar notas"
        >
          <Download size={18} />
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
          className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors disabled:opacity-50"
          title={importing ? 'Importando…' : 'Importar notas (.zip, .md, .txt, .pdf)'}
          aria-label="Importar notas"
        >
          <Upload size={18} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".zip,.md,.txt,.pdf,application/zip"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = e.target.files ? Array.from(e.target.files) : [];
            if (files.length > 0) handleImportFiles(files);
          }}
        />
        <button onClick={() => setPreviewOpen(!previewOpen)} className={`p-1.5 rounded transition-colors ${previewOpen ? 'bg-slate-200 text-amber-700 dark:bg-slate-700 dark:text-amber-400' : 'hover:bg-slate-200 dark:hover:bg-slate-700'}`} title="Toggle preview" aria-label="Mostrar/ocultar vista previa">
          <LinkIcon size={18} />
        </button>
        <button onClick={() => setDarkMode(!darkMode)} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors" title={darkMode ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'} aria-label={darkMode ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}>
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <button
          onClick={() => setSettingsOpen(true)}
          className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
          title="Configuración (Ctrl+,)"
          aria-label="Abrir configuración"
          data-testid="settings-button"
        >
          <Settings size={18} />
        </button>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative">
        {sidebarOpen && (
          <button
            className="lg:hidden fixed inset-0 z-20 bg-black/50"
            onClick={() => setSidebarOpen(false)}
            aria-label="Cerrar sidebar"
          />
        )}
        {sidebarOpen && (
          <Sidebar notes={notes} folders={folders} selectedNoteId={selectedNoteId} loading={loadingNotes} width={sidebarPanel.width} onSelectNote={handleSelectNote} onCreateNote={handleCreateNote} onNewFolder={() => handleCreateFolder()} onMoveNote={handleMoveNote} onDeleteNote={handleDeleteNote} onDeleteFolder={handleDeleteFolder} onRenameFolder={handleRenameFolder} onCreateSubfolder={(parent) => handleCreateFolder(parent)} />
        )}
        {sidebarOpen && (
          <ResizeHandle
            label="Redimensionar sidebar"
            onResize={sidebarPanel.grow}
            onReset={sidebarPanel.reset}
            valueNow={sidebarPanel.width}
            valueMin={sidebarPanel.min}
            valueMax={sidebarPanel.max}
            className="hidden lg:block"
          />
        )}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <main className="flex-1 flex flex-col min-w-0 min-h-0">
          {selectedNote ? (
            <>
              <div className="h-10 bg-slate-100 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 flex items-center px-4 gap-2 shrink-0">
                <span className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1 min-w-0">{selectedNote.folder && (<><Folder size={13} aria-hidden="true" className="shrink-0" /><span className="truncate">{selectedNote.folder} /</span></>)}</span>
                {editingTitle ? (
                  <input
                    autoFocus
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveTitle();
                      else if (e.key === 'Escape') setEditingTitle(false);
                    }}
                    onBlur={() => {
                      if (editingTitle) saveTitle();
                    }}
                    onFocus={(e) => e.target.select()}
                    aria-label="Nuevo título de la nota"
                    className="text-sm font-medium bg-slate-100 dark:bg-slate-700 border border-amber-500 rounded px-2 py-0.5 focus:outline-none min-w-0 flex-1 max-w-xs"
                  />
                ) : (
                  <>
                    <span className="text-sm font-medium truncate">{selectedNote.title}</span>
                    <button
                      onClick={startEditingTitle}
                      className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 transition-colors shrink-0"
                      title="Renombrar nota"
                      aria-label="Renombrar nota"
                    >
                      <Pencil size={14} />
                    </button>
                  </>
                )}
                <span className="text-xs text-slate-500 ml-auto tabular">{isSaving ? 'Guardando...' : `Actualizado: ${new Date(selectedNote.updated).toLocaleTimeString()}`}</span>
                <button
                  onClick={() => togglePanel('help')}
                  className={`p-1.5 rounded transition-colors ${rightPanel === 'help' ? 'bg-slate-200 text-amber-700 dark:bg-slate-700 dark:text-amber-400' : 'hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400'}`}
                  title="Ayuda Markdown (Ctrl+?)"
                  aria-label="Ayuda Markdown"
                >
                  <BookOpen size={16} />
                </button>
                <button
                  onClick={() => togglePanel('history')}
                  className={`p-1.5 rounded transition-colors ${rightPanel === 'history' ? 'bg-slate-200 text-amber-700 dark:bg-slate-700 dark:text-amber-400' : 'hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400'}`}
                  title="Historial de versiones"
                  aria-label="Historial de versiones"
                >
                  <History size={16} />
                </button>
              </div>
              <NoteEditor note={selectedNote} onUpdate={handleUpdateNote} isSaving={isSaving} theme={darkMode ? 'dark' : 'light'} notes={notes} resetKey={editorResetKey} onToggleHelp={() => togglePanel('help')} notify={pushToast} />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-500">
              <div className="text-center">
                <FileText size={48} className="mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Selecciona o crea una nota para comenzar</p>
                <p className="text-sm mt-2">Usa <kbd className="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded text-xs">Ctrl+N</kbd> para crear una nueva nota</p>
              </div>
            </div>
          )}
          </main>
        </div>
        {previewOpen && selectedNote && (
          <ResizeHandle
            label="Redimensionar vista previa"
            onResize={(dx) => previewPanel.grow(-dx)}
            onReset={previewPanel.reset}
            valueNow={previewPanel.width}
            valueMin={previewPanel.min}
            valueMax={previewPanel.max}
            className="hidden md:block"
          />
        )}
        {previewOpen && selectedNote && (
          <aside aria-label="Vista previa y backlinks" style={{ width: previewPanel.width }} className="w-[320px] border-l border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30 flex flex-col overflow-hidden shrink-0 max-md:hidden">
            <div className="h-10 bg-slate-100 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 flex items-center px-4 shrink-0">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Vista previa</span>
              <span className="flex-1" />
              <button
                onClick={() => setBacklinksOpen((v) => !v)}
                className={`p-1 rounded transition-colors ${backlinksOpen ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                title="Mostrar/ocultar backlinks (Ctrl+Shift+B)"
                aria-label="Mostrar/ocultar backlinks"
              >
                <LinkIcon size={15} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto min-h-0">
              <NotePreview content={selectedNote.content} knownTargets={knownTargets} onWikilinkClick={handleWikilinkClick} />
            </div>
            {backlinksOpen && (
              <div className="border-t border-slate-200 dark:border-slate-700 max-h-60 flex flex-col shrink-0">
                <BacklinksPanel
                  backlinks={backlinks}
                  loading={backlinksLoading}
                  onOpen={handleSelectNote}
                  onToggle={() => setBacklinksOpen(false)}
                />
              </div>
            )}
          </aside>
        )}
        {rightPanel && selectedNote && (
          <div className="absolute right-0 top-0 bottom-0 w-[380px] max-w-[92%] z-20 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col">
            <Suspense fallback={<p className="px-4 py-3 text-xs text-slate-500">Cargando panel…</p>}>
              {rightPanel === 'history' ? (
                <VersionHistory
                  noteId={selectedNote.id}
                  currentContent={selectedNote.content}
                  knownTargets={knownTargets}
                  onChanged={handleHistoryChanged}
                  onClose={closePanel}
                  notify={pushToast}
                />
              ) : (
                <MarkdownHelp onClose={closePanel} />
              )}
            </Suspense>
          </div>
        )}
      </div>
      {templateOpen && (
        <Suspense fallback={null}>
          <TemplatePicker open={templateOpen} busy={creatingNote} onClose={() => setTemplateOpen(false)} onPick={handlePickTemplate} />
        </Suspense>
      )}
      <PromptDialog
        open={folderDialog !== null}
        title={folderDialog?.mode === 'rename' ? `Renombrar «${folderDialog.folder.path}»` : 'Nueva carpeta'}
        label={folderDialog?.mode === 'rename' ? 'Nueva ruta (puedes moverla cambiando el padre)' : 'Ruta (usa / para anidar, ej: proyecto/docs)'}
        initialValue={
          folderDialog?.mode === 'rename'
            ? folderDialog.folder.path
            : folderDialog?.mode === 'create' && folderDialog.parent
              ? `${folderDialog.parent}/`
              : ''
        }
        placeholder="ej: proyecto/docs"
        suggestions={flattenFolderPaths(folders)}
        confirmLabel={folderDialog?.mode === 'rename' ? 'Renombrar' : 'Crear'}
        onConfirm={(value) =>
          folderDialog?.mode === 'rename' ? confirmRenameFolder(value) : confirmCreateFolder(value)
        }
        onCancel={() => setFolderDialog(null)}
      />
      <ConfirmDialog
        open={confirm?.kind === 'note'}
        title="Eliminar nota"
        message={`¿Eliminar «${confirm?.kind === 'note' ? confirm.title : ''}»? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        danger
        busy={confirmBusy}
        onConfirm={confirmDeleteNote}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm?.kind === 'folder'}
        title="Eliminar carpeta"
        message={`¿Eliminar la carpeta «${confirm?.kind === 'folder' ? confirm.path : ''}»? Solo se puede si está vacía.`}
        confirmLabel="Eliminar"
        danger
        busy={confirmBusy}
        onConfirm={() => confirmDeleteFolder(false)}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm?.kind === 'folderForce'}
        title="Eliminar carpeta con contenido"
        message={`La carpeta tiene ${confirm?.kind === 'folderForce' ? confirm.count : 0} nota(s). ¿Eliminarla con todo su contenido? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar todo"
        danger
        busy={confirmBusy}
        onConfirm={() => confirmDeleteFolder(true)}
        onCancel={() => setConfirm(null)}
      />
      <SettingsDialog
        open={settingsOpen}
        darkMode={darkMode}
        onSetDarkMode={setDarkMode}
        onClose={() => setSettingsOpen(false)}
        onSaved={async () => {
          await fetchNotes();
          await fetchFolders();
        }}
        notify={pushToast}
      />
      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
