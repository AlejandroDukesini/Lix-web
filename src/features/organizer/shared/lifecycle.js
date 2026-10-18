/**
 * Ciclo de vida de textos (notas y entradas del diario):
 *   activo → archivado (fuera de la lista, se puede desarchivar)
 *   activo/archivado → papelera (trashedAt; se puede restaurar)
 *   papelera → eliminado definitivamente (con confirmación; nunca automático)
 */
import { commit } from '../data/store.js';

export const moveToTrash = (id) => commit((tx) => tx.update(id, { trashedAt: new Date().toISOString(), pinned: false }));
export const restoreFromTrash = (id) => commit((tx) => tx.update(id, { trashedAt: null }));
export const setArchived = (id, archived) => commit((tx) => tx.update(id, { archived }));

/** Vacía la papelera de un tipo: elimina (con sus reglas de integridad) lo que esté en ella. */
export function emptyTrash(kind) {
  return commit((tx) => {
    let count = 0;
    for (const record of tx.list(kind)) {
      if (!record.trashedAt) continue;
      tx.remove(record.id);
      count += 1;
    }
    return count;
  });
}

/** Estado visible de un texto según la vista. */
export function inView(record, view) {
  if (view === 'trash') return Boolean(record.trashedAt);
  if (record.trashedAt) return false;
  if (view === 'archived') return record.archived;
  if (record.archived) return false;
  if (view === 'favorites') return record.favorite;
  if (view === 'pinned') return record.pinned;
  return true;
}
