/**
 * Almacén de la organización personal.
 *
 * Fuente de verdad: el store `organizer` de IndexedDB (migración v4), un registro
 * por entidad con clave = id. Al abrir el primer módulo se cargan todos en memoria
 * (un uso personal son miles de registros, no millones) y la interfaz lee de esa
 * caché de forma síncrona.
 *
 * Escrituras: `commit(build)` ejecuta `build(tx)` sobre el estado más reciente, valida
 * cada cambio y lo guarda en UNA transacción de IndexedDB. Solo si se guardó se
 * actualiza la caché: la interfaz nunca muestra algo que no está en disco. Las
 * escrituras se encolan para que dos operaciones seguidas no se pisen.
 *
 * Varias pestañas: cada commit avisa por BroadcastChannel y las demás recargan los
 * registros cambiados.
 *
 * Sin IndexedDB (modo privado estricto): funciona en memoria y `status.persistent`
 * es false para que la interfaz lo advierta.
 */
import { dbEntries, dbGet, dbKeys, dbWriteMany, isIndexedDBAvailable, STORES } from '../../../services/storage/database.js';
import { isValidDateTime, isValidId, parseShape } from './fields.js';
import { defaultsFor, ENTITIES, incomingRefs, kindsOfModule } from './entities.js';
import { EMOTION_SEEDS, EVENT_CATEGORY_SEEDS, financeCategoryRecords } from './seeds.js';

const HISTORY_LIMIT = 30;
const EMPTY = Object.freeze([]);

export class ValidationError extends Error {
  constructor(errors, kind) {
    super(Object.values(errors)[0] ?? 'Hay datos no válidos.');
    this.name = 'ValidationError';
    this.errors = errors;
    this.kind = kind;
  }
}

export class IntegrityError extends Error {
  constructor(message, plan) {
    super(message);
    this.name = 'IntegrityError';
    this.plan = plan;
  }
}

let records = new Map();
let byKind = new Map();
let status = { ready: false, loading: false, persistent: true, error: null, issues: 0 };
let loadPromise = null;
let loaded = false; // caché leída (interno); `status.ready` llega después de crear los datos iniciales
let queue = Promise.resolve();
const listeners = new Set();
let channel = null;

export function newId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;
}

