/**
 * Acceso a localStorage que nunca lanza excepciones hacia la interfaz.
 *
 * localStorage puede fallar por: modo privado, almacenamiento lleno, políticas
 * del navegador o un iframe sin permisos. En esos casos se usa un almacén en
 * memoria para que la app siga funcionando durante la sesión, y `isPersistent()`
 * permite avisar de que los cambios no sobrevivirán al cierre.
 */

const memory = new Map();
let available = null;

function probe() {
  if (available !== null) return available;
  try {
    const key = '__uamc_probe__';
    window.localStorage.setItem(key, '1');
    window.localStorage.removeItem(key);
    available = true;
  } catch {
    available = false;
  }
  return available;
}

export function isPersistent() {
  return probe();
}

export function readJSON(key) {
  let raw;
  try {
    raw = probe() ? window.localStorage.getItem(key) : (memory.get(key) ?? null);
  } catch (error) {
    return { ok: false, value: null, error: 'unreadable', cause: error };
  }
  if (raw === null) return { ok: true, value: null };
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch (error) {
    return { ok: false, value: null, error: 'corrupted', cause: error };
  }
}

export function writeJSON(key, value) {
  const raw = JSON.stringify(value);
  if (!probe()) {
    memory.set(key, raw);
    return { ok: true, persistent: false };
  }
  try {
    window.localStorage.setItem(key, raw);
    return { ok: true, persistent: true };
  } catch (error) {
    // Cuota excedida u otra restricción: se conserva en memoria para esta sesión.
    memory.set(key, raw);
    return { ok: false, persistent: false, error: 'write-failed', cause: error };
  }
}

export function removeKey(key) {
  memory.delete(key);
  if (!probe()) return;
  try {
    window.localStorage.removeItem(key);
  } catch (error) {
    if (import.meta.env.DEV) console.warn('[storage] No se pudo eliminar la clave', key, error);
  }
}

/** Elimina todas las claves de la app (prefijo `uamc:`) sin tocar otras. */
export function removeByPrefix(prefix) {
  for (const key of [...memory.keys()]) if (key.startsWith(prefix)) memory.delete(key);
  if (!probe()) return;
  const keys = [];
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (key && key.startsWith(prefix)) keys.push(key);
  }
  keys.forEach((key) => window.localStorage.removeItem(key));
}

/** Solo para pruebas: reinicia la detección de disponibilidad. */
export function __resetForTests() {
  available = null;
  memory.clear();
}
