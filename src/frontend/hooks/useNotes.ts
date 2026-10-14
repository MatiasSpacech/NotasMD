import { useState, useEffect, useCallback } from 'react';

export interface Note {
  id: string;
  title: string;
  folder: string;
  content: string;
  tags: string[];
  created: string;
  updated: string;
}

export function useNotes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('http://localhost:3001/api/notes');
      if (!res.ok) throw new Error('Failed to fetch notes');
      const data = await res.json();
      setNotes(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const createNote = useCallback(async (title: string, folder: string = ''): Promise<Note | null> => {
    try {
      const res = await fetch('http://localhost:3001/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, folder }),
      });
      if (!res.ok) throw new Error('Failed to create note');
      const note = await res.json();
      setNotes((prev) => [note, ...prev]);
      return note;
    } catch (err: any) {
      setError(err.message);
      return null;
    }
  }, []);

  const updateNote = useCallback(async (id: string, content: string): Promise<boolean> => {
    try {
      const res = await fetch(`http://localhost:3001/api/notes/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error('Failed to update note');
      await fetchNotes();
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    }
  }, [fetchNotes]);

  const deleteNote = useCallback(async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`http://localhost:3001/api/notes/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete note');
      setNotes((prev) => prev.filter((n) => n.id !== id));
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    }
  }, []);

  const searchNotes = useCallback(async (query: string): Promise<Note[]> => {
    try {
      const res = await fetch(`http://localhost:3001/api/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      return data.results ?? [];
    } catch (err: any) {
      setError(err.message);
      return [];
    }
  }, []);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  return { notes, loading, error, createNote, updateNote, deleteNote, searchNotes, refresh: fetchNotes };
}
