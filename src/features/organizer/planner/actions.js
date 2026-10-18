/**
 * Operaciones del calendario sobre series repetidas. Ámbitos:
 *   one       → solo esta ocurrencia (se guarda como excepción de la serie)
 *   following → esta y las siguientes (la serie se corta y nace una nueva desde aquí)
 *   all       → toda la serie (se edita el registro)
 * Todas son un único commit.
 */
import { commit, IntegrityError } from '../data/store.js';
import { addDays, dayNumber, occurrencesBetween } from '../data/recurrence.js';

const OCCURRENCE_FIELDS = ['title', 'startTime', 'endTime', 'notes', 'status'];

function splitExceptions(exceptions, date) {
  const before = {};
  const after = {};
  for (const [day, patch] of Object.entries(exceptions ?? {})) (day < date ? before : after)[day] = patch;
  return { before, after };
}

/** Corta la serie el día anterior a `date`. Devuelve la parte de la regla que queda para la nueva serie. */
function cutSeries(tx, event, date) {
  const { before, after } = splitExceptions(event.exceptions, date);
  const rule = event.recurrence;
  let remaining = null;
  const patch = { exceptions: before, recurrence: { ...rule, until: addDays(date, -1), count: null } };
  if (rule.count) {
    const done = occurrencesBetween(event.startDate, rule, event.startDate, addDays(date, -1)).length;
    remaining = Math.max(1, rule.count - done);
    patch.recurrence = { ...rule, count: done || 1, until: null };
  }
  tx.update(event.id, patch);
  return { after, remaining };
}

/**
 * Edita una ocurrencia. `patch` puede tener cualquier campo del evento; en el ámbito
 * «one» solo se guardan título, horas, notas y estado (y un cambio de fecha mueve
 * esa ocurrencia a un evento suelto).
 */
export function editOccurrence(eventId, date, patch, scope = 'all') {
  return commit((tx) => {
    const event = tx.get(eventId);
    if (!event) throw new IntegrityError('El evento ya no existe.');
    if (!event.recurrence || scope === 'all' || (scope === 'following' && date === event.startDate)) {
      return tx.update(eventId, patch);
    }
    if (scope === 'one') {
      const movesDate = patch.startDate && patch.startDate !== date;
      if (movesDate) {
        // Se cancela esa ocurrencia y se crea un evento suelto con los cambios.
        tx.update(eventId, { exceptions: { ...event.exceptions, [date]: { cancelled: true } } });
        const { id: _i, createdAt: _c, updatedAt: _u, rev: _r, kind: _k, exceptions: _e, ...rest } = event;
        return tx.create('event', { ...rest, ...patch, recurrence: null, exceptions: {} });
      }
      const exception = { ...(event.exceptions?.[date] ?? {}) };
      for (const field of OCCURRENCE_FIELDS) if (field in patch) exception[field] = patch[field];
      return tx.update(eventId, { exceptions: { ...event.exceptions, [date]: exception } });
    }
    // following
    const { after, remaining } = cutSeries(tx, event, date);
    const span = dayNumber(event.endDate) - dayNumber(event.startDate);
    const { id: _i, createdAt: _c, updatedAt: _u, rev: _r, kind: _k, ...rest } = event;
    const startDate = patch.startDate ?? date;
    return tx.create('event', {
      ...rest,
      ...patch,
      startDate,
      endDate: patch.endDate ?? addDays(startDate, span),
      recurrence: { ...(patch.recurrence ?? event.recurrence), ...(remaining ? { count: remaining, until: null } : {}) },
      exceptions: after,
    });
  });
}

/** Elimina una ocurrencia, desde ella en adelante o la serie completa. */
export function deleteOccurrence(eventId, date, scope = 'all') {
  return commit((tx) => {
    const event = tx.get(eventId);
    if (!event) throw new IntegrityError('El evento ya no existe.');
    if (!event.recurrence || scope === 'all' || (scope === 'following' && date <= event.startDate)) {
      tx.remove(eventId);
      return null;
    }
    if (scope === 'one') return tx.update(eventId, { exceptions: { ...event.exceptions, [date]: { cancelled: true } } });
    cutSeries(tx, event, date);
    return null;
  });
}

/** Cambia el estado (completado / cancelado / programado) de una ocurrencia o de un evento suelto. */
export function setOccurrenceStatus(eventId, date, status) {
  return commit((tx) => {
    const event = tx.get(eventId);
    if (!event) throw new IntegrityError('El evento ya no existe.');
    if (!event.recurrence) return tx.update(eventId, { status });
    const exception = { ...(event.exceptions?.[date] ?? {}), status };
    return tx.update(eventId, { exceptions: { ...event.exceptions, [date]: exception } });
  });
}

/** Restaura una ocurrencia cancelada de una serie. */
export function restoreOccurrence(eventId, date) {
  return commit((tx) =>
    tx.update(eventId, (event) => {
      const exceptions = { ...event.exceptions };
      delete exceptions[date];
      return { exceptions };
    }),
  );
}

/** Marca o desmarca una subtarea; si todas quedan hechas no cambia el estado de la tarea (decide la persona). */
export function toggleSubtask(taskId, subtaskId) {
  return commit((tx) =>
    tx.update(taskId, (task) => ({ subtasks: task.subtasks.map((s) => (s.id === subtaskId ? { ...s, done: !s.done } : s)) })),
  );
}

/** Completa o reabre una tarea. */
export function setTaskDone(taskId, done) {
  return commit((tx) => tx.update(taskId, { status: done ? 'done' : 'todo' }));
}

/** No habrá clase ese día (festivo, cancelación): se añade a las fechas omitidas de la materia. */
export function setClassSkipped(subjectId, date, skipped) {
  return commit((tx) =>
    tx.update(subjectId, (subject) => ({ skipDates: skipped ? [...subject.skipDates, date] : subject.skipDates.filter((d) => d !== date) })),
  );
}
