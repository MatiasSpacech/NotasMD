import { useState, useCallback } from 'react';

export interface FolderNode {
  id: string;
  name: string;
  path: string;
  parent: string | null;
  children: FolderNode[];
  noteCount: number;
}

const API = 'http://localhost:3001';

export function useFolders() {
  const [folders, setFolders] = useState<FolderNode[]>([]);
  const [total, setTotal] = useState(0);
  const [rootNotes, setRootNotes] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFolders = useCallback(async (): Promise<FolderNode[]> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/folders`);
      if (!res.ok) throw new Error('Error al listar carpetas');
      const data = await res.json();
      setFolders(data.folders ?? []);
      setTotal(data.total ?? 0);
      setRootNotes(data.rootNotes ?? 0);
      return data.folders ?? [];
    } catch (err: any) {
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const createFolder = useCallback(
    async (nameOrPath: string, parent?: string): Promise<boolean> => {
      try {
        const body =
          parent && !nameOrPath.includes('/')
            ? { name: nameOrPath, parent }
            : { path: nameOrPath };
        const res = await fetch(`${API}/api/folders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? 'Error al crear carpeta');
        }
        await fetchFolders();
        return true;
      } catch (err: any) {
        setError(err.message);
        return false;
      }
    },
    [fetchFolders],
  );

  const moveNote = useCallback(async (noteId: string, folder: string): Promise<boolean> => {
    try {
      const res = await fetch(`${API}/api/folders/move`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteId, folder }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Error al mover nota');
      }
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    }
  }, []);

  const moveFolder = useCallback(async (source: string, target: string): Promise<boolean> => {
    try {
      const res = await fetch(`${API}/api/folders/move`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, target }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Error al mover carpeta');
      }
      await fetchFolders();
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    }
  }, [fetchFolders]);

  const deleteFolder = useCallback(
    async (id: string, force = false): Promise<boolean> => {
      try {
        const res = await fetch(`${API}/api/folders/${encodeURIComponent(id)}${force ? '?force=true' : ''}`, {
          method: 'DELETE',
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? 'Error al eliminar carpeta');
        }
        await fetchFolders();
        return true;
      } catch (err: any) {
        setError(err.message);
        return false;
      }
    },
    [fetchFolders],
  );

  return {
    folders,
    total,
    rootNotes,
    loading,
    error,
    fetchFolders,
    refresh: fetchFolders,
    createFolder,
    moveNote,
    moveFolder,
    deleteFolder,
  };
}
