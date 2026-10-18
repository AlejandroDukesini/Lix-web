import { describe, expect, it } from 'vitest';
import { collectAgenda, eventOccurrences, findConflicts, monthGrid } from '../planner/agenda.js';
import { deleteOccurrence, editOccurrence, setOccurrenceStatus } from '../planner/actions.js';
import { createRecord, ensureLoaded, getRecord, listKind } from '../data/store.js';

const weekly = { freq: 'weekly', interval: 1, until: null, count: null, weekdays: [] };

async function series(overrides = {}) {
  await ensureLoaded();
  return createRecord('event', { title: 'Yoga', startDate: '2026-03-02', startTime: '18:00', endTime: '19:00', recurrence: weekly, ...overrides });
}

const dates = (eventId, from = '2026-03-01', to = '2026-03-31') =>
  listKind('event')
    .filter((e) => !eventId || e.id === eventId)
    .flatMap((e) => eventOccurrences(e, from, to))
    .map((o) => `${o.date} ${o.title} ${o.startTime}`)
    .sort();

describe('agenda', () => {
  it('reúne eventos, clases, actividades, tareas y pagos sin duplicar registros', () => {
    const agenda = collectAgenda(
      {
        events: [{ id: 'e', title: 'Cine', startDate: '2026-03-03', endDate: '2026-03-03', allDay: false, startTime: '20:00', recurrence: null, exceptions: {} }],
        subjects: [{ id: 's', name: 'Cálculo', color: '#000', archived: false, schedule: [{ weekday: 1, start: '07:00', end: '09:00', room: '201' }], skipDates: ['2026-03-09'], startDate: '2026-03-01', endDate: '2026-03-20' }],
        activities: [{ id: 'a', type: 'exam', title: 'Parcial 1', dueDate: '2026-03-04', subjectId: 's', status: 'pending', priority: 'high' }],
        tasks: [{ id: 't', title: 'Leer', dueDate: '2026-03-05', status: 'todo' }, { id: 'u', title: 'Sin fecha', dueDate: null, status: 'todo' }],
        scheduled: [{ id: 'p', name: 'Arriendo', status: 'active', startDate: '2026-03-05', recurrence: null, skipped: [], amount: 1, flow: 'expense' }],
        transactions: [],
      },
      '2026-03-01',
      '2026-03-31',
      { today: '2026-03-01' },
    );
    expect(agenda.map((i) => `${i.type}:${i.date}`)).toEqual([
      'class:2026-03-02',
      'event:2026-03-03',
      'activity:2026-03-04',
      'payment:2026-03-05',
      'task:2026-03-05',
      'class:2026-03-16', // el 9 no hay clase y el 23 ya terminó el semestre
    ]);
    expect(agenda[2]).toMatchObject({ title: 'Examen: Parcial 1', subtitle: 'Cálculo' });
  });

  it('los eventos de varios días aparecen en cada día del rango', () => {
    const occ = eventOccurrences({ id: 'v', title: 'Viaje', startDate: '2026-02-27', endDate: '2026-03-02', allDay: true, recurrence: null, exceptions: {} }, '2026-03-01', '2026-03-31');
    expect(occ).toHaveLength(1);
    expect(occ[0]).toMatchObject({ date: '2026-02-27', endDate: '2026-03-02' });
  });

  it('detecta solapes con aviso (sin bloquear) e ignora los de todo el día', () => {
    const items = [
      { key: 'a', date: '2026-03-02', endDate: '2026-03-02', startTime: '07:00', endTime: '09:00', type: 'class', title: 'Cálculo' },
      { key: 'b', date: '2026-03-02', endDate: '2026-03-02', allDay: true, type: 'event', title: 'Cumple' },
    ];
    expect(findConflicts(items, { date: '2026-03-02', startTime: '08:30', endTime: '10:00' }).map((i) => i.key)).toEqual(['a']);
    expect(findConflicts(items, { date: '2026-03-02', startTime: '09:00', endTime: '10:00' })).toEqual([]);
  });

  it('la rejilla del mes empieza en el día configurado', () => {
    const lunes = monthGrid(2026, 3, 1);
    expect(lunes[0][0]).toBe('2026-02-23');
    expect(lunes.flat()).toContain('2026-03-31');
    expect(monthGrid(2026, 3, 0)[0][0]).toBe('2026-03-01');
  });
});

