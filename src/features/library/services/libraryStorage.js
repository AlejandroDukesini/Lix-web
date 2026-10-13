/**
 * Persistencia de la biblioteca: favoritos, progreso de lectura, marcadores y
 * ajustes de lectura (tamaño del texto).
 *
 * Usa el store `library` de IndexedDB (migración v3 de services/storage/database.js)
 * con una única entrada, `state`. Todo lo leído pasa por `normalizeLibraryState`:
 * un dato dañado nunca rompe el lector, se sustituye por valores válidos. Si
 * IndexedDB no está disponible, se usa memoria durante la sesión.
 *
 * Los documentos en sí no se guardan aquí: forman parte de la app y los precachea
 * el Service Worker. "Borrar todos los datos" elimina este estado con la base de datos.
 */
import { dbGet, dbPut, isIndexedDBAvailable, STORES } from '../../../services/storage/database.js';

export const LIBRARY_STATE_VERSION = 1;
const KEY = 'state';
const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
export const FONT_SCALES = Object.freeze([0.9, 1, 1.1, 1.2, 1.3]);
export const MAX_BOOKMARKS = 200;

let memory = null;
let persistent = true;
let queue = Promise.resolve();
const listeners = new Set();

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isoOrNull = (value) => (typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : null);
const clamp01 = (value) => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0);

export function createEmptyLibraryState() {
  return {
    version: LIBRARY_STATE_VERSION,
    favorites: [],
    // { [docId]: { percent: 0–1, section, updatedAt, finishedAt } }
    progress: {},
    // [{ docId, sectionId, sectionTitle, createdAt }] — el más reciente primero.
    bookmarks: [],
    settings: { fontScale: 1 },
  };
}

/** Migra y valida un estado leído o importado. Nunca lanza. Devuelve { value, issues }. */
export function sanitizeLibraryState(raw) {
  const base = createEmptyLibraryState();
  const issues = [];
  if (!isObject(raw)) return { value: base, issues: raw === undefined || raw === null ? [] : ['library'] };

  if (Array.isArray(raw.favorites)) {
    base.favorites = [...new Set(raw.favorites.filter((id) => typeof id === 'string' && ID.test(id)))];
  } else if (raw.favorites !== undefined) issues.push('library.favorites');

  if (isObject(raw.progress)) {
    for (const [id, entry] of Object.entries(raw.progress)) {
      if (!ID.test(id) || !isObject(entry)) {
        issues.push(`library.progress.${id}`);
        continue;
      }
      base.progress[id] = {
        percent: clamp01(entry.percent),
        section: typeof entry.section === 'string' && ID.test(entry.section) ? entry.section : null,
        updatedAt: isoOrNull(entry.updatedAt),
        finishedAt: isoOrNull(entry.finishedAt),
      };
    }
  } else if (raw.progress !== undefined) issues.push('library.progress');

  if (Array.isArray(raw.bookmarks)) {
    const seen = new Set();
    for (const mark of raw.bookmarks) {
      if (!isObject(mark) || !ID.test(mark.docId ?? '') || !ID.test(mark.sectionId ?? '')) {
        issues.push('library.bookmarks');
        continue;
      }
      const key = `${mark.docId}#${mark.sectionId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      base.bookmarks.push({
        docId: mark.docId,
        sectionId: mark.sectionId,
        sectionTitle: typeof mark.sectionTitle === 'string' ? mark.sectionTitle.slice(0, 160) : '',
        createdAt: isoOrNull(mark.createdAt) ?? new Date(0).toISOString(),
      });
    }
    base.bookmarks = base.bookmarks.slice(0, MAX_BOOKMARKS);
  } else if (raw.bookmarks !== undefined) issues.push('library.bookmarks');

  if (isObject(raw.settings) && FONT_SCALES.includes(raw.settings.fontScale)) {
    base.settings.fontScale = raw.settings.fontScale;
  }
  return { value: base, issues };
}

export const normalizeLibraryState = (raw) => sanitizeLibraryState(raw).value;

async function readRaw() {
  if (persistent && isIndexedDBAvailable()) {
    try {
      return await dbGet(STORES.library, KEY);
    } catch (error) {
      if (import.meta.env.DEV) console.warn('[library] IndexedDB no disponible; se usa memoria.', error);
      persistent = false;
    }
  } else persistent = false;
  return memory;
}

async function writeRaw(value) {
  memory = value;
  if (!persistent || !isIndexedDBAvailable()) {
    persistent = false;
    return;
  }
  try {
    await dbPut(STORES.library, KEY, value);
  } catch (error) {
    if (import.meta.env.DEV) console.warn('[library] No se pudo guardar; se conserva en memoria.', error);
    persistent = false;
  }
}

export function isLibraryStoragePersistent() {
  return persistent && isIndexedDBAvailable();
}

export function subscribeLibrary(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function readLibraryState() {
  await queue;
  return normalizeLibraryState(await readRaw());
}

/** Aplica `updater(state) → state` en orden respecto a otras escrituras y avisa a la interfaz. */
export function updateLibraryState(updater) {
  const task = async () => {
    const current = normalizeLibraryState(await readRaw());
    const next = normalizeLibraryState(updater(structuredClone(current)) ?? current);
    await writeRaw(next);
    for (const listener of listeners) listener(next);
    return next;
  };
  const next = queue.then(task, task);
  queue = next.catch(() => {});
  return next;
}

// --- Acciones ------------------------------------------------------------------------

export function toggleFavorite(docId) {
  return updateLibraryState((state) => {
    state.favorites = state.favorites.includes(docId) ? state.favorites.filter((id) => id !== docId) : [docId, ...state.favorites];
    return state;
  });
}

/**
 * Guarda por dónde va la lectura. `percent` es la posición actual (0–1); un
 * documento queda «leído» al llegar al final y no deja de estarlo si se vuelve arriba.
 */
export function saveProgress(docId, { percent, section }, now = new Date()) {
  return updateLibraryState((state) => {
    const previous = state.progress[docId];
    const value = clamp01(percent);
    state.progress[docId] = {
      percent: value,
      section: section ?? previous?.section ?? null,
      updatedAt: now.toISOString(),
      finishedAt: previous?.finishedAt ?? (value >= 0.97 ? now.toISOString() : null),
    };
    return state;
  });
}

export function toggleBookmark(docId, sectionId, sectionTitle, now = new Date()) {
  return updateLibraryState((state) => {
    const exists = state.bookmarks.some((m) => m.docId === docId && m.sectionId === sectionId);
    state.bookmarks = exists
      ? state.bookmarks.filter((m) => !(m.docId === docId && m.sectionId === sectionId))
      : [{ docId, sectionId, sectionTitle, createdAt: now.toISOString() }, ...state.bookmarks];
    return state;
  });
}

export function setFontScale(fontScale) {
  return updateLibraryState((state) => {
    if (FONT_SCALES.includes(fontScale)) state.settings.fontScale = fontScale;
    return state;
  });
}

// --- Copias de seguridad ---------------------------------------------------------------

export async function exportLibraryData() {
  return readLibraryState();
}

export async function restoreLibraryData(value) {
  await updateLibraryState(() => value);
}

/** Solo para pruebas. */
export function __resetLibraryStorageForTests() {
  memory = null;
  persistent = true;
  queue = Promise.resolve();
  listeners.clear();
}
