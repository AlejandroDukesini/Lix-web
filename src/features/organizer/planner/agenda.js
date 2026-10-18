/**
 * Agenda: reúne en una sola lista todo lo que tiene fecha, SIN duplicar registros.
 * Cada elemento de la agenda es una vista calculada de su registro de origen:
 *   - event     → ocurrencias de un evento (con repetición y excepciones)
 *   - class     → sesiones de clase generadas desde el horario de cada materia
 *   - activity  → trabajos, exámenes, parciales, exposiciones, entregas, lecturas
 *   - task      → tareas con fecha límite
 *   - payment   → ocurrencias de pagos programados de Finanzas
 * Editar el registro de origen cambia todas sus apariciones.
 */
import { addDays, dayNumber, occurrencesBetween, weekdayOf } from '../data/recurrence.js';
import { scheduleOccurrences } from '../finance/ledger.js';

export const ITEM_TYPES = {
  event: 'Eventos',
  class: 'Clases',
  activity: 'Universidad',
  task: 'Tareas',
  payment: 'Pagos',
};

export const ACTIVITY_LABELS = {
  assignment: 'Trabajo',
  exam: 'Examen',
  midterm: 'Parcial',
  presentation: 'Exposición',
  delivery: 'Entrega',
  reading: 'Lectura',
  other: 'Actividad',
};

const spanDays = (event) => Math.max(0, dayNumber(event.endDate ?? event.startDate) - dayNumber(event.startDate));

/** Ocurrencias de un evento entre dos fechas, ya con sus excepciones aplicadas. */
export function eventOccurrences(event, from, to) {
  const span = spanDays(event);
  // Un evento de varios días que empezó antes del rango también debe aparecer.
  const dates = occurrencesBetween(event.startDate, event.recurrence, addDays(from, -span), to);
  const out = [];
  for (const date of dates) {
    const exception = event.exceptions?.[date];
    if (exception?.cancelled) continue;
    const endDate = addDays(date, span);
    if (endDate < from) continue;
    out.push({
      key: `event:${event.id}:${date}`,
      type: 'event',
      sourceId: event.id,
      occurrence: date,
      recurring: Boolean(event.recurrence),
      date,
      endDate,
      allDay: event.allDay,
      startTime: exception?.startTime ?? event.startTime,
      endTime: exception?.endTime ?? event.endTime,
      title: exception?.title ?? event.title,
      notes: exception?.notes ?? event.notes,
      status: exception?.status ?? event.status,
      priority: event.priority,
      location: event.location,
      categoryId: event.categoryId,
      color: event.color,
      tags: event.tags,
      reminders: event.reminders,
    });
  }
  return out;
}

export function classOccurrences(subject, from, to) {
  if (subject.archived || !subject.schedule.length) return [];
  const start = subject.startDate && subject.startDate > from ? subject.startDate : from;
  const end = subject.endDate && subject.endDate < to ? subject.endDate : to;
  if (start > end) return [];
  const skip = new Set(subject.skipDates);
  const out = [];
  for (let day = start; day <= end; day = addDays(day, 1)) {
    const weekday = weekdayOf(day);
    for (const [index, slot] of subject.schedule.entries()) {
      if (slot.weekday !== weekday || skip.has(day)) continue;
      out.push({
        key: `class:${subject.id}:${index}:${day}`,
        type: 'class',
        sourceId: subject.id,
        occurrence: day,
        date: day,
        endDate: day,
        allDay: false,
        startTime: slot.start,
        endTime: slot.end,
        title: subject.name,
        location: slot.room || subject.room,
        color: subject.color,
        status: 'scheduled',
        priority: 'normal',
      });
    }
  }
  return out;
}

export function activityItem(activity, subjectsById) {
  const subject = subjectsById.get(activity.subjectId);
  return {
    key: `activity:${activity.id}`,
    type: 'activity',
    sourceId: activity.id,
    date: activity.dueDate,
    endDate: activity.dueDate,
    allDay: !activity.dueTime,
    startTime: activity.dueTime,
    endTime: null,
    title: `${ACTIVITY_LABELS[activity.type]}: ${activity.title}`,
    subtitle: subject?.name,
    color: subject?.color ?? '#8e5bd8',
    status: activity.status,
    priority: activity.priority,
    reminders: activity.reminders,
  };
}

