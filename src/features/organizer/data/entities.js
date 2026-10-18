/**
 * Catálogo de entidades de la organización personal.
 *
 * Cada tipo (`kind`) declara:
 *   - module:  a qué módulo pertenece (copias selectivas, privacidad, borrado por módulo).
 *   - shape:   sus campos y cómo se validan (data/fields.js).
 *   - refs:    relaciones explícitas con otras entidades y qué ocurre si se borra la otra:
 *                restrict → no se puede borrar mientras exista la relación (se ofrece archivar o reasignar)
 *                unlink   → se quita la relación y el registro se conserva
 *                cascade  → se borra también (siempre con confirmación que lo enumera)
 *                reparent → pasa al «padre» del elemento borrado (carpetas)
 *   - check:   reglas que relacionan varios campos o miran otros registros.
 *   - singleton: tipos de ajustes con un único registro cuyo id es el propio tipo.
 *
 * Todos los registros comparten { id, kind, createdAt, updatedAt, rev }.
 */
import {
  bool,
  color,
  currency,
  date,
  dateTime,
  int,
  intList,
  list,
  money,
  oneOf,
  parseShape,
  ref,
  refs,
  tags,
  text,
  textMap,
  time,
  dates,
} from './fields.js';
import { recurrence } from './recurrence.js';

export const MODULES = Object.freeze({
  finance: 'Finanzas',
  planner: 'Calendario y universidad',
  notes: 'Notas',
  journal: 'Diario personal',
  emotions: 'Diario emocional',
  organizer: 'Organización (ajustes)',
});

export const PRIORITIES = ['low', 'normal', 'high'];
const METHODS = ['cash', 'debit', 'credit', 'transfer', 'wallet', 'other'];
export const CATEGORY_ICONS = [
  'tag', 'utensils', 'bus', 'home', 'heart-pulse', 'graduation-cap', 'shirt', 'gamepad', 'gift', 'plane', 'phone', 'zap',
  'shopping-bag', 'coffee', 'book', 'paw', 'dumbbell', 'briefcase', 'piggy-bank', 'coins', 'sparkles', 'film', 'music', 'baby',
];

const MAX_LONG = 200_000;

/* ----------------------------------------------------------------------------------- */
/* Finanzas                                                                              */
/* ----------------------------------------------------------------------------------- */

const account = {
  module: 'finance',
  label: 'cuenta',
  plural: 'cuentas',
  shape: {
    name: text({ max: 60, required: true, label: 'El nombre' }),
    type: oneOf(['cash', 'bank', 'wallet', 'credit', 'savings', 'other'], 'bank', 'El tipo de cuenta'),
    currency: currency('COP'),
    openingBalance: money({ allowNegative: true, label: 'El saldo inicial' }),
    openingDate: date({ required: true, label: 'La fecha de apertura' }),
    description: text({ max: 280 }),
    color: color(null),
    creditLimit: money({ label: 'El cupo' }),
    statementDay: int({ min: 1, max: 31, label: 'El día de corte' }),
    dueDay: int({ min: 1, max: 31, label: 'El día de pago' }),
    archived: bool(false),
  },
};

const category = {
  module: 'finance',
  label: 'categoría',
  plural: 'categorías',
  shape: {
    name: text({ max: 40, required: true, label: 'El nombre' }),
    type: oneOf(['expense', 'income'], 'expense', 'El tipo'),
    parentId: ref({ label: 'La categoría principal' }),
    icon: oneOf(CATEGORY_ICONS, 'tag', 'El icono'),
    color: color('#8e5bd8'),
    description: text({ max: 200 }),
    archived: bool(false),
  },
  refs: [{ field: 'parentId', kind: 'category', onDelete: 'restrict', reason: 'tiene subcategorías' }],
  check(value, get) {
    if (!value.parentId) return null;
    if (value.parentId === value.id) return { parentId: 'Una categoría no puede ser su propia subcategoría.' };
    const parent = get(value.parentId);
    if (parent?.parentId) return { parentId: 'Solo hay dos niveles: elige una categoría principal.' };
    if (parent && parent.type !== value.type) return { parentId: 'La categoría principal debe ser del mismo tipo (ingreso o gasto).' };
    return null;
  },
};

