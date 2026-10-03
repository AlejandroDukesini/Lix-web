/**
 * Persistencia del Game Center sobre la base de datos local de la app.
 *
 * Usa el store `games` de IndexedDB (migración v2 de services/storage/database.js):
 *  - una entrada por juego, con clave = id del juego (`aquapark`, `chess`…);
 *  - una entrada especial `__center__` con las preferencias del Game Center (sonido).
 *
 * Cada registro lleva `version`; `normalizeRecord` migra y valida lo leído, de modo
 * que un dato dañado nunca rompe la interfaz: se sustituye por valores válidos.
 * Si IndexedDB no está disponible (modo privado estricto), se usa un almacén en
 * memoria durante la sesión y `isGameStoragePersistent()` lo indica.
 *
 * "Borrar todos los datos" (Configuración) elimina la base de datos completa,
 * y con ella también estas estadísticas.
 */
import { dbEntries, dbGet, dbPut, isIndexedDBAvailable, STORES } from '../../../services/storage/database.js';

export const RECORD_VERSION = 1;
export const CENTER_KEY = '__center__';

const memory = new Map();
let persistent = true;
const listeners = new Set();
// Cola por clave: las escrituras de un mismo juego se aplican en orden (leer → modificar → guardar).
const queues = new Map();

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const finite = (value, fallback = 0) => (Number.isFinite(value) && value >= 0 ? value : fallback);
const isoOrNull = (value) => (typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : null);

export function createEmptyRecord(gameId) {
  return {
    version: RECORD_VERSION,
    gameId,
    plays: 0,
    completions: 0,
    totalTimeMs: 0,
    firstPlayedAt: null,
    lastPlayedAt: null,
    // Mejores marcas por clave propia de cada juego, p. ej. { 'circuit:bahia': 61234 }.
    best: {},
    // Progreso específico del juego (niveles superados, victorias por dificultad…).
    progress: {},
    // Preferencias del juego (dificultad elegida, último modo…).
    settings: {},
  };
}

export const DEFAULT_CENTER_SETTINGS = Object.freeze({ version: 1, sound: true, volume: 0.6 });

/** Migra y valida un registro leído del almacenamiento. Nunca lanza. */
export function normalizeRecord(raw, gameId) {
  const base = createEmptyRecord(gameId);
  if (!isObject(raw)) return base;
  // v1 es la primera versión: las futuras migraciones se encadenan aquí (if (raw.version < 2) …).
  const best = {};
  if (isObject(raw.best)) {
    for (const [key, value] of Object.entries(raw.best)) if (Number.isFinite(value)) best[key] = value;
  }
  return {
    ...base,
    plays: Math.floor(finite(raw.plays)),
    completions: Math.floor(finite(raw.completions)),
    totalTimeMs: finite(raw.totalTimeMs),
    firstPlayedAt: isoOrNull(raw.firstPlayedAt),
    lastPlayedAt: isoOrNull(raw.lastPlayedAt),
    best,
    progress: isObject(raw.progress) ? raw.progress : {},
    settings: isObject(raw.settings) ? raw.settings : {},
  };
}

export function normalizeCenterSettings(raw) {
  if (!isObject(raw)) return { ...DEFAULT_CENTER_SETTINGS };
  const volume = Number.isFinite(raw.volume) ? Math.min(1, Math.max(0, raw.volume)) : DEFAULT_CENTER_SETTINGS.volume;
  return { version: 1, sound: typeof raw.sound === 'boolean' ? raw.sound : true, volume };
}

async function readRaw(key) {
  if (persistent && isIndexedDBAvailable()) {
    try {
      return await dbGet(STORES.games, key);
    } catch (error) {
      if (import.meta.env.DEV) console.warn('[games] IndexedDB no disponible; se usa memoria.', error);
      persistent = false;
    }
  } else {
    persistent = false;
  }
  return memory.get(key);
}

