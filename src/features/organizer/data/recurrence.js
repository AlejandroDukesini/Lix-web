/**
 * Repeticiones (eventos, pagos periódicos) sobre fechas de calendario AAAA-MM-DD.
 *
 * Regla: { freq: 'daily'|'weekly'|'monthly'|'yearly', interval ≥ 1, until?: fecha,
 *          count?: número total de repeticiones, weekdays?: [0–6] (solo semanal; 0 = domingo) }
 *
 * Las ocurrencias se calculan siempre desde la fecha inicial (nunca sumando sobre
 * la anterior), así un día 31 mensual no «deriva» hacia el 28: en los meses que no
 * tienen ese día cae en el último día del mes y vuelve al 31 en cuanto puede. El
 * 29 de febrero anual cae el 28 en los años no bisiestos.
 *
 * Todo se calcula con números de día en UTC: los cambios de horario no afectan.
 */
import { isValidDate, parseShape, int, oneOf, date } from './fields.js';

export const FREQUENCIES = Object.freeze(['daily', 'weekly', 'monthly', 'yearly']);
export const MAX_OCCURRENCES = 1000;
const DAY = 86_400_000;

export function dayNumber(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / DAY);
}

export function fromDayNumber(n) {
  const date = new Date(n * DAY);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

export function addDays(iso, days) {
  return fromDayNumber(dayNumber(iso) + days);
}

/** Día de la semana (0 = domingo) de una fecha AAAA-MM-DD. */
export function weekdayOf(iso) {
  // El día 0 (1970-01-01) fue jueves.
  return (((dayNumber(iso) + 4) % 7) + 7) % 7;
}

/** Suma meses conservando el día cuando existe y, si no, usando el último día del mes. */
export function addMonthsClamped(iso, months) {
  const [y, m, d] = iso.split('-').map(Number);
  const total = y * 12 + (m - 1) + months;
  const year = Math.floor(total / 12);
  const month = total - year * 12;
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}

function monthsBetween(a, b) {
  const [ay, am] = a.split('-').map(Number);
  const [by, bm] = b.split('-').map(Number);
  return (by - ay) * 12 + (bm - am);
}

const RULE_SHAPE = {
  freq: oneOf(FREQUENCIES, 'weekly', 'La frecuencia'),
  interval: int({ min: 1, max: 99, fallback: 1, label: 'El intervalo' }),
  until: date({ label: 'La fecha final' }),
  count: int({ min: 1, max: MAX_OCCURRENCES, label: 'El número de repeticiones' }),
  weekdays: (raw) => {
    if (raw === undefined || raw === null) return { value: [], error: null };
    if (!Array.isArray(raw)) return { value: [], error: 'Los días de la semana no son válidos.' };
    return { value: [...new Set(raw.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort(), error: null };
  },
};

/** Validador de campo para una regla opcional (null = no se repite). */
export function recurrence() {
  return (raw) => {
    if (raw === undefined || raw === null || raw === '') return { value: null, error: null };
    if (typeof raw !== 'object' || Array.isArray(raw)) return { value: null, error: 'La repetición no es válida.' };
    const { value, errors } = parseShape(RULE_SHAPE, raw);
    if (value.freq !== 'weekly') value.weekdays = [];
    if (value.interval === null) value.interval = 1;
    return { value, error: errors ? Object.values(errors)[0] : null };
  };
}

/**
 * Todas las ocurrencias de la regla entre `from` y `to` (inclusive), como fechas.
 * Sin regla, la única ocurrencia es la fecha inicial.
 */
export function occurrencesBetween(start, rule, from, to) {
  if (!isValidDate(start) || !isValidDate(from) || !isValidDate(to) || from > to) return [];
  if (!rule) return start >= from && start <= to ? [start] : [];
  const end = rule.until && rule.until < to ? rule.until : to;
  if (end < start) return [];
  const out = [];
  const interval = Math.max(1, rule.interval || 1);
  const limit = rule.count ?? Infinity;
  let ordinal = 0;

  const push = (iso) => {
    ordinal += 1;
    if (iso >= from && iso <= end) out.push(iso);
  };

  if (rule.freq === 'weekly' && rule.weekdays?.length) {
    const startDay = dayNumber(start);
    const startWeekday = weekdayOf(start);
    const monday = startDay - ((startWeekday + 6) % 7);
    // Orden dentro de la semana empezando en lunes, para que «lunes y domingo» salgan en orden.
    const offsets = rule.weekdays.map((d) => (d + 6) % 7).sort((a, b) => a - b);
    let week = 0;
    // Sin límite por número, se salta directamente a la primera semana del rango.
    if (!Number.isFinite(limit)) {
      const skip = Math.floor((dayNumber(from) - monday) / 7 / interval) - 1;
      if (skip > 0) week = skip;
    }
    for (let guard = 0; guard < 5000; guard += 1, week += 1) {
      const base = monday + week * interval * 7;
      if (fromDayNumber(base) > end) break;
      for (const offset of offsets) {
        const day = base + offset;
        if (day < startDay) continue;
        const iso = fromDayNumber(day);
        if (iso > end || ordinal >= limit) return out;
        push(iso);
      }
    }
    return out;
  }

  const nth = (n) => {
    if (rule.freq === 'daily') return fromDayNumber(dayNumber(start) + n * interval);
    if (rule.freq === 'weekly') return fromDayNumber(dayNumber(start) + n * interval * 7);
    if (rule.freq === 'monthly') return addMonthsClamped(start, n * interval);
    return addMonthsClamped(start, n * interval * 12);
  };

  let n = 0;
  if (!Number.isFinite(limit) && from > start) {
    // Salto aproximado hasta justo antes del rango (sin recorrer años de ocurrencias).
    if (rule.freq === 'daily') n = Math.floor((dayNumber(from) - dayNumber(start)) / interval);
    else if (rule.freq === 'weekly') n = Math.floor((dayNumber(from) - dayNumber(start)) / (7 * interval));
    else if (rule.freq === 'monthly') n = Math.floor(monthsBetween(start, from) / interval);
    else n = Math.floor(monthsBetween(start, from) / (12 * interval));
    n = Math.max(0, n - 1);
  }
  ordinal = n;
  for (let guard = 0; guard < 5000; guard += 1, n += 1) {
    if (ordinal >= limit) break;
    const iso = nth(n);
    if (iso > end) break;
    push(iso);
  }
  return out;
}

/** ¿Es `iso` una de las ocurrencias de la regla? */
export function isOccurrence(start, rule, iso) {
  return occurrencesBetween(start, rule, iso, iso).length === 1;
}

/** Primera ocurrencia en `from` o después (hasta 10 años de búsqueda), o null si la serie terminó. */
export function nextOccurrence(start, rule, from) {
  const horizon = addMonthsClamped(from, 120);
  const [first] = occurrencesBetween(start, rule, from, horizon).slice(0, 1);
  return first ?? null;
}

/** Última ocurrencia de la serie (null si no termina). */
export function lastOccurrence(start, rule) {
  if (!rule) return start;
  if (!rule.until && !rule.count) return null;
  const to = rule.until ?? addMonthsClamped(start, 12 * 100);
  return occurrencesBetween(start, rule, start, to).at(-1) ?? null;
}

const WEEKDAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const UNITS = {
  daily: ['día', 'días'],
  weekly: ['semana', 'semanas'],
  monthly: ['mes', 'meses'],
  yearly: ['año', 'años'],
};

function joinList(items) {
  return items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} y ${items.at(-1)}`;
}

/** Descripción legible: «Cada 2 semanas los lunes y jueves, hasta el 2026-12-12». */
export function describeRule(rule, formatDate = (iso) => iso) {
  if (!rule) return 'No se repite';
  const [one, many] = UNITS[rule.freq];
  let text = rule.interval > 1 ? `Cada ${rule.interval} ${many}` : `Cada ${one}`;
  if (rule.freq === 'weekly' && rule.weekdays?.length) {
    text += ` los ${joinList([...rule.weekdays].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => WEEKDAY_NAMES[d]))}`;
  }
  if (rule.until) text += `, hasta el ${formatDate(rule.until)}`;
  else if (rule.count) text += `, ${rule.count} ${rule.count === 1 ? 'vez' : 'veces'}`;
  return text;
}