const transaction = {
  module: 'finance',
  label: 'movimiento',
  plural: 'movimientos',
  history: true,
  shape: {
    type: oneOf(['expense', 'income', 'transfer'], 'expense', 'El tipo'),
    amount: money({ required: true, label: 'El valor' }),
    date: date({ required: true }),
    time: time(),
    accountId: ref({ required: true, label: 'La cuenta' }),
    toAccountId: ref({ label: 'La cuenta de destino' }),
    categoryId: ref({ label: 'La categoría' }),
    description: text({ max: 120 }),
    notes: text({ max: 2000 }),
    method: oneOf(METHODS, 'other', 'El método de pago'),
    status: oneOf(['completed', 'pending', 'cancelled'], 'completed', 'El estado'),
    tags: tags(),
    attachmentIds: refs({ max: 5 }),
    goalId: ref({ label: 'La meta de ahorro' }),
    goalDirection: oneOf(['in', 'out'], 'in'),
    scheduleId: ref(),
    scheduleDate: date(),
    importBatch: text({ max: 40 }),
  },
  refs: [
    { field: 'accountId', kind: 'account', onDelete: 'restrict', reason: 'tiene movimientos' },
    { field: 'toAccountId', kind: 'account', onDelete: 'restrict', reason: 'recibe transferencias' },
    { field: 'categoryId', kind: 'category', onDelete: 'restrict', reason: 'tiene movimientos' },
    { field: 'goalId', kind: 'goal', onDelete: 'unlink' },
    { field: 'scheduleId', kind: 'scheduled', onDelete: 'unlink' },
  ],
  normalize(value) {
    // Reglas contables: una transferencia no tiene categoría (no es ingreso ni gasto real);
    // un ingreso o gasto no tiene cuenta de destino ni aportes a metas.
    if (value.type === 'transfer') value.categoryId = null;
    else {
      value.toAccountId = null;
      value.goalId = null;
    }
    if (!value.scheduleId) value.scheduleDate = null;
    return value;
  },
  check(value, get) {
    const errors = {};
    if (value.type === 'transfer') {
      if (!value.toAccountId) errors.toAccountId = 'Elige la cuenta de destino.';
      else if (value.toAccountId === value.accountId) errors.toAccountId = 'La cuenta de destino debe ser distinta de la de origen.';
      else {
        const from = get(value.accountId);
        const to = get(value.toAccountId);
        if (from && to && from.currency !== to.currency) errors.toAccountId = 'Las dos cuentas deben usar la misma moneda (la app no convierte divisas).';
      }
    } else if (value.categoryId) {
      const cat = get(value.categoryId);
      if (cat && cat.type !== value.type) errors.categoryId = value.type === 'income' ? 'Elige una categoría de ingresos.' : 'Elige una categoría de gastos.';
    }
    return Object.keys(errors).length ? errors : null;
  },
};

const budget = {
  module: 'finance',
  label: 'presupuesto',
  plural: 'presupuestos',
  shape: {
    name: text({ max: 60, label: 'El nombre' }),
    categoryId: ref({ label: 'La categoría' }),
    amount: money({ required: true, label: 'El límite' }),
    period: oneOf(['weekly', 'monthly', 'yearly'], 'monthly', 'El período'),
    alertPercent: int({ min: 50, max: 100, fallback: 80, label: 'El aviso' }),
    includePending: bool(false),
    archived: bool(false),
  },
  refs: [{ field: 'categoryId', kind: 'category', onDelete: 'cascade' }],
  check(value, get) {
    if (value.categoryId && get(value.categoryId)?.type === 'income') return { categoryId: 'Un presupuesto limita gastos: elige una categoría de gastos.' };
    return null;
  },
};

