import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button, IconButton } from '../../../components/common/Button.jsx';
import { commit, newId } from '../data/store.js';
import { useRunner } from '../data/hooks.js';
import { InputField, RemindersField, SelectField, TagsField, TextAreaField } from '../shared/Fields.jsx';
import { FormDialog } from '../shared/ui.jsx';
import { PRIORITY_LABELS } from '../shared/format.js';
import { ACTIVITY_LABELS } from './agenda.js';
import { usePlanner } from './usePlanner.js';

export const TASK_STATUS = { todo: 'Pendiente', doing: 'En curso', done: 'Hecha', cancelled: 'Cancelada' };

/** Crear o editar una tarea, con subtareas y relación opcional con materia, evento o actividad. */
export function TaskForm({ open, onClose, initial }) {
  const planner = usePlanner();
  const run = useRunner();
  const isEdit = Boolean(initial?.id);
  const [draft, setDraft] = useState(null);
  const [errors, setErrors] = useState(null);
  const [subtask, setSubtask] = useState('');
  if (open && !draft) {
    setDraft({
      title: initial?.title ?? '',
      description: initial?.description ?? '',
      dueDate: initial?.dueDate ?? '',
      dueTime: initial?.dueTime ?? '',
      priority: initial?.priority ?? 'normal',
      status: initial?.status ?? 'todo',
      categoryId: initial?.categoryId ?? null,
      subjectId: initial?.subjectId ?? null,
      eventId: initial?.eventId ?? null,
      activityId: initial?.activityId ?? null,
      subtasks: initial?.subtasks ?? [],
      tags: initial?.tags ?? [],
      reminders: initial?.reminders ?? [],
    });
  }
  if (!open && draft) setDraft(null);
  if (!draft) return null;
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const addSubtask = () => {
    const title = subtask.trim();
    if (!title) return;
    set({ subtasks: [...draft.subtasks, { id: newId(), title: title.slice(0, 140), done: false }] });
    setSubtask('');
  };
  const submit = async () => {
    const data = { ...draft, dueDate: draft.dueDate || null, dueTime: draft.dueTime || null };
    const { ok, errors: e } = await run(() => commit((tx) => (isEdit ? tx.update(initial.id, data) : tx.create('task', data))), { success: isEdit ? 'Tarea actualizada' : 'Tarea creada' });
    setErrors(e);
    return ok;
  };
  const activities = planner.activities.filter((a) => a.status !== 'done' || a.id === draft.activityId);
  return (
    <FormDialog open={open} onClose={onClose} title={isEdit ? 'Editar tarea' : 'Nueva tarea'} onSubmit={submit} errors={errors} size="lg">
      <InputField label="Título" value={draft.title} onChange={(title) => set({ title })} error={errors?.title} maxLength={140} autoFocus />
      <div className="org-form__row">
        <InputField label="Fecha límite (opcional)" type="date" value={draft.dueDate} onChange={(dueDate) => set({ dueDate })} error={errors?.dueDate} />
        {draft.dueDate && <InputField label="Hora (opcional)" type="time" value={draft.dueTime} onChange={(dueTime) => set({ dueTime })} />}
        <SelectField label="Prioridad" value={draft.priority} onChange={(priority) => set({ priority })} options={Object.entries(PRIORITY_LABELS).map(([value, label]) => ({ value, label }))} />
        <SelectField label="Estado" value={draft.status} onChange={(status) => set({ status })} options={Object.entries(TASK_STATUS).map(([value, label]) => ({ value, label }))} />
      </div>
      <fieldset className="org-form__group">
        <legend>Subtareas</legend>
        {draft.subtasks.length > 0 && (
          <ul className="org-subtasks">
            {draft.subtasks.map((s) => (
              <li key={s.id}>
                <input type="checkbox" checked={s.done} onChange={() => set({ subtasks: draft.subtasks.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)) })} aria-label={`Hecha: ${s.title}`} />
                <input
                  className="field__control"
                  value={s.title}
                  onChange={(event) => set({ subtasks: draft.subtasks.map((x) => (x.id === s.id ? { ...x, title: event.target.value } : x)) })}
                  aria-label="Texto de la subtarea"
                  maxLength={140}
                />
                <IconButton icon={X} size="sm" label={`Quitar «${s.title}»`} onClick={() => set({ subtasks: draft.subtasks.filter((x) => x.id !== s.id) })} />
              </li>
            ))}
          </ul>
        )}
        <div className="org-inline-add">
          <input
            className="field__control"
            value={subtask}
            onChange={(event) => setSubtask(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addSubtask();
              }
            }}
            placeholder="Añadir una subtarea y pulsar Enter"
            aria-label="Nueva subtarea"
            maxLength={140}
          />
          <Button variant="secondary" size="sm" icon={Plus} onClick={addSubtask}>
            Añadir
          </Button>
        </div>
        {errors?.subtasks && <p className="field__error">{errors.subtasks}</p>}
      </fieldset>
      <div className="org-form__row">
        <SelectField label="Categoría" value={draft.categoryId} onChange={(categoryId) => set({ categoryId })} placeholder="Sin categoría" options={planner.categories.filter((c) => !c.archived || c.id === draft.categoryId).map((c) => ({ value: c.id, label: c.name }))} />
        <SelectField label="Materia" value={draft.subjectId} onChange={(subjectId) => set({ subjectId })} placeholder="Ninguna" options={planner.subjects.filter((s) => !s.archived || s.id === draft.subjectId).map((s) => ({ value: s.id, label: s.name }))} />
      </div>
      <div className="org-form__row">
        <SelectField
          label="Entrega o examen relacionado"
          value={draft.activityId}
          onChange={(activityId) => set({ activityId })}
          placeholder="Ninguno"
          options={activities.map((a) => ({ value: a.id, label: `${ACTIVITY_LABELS[a.type]}: ${a.title}` }))}
        />
        <SelectField
          label="Evento relacionado"
          value={draft.eventId}
          onChange={(eventId) => set({ eventId })}
          placeholder="Ninguno"
          options={planner.events.filter((e) => e.endDate >= planner.today || e.recurrence || e.id === draft.eventId).map((e) => ({ value: e.id, label: e.title }))}
        />
      </div>
      <TextAreaField label="Descripción (opcional)" value={draft.description} onChange={(description) => set({ description })} rows={3} maxLength={4000} />
      <TagsField value={draft.tags} onChange={(tags) => set({ tags })} suggestions={[...new Set(planner.tasks.flatMap((t) => t.tags))]} />
      {draft.dueDate && <RemindersField value={draft.reminders} onChange={(reminders) => set({ reminders })} hint="Antes de la hora límite (o de las 9:00 si no tiene hora)." />}
    </FormDialog>
  );
}
