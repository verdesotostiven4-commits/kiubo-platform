"use client";

import { useRef, useState } from "react";

/** Local, per-record transactions. Never roll back an unrelated successful edit. */
export function useOptimisticList<T extends { id: string }>(initialItems: T[]) {
  const [items, setItems] = useState(initialItems);
  const current = useRef(initialItems);
  const locks = useRef(new Set<string>());
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  function commit(next: T[]) {
    current.current = next;
    setItems(next);
  }
  function lock(id: string) {
    if (locks.current.has(id)) return false;
    locks.current.add(id);
    setPendingIds(new Set(locks.current));
    setError(null);
    return true;
  }
  function unlock(id: string) {
    locks.current.delete(id);
    setPendingIds(new Set(locks.current));
  }
  function failed() {
    setError("No se pudo confirmar el cambio. Restauramos el estado anterior; revisa tu conexión e inténtalo de nuevo.");
  }

  async function add(item: T, save: () => Promise<T>): Promise<boolean> {
    if (!lock(item.id)) return false;
    commit([item, ...current.current]);
    try {
      const saved = await save();
      commit(current.current.map((row) => row.id === item.id ? saved : row));
      return true;
    } catch {
      commit(current.current.filter((row) => row.id !== item.id));
      failed();
      return false;
    } finally { unlock(item.id); }
  }

  async function update(id: string, patch: Partial<T>, save: () => Promise<Partial<T> | void>): Promise<boolean> {
    const previous = current.current.find((row) => row.id === id);
    if (!previous || !lock(id)) return false;
    commit(current.current.map((row) => row.id === id ? { ...row, ...patch } : row));
    try {
      const saved = await save();
      if (saved) commit(current.current.map((row) => row.id === id ? { ...row, ...saved } : row));
      return true;
    } catch {
      commit(current.current.map((row) => row.id === id ? previous : row));
      failed();
      return false;
    } finally { unlock(id); }
  }

  async function remove(id: string, save: () => Promise<void>): Promise<boolean> {
    const index = current.current.findIndex((row) => row.id === id);
    if (index < 0 || !lock(id)) return false;
    const previous = current.current[index];
    commit(current.current.filter((row) => row.id !== id));
    try {
      await save();
      return true;
    } catch {
      const restored = [...current.current];
      restored.splice(Math.min(index, restored.length), 0, previous);
      commit(restored);
      failed();
      return false;
    } finally { unlock(id); }
  }

  return { items, error, clearError: () => setError(null), pendingCount: pendingIds.size,
    isPending: (id: string) => pendingIds.has(id), add, update, remove };
}
