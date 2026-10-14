import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import type { ToastItem } from '../hooks/useToast';

const AUTO_DISMISS_MS = 4000;

const KIND_STYLES: Record<ToastItem['kind'], { icon: React.ReactNode; border: string; role: 'status' | 'alert' }> = {
  success: {
    icon: <CheckCircle2 size={16} className="text-green-600 dark:text-green-400 shrink-0" />,
    border: 'border-green-300 dark:border-green-800',
    role: 'status',
  },
  error: {
    icon: <AlertCircle size={16} className="text-red-600 dark:text-red-400 shrink-0" />,
    border: 'border-red-300 dark:border-red-800',
    role: 'alert',
  },
  info: {
    icon: <Info size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />,
    border: 'border-slate-300 dark:border-slate-600',
    role: 'status',
  },
};

function ToastRow({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const t = setTimeout(() => onDismiss(toast.id), AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [toast.id, onDismiss]);

  const style = KIND_STYLES[toast.kind];
  return (
    <div
      role={style.role}
      className={`flex items-start gap-2 w-80 max-w-[calc(100vw-2rem)] px-3 py-2.5 bg-white dark:bg-slate-800 border ${style.border} rounded-md shadow-xl text-sm text-slate-800 dark:text-slate-100`}
    >
      <span className="mt-0.5">{style.icon}</span>
      <span className="flex-1 break-words">{toast.message}</span>
      <button
        onClick={() => onDismiss(toast.id)}
        aria-label="Descartar notificación"
        className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
        title="Descartar"
      >
        <X size={14} />
      </button>
    </div>
  );
}

interface ToastProps {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}

/**
 * Pila de notificaciones (Fase 9, item 60). Arriba de drawers y modales.
 */
export function Toast({ toasts, onDismiss }: ToastProps) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <ToastRow key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

export default Toast;
