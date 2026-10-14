import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  extractWikilinks,
  findBrokenWikilinks,
  normalizePath,
} from '../lib/wikilink-parser';
import { WikiLink } from './WikiLink';
import { AlertTriangle } from 'lucide-react';

interface NotePreviewProps {
  content: string;
  /** Títulos/ids conocidos para detectar wikilinks rotos */
  knownTargets?: string[];
  /** Al hacer click en un wikilink [[nota]] */
  onWikilinkClick?: (target: string) => void;
}

/** Los wikilinks se reescriben como enlaces fragmento para que react-markdown los acepte */
const WIKILINK_PREFIX = '#wikilink-';

function withWikilinksAsLinks(content: string): string {
  return content.replace(/\[\[([^\]]+)\]\]/g, (_m, inner: string) => {
    const parts = String(inner).split('|');
    const target = (parts[0] ?? '').trim();
    const display = ((parts[1] ?? '').trim() || target || 'nota')
      .replace(/[\[\]]/g, '')
      .slice(0, 200);
    return `[${display || 'nota'}](${WIKILINK_PREFIX}${encodeURIComponent(target)})`;
  });
}

/**
 * Preview renderizada con GFM (Fase 4):
 * tablas, tareas, tachado, código, citas + wikilinks clickeables.
 */
export function NotePreview({ content, knownTargets, onWikilinkClick }: NotePreviewProps) {
  const brokenSet = useMemo(
    () => new Set(findBrokenWikilinks(content, knownTargets ?? []).map(normalizePath)),
    [content, knownTargets],
  );
  const brokenList = useMemo(() => extractWikilinks(content).filter((w) => brokenSet.has(normalizePath(w))), [content, brokenSet]);
  const markdown = useMemo(() => withWikilinksAsLinks(content), [content]);

  if (!content.trim()) {
    return (
      <div className="p-4 md-preview">
        <p className="text-slate-500 text-sm italic">Sin contenido — escribe en el editor.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md-preview">
      {brokenList.length > 0 && (
        <div className="mb-4 p-2 bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-800 rounded text-xs text-red-700 dark:text-red-400 flex items-center gap-1.5">
          <AlertTriangle size={14} aria-hidden="true" className="shrink-0" />
          <span>Wikilinks rotos: {brokenList.join(', ')}</span>
        </div>
      )}
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          a: ({ href, children }: any) => {
            if (typeof href === 'string' && href.startsWith(WIKILINK_PREFIX)) {
              const target = decodeURIComponent(href.slice(WIKILINK_PREFIX.length));
              const broken = brokenSet.has(normalizePath(target.split('|')[0]?.trim() || target));
              return (
                <WikiLink target={target} broken={broken} onOpen={onWikilinkClick}>
                  {children}
                </WikiLink>
              );
            }
            return (
              <a href={href} target="_blank" rel="noreferrer">
                {children}
              </a>
            );
          },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          table: ({ children }: any) => (
            <div className="overflow-x-auto">
              <table>{children}</table>
            </div>
          ),
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}

export default NotePreview;
