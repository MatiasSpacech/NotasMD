import React, { useState, useEffect, useRef } from 'react';

interface PromptDialogProps {
  open: boolean;
  title: string;
  label?: string;
  initialValue?: string;
  placeholder?: string;
  /** Sugerencias (datalist) */
  suggestions?: string[];
  confirmLabel?: string;
  busy?: boolean;
  /** Retorna mensaje de error si el valor no es válido, null si OK */
  validate?: (value: string) => string | null;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

/**
 * Diálogo de texto (reemplaza a prompt() nativo):
 * crear/renombrar carpeta, mover nota a carpeta.
 */
export function PromptDialog({
  open,
  title,
  label,
  initialValue = '',
  placeholder,
  suggestions = [],
  confirmLabel = 'Aceptar',
  busy,
  validate,
  onConfirm,
  onCancel,
}: PromptDialogProps) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useRef(`prompt-list-${Math.floor(Math.random() * 1e9)}`);

  useEffect(() => {
    if (open) {
      setValue(initialValue);
      setError(null);
      const t = setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 30);
      return () => clearTimeout(t);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  const confirm = () => {
    const trimmed = value.trim();
    if (validate) {
      const err = validate(trimmed);
      if (err) {
        setError(err);
        return;
      }
    } else if (!trimmed) {
      setError('El valor no puede estar vacío');
      return;
    }
    onConfirm(trimmed);
  };

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/60"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-[380px] max-w-[92%] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-2xl p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="font-medium text-slate-900 dark:text-slate-100 mb-3">{title}</p>
        {label && (
          <label htmlFor={listId.current} className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
            {label}
          </label>
        )}
        <input
          ref={inputRef}
          id={listId.current}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') confirm();
          }}
          placeholder={placeholder}
          list={suggestions.length > 0 ? `${listId.current}-options` : undefined}
          className="w-full px-3 py-1.5 mb-1 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
        />
        {suggestions.length > 0 && (
          <datalist id={`${listId.current}-options`}>
            {suggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        )}
        {error && <p className="text-xs text-red-600 dark:text-red-400 mb-1">{error}</p>}
        <div className="flex gap-2 justify-end mt-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 rounded-md"
          >
            Cancelar
          </button>
          <button
            onClick={confirm}
            disabled={busy}
            className="px-3 py-1.5 text-sm bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-900 font-medium rounded-md"
          >
            {busy ? 'Procesando…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default PromptDialog;
