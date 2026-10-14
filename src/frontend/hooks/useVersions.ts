import { useState, useEffect, useCallback } from 'react';

export interface VersionMeta {
  timestamp: string;
  isBookmark: boolean;
  title: string;
  preview: string;
}

export interface VersionDetail {
  timestamp: string;
  content: string;
  frontmatter: {
    title: string;
    folder: string;
    created: string;
    updated: string;
    tags: string[];
  };
  isBookmark: boolean;
}

const API = 'http://localhost:3001';

/**
 * Hook del historial de versiones (Fase 6).
 */
export function useVersions(noteId: string | null) {
  const [versions, setVersions] = useState<VersionMeta[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchVersions = useCallback(async (id: string): Promise<VersionMeta[]> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/notes/${encodeURIComponent(id)}/versions`);
      if (!res.ok) throw new Error('Error al listar versiones');
      const data = await res.json();
      const list: VersionMeta[] = data.versions ?? [];
      setVersions(list);
      setTotal(data.total ?? list.length);
      return list;
    } catch (err: any) {
      setError(err.message);
      setVersions([]);
      setTotal(0);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchVersion = useCallback(async (id: string, timestamp: string): Promise<VersionDetail | null> => {
    try {
      const res = await fetch(
        `${API}/api/notes/${encodeURIComponent(id)}/versions/${encodeURIComponent(timestamp)}`,
      );
      if (!res.ok) return null;
      const data = await res.json();
      return data.version ?? null;
    } catch {
      return null;
    }
  }, []);

  const createBookmark = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const res = await fetch(`${API}/api/notes/${encodeURIComponent(id)}/versions`, {
          method: 'POST',
        });
        if (!res.ok) throw new Error('Error al crear versión manual');
        await fetchVersions(id);
        return true;
      } catch (err: any) {
        setError(err.message);
        return false;
      }
    },
    [fetchVersions],
  );

  const restore = useCallback(
    async (id: string, timestamp: string): Promise<boolean> => {
      try {
        const res = await fetch(
          `${API}/api/notes/${encodeURIComponent(id)}/versions/${encodeURIComponent(timestamp)}/restore`,
          { method: 'POST' },
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? 'Error al restaurar versión');
        }
        await fetchVersions(id);
        return true;
      } catch (err: any) {
        setError(err.message);
        return false;
      }
    },
    [fetchVersions],
  );

  useEffect(() => {
    if (noteId) fetchVersions(noteId);
    else {
      setVersions([]);
      setTotal(0);
    }
  }, [noteId, fetchVersions]);

  return { versions, total, loading, error, fetchVersions, fetchVersion, createBookmark, restore };
}
