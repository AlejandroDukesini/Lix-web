/**
 * Base de datos local (IndexedDB) para datos estructurados.
 *
 * El esquema evoluciona mediante migraciones numeradas: la versión de la base
 * de datos es la cantidad de migraciones. Al abrirla, el navegador ejecuta
 * `onupgradeneeded` y aquí se aplican solo las migraciones pendientes, en orden.
 * Nunca se edita una migración ya publicada: los cambios se añaden al final.
 *
 * Juegos y biblioteca tienen su propio store. La organización personal (finanzas,
 * calendario, notas, diario y diario emocional) comparte el store `organizer` para
 * que una operación que toca varias entidades se guarde en una sola transacción.
 */

export const DB_NAME = 'un-ano-mas-contigo';

export const STORES = Object.freeze({
  meta: 'meta',
  backups: 'backups',
  games: 'games',
  library: 'library',
  organizer: 'organizer',
  attachments: 'attachments',
});

export const DB_MIGRATIONS = [
  // v1 — Fase 1: metadatos de la instalación y copia de seguridad de preferencias.
  (db) => {
    db.createObjectStore(STORES.meta);
    db.createObjectStore(STORES.backups);
  },
  // v2 — Game Center: un registro por juego (clave = id del juego) con estadísticas y progreso.
  (db) => {
    db.createObjectStore(STORES.games);
  },
  // v3 — Biblioteca: estado de lectura (favoritos, progreso, marcadores) en la clave `state`.
  (db) => {
    db.createObjectStore(STORES.library);
  },
  // v4 — Organización personal (finanzas, calendario, notas, diario y diario emocional): un registro
  // por entidad (clave = id) en `organizer`, y los archivos adjuntos aparte en `attachments`.
  (db) => {
    db.createObjectStore(STORES.organizer);
    db.createObjectStore(STORES.attachments);
  },
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

/** Todas las entradas de un store como pares [clave, valor]. */
export async function dbEntries(storeName) {
  const db = await openDatabase();
  const tx = db.transaction(storeName, 'readonly');
  const store = tx.objectStore(storeName);
  const [keys, values] = await Promise.all([promisify(store.getAllKeys()), promisify(store.getAll())]);
  return keys.map((key, index) => [key, values[index]]);
}

/** Solo las claves de un store (sin leer los valores, que pueden ser archivos grandes). */
export async function dbKeys(storeName) {
  const db = await openDatabase();
  return promisify(db.transaction(storeName, 'readonly').objectStore(storeName).getAllKeys());
}

/**
 * Sustituye todo el contenido de un store por `entries` ([clave, valor]) en una
 * única transacción: o se aplica completo o no se aplica nada (restaurar copias).
 */
export async function dbReplaceAll(storeName, entries) {
  const db = await openDatabase();
  const tx = db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);
  const done = new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Transacción cancelada'));
  });
  try {
    store.clear();
    for (const [key, value] of entries) store.put(value, key);
  } catch (error) {
    tx.abort();
    throw error;
  }
  await done;
}

/**
 * Escribe y borra varias claves de varios stores en UNA transacción: o se aplica
 * todo o nada. `ops` = [{ store, key, value }] (value === undefined → borrar).
 */
export async function dbWriteMany(ops) {
  if (!ops.length) return;
  const db = await openDatabase();
  const stores = [...new Set(ops.map((op) => op.store))];
  const tx = db.transaction(stores, 'readwrite');
  const done = new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Transacción cancelada'));
  });
  try {
    for (const op of ops) {
      const store = tx.objectStore(op.store);
      if (op.value === undefined) store.delete(op.key);
      else store.put(op.value, op.key);
    }
  } catch (error) {
    tx.abort();
    throw error;
  }
  await done;
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