function notify() {
  for (const listener of listeners) listener();
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getStatus() {
  return status;
}

function setStatus(patch) {
  status = { ...status, ...patch };
}

export function getRecord(id) {
  return (id && records.get(id)) || null;
}

export function listKind(kind) {
  return byKind.get(kind) ?? EMPTY;
}

/** Ajustes de un tipo singleton: el registro guardado o los valores predeterminados. */
export function getSettings(kind) {
  return records.get(kind) ?? { id: kind, kind, ...defaultsFor(kind) };
}

function rebuildKinds(kinds) {
  const next = new Map(byKind);
  for (const kind of kinds) {
    const list = [];
    for (const record of records.values()) if (record.kind === kind) list.push(record);
    if (list.length) next.set(kind, list);
    else next.delete(kind);
  }
  byKind = next;
}

/* ----------------------------------------------------------------------------------- */
/* Saneado (lo que se lee del disco o de una copia)                                       */
/* ----------------------------------------------------------------------------------- */

/** Registro leído o importado → registro válido (con valores predeterminados donde falle) o null. */
export function sanitizeRecord(raw) {
  if (!raw || typeof raw !== 'object' || !isValidId(raw.id) || !ENTITIES[raw.kind]) return { record: null, issues: 1 };
  const entity = ENTITIES[raw.kind];
  if (entity.singleton && raw.id !== raw.kind) return { record: null, issues: 1 };
  const { value, errors } = parseShape(entity.shape, raw);
  const now = new Date().toISOString();
  const record = {
    id: raw.id,
    kind: raw.kind,
    createdAt: isValidDateTime(raw.createdAt) ? raw.createdAt : now,
    updatedAt: isValidDateTime(raw.updatedAt) ? raw.updatedAt : now,
    rev: Number.isSafeInteger(raw.rev) && raw.rev > 0 ? raw.rev : 1,
    ...(entity.normalize ? entity.normalize(value) : value),
  };
  if (entity.history && Array.isArray(raw.history)) {
    record.history = raw.history
      .filter((h) => h && isValidDateTime(h.at) && h.changes && typeof h.changes === 'object')
      .slice(-HISTORY_LIMIT)
      .map((h) => ({ at: h.at, changes: h.changes }));
  }
  return { record, issues: errors ? Object.keys(errors).length : 0 };
}

/* ----------------------------------------------------------------------------------- */
/* Carga                                                                                 */
/* ----------------------------------------------------------------------------------- */

async function readAll() {
  if (!isIndexedDBAvailable()) throw new Error('IndexedDB no está disponible');
  return dbEntries(STORES.organizer);
}

/** Carga la caché (una sola vez) y crea los datos iniciales que falten. */
export function ensureLoaded() {
  if (loadPromise) return loadPromise;
  setStatus({ loading: true });
  notify();
  loadPromise = (async () => {
    let entries = [];
    try {
      entries = await readAll();
    } catch (error) {
      if (import.meta.env.DEV) console.warn('[organizer] Sin IndexedDB: se trabajará en memoria.', error);
      setStatus({ persistent: false });
    }
    let issues = 0;
    const fresh = new Map();
    for (const [key, value] of entries) {
      const { record, issues: n } = sanitizeRecord(value);
      issues += n;
      if (record && record.id === key) fresh.set(record.id, record);
    }
    records = fresh;
    byKind = new Map();
    rebuildKinds(new Set([...fresh.values()].map((r) => r.kind)));
    loaded = true;
    await seedDefaults();
    setStatus({ ready: true, loading: false, issues });
    notify();
    cleanOrphanAttachments();
    listenToOtherTabs();
  })();
  return loadPromise;
}

async function seedDefaults() {
  const finance = getSettings('financeSettings');
  const planner = getSettings('plannerSettings');
  const emotions = getSettings('emotionSettings');
  if (finance.seeded && planner.seeded && emotions.seeded) return;
  try {
    await commit((tx) => {
      if (!finance.seeded) {
        for (const cat of financeCategoryRecords()) if (!tx.get(cat.id)) tx.create('category', cat);
        tx.saveSettings('financeSettings', { seeded: true });
      }
      if (!planner.seeded) {
        for (const cat of EVENT_CATEGORY_SEEDS) if (!tx.get(cat.id)) tx.create('eventCategory', cat);
        tx.saveSettings('plannerSettings', { seeded: true });
      }
      if (!emotions.seeded) {
        for (const emo of EMOTION_SEEDS) if (!tx.get(emo.id)) tx.create('emotion', emo);
        tx.saveSettings('emotionSettings', { seeded: true });
      }
    });
  } catch (error) {
    if (import.meta.env.DEV) console.warn('[organizer] No se pudieron crear los datos iniciales.', error);
  }
}

function listenToOtherTabs() {
  if (channel || typeof BroadcastChannel !== 'function' || !status.persistent) return;
  channel = new BroadcastChannel('uamc-organizer');
  channel.onmessage = (event) => {
    const ids = Array.isArray(event.data?.ids) ? event.data.ids : [];
    if (ids.length) reloadFromDisk(ids);
  };
}

async function reloadFromDisk(ids) {
  // Se encola detrás de las escrituras locales para no mezclar estados.
  queue = queue.then(async () => {
    const kinds = new Set();
    for (const id of ids) {
      const raw = await dbGet(STORES.organizer, id).catch(() => undefined);
      const before = records.get(id);
      if (before) kinds.add(before.kind);
      if (raw === undefined) records.delete(id);
      else {
        const { record } = sanitizeRecord(raw);
        if (record) {
          records.set(id, record);
          kinds.add(record.kind);
        }
      }
    }
    records = new Map(records);
    rebuildKinds(kinds);
    notify();
  });
  return queue;
}

/* ----------------------------------------------------------------------------------- */
/* Transacciones                                                                          */
/* ----------------------------------------------------------------------------------- */

function diff(before, after, shape) {
  const changes = {};
  for (const key of Object.keys(shape)) {
    const a = before[key];
    const b = after[key];
    if (JSON.stringify(a) !== JSON.stringify(b)) changes[key] = [a ?? null, b ?? null];
  }
  return changes;
}

class Transaction {
  constructor(now) {
    this.now = now;
    this.changes = new Map(); // id → registro | null (borrado)
    this.attachmentDeletes = new Set();
  }

  get(id) {
    if (!id) return null;
    if (this.changes.has(id)) return this.changes.get(id);
    return records.get(id) ?? null;
  }

  list(kind) {
    const out = [];
    for (const record of listKind(kind)) if (!this.changes.has(record.id)) out.push(record);
    for (const record of this.changes.values()) if (record && record.kind === kind) out.push(record);
    return out;
  }

  /** Valida y guarda (en la transacción) un registro completo de `kind`. */
  write(kind, data, existing) {
    const entity = ENTITIES[kind];
    if (!entity) throw new Error(`Tipo desconocido: ${kind}`);
    const id = entity.singleton ? kind : (existing?.id ?? data.id ?? newId());
    if (!isValidId(id)) throw new ValidationError({ id: 'Identificador no válido.' }, kind);
    const parsed = parseShape(entity.shape, data);
    const errors = { ...(parsed.errors ?? {}) };
    let value = { ...parsed.value, id };
    if (entity.normalize) value = entity.normalize(value);

    const get = (refId) => this.get(refId);
    for (const spec of entity.refs ?? []) {
      if (spec.many) {
        // Relaciones múltiples: las que ya no existen se descartan (no bloquean una edición).
        value[spec.field] = value[spec.field].filter((refId) => get(refId)?.kind === spec.kind);
        continue;
      }
      const refId = value[spec.field];
      if (!refId) continue;
      const target = get(refId);
      if (target?.kind === spec.kind) continue;
      const required = parseShape({ x: entity.shape[spec.field] }, {}).errors;
      if (required) errors[spec.field] ??= 'El elemento seleccionado ya no existe.';
      else value[spec.field] = null;
    }
    if (!Object.keys(errors).length && entity.check) Object.assign(errors, entity.check(value, get) ?? {});
    if (Object.keys(errors).length) throw new ValidationError(errors, kind);

    delete value.id;
    const record = {
      id,
      kind,
      createdAt: existing?.createdAt ?? (isValidDateTime(data.createdAt) ? data.createdAt : this.now),
      updatedAt: this.now,
      rev: (existing?.rev ?? 0) + 1,
      ...value,
    };
    if (entity.history) {
      const history = existing?.history ? [...existing.history] : [];
      if (existing) {
        const changes = diff(existing, record, entity.shape);
        if (Object.keys(changes).length) history.push({ at: this.now, changes });
      }
      record.history = history.slice(-HISTORY_LIMIT);
    }
    this.changes.set(id, record);
    return record;
  }

  create(kind, data) {
    const id = data.id ?? newId();
    if (this.get(id)) throw new Error('Ya existe un registro con ese identificador.');
    return this.write(kind, { ...data, id });
  }

  /** `patch` puede ser un objeto o una función (registro actual → cambios). */
  update(id, patch) {
    const existing = this.get(id);
    if (!existing) throw new IntegrityError('El registro ya no existe (puede que se haya borrado en otra pestaña).');
    const changes = typeof patch === 'function' ? patch(existing) : patch;
    return this.write(existing.kind, { ...existing, ...changes }, existing);
  }

  saveSettings(kind, patch) {
    const current = this.get(kind) ?? { ...defaultsFor(kind) };
    return this.write(kind, { ...current, ...patch }, this.get(kind));
  }

  /** Borrado sin comprobaciones (lo usan las operaciones que ya resolvieron sus relaciones). */
  removeRaw(id) {
    const existing = this.get(id);
    if (!existing) return;
    for (const attachmentId of existing.attachmentIds ?? []) this.attachmentDeletes.add(attachmentId);
    this.changes.set(id, null);
  }

  /** Borrado con integridad referencial: aplica el plan o lanza IntegrityError si algo lo impide. */
  remove(id, { allowCascade = true } = {}) {
    const plan = planDelete(id, this);
    if (plan.blocked.length) throw new IntegrityError(describeBlock(plan), plan);
    if (plan.cascade.length && !allowCascade) throw new IntegrityError('Hay elementos que se borrarían en cascada.', plan);
    applyPlan(plan, this);
  }

  deleteAttachment(attachmentId) {
    this.attachmentDeletes.add(attachmentId);
  }
}

/**
 * Qué pasaría al borrar `id`: elementos que lo impiden (restrict), que se
 * desvinculan, que se mueven (reparent) y que se borran con él (cascade).
 */
export function planDelete(id, tx = null) {
  const get = (x) => (tx ? tx.get(x) : getRecord(x));
  const list = (kind) => (tx ? tx.list(kind) : listKind(kind));
  const target = get(id);
  const plan = { target, blocked: [], unlink: [], reparent: [], cascade: [] };
  if (!target) return plan;
  for (const spec of incomingRefs(target.kind)) {
    for (const record of list(spec.from)) {
      if (record.id === id) continue;
      const value = record[spec.field];
      const points = spec.many ? Array.isArray(value) && value.includes(id) : value === id;
      if (!points) continue;
      const entry = { record, spec };
      if (spec.onDelete === 'restrict') plan.blocked.push(entry);
      else if (spec.onDelete === 'cascade') plan.cascade.push(entry);
      else if (spec.onDelete === 'reparent') plan.reparent.push(entry);
      else plan.unlink.push(entry);
    }
  }
  return plan;
}

function applyPlan(plan, tx) {
  const { target } = plan;
  for (const { record, spec } of plan.unlink) {
    tx.update(record.id, (current) => ({
      [spec.field]: spec.many ? current[spec.field].filter((x) => x !== target.id) : null,
    }));
  }
  for (const { record, spec } of plan.reparent) tx.update(record.id, { [spec.field]: target[spec.via] ?? null });
  for (const { record } of plan.cascade) tx.removeRaw(record.id);
  tx.removeRaw(target.id);
}

function describeBlock(plan) {
  const first = plan.blocked[0];
  const name = plan.target.name ?? plan.target.title ?? ENTITIES[plan.target.kind].label;
  return `No se puede eliminar «${name}»: ${first.spec.reason ?? 'está en uso'}.`;
}

function broadcast(ids) {
  try {
    channel?.postMessage({ ids });
  } catch {
    // Otra pestaña cerrada o canal no disponible: no es un error de guardado.
  }
}

/**
 * Ejecuta `build(tx)` y guarda todos sus cambios de forma atómica.
 * Devuelve lo que devuelva `build`. Lanza ValidationError / IntegrityError / errores de disco.
 */
export function commit(build) {
  const task = async () => {
    if (!loaded) await ensureLoaded();
    const tx = new Transaction(new Date().toISOString());
    const result = await build(tx);
    if (!tx.changes.size && !tx.attachmentDeletes.size) return result;

    const ops = [];
    for (const [id, record] of tx.changes) ops.push({ store: STORES.organizer, key: id, value: record ?? undefined });
    for (const attachmentId of tx.attachmentDeletes) ops.push({ store: STORES.attachments, key: attachmentId, value: undefined });
    if (status.persistent) {
      try {
        await dbWriteMany(ops);
      } catch (error) {
        if (import.meta.env.DEV) console.warn('[organizer] No se pudo guardar.', error);
        throw new Error('No se pudo guardar en este dispositivo. Revisa el espacio disponible e inténtalo de nuevo.');
      }
    }
    const kinds = new Set();
    const next = new Map(records);
    for (const [id, record] of tx.changes) {
      const before = next.get(id);
      if (before) kinds.add(before.kind);
      if (record) {
        next.set(id, record);
        kinds.add(record.kind);
      } else next.delete(id);
    }
    records = next;
    rebuildKinds(kinds);
    notify();
    broadcast([...tx.changes.keys()]);
    return result;
  };
  const run = queue.then(task, task);
  queue = run.catch(() => {});
  return run;
}

/* ----------------------------------------------------------------------------------- */
/* Atajos                                                                                 */
/* ----------------------------------------------------------------------------------- */

export const createRecord = (kind, data) => commit((tx) => tx.create(kind, data));
export const updateRecord = (id, patch) => commit((tx) => tx.update(id, patch));
export const deleteRecord = (id) => commit((tx) => tx.remove(id));
export const saveSettings = (kind, patch) => commit((tx) => tx.saveSettings(kind, patch));

/** Copia de un registro con otro id (y el título marcado como copia si tiene título o nombre). */
export function duplicateRecord(id, overrides = {}) {
  return commit((tx) => {
    const source = tx.get(id);
    if (!source) throw new IntegrityError('El registro ya no existe.');
    const { id: _id, createdAt: _c, updatedAt: _u, rev: _r, history: _h, kind, ...data } = source;
    const copy = { ...data, attachmentIds: [], ...overrides };
    if (typeof copy.title === 'string' && copy.title && !overrides.title) copy.title = `${copy.title} (copia)`.slice(0, 160);
    else if (typeof copy.name === 'string' && !overrides.name) copy.name = `${copy.name} (copia)`.slice(0, 60);
    return tx.create(kind, copy);
  });
}

/* ----------------------------------------------------------------------------------- */
/* Copias de seguridad por módulo                                                        */
/* ----------------------------------------------------------------------------------- */

export async function exportModule(module) {
  await ensureLoaded();
  const kinds = new Set(kindsOfModule(module));
  return { records: [...records.values()].filter((r) => kinds.has(r.kind)).map((r) => structuredClone(r)) };
}

/** Valida los registros de una copia. Nunca lanza. */
export function sanitizeModule(module, raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.records)) return { value: null, issues: [`organizer.${module}`] };
  const kinds = new Set(kindsOfModule(module));
  const out = [];
  const seen = new Set();
  let problems = 0;
  for (const item of raw.records) {
    const { record, issues } = sanitizeRecord(item);
    problems += issues;
    if (!record || !kinds.has(record.kind) || seen.has(record.id)) {
      problems += record ? 1 : 0;
      continue;
    }
    seen.add(record.id);
    out.push(record);
  }
  return { value: { records: out }, issues: problems ? [`organizer.${module}`] : [] };
}