describe('series repetidas', () => {
  it('editar solo una ocurrencia guarda una excepción', async () => {
    const e = await series();
    await editOccurrence(e.id, '2026-03-09', { title: 'Yoga suave', startTime: '19:00' }, 'one');
    expect(dates(e.id)).toEqual(['2026-03-02 Yoga 18:00', '2026-03-09 Yoga suave 19:00', '2026-03-16 Yoga 18:00', '2026-03-23 Yoga 18:00', '2026-03-30 Yoga 18:00']);
  });

  it('mover una ocurrencia a otro día la convierte en un evento suelto', async () => {
    const e = await series();
    await editOccurrence(e.id, '2026-03-09', { startDate: '2026-03-10', endDate: '2026-03-10' }, 'one');
    expect(dates()).toContain('2026-03-10 Yoga 18:00');
    expect(dates()).not.toContain('2026-03-09 Yoga 18:00');
    expect(listKind('event')).toHaveLength(2);
  });

  it('editar «esta y las siguientes» corta la serie y crea otra sin huecos ni duplicados', async () => {
    const e = await series();
    await editOccurrence(e.id, '2026-03-02', { title: 'solo esta' }, 'one');
    await editOccurrence(e.id, '2026-03-16', { startTime: '07:00', endTime: '08:00' }, 'following');
    expect(dates()).toEqual(['2026-03-02 solo esta 18:00', '2026-03-09 Yoga 18:00', '2026-03-16 Yoga 07:00', '2026-03-23 Yoga 07:00', '2026-03-30 Yoga 07:00']);
  });

  it('con un número de repeticiones, cortar la serie reparte las restantes', async () => {
    const e = await series({ recurrence: { ...weekly, count: 4 } });
    await editOccurrence(e.id, '2026-03-16', { title: 'Yoga 2' }, 'following');
    expect(dates(null, '2026-03-01', '2026-06-30')).toEqual(['2026-03-02 Yoga 18:00', '2026-03-09 Yoga 18:00', '2026-03-16 Yoga 2 18:00', '2026-03-23 Yoga 2 18:00']);
  });

  it('eliminar una, desde una o toda la serie', async () => {
    const e = await series();
    await deleteOccurrence(e.id, '2026-03-09', 'one');
    expect(dates(e.id)).toHaveLength(4);
    await deleteOccurrence(e.id, '2026-03-23', 'following');
    expect(dates(e.id)).toEqual(['2026-03-02 Yoga 18:00', '2026-03-16 Yoga 18:00']);
    await deleteOccurrence(e.id, '2026-03-16', 'all');
    expect(getRecord(e.id)).toBeNull();
  });

  it('completar una ocurrencia no completa la serie', async () => {
    const e = await series();
    await setOccurrenceStatus(e.id, '2026-03-09', 'completed');
    const occ = eventOccurrences(getRecord(e.id), '2026-03-01', '2026-03-16');
    expect(occ.map((o) => o.status)).toEqual(['scheduled', 'completed', 'scheduled']);
  });

  it('valida horas y fechas del evento', async () => {
    await ensureLoaded();
    await expect(createRecord('event', { title: 'X', startDate: '2026-03-02', startTime: '10:00', endTime: '09:00' })).rejects.toMatchObject({
      errors: { endTime: 'La hora final no puede ser anterior a la inicial.' },
    });
    await expect(createRecord('event', { title: 'X', startDate: '2026-03-02' })).rejects.toMatchObject({ errors: { startTime: expect.any(String) } });
  });
});
