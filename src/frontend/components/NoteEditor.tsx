import React, { useState, useEffect, useCallback, useRef } from 'react';
import MDEditor from '@uiw/react-md-editor';
import '@uiw/react-md-editor/markdown-editor.css';
import { Toolbar, ToolbarAction } from './Toolbar';
import { AutocompletePanel, SuggestionItem } from './AutocompletePanel';
import { FormatPreview } from './FormatPreview';
import {
  wrapSelection,
  prefixSelectedLines,
  insertSnippet,
  TABLE_SNIPPET,
  countWords,
  EditResult,
} from '../lib/markdown';
import { getShortcutAction, isHelpShortcut, isFormatShortcut } from '../lib/shortcuts';
import { matchWikiTrigger } from '../lib/wikilink-parser';
import {
  matchMdTrigger,
  getMdSuggestions,
  applyMdSuggestion,
  MdTrigger,
} from '../lib/autocomplete';

interface Note {
  id: string;
  title: string;
  folder: string;
  content: string;
  tags: string[];
  created: string;
  updated: string;
}

interface NoteEditorProps {
  note: Note;
  onUpdate: (id: string, content: string) => void;
  isSaving: boolean;
  theme?: 'dark' | 'light';
  /** Notas para el autocompletado de [[wikilinks]] */
  notes?: Array<{ id: string; title: string; folder: string }>;
  /** Al cambiar, recarga el contenido (p. ej. tras restaurar una versión) */
  resetKey?: number;
  /** Alternar la ayuda Markdown (Ctrl+?) */
  onToggleHelp?: () => void;
  /** Notificaciones (p. ej. "ya estaba formateada") */
  notify?: (message: string, kind: 'success' | 'error' | 'info') => void;
}

/** Dropdown unificado: wikilinks [[...]] o snippets Markdown */
type Completion =
  | { kind: 'wiki'; query: string; start: number }
  | { kind: 'md'; trigger: MdTrigger };

const AUTOSAVE_DEBOUNCE_MS = 1000;
const AUTOSAVE_INTERVAL_MS = 30000;
const WIKI_MAX_SUGGESTIONS = 8;

/**
 * Editor Markdown (Fase 4):
 * - `@uiw/react-md-editor` en modo solo-edición + `Toolbar` propio
 * - Autoguardado: debounce 1s al escribir, cada 30s si hay cambios, y flush al cambiar de nota
 * - Atajos: Ctrl+B negrita, Ctrl+I cursiva, Ctrl+S guardar
 */
