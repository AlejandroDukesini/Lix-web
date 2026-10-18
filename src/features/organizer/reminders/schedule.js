/**
 * Recordatorios: qué avisos «tocan» entre dos instantes. Función pura y probada.
 *
 * Fuentes: eventos (minutos antes de su inicio; los de todo el día cuentan desde las
 * 9:00), entregas/exámenes y tareas con fecha (antes de su hora, o de las 9:00) y pagos
 * programados sin registrar (días antes, a las 9:00). El diario emocional NUNCA genera
 * recordatorios: su contenido no debe aparecer en notificaciones.
 *
 * Cada aviso tiene una clave estable (tipo:id:fecha:minutos) para no repetirse.
 */
import { addDays } from '../data/recurrence.js';
import { scheduleOccurrences } from '../finance/ledger.js';
import { eventOccurrences, ACTIVITY_LABELS } from '../planner/agenda.js';
import { toISODate } from '../../../utils/dates.js';

const DEFAULT_TIME = '09:00';

function at(date, time, minutesBefore) {
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = (time ?? DEFAULT_TIME).split(':').map(Number);
  return new Date(y, m - 1, d, h, min - minutesBefore, 0, 0);
}

function when(minutes) {
  if (minutes === 0) return 'Ahora';
  if (minutes < 60) return `En ${minutes} min`;
  if (minutes < 1440) return `En ${minutes / 60} h`;
  const days = minutes / 1440;
  return days === 1 ? 'Mañana' : `En ${days} días`;
}

/**
 * Recordatorios con hora en (from, to]. `records` = { events, activities, tasks, scheduled, transactions }.
 * Devuelve [{ key, at: Date, title, body, url }].
 */
export function remindersBetween(records, from, to) {
  const out = [];
  const firstDay = toISODate(from);
  const lastDay = addDays(toISODate(to), 31); // un aviso puede ser hasta 30 días antes
  const push = (key, date, title, body, url) => {
    if (date > from && date <= to) out.push({ key, at: date, title, body, url });
  };

  for (const event of records.events ?? []) {
    if (!event.reminders?.length) continue;
    for (const occ of eventOccurrences(event, firstDay, lastDay)) {
      if (occ.status === 'cancelled' || occ.status === 'completed') continue;
      for (const minutes of event.reminders) {
        push(`event:${event.id}:${occ.date}:${minutes}`, at(occ.date, occ.allDay ? DEFAULT_TIME : occ.startTime, minutes), occ.title, `${when(minutes)}${occ.location ? ` · ${occ.location}` : ''}`, '/calendario');
      }
    }
  }
  for (const activity of records.activities ?? []) {
    if (activity.status === 'done' || activity.status === 'cancelled' || activity.dueDate < firstDay || activity.dueDate > lastDay) continue;
    for (const minutes of activity.reminders ?? []) {
      push(`activity:${activity.id}:${activity.dueDate}:${minutes}`, at(activity.dueDate, activity.dueTime, minutes), `${ACTIVITY_LABELS[activity.type]}: ${activity.title}`, when(minutes), '/calendario/universidad');
    }
  }
  for (const task of records.tasks ?? []) {
    if (!task.dueDate || task.status === 'done' || task.status === 'cancelled' || task.dueDate < firstDay || task.dueDate > lastDay) continue;
    for (const minutes of task.reminders ?? []) {
      push(`task:${task.id}:${task.dueDate}:${minutes}`, at(task.dueDate, task.dueTime, minutes), task.title, `Tarea · ${when(minutes)}`, '/calendario/tareas');
    }
  }
  for (const item of records.scheduled ?? []) {
    if (item.status !== 'active') continue;
    for (const occ of scheduleOccurrences(item, records.transactions ?? [], firstDay, lastDay, firstDay)) {
      if (occ.state !== 'upcoming' && occ.state !== 'overdue') continue;
      const minutes = item.reminderDays * 1440;
      push(`payment:${item.id}:${occ.date}:${minutes}`, at(occ.date, DEFAULT_TIME, minutes), item.flow === 'income' ? `Ingreso esperado: ${item.name}` : `Pago: ${item.name}`, when(minutes), '/finanzas/pagos');
    }
  }
  return out.sort((a, b) => a.at - b.at);
}
