/**
 * Lógica pura del Control académico (sin React ni almacenamiento: fácil de probar).
 *
 * Trabaja sobre los registros que ya existen en la organización:
 *   subject       materias (con horario, docente, salón y edificio)
 *   activity      tareas, parciales, exámenes, exposiciones, proyectos, entregas, lecturas, investigaciones
 *   academicDate  festivos, eventos académicos y fechas importantes (nuevo)
 *   notebook      cuadernos por materia (nuevo; sus notas son notas normales)
 */

export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
export const WEEKDAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export const PENDING = new Set(['pending', 'in_progress']);
/** Qué tipos cuentan como evaluaciones (parciales y exámenes) y cuáles como entregas o tareas. */
export const EVALUATION_TYPES = new Set(['midterm', 'exam']);
export const WORK_TYPES = new Set(['assignment', 'delivery', 'reading', 'project', 'research', 'presentation', 'other']);

export const minutes = (hhmm) => {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + m;
};

export function isoDay(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDay(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso, n) {
  const date = parseDay(iso);
  date.setDate(date.getDate() + n);
  return isoDay(date);
}

/** ¿La materia tiene clases ese día (dentro de su período y sin estar en sus días omitidos)? */
export function subjectActiveOn(subject, iso) {
  if (subject.archived) return false;
  if (subject.startDate && iso < subject.startDate) return false;
  if (subject.endDate && iso > subject.endDate) return false;
  return !(subject.skipDates ?? []).includes(iso);
}

/** Todas las franjas de clase de las materias activas: { key, subject, weekday, start, end, room, building }. */
export function classSlots(subjects) {
  return subjects
    .filter((s) => !s.archived)
    .flatMap((subject) =>
      subject.schedule.map((slot, index) => ({
        key: `${subject.id}:${index}`,
        subject,
        weekday: slot.weekday,
        start: slot.start,
        end: slot.end,
        room: slot.room || subject.room || '',
        building: slot.building || subject.building || '',
      })),
    );
}

function periodsOverlap(a, b) {
  const aStart = a.startDate ?? '0000-01-01';
  const aEnd = a.endDate ?? '9999-12-31';
  const bStart = b.startDate ?? '0000-01-01';
  const bEnd = b.endDate ?? '9999-12-31';
  return aStart <= bEnd && bStart <= aEnd;
}

/**
 * Conflictos de horario: dos franjas el mismo día que se solapan, de materias cuyos
 * períodos coinciden. Las franjas que solo se tocan (una termina 10:00 y otra empieza 10:00) no chocan.
 */
export function scheduleConflicts(subjects) {
  const slots = classSlots(subjects);
  const conflicts = [];
  for (let i = 0; i < slots.length; i += 1) {
    for (let j = i + 1; j < slots.length; j += 1) {
      const a = slots[i];
      const b = slots[j];
      if (a.weekday !== b.weekday) continue;
      if (!(minutes(a.start) < minutes(b.end) && minutes(b.start) < minutes(a.end))) continue;
      if (!periodsOverlap(a.subject, b.subject)) continue;
      conflicts.push({ a, b, weekday: a.weekday, from: a.start > b.start ? a.start : b.start, to: a.end < b.end ? a.end : b.end });
    }
  }
  return conflicts;
}

/** Conflictos que provocaría una materia (nueva o editada) con las demás. */
export function conflictsFor(candidate, subjects) {
  const others = subjects.filter((s) => s.id !== candidate.id);
  return scheduleConflicts([...others, { ...candidate, id: candidate.id ?? '__nueva__', archived: false }]).filter((c) => c.a.subject.id === (candidate.id ?? '__nueva__') || c.b.subject.id === (candidate.id ?? '__nueva__'));
}

/** Rejilla semanal: días visibles, horas límite (redondeadas) y franjas por día con su columna si se solapan. */
export function weekGrid(subjects, { dayStart = '07:00', dayEnd = '20:00' } = {}) {
  const slots = classSlots(subjects);
  const days = WEEK_ORDER.filter((d) => d !== 0 && d !== 6 ? true : slots.some((s) => s.weekday === d));
  let from = minutes(dayStart);
  let to = minutes(dayEnd);
  for (const slot of slots) {
    from = Math.min(from, Math.floor(minutes(slot.start) / 60) * 60);
    to = Math.max(to, Math.ceil(minutes(slot.end) / 60) * 60);
  }
  const columns = days.map((weekday) => {
    const list = slots.filter((s) => s.weekday === weekday).sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
    // Reparte en carriles las franjas que se solapan para que no se tapen.
    const lanes = [];
    const placed = list.map((slot) => {
      let lane = lanes.findIndex((end) => end <= minutes(slot.start));
      if (lane === -1) {
        lane = lanes.length;
        lanes.push(0);
      }
      lanes[lane] = minutes(slot.end);
      return { ...slot, lane };
    });
    return { weekday, slots: placed.map((s) => ({ ...s, lanes: lanes.length })) };
  });
  return { days, from, to, columns };
}

/* ---------- Fechas académicas (festivos, eventos, fechas importantes) ---------- */

/** Ocurrencias de las fechas académicas entre dos días (incluye las anuales y los rangos). */
export function academicDatesBetween(records, from, to) {
  const out = [];
  const fromYear = Number(from.slice(0, 4));
  const toYear = Number(to.slice(0, 4));
  for (const record of records) {
    const span = record.endDate && record.endDate > record.date ? Math.round((parseDay(record.endDate) - parseDay(record.date)) / 86400000) : 0;
    const starts = record.yearly ? Array.from({ length: toYear - fromYear + 2 }, (_, i) => `${fromYear - 1 + i}${record.date.slice(4)}`).filter((d) => d.slice(5) === record.date.slice(5) && d >= record.date) : [record.date];
    for (const start of starts) {
      for (let k = 0; k <= span; k += 1) {
        const day = addDays(start, k);
        if (day >= from && day <= to) out.push({ day, record });
      }
    }
  }
  return out.sort((a, b) => a.day.localeCompare(b.day));
}

export function holidaySet(records, from, to) {
  return new Set(academicDatesBetween(records.filter((r) => r.type === 'holiday'), from, to).map((o) => o.day));
}

/* ---------- Próximos ---------- */

/** Próxima clase desde `now` (Date): salta festivos, días omitidos y materias fuera de su período. */
export function nextClass(subjects, academicDates, now = new Date()) {
  const today = isoDay(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const holidays = holidaySet(academicDates, today, addDays(today, 15));
  const slots = classSlots(subjects);
  for (let offset = 0; offset < 15; offset += 1) {
    const day = addDays(today, offset);
    if (holidays.has(day)) continue;
    const weekday = parseDay(day).getDay();
    const candidates = slots
      .filter((s) => s.weekday === weekday && subjectActiveOn(s.subject, day))
      .filter((s) => offset > 0 || minutes(s.end) > nowMinutes)
      .sort((a, b) => a.start.localeCompare(b.start));
    if (candidates.length) {
      const slot = candidates[0];
      return { ...slot, day, ongoing: offset === 0 && minutes(slot.start) <= nowMinutes };
    }
  }
  return null;
}

function dueKey(activity) {
  return `${activity.dueDate}T${activity.dueTime ?? '23:59'}`;
}

/** Actividades pendientes desde hoy (las vencidas aparecen aparte), ordenadas por fecha y hora. */
export function upcomingActivities(activities, today, filter = () => true) {
  return activities
    .filter((a) => PENDING.has(a.status) && a.dueDate >= today && filter(a))
    .sort((a, b) => dueKey(a).localeCompare(dueKey(b)));
}

export function overdueActivities(activities, today) {
  return activities.filter((a) => PENDING.has(a.status) && a.dueDate < today).sort((a, b) => dueKey(a).localeCompare(dueKey(b)));
}

/* ---------- Calendario mensual ---------- */

/** Semanas (lunes a domingo) del mes de `year`/`month` (0-11) con lo que ocurre cada día. */
export function monthMatrix(year, month, { activities = [], academicDates = [] } = {}) {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const start = isoDay(new Date(year, month, 1 - offset));
  const last = new Date(year, month + 1, 0);
  const end = isoDay(new Date(year, month + 1, (7 - ((last.getDay() + 6) % 7) - 1)));
  const dates = academicDatesBetween(academicDates, start, end);
  const weeks = [];
  for (let day = start; day <= end; day = addDays(day, 7)) {
    weeks.push(
      Array.from({ length: 7 }, (_, i) => {
        const iso = addDays(day, i);
        return {
          day: iso,
          inMonth: parseDay(iso).getMonth() === month,
          activities: activities.filter((a) => a.dueDate === iso && a.status !== 'cancelled'),
          dates: dates.filter((d) => d.day === iso).map((d) => d.record),
        };
      }),
    );
  }
  return weeks;
}

/* ---------- Cuadernos ---------- */

/** Notas de un cuaderno (sin papelera), filtradas por texto y ordenadas por fecha de la nota o de edición. */
export function notebookNotes(notes, notebookId, query = '') {
  const q = query.trim().toLowerCase();
  return notes
    .filter((n) => n.notebookId === notebookId && !n.trashedAt)
    .filter((n) => !q || n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q))
    .sort((a, b) => (b.noteDate ?? b.updatedAt.slice(0, 10)).localeCompare(a.noteDate ?? a.updatedAt.slice(0, 10)) || b.updatedAt.localeCompare(a.updatedAt));
}
