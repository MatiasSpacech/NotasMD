import React from 'react';
import { BookOpen, X } from 'lucide-react';
import { NotePreview } from './NotePreview';

interface HelpSection {
  title: string;
  syntax: string;
  example: string;
}

/**
 * Guía de sintaxis Markdown con ejemplos visuales (Fase 7, item 47).
 * Se muestra en el drawer lateral; abrir/cerrar con botón o Ctrl+?.
 */
export const HELP_SECTIONS: HelpSection[] = [
  {
    title: 'Encabezados',
    syntax: '# H1\n## H2\n### H3',
    example: '# Título 1\n## Título 2\n### Título 3',
  },
  {
    title: 'Texto',
    syntax: '**negrita** *cursiva* ~~tachado~~',
    example: '**negrita** *cursiva* ~~tachado~~',
  },
  {
    title: 'Listas',
    syntax: '- item\n1. primero\n- [ ] tarea',
    example: '- Manzanas\n- Peras\n\n1. Primero\n2. Segundo\n\n- [x] Hecha\n- [ ] Pendiente',
  },
  {
    title: 'Código',
    syntax: '`inline`\n```\nbloque\n```',
    example: 'Usa `npm run dev` para arrancar.\n\n```js\nconst x = 1;\n```',
  },
  {
    title: 'Enlaces y wikilinks',
    syntax: '[texto](https://url)\n[[nota]]\n[[nota|alias]]',
    example: '[OpenCode](https://opencode.ai)\n\n[[Mi Nota]] y [[Otra|alias]]',
  },
  {
    title: 'Citas',
    syntax: '> cita',
    example: '> Lo esencial es invisible a los ojos.',
  },
  {
    title: 'Tablas',
    syntax: '| A | B |\n|---|---|\n| 1 | 2 |',
    example: '| Nombre | Rol |\n|---|---|\n| Ana | Dev |\n| Luis | QA |',
  },
  {
    title: 'Separador',
    syntax: '---',
    example: 'Arriba\n\n---\n\nAbajo',
  },
];

interface MarkdownHelpProps {
  onClose: () => void;
}

export function MarkdownHelp({ onClose }: MarkdownHelpProps) {
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-200 dark:border-slate-700 shrink-0">
        <BookOpen size={15} className="text-amber-600 dark:text-amber-400" />
        <span className="text-sm font-medium text-slate-800 dark:text-slate-200">Ayuda Markdown</span>
        <span className="flex-1" />
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
          title="Cerrar ayuda (Ctrl+?)"
        >
          <X size={16} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 px-3 py-2">
        {HELP_SECTIONS.map((s) => (
          <section key={s.title} className="mb-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              {s.title}
            </h3>
            <pre className="text-[11px] font-mono bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md p-2 mb-1 overflow-x-auto text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
              {s.syntax}
            </pre>
            <div className="border border-slate-200 dark:border-slate-700 rounded-md overflow-hidden">
              <NotePreview content={s.example} knownTargets={[]} />
            </div>
          </section>
        ))}
        <p className="px-1 pb-3 text-[11px] text-slate-500">
          Atajos del editor: Ctrl+B negrita · Ctrl+I cursiva · Ctrl+S guardar · Ctrl+? esta ayuda.
          Escribe [[ para enlazar notas.
        </p>
      </div>
    </div>
  );
}

export default MarkdownHelp;
