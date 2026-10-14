import React, { useState, useEffect, useRef } from 'react';
import { Search, FileText, Folder } from 'lucide-react';

export interface SearchResult {
  id: string;
  title: string;
  folder: string;
  tags: string[];
  snippet: string;
  score: number;
}

export type SearchScope = 'all' | 'title' | 'content' | 'tags';

const SCOPES: Array<{ id: SearchScope; label: string }> = [
  { id: 'all', label: 'Todas' },
  { id: 'title', label: 'Título' },
  { id: 'content', label: 'Contenido' },
  { id: 'tags', label: 'Tags' },
];

const MIN_QUERY_LEN = 2;
const DEBOUNCE_MS = 250;

interface SearchBarProps {
  /** Notas para el quick-open (Ctrl+P / query vacía) */
  notes: Array<{ id: string; title: string; folder: string }>;
  onOpenNote: (id: string) => void;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Resaltar coincidencias con <mark> (Fase 8, item 55). */
export function Highlighted({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const parts = text.split(new RegExp(`(${escapeRegExp(q)})`, 'gi'));
  if (parts.length <= 1) return <>{text}</>;
  return (
    <>
      {parts.map((p, i) =>
        p.toLowerCase() === q.toLowerCase() ? (
          <mark key={i} className="bg-amber-300 text-amber-950 dark:bg-amber-500/40 dark:text-amber-100 rounded-sm px-0.5">
            {p}
          </mark>
        ) : (
          <React.Fragment key={i}>{p}</React.Fragment>
        ),
      )}
    </>
  );
}

/**
 * Buscador con dropdown de resultados (Fase 8):
 * debounce, scopes, resaltado, ↑↓/Enter/Esc, Ctrl+F buscar, Ctrl+P quick-open.
 */
export function SearchBar({ notes, onOpenNote }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<SearchScope>('all');
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // Cerrar al clickar fuera
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // Atajos globales (item 57)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === 'f') {
        e.preventDefault();
        setOpen(true);
        inputRef.current?.focus();
        inputRef.current?.select();
      } else if (k === 'p') {
        e.preventDefault();
        setQuery('');
        setOpen(true);
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Búsqueda con debounce
  useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_QUERY_LEN) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `http://localhost:3001/api/search?q=${encodeURIComponent(q)}&scope=${scope}`,
        );
        if (!res.ok) throw new Error('search failed');
        const data = await res.json();
        setResults(data.results ?? []);
        setActive(0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query, scope]);

  // Quick-open: sin query muestra las primeras notas
  const quickOpen: SearchResult[] =
    query.trim().length === 0
      ? notes.slice(0, 10).map((n) => ({ id: n.id, title: n.title, folder: n.folder, tags: [], snippet: '', score: 0 }))
      : [];

  const list = query.trim().length === 0 ? quickOpen : results;
  const activeClamped = Math.min(active, Math.max(0, list.length - 1));

  const openResult = (id: string) => {
    onOpenNote(id);
    setOpen(false);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (list.length ? (i + 1) % list.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (list.length ? (i - 1 + list.length) % list.length : 0));
    } else if (e.key === 'Enter' && list[activeClamped]) {
      e.preventDefault();
      openResult(list[activeClamped].id);
    }
  };

  return (
    <div ref={boxRef} className="relative">
      <Search size={16} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      <input
        ref={inputRef}
        type="text"
        placeholder="Buscar notas... (Ctrl+F)"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        className="pl-8 pr-3 py-1.5 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm text-slate-800 dark:text-slate-200 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/50 w-56 lg:w-[420px]"
        aria-label="Buscar notas"
      />
      {open && (
        <div className="absolute right-0 mt-1 w-80 max-h-96 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md shadow-xl py-1 z-30">
          {/* Scopes (item 56) */}
          <div className="flex gap-1 px-2 py-1.5 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800">
            {SCOPES.map((s) => (
              <button
                key={s.id}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setScope(s.id)}
                className={`px-2 py-0.5 text-[11px] rounded-full transition-colors ${
                  scope === s.id
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/25 dark:text-amber-300'
                    : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                {s.label}
              </button>
            ))}
            <span className="flex-1" />
            {loading && <span className="text-[11px] text-slate-500">…</span>}
          </div>

          {query.trim().length > 0 && query.trim().length < MIN_QUERY_LEN && (
            <p className="px-3 py-2 text-xs text-slate-500 italic">Escribe al menos 2 caracteres</p>
          )}
          {query.trim().length >= MIN_QUERY_LEN && !loading && results.length === 0 && (
            <p className="px-3 py-2 text-xs text-slate-500 italic">Sin resultados</p>
          )}
          {query.trim().length === 0 && (
            <p className="px-3 pt-1.5 text-[11px] text-slate-500">Quick open — elige una nota</p>
          )}

          {list.map((r, i) => (
            <button
              key={r.id}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => openResult(r.id)}
              onMouseEnter={() => setActive(i)}
              className={`w-full text-left px-3 py-1.5 ${
                i === activeClamped ? 'bg-amber-100 dark:bg-amber-500/15' : ''
              }`}
            >
              <span className="flex items-center gap-1.5 text-sm text-slate-900 dark:text-slate-100">
                <FileText size={13} className="shrink-0 text-slate-400" />
                <span className="truncate">
                  <Highlighted text={r.title} query={query} />
                </span>
              </span>
              {r.folder && <span className="flex items-center gap-1 ml-5 text-[11px] text-slate-500"><Folder size={11} aria-hidden="true" />{r.folder}</span>}
              {r.snippet && (
                <span className="block ml-5 mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                  <Highlighted text={r.snippet} query={query} />
                </span>
              )}
              {r.tags.length > 0 && (
                <span className="block ml-5 mt-0.5 text-[11px] text-slate-500">
                  {r.tags.map((t) => `#${t}`).join(' ')}
                </span>
              )}
            </button>
          ))}
          {list.length > 0 && (
            <p className="px-3 py-1 text-[11px] text-slate-500 border-t border-slate-200 dark:border-slate-700">
              {list.length} resultado{list.length !== 1 ? 's' : ''} · ↑↓ navegar · Enter abrir · Esc cerrar
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default SearchBar;
