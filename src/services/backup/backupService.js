/**
 * Copias de seguridad completas de la app.
 *
 * Inventario central de persistencia: cada fuente de datos (preferencias, juegos,
 * metadatos…) se registra UNA vez en `BACKUP_SOURCES` con cuatro funciones:
 *   - read():            lee sus datos actuales (async), ya listos para JSON.
 *   - sanitize(raw):     valida lo importado → { value, issues }. Nunca lanza.
 *   - restore(value, c): escribe lo validado (async). `c` = contexto de la interfaz.
 *   - summarize(value):  texto corto para el diálogo "qué se va a recuperar".
 * Un módulo nuevo (diario, notas…) solo añade su entrada aquí: exportar e importar
 * lo incluyen automáticamente.
 *
 * Formato (JSON, versionado):
 *   { format, schemaVersion, createdAt, appVersion, sections: { [id]: data } }
 * Las copias antiguas (solo preferencias, formato `…/preferences`) se migran.
 *
 * Qué NO se copia, a propósito:
 *   - `backups/preferences` (IndexedDB): es un espejo interno de las preferencias.
 *   - `uamc:offline-announced`: aviso de interfaz de un solo uso en este navegador.
 *   - Caché del Service Worker: solo archivos de la app, se regenera sola.
 *   - Permisos del navegador (sensores, almacenamiento persistente): no son transferibles.
 */
import { dbGet, dbPut, STORES } from '../storage/database.js';
import { migratePreferences } from '../preferences/migrations.js';
import { sanitizePreferences, isPlainObject } from '../preferences/validation.js';
import {
  exportGameData,
  restoreGameData,
  sanitizeGameData,
} from '../../features/game-center/services/gameStorage.js';

export const BACKUP_FORMAT = 'un-ano-mas-contigo/backup';
export const LEGACY_PREFERENCES_FORMAT = 'un-ano-mas-contigo/preferences';
export const BACKUP_SCHEMA_VERSION = 2;
/** Una copia real ocupa unos pocos KB; 5 MB deja margen para módulos futuros. */
export const MAX_BACKUP_BYTES = 5 * 1024 * 1024;

const appVersion = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : null;

function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

export const BACKUP_SOURCES = [
  {
    id: 'preferences',
    label: 'Configuración',
    required: true,
    // La interfaz pasa sus preferencias vivas (las de localStorage pueden ir un paso detrás).
    read: async (context) => context.preferences,
    sanitize: (raw) => {
      if (!isPlainObject(raw)) return { value: null, issues: ['preferences'] };
      const { data } = migratePreferences(raw);
      return sanitizePreferences(data);
    },
    restore: async (value, context) => context.replacePreferences(value),
    summarize: () => 'Apodos, textos, fechas, estilo, tema, colores y animaciones',
  },
  {
    id: 'games',
    label: 'Game Center',
    read: () => exportGameData(),
    sanitize: (raw) => sanitizeGameData(raw),
    restore: (value) => restoreGameData(value),
    summarize: (value) => {
      const records = Object.values(value.records);
      const plays = records.reduce((sum, record) => sum + record.plays, 0);
      return `${plural(records.length, 'juego', 'juegos')} · ${plural(plays, 'partida', 'partidas')}, récords, niveles y ajustes`;
    },
  },
  {
    id: 'meta',
    label: 'Instalación',
    read: async () => ({ firstOpenedAt: (await dbGet(STORES.meta, 'firstOpenedAt').catch(() => null)) ?? null }),
    sanitize: (raw) => {
      const date = isPlainObject(raw) && typeof raw.firstOpenedAt === 'string' ? raw.firstOpenedAt : null;
      return { value: { firstOpenedAt: date && !Number.isNaN(Date.parse(date)) ? date : null }, issues: [] };
    },
    restore: async (value) => {
      if (!value.firstOpenedAt) return;
      // Se conserva la fecha más antigua entre la copia y esta instalación.
      const current = await dbGet(STORES.meta, 'firstOpenedAt').catch(() => null);
      if (!current || value.firstOpenedAt < current) await dbPut(STORES.meta, 'firstOpenedAt', value.firstOpenedAt);
    },
    summarize: () => null,
  },
];

/** Reúne todas las fuentes. `context.preferences` = preferencias actuales de la interfaz. */
export async function createBackup(context, now = new Date()) {
  const sections = {};
  for (const source of BACKUP_SOURCES) sections[source.id] = await source.read(context);
  return {
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    createdAt: now.toISOString(),
    appVersion,
    sections,
  };
}

export async function serializeFullBackup(context, now) {
  return JSON.stringify(await createBackup(context, now), null, 2);
}

/** Lleva cualquier copia conocida al esquema actual (sin validar todavía los datos). */
function migrateBackup(parsed) {
  if (parsed.format === LEGACY_PREFERENCES_FORMAT) {
    if (!isPlainObject(parsed.preferences)) throw new Error('La copia no contiene una configuración válida.');
    return { createdAt: parsed.exportedAt ?? null, schemaVersion: 1, sections: { preferences: parsed.preferences } };
  }
  if (parsed.format !== BACKUP_FORMAT) throw new Error('El archivo no es una copia de "Un año más contigo".');
  if (!Number.isInteger(parsed.schemaVersion) || parsed.schemaVersion < 2) throw new Error('La versión de la copia no es válida.');
  if (parsed.schemaVersion > BACKUP_SCHEMA_VERSION) {
    throw new Error('Esta copia se creó con una versión más reciente de la app. Actualízala para restaurarla.');
  }
  if (!isPlainObject(parsed.sections)) throw new Error('La copia no tiene secciones de datos.');
  return { createdAt: parsed.createdAt ?? null, schemaVersion: parsed.schemaVersion, sections: parsed.sections };
}

/**
 * Lee y valida un archivo de copia. No escribe nada. Lanza un Error legible si
 * el archivo no se puede usar. Devuelve el plan de restauración.
 */
export function parseFullBackup(text) {
  if (typeof text !== 'string' || text.length > MAX_BACKUP_BYTES) throw new Error('El archivo es demasiado grande para ser una copia de la app.');
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('El archivo no es un JSON válido.');
  }
  if (!isPlainObject(parsed)) throw new Error('El archivo no es una copia de "Un año más contigo".');
  const backup = migrateBackup(parsed);

  const sections = [];
  const issues = [];
  for (const source of BACKUP_SOURCES) {
    if (!(source.id in backup.sections)) {
      if (source.required) throw new Error(`A la copia le falta la sección "${source.label}".`);
      continue;
    }
    const result = source.sanitize(backup.sections[source.id]);
    if (result.value === null) {
      if (source.required) throw new Error(`La sección "${source.label}" de la copia está dañada.`);
      continue;
    }
    issues.push(...result.issues);
    sections.push({ id: source.id, label: source.label, value: result.value, summary: source.summarize(result.value) });
  }
  return { createdAt: backup.createdAt, schemaVersion: backup.schemaVersion, sections, issues, legacy: backup.schemaVersion < 2 };
}

/**
 * Aplica un plan ya validado. Primero los datos de IndexedDB (transacción
 * atómica) y al final las preferencias: si algo falla antes, la configuración
 * actual no se toca. `context.replacePreferences(prefs)` la aplica en la interfaz.
 */
export async function restoreFullBackup(plan, context) {
  const ordered = [...plan.sections].sort((a, b) => (a.id === 'preferences') - (b.id === 'preferences'));
  const restored = [];
  for (const section of ordered) {
    const source = BACKUP_SOURCES.find((s) => s.id === section.id);
    await source.restore(section.value, context);
    restored.push(section.id);
  }
  return { restored };
}
