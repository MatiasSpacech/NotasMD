import React from 'react';

interface WikiLinkProps {
  /** Destino del enlace (sin [[ ]], sin alias) */
  target: string;
  /** Texto a mostrar (por defecto el destino) */
  children?: React.ReactNode;
  broken?: boolean;
  onOpen?: (target: string) => void;
}

/**
 * Wikilink clickeable (Fase 5, item 34).
 * Se renderiza como `<a>`; en rojo si está roto (item 36).
 */
export function WikiLink({ target, children, broken, onOpen }: WikiLinkProps) {
  return (
    <a
      href={`#wikilink-${encodeURIComponent(target)}`}
      onClick={(e) => {
        e.preventDefault();
        onOpen?.(target);
      }}
      className={broken ? 'wikilink broken-wikilink' : 'wikilink'}
      title={broken ? `Nota no encontrada: ${target}` : `Abrir ${target}`}
    >
      {children ?? target}
    </a>
  );
}

export default WikiLink;
