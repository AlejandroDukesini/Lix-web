/**
 * Etiquetas: no son entidades propias, viven en el campo `tags` de cada registro.
 * Estas operaciones las gestionan en bloque (renombrar, fusionar, quitar) sobre los
 * tipos indicados y en una sola transacción: nunca se borra el registro, solo la etiqueta.
 */
import { commit } from './store.js';

const same = (a, b) => a.toLocaleLowerCase('es') === b.toLocaleLowerCase('es');

/** Recuento de etiquetas de una lista de registros: [{ tag, count }] ordenado por uso. */
export function tagCounts(records, field = 'tags') {
  const counts = new Map();
  for (const record of records) {
    for (const tag of record[field] ?? []) {
      const key = [...counts.keys()].find((k) => same(k, tag)) ?? tag;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return [...counts].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'es'));
}

/** Renombra (o fusiona con otra existente) una etiqueta en todos los registros de `kinds`. */
export function renameTag(kinds, from, to, field = 'tags') {
  const target = to.trim();
  return commit((tx) => {
    let changed = 0;
    for (const kind of kinds) {
      for (const record of tx.list(kind)) {
        const list = record[field] ?? [];
        if (!list.some((t) => same(t, from))) continue;
        const next = [];
        for (const tag of list.map((t) => (same(t, from) ? target : t))) if (!next.some((t) => same(t, tag))) next.push(tag);
        tx.update(record.id, { [field]: next });
        changed += 1;
      }
    }
    return changed;
  });
}

export function removeTag(kinds, tag, field = 'tags') {
  return commit((tx) => {
    let changed = 0;
    for (const kind of kinds) {
      for (const record of tx.list(kind)) {
        const list = record[field] ?? [];
        if (!list.some((t) => same(t, tag))) continue;
        tx.update(record.id, { [field]: list.filter((t) => !same(t, tag)) });
        changed += 1;
      }
    }
    return changed;
  });
}