const goal = {
  module: 'finance',
  label: 'meta de ahorro',
  plural: 'metas de ahorro',
  shape: {
    name: text({ max: 60, required: true, label: 'El nombre' }),
    description: text({ max: 400 }),
    target: money({ required: true, label: 'La cantidad objetivo' }),
    startDate: date({ required: true, label: 'La fecha de inicio' }),
    deadline: date({ label: 'La fecha límite' }),
    status: oneOf(['active', 'achieved', 'paused', 'cancelled'], 'active', 'El estado'),
    accountId: ref({ label: 'La cuenta de ahorro' }),
    color: color('#f5b961'),
  },
  refs: [{ field: 'accountId', kind: 'account', onDelete: 'unlink' }],
  check(value) {
    if (value.deadline && value.startDate && value.deadline < value.startDate) return { deadline: 'La fecha límite no puede ser anterior al inicio.' };
    return null;
  },
};

const scheduled = {
  module: 'finance',
  label: 'pago programado',
  plural: 'pagos programados',
  shape: {
    name: text({ max: 80, required: true, label: 'El nombre' }),
    flow: oneOf(['expense', 'income'], 'expense', 'El tipo'),
    payKind: oneOf(['subscription', 'tuition', 'service', 'purchase', 'debt', 'salary', 'other'], 'other', 'La clase de pago'),
    amount: money({ required: true, label: 'El valor' }),
    accountId: ref({ required: true, label: 'La cuenta' }),
    categoryId: ref({ label: 'La categoría' }),
    method: oneOf(METHODS, 'other', 'El método de pago'),
    startDate: date({ required: true, label: 'La primera fecha' }),
    recurrence: recurrence(),
    reminderDays: int({ min: 0, max: 30, fallback: 2, label: 'El aviso' }),
    status: oneOf(['active', 'paused', 'cancelled', 'finished'], 'active', 'El estado'),
    skipped: dates(),
    notes: text({ max: 1000 }),
    tags: tags(),
  },
  refs: [
    { field: 'accountId', kind: 'account', onDelete: 'restrict', reason: 'tiene pagos programados' },
    { field: 'categoryId', kind: 'category', onDelete: 'unlink' },
  ],
  check(value, get) {
    if (value.categoryId) {
      const cat = get(value.categoryId);
      if (cat && cat.type !== value.flow) return { categoryId: value.flow === 'income' ? 'Elige una categoría de ingresos.' : 'Elige una categoría de gastos.' };
    }
    if (value.recurrence?.until && value.recurrence.until < value.startDate) return { recurrence: 'La repetición no puede terminar antes de la primera fecha.' };
    return null;
  },
};

/* ----------------------------------------------------------------------------------- */
/* Calendario, universidad y tareas                                                      */
/* ----------------------------------------------------------------------------------- */

const eventCategory = {
  module: 'planner',
  label: 'categoría del calendario',
  plural: 'categorías del calendario',
  shape: {
    name: text({ max: 40, required: true, label: 'El nombre' }),
    color: color('#8e5bd8'),
    archived: bool(false),
  },
};

const REMINDER_MINUTES = intList({ min: 0, max: 60 * 24 * 30, maxItems: 5 });

function checkTimeRange(value, startField, endField, startTimeField, endTimeField) {
  const errors = {};
  if (value[endField] && value[startField] && value[endField] < value[startField]) {
    errors[endField] = 'La fecha final no puede ser anterior a la inicial.';
  } else if (
    value[endField] === value[startField] &&
    value[startTimeField] &&
    value[endTimeField] &&
    value[endTimeField] < value[startTimeField]
  ) {
    errors[endTimeField] = 'La hora final no puede ser anterior a la inicial.';
  }
  return errors;
}

