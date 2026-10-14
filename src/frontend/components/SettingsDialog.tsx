import React, { useState, useEffect } from 'react';

interface SettingsDialogProps {
  open: boolean;
  darkMode: boolean;
  onSetDarkMode: (v: boolean) => void;
  onClose: () => void;
  /** Refrescar notas/carpetas tras cambiar la carpeta o versiones */
  onSaved: () => void | Promise<void>;
  notify: (message: string, kind: 'success' | 'error' | 'info') => void;
}

interface ConfigState {
  noteFolder: string;
  maxVersions: number;
  historyFolder: string;
  writable: boolean;
  noteCount: number;
  isValid: boolean;
}

const PREVIEW_KEY = 'notas-preview-default';
const BACKLINKS_KEY = 'notas-backlinks-default';

function readPref(key: string): boolean | null {
  try {
    const v = window.localStorage.getItem(key);
    if (v === '1') return true;
    if (v === '0') return false;
  } catch {
    // almacenamiento no disponible
  }
  return null;
}

/**
 * Diálogo de configuración:
 * - Carpeta donde se guardan los .md (POST /api/config { noteFolder })
 * - Máximo de versiones por nota (POST /api/config { maxVersions })
 * - Extras locales: tema, vista previa / backlinks por defecto, reset de layout
 */