/** Cuántos registros de la copia son nuevos y cuántos ya existen aquí (mismo id). */
export function compareWithCurrent(value) {
  let existing = 0;
  let newer = 0;
  for (const record of value.records) {
    const current = records.get(record.id);
    if (!current) continue;
    existing += 1;
    if (record.updatedAt > current.updatedAt) newer += 1;
  }
  return { total: value.records.length, existing, added: value.records.length - existing, newer };
}

/**
 * Restaura un módulo.
 *   replace: el módulo queda exactamente como en la copia.
 *   merge:   se añaden los registros nuevos y, si un id existe en ambos lados, gana
 *            la versión modificada más recientemente. No se borra nada.
 */
export async function restoreModule(module, value, mode = 'replace') {
  await ensureLoaded();
  await queue;
  const kinds = new Set(kindsOfModule(module));
  const ops = [];
  const next = new Map(records);
  if (mode === 'replace') {
    const incoming = new Set(value.records.map((r) => r.id));
    for (const record of records.values()) {
      if (kinds.has(record.kind) && !incoming.has(record.id)) {
        ops.push({ store: STORES.organizer, key: record.id, value: undefined });
        next.delete(record.id);
      }
    }
  }
  for (const record of value.records) {
    const current = next.get(record.id);
    if (mode === 'merge' && current && current.updatedAt >= record.updatedAt) continue;
    if (current && !kinds.has(current.kind)) continue; // Un id de otro módulo nunca se sobrescribe.
    ops.push({ store: STORES.organizer, key: record.id, value: record });
    next.set(record.id, record);
  }
  const run = async () => {
    if (status.persistent) await dbWriteMany(ops);
    records = next;
    rebuildKinds(kinds);
    notify();
    broadcast(ops.map((op) => op.key));
  };
  const task = queue.then(run, run);
  queue = task.catch(() => {});
  await task;
  return { written: ops.length };
}

