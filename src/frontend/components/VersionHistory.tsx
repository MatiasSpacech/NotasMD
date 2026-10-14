import React, { useState, useEffect, useMemo } from 'react';
import { History, BookmarkPlus, RotateCcw, X, RefreshCw } from 'lucide-react';
import { useVersions, VersionDetail } from '../hooks/useVersions';
import { diffLines, formatVersionTimestamp } from '../lib/diff';
import { NotePreview } from './NotePreview';
import { ConfirmDialog } from './ConfirmDialog';

interface VersionHistoryProps {
  noteId: string;
  /** Contenido actual para el diff */
  currentContent: string;
  knownTargets?: string[];
  /** Tras restaurar (la App refresca notas) */
  onChanged?: () => void;
  onClose: () => void;
  notify?: (message: string, kind: 'success' | 'error' | 'info') => void;
}

/**
 * Historial de versiones (Fase 6, item 44):
 * timeline con fecha/hora, preview, diff vs actual, restaurar y bookmark manual.
 */
export function VersionHistory({ noteId, currentContent, knownTargets, onChanged, onClose, notify }: VersionHistoryProps) {
  const { versions, total, loading, error, fetchVersions, fetchVersion, createBookmark, restore } = useVersions(noteId);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<VersionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [tab, setTab] = useState<'preview' | 'diff'>('preview');
  const [busy, setBusy] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);

  // Reset al cambiar de nota (el hook ya refresca la lista)
  useEffect(() => {
    setSelected(null);
    setDetail(null);
    setTab('preview');
  }, [noteId]);

  const loadDetail = async (timestamp: string) => {
    setSelected(timestamp);
    setDetailLoading(true);
    const v = await fetchVersion(noteId, timestamp);
    setDetail(v);
    setDetailLoading(false);
  };

  const handleBookmark = async () => {
    setBusy(true);
    const ok = await createBookmark(noteId);
    setBusy(false);
    if (ok) notify?.('Versión manual creada', 'success');
  };

  const handleRestore = async () => {
    if (!selected) return;
    setConfirmRestore(true);
  };

  const confirmRestoreVersion = async () => {
    if (!selected) return;
    setConfirmRestore(false);
    setBusy(true);
    const ok = await restore(noteId, selected);
    setBusy(false);
    if (ok) {
      notify?.('Versión restaurada', 'success');
      onChanged?.();
    } else {
      notify?.('No se pudo restaurar la versión', 'error');
    }
  };

  const rows = useMemo(
    () => (detail ? diffLines(detail.content, currentContent) : []),
    [detail, currentContent],
  );
  const changedCount = useMemo(() => rows.filter((r) => r.type !== 'same').length, [rows]);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-200 dark:border-slate-700 shrink-0">
        <History size={15} className="text-amber-600 dark:text-amber-400" />
        <span className="text-sm font-medium text-slate-800 dark:text-slate-200">Historial</span>
        <span className="text-xs text-slate-500">({total})</span>
        <span className="flex-1" />
        <button
          onClick={() => fetchVersions(noteId)}
          aria-label="Recargar historial"
          className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
          title="Recargar"
        >
          <RefreshCw size={14} />
        </button>
        <button
          onClick={onClose}
          aria-label="Cerrar historial"
          className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
          title="Cerrar historial"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {loading && <p className="px-4 py-3 text-xs text-slate-500">Cargando versiones…</p>}
        {error && <p className="px-4 py-3 text-xs text-red-600 dark:text-red-400">{error}</p>}
        {!loading && !error && versions.length === 0 && (
          <p className="px-4 py-3 text-xs text-slate-500 italic">
            Sin versiones todavía. Se crea una automáticamente al guardar, o crea una manual.
          </p>
        )}

        {/* Timeline */}
        {versions.length > 0 && (
          <div className="px-2 py-2">
            {versions.map((v) => (
              <button
                key={v.timestamp}
                onClick={() => loadDetail(v.timestamp)}
className={`w-full text-left px-2 py-1.5 rounded-md transition-colors ${
                    selected === v.timestamp ? 'bg-amber-100 dark:bg-amber-500/15' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
              >
                <span className="flex items-center gap-1.5 text-sm text-slate-800 dark:text-slate-200">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      v.isBookmark ? 'bg-amber-500 dark:bg-amber-400' : 'bg-slate-500'
                    }`}
                  />
                  <span className="truncate">{formatVersionTimestamp(v.timestamp)}</span>
                  {v.isBookmark && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 rounded shrink-0">
                      manual
                    </span>
                  )}
                </span>
                {v.preview && <span className="block ml-3.5 mt-0.5 text-[11px] text-slate-500 truncate">{v.preview}</span>}
              </button>
            ))}
          </div>
        )}

        {/* Detalle */}
        {selected && (
          <div className="border-t border-slate-200 dark:border-slate-700 px-3 py-2">
            {detailLoading && <p className="text-xs text-slate-500">Cargando versión…</p>}
            {!detailLoading && !detail && (
              <p className="text-xs text-red-600 dark:text-red-400">No se pudo cargar la versión.</p>
            )}
            {!detailLoading && detail && (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400">{formatVersionTimestamp(detail.timestamp)}</span>
                  <span className="flex-1" />
                  <div className="flex rounded-md overflow-hidden border border-slate-300 dark:border-slate-700 text-xs">
                    <button
                      onClick={() => setTab('preview')}
                      className={`px-2 py-1 ${tab === 'preview' ? 'bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'}`}
                    >
                      Vista
                    </button>
                    <button
                      onClick={() => setTab('diff')}
                      className={`px-2 py-1 ${tab === 'diff' ? 'bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'}`}
                    >
                      Diff ({changedCount})
                    </button>
                  </div>
                </div>
                <button
                  onClick={handleRestore}
                  disabled={busy}
                  className="flex items-center gap-1.5 w-full justify-center px-3 py-1.5 mb-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-900 font-medium rounded-md text-sm transition-colors"
                >
                  <RotateCcw size={14} /> Restaurar esta versión
                </button>
                {tab === 'preview' ? (
                  <div className="border border-slate-300 dark:border-slate-700 rounded-md overflow-hidden">
                    <NotePreview content={detail.content} knownTargets={knownTargets} />
                  </div>
                ) : (
                  <pre className="text-[11px] leading-relaxed font-mono border border-slate-300 dark:border-slate-700 rounded-md p-2 overflow-x-auto whitespace-pre-wrap">
                    {rows.map((r, i) => (
                      <span
                        key={i}
                        className={
                          r.type === 'add'
                            ? 'block bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                            : r.type === 'del'
                              ? 'block bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
                              : 'block text-slate-500'
                        }
                      >
                        {r.type === 'add' ? '+' : r.type === 'del' ? '-' : ' '} {r.text || ' '}
                      </span>
                    ))}
                  </pre>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Footer: versión manual */}
      <div className="p-2 border-t border-slate-200 dark:border-slate-700 shrink-0">
        <button
          onClick={handleBookmark}
          disabled={busy}
          className="flex items-center gap-1.5 w-full justify-center px-3 py-1.5 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 text-slate-700 dark:text-slate-200 rounded-md text-sm transition-colors"
          title="Guardar el estado actual como versión manual"
        >
          <BookmarkPlus size={14} /> Crear versión manual
        </button>
      </div>
      <ConfirmDialog
        open={confirmRestore}
        title="Restaurar versión"
        message="¿Restaurar esta versión? Se guardará un bookmark del estado actual."
        confirmLabel="Restaurar"
        onConfirm={confirmRestoreVersion}
        onCancel={() => setConfirmRestore(false)}
      />
    </div>
  );
}

export default VersionHistory;
