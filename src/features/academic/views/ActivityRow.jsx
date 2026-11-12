import { useState } from 'react';
import { ListTodo, Pencil, Trash2 } from 'lucide-react';
import { Badge } from '../../../components/common/Card.jsx';
import { cx } from '../../../utils/cx.js';
import { deleteRecord, updateRecord } from '../../organizer/data/store.js';
import { useRunner } from '../../organizer/data/hooks.js';
import { ActionMenu, DeleteDialog } from '../../organizer/shared/ui.jsx';
import { daysFromToday, formatClock, shortDate } from '../../organizer/shared/format.js';
import { ACTIVITY_LABELS } from '../../organizer/planner/agenda.js';
import { usePlannerActions } from '../../organizer/planner/PlannerContext.js';
import { usePlanner } from '../../organizer/planner/usePlanner.js';

/** Fila de una actividad académica (entrega, examen, lectura…): completar, editar, crear tarea o eliminar. */
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
