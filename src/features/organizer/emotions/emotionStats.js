/**
 * Cálculos del diario emocional. Describen los registros (cuántos, cuáles, con qué
 * intensidad); no deducen causas ni relaciones: con estos datos no se pueden demostrar.
 *
 * La intensidad se normaliza a 0–100 % según la escala con que se registró cada vez
 * (1–5 o 1–10), así cambiar la escala no altera el historial.
 */
import { addDays } from '../data/recurrence.js';
import { toISODate } from '../../../utils/dates.js';

export const intensityPercent = (log) => Math.round(((log.intensity - 1) / Math.max(1, log.scale - 1)) * 100);
export const dayOf = (log) => toISODate(new Date(log.at));

export function inRange(logs, from, to) {
  return logs.filter((log) => {
    const day = dayOf(log);
    return day >= from && day <= to;
  });
}

/** Cuántas veces aparece cada emoción (principal, y aparte como secundaria). */
export function distribution(logs) {
  const counts = new Map();
  for (const log of logs) {
    const entry = counts.get(log.primaryId) ?? { primary: 0, secondary: 0 };
    entry.primary += 1;
    counts.set(log.primaryId, entry);
    for (const id of log.secondaryIds) {
      const other = counts.get(id) ?? { primary: 0, secondary: 0 };
      other.secondary += 1;
      counts.set(id, other);
    }
  }
  return [...counts].map(([id, c]) => ({ id, ...c })).sort((a, b) => b.primary - a.primary || b.secondary - a.secondary);
}

/** Registros por tono (agradable, desagradable, mixta, neutra) según la emoción principal. */
export function byValence(logs, emotionsById) {
  const out = { pleasant: 0, unpleasant: 0, mixed: 0, neutral: 0 };
  for (const log of logs) out[emotionsById.get(log.primaryId)?.valence ?? 'neutral'] += 1;
  return out;
}

/**
 * Serie por intervalos entre `from` y `to`: número de registros, intensidad media (%) y
 * estado de ánimo medio (−2..2, solo de los registros que lo tienen).
 * `bucket`: 'day' | 'week' | 'month'.
 */
export function series(logs, from, to, bucket = 'day') {
  const keyOf = (day) => (bucket === 'month' ? day.slice(0, 7) : bucket === 'week' ? weekKey(day, from) : day);
  const buckets = new Map();
  for (let day = from; day <= to; day = addDays(day, 1)) {
    const key = keyOf(day);
    if (!buckets.has(key)) buckets.set(key, { key, from: day, count: 0, intensity: 0, moodSum: 0, moodCount: 0 });
  }
  for (const log of inRange(logs, from, to)) {
    const b = buckets.get(keyOf(dayOf(log)));
    b.count += 1;
    b.intensity += intensityPercent(log);
    if (log.mood !== null && log.mood !== undefined) {
      b.moodSum += log.mood;
      b.moodCount += 1;
    }
  }
  return [...buckets.values()].map((b) => ({
    key: b.key,
    from: b.from,
    count: b.count,
    intensity: b.count ? Math.round(b.intensity / b.count) : null,
    mood: b.moodCount ? Math.round((b.moodSum / b.moodCount) * 10) / 10 : null,
  }));
}

function weekKey(day, from) {
  const diff = Math.floor((Date.parse(day) - Date.parse(from)) / (7 * 86_400_000));
  return `w${diff}`;
}

/** Resumen comparable de un período. */
export function periodSummary(logs, from, to, emotionsById) {
  const list = inRange(logs, from, to);
  const days = new Set(list.map(dayOf));
  const top = distribution(list)[0];
  const moods = list.filter((l) => l.mood !== null && l.mood !== undefined);
  return {
    count: list.length,
    days: days.size,
    averageIntensity: list.length ? Math.round(list.reduce((s, l) => s + intensityPercent(l), 0) / list.length) : null,
    averageMood: moods.length ? Math.round((moods.reduce((s, l) => s + l.mood, 0) / moods.length) * 10) / 10 : null,
    topEmotionId: top?.id ?? null,
    valence: byValence(list, emotionsById),
  };
}

/** Tono predominante de cada día (para el calendario emocional). */
export function dayTones(logs, emotionsById) {
  const map = new Map();
  for (const log of logs) {
    const day = dayOf(log);
    const entry = map.get(day) ?? { count: 0, valence: { pleasant: 0, unpleasant: 0, mixed: 0, neutral: 0 }, colors: [] };
    entry.count += 1;
    const emotion = emotionsById.get(log.primaryId);
    entry.valence[emotion?.valence ?? 'neutral'] += 1;
    if (emotion) entry.colors.push(emotion.color);
    map.set(day, entry);
  }
  for (const entry of map.values()) {
    const [dominant, n] = Object.entries(entry.valence).sort((a, b) => b[1] - a[1])[0];
    const tie = Object.values(entry.valence).filter((v) => v === n).length > 1;
    entry.tone = tie ? 'mixed' : dominant;
  }
  return map;
}
