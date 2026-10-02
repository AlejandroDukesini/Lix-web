/**
 * Base de datos local (IndexedDB) para datos estructurados.
 *
 * El esquema evoluciona mediante migraciones numeradas: la versión de la base
 * de datos es la cantidad de migraciones. Al abrirla, el navegador ejecuta
 * `onupgradeneeded` y aquí se aplican solo las migraciones pendientes, en orden.
 * Nunca se edita una migración ya publicada: los cambios se añaden al final.
 *
 * Cada módulo futuro (diario, notas, recordatorios, calendario, finanzas,
 * juegos) tendrá su propio object store para mantener sus datos separados.
 */

export const DB_NAME = 'un-ano-mas-contigo';

export const STORES = Object.freeze({
  meta: 'meta',
  backups: 'backups',
});

export const DB_MIGRATIONS = [
  // v1 — Fase 1: metadatos de la instalación y copia de seguridad de preferencias.
  (db) => {
    db.createObjectStore(STORES.meta);
    db.createObjectStore(STORES.backups);
  },
  // v2 (fase futura), por ejemplo:
  // (db) => {
  //   const journal = db.createObjectStore('journal', { keyPath: 'id' });
  //   journal.createIndex('byDate', 'date');
  // },
];

export const DB_VERSION = DB_MIGRATIONS.length;

let dbPromise = null;

function promisify(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function isIndexedDBAvailable() {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
}

export function openDatabase() {
  if (!isIndexedDBAvailable()) return Promise.reject(new Error('IndexedDB no está disponible'));
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      for (let version = event.oldVersion; version < DB_VERSION; version += 1) {
        DB_MIGRATIONS[version](db, request.transaction);
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      // Si otra pestaña abre una versión más nueva, se cierra esta conexión para no bloquearla.
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
    request.onblocked = () => {
      if (import.meta.env.DEV) console.warn('[db] Apertura bloqueada por otra pestaña con una versión anterior.');
    };
  });

  return dbPromise;
}

async function run(storeName, mode, operation) {
  const db = await openDatabase();
  const tx = db.transaction(storeName, mode);
  const result = await promisify(operation(tx.objectStore(storeName)));
  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  return result;
}

export function dbGet(storeName, key) {
  return run(storeName, 'readonly', (store) => store.get(key));
}

export function dbPut(storeName, key, value) {
  return run(storeName, 'readwrite', (store) => store.put(value, key));
}

export function dbDelete(storeName, key) {
  return run(storeName, 'readwrite', (store) => store.delete(key));
}

/** Borra la base de datos completa. Se usa solo en "Borrar todos los datos". */
export async function deleteDatabase() {
  if (!isIndexedDBAvailable()) return;
  if (dbPromise) {
    try {
      (await dbPromise).close();
    } catch {
      // La conexión nunca llegó a abrirse; no hay nada que cerrar.
    }
    dbPromise = null;
  }
  await promisify(indexedDB.deleteDatabase(DB_NAME));
}

/** Solo para pruebas. */
export function __resetDatabaseForTests() {
  dbPromise = null;
}