export function taskItem(task) {
  return {
    key: `task:${task.id}`,
    type: 'task',
    sourceId: task.id,
    date: task.dueDate,
    endDate: task.dueDate,
    allDay: !task.dueTime,
    startTime: task.dueTime,
    endTime: null,
    title: task.title,
    status: task.status,
    priority: task.priority,
    categoryId: task.categoryId,
    reminders: task.reminders,
  };
}

/**
 * Todo lo que ocurre entre `from` y `to` (inclusive), ordenado por fecha y hora.
 * `records` = { events, subjects, activities, tasks, scheduled, transactions }.
 */
export function collectAgenda(records, from, to, { today, show = {} } = {}) {
  const items = [];
  const visible = (type) => show[type] !== false;
  if (visible('event')) for (const event of records.events ?? []) items.push(...eventOccurrences(event, from, to));
  if (visible('class')) for (const subject of records.subjects ?? []) items.push(...classOccurrences(subject, from, to));
  const subjectsById = new Map((records.subjects ?? []).map((s) => [s.id, s]));
  if (visible('activity')) {
    for (const activity of records.activities ?? []) {
      if (activity.dueDate >= from && activity.dueDate <= to) items.push(activityItem(activity, subjectsById));
    }
  }
  if (visible('task')) {
    for (const task of records.tasks ?? []) {
      if (task.dueDate && task.dueDate >= from && task.dueDate <= to && task.status !== 'cancelled') items.push(taskItem(task));
    }
  }
  if (visible('payment')) {
    for (const item of records.scheduled ?? []) {
      for (const occ of scheduleOccurrences(item, records.transactions ?? [], from, to, today ?? from)) {
        if (occ.state === 'skipped' || occ.state === 'inactive') continue;
        items.push({
          key: `payment:${item.id}:${occ.date}`,
          type: 'payment',
          sourceId: item.id,
          occurrence: occ.date,
          date: occ.date,
          endDate: occ.date,
          allDay: true,
          title: item.name,
          status: occ.state,
          amount: item.amount,
          flow: item.flow,
          reminderDays: item.reminderDays,
          priority: occ.state === 'overdue' ? 'high' : 'normal',
        });
      }
    }
  }
  return items.sort(compareItems);
}

export function compareItems(a, b) {
  return (
    a.date.localeCompare(b.date) ||
    Number(!a.allDay) - Number(!b.allDay) ||
    (a.startTime ?? '').localeCompare(b.startTime ?? '') ||
    a.title.localeCompare(b.title, 'es')
  );
}

/** ¿Ocupa el elemento el día `iso`? (los eventos de varios días ocupan todos sus días). */
export function coversDay(item, iso) {
  return item.date <= iso && (item.endDate ?? item.date) >= iso;
}

const minutes = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/**
 * Elementos con hora que se solapan con el intervalo dado el mismo día.
 * Sin hora de fin se asume una hora. Los de «todo el día» no generan conflicto.
 */
export function findConflicts(items, { date, startTime, endTime, ignoreKeyPrefix }) {
  if (!date || !startTime) return [];
  const start = minutes(startTime);
  const end = endTime ? minutes(endTime) : start + 60;
  return items.filter((item) => {
    if (ignoreKeyPrefix && item.key.startsWith(ignoreKeyPrefix)) return false;
    if (item.allDay || !item.startTime || !coversDay(item, date) || item.status === 'cancelled') return false;
    if (item.type === 'task' || item.type === 'payment') return false;
    const s = minutes(item.startTime);
    const e = item.endTime ? minutes(item.endTime) : s + 60;
    return s < end && start < e;
  });
}

/** Rejilla de un mes: semanas completas (con días del mes anterior y siguiente). */
export function monthGrid(year, month, weekStartsOn = 1) {
  const first = `${year}-${String(month).padStart(2, '0')}-01`;
  const offset = (weekdayOf(first) - weekStartsOn + 7) % 7;
  const start = addDays(first, -offset);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const last = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  const weeks = [];
  let cursor = start;
  do {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(cursor, i)));
    cursor = addDays(cursor, 7);
  } while (cursor <= last);
  return weeks;
}
