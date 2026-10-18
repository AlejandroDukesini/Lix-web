import { useMemo, useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { Button } from '../../../components/common/Button.jsx';
import { Dialog } from '../../../components/common/Dialog.jsx';
import { commit } from '../data/store.js';
import { useRunner } from '../data/hooks.js';
import { addDays, dayNumber } from '../data/recurrence.js';
import { CheckboxField, ColorPicker, InputField, RecurrenceField, RemindersField, SelectField, TagsField, TextAreaField } from '../shared/Fields.jsx';
import { FormDialog } from '../shared/ui.jsx';
import { formatClock, PRIORITY_LABELS } from '../shared/format.js';
import { editOccurrence } from './actions.js';
import { findConflicts } from './agenda.js';
import { usePlanner } from './usePlanner.js';

export const EVENT_STATUS = { scheduled: 'Programado', completed: 'Completado', cancelled: 'Cancelado' };

/**
 * Pregunta a qué parte de una serie se aplica un cambio. `onChoose(scope)`.
 * Si la ocurrencia es la primera, «esta y las siguientes» equivale a toda la serie.
 */
export function ScopeDialog({ open, verb = 'Guardar', onChoose, onCancel, allowOne = true }) {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title="Este evento se repite"
      description={`¿${verb} solo esta vez o también las demás?`}
      size="sm"
      footer={
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      }
    >
      <div className="org-scope">
        {allowOne && (
          <Button variant="secondary" onClick={() => onChoose('one')}>
            Solo esta vez
          </Button>
        )}
        <Button variant="secondary" onClick={() => onChoose('following')}>
          Esta y las siguientes
        </Button>
        <Button variant="secondary" onClick={() => onChoose('all')}>
          Toda la serie
        </Button>
      </div>
    </Dialog>
  );
}

function draftFrom(initial, occurrence, planner) {
  const start = occurrence?.date ?? initial?.startDate ?? planner.today;
  const span = initial?.endDate ? dayNumber(initial.endDate) - dayNumber(initial.startDate) : 0;
  const exception = occurrence ? initial?.exceptions?.[occurrence.date] : null;
  return {
    title: exception?.title ?? initial?.title ?? '',
    description: initial?.description ?? '',
    startDate: start,
    startTime: exception?.startTime ?? initial?.startTime ?? '',
    endDate: addDays(start, span),
    endTime: exception?.endTime ?? initial?.endTime ?? '',
    allDay: initial?.allDay ?? false,
    categoryId: initial?.categoryId ?? null,
    location: initial?.location ?? '',
    priority: initial?.priority ?? 'normal',
    status: exception?.status ?? initial?.status ?? 'scheduled',
    color: initial?.color ?? null,
    tags: initial?.tags ?? [],
    reminders: initial?.reminders ?? (initial?.id ? [] : [planner.settings.defaultReminder]),
    recurrence: initial?.recurrence ?? null,
    notes: exception?.notes ?? initial?.notes ?? '',
    subjectId: initial?.subjectId ?? null,
  };
}

/**
 * Crear o editar un evento. Al editar una ocurrencia de una serie (`occurrence`),
 * pregunta si el cambio es para esa vez, las siguientes o toda la serie.
 * Los solapes se avisan pero no impiden guardar.
 */
