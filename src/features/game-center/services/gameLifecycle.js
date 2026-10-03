/**
 * Ciclo de vida común de una partida.
 *
 *   READY ──start──▶ PLAYING ──pause──▶ PAUSED ──resume──▶ PLAYING
 *                      │                  │
 *                      ├──complete──▶ COMPLETED
 *                      └──gameOver──▶ GAME_OVER        (reset ▶ READY desde cualquiera)
 *
 * Es una utilidad, no una obligación: el ajedrez, por ejemplo, no usa PAUSED.
 * Un juego puede definir estados propios además de estos.
 */

export const GAME_STATUS = Object.freeze({
  READY: 'ready',
  PLAYING: 'playing',
  PAUSED: 'paused',
  COMPLETED: 'completed',
  GAME_OVER: 'game_over',
});

const { READY, PLAYING, PAUSED, COMPLETED, GAME_OVER } = GAME_STATUS;

export const TRANSITIONS = Object.freeze({
  start: { from: [READY, COMPLETED, GAME_OVER], to: PLAYING },
  pause: { from: [PLAYING], to: PAUSED },
  resume: { from: [PAUSED], to: PLAYING },
  complete: { from: [PLAYING], to: COMPLETED },
  gameOver: { from: [PLAYING], to: GAME_OVER },
  reset: { from: [READY, PLAYING, PAUSED, COMPLETED, GAME_OVER], to: READY },
});

/** Devuelve el nuevo estado, o el mismo si la transición no es válida desde `status`. */
export function transition(status, action) {
  const rule = TRANSITIONS[action];
  if (!rule || !rule.from.includes(status)) return status;
  return rule.to;
}

export const isFinished = (status) => status === COMPLETED || status === GAME_OVER;

/** Formatea milisegundos como m:ss.d (cronómetros). */
export function formatTime(ms, { decimals = 1 } = {}) {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const totalTenths = Math.floor(ms / (decimals ? 100 : 1000));
  const unit = decimals ? 10 : 1;
  const minutes = Math.floor(totalTenths / (60 * unit));
  const seconds = Math.floor((totalTenths % (60 * unit)) / unit);
  const tenths = totalTenths % unit;
  return `${minutes}:${String(seconds).padStart(2, '0')}${decimals ? `.${tenths}` : ''}`;
}

/** Duración larga legible: "1 h 12 min", "4 min", "35 s". */
export function formatPlayTime(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '0 min';
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds} s`;
  const minutes = Math.floor(totalSeconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours} h ${minutes % 60} min`;
}

/** "hoy", "ayer", "hace 3 días", o la fecha. */
export function formatLastPlayed(iso, now = new Date()) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const startOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(date)) / 86_400_000);
  if (days <= 0) return 'hoy';
  if (days === 1) return 'ayer';
  if (days < 7) return `hace ${days} días`;
  return date.toLocaleDateString('es', { day: 'numeric', month: 'short' });
}

/** Generador pseudoaleatorio con semilla (mulberry32): partidas reproducibles y comprobables. */
export function createRng(seed = 1) {
  let a = seed >>> 0 || 1;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.range = (min, max) => min + next() * (max - min);
  next.int = (min, max) => Math.floor(min + next() * (max - min + 1));
  next.pick = (list) => list[Math.floor(next() * list.length)];
  return next;
}