const event = {
  module: 'planner',
  label: 'evento',
  plural: 'eventos',
  shape: {
    title: text({ max: 120, required: true, label: 'El título' }),
    description: text({ max: 4000 }),
    startDate: date({ required: true, label: 'La fecha de inicio' }),
    startTime: time({ label: 'La hora de inicio' }),
    endDate: date({ label: 'La fecha de fin' }),
    endTime: time({ label: 'La hora de fin' }),
    allDay: bool(false),
    categoryId: ref({ label: 'La categoría' }),
    location: text({ max: 160 }),
    priority: oneOf(PRIORITIES, 'normal', 'La prioridad'),
    status: oneOf(['scheduled', 'completed', 'cancelled'], 'scheduled', 'El estado'),
    color: color(null),
    tags: tags(),
    reminders: REMINDER_MINUTES,
    recurrence: recurrence(),
    // { 'AAAA-MM-DD': { cancelled?: true, status?, title?, startTime?, endTime?, notes? } }
    exceptions: (raw) => ({ value: sanitizeExceptions(raw), error: null }),
    notes: text({ max: 4000 }),
    subjectId: ref(),
  },
  refs: [
    { field: 'categoryId', kind: 'eventCategory', onDelete: 'unlink' },
    { field: 'subjectId', kind: 'subject', onDelete: 'unlink' },
  ],
  normalize(value) {
    if (!value.endDate) value.endDate = value.startDate;
    if (value.allDay) {
      value.startTime = null;
      value.endTime = null;
    }
    return value;
  },
  check(value) {
    const errors = checkTimeRange(value, 'startDate', 'endDate', 'startTime', 'endTime');
    if (!value.allDay && !value.startTime) errors.startTime = 'Indica la hora de inicio o marca «Todo el día».';
    if (value.recurrence?.until && value.recurrence.until < value.startDate) errors.recurrence = 'La repetición no puede terminar antes del primer día.';
    return Object.keys(errors).length ? errors : null;
  },
};

const EXCEPTION_FIELDS = { title: 120, notes: 4000 };
function sanitizeExceptions(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out = {};
  for (const [day, patch] of Object.entries(raw).slice(0, 1000)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !patch || typeof patch !== 'object') continue;
    const clean = {};
    if (patch.cancelled === true) clean.cancelled = true;
    if (['scheduled', 'completed', 'cancelled'].includes(patch.status)) clean.status = patch.status;
    for (const [key, max] of Object.entries(EXCEPTION_FIELDS)) if (typeof patch[key] === 'string') clean[key] = patch[key].slice(0, max);
    for (const key of ['startTime', 'endTime']) if (typeof patch[key] === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(patch[key])) clean[key] = patch[key];
    if (Object.keys(clean).length) out[day] = clean;
  }
  return out;
}

const subject = {
  module: 'planner',
  label: 'materia',
  plural: 'materias',
  shape: {
    name: text({ max: 80, required: true, label: 'El nombre' }),
    code: text({ max: 20 }),
    teacher: text({ max: 80 }),
    teacherContact: text({ max: 120 }),
    room: text({ max: 60 }),
    semester: text({ max: 40 }),
    color: color('#ef6f8c'),
    startDate: date({ label: 'El inicio de clases' }),
    endDate: date({ label: 'El fin de clases' }),
    schedule: list(
      {
        weekday: int({ min: 0, max: 6, required: true, label: 'El día' }),
        start: (raw) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(raw ?? '') ? { value: raw, error: null } : { value: null, error: 'Indica la hora de inicio de la clase.' }),
        end: (raw) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(raw ?? '') ? { value: raw, error: null } : { value: null, error: 'Indica la hora de fin de la clase.' }),
        room: text({ max: 60 }),
      },
      { max: 14, label: 'El horario' },
    ),
    skipDates: dates(),
    notes: text({ max: 4000 }),
    archived: bool(false),
  },
  check(value) {
    const errors = {};
    if (value.startDate && value.endDate && value.endDate < value.startDate) errors.endDate = 'El fin de clases no puede ser anterior al inicio.';
    if (value.schedule.some((slot) => slot.end <= slot.start)) errors.schedule = 'En cada clase, la hora de fin debe ser posterior a la de inicio.';
    return Object.keys(errors).length ? errors : null;
  },
};

export const ACTIVITY_TYPES = ['assignment', 'exam', 'midterm', 'presentation', 'delivery', 'reading', 'other'];

const activity = {
  module: 'planner',
  label: 'actividad académica',
  plural: 'actividades académicas',
  shape: {
    subjectId: ref({ label: 'La materia' }),
    type: oneOf(ACTIVITY_TYPES, 'assignment', 'El tipo'),
    title: text({ max: 120, required: true, label: 'El título' }),
    description: text({ max: 4000 }),
    dueDate: date({ required: true, label: 'La fecha' }),
    dueTime: time(),
    status: oneOf(['pending', 'in_progress', 'done', 'cancelled'], 'pending', 'El estado'),
    priority: oneOf(PRIORITIES, 'normal', 'La prioridad'),
    weight: int({ min: 0, max: 100, label: 'El porcentaje de la nota' }),
    grade: text({ max: 12 }),
    reminders: REMINDER_MINUTES,
    notes: text({ max: 4000 }),
    completedAt: dateTime(),
  },
  refs: [{ field: 'subjectId', kind: 'subject', onDelete: 'unlink' }],
};