export function SettingsDialog({
  open,
  darkMode,
  onSetDarkMode,
  onClose,
  onSaved,
  notify,
}: SettingsDialogProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<ConfigState | null>(null);
  const [noteFolder, setNoteFolder] = useState('');
  const [maxVersions, setMaxVersions] = useState(50);
  const [error, setError] = useState<string | null>(null);
  const [previewDefault, setPreviewDefault] = useState(true);
  const [backlinksDefault, setBacklinksDefault] = useState(true);

  // Cargar config del backend + prefs locales al abrir
  useEffect(() => {
    if (!open) return;
    setError(null);
    setPreviewDefault(readPref(PREVIEW_KEY) ?? true);
    setBacklinksDefault(readPref(BACKLINKS_KEY) ?? true);
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch('http://localhost:3001/api/config');
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error ?? 'No se pudo cargar la configuración');
          return;
        }
        setConfig({
          noteFolder: data.noteFolder ?? '',
          maxVersions: data.maxVersions ?? 50,
          historyFolder: data.historyFolder ?? '',
          writable: Boolean(data.writable),
          noteCount: Number(data.noteCount ?? 0),
          isValid: Boolean(data.isValid),
        });
        setNoteFolder(data.noteFolder ?? '');
        setMaxVersions(Number(data.maxVersions ?? 50));
      } catch {
        setError('No se pudo conectar con el backend');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [open ]);

  // Cerrar con Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const folderChanged = config !== null && noteFolder.trim() !== config.noteFolder;
  const versionsChanged = config !== null && Number(maxVersions) !== config.maxVersions;

  const handleSave = async () => {
    const trimmed = noteFolder.trim();
    if (!trimmed) {
      setError('La carpeta no puede estar vacía');
      return;
    }
    const versions = Number(maxVersions);
    if (!Number.isInteger(versions) || versions < 1 || versions > 500) {
      setError('Máx. versiones debe ser un entero entre 1 y 500');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('http://localhost:3001/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteFolder: trimmed, maxVersions: versions }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.details ? `${data.error}: ${data.details}` : (data.error ?? 'No se pudo guardar'));
        return;
      }
      // Prefs locales (se aplican al arrancar la app)
      try {
        window.localStorage.setItem(PREVIEW_KEY, previewDefault ? '1' : '0');
        window.localStorage.setItem(BACKLINKS_KEY, backlinksDefault ? '1' : '0');
      } catch {
        // almacenamiento no disponible
      }
      setConfig({
        noteFolder: data.noteFolder ?? trimmed,
        maxVersions: data.maxVersions ?? versions,
        historyFolder: data.historyFolder ?? config?.historyFolder ?? '',
        writable: Boolean(data.writable),
        noteCount: Number(data.noteCount ?? config?.noteCount ?? 0),
        isValid: Boolean(data.isValid),
      });
      notify('Configuración guardada', 'success');
      await onSaved();
      onClose();
    } catch {
      setError('No se pudo conectar con el backend');
    } finally {
      setSaving(false);
    }
  };

  const handleResetLayout = () => {
    try {
      window.localStorage.removeItem('notas-sidebar-width');
      window.localStorage.removeItem('notas-preview-width');
      notify('Anchos restablecidos (recarga la página para verlo)', 'info');
    } catch {
      notify('No se pudo restablecer el layout', 'error');
    }
  };

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/60"
      onClick={onClose}
      data-testid="settings-dialog-backdrop"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Configuración"
        data-testid="settings-dialog"
        className="w-[440px] max-w-[94%] max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-2xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-4">
          <h2 className="font-semibold text-slate-900 dark:text-slate-100">Configuración</h2>
          <span className="ml-auto text-[11px] text-slate-400">Ctrl+,</span>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Cargando…</p>
        ) : (
          <>
            {/* Almacenamiento */}
            <section className="mb-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
                Almacenamiento
              </h3>
              <label
                htmlFor="settings-note-folder"
                className="block text-xs text-slate-500 dark:text-slate-400 mb-1"
              >
                Carpeta donde se guardan los .md
              </label>
              <input
                id="settings-note-folder"
                data-testid="settings-note-folder"
                value={noteFolder}
                onChange={(e) => setNoteFolder(e.target.value)}
                placeholder="C:\Users\...\Notas"
                spellCheck={false}
                className="w-full px-3 py-1.5 mb-1 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
              />
              {config && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  {config.noteCount} nota(s) ·{' '}
                  {config.writable ? (
                    <span className="text-emerald-600 dark:text-emerald-400">escribible ✓</span>
                  ) : (
                    <span className="text-red-600 dark:text-red-400">NO escribible</span>
                  )}
                  {config.historyFolder && (
                    <>
                      <br />
                      Historial: <span className="font-mono break-all">{config.historyFolder}</span>
                    </>
                  )}
                  {folderChanged && (
                    <>
                      <br />
                      <span className="text-amber-600 dark:text-amber-400">
                        Al guardar se cambia la carpeta y se recargan las notas.
                      </span>
                    </>
                  )}
                </p>
              )}
            </section>

            {/* Versiones */}
            <section className="mb-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
                Historial de versiones
              </h3>
              <label
                htmlFor="settings-max-versions"
                className="block text-xs text-slate-500 dark:text-slate-400 mb-1"
              >
                Máximo de versiones por nota (1–500)
              </label>
              <input
                id="settings-max-versions"
                data-testid="settings-max-versions"
                type="number"
                min={1}
                max={500}
                step={1}
                value={maxVersions}
                onChange={(e) => setMaxVersions(Number(e.target.value))}
                className="w-32 px-3 py-1.5 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
              />
              {versionsChanged && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                  Se aplicará a las nuevas versiones guardadas.
                </p>
              )}
            </section>

            {/* Apariencia */}
            <section className="mb-5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
                Apariencia
              </h3>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm text-slate-700 dark:text-slate-300">Tema</span>
                <div className="ml-auto flex rounded-md overflow-hidden border border-slate-300 dark:border-slate-600">
                  <button
                    onClick={() => onSetDarkMode(false)}
                    aria-pressed={!darkMode}
                    className={`px-3 py-1 text-sm ${!darkMode ? 'bg-amber-500 text-slate-900 font-medium' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                  >
                    Claro
                  </button>
                  <button
                    onClick={() => onSetDarkMode(true)}
                    aria-pressed={darkMode}
                    className={`px-3 py-1 text-sm ${darkMode ? 'bg-amber-500 text-slate-900 font-medium' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                  >
                    Oscuro
                  </button>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 mb-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={previewDefault}
                  onChange={(e) => setPreviewDefault(e.target.checked)}
                  className="accent-amber-500"
                />
                Mostrar vista previa al arrancar
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={backlinksDefault}
                  onChange={(e) => setBacklinksDefault(e.target.checked)}
                  className="accent-amber-500"
                />
                Mostrar backlinks al arrancar
              </label>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Estas dos opciones se aplican al recargar la página.
              </p>
            </section>

            {/* Layout */}
            <section className="mb-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
                Diseño
              </h3>
              <button
                onClick={handleResetLayout}
                className="px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-md transition-colors"
              >
                Restablecer anchos de paneles
              </button>
            </section>

            {error && (
              <p role="alert" className="text-xs text-red-600 dark:text-red-400 mb-2">
                {error}
              </p>
            )}
          </>
        )}

        <div className="flex gap-2 justify-end mt-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 rounded-md"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            data-testid="settings-save"
            className="px-3 py-1.5 text-sm bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-900 font-medium rounded-md"
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default SettingsDialog;
