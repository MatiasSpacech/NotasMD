import React from 'react';

export interface SuggestionItem {
  key: string;
  label: React.ReactNode;
  sub?: string;
}

interface AutocompletePanelProps {
  items: SuggestionItem[];
  activeIndex: number;
  onSelect: (index: number) => void;
  emptyText?: string;
}

/**
 * Dropdown genérico de autocompletado (Fase 7, item 48/50):
 * ↑↓ navegar · Tab/Enter aceptar · Esc cerrar.
 * Se usa para `[[wikilinks]]` y para snippets Markdown.
 */
export function AutocompletePanel({ items, activeIndex, onSelect, emptyText }: AutocompletePanelProps) {
  return (
    <div className="absolute left-2 top-11 z-20 w-72 max-h-56 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md shadow-xl py-1">
      {items.length === 0 ? (
        <p className="px-3 py-2 text-xs text-slate-500 italic">{emptyText ?? 'Sin coincidencias'}</p>
      ) : (
        items.map((item, i) => (
          <button
            key={item.key}
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(i);
            }}
            className={`flex flex-col w-full text-left px-3 py-1.5 text-sm ${
              i === activeIndex ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300' : 'text-slate-800 dark:text-slate-200'
            }`}
          >
            <span className="truncate">{item.label}</span>
            {item.sub && <span className="text-[11px] text-slate-500">{item.sub}</span>}
          </button>
        ))
      )}
      <p className="px-3 py-1 text-[11px] text-slate-500 border-t border-slate-200 dark:border-slate-700">
        ↑↓ navegar · Tab aceptar · Esc cerrar
      </p>
    </div>
  );
}

export default AutocompletePanel;
