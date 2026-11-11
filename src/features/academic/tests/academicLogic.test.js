import { describe, expect, it } from 'vitest';
import {
  academicDatesBetween,
  conflictsFor,
  monthMatrix,
  nextClass,
  notebookNotes,
  overdueActivities,
  scheduleConflicts,
  upcomingActivities,
  weekGrid,
} from '../academicLogic.js';

const subject = (id, schedule, extra = {}) => ({ id, name: id, color: '#f00', archived: false, schedule, skipDates: [], startDate: null, endDate: null, ...extra });
const slot = (weekday, start, end, extra = {}) => ({ weekday, start, end, room: '', ...extra });
const activity = (id, type, dueDate, extra = {}) => ({ id, type, title: id, dueDate, dueTime: null, status: 'pending', description: '', notes: '', ...extra });

describe('Horario y conflictos', () => {
  it('detecta clases que se solapan el mismo día, pero no las que solo se tocan', () => {
    const subjects = [subject('Cálculo', [slot(1, '08:00', '10:00')]), subject('Física', [slot(1, '09:30', '11:00')]), subject('Química', [slot(1, '10:00', '12:00'), slot(2, '08:00', '09:00')])];
    const conflicts = scheduleConflicts(subjects);
    expect(conflicts).toHaveLength(2);
    expect(conflicts[0]).toMatchObject({ weekday: 1, from: '09:30', to: '10:00' });
    expect(conflicts.map((c) => [c.a.subject.id, c.b.subject.id])).toEqual([
      ['Cálculo', 'Física'],
      ['Física', 'Química'],
    ]);
  });

  it('ignora materias archivadas y períodos que no coinciden', () => {
    const subjects = [
      subject('A', [slot(3, '08:00', '10:00')], { startDate: '2026-01-15', endDate: '2026-05-30' }),
      subject('B', [slot(3, '08:00', '10:00')], { startDate: '2026-07-15', endDate: '2026-11-30' }),
      subject('C', [slot(3, '08:00', '10:00')], { archived: true }),
    ];
    expect(scheduleConflicts(subjects)).toHaveLength(0);
  });

  it('avisa del choque de una materia que se está editando', () => {
    const existing = [subject('Cálculo', [slot(1, '08:00', '10:00')])];
    expect(conflictsFor({ name: 'Nueva', schedule: [slot(1, '09:00', '11:00')] }, existing)).toHaveLength(1);
    // Editar la propia materia no choca consigo misma.
    expect(conflictsFor({ ...existing[0] }, existing)).toHaveLength(0);
  });

  it('la rejilla semanal reparte en carriles las clases que se cruzan y amplía el rango horario', () => {
    const grid = weekGrid([subject('A', [slot(1, '06:30', '08:00')]), subject('B', [slot(1, '07:00', '09:00')]), subject('C', [slot(6, '21:00', '22:00')])]);
    expect(grid.days).toEqual([1, 2, 3, 4, 5, 6]);
    expect(grid.from).toBe(6 * 60);
    expect(grid.to).toBe(22 * 60);
    const monday = grid.columns.find((c) => c.weekday === 1);
    expect(monday.slots.map((s) => [s.subject.id, s.lane, s.lanes])).toEqual([
      ['A', 0, 2],
      ['B', 1, 2],
    ]);
  });
});

