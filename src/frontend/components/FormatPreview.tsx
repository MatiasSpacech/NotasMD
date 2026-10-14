import React, { useMemo } from 'react';
import { Sparkles, X } from 'lucide-react';
import { diffLines } from '../lib/diff';

interface FormatPreviewProps {
  open: boolean;
  original: string;
  formatted: string;
  busy?: boolean;
  onAccept: () => void;
  onCancel: () => void;
}

/**
 * Preview del auto-formateo: diff antes de aplicar, sin sorpresas.
 */
export function FormatPreview({ open, original, formatted, busy, onAccept, onCancel }: FormatPreviewProps) {
  const rows = useMemo(
    () => (open ? diffLines(original, formatted) : []),
    [open, original, formatted],
  );
  const changedCount = useMemo(() => rows.filter((r) => r.type !== 'same').length, [rows]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/60"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Vista previa de formateo"
        className="w-[560px] max-w-[92%] max-h-[84vh] flex flex-col bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-2xl p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-1 shrink-0">
          <Sparkles size={16} className="text-amber-600 dark:text-amber-400" aria-hidden="true" />
          <span className="font-medium text-slate-900 dark:text-slate-100">Auto-formatear Markdown</span>
          <span className="flex-1" />
          <button
            onClick={onCancel}
            aria-label="Cerrar"
            className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500 dark:text-slate-400"
            title="Cerrar"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
          {changedCount} línea{changedCount !== 1 ? 's' : ''} con cambios. Los [[wikilinks]] y bloques de código no se tocan.
        </p>
        <pre className="flex-1 min-h-0 overflow-auto text-[11px] leading-relaxed font-mono border border-slate-300 dark:border-slate-700 rounded-md p-2 whitespace-pre-wrap">
          {rows.map((r, i) => (
            <span
              key={i}
              className={
                r.type === 'add'
                  ? 'block bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                  : r.type === 'del'
                    ? 'block bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
                    : 'block text-slate-500'
              }
            >
              {r.type === 'add' ? '+' : r.type === 'del' ? '-' : ' '} {r.text || ' '}
            </span>
          ))}
        </pre>
        <div className="flex gap-2 justify-end mt-3 shrink-0">
          <button
            onClick={onCancel}
            disabled={busy}
            className="px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 rounded-md"
          >
            Cancelar
          </button>
          <button
            onClick={onAccept}
            disabled={busy}
            className="px-3 py-1.5 text-sm bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-900 font-medium rounded-md"
          >
            Aplicar formato
          </button>
        </div>
      </div>
    </div>
  );
}

export default FormatPreview;
