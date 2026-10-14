import React, { useRef } from 'react';

interface ResizeHandleProps {
  /** Etiqueta accesible, ej. "Redimensionar sidebar" */
  label: string;
  /** Delta horizontal en px desde el último evento (incremental) */
  onResize: (deltaX: number) => void;
  /** Doble click: restaurar ancho por defecto */
  onReset?: () => void;
  valueNow: number;
  valueMin: number;
  valueMax: number;
  className?: string;
}

/**
 * Divisor arrastrable entre columnas (mouse + táctil vía Pointer Events).
 * Teclado: ←/→ ajustan de a 10px. Doble click: reset.
 */
export function ResizeHandle({
  label,
  onResize,
  onReset,
  valueNow,
  valueMin,
  valueMax,
  className = '',
}: ResizeHandleProps) {
  const dragging = useRef(false);
  const lastX = useRef(0);

  const start = (clientX: number) => {
    dragging.current = true;
    lastX.current = clientX;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
  };

  const stop = () => {
    dragging.current = false;
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuemin={valueMin}
      aria-valuemax={valueMax}
      aria-valuenow={Math.round(valueNow)}
      tabIndex={0}
      onPointerDown={(e) => {
        e.preventDefault();
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // sin captura: igual funciona
        }
        start(e.clientX);
      }}
      onPointerMove={(e) => {
        if (!dragging.current) return;
        const dx = e.clientX - lastX.current;
        lastX.current = e.clientX;
        if (dx !== 0) onResize(dx);
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onDoubleClick={() => onReset?.()}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          onResize(-10);
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          onResize(10);
        }
      }}
      className={`w-1.5 shrink-0 cursor-col-resize touch-none transition-colors hover:bg-amber-500/50 active:bg-amber-500/70 focus-visible:bg-amber-500/50 ${className}`}
    />
  );
}

export default ResizeHandle;
