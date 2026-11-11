/**
 * Lógica pura de los Consejos diarios: franjas horarias, elección sin repeticiones y
 * próxima franja. La comparten la app web y el puente con Android (que programa las
 * notificaciones nativas con las mismas reglas).
 */
import { BUILTIN_TIPS, TIP_CATEGORIES } from './content/tips.js';

export const CATEGORY_IDS = Object.keys(TIP_CATEGORIES);
export const FREQUENCIES = [
  { value: 15, label: 'Cada 15 minutos' },
  { value: 30, label: 'Cada 30 minutos' },
  { value: 60, label: 'Cada hora' },
  { value: 120, label: 'Cada 2 horas' },
  { value: 180, label: 'Cada 3 horas' },
  { value: 240, label: 'Cada 4 horas' },
  { value: 360, label: 'Cada 6 horas' },
  { value: 1440, label: 'Una vez al día' },
];

const toMinutes = (hhmm) => {
  const [h, m] = String(hhmm ?? '00:00').split(':').map(Number);
  return h * 60 + m;
};

const isoDay = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** Todos los consejos disponibles (incluidos + propios), filtrados por categorías preferidas. */
export function tipPool(customTips, categories = CATEGORY_IDS) {
  const wanted = new Set(categories.length ? categories : CATEGORY_IDS);
  const custom = customTips.map((t) => ({ id: t.id, category: t.category, text: t.text, source: 'propio', builtin: false }));
  return [...BUILTIN_TIPS, ...custom].filter((t) => wanted.has(t.category));
}

/**
 * Franja actual: { key, index, startsAt } o null si ahora no toca (desactivado, día no activo
 * o fuera del horario). La clave es estable para todo el intervalo: evita duplicados.
 */
export function currentSlot(now, settings) {
  if (!settings.enabled) return null;
  if (!settings.days.includes(now.getDay())) return null;
  const start = toMinutes(settings.startTime);
  const end = toMinutes(settings.endTime);
  const minutes = now.getHours() * 60 + now.getMinutes();
  if (minutes < start || minutes >= end) return null;
  const index = Math.floor((minutes - start) / settings.frequencyMinutes);
  const startsAt = new Date(now);
  startsAt.setHours(0, start + index * settings.frequencyMinutes, 0, 0);
  return { key: `${isoDay(now)}#${index}`, index, startsAt };
}

/** Próxima franja a partir de `now` (para mostrar «el próximo llega a las…»). Busca hasta 8 días. */
export function nextSlotTime(now, settings) {
  if (!settings.enabled || !settings.days.length) return null;
  const start = toMinutes(settings.startTime);
  const end = toMinutes(settings.endTime);
  if (end <= start) return null;
  for (let offset = 0; offset < 8; offset += 1) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    if (!settings.days.includes(day.getDay())) continue;
    for (let m = start; m < end; m += settings.frequencyMinutes) {
      const at = new Date(day);
      at.setHours(0, m, 0, 0);
      if (at > now) return at;
    }
  }
  return null;
}

/** Todas las franjas de los próximos `days` días (lo usa Android para programar alarmas). */
export function upcomingSlots(now, settings, days = 2) {
  const out = [];
  if (!settings.enabled) return out;
  const start = toMinutes(settings.startTime);
  const end = toMinutes(settings.endTime);
  for (let offset = 0; offset < days; offset += 1) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    if (!settings.days.includes(day.getDay())) continue;
    for (let m = start, index = 0; m < end; m += settings.frequencyMinutes, index += 1) {
      const at = new Date(day);
      at.setHours(0, m, 0, 0);
      if (at > now) out.push({ key: `${isoDay(day)}#${index}`, at });
    }
  }
  return out;
}

function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Elige el consejo de una franja. Determinista para la misma franja (dos pestañas eligen
 * el mismo) y sin repetir los mostrados recientemente: se excluyen los últimos
 * min(30, tamaño − 1) del historial.
 */
export function pickTip(pool, history, seedKey) {
  if (!pool.length) return null;
  const memory = Math.min(30, pool.length - 1);
  const recent = new Set(history.slice(-memory).map((h) => h.tipId));
  const candidates = pool.filter((t) => !recent.has(t.id));
  const list = candidates.length ? candidates : pool;
  return list[hash(seedKey) % list.length];
}

export function findTip(id, customTips) {
  return BUILTIN_TIPS.find((t) => t.id === id) ?? customTips.map((t) => ({ ...t, source: 'propio', builtin: false })).find((t) => t.id === id) ?? null;
}

export const HISTORY_LIMIT = 200;

/** Añade una entrada al historial respetando el límite. */
export function appendHistory(history, entry) {
  return [...history, entry].slice(-HISTORY_LIMIT);
}
