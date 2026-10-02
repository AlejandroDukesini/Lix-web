/**
 * Utilidades de fecha. Las fechas "de calendario" (AAAA-MM-DD) se tratan como
 * días locales, no como instantes UTC: `new Date('2025-07-21')` sería medianoche
 * UTC y en Colombia mostraría el 20 de julio.
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DAY_MS = 86_400_000;

export function parseISODate(value) {
  if (typeof value !== 'string') return null;
  const match = ISO_DATE.exec(value);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(year, month - 1, day);
  // Rechaza fechas imposibles como 2025-02-31, que Date "corregiría" a marzo.
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

export function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseTime(value) {
  if (typeof value !== 'string') return null;
  const match = TIME.exec(value);
  return match ? { hours: Number(match[1]), minutes: Number(match[2]) } : null;
}

function dayNumber(date) {
  return Math.round(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS);
}

/** Días naturales completos entre dos fechas (ignora horas y cambios de horario). */
export function daysBetween(from, to) {
  return dayNumber(to) - dayNumber(from);
}

/**
 * Tiempo transcurrido desde `startISO` hasta `now` en años, meses y días.
 * Devuelve null si la fecha no es válida o está en el futuro: nunca se inventa una duración.
 */
export function relationshipDuration(startISO, now = new Date()) {
  const start = parseISODate(startISO);
  if (!start) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const totalDays = daysBetween(start, today);
  if (totalDays < 0) return null;

  let years = today.getFullYear() - start.getFullYear();
  let months = today.getMonth() - start.getMonth();
  let days = today.getDate() - start.getDate();
  if (days < 0) {
    months -= 1;
    days += new Date(today.getFullYear(), today.getMonth(), 0).getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return { years, months, days, totalDays };
}

/** Próximo aniversario (mismo día y mes). Si cae hoy, devuelve hoy. 29-feb → 28-feb en años no bisiestos. */
export function nextAnniversary(startISO, now = new Date()) {
  const start = parseISODate(startISO);
  if (!start) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (daysBetween(start, today) < 0) return null;

  const candidate = (year) => {
    const lastDay = new Date(year, start.getMonth() + 1, 0).getDate();
    return new Date(year, start.getMonth(), Math.min(start.getDate(), lastDay));
  };
  let date = candidate(today.getFullYear());
  if (daysBetween(today, date) < 0) date = candidate(today.getFullYear() + 1);
  return {
    date,
    daysLeft: daysBetween(today, date),
    yearsCompleting: date.getFullYear() - start.getFullYear(),
  };
}

export function celebrationMoment(year, time) {
  const parsed = parseTime(time) ?? { hours: 0, minutes: 0 };
  return new Date(year, 0, 1, parsed.hours, parsed.minutes, 0, 0);
}

export function countdown(target, now = new Date()) {
  const diff = target.getTime() - now.getTime();
  if (diff <= 0) return { passed: true, days: 0, hours: 0, minutes: 0, seconds: 0 };
  const seconds = Math.floor(diff / 1000);
  return {
    passed: false,
    days: Math.floor(seconds / 86_400),
    hours: Math.floor((seconds % 86_400) / 3600),
    minutes: Math.floor((seconds % 3600) / 60),
    seconds: seconds % 60,
  };
}

const longDate = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'long', year: 'numeric' });
const weekdayDate = new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'long' });

export function formatLongDate(dateOrISO) {
  const date = typeof dateOrISO === 'string' ? parseISODate(dateOrISO) : dateOrISO;
  return date ? longDate.format(date) : '';
}

export function formatWeekdayDate(date) {
  const text = weekdayDate.format(date);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function formatTime(date, hourCycle = '24') {
  return new Intl.DateTimeFormat('es', {
    hour: 'numeric',
    minute: '2-digit',
    hourCycle: hourCycle === '12' ? 'h12' : 'h23',
  }).format(date);
}

export function plural(count, singular, pluralForm = `${singular}s`) {
  return `${count.toLocaleString('es')} ${count === 1 ? singular : pluralForm}`;
}

export function formatDuration({ years, months, days }) {
  const parts = [];
  if (years) parts.push(plural(years, 'año'));
  if (months) parts.push(plural(months, 'mes', 'meses'));
  if (days || parts.length === 0) parts.push(plural(days, 'día'));
  if (parts.length === 1) return parts[0];
  return `${parts.slice(0, -1).join(', ')} y ${parts.at(-1)}`;
}

export function greetingFor(date) {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return 'Buenos días';
  if (hour >= 12 && hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
}
