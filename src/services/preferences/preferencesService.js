/**
 * Servicio de preferencias: única puerta entre la app y el almacenamiento.
 *
 * Doble persistencia:
 *  - localStorage (`uamc:preferences`): lectura síncrona al arrancar, sin parpadeos.
 *  - IndexedDB (`backups/preferences`): copia de seguridad. Si localStorage se
 *    borra o se corrompe pero IndexedDB sobrevive, las preferencias se recuperan.
 *
 * Ninguna función lanza excepciones hacia la interfaz: devuelven el resultado y
 * un estado que la interfaz puede mostrar.
 */
import { readJSON, writeJSON, removeKey, removeByPrefix, isPersistent } from '../storage/safeLocalStorage.js';
import { dbGet, dbPut, dbDelete, deleteDatabase, STORES } from '../storage/database.js';
import { createDefaultPreferences, PREFERENCES_SCHEMA_VERSION } from './defaults.js';
import { migratePreferences } from './migrations.js';
import { sanitizePreferences, isPlainObject } from './validation.js';

export const STORAGE_PREFIX = 'uamc:';
export const PREFERENCES_KEY = `${STORAGE_PREFIX}preferences`;
const BACKUP_KEY = 'preferences';
const EXPORT_FORMAT = 'un-ano-mas-contigo/preferences';

/**
 * Lee y valida las preferencias.
 * status: 'stored' | 'defaults' (no había nada) | 'repaired' (había datos inválidos o dañados)
 */
export function loadPreferences(now = new Date()) {
  const result = readJSON(PREFERENCES_KEY);

  if (!result.ok) {
    return { preferences: createDefaultPreferences(now), status: 'repaired', issues: [result.error] };
  }
  if (result.value === null) {
    return { preferences: createDefaultPreferences(now), status: 'defaults', issues: [] };
  }

  try {
    const { data } = migratePreferences(result.value);
    const { value, issues } = sanitizePreferences(data, now);
    return { preferences: value, status: issues.length ? 'repaired' : 'stored', issues };
  } catch (error) {
    if (import.meta.env.DEV) console.warn('[preferences] Migración fallida; se usan valores predeterminados.', error);
    return { preferences: createDefaultPreferences(now), status: 'repaired', issues: ['migration'] };
  }
}

/** Valida y guarda. Devuelve las preferencias realmente guardadas. */
export function savePreferences(preferences) {
  const { value } = sanitizePreferences({ ...preferences, updatedAt: new Date().toISOString() });
  const result = writeJSON(PREFERENCES_KEY, value);
  return { preferences: value, ok: result.ok, persistent: result.persistent && isPersistent() };
}

export function clearStoredPreferences() {
  removeKey(PREFERENCES_KEY);
}

// --- Copia de seguridad en IndexedDB -------------------------------------------

export async function backupPreferences(preferences) {
  try {
    await dbPut(STORES.backups, BACKUP_KEY, { savedAt: new Date().toISOString(), data: preferences });
    return true;
  } catch (error) {
    if (import.meta.env.DEV) console.warn('[preferences] No se pudo actualizar la copia en IndexedDB.', error);
    return false;
  }
}

export async function readPreferencesBackup(now = new Date()) {
  try {
    const backup = await dbGet(STORES.backups, BACKUP_KEY);
    if (!backup || !isPlainObject(backup.data)) return null;
    const { data } = migratePreferences(backup.data);
    return sanitizePreferences(data, now).value;
  } catch (error) {
    if (import.meta.env.DEV) console.warn('[preferences] No se pudo leer la copia en IndexedDB.', error);
    return null;
  }
}

export async function deletePreferencesBackup() {
  try {
    await dbDelete(STORES.backups, BACKUP_KEY);
  } catch (error) {
    if (import.meta.env.DEV) console.warn('[preferences] No se pudo borrar la copia en IndexedDB.', error);
  }
}

/** Registra la primera vez que se abrió la app (no es la fecha de la relación). */
export async function ensureInstallMetadata() {
  try {
    const existing = await dbGet(STORES.meta, 'firstOpenedAt');
    if (existing) return existing;
    const firstOpenedAt = new Date().toISOString();
    await dbPut(STORES.meta, 'firstOpenedAt', firstOpenedAt);
    return firstOpenedAt;
  } catch {
    return null;
  }
}

// --- Exportar / importar --------------------------------------------------------

export function serializeBackup(preferences) {
  return JSON.stringify(
    { format: EXPORT_FORMAT, exportedAt: new Date().toISOString(), schemaVersion: PREFERENCES_SCHEMA_VERSION, preferences },
    null,
    2,
  );
}

/** Interpreta un archivo exportado. Lanza un Error con mensaje legible si no es válido. */
export function parseBackup(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('El archivo no es un JSON válido.');
  }
  if (!isPlainObject(parsed) || parsed.format !== EXPORT_FORMAT || !isPlainObject(parsed.preferences)) {
    throw new Error('El archivo no es una copia de "Un año más contigo".');
  }
  const { data } = migratePreferences(parsed.preferences);
  const { value, issues } = sanitizePreferences(data);
  return { preferences: value, issues };
}

// --- Borrado total --------------------------------------------------------------

/**
 * Elimina todos los datos personales que la app guardó en este navegador
 * (localStorage e IndexedDB). La caché offline del Service Worker solo contiene
 * archivos de la aplicación, no datos personales, y se conserva.
 */
export async function deleteAllLocalData() {
  removeByPrefix(STORAGE_PREFIX);
  await deleteDatabase();
}
