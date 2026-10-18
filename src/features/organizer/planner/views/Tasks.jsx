import { useMemo, useState } from 'react';
import { Copy, ListTodo, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '../../../../components/common/Button.jsx';
import { Badge } from '../../../../components/common/Card.jsx';
import { cx } from '../../../../utils/cx.js';
import { createRecord, deleteRecord, duplicateRecord } from '../../data/store.js';
import { useRunner } from '../../data/hooks.js';
import { SelectField } from '../../shared/Fields.jsx';
import { ActionMenu, DeleteDialog, EmptyState, SearchField } from '../../shared/ui.jsx';
import { daysFromToday, formatClock, PRIORITY_LABELS, shortDate } from '../../shared/format.js';
import { matchesQuery } from '../../shared/text.js';
import { setTaskDone, toggleSubtask } from '../actions.js';
import { ACTIVITY_LABELS } from '../agenda.js';
import { usePlannerActions } from '../PlannerContext.js';
import { usePlanner } from '../usePlanner.js';

const FILTERS = [
  ['pending', 'Pendientes'],
  ['overdue', 'Vencidas'],
  ['done', 'Hechas'],
  ['all', 'Todas'],
];
const PRIORITY_ORDER = { high: 0, normal: 1, low: 2 };

export function TaskRow({ task, compact = false }) {
  const planner = usePlanner();
  const run = useRunner();
  const { openTask } = usePlannerActions();
  const [remove, setRemove] = useState(false);
  const done = task.status === 'done';
  const overdue = !done && task.status !== 'cancelled' && task.dueDate && task.dueDate < planner.today;
  const subject = planner.subjectsById.get(task.subjectId);
  const activity = task.activityId ? planner.activities.find((a) => a.id === task.activityId) : null;
  const subDone = task.subtasks.filter((s) => s.done).length;
  return (
    <li className={cx('org-row org-task', compact && 'org-row--compact', (done || task.status === 'cancelled') && 'is-muted')}>
      <input
        type="checkbox"
        className="org-task__check"
        checked={done}
        onChange={() => run(() => setTaskDone(task.id, !done), { success: done ? 'Tarea reabierta' : 'Tarea completada' })}
        aria-label={done ? `Reabrir «${task.title}»` : `Completar «${task.title}»`}
      />
      <div className="org-task__body">
        <button type="button" className="org-row__main" onClick={() => openTask(task)}>
          <span className={cx('org-row__title', done && 'org-done')}>{task.title}</span>
          <span className="org-row__meta">
            {task.dueDate && (
              <span className={overdue ? 'is-negative' : undefined}>
                {overdue ? 'Venció' : 'Vence'} {daysFromToday(task.dueDate, planner.today)} · {shortDate(task.dueDate)}
                {task.dueTime && ` ${formatClock(task.dueTime, planner.hourCycle)}`}
              </span>
            )}
            {subject && <span>{subject.name}</span>}
            {activity && <span>{ACTIVITY_LABELS[activity.type]}: {activity.title}</span>}
            {task.subtasks.length > 0 && (
              <span>
                {subDone}/{task.subtasks.length} subtareas
              </span>
            )}
            {task.priority === 'high' && <Badge tone="warning">{PRIORITY_LABELS.high}</Badge>}
            {task.status === 'doing' && <Badge>En curso</Badge>}
          </span>
        </button>
        {!compact && !done && task.subtasks.length > 0 && (
          <ul className="org-subtasks org-subtasks--inline">
            {task.subtasks.map((s) => (
              <li key={s.id}>
                <label>
                  <input type="checkbox" checked={s.done} onChange={() => run(() => toggleSubtask(task.id, s.id))} />
                  <span className={s.done ? 'org-done' : undefined}>{s.title}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
      {!compact && (
        <ActionMenu
          label={`Acciones de «${task.title}»`}
          items={[
            { label: 'Editar', icon: Pencil, onClick: () => openTask(task) },
            { label: 'Duplicar', icon: Copy, onClick: () => run(() => duplicateRecord(task.id, { status: 'todo', completedAt: null, subtasks: task.subtasks.map((s) => ({ ...s, done: false })) }), { success: 'Tarea duplicada' }) },
            { label: 'Eliminar', icon: Trash2, danger: true, onClick: () => setRemove(true) },
          ]}
        />
      )}
      <DeleteDialog
        open={remove}
        recordId={task.id}
        title={`¿Eliminar «${task.title}»?`}
        onCancel={() => setRemove(false)}
        onConfirm={async () => {
          const { ok } = await run(() => deleteRecord(task.id), { success: 'Tarea eliminada' });
          if (ok) setRemove(false);
        }}
      />
    </li>
  );
}

export function Tasks() {
  const planner = usePlanner();
  const run = useRunner();
  const { openTask } = usePlannerActions();
  const [filter, setFilter] = useState('pending');
  const [query, setQuery] = useState('');
  const [subjectId, setSubjectId] = useState(null);
  const [categoryId, setCategoryId] = useState(null);
  const [sort, setSort] = useState('due');
  const [quick, setQuick] = useState('');

  const counts = useMemo(() => {
    const open = planner.tasks.filter((t) => t.status === 'todo' || t.status === 'doing');
    return { pending: open.length, overdue: open.filter((t) => t.dueDate && t.dueDate < planner.today).length, done: planner.tasks.filter((t) => t.status === 'done').length, all: planner.tasks.length };
  }, [planner.tasks, planner.today]);

  const list = useMemo(() => {
    const open = (t) => t.status === 'todo' || t.status === 'doing';
    return planner.tasks
      .filter((t) =>
        filter === 'pending' ? open(t) : filter === 'overdue' ? open(t) && t.dueDate && t.dueDate < planner.today : filter === 'done' ? t.status === 'done' : true,
      )
      .filter((t) => (!subjectId || t.subjectId === subjectId) && (!categoryId || t.categoryId === categoryId))
      .filter((t) => matchesQuery(query, t.title, t.description, t.tags, t.subtasks.map((s) => s.title)))
      .sort((a, b) =>
        sort === 'priority'
          ? PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999')
          : sort === 'recent'
            ? b.createdAt.localeCompare(a.createdAt)
            : filter === 'done'
              ? (b.completedAt ?? '').localeCompare(a.completedAt ?? '')
              : (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority],
      );
  }, [planner.tasks, planner.today, filter, subjectId, categoryId, query, sort]);

  const addQuick = async (event) => {
    event.preventDefault();
    const title = quick.trim();
    if (!title) return;
    const { ok } = await run(() => createRecord('task', { title: title.slice(0, 140) }), { success: 'Tarea añadida' });
    if (ok) setQuick('');
  };

  return (
    <div className="org-stack">
      <form className="org-inline-add" onSubmit={addQuick}>
        <label htmlFor="quick-task" className="sr-only">
          Tarea rápida
        </label>
        <input id="quick-task" className="field__control" value={quick} onChange={(e) => setQuick(e.target.value)} placeholder="Escribe una tarea y pulsa Enter…" maxLength={140} autoComplete="off" />
        <Button type="submit" icon={Plus} disabled={!quick.trim()}>
          Añadir
        </Button>
        <Button variant="secondary" onClick={() => openTask(null)}>
          Con detalles
        </Button>
      </form>
      <div className="org-toolbar">
        <div className="org-segment" role="group" aria-label="Mostrar tareas">
          {FILTERS.map(([value, label]) => (
            <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>
              {label} <span className="org-count">{counts[value]}</span>
            </button>
          ))}
        </div>
      </div>
      <SearchField label="Buscar tareas" value={query} onChange={setQuery} placeholder="Buscar en títulos, descripciones y subtareas…" />
      <div className="org-filters">
        <SelectField label="Materia" value={subjectId} onChange={setSubjectId} placeholder="Todas" options={planner.subjects.map((s) => ({ value: s.id, label: s.name }))} />
        <SelectField label="Categoría" value={categoryId} onChange={setCategoryId} placeholder="Todas" options={planner.categories.map((c) => ({ value: c.id, label: c.name }))} />
        <SelectField
          label="Ordenar por"
          value={sort}
          onChange={(v) => setSort(v ?? 'due')}
          options={[
            { value: 'due', label: 'Fecha límite' },
            { value: 'priority', label: 'Prioridad' },
            { value: 'recent', label: 'Creadas recientemente' },
          ]}
        />
      </div>
      {list.length ? (
        <ul className="org-list">
          {list.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </ul>
      ) : (
        <EmptyState icon={ListTodo} title={filter === 'overdue' ? 'Nada vencido' : filter === 'done' ? 'Ninguna tarea hecha todavía' : 'Sin tareas por aquí'}>
          {planner.tasks.length ? 'Prueba con otro filtro.' : 'Anota lo que tienes que hacer; con fecha límite también aparece en el calendario.'}
        </EmptyState>
      )}
    </div>
  );
}