export function EventForm({ open, onClose, initial, occurrence }) {
  const planner = usePlanner();
  const run = useRunner();
  const isEdit = Boolean(initial?.id);
  const [draft, setDraft] = useState(null);
  const [errors, setErrors] = useState(null);
  const [askScope, setAskScope] = useState(null); // resolve(scope)
  if (open && !draft) setDraft(draftFrom(initial, occurrence, planner));
  if (!open && draft) setDraft(null);

  const conflicts = useMemo(() => {
    if (!draft || draft.allDay || !draft.startTime) return [];
    const items = planner.agenda(draft.startDate, draft.startDate, { task: false, payment: false });
    return findConflicts(items, { date: draft.startDate, startTime: draft.startTime, endTime: draft.endTime || null, ignoreKeyPrefix: isEdit ? `event:${initial.id}:` : undefined });
  }, [draft, planner, isEdit, initial]);

  if (!draft) return null;
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

  const chooseScope = () => new Promise((resolve) => setAskScope(() => resolve));

  const submit = async () => {
    const data = { ...draft, startTime: draft.startTime || null, endTime: draft.endTime || null, endDate: draft.endDate || draft.startDate };
    let scope = 'all';
    if (isEdit && initial.recurrence && occurrence) {
      scope = await chooseScope();
      setAskScope(null);
      if (!scope) return false;
      if (scope === 'all') {
        // La ocurrencia editada no es el inicio de la serie: se desplaza la serie lo mismo que se movió esta fecha.
        const delta = dayNumber(draft.startDate) - dayNumber(occurrence.date);
        const span = dayNumber(data.endDate) - dayNumber(data.startDate);
        data.startDate = addDays(initial.startDate, delta);
        data.endDate = addDays(data.startDate, span);
      }
    }
    const operation = isEdit ? () => editOccurrence(initial.id, occurrence?.date ?? initial.startDate, data, scope) : () => commit((tx) => tx.create('event', data));
    const { ok, errors: e } = await run(operation, { success: isEdit ? 'Evento actualizado' : 'Evento creado' });
    setErrors(e);
    return ok;
  };

  const categoryOptions = planner.categories.filter((c) => !c.archived || c.id === draft.categoryId).map((c) => ({ value: c.id, label: c.name }));
  return (
    <>
      <FormDialog open={open} onClose={onClose} title={isEdit ? 'Editar evento' : 'Nuevo evento'} onSubmit={submit} errors={errors} size="lg">
        <InputField label="Título" value={draft.title} onChange={(title) => set({ title })} error={errors?.title} maxLength={120} autoFocus />
        <CheckboxField label="Todo el día" checked={draft.allDay} onChange={(allDay) => set({ allDay })} />
        <div className="org-form__row">
          <InputField
            label="Empieza"
            type="date"
            value={draft.startDate}
            onChange={(startDate) => set({ startDate, endDate: draft.endDate < startDate || draft.endDate === draft.startDate ? startDate : draft.endDate })}
            error={errors?.startDate}
          />
          {!draft.allDay && <InputField label="Hora de inicio" type="time" value={draft.startTime} onChange={(startTime) => set({ startTime })} error={errors?.startTime} />}
          <InputField label="Termina" type="date" value={draft.endDate} min={draft.startDate} onChange={(endDate) => set({ endDate })} error={errors?.endDate} />
          {!draft.allDay && <InputField label="Hora de fin" type="time" value={draft.endTime} onChange={(endTime) => set({ endTime })} error={errors?.endTime} />}
        </div>
        {conflicts.length > 0 && (
          <p className="org-banner org-banner--warning" role="status">
            <TriangleAlert aria-hidden="true" />
            <span>
              Se cruza con: {conflicts.map((c) => `${c.title} (${formatClock(c.startTime, planner.hourCycle)}${c.endTime ? `–${formatClock(c.endTime, planner.hourCycle)}` : ''})`).join(', ')}. Puedes guardarlo
              igualmente.
            </span>
          </p>
        )}
        <div className="org-form__row">
          <SelectField label="Categoría" value={draft.categoryId} onChange={(categoryId) => set({ categoryId })} options={categoryOptions} placeholder="Sin categoría" />
          <SelectField label="Prioridad" value={draft.priority} onChange={(priority) => set({ priority })} options={Object.entries(PRIORITY_LABELS).map(([value, label]) => ({ value, label }))} />
          {isEdit && <SelectField label="Estado" value={draft.status} onChange={(status) => set({ status })} options={Object.entries(EVENT_STATUS).map(([value, label]) => ({ value, label }))} />}
        </div>
        <InputField label="Ubicación (opcional)" value={draft.location} onChange={(location) => set({ location })} maxLength={160} />
        <RecurrenceField value={draft.recurrence} onChange={(recurrence) => set({ recurrence })} startDate={draft.startDate} error={errors?.recurrence} />
        <RemindersField value={draft.reminders} onChange={(reminders) => set({ reminders })} hint="Avisan mientras la app esté abierta (ver Ajustes del calendario)." />
        <details className="org-more" open={Boolean(draft.description || draft.notes || draft.tags.length || draft.subjectId)}>
          <summary>Descripción, notas, etiquetas y color</summary>
          <div className="org-more__body">
            <TextAreaField label="Descripción" value={draft.description} onChange={(description) => set({ description })} rows={3} maxLength={4000} />
            <TextAreaField label="Notas adicionales" value={draft.notes} onChange={(notes) => set({ notes })} rows={3} maxLength={4000} />
            <SelectField
              label="Materia relacionada"
              value={draft.subjectId}
              onChange={(subjectId) => set({ subjectId })}
              placeholder="Ninguna"
              options={planner.subjects.filter((s) => !s.archived || s.id === draft.subjectId).map((s) => ({ value: s.id, label: s.name }))}
            />
            <TagsField value={draft.tags} onChange={(tags) => set({ tags })} suggestions={[...new Set(planner.events.flatMap((e) => e.tags))]} />
            <ColorPicker label="Color propio (si no, el de la categoría)" value={draft.color} onChange={(color) => set({ color })} allowNone />
          </div>
        </details>
      </FormDialog>
      <ScopeDialog
        open={Boolean(askScope)}
        onChoose={(scope) => askScope?.(scope)}
        onCancel={() => {
          askScope?.(null);
          setAskScope(null);
        }}
      />
    </>
  );
}
