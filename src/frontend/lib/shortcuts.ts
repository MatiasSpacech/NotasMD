/**
 * Atajos de teclado del editor (Fase 4).
 * - Ctrl/Cmd+B → negrita
 * - Ctrl/Cmd+I → cursiva
 * - Ctrl/Cmd+S → guardar (con preventDefault para evitar el diálogo del navegador)
 */

export type ShortcutAction = 'bold' | 'italic' | 'save';

interface KeyEventLike {
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey?: boolean;
  key: string;
}

/** Devolver la acción del atajo, o null si la tecla no es un atajo del editor. */
export function getShortcutAction(e: KeyEventLike): ShortcutAction | null {
  if (!e.ctrlKey && !e.metaKey) return null;
  switch (e.key.toLowerCase()) {
    case 'b':
      return 'bold';
    case 'i':
      return 'italic';
    case 's':
      return 'save';
    default:
      return null;
  }
}

export const SHORTCUT_LABELS: Record<ShortcutAction, string> = {
  bold: 'Ctrl+B',
  italic: 'Ctrl+I',
  save: 'Ctrl+S',
};

/** Ctrl+? (Ctrl+Shift+/) → ayuda Markdown (Fase 7). */
export function isHelpShortcut(e: KeyEventLike): boolean {
  return Boolean(e.ctrlKey || e.metaKey) && e.key === '?';
}

/** Ctrl+Shift+F → auto-formatear Markdown. */
export function isFormatShortcut(e: KeyEventLike): boolean {
  return Boolean(e.ctrlKey || e.metaKey) && Boolean(e.shiftKey) && e.key.toLowerCase() === 'f';
}

export type GlobalAction = 'newNote' | 'deleteNote' | 'toggleHistory' | 'toggleHelp' | 'toggleBacklinks';

/**
 * Atajos globales de la app (Fase 9, item 61).
 * Nota: Ctrl+N / Ctrl+D / Ctrl+Shift+B están reservados por algunos navegadores;
 * se intenta preventDefault como mejor esfuerzo.
 */
export function getGlobalAction(e: KeyEventLike): GlobalAction | null {
  if (!e.ctrlKey && !e.metaKey) return null;
  const key = e.key.toLowerCase();
  if (e.shiftKey) {
    if (key === 'h') return 'toggleHistory';
    if (key === 'm') return 'toggleHelp';
    if (key === 'b') return 'toggleBacklinks';
    return null;
  }
  if (key === 'n' && !e.shiftKey) return 'newNote';
  if (key === 'd' && !e.shiftKey) return 'deleteNote';
  return null;
}

/** ¿El foco está en un campo editable? (inputs: no robar Ctrl+N/D) */
export function isEditableTarget(e: { target?: unknown }): boolean {
  const t = e.target as HTMLElement | null;
  if (!t || typeof (t as HTMLElement).tagName !== 'string') return false;
  const tag = (t as HTMLElement).tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    Boolean((t as HTMLElement).isContentEditable)
  );
}
