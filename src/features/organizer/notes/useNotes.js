import { useMemo } from 'react';
import { useKind } from '../data/hooks.js';

/** Notas y sus estructuras (carpetas, categorías, colecciones) con índices. */
export function useNotes() {
  const notes = useKind('note');
  const folders = useKind('folder');
  const categories = useKind('noteCategory');
  const collections = useKind('collection');
  const events = useKind('event');
  return useMemo(() => {
    const foldersById = new Map(folders.map((f) => [f.id, f]));
    /** Carpetas en orden de árbol, con su profundidad (para selectores y listas). */
    const tree = [];
    const walk = (parentId, depth) => {
      for (const folder of folders.filter((f) => (f.parentId ?? null) === parentId).sort((a, b) => a.name.localeCompare(b.name, 'es'))) {
        tree.push({ folder, depth });
        walk(folder.id, depth + 1);
      }
    };
    walk(null, 0);
    // Carpetas cuyo padre ya no existe (p. ej. tras restaurar solo una parte): al nivel raíz.
    for (const folder of folders) if (folder.parentId && !foldersById.has(folder.parentId) && !tree.some((t) => t.folder.id === folder.id)) tree.push({ folder, depth: 0 });
    const descendants = (id) => {
      const out = new Set([id]);
      let grew = true;
      while (grew) {
        grew = false;
        for (const f of folders) if (f.parentId && out.has(f.parentId) && !out.has(f.id)) {
          out.add(f.id);
          grew = true;
        }
      }
      return out;
    };
    const path = (id) => {
      const parts = [];
      let cursor = foldersById.get(id);
      while (cursor && parts.length < 4) {
        parts.unshift(cursor.name);
        cursor = foldersById.get(cursor.parentId);
      }
      return parts.join(' › ');
    };
    return {
      notes,
      folders,
      categories,
      collections,
      events,
      foldersById,
      categoriesById: new Map(categories.map((c) => [c.id, c])),
      collectionsById: new Map(collections.map((c) => [c.id, c])),
      tree,
      descendants,
      path,
      folderOptions: tree.map(({ folder, depth }) => ({ value: folder.id, label: `${'   '.repeat(depth)}${folder.name}` })),
    };
  }, [notes, folders, categories, collections, events]);
}
