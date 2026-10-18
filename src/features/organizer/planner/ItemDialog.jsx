import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Ban, CalendarX2, Check, Copy, ListTodo, MapPin, NotebookPen, Pencil, RotateCcw, StickyNote, Trash2 } from 'lucide-react';
import { Button } from '../../../components/common/Button.jsx';
import { Badge } from '../../../components/common/Card.jsx';
import { Dialog } from '../../../components/common/Dialog.jsx';
import { deleteRecord, duplicateRecord, getRecord, updateRecord } from '../data/store.js';
import { useKind, useRunner } from '../data/hooks.js';
import { describeRule } from '../data/recurrence.js';
import { DeleteDialog } from '../shared/ui.jsx';
import { formatClock, longDate, minutesLabel, PRIORITY_LABELS, shortDate } from '../shared/format.js';
import { formatMoney } from '../finance/money.js';
import { OccurrenceActions } from '../finance/views/Scheduled.jsx';
import { deleteOccurrence, setClassSkipped, setOccurrenceStatus, setTaskDone } from './actions.js';
import { ITEM_TYPES } from './agenda.js';
import { EVENT_STATUS, ScopeDialog } from './EventForm.jsx';
import { TASK_STATUS } from './TaskForm.jsx';
import { ACTIVITY_STATUS } from './UniversityForms.jsx';
import { usePlannerActions } from './PlannerContext.js';
import { usePlanner } from './usePlanner.js';

const STATUS_BY_TYPE = { event: EVENT_STATUS, task: TASK_STATUS, activity: ACTIVITY_STATUS };

/** Notas, tareas, entradas del diario y registros emocionales vinculados a un evento. */
function Related({ eventId, onNavigate }) {
  const notes = useKind('note').filter((n) => n.eventId === eventId && !n.trashedAt);
  const tasks = useKind('task').filter((t) => t.eventId === eventId);
  const entries = useKind('journalEntry').filter((e) => e.relatedEventIds.includes(eventId) && !e.trashedAt);
  const navigate = useNavigate();
  const { openTask } = usePlannerActions();
  const go = (path) => {
    onNavigate();
    navigate(path);
  };
  return (
    <div className="org-related">
      <h3 className="org-related__title">Relacionado</h3>
      {notes.length + tasks.length + entries.length === 0 && <p className="org-subtle">Todavía nada vinculado a este evento.</p>}
      <ul className="org-mini-list">
        {notes.map((n) => (
          <li key={n.id}>
            <button type="button" className="org-link" onClick={() => go(`/notas/${n.id}`)}>
              <StickyNote aria-hidden="true" width={16} height={16} /> {n.title || 'Nota sin título'}
            </button>
          </li>
        ))}
        {tasks.map((t) => (
          <li key={t.id}>
            <button type="button" className="org-link" onClick={() => openTask(t)}>
              <ListTodo aria-hidden="true" width={16} height={16} /> {t.title}
            </button>
            <Badge tone={t.status === 'done' ? 'success' : undefined}>{TASK_STATUS[t.status]}</Badge>
          </li>
        ))}
        {entries.map((e) => (
          <li key={e.id}>
            <button type="button" className="org-link" onClick={() => go(`/diario/${e.id}`)}>
              <NotebookPen aria-hidden="true" width={16} height={16} /> {e.title || `Diario del ${shortDate(e.eventDate)}`}
            </button>
          </li>
        ))}
      </ul>
      <div className="org-toolbar">
        <Button size="sm" variant="secondary" icon={StickyNote} onClick={() => go(`/notas/nueva?evento=${eventId}`)}>
          Nota para este evento
        </Button>
        <Button size="sm" variant="secondary" icon={ListTodo} onClick={() => openTask({ eventId, dueDate: getRecord(eventId)?.startDate })}>
          Tarea para este evento
        </Button>
      </div>
    </div>
  );
}

