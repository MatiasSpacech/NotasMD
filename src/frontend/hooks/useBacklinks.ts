import { useState, useEffect, useCallback } from 'react';
import type { Backlink } from '../components/BacklinksPanel';

const API = 'http://localhost:3001';

/**
 * Hook de backlinks (Fase 5): notas que referencian a la nota dada.
 */
export function useBacklinks(noteId: string | null) {
  const [backlinks, setBacklinks] = useState<Backlink[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBacklinks = useCallback(async (id: string): Promise<Backlink[]> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/notes/${encodeURIComponent(id)}/backlinks`);
      if (!res.ok) throw new Error('Error al obtener backlinks');
      const data = await res.json();
      const list: Backlink[] = data.backlinks ?? [];
      setBacklinks(list);
      return list;
    } catch (err: any) {
      setError(err.message);
      setBacklinks([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (noteId) fetchBacklinks(noteId);
    else setBacklinks([]);
  }, [noteId, fetchBacklinks]);

  return { backlinks, loading, error, refresh: fetchBacklinks };
}