async function writeRaw(key, value) {
  memory.set(key, value);
  if (!persistent || !isIndexedDBAvailable()) {
    persistent = false;
    return false;
  }
  try {
    await dbPut(STORES.games, key, value);
    return true;
  } catch (error) {
    if (import.meta.env.DEV) console.warn('[games] No se pudo guardar; se conserva en memoria.', error);
    persistent = false;
    return false;
  }
}

function emit(key, value) {
  for (const listener of listeners) listener(key, value);
}

function enqueue(key, task) {
  const previous = queues.get(key) ?? Promise.resolve();
  const next = previous.then(task, task);
  queues.set(key, next.catch(() => {}));
  return next;
}

export function isGameStoragePersistent() {
  return persistent && isIndexedDBAvailable();
}

export function subscribeGameStorage(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function readGameRecord(gameId) {
  return normalizeRecord(await readRaw(gameId), gameId);
}

/** Todos los registros de juegos conocidos: { [gameId]: record }. */
export async function readAllGameRecords() {
  let entries = [];
  if (persistent && isIndexedDBAvailable()) {
    try {
      entries = await dbEntries(STORES.games);
    } catch {
      persistent = false;
    }
  }
  if (!persistent) entries = [...memory.entries()];
  const records = {};
  for (const [key, value] of entries) {
    if (typeof key === 'string' && key !== CENTER_KEY) records[key] = normalizeRecord(value, key);
  }
  return records;
}

/** Aplica `updater(record) → record` de forma atómica respecto a otras escrituras del mismo juego. */
export function updateGameRecord(gameId, updater) {
  return enqueue(gameId, async () => {
    const current = await readGameRecord(gameId);
    const next = normalizeRecord(updater(structuredClone(current)), gameId);
    await writeRaw(gameId, next);
    emit(gameId, next);
    return next;
  });
}

export async function readCenterSettings() {
  return normalizeCenterSettings(await readRaw(CENTER_KEY));
}

export function updateCenterSettings(patch) {
  return enqueue(CENTER_KEY, async () => {
    const next = normalizeCenterSettings({ ...(await readCenterSettings()), ...patch });
    await writeRaw(CENTER_KEY, next);
    emit(CENTER_KEY, next);
    return next;
  });
}

/**
 * Compara una marca con la guardada.
 * better: 'higher' (puntuaciones, distancias) | 'lower' (tiempos, movimientos).
 */
export function isBetter(value, previous, better) {
  if (!Number.isFinite(value)) return false;
  if (!Number.isFinite(previous)) return true;
  return better === 'lower' ? value < previous : value > previous;
}

/**
 * Registra el final de una partida y devuelve, por cada marca, si es récord
 * (comparada con lo que ya estaba guardado).
 *   result: { completed, durationMs, marks: [{ key, value, better }], progress?: (progress) => progress }
 */
export async function recordGameResult(gameId, { completed = false, durationMs = 0, marks = [], progress } = {}) {
  const outcome = {};
  const record = await updateGameRecord(gameId, (current) => {
    const next = current;
    if (completed) next.completions += 1;
    next.totalTimeMs += Math.min(Math.max(0, durationMs), 6 * 60 * 60 * 1000);
    for (const { key, value, better } of marks) {
      const previous = next.best[key];
      const record = isBetter(value, previous, better);
      outcome[key] = { value, previous: Number.isFinite(previous) ? previous : null, isRecord: record, best: record ? value : previous };
      if (record) next.best[key] = value;
    }
    if (progress) next.progress = progress(next.progress) ?? next.progress;
    return next;
  });
  return { record, marks: outcome };
}

/** Registra que empezó una partida (cuenta partidas y la fecha del último acceso). */
export function recordGameStart(gameId, now = new Date()) {
  return updateGameRecord(gameId, (record) => {
    record.plays += 1;
    record.lastPlayedAt = now.toISOString();
    record.firstPlayedAt ??= record.lastPlayedAt;
    return record;
  });
}

export function updateGameSettings(gameId, patch) {
  return updateGameRecord(gameId, (record) => {
    record.settings = { ...record.settings, ...patch };
    return record;
  });
}

/** Solo para pruebas. */
export function __resetGameStorageForTests() {
  memory.clear();
  queues.clear();
  persistent = true;
}