/** Borra todos los registros de un módulo (p. ej. «eliminar mis registros emocionales»). */
export async function eraseKinds(kindList) {
  const kinds = new Set(kindList);
  return commit((tx) => {
    for (const kind of kinds) for (const record of tx.list(kind)) tx.removeRaw(record.id);
  });
}

/* ----------------------------------------------------------------------------------- */
/* Adjuntos huérfanos                                                                     */
/* ----------------------------------------------------------------------------------- */

async function cleanOrphanAttachments() {
  if (!status.persistent) return;
  try {
    const keys = await dbKeys(STORES.attachments);
    if (!keys.length) return;
    const used = new Set();
    for (const record of records.values()) for (const id of record.attachmentIds ?? []) used.add(id);
    const dayAgo = Date.now() - 86_400_000;
    const orphans = [];
    for (const key of keys) {
      if (used.has(key)) continue;
      const meta = await dbGet(STORES.attachments, key);
      if (!meta?.createdAt || Date.parse(meta.createdAt) < dayAgo) orphans.push({ store: STORES.attachments, key, value: undefined });
    }
    if (orphans.length) await dbWriteMany(orphans);
  } catch {
    // Limpieza oportunista: si falla, se reintenta en la próxima carga.
  }
}

/** Solo para pruebas. */
export function __resetOrganizerForTests() {
  records = new Map();
  byKind = new Map();
  status = { ready: false, loading: false, persistent: true, error: null, issues: 0 };
  loadPromise = null;
  loaded = false;
  queue = Promise.resolve();
  listeners.clear();
  channel?.close();
  channel = null;
}