describe('Próximos', () => {
  // Lunes 16 de noviembre de 2026, 10:30.
  const now = new Date(2026, 10, 16, 10, 30);

  it('próxima clase: la que está en curso, si no la siguiente; salta festivos', () => {
    const subjects = [subject('Cálculo', [slot(1, '10:00', '12:00', { room: '201' })], { building: 'Bloque B' }), subject('Física', [slot(2, '08:00', '10:00')])];
    expect(nextClass(subjects, [], now)).toMatchObject({ day: '2026-11-16', ongoing: true, room: '201', building: 'Bloque B' });
    const later = new Date(2026, 10, 16, 12, 30);
    expect(nextClass(subjects, [], later)).toMatchObject({ day: '2026-11-17', ongoing: false });
    const holiday = [{ id: 'h', type: 'holiday', name: 'Festivo', date: '2026-11-17', endDate: null, yearly: false }];
    expect(nextClass(subjects, holiday, later)).toMatchObject({ day: '2026-11-23' });
  });

  it('respeta el período de la materia y sus días sin clase', () => {
    const subjects = [subject('A', [slot(1, '08:00', '09:00')], { endDate: '2026-11-20' }), subject('B', [slot(3, '08:00', '09:00')], { skipDates: ['2026-11-18'] })];
    expect(nextClass(subjects, [], now)).toMatchObject({ subject: { id: 'B' }, day: '2026-11-25' });
  });

  it('entregas y evaluaciones pendientes por fecha y hora; las vencidas aparte', () => {
    const list = [
      activity('parcial', 'midterm', '2026-11-20'),
      activity('lectura', 'reading', '2026-11-18', { dueTime: '18:00' }),
      activity('ensayo', 'assignment', '2026-11-18', { dueTime: '08:00' }),
      activity('hecha', 'project', '2026-11-19', { status: 'done' }),
      activity('vieja', 'delivery', '2026-11-10'),
    ];
    expect(upcomingActivities(list, '2026-11-16').map((a) => a.id)).toEqual(['ensayo', 'lectura', 'parcial']);
    expect(overdueActivities(list, '2026-11-16').map((a) => a.id)).toEqual(['vieja']);
  });
});

describe('Calendario académico', () => {
  it('fechas anuales, rangos y fechas únicas dentro de un intervalo', () => {
    const records = [
      { id: 'a', type: 'holiday', name: 'Independencia', date: '2025-07-20', endDate: null, yearly: true },
      { id: 'b', type: 'academic', name: 'Semana de parciales', date: '2026-07-18', endDate: '2026-07-22', yearly: false },
      { id: 'c', type: 'important', name: 'Matrícula', date: '2027-01-10', endDate: null, yearly: false },
    ];
    const between = academicDatesBetween(records, '2026-07-01', '2026-07-31');
    expect(between.map((o) => `${o.record.id}@${o.day}`)).toEqual(['b@2026-07-18', 'b@2026-07-19', 'a@2026-07-20', 'b@2026-07-20', 'b@2026-07-21', 'b@2026-07-22']);
    // Una fecha anual no aparece antes de su primer año.
    expect(academicDatesBetween(records, '2024-07-01', '2024-07-31')).toHaveLength(0);
  });

  it('la matriz del mes empieza en lunes y coloca actividades y festivos', () => {
    const weeks = monthMatrix(2026, 10, {
      activities: [activity('x', 'exam', '2026-11-12'), activity('cancelada', 'exam', '2026-11-12', { status: 'cancelled' })],
      academicDates: [{ id: 'h', type: 'holiday', name: 'Festivo', date: '2026-11-16', endDate: null, yearly: false }],
    });
    expect(weeks[0][0].day).toBe('2026-10-26');
    expect(weeks.at(-1)[6].day).toBe('2026-12-06');
    const all = weeks.flat();
    expect(all.find((d) => d.day === '2026-11-12').activities.map((a) => a.id)).toEqual(['x']);
    expect(all.find((d) => d.day === '2026-11-16').dates[0].name).toBe('Festivo');
    expect(all.find((d) => d.day === '2026-10-26').inMonth).toBe(false);
  });
});

describe('Cuadernos', () => {
  it('lista las notas del cuaderno sin papelera, buscando en título y contenido, por fecha', () => {
    const note = (id, extra) => ({ id, title: id, content: '', notebookId: 'nb', trashedAt: null, noteDate: null, updatedAt: '2026-11-01T10:00:00Z', ...extra });
    const notes = [note('Derivadas', { noteDate: '2026-11-10', content: 'regla de la cadena' }), note('Límites', { noteDate: '2026-11-03' }), note('Borrada', { trashedAt: '2026-11-04' }), note('Otra', { notebookId: 'x' })];
    expect(notebookNotes(notes, 'nb').map((n) => n.id)).toEqual(['Derivadas', 'Límites']);
    expect(notebookNotes(notes, 'nb', 'CADENA').map((n) => n.id)).toEqual(['Derivadas']);
  });
});
