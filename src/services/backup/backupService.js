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
import { exportLibraryData, restoreLibraryData, sanitizeLibraryState } from '../../features/library/services/libraryStorage.js';
import { compareWithCurrent, ensureLoaded, exportModule, restoreModule, sanitizeModule } from '../../features/organizer/data/store.js';
import { ENTITIES, MODULES as ORGANIZER_MODULES } from '../../features/organizer/data/entities.js';
import { exportAttachments, restoreAttachments, sanitizeAttachments } from '../../features/organizer/data/attachments.js';

export const BACKUP_FORMAT = 'un-ano-mas-contigo/backup';
export const LEGACY_PREFERENCES_FORMAT = 'un-ano-mas-contigo/preferences';
/**
 * v3: secciones de la organización personal (una por módulo) y adjuntos; la copia puede
 * ser selectiva, así que la configuración ya no es obligatoria. Se siguen aceptando v2.
 */
export const BACKUP_SCHEMA_VERSION = 3;
/** Sin adjuntos una copia ocupa KB; con fotos y comprobantes (3 MB cada uno) puede crecer. */
export const MAX_BACKUP_BYTES = 80 * 1024 * 1024;
const SNAPSHOT_KEY = 'pre-restore';

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
    id: 'library',
    label: 'Biblioteca',
    read: () => exportLibraryData(),
    sanitize: (raw) => sanitizeLibraryState(raw),
    restore: (value) => restoreLibraryData(value),
    summarize: (value) => {
      const read = Object.values(value.progress).filter((p) => p.finishedAt).length;
      return `${plural(read, 'lectura terminada', 'lecturas terminadas')} · ${plural(value.favorites.length, 'favorito', 'favoritos')} · ${plural(value.bookmarks.length, 'marcador', 'marcadores')}`;
    },
  },
  ...Object.keys(ORGANIZER_MODULES).map((module) => ({
    id: `organizer:${module}`,
    label: ORGANIZER_MODULES[module],
    organizer: module,
    mergeable: true,
    read: () => exportModule(module),
    sanitize: (raw) => sanitizeModule(module, raw),
    restore: (value, context) => restoreModule(module, value, context.mode === 'merge' ? 'merge' : 'replace'),
    summarize: (value) => {
      const counts = new Map();
      for (const record of value.records) if (!ENTITIES[record.kind].singleton) counts.set(record.kind, (counts.get(record.kind) ?? 0) + 1);
      const parts = [...counts].map(([kind, n]) => plural(n, ENTITIES[kind].label, ENTITIES[kind].plural));
      return parts.length ? parts.join(' · ') : 'Solo ajustes';
    },
  })),
  {
    id: 'attachments',
    label: 'Archivos adjuntos',
    mergeable: true,
    read: () => exportAttachments(),
    sanitize: (raw) => sanitizeAttachments(raw),
    // Los adjuntos solo se añaden: nunca se borran los que ya hay en este dispositivo.
    restore: (value) => restoreAttachments(value),
    summarize: (value) => (value.files.length ? plural(value.files.length, 'archivo', 'archivos') : null),
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

/**
 * Reúne las fuentes. `context.preferences` = preferencias actuales de la interfaz.
 * `context.include` (opcional) = ids de las secciones a exportar (copia selectiva).
 */
export async function createBackup(context, now = new Date()) {
  const sections = {};
  for (const source of BACKUP_SOURCES) {
    if (context.include && source.id !== 'meta' && !context.include.includes(source.id)) continue;
    sections[source.id] = await source.read(context);
  }
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
  if (!Object.keys(parsed.sections).some((id) => BACKUP_SOURCES.some((source) => source.id === id && id !== 'meta'))) {
    throw new Error('La copia no contiene datos que esta app sepa leer.');
  }
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
      // Desde la v3 las copias pueden ser selectivas: solo las v2 deben traer la configuración.
      if (source.required && backup.schemaVersion < 3) throw new Error(`A la copia le falta la sección "${source.label}".`);
      continue;
    }
    const result = source.sanitize(backup.sections[source.id]);
    if (result.value === null) {
      if (source.required) throw new Error(`La sección "${source.label}" de la copia está dañada.`);
      continue;
    }
    issues.push(...result.issues);
    sections.push({
      id: source.id,
      label: source.label,
      value: result.value,
      summary: source.summarize(result.value),
      mergeable: Boolean(source.mergeable),
      organizer: source.organizer ?? null,
    });
  }
  return { createdAt: backup.createdAt, schemaVersion: backup.schemaVersion, sections, issues, legacy: backup.schemaVersion < 2 };
}

/**
 * Para la vista previa: cuántos registros de cada sección de la organización son nuevos
 * y cuántos ya existen aquí (mismo id), y de esos cuántos son más recientes en la copia.
 */
export async function compareBackup(plan) {
  await ensureLoaded();
  const out = {};
  for (const section of plan.sections) if (section.organizer) out[section.id] = compareWithCurrent(section.value);
  return out;
}

/** Guarda una copia completa del estado actual antes de restaurar (para poder deshacer). */
export async function saveSafetySnapshot(context, now = new Date()) {
  const text = await serializeFullBackup({ preferences: context.preferences }, now);
  await dbPut(STORES.backups, SNAPSHOT_KEY, { createdAt: now.toISOString(), text });
}

export async function readSafetySnapshot() {
  const snapshot = await dbGet(STORES.backups, SNAPSHOT_KEY).catch(() => null);
  return snapshot && typeof snapshot.text === 'string' ? snapshot : null;
}

/**
 * Aplica un plan ya validado. Primero los datos de IndexedDB y al final las
 * preferencias: si algo falla antes, la configuración actual no se toca.
 *   context.replacePreferences(prefs) → aplica la configuración en la interfaz
 *   context.selected  (opcional) → ids de las secciones a restaurar
 *   context.mode      'replace' | 'merge' → solo afecta a las secciones combinables
 *   context.snapshot  true → antes guarda el estado actual para «Deshacer»
 */
export async function restoreFullBackup(plan, context) {
  const chosen = plan.sections.filter((s) => !context.selected || context.selected.includes(s.id) || s.id === 'meta');
  if (context.snapshot) await saveSafetySnapshot(context);
  const ordered = [...chosen].sort((a, b) => (a.id === 'preferences') - (b.id === 'preferences'));
  const restored = [];
  for (const section of ordered) {
    const source = BACKUP_SOURCES.find((s) => s.id === section.id);
    await source.restore(section.value, context);
    restored.push(section.id);
  }
  return { restored };
}

/** Deshace la última restauración: vuelve a dejar los datos exactamente como estaban. */
export async function undoLastRestore(context) {
  const snapshot = await readSafetySnapshot();
  if (!snapshot) throw new Error('No hay ninguna restauración que deshacer.');
  const plan = parseFullBackup(snapshot.text);
  await restoreFullBackup(plan, { ...context, mode: 'replace', snapshot: false, selected: undefined });
  return snapshot.createdAt;
}
