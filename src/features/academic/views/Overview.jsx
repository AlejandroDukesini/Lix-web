import { useMemo } from 'react';
import { BookOpen, CalendarClock, ClipboardList, GraduationCap, MapPin, NotebookPen, Plus } from 'lucide-react';
import { Button } from '../../../components/common/Button.jsx';
import { Badge } from '../../../components/common/Card.jsx';
import { useNow } from '../../../hooks/useNow.js';
import { EmptyState, Section } from '../../organizer/shared/ui.jsx';
import { daysFromToday, formatClock, longDate, shortDate } from '../../organizer/shared/format.js';
import { ACTIVITY_LABELS } from '../../organizer/planner/agenda.js';
import { ActivityRow } from '../../organizer/planner/views/University.jsx';
import { usePlannerActions } from '../../organizer/planner/PlannerContext.js';
import { academicDatesBetween, addDays, EVALUATION_TYPES, isoDay, nextClass, overdueActivities, upcomingActivities, WORK_TYPES } from '../academicLogic.js';
import { useAcademic } from '../useAcademic.js';
import { ConflictBanner } from './ConflictBanner.jsx';

const DATE_TYPE_LABELS = { holiday: 'Festivo', academic: 'Evento académico', important: 'Fecha importante' };

function NextCard({ icon: Icon, label, children, empty }) {
  return (
    <article className="org-panel acad-next">
      <p className="acad-next__label">
        <Icon aria-hidden="true" /> {label}
      </p>
      {children ?? <p className="org-subtle">{empty}</p>}
    </article>
  );
}

function ActivitySummary({ activity, data }) {
  const subject = data.subjectsById.get(activity.subjectId);
  return (
    <div className="acad-next__body" style={{ '--item-color': subject?.color }}>
      <p className="acad-next__title">{activity.title}</p>
      <p className="org-subtle">
        {ACTIVITY_LABELS[activity.type]}
        {subject && ` · ${subject.name}`}
      </p>
      <p className="acad-next__when">
        {shortDate(activity.dueDate)} ({daysFromToday(activity.dueDate, data.today)}){activity.dueTime && ` · ${formatClock(activity.dueTime, data.hourCycle)}`}
      </p>
    </div>
  );
}

export function Overview() {
  const data = useAcademic();
  const now = useNow(60_000);
  const { openSubject, openActivity } = usePlannerActions();
  const today = isoDay(now);

  const next = useMemo(() => nextClass(data.subjects, data.academicDates, now), [data.subjects, data.academicDates, now]);
  const nextWork = upcomingActivities(data.activities, today, (a) => WORK_TYPES.has(a.type))[0];
  const nextExam = upcomingActivities(data.activities, today, (a) => EVALUATION_TYPES.has(a.type))[0];
  const overdue = overdueActivities(data.activities, today);
  const week = upcomingActivities(data.activities, today).filter((a) => a.dueDate <= addDays(today, 7));
  // Un rango (semana de parciales) se muestra una sola vez, con su primer día visible.
  const dates = academicDatesBetween(data.academicDates, today, addDays(today, 30)).filter((o, i, all) => all.findIndex((x) => x.record.id === o.record.id && (!x.record.yearly || x.day.slice(0, 4) === o.day.slice(0, 4))) === i);

  if (!data.subjects.length && !data.activities.length) {
    return (
      <EmptyState
        icon={GraduationCap}
        title="Empieza por tus asignaturas"
        action={
          <Button icon={Plus} onClick={() => openSubject(null)}>
            Añadir una asignatura
          </Button>
        }
      >
        Con su horario, profesor y aula. Después podrás registrar tareas, parciales y exposiciones, y llevar un cuaderno por asignatura.
      </EmptyState>
    );
  }

  return (
    <div className="org-stack">
      <ConflictBanner conflicts={data.conflicts} hourCycle={data.hourCycle} />
      <div className="acad-next-grid">
        <NextCard icon={BookOpen} label="Próxima clase" empty="No hay clases en los próximos 15 días.">
          {next && (
            <div className="acad-next__body" style={{ '--item-color': next.subject.color }}>
              <p className="acad-next__title">
                {next.subject.name} {next.ongoing && <Badge tone="success">Ahora</Badge>}
              </p>
              <p className="acad-next__when">
                {next.day === today ? 'Hoy' : longDate(next.day)} · {formatClock(next.start, data.hourCycle)}–{formatClock(next.end, data.hourCycle)}
              </p>
              {(next.room || next.building) && (
                <p className="org-subtle acad-place">
                  <MapPin aria-hidden="true" /> {[next.room && `Aula ${next.room}`, next.building].filter(Boolean).join(' · ')}
                </p>
              )}
              {next.subject.teacher && <p className="org-subtle">Profesor/a: {next.subject.teacher}</p>}
            </div>
          )}
        </NextCard>
        <NextCard icon={ClipboardList} label="Próxima entrega o tarea" empty="Nada pendiente.">
          {nextWork && <ActivitySummary activity={nextWork} data={data} />}
        </NextCard>
        <NextCard icon={CalendarClock} label="Próximo parcial o examen" empty="Ningún parcial ni examen a la vista.">
          {nextExam && <ActivitySummary activity={nextExam} data={data} />}
        </NextCard>
      </div>

      {overdue.length > 0 && (
        <Section title="Vencidas" description="Pendientes con la fecha ya pasada. Márcalas como hechas o cámbiales la fecha.">
          <ul className="org-list">
            {overdue.map((a) => (
              <ActivityRow key={a.id} activity={a} />
            ))}
          </ul>
        </Section>
      )}

      <Section
        title="Los próximos 7 días"
        action={
          <Button variant="secondary" size="sm" icon={Plus} onClick={() => openActivity(null)}>
            Nueva actividad
          </Button>
        }
      >
        {week.length ? (
          <ul className="org-list">
            {week.map((a) => (
              <ActivityRow key={a.id} activity={a} />
            ))}
          </ul>
        ) : (
          <p className="org-muted">Semana despejada: no hay entregas ni evaluaciones en los próximos 7 días.</p>
        )}
      </Section>

      {dates.length > 0 && (
        <Section title="Fechas del próximo mes">
          <ul className="acad-dates">
            {dates.slice(0, 8).map(({ day, record }) => (
              <li key={`${record.id}-${day}`} className={`acad-date is-${record.type}`}>
                <span className="acad-date__day">
                  {shortDate(day)}
                  {record.endDate && record.endDate > day && !record.yearly && ` – ${shortDate(record.endDate)}`}
                </span>
                <span>{record.name}</span>
                <span className="org-subtle">{DATE_TYPE_LABELS[record.type]}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {data.notebooks.length > 0 && (
        <p className="org-subtle acad-place">
          <NotebookPen aria-hidden="true" /> Tienes {data.notebooks.length === 1 ? '1 cuaderno' : `${data.notebooks.length} cuadernos`} en la pestaña Cuadernos.
        </p>
      )}
    </div>
  );
}
