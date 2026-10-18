/** Formatos de fecha y hora de la organización (siempre en español y en hora local). */
import { parseISODate, toISODate } from '../../../utils/dates.js';

export const todayISO = (now = new Date()) => toISODate(now);

/** Hora local AAAA-MM-DDTHH:MM para inputs datetime-local. */
export function toLocalDateTimeInput(iso) {
  const date = iso ? new Date(iso) : new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromLocalDateTimeInput(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

const cache = new Map();
function fmt(options) {
  const key = JSON.stringify(options);
  if (!cache.has(key)) cache.set(key, new Intl.DateTimeFormat('es', options));
  return cache.get(key);
}

const asDate = (value) => (value instanceof Date ? value : typeof value === 'string' && value.length === 10 ? parseISODate(value) : new Date(value));

/** «12 mar» (o «12 mar 2025» si no es de este año). */
export function shortDate(value, now = new Date()) {
  const date = asDate(value);
  if (!date || Number.isNaN(date.getTime())) return '';
  const sameYear = date.getFullYear() === now.getFullYear();
  return fmt(sameYear ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' }).format(date).replace('.', '');
}

/** «martes, 12 de marzo de 2026». */
export function longDate(value) {
  const date = asDate(value);
  if (!date || Number.isNaN(date.getTime())) return '';
  return fmt({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

/** «mar. 12 mar» para encabezados de día. */
export function dayHeading(value) {
  const date = asDate(value);
  if (!date) return '';
  const text = fmt({ weekday: 'long', day: 'numeric', month: 'long' }).format(date);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function monthLabel(isoMonth) {
  const [y, m] = isoMonth.split('-').map(Number);
  const text = fmt({ month: 'long', year: 'numeric' }).format(new Date(y, m - 1, 1));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatClock(hhmm, hourCycle = '24') {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  return fmt({ hour: 'numeric', minute: '2-digit', hourCycle: hourCycle === '12' ? 'h12' : 'h23' }).format(new Date(2000, 0, 1, h, m));
}

export function dateTimeLabel(iso, hourCycle = '24') {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${shortDate(date)}, ${fmt({ hour: 'numeric', minute: '2-digit', hourCycle: hourCycle === '12' ? 'h12' : 'h23' }).format(date)}`;
}

/** «hace 5 min», «hace 3 h», «ayer», o la fecha corta. */
export function relativeTime(iso, now = new Date()) {
  const date = new Date(iso);
  const diff = (now.getTime() - date.getTime()) / 1000;
  if (Number.isNaN(diff)) return '';
  if (diff < 45) return 'hace un momento';
  if (diff < 3600) return `hace ${Math.round(diff / 60)} min`;
  if (diff < 86400 && date.getDate() === now.getDate()) return `hace ${Math.round(diff / 3600)} h`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (toISODate(date) === toISODate(yesterday)) return 'ayer';
  return shortDate(date, now);
}

/** Días entre hoy y una fecha: «hoy», «mañana», «en 3 días», «hace 2 días». */
export function daysFromToday(iso, today = todayISO()) {
  const a = parseISODate(today);
  const b = parseISODate(iso);
  if (!a || !b) return '';
  const days = Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000);
  if (days === 0) return 'hoy';
  if (days === 1) return 'mañana';
  if (days === -1) return 'ayer';
  return days > 0 ? `en ${days} días` : `hace ${-days} días`;
}

export function minutesLabel(minutes) {
  if (minutes === 0) return 'A la hora';
  if (minutes < 60) return `${minutes} min antes`;
  if (minutes < 1440) return `${minutes / 60} h antes`;
  if (minutes === 10080) return '1 semana antes';
  const days = minutes / 1440;
  return `${days} ${days === 1 ? 'día' : 'días'} antes`;
}

export const PRIORITY_LABELS = { low: 'Baja', normal: 'Normal', high: 'Alta' };