const task = {
  module: 'planner',
  label: 'tarea',
  plural: 'tareas',
  shape: {
    title: text({ max: 140, required: true, label: 'El título' }),
    description: text({ max: 4000 }),
    dueDate: date({ label: 'La fecha límite' }),
    dueTime: time(),
    priority: oneOf(PRIORITIES, 'normal', 'La prioridad'),
    status: oneOf(['todo', 'doing', 'done', 'cancelled'], 'todo', 'El estado'),
    categoryId: ref(),
    subjectId: ref(),
    eventId: ref(),
    activityId: ref(),
    subtasks: list({ id: ref({ required: true }), title: text({ max: 140, required: true, label: 'La subtarea' }), done: bool(false) }, { max: 50, label: 'Las subtareas' }),
    tags: tags(),
    reminders: REMINDER_MINUTES,
    completedAt: dateTime(),
  },
  refs: [
    { field: 'categoryId', kind: 'eventCategory', onDelete: 'unlink' },
    { field: 'subjectId', kind: 'subject', onDelete: 'unlink' },
    { field: 'eventId', kind: 'event', onDelete: 'unlink' },
    { field: 'activityId', kind: 'activity', onDelete: 'unlink' },
  ],
  normalize(value) {
    if (value.status === 'done') value.completedAt ??= new Date().toISOString();
    else value.completedAt = null;
    if (!value.dueDate) value.dueTime = null;
    return value;
  },
};

/* ----------------------------------------------------------------------------------- */
/* Notas                                                                                 */
/* ----------------------------------------------------------------------------------- */

const folder = {
  module: 'notes',
  label: 'carpeta',
  plural: 'carpetas',
  shape: {
    name: text({ max: 60, required: true, label: 'El nombre' }),
    parentId: ref({ label: 'La carpeta superior' }),
    color: color(null),
  },
  refs: [{ field: 'parentId', kind: 'folder', onDelete: 'reparent', via: 'parentId' }],
  check(value, get) {
    // Sin ciclos y con tres niveles como máximo.
    let depth = 1;
    let cursor = value.parentId;
    while (cursor) {
      if (cursor === value.id) return { parentId: 'Una carpeta no puede ir dentro de sí misma.' };
      depth += 1;
      if (depth > 3) return { parentId: 'Las carpetas admiten tres niveles como máximo.' };
      cursor = get(cursor)?.parentId ?? null;
    }
    return null;
  },
};

const noteCategory = {
  module: 'notes',
  label: 'categoría de notas',
  plural: 'categorías de notas',
  shape: {
    name: text({ max: 40, required: true, label: 'El nombre' }),
    color: color('#8e5bd8'),
  },
};

const collection = {
  module: 'notes',
  label: 'colección',
  plural: 'colecciones',
  shape: {
    name: text({ max: 60, required: true, label: 'El nombre' }),
    description: text({ max: 280 }),
    color: color('#f5b961'),
  },
};

const note = {
  module: 'notes',
  label: 'nota',
  plural: 'notas',
  shape: {
    title: text({ max: 160, label: 'El título' }),
    content: text({ max: MAX_LONG, label: 'El contenido' }),
    folderId: ref(),
    categoryId: ref(),
    collectionIds: refs({ max: 30 }),
    tags: tags(),
    color: color(null),
    pinned: bool(false),
    favorite: bool(false),
    archived: bool(false),
    trashedAt: dateTime(),
    eventId: ref(),
  },
  refs: [
    { field: 'folderId', kind: 'folder', onDelete: 'reparent', via: 'parentId' },
    { field: 'categoryId', kind: 'noteCategory', onDelete: 'unlink' },
    { field: 'collectionIds', kind: 'collection', many: true, onDelete: 'unlink' },
    { field: 'eventId', kind: 'event', onDelete: 'unlink' },
  ],
};

