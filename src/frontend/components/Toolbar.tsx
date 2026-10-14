import React from 'react';
import {
  Bold,
  Italic,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Code,
  Link as LinkIcon,
  Braces,
  SeparatorHorizontal,
  Table as TableIcon,
  Link2,
  Sparkles,
} from 'lucide-react';

/** Acciones de formato que el Toolbar delega al editor. */
export type ToolbarAction =
  | 'bold'
  | 'italic'
  | 'strikethrough'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'ul'
  | 'ol'
  | 'task'
  | 'quote'
  | 'inlineCode'
  | 'codeBlock'
  | 'link'
  | 'wikilink'
  | 'table'
  | 'hr'
  | 'format';

interface ToolbarProps {
  onAction: (action: ToolbarAction) => void;
}

type Item =
  | { type: 'separator' }
  | { type: 'button'; action: ToolbarAction; icon: React.ReactNode; title: string };

const ITEMS: Item[] = [
  { type: 'button', action: 'bold', icon: <Bold size={16} />, title: 'Negrita (Ctrl+B) — **texto**' },
  { type: 'button', action: 'italic', icon: <Italic size={16} />, title: 'Cursiva (Ctrl+I) — *texto*' },
  { type: 'button', action: 'strikethrough', icon: <Strikethrough size={16} />, title: 'Tachado — ~~texto~~' },
  { type: 'separator' },
  { type: 'button', action: 'h1', icon: <Heading1 size={16} />, title: 'Encabezado 1 — # ' },
  { type: 'button', action: 'h2', icon: <Heading2 size={16} />, title: 'Encabezado 2 — ## ' },
  { type: 'button', action: 'h3', icon: <Heading3 size={16} />, title: 'Encabezado 3 — ### ' },
  { type: 'separator' },
  { type: 'button', action: 'ul', icon: <List size={16} />, title: 'Lista desordenada — - ' },
  { type: 'button', action: 'ol', icon: <ListOrdered size={16} />, title: 'Lista ordenada — 1. ' },
  { type: 'button', action: 'task', icon: <CheckSquare size={16} />, title: 'Tarea — - [ ] ' },
  { type: 'button', action: 'quote', icon: <Quote size={16} />, title: 'Cita — > ' },
  { type: 'separator' },
  { type: 'button', action: 'inlineCode', icon: <Code size={16} />, title: 'Código inline — `código`' },
  { type: 'button', action: 'codeBlock', icon: <Braces size={16} />, title: 'Bloque de código — ```' },
  { type: 'button', action: 'link', icon: <LinkIcon size={16} />, title: 'Enlace — [texto](url)' },
  { type: 'button', action: 'wikilink', icon: <Link2 size={16} />, title: 'Wikilink — [[nota]]' },
  { type: 'button', action: 'table', icon: <TableIcon size={16} />, title: 'Tabla — | Header |' },
  { type: 'button', action: 'hr', icon: <SeparatorHorizontal size={16} />, title: 'Separador — ---' },
  { type: 'separator' },
  { type: 'button', action: 'format', icon: <Sparkles size={16} />, title: 'Auto-formatear Markdown (Ctrl+Shift+F)' },
];

/**
 * Barra de formato Markdown (Fase 4).
 * Presentacional: emite `onAction` y el editor aplica el cambio.
 */
export function Toolbar({ onAction }: ToolbarProps) {
  return (
    <div className="h-10 bg-slate-100 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 flex items-center px-2 gap-1 shrink-0 overflow-x-auto">
      {ITEMS.map((item, i) => {
        if (item.type === 'separator') {
          return <div key={`sep-${i}`} className="w-px h-5 bg-slate-300 dark:bg-slate-700 mx-1 shrink-0" />;
        }
        return (
          <button
            key={item.action}
            onClick={() => onAction(item.action)}
            aria-label={item.title.split(' — ')[0]}
            className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 transition-colors shrink-0"
            title={item.title}
          >
            <span aria-hidden="true">{item.icon}</span>
          </button>
        );
      })}
    </div>
  );
}

export default Toolbar;