export function NoteEditor({ note, onUpdate, isSaving, theme = 'dark', notes = [], resetKey = 0, onToggleHelp, notify }: NoteEditorProps) {
  const [content, setContent] = useState(note.content);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Cambios pendientes de guardar (se actualiza en el momento del evento, no en render) */
  const pendingRef = useRef<{ id: string; content: string } | null>(null);
  /** Snapshot espejo para el intervalo de 30s (lectura segura fuera de render) */
  const mirrorRef = useRef({ id: note.id, content, saved: note.content });
  mirrorRef.current = { id: note.id, content, saved: note.content };
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;
  const noteIdRef = useRef(note.id);
  const notifyRef = useRef(notify);
  notifyRef.current = notify;
  const requestFormatRef = useRef<() => void>(() => {});
  /** Preview del auto-formateo pendiente de aceptar */
  const [formatPreview, setFormatPreview] = useState<{ original: string; formatted: string; cursor: number } | null>(null);
  const formatPreviewRef = useRef<{ original: string; formatted: string; cursor: number } | null>(null);
  const formattingRef = useRef(false);
  /** Autocompletado unificado ([[wikilinks]] + snippets MD) + índice resaltado */
  const [completion, setCompletion] = useState<Completion | null>(null);
  const [compIndex, setCompIndex] = useState(0);
  const compKeyRef = useRef('');

  // Cargar contenido al cambiar de nota
  useEffect(() => {
    noteIdRef.current = note.id;
    setContent(note.content);
    setCompletion(null);
    compKeyRef.current = '';
    formatPreviewRef.current = null;
    setFormatPreview(null);
  }, [note.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Recarga explícita (p. ej. tras restaurar una versión desde el historial)
  useEffect(() => {
    setContent(note.content);
    pendingRef.current = null;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  // Flush al cambiar de nota o desmontar: guardar lo pendiente de la nota anterior
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      const p = pendingRef.current;
      pendingRef.current = null;
      if (p) onUpdateRef.current(p.id, p.content);
    };
  }, [note.id]);

  // Autoguardado cada 30s si hay cambios sin guardar
  useEffect(() => {
    const iv = setInterval(() => {
      const m = mirrorRef.current;
      if (m.content !== m.saved) onUpdateRef.current(m.id, m.content);
    }, AUTOSAVE_INTERVAL_MS);
    return () => clearInterval(iv);
  }, []);

  const scheduleSave = useCallback((id: string, next: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    pendingRef.current = { id, content: next };
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      const p = pendingRef.current;
      pendingRef.current = null;
      if (p) onUpdateRef.current(p.id, p.content);
    }, AUTOSAVE_DEBOUNCE_MS);
  }, []);

  const handleChange = useCallback(
    (value: string | undefined) => {
      const next = value ?? '';
      setContent(next);
      scheduleSave(note.id, next);
      // Detectar trigger de autocompletado ([[ o Markdown)
      const ta = containerRef.current?.querySelector('textarea');
      const cursor = ta?.selectionStart ?? next.length;
      updateCompletion(next, cursor);
    },
    [note.id, scheduleSave],
  );

  /** Recalcular el completion ([[ tiene prioridad sobre MD) sin resetear índice si no cambió */
  const updateCompletion = (value: string, cursor: number) => {
    const w = matchWikiTrigger(value, cursor);
    const next: Completion | null = w
      ? { kind: 'wiki', query: w.query, start: w.start }
      : (() => {
          const m = matchMdTrigger(value, cursor);
          return m ? { kind: 'md', trigger: m } : null;
        })();
    const key = !next
      ? ''
      : next.kind === 'wiki'
        ? `wiki:${next.start}:${next.query}`
        : `md:${next.trigger.kind}:${next.trigger.start}:${next.trigger.end}:${next.trigger.query}`;
    if (key !== compKeyRef.current) {
      compKeyRef.current = key;
      setCompIndex(0);
    }
    setCompletion(next);
  };

  /** Reevaluar el completion cuando el cursor se mueve sin escribir (click, flechas) */
  const refreshCompletion = () => {
    const ta = containerRef.current?.querySelector('textarea');
    const value = ta ? ta.value : mirrorRef.current.content;
    const cursor = ta?.selectionStart ?? value.length;
    updateCompletion(value, cursor);
  };

  const closeCompletion = () => {
    setCompletion(null);
    compKeyRef.current = '';
  };

  /** Items del dropdown según el trigger activo */
  const completionItems: SuggestionItem[] = (() => {
    if (!completion) return [];
    if (completion.kind === 'wiki') {
      const q = completion.query.toLowerCase();
      return notes
        .filter(
          (n) =>
            !q ||
            n.title.toLowerCase().includes(q) ||
            `${n.folder}/${n.title}`.toLowerCase().includes(q),
        )
        .slice(0, WIKI_MAX_SUGGESTIONS)
        .map((n) => ({
          key: n.id,
          label: `[[${n.folder ? `${n.folder}/` : ''}${n.title}]]`,
          sub: n.folder ? `📁 ${n.folder}` : undefined,
        }));
    }
    return getMdSuggestions(completion.trigger, notes).map((s) => ({
      key: s.key,
      label: s.label,
      sub: s.hint ?? (s.target ? `→ ${s.target}` : undefined),
    }));
  })();
  const compActive = Math.min(compIndex, Math.max(0, completionItems.length - 1));

  /** Restaurar foco y cursor tras una inserción */
  const refocus = (pos: number) => {
    requestAnimationFrame(() => {
      const ta = containerRef.current?.querySelector('textarea');
      if (ta) {
        ta.focus();
        try {
          ta.setSelectionRange(pos, pos);
        } catch {
          // ignorar
        }
      }
    });
  };

  /** Insertar la sugerencia elegida */
  const acceptCompletion = (index: number) => {
    if (!completion) return;
    if (completion.kind === 'wiki') {
      const q = completion.query.toLowerCase();
      const matches = notes.filter(
        (n) =>
          !q ||
          n.title.toLowerCase().includes(q) ||
          `${n.folder}/${n.title}`.toLowerCase().includes(q),
      );
      const target = matches[Math.min(index, matches.length - 1)];
      if (!target) return;
      const dupes = notes.filter((n) => n.title === target.title).length;
      const insertTarget =
        dupes > 1 && target.folder ? `${target.folder}/${target.title}` : target.title;
      const insertion = `[[${insertTarget}]]`;
      const cursorPos = completion.start + 2 + completion.query.length;
      const base = mirrorRef.current.content;
      const next = base.slice(0, completion.start) + insertion + base.slice(cursorPos);
      setContent(next);
      scheduleSave(noteIdRef.current, next);
      closeCompletion();
      refocus(completion.start + insertion.length);
      return;
    }
    const suggestions = getMdSuggestions(completion.trigger, notes);
    const s = suggestions[Math.min(index, suggestions.length - 1)];
    if (!s) return;
    const base = mirrorRef.current.content;
    const result = applyMdSuggestion(base, completion.trigger, s);
    setContent(result.value);
    scheduleSave(noteIdRef.current, result.value);
    closeCompletion();
    requestAnimationFrame(() => {
      const ta = containerRef.current?.querySelector('textarea');
      if (ta) {
        ta.focus();
        try {
          ta.setSelectionRange(result.selStart, result.selEnd);
        } catch {
          // ignorar
        }
      }
    });
  };

  const getTextareaSelection = (): { value: string; start: number; end: number } => {
    const ta = containerRef.current?.querySelector('textarea');
    if (ta) {
      return {
        value: ta.value,
        start: ta.selectionStart ?? ta.value.length,
        end: ta.selectionEnd ?? ta.value.length,
      };
    }
    return { value: content, start: content.length, end: content.length };
  };

  const commitEdit = useCallback(
    (result: EditResult) => {
      setContent(result.value);
      scheduleSave(noteIdRef.current, result.value);
      setCompletion(null);
      compKeyRef.current = '';
      // Restaurar foco y selección tras el repintado
      requestAnimationFrame(() => {
        const ta = containerRef.current?.querySelector('textarea');
        if (ta) {
          ta.focus();
          try {
            ta.setSelectionRange(result.selStart, result.selEnd);
          } catch {
            // ignorar
          }
        }
      });
    },
    [scheduleSave],
  );

  const applyToolbarAction = useCallback(
    (action: ToolbarAction) => {
      const sel = getTextareaSelection();
      switch (action) {
        case 'bold':
          return commitEdit(wrapSelection(sel.value, sel.start, sel.end, '**', '**'));
        case 'italic':
          return commitEdit(wrapSelection(sel.value, sel.start, sel.end, '*', '*'));
        case 'strikethrough':
          return commitEdit(wrapSelection(sel.value, sel.start, sel.end, '~~', '~~'));
        case 'h1':
          return commitEdit(prefixSelectedLines(sel.value, sel.start, sel.end, '# '));
        case 'h2':
          return commitEdit(prefixSelectedLines(sel.value, sel.start, sel.end, '## '));
        case 'h3':
          return commitEdit(prefixSelectedLines(sel.value, sel.start, sel.end, '### '));
        case 'ul':
          return commitEdit(prefixSelectedLines(sel.value, sel.start, sel.end, '- '));
        case 'ol':
          return commitEdit(prefixSelectedLines(sel.value, sel.start, sel.end, '1. '));
        case 'task':
          return commitEdit(prefixSelectedLines(sel.value, sel.start, sel.end, '- [ ] '));
        case 'quote':
          return commitEdit(prefixSelectedLines(sel.value, sel.start, sel.end, '> '));
        case 'inlineCode':
          return commitEdit(wrapSelection(sel.value, sel.start, sel.end, '`', '`', 'código'));
        case 'codeBlock':
          return commitEdit(wrapSelection(sel.value, sel.start, sel.end, '```\n', '\n```', 'código'));
        case 'link':
          return commitEdit(wrapSelection(sel.value, sel.start, sel.end, '[', '](url)'));
        case 'wikilink':
          return commitEdit(wrapSelection(sel.value, sel.start, sel.end, '[[', ']]', 'nota'));
        case 'table':
          return commitEdit(insertSnippet(sel.value, sel.start, sel.end, TABLE_SNIPPET));
        case 'hr':
          return commitEdit(insertSnippet(sel.value, sel.start, sel.end, '\n---\n'));
        case 'format':
          requestFormatRef.current();
          return;
      }
    },
    [commitEdit],
  );

  const saveNow = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pendingRef.current = null;
    const m = mirrorRef.current;
    if (m.content !== m.saved) onUpdateRef.current(m.id, m.content);
  }, []);

  /** Pedir auto-formateo al backend y mostrar preview del diff */
  const requestFormat = useCallback(async () => {
    if (formattingRef.current) return;
    const m = mirrorRef.current;
    if (!m.content.trim()) {
      notifyRef.current?.('Nada que formatear', 'info');
      return;
    }
    formattingRef.current = true;
    try {
      const res = await fetch('http://localhost:3001/api/format', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: m.content }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        notifyRef.current?.(data.error ?? 'No se pudo formatear', 'error');
        return;
      }
      if (!data.changed) {
        notifyRef.current?.('La nota ya está bien formateada', 'info');
        return;
      }
      const ta = containerRef.current?.querySelector('textarea');
      const cursor = ta?.selectionStart ?? m.content.length;
      const preview = { original: m.content, formatted: data.formatted, cursor };
      formatPreviewRef.current = preview;
      setFormatPreview(preview);
    } catch {
      notifyRef.current?.('No se pudo formatear', 'error');
    } finally {
      formattingRef.current = false;
    }
  }, []);

  /** Aplicar el formateo aceptado en el preview */
  const acceptFormat = useCallback(() => {
    const fp = formatPreviewRef.current;
    if (!fp) return;
    formatPreviewRef.current = null;
    setFormatPreview(null);
    const pos = Math.min(fp.cursor, fp.formatted.length);
    setContent(fp.formatted);
    scheduleSave(noteIdRef.current, fp.formatted);
    requestAnimationFrame(() => {
      const ta = containerRef.current?.querySelector('textarea');
      if (ta) {
        ta.focus();
        try {
          ta.setSelectionRange(pos, pos);
        } catch {
          // ignorar
        }
      }
    });
  }, [scheduleSave]);

  requestFormatRef.current = requestFormat;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ayuda Markdown (Fase 7) — funciona con o sin dropdown
    if (isHelpShortcut(e)) {
      e.preventDefault();
      onToggleHelp?.();
      return;
    }
    // Navegación del autocompletado unificado — prioridad sobre atajos
    if (completion) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeCompletion();
        return;
      }
      if (completionItems.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setCompIndex((i) => (i + 1) % completionItems.length);
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setCompIndex((i) => (i - 1 + completionItems.length) % completionItems.length);
          return;
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          acceptCompletion(compActive);
          return;
        }
      }
    }
    // Auto-formatear (Ctrl+Shift+F)
    if (isFormatShortcut(e)) {
      e.preventDefault();
      requestFormat();
      return;
    }
    const action = getShortcutAction(e);
    if (!action) return;
    e.preventDefault();
    if (action === 'save') {
      saveNow();
      return;
    }
    applyToolbarAction(action);
  };

  const dirty = content !== note.content;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-slate-900 min-h-0 relative">
      <Toolbar onAction={applyToolbarAction} />
      {/* Dropdown de autocompletado unificado ([[wikilinks]] + Markdown) */}
      {completion && (
        <AutocompletePanel
          items={completionItems}
          activeIndex={compActive}
          onSelect={acceptCompletion}
        />
      )}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div
        ref={containerRef}
        data-color-mode={theme}
        onKeyDown={handleKeyDown}
        onKeyUp={refreshCompletion}
        onClick={refreshCompletion}
        className="flex-1 min-h-0"
      >
        <MDEditor
          value={content}
          onChange={handleChange}
          preview="edit"
          hideToolbar={true}
          visibleDragbar={false}
          height="100%"
          textareaProps={{ placeholder: 'Escribe tu nota en Markdown...' }}
        />
      </div>
      {/* Status bar */}
      <div className="h-6 bg-slate-100 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 flex items-center px-3 text-xs text-slate-500 shrink-0">
        <span className="mr-4">Palabras: {countWords(content)}</span>
        <span className="mr-4">Caracteres: {content.length}</span>
        <span className="ml-auto">
          {isSaving ? '💾 Guardando...' : dirty ? '● Sin guardar' : '✅ Guardado'}
        </span>
      </div>
      {formatPreview && (
        <FormatPreview
          open
          original={formatPreview.original}
          formatted={formatPreview.formatted}
          onAccept={acceptFormat}
          onCancel={() => {
            formatPreviewRef.current = null;
            setFormatPreview(null);
          }}
        />
      )}
    </div>
  );
}

export default NoteEditor;