/* ----------------------------------------------------------------------------------- */
/* Diario personal                                                                       */
/* ----------------------------------------------------------------------------------- */

const journalEntry = {
  module: 'journal',
  label: 'entrada del diario',
  plural: 'entradas del diario',
  shape: {
    title: text({ max: 160, label: 'El título' }),
    body: text({ max: MAX_LONG, label: 'El texto' }),
    writtenAt: dateTime({ required: true, label: 'La fecha de escritura' }),
    eventDate: date({ required: true, label: 'La fecha del acontecimiento' }),
    category: text({ max: 40 }),
    tags: tags(),
    status: oneOf(['draft', 'published'], 'published', 'El estado'),
    favorite: bool(false),
    archived: bool(false),
    trashedAt: dateTime(),
    attachmentIds: refs({ max: 6 }),
    relatedEventIds: refs({ max: 20 }),
    relatedNoteIds: refs({ max: 20 }),
    relatedTaskIds: refs({ max: 20 }),
  },
  refs: [
    { field: 'relatedEventIds', kind: 'event', many: true, onDelete: 'unlink' },
    { field: 'relatedNoteIds', kind: 'note', many: true, onDelete: 'unlink' },
    { field: 'relatedTaskIds', kind: 'task', many: true, onDelete: 'unlink' },
  ],
};

const journalTemplate = {
  module: 'journal',
  label: 'plantilla',
  plural: 'plantillas',
  shape: {
    name: text({ max: 60, required: true, label: 'El nombre' }),
    description: text({ max: 200 }),
    body: text({ max: 8000, required: true, label: 'El texto de la plantilla' }),
  },
};

/* ----------------------------------------------------------------------------------- */
/* Diario emocional                                                                      */
/* ----------------------------------------------------------------------------------- */

export const VALENCES = ['pleasant', 'unpleasant', 'mixed', 'neutral'];

const emotion = {
  module: 'emotions',
  label: 'emoción',
  plural: 'emociones',
  shape: {
    name: text({ max: 30, required: true, label: 'El nombre' }),
    valence: oneOf(VALENCES, 'neutral', 'El tono'),
    color: color('#8e5bd8'),
    description: text({ max: 200 }),
    builtin: bool(false),
    archived: bool(false),
    order: int({ min: 0, max: 10000, fallback: 0 }),
  },
};

const emotionLog = {
  module: 'emotions',
  label: 'registro emocional',
  plural: 'registros emocionales',
  shape: {
    at: dateTime({ required: true, label: 'La fecha y hora' }),
    primaryId: ref({ required: true, label: 'La emoción principal' }),
    secondaryIds: refs({ max: 6 }),
    intensity: int({ min: 1, max: 10, required: true, fallback: 5, label: 'La intensidad' }),
    scale: oneOf([5, 10], 10),
    mood: int({ min: -2, max: 2, label: 'El estado de ánimo' }),
    description: text({ max: 4000 }),
    context: text({ max: 400 }),
    contextTags: tags({ max: 10 }),
    factors: tags({ max: 15 }),
    needs: tags({ max: 15 }),
    strategies: tags({ max: 15 }),
    tags: tags(),
    privateNotes: text({ max: 4000 }),
    reflection: textMap(),
    eventId: ref(),
    journalEntryId: ref(),
  },
  refs: [
    { field: 'primaryId', kind: 'emotion', onDelete: 'restrict', reason: 'aparece en registros (archívala en su lugar)' },
    { field: 'secondaryIds', kind: 'emotion', many: true, onDelete: 'restrict', reason: 'aparece en registros (archívala en su lugar)' },
    { field: 'eventId', kind: 'event', onDelete: 'unlink' },
    { field: 'journalEntryId', kind: 'journalEntry', onDelete: 'unlink' },
  ],
  normalize(value) {
    value.secondaryIds = value.secondaryIds.filter((id) => id !== value.primaryId);
    return value;
  },
  check(value) {
    if (value.intensity > value.scale) return { intensity: `La intensidad debe estar entre 1 y ${value.scale}.` };
    return null;
  },
};

