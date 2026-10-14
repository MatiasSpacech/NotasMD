import React, { useState, useEffect } from 'react';
import { X, FilePlus2 } from 'lucide-react';
import { TEMPLATES, NoteTemplate } from '../lib/templates';

interface TemplatePickerProps {
  open: boolean;
  busy?: boolean;
  onClose: () => void;
  onPick: (template: NoteTemplate, title: string) => void;
}

/**
 * Modal para crear una nota desde una plantilla (Fase 7, item 49).
 */
export function TemplatePicker({ open, busy, onClose, onPick }: TemplatePickerProps) {
  const [templateId, setTemplateId] = useState('blank');
  const [title, setTitle] = useState('');

  useEffect(() => {
    if (open) {
      const t = TEMPLATES.find((x) => x.id === templateId) ?? TEMPLATES[0];
      setTitle(t.defaultTitle());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open ]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const selectTemplate = (id: string) => {
    setTemplateId(id);
    const t = TEMPLATES.find((x) => x.id === id) ?? TEMPLATES[0];
    setTitle(t.defaultTitle());
  };

  const confirm = () => {
    const t = TEMPLATES.find((x) => x.id === templateId) ?? TEMPLATES[0];
    const finalTitle = title.trim() || t.defaultTitle();
    onPick(t, finalTitle);
  };

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="w-[440px] max-w-[92%] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-2xl p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-3">
          <FilePlus2 size={16} className="text-amber-600 dark:text-amber-400" />
          <span className="font-medium text-slate-800 dark:text-slate-200">Nueva nota</span>
          <span className="flex-1" />
          <button onClick={onClose} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500 dark:text-slate-400" title="Cerrar" aria-label="Cerrar">
            <X size={16} />
          </button>
        </div>

        <label htmlFor="template-title" className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Título</label>
        <input
          autoFocus
          id="template-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') confirm();
          }}
          className="w-full px-3 py-1.5 mb-3 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
          placeholder="Título de la nota"
        />

        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Plantilla</p>
        <div className="grid grid-cols-1 gap-1.5 mb-4 max-h-64 overflow-y-auto">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => selectTemplate(t.id)}
              className={`text-left px-3 py-2 rounded-md border transition-colors ${
                templateId === t.id
                  ? 'border-amber-500 bg-amber-500/10'
                  : 'border-slate-300 hover:border-slate-400 dark:border-slate-700 dark:hover:border-slate-500'
              }`}
            >
              <span className="block text-sm text-slate-900 dark:text-slate-100">{t.name}</span>
              <span className="block text-xs text-slate-500">{t.description}</span>
            </button>
          ))}
        </div>

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            disabled={busy}
            className="px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700 disabled:opacity-50 rounded-md"
          >
            Cancelar
          </button>
          <button
            onClick={confirm}
            disabled={busy}
            className="px-3 py-1.5 text-sm bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-900 font-medium rounded-md"
          >
            {busy ? 'Creando…' : 'Crear nota'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default TemplatePicker;
