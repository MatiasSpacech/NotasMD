import { useState, useCallback, useRef } from 'react';

export type ToastKind = 'success' | 'error' | 'info';

export interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
}

/**
 * Notificaciones toast (Fase 9, item 60).
 * Éxitos y errores de acciones; el autoguardado usa el indicador del editor.
 */
export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(1);

  const push = useCallback((message: string, kind: ToastKind = 'info'): number => {
    const id = idRef.current++;
    setToasts((prev) => [...prev.slice(-3), { id, message, kind }]);
    return id;
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, push, dismiss };
}
