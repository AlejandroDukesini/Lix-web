import { useMemo, useState } from 'react';
import { Archive, ArchiveRestore, BookOpen, ClipboardList, GraduationCap, ListTodo, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '../../../../components/common/Button.jsx';
import { Badge } from '../../../../components/common/Card.jsx';
import { cx } from '../../../../utils/cx.js';
import { deleteRecord, updateRecord } from '../../data/store.js';
import { useRunner } from '../../data/hooks.js';
import { SelectField } from '../../shared/Fields.jsx';
import { ActionMenu, DeleteDialog, EmptyState, Section } from '../../shared/ui.jsx';
import { daysFromToday, formatClock, shortDate } from '../../shared/format.js';
import { ACTIVITY_LABELS } from '../agenda.js';
import { WEEKDAY_NAMES } from '../UniversityForms.jsx';
import { usePlannerActions } from '../PlannerContext.js';
import { usePlanner } from '../usePlanner.js';

const WEEK = [1, 2, 3, 4, 5, 6, 0];

function Timetable({ subjects, hourCycle }) {
  const slots = subjects.filter((s) => !s.archived).flatMap((s) => s.schedule.map((slot) => ({ ...slot, subject: s })));
  const days = WEEK.filter((d) => d !== 0 || slots.some((s) => s.weekday === 0));
  if (!slots.length) return <p className="org-muted">Añade el horario de tus materias y aquí verás tu semana de clases.</p>;
  return (
    <div className="org-timetable">
      {days.map((day) => {
        const list = slots.filter((s) => s.weekday === day).sort((a, b) => a.start.localeCompare(b.start));
        return (
          <section key={day} className="org-timetable__day" aria-label={WEEKDAY_NAMES[day]}>
            <h3>{WEEKDAY_NAMES[day]}</h3>
            {list.length ? (
              <ul>
                {list.map((slot) => (
                  <li key={`${slot.subject.id}-${slot.start}`} style={{ '--item-color': slot.subject.color }}>
                    <span className="org-timetable__time">
                      {formatClock(slot.start, hourCycle)}–{formatClock(slot.end, hourCycle)}
                    </span>
                    <span className="org-timetable__name">{slot.subject.name}</span>
                    {(slot.room || slot.subject.room) && <span className="org-subtle">{slot.room || slot.subject.room}</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="org-subtle">Sin clases</p>
            )}
          </section>
        );
      })}
    </div>
  );
}

export function ActivityRow({ activity, compact = false }) {
  const planner = usePlanner();
  const run = useRunner();
  const { openActivity, openTask } = usePlannerActions();
  const [remove, setRemove] = useState(false);
  const subject = planner.subjectsById.get(activity.subjectId);
  const done = activity.status === 'done';
  const late = !done && activity.status !== 'cancelled' && activity.dueDate < planner.today;
  const tasks = planner.tasks.filter((t) => t.activityId === activity.id);
  return (
    <li className={cx('org-row org-task', compact && 'org-row--compact', (done || activity.status === 'cancelled') && 'is-muted')} style={{ '--item-color': subject?.color }}>
      <input
        type="checkbox"
        className="org-task__check"
        checked={done}
        onChange={() => run(() => updateRecord(activity.id, { status: done ? 'pending' : 'done', completedAt: done ? null : new Date().toISOString() }), { success: done ? 'Actividad reabierta' : 'Actividad completada' })}
        aria-label={done ? `Reabrir «${activity.title}»` : `Completar «${activity.title}»`}
      />
      <button type="button" className="org-row__main" onClick={() => openActivity(activity)}>
        <span className={cx('org-row__title', done && 'org-done')}>
          <span className="org-dot" style={{ '--dot-color': subject?.color ?? 'var(--c-secondary)' }} aria-hidden="true" /> {ACTIVITY_LABELS[activity.type]}: {activity.title}
        </span>
        <span className="org-row__meta">
          <span className={late ? 'is-negative' : undefined}>
            {shortDate(activity.dueDate)} ({daysFromToday(activity.dueDate, planner.today)}){activity.dueTime && ` · ${formatClock(activity.dueTime, planner.hourCycle)}`}
          </span>
          {subject && <span>{subject.name}</span>}
          {activity.weight !== null && <span>{activity.weight} % de la nota</span>}
          {activity.grade && <span>Nota: {activity.grade}</span>}
          {tasks.length > 0 && (
            <span>
              {tasks.filter((t) => t.status === 'done').length}/{tasks.length} tareas
            </span>
          )}
          {activity.status === 'in_progress' && <Badge>En curso</Badge>}
        </span>
      </button>
      {!compact && (
        <ActionMenu
          label={`Acciones de «${activity.title}»`}
          items={[
            { label: 'Editar', icon: Pencil, onClick: () => openActivity(activity) },
            { label: 'Crear tarea para esta entrega', icon: ListTodo, onClick: () => openTask({ activityId: activity.id, subjectId: activity.subjectId, dueDate: activity.dueDate, title: `Preparar: ${activity.title}`.slice(0, 140) }) },
            { label: 'Eliminar', icon: Trash2, danger: true, onClick: () => setRemove(true) },
          ]}
        />
      )}
      <DeleteDialog
        open={remove}
        recordId={activity.id}
        title={`¿Eliminar «${activity.title}»?`}
        onCancel={() => setRemove(false)}
        onConfirm={async () => {
          const { ok } = await run(() => deleteRecord(activity.id), { success: 'Actividad eliminada' });
          if (ok) setRemove(false);
        }}
      />
    </li>
  );
}

export function University() {
  const planner = usePlanner();
  const run = useRunner();
  const { openSubject, openActivity } = usePlannerActions();
  const [showArchived, setShowArchived] = useState(false);
  const [remove, setRemove] = useState(null);
  const [subjectId, setSubjectId] = useState(null);
  const [status, setStatus] = useState('pending');
  const [type, setType] = useState(null);

  const subjects = planner.subjects.filter((s) => Boolean(s.archived) === showArchived).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  const activities = useMemo(
    () =>
      planner.activities
        .filter((a) => (!subjectId || a.subjectId === subjectId) && (!type || a.type === type))
        .filter((a) => (status === 'pending' ? a.status === 'pending' || a.status === 'in_progress' : status === 'all' ? true : a.status === status))
        .sort((a, b) => (status === 'done' ? b.dueDate.localeCompare(a.dueDate) : a.dueDate.localeCompare(b.dueDate))),
    [planner.activities, subjectId, type, status],
  );

  return (
    <div className="org-stack">
      <div className="org-toolbar">
        <Button icon={Plus} onClick={() => openSubject(null)}>
          Nueva materia
        </Button>
        <Button variant="secondary" icon={ClipboardList} onClick={() => openActivity(null)}>
          Nueva entrega o examen
        </Button>
      </div>

      <Section title="Mi semana de clases" description="Las clases aparecen solas en el calendario entre el inicio y el fin de clases de cada materia.">
        <Timetable subjects={planner.subjects} hourCycle={planner.hourCycle} />
      </Section>

      <Section
        title="Materias"
        action={
          planner.subjects.some((s) => s.archived) && (
            <Button variant="ghost" size="sm" onClick={() => setShowArchived((v) => !v)} aria-pressed={showArchived}>
              {showArchived ? 'Ver actuales' : 'Ver archivadas'}
            </Button>
          )
        }
      >
        {subjects.length ? (
          <ul className="org-grid org-list">
            {subjects.map((s) => {
              const pending = planner.activities.filter((a) => a.subjectId === s.id && (a.status === 'pending' || a.status === 'in_progress'));
              const next = [...pending].sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
              return (
                <li key={s.id} className="org-panel org-subject" style={{ '--badge-color': s.color }}>
                  <div className="org-budget__head">
                    <div className="org-subject__title">
                      <span className="org-icon-badge" aria-hidden="true">
                        <BookOpen />
                      </span>
                      <div>
                        <h3 className="org-row__title">{s.name}</h3>
                        <p className="org-subtle">{[s.code, s.semester].filter(Boolean).join(' · ') || 'Sin código'}</p>
                      </div>
                    </div>
                    <ActionMenu
                      label={`Acciones de ${s.name}`}
                      items={[
                        { label: 'Editar', icon: Pencil, onClick: () => openSubject(s) },
                        { label: 'Nueva entrega o examen', icon: ClipboardList, onClick: () => openActivity({ subjectId: s.id }) },
                        { label: s.archived ? 'Restaurar' : 'Archivar (terminó el semestre)', icon: s.archived ? ArchiveRestore : Archive, onClick: () => run(() => updateRecord(s.id, { archived: !s.archived }), { success: s.archived ? 'Materia restaurada' : 'Materia archivada: sus clases dejan de aparecer' }) },
                        { label: 'Eliminar', icon: Trash2, danger: true, onClick: () => setRemove(s) },
                      ]}
                    />
                  </div>
                  {s.teacher && <p className="org-muted">Docente: {s.teacher}{s.teacherContact && ` · ${s.teacherContact}`}</p>}
                  {s.schedule.length > 0 && (
                    <p className="org-subtle">
                      {s.schedule.map((slot) => `${WEEKDAY_NAMES[slot.weekday].slice(0, 3)} ${formatClock(slot.start, planner.hourCycle)}`).join(' · ')}
                      {s.room && ` · ${s.room}`}
                    </p>
                  )}
                  <p className="org-subtle">
                    {pending.length ? `${pending.length} pendientes · próxima: ${next.title} (${daysFromToday(next.dueDate, planner.today)})` : 'Nada pendiente'}
                  </p>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState icon={GraduationCap} title={showArchived ? 'No hay materias archivadas' : 'Sin materias todavía'} action={!showArchived && <Button icon={Plus} onClick={() => openSubject(null)}>Añadir una materia</Button>}>
            Con su horario, docente y salón; sus clases, exámenes y entregas aparecerán en el calendario.
          </EmptyState>
        )}
      </Section>

      <Section title="Entregas, exámenes y lecturas">
        <div className="org-filters">
          <SelectField
            label="Estado"
            value={status}
            onChange={(v) => setStatus(v ?? 'pending')}
            options={[{ value: 'pending', label: 'Pendientes' }, { value: 'done', label: 'Hechas' }, { value: 'cancelled', label: 'Canceladas' }, { value: 'all', label: 'Todas' }]}
          />
          <SelectField label="Materia" value={subjectId} onChange={setSubjectId} placeholder="Todas" options={planner.subjects.map((s) => ({ value: s.id, label: s.name }))} />
          <SelectField label="Tipo" value={type} onChange={setType} placeholder="Todos" options={Object.entries(ACTIVITY_LABELS).map(([value, label]) => ({ value, label }))} />
        </div>
        {activities.length ? (
          <ul className="org-list">
            {activities.map((a) => (
              <ActivityRow key={a.id} activity={a} />
            ))}
          </ul>
        ) : (
          <p className="org-muted">{planner.activities.length ? 'Nada con estos filtros.' : 'Cuando registres un trabajo, examen, parcial, exposición, entrega o lectura, aparecerá aquí y en el calendario.'}</p>
        )}
      </Section>

      <DeleteDialog
        open={Boolean(remove)}
        recordId={remove?.id}
        title={`¿Eliminar la materia «${remove?.name ?? ''}»?`}
        onCancel={() => setRemove(null)}
        onConfirm={async () => {
          const { ok } = await run(() => deleteRecord(remove.id), { success: 'Materia eliminada' });
          if (ok) setRemove(null);
        }}
        extraWarning={<p>Si el semestre terminó, archivarla conserva su historial y deja de mostrar sus clases.</p>}
      />
    </div>
  );
}
