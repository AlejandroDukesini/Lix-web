/**
 * Cálculos del diario (puros y probados): recuerdos de años anteriores, resúmenes
 * por mes o año y navegación entre días con entradas.
 */
import { countWords } from '../shared/text.js';
import { tagCounts } from '../data/tags.js';

const visible = (entries) => entries.filter((e) => !e.trashedAt);

/** Entradas del mismo día y mes en años anteriores («En un día como hoy»). */
export function memoriesFor(entries, today) {
  const monthDay = today.slice(5);
  return visible(entries)
    .filter((e) => e.status === 'published' && e.eventDate.slice(5) === monthDay && e.eventDate < today.slice(0, 4))
    .sort((a, b) => b.eventDate.localeCompare(a.eventDate));
}

/** Resumen de un período (prefijo de fecha: «2026» o «2026-03»). */
export function summarize(entries, prefix) {
  const list = visible(entries).filter((e) => e.eventDate.startsWith(prefix));
  const days = new Set(list.map((e) => e.eventDate));
  const words = list.reduce((sum, e) => sum + countWords(`${e.title} ${e.body}`), 0);
  const byMonth = new Map();
  for (const e of list) byMonth.set(e.eventDate.slice(0, 7), (byMonth.get(e.eventDate.slice(0, 7)) ?? 0) + 1);
  const categories = new Map();
  for (const e of list) if (e.category) categories.set(e.category, (categories.get(e.category) ?? 0) + 1);
  // Racha más larga de días seguidos con al menos una entrada.
  const sorted = [...days].sort();
  let longest = 0;
  let run = 0;
  let previous = null;
  for (const day of sorted) {
    const consecutive = previous && Date.parse(day) - Date.parse(previous) === 86_400_000;
    run = consecutive ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = day;
  }
  return {
    entries: list.length,
    days: days.size,
    words,
    favorites: list.filter((e) => e.favorite).length,
    drafts: list.filter((e) => e.status === 'draft').length,
    longestStreak: longest,
    byMonth,
    tags: tagCounts(list).slice(0, 10),
    categories: [...categories].sort((a, b) => b[1] - a[1]),
  };
}

/** Día anterior y siguiente (con entradas) respecto a `date`. */
export function neighbourDays(entries, date) {
  const days = [...new Set(visible(entries).map((e) => e.eventDate))].sort();
  return {
    previous: days.filter((d) => d < date).at(-1) ?? null,
    next: days.find((d) => d > date) ?? null,
  };
}