/** Detalle de cualquier elemento de la agenda con sus acciones. */
export function ItemDialog({ item, onClose }) {
  const planner = usePlanner();
  const run = useRunner();
  const navigate = useNavigate();
  const { openEvent, openTask, openActivity, openSubject } = usePlannerActions();
  const [scope, setScope] = useState(null); // 'delete'
  const [remove, setRemove] = useState(false);
  if (!item) return null;
  const source = getRecord(item.sourceId);
  const color = planner.colorOf(item);
  const category = planner.categoriesById.get(item.categoryId);
  const time = item.allDay ? 'Todo el día' : `${formatClock(item.startTime, planner.hourCycle)}${item.endTime ? ` – ${formatClock(item.endTime, planner.hourCycle)}` : ''}`;
  const statusLabel = STATUS_BY_TYPE[item.type]?.[item.status];
  const done = item.status === 'completed' || item.status === 'done';

  const edit = () => {
    onClose();
    if (item.type === 'event') openEvent(source, item.recurring ? { date: item.occurrence } : null);
    else if (item.type === 'task') openTask(source);
    else if (item.type === 'activity') openActivity(source);
    else if (item.type === 'class') openSubject(source);
    else navigate('/finanzas/pagos');
  };

  const toggleDone = () => {
    if (item.type === 'event') return run(() => setOccurrenceStatus(item.sourceId, item.occurrence, done ? 'scheduled' : 'completed'), { success: done ? 'Evento reabierto' : 'Evento completado' });
    if (item.type === 'task') return run(() => setTaskDone(item.sourceId, !done), { success: done ? 'Tarea reabierta' : 'Tarea completada' });
    return run(() => updateRecord(item.sourceId, { status: done ? 'pending' : 'done', completedAt: done ? null : new Date().toISOString() }), { success: done ? 'Actividad reabierta' : 'Actividad completada' });
  };

  const removeEvent = async (chosen) => {
    setScope(null);
    if (!chosen) return;
    const { ok } = await run(() => deleteOccurrence(item.sourceId, item.occurrence, chosen), { success: chosen === 'one' ? 'Ocurrencia eliminada' : 'Evento eliminado' });
    if (ok) onClose();
  };

  return (
    <>
      <Dialog open onClose={onClose} title={item.title} size="md" className="org-item-dialog">
        <div className="org-item" style={{ '--item-color': color }}>
          <p className="org-item__when">
            <span className="org-dot" style={{ '--dot-color': color }} aria-hidden="true" />
            {longDate(item.date)}
            {item.endDate && item.endDate !== item.date && ` – ${longDate(item.endDate)}`} · {time}
          </p>
          <div className="org-taglist">
            <span>{ITEM_TYPES[item.type]}</span>
            {category && <span>{category.name}</span>}
            {item.subtitle && <span>{item.subtitle}</span>}
            {statusLabel && <span>{statusLabel}</span>}
            {item.priority === 'high' && <span>Prioridad {PRIORITY_LABELS.high.toLowerCase()}</span>}
          </div>
          {item.location && (
            <p className="org-muted">
              <MapPin aria-hidden="true" width={16} height={16} /> {item.location}
            </p>
          )}
          {item.type === 'event' && source?.recurrence && <p className="org-subtle">{describeRule(source.recurrence, shortDate)}</p>}
          {item.type === 'event' && source?.description && <p className="org-pre">{source.description}</p>}
          {item.notes && <p className="org-pre">{item.notes}</p>}
          {item.reminders?.length > 0 && <p className="org-subtle">Recordatorios: {item.reminders.map(minutesLabel).join(', ')}</p>}
          {item.type === 'task' && source?.subtasks.length > 0 && (
            <p className="org-subtle">
              Subtareas: {source.subtasks.filter((s) => s.done).length} de {source.subtasks.length} hechas
            </p>
          )}
          {item.type === 'payment' && (
            <>
              <p>
                {item.flow === 'income' ? 'Ingreso esperado' : 'Pago'} de <strong>{formatMoney(item.amount)}</strong>
              </p>
              {source && <OccurrenceActions occurrence={{ item: source, date: item.occurrence, state: item.status }} />}
            </>
          )}
          {item.type === 'class' && source && (
            <p className="org-subtle">
              {source.teacher && `Docente: ${source.teacher}. `}
              {source.code && `Código ${source.code}.`}
            </p>
          )}
        </div>

        <div className="org-toolbar org-item__actions">
          <Button variant="secondary" size="sm" icon={Pencil} onClick={edit}>
            {item.type === 'payment' ? 'Ver en Finanzas' : item.type === 'class' ? 'Editar materia' : 'Editar'}
          </Button>
          {['event', 'task', 'activity'].includes(item.type) && (
            <Button variant="secondary" size="sm" icon={done ? RotateCcw : Check} onClick={toggleDone}>
              {done ? 'Reabrir' : 'Completar'}
            </Button>
          )}
          {item.type === 'event' && item.status !== 'cancelled' && (
            <Button variant="ghost" size="sm" icon={Ban} onClick={() => run(() => setOccurrenceStatus(item.sourceId, item.occurrence, 'cancelled'), { success: 'Evento cancelado (sigue en el historial)' })}>
              Cancelar
            </Button>
          )}
          {item.type === 'event' && (
            <Button variant="ghost" size="sm" icon={Copy} onClick={() => run(() => duplicateRecord(item.sourceId, { exceptions: {} }), { success: 'Evento duplicado' })}>
              Duplicar
            </Button>
          )}
          {item.type === 'class' && (
            <Button variant="ghost" size="sm" icon={CalendarX2} onClick={async () => (await run(() => setClassSkipped(item.sourceId, item.date, true), { success: 'Ese día no habrá clase' })).ok && onClose()}>
              No hay clase este día
            </Button>
          )}
          {['event', 'task', 'activity'].includes(item.type) && (
            <Button variant="ghost" size="sm" icon={Trash2} onClick={() => (item.type === 'event' && item.recurring ? setScope('delete') : setRemove(true))}>
              Eliminar
            </Button>
          )}
        </div>
        {item.type === 'event' && <Related eventId={item.sourceId} onNavigate={onClose} />}
      </Dialog>
      <ScopeDialog open={scope === 'delete'} verb="Eliminar" onChoose={removeEvent} onCancel={() => setScope(null)} />
      <DeleteDialog
        open={remove}
        recordId={item.sourceId}
        title={`¿Eliminar «${source?.title ?? item.title}»?`}
        onCancel={() => setRemove(false)}
        onConfirm={async () => {
          const { ok } = await run(() => deleteRecord(item.sourceId), { success: 'Eliminado' });
          if (ok) {
            setRemove(false);
            onClose();
          }
        }}
      />
    </>
  );
}