/* ----------------------------------------------------------------------------------- */
/* Ajustes (un registro por tipo)                                                        */
/* ----------------------------------------------------------------------------------- */

export const DASHBOARD_WIDGETS = Object.freeze([
  { id: 'today', label: 'Hoy en el calendario' },
  { id: 'university', label: 'Próximas clases y entregas' },
  { id: 'tasks', label: 'Tareas pendientes' },
  { id: 'finance', label: 'Resumen financiero' },
  { id: 'payments', label: 'Pagos próximos' },
  { id: 'goals', label: 'Metas de ahorro' },
  { id: 'quick', label: 'Escribir rápido (nota, diario, emoción)' },
  { id: 'activity', label: 'Actividad reciente' },
]);

const settingsKinds = {
  financeSettings: {
    module: 'finance',
    shape: {
      mainCurrency: currency('COP'),
      monthStartDay: int({ min: 1, max: 28, fallback: 1, label: 'El día de inicio del mes' }),
      seeded: bool(false),
    },
  },
  plannerSettings: {
    module: 'planner',
    shape: {
      defaultView: oneOf(['month', 'week', 'day', 'agenda'], 'month'),
      showClasses: bool(true),
      showTasks: bool(true),
      showActivities: bool(true),
      showPayments: bool(true),
      defaultReminder: int({ min: 0, max: 10080, fallback: 30 }),
      seeded: bool(false),
    },
  },
  journalSettings: {
    module: 'journal',
    shape: {
      showPrompts: bool(true),
      showMemories: bool(true),
    },
  },
  emotionSettings: {
    module: 'emotions',
    shape: {
      scale: oneOf([5, 10], 10),
      showReflection: bool(true),
      seeded: bool(false),
    },
  },
  dashboardSettings: {
    module: 'organizer',
    shape: {
      widgets: (raw) => {
        const known = DASHBOARD_WIDGETS.map((w) => w.id);
        const value = Array.isArray(raw) ? raw.filter((w) => w && known.includes(w.id)).map((w) => ({ id: w.id, visible: w.visible !== false })) : [];
        const seen = new Set(value.map((w) => w.id));
        for (const id of known) if (!seen.has(id)) value.push({ id, visible: true });
        return { value: value.filter((w, i, all) => all.findIndex((x) => x.id === w.id) === i), error: null };
      },
    },
  },
  reminderSettings: {
    module: 'organizer',
    shape: {
      enabled: bool(true),
      systemNotifications: bool(false),
      showDetails: bool(true),
    },
  },
  privacySettings: {
    module: 'organizer',
    shape: {
      pinHash: text({ max: 200 }),
      pinSalt: text({ max: 100 }),
      pinIterations: int({ min: 1000, max: 2_000_000, fallback: 210_000 }),
      lockJournal: bool(true),
      lockEmotions: bool(true),
      autoLockMinutes: int({ min: 1, max: 240, fallback: 5 }),
    },
  },
};

for (const kind of Object.values(settingsKinds)) kind.singleton = true;

export const ENTITIES = Object.freeze({
  account,
  category,
  transaction,
  budget,
  goal,
  scheduled,
  eventCategory,
  event,
  subject,
  activity,
  task,
  folder,
  noteCategory,
  collection,
  note,
  journalEntry,
  journalTemplate,
  emotion,
  emotionLog,
  ...settingsKinds,
});

export const KINDS = Object.freeze(Object.keys(ENTITIES));

export function kindsOfModule(module) {
  return KINDS.filter((kind) => ENTITIES[kind].module === module);
}

/** Valores iniciales de un tipo (para formularios nuevos y ajustes que aún no existen). */
export function defaultsFor(kind, overrides = {}) {
  return { ...parseShape(ENTITIES[kind].shape, {}).value, ...overrides };
}

/** Relaciones entrantes: qué tipos apuntan a `targetKind` y con qué política. */
export function incomingRefs(targetKind) {
  const out = [];
  for (const kind of KINDS) for (const spec of ENTITIES[kind].refs ?? []) if (spec.kind === targetKind) out.push({ ...spec, from: kind });
  return out;
}
