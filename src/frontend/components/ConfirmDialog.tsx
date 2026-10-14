import React, { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  /** Rojo para acciones destructivas */
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmación antes de eliminar (Fase 9, item 59).
 * Mismo vocabulario visual que TemplatePicker. Foco seguro en Cancelar.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  danger,
  busy,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter' && !busy) onConfirm();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onCancel, onConfirm]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/60"
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className="w-[380px] max-w-[92%] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-2xl p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-2">
          {danger && <AlertTriangle size={16} className="text-red-600 dark:text-red-400 shrink-0" />}
          <span className="font-medium text-slate-900 dark:text-slate-100">{title}</span>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">{message}</p>
        <div className="flex gap-2 justify-end">
          <button
            ref={cancelRef}
            onClick={onCancel}
            disabled={busy}
            className="px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 rounded-md"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`px-3 py-1.5 text-sm font-medium rounded-md disabled:opacity-50 ${
              danger
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-amber-500 hover:bg-amber-600 text-slate-900'
            }`}
          >
            {busy ? 'Procesando…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
