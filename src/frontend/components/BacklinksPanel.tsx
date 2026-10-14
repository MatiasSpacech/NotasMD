import React from 'react';
import { Link2, FileText } from 'lucide-react';

export interface Backlink {
  id: string;
  title: string;
  folder: string;
  snippet: string;
}

interface BacklinksPanelProps {
  backlinks: Backlink[];
  loading: boolean;
  onOpen: (id: string) => void;
  /** Colapsar la lista (Fase 9: Ctrl+Shift+B) */
  onToggle?: () => void;
}

/**
 * Panel de backlinks: notas que referencian a la nota actual (Fase 5, item 38).
 */
export function BacklinksPanel({ backlinks, loading, onOpen, onToggle }: BacklinksPanelProps) {
  return (
    <div className="flex flex-col min-h-0">
      <button
        className="px-4 py-2 flex items-center gap-2 shrink-0 w-full text-left hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
        onClick={onToggle}
        title={onToggle ? 'Mostrar/ocultar backlinks (Ctrl+Shift+B)' : undefined}
      >
        <Link2 size={14} className="text-slate-400" />
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Backlinks</span>
        <span className="text-xs text-slate-500">({backlinks.length})</span>
      </button>
      <div className="overflow-y-auto px-2 pb-3">
        {loading && <p className="px-2 py-1 text-xs text-slate-500">Cargando…</p>}
        {!loading && backlinks.length === 0 && (
          <p className="px-2 py-1 text-xs text-slate-500 italic">Ninguna nota enlaza aquí.</p>
        )}
        {!loading &&
          backlinks.map((b) => (
            <button
              key={b.id}
              onClick={() => onOpen(b.id)}
              className="w-full text-left px-2 py-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors group"
              title={`Abrir ${b.title}`}
            >
              <span className="flex items-center gap-1.5 text-sm text-amber-700 group-hover:text-amber-800 dark:text-amber-400/90 dark:group-hover:text-amber-300">
                <FileText size={13} className="shrink-0" />
                <span className="truncate">{b.title}</span>
              </span>
              {b.folder && <span className="block ml-5 text-[11px] text-slate-500">📁 {b.folder}</span>}
              {b.snippet && (
                <span className="block ml-5 mt-0.5 text-[11px] text-slate-500 truncate">{b.snippet}</span>
              )}
            </button>
          ))}
      </div>
    </div>
  );
}

export default BacklinksPanel;
