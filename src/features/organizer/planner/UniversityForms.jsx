import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button, IconButton } from '../../../components/common/Button.jsx';
import { commit } from '../data/store.js';
import { useRunner } from '../data/hooks.js';
import { ACTIVITY_TYPES } from '../data/entities.js';
import { ColorPicker, InputField, RemindersField, SelectField, TextAreaField } from '../shared/Fields.jsx';
import { FormDialog } from '../shared/ui.jsx';
import { PRIORITY_LABELS } from '../shared/format.js';
import { ACTIVITY_LABELS } from './agenda.js';
import { usePlanner } from './usePlanner.js';

export const WEEKDAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const ACTIVITY_STATUS = { pending: 'Pendiente', in_progress: 'En curso', done: 'Hecha', cancelled: 'Cancelada' };

export function SubjectForm({ open, onClose, initial }) {
  const run = useRunner();
  const isEdit = Boolean(initial?.id);
  const [draft, setDraft] = useState(null);
  const [errors, setErrors] = useState(null);
  if (open && !draft) {
    setDraft({
      name: initial?.name ?? '',
      code: initial?.code ?? '',
      teacher: initial?.teacher ?? '',
      teacherContact: initial?.teacherContact ?? '',
      room: initial?.room ?? '',
      semester: initial?.semester ?? '',
      color: initial?.color ?? '#ef6f8c',
      startDate: initial?.startDate ?? '',
      endDate: initial?.endDate ?? '',
      schedule: initial?.schedule ?? [],
      notes: initial?.notes ?? '',
    });
  }
  if (!open && draft) setDraft(null);
  if (!draft) return null;
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const setSlot = (index, patch) => set({ schedule: draft.schedule.map((s, i) => (i === index ? { ...s, ...patch } : s)) });
  const submit = async () => {
    const data = { ...draft, startDate: draft.startDate || null, endDate: draft.endDate || null };
    const { ok, errors: e } = await run(() => commit((tx) => (isEdit ? tx.update(initial.id, data) : tx.create('subject', data))), { success: isEdit ? 'Materia actualizada' : 'Materia creada' });
    setErrors(e);
    return ok;
  };
  return (
    <FormDialog open={open} onClose={onClose} title={isEdit ? 'Editar materia' : 'Nueva materia'} onSubmit={submit} errors={errors} size="lg">
      <div className="org-form__row">
        <InputField label="Nombre" value={draft.name} onChange={(name) => set({ name })} error={errors?.name} maxLength={80} autoFocus />
        <InputField label="Código (opcional)" value={draft.code} onChange={(code) => set({ code })} maxLength={20} />
      </div>
      <div className="org-form__row">
        <InputField label="Docente" value={draft.teacher} onChange={(teacher) => set({ teacher })} maxLength={80} />
        <InputField label="Contacto del docente" value={draft.teacherContact} onChange={(teacherContact) => set({ teacherContact })} maxLength={120} placeholder="Correo u horario de atención" />
      </div>
      <div className="org-form__row">
        <InputField label="Salón habitual" value={draft.room} onChange={(room) => set({ room })} maxLength={60} />
        <InputField label="Semestre" value={draft.semester} onChange={(semester) => set({ semester })} maxLength={40} placeholder="Ej.: 2026-1" />
      </div>
      <div className="org-form__row">
        <InputField label="Inicio de clases" type="date" value={draft.startDate} onChange={(startDate) => set({ startDate })} hint="Las clases aparecen en el calendario entre estas fechas." />
        <InputField label="Fin de clases" type="date" value={draft.endDate} onChange={(endDate) => set({ endDate })} error={errors?.endDate} />
      </div>
      <fieldset className="org-form__group">
        <legend>Horario semanal</legend>
        {draft.schedule.map((slot, index) => (
          // El índice identifica el bloque mientras se edita (no hay ids por bloque).
          // eslint-disable-next-line react/no-array-index-key
          <div key={index} className="org-slot">
            <SelectField label="Día" value={String(slot.weekday)} onChange={(v) => setSlot(index, { weekday: Number(v) })} options={[1, 2, 3, 4, 5, 6, 0].map((d) => ({ value: String(d), label: WEEKDAY_NAMES[d] }))} />
            <InputField label="Desde" type="time" value={slot.start ?? ''} onChange={(start) => setSlot(index, { start })} />
            <InputField label="Hasta" type="time" value={slot.end ?? ''} onChange={(end) => setSlot(index, { end })} />
            <InputField label="Salón" value={slot.room ?? ''} onChange={(room) => setSlot(index, { room })} maxLength={60} placeholder={draft.room} />
            <IconButton icon={X} label={`Quitar la clase del ${WEEKDAY_NAMES[slot.weekday].toLowerCase()}`} onClick={() => set({ schedule: draft.schedule.filter((_, i) => i !== index) })} />
          </div>
        ))}
        {errors?.schedule && <p className="field__error">{errors.schedule}</p>}
        <Button variant="secondary" size="sm" icon={Plus} onClick={() => set({ schedule: [...draft.schedule, { weekday: 1, start: '07:00', end: '09:00', room: '' }] })} disabled={draft.schedule.length >= 14}>
          Añadir clase
        </Button>
      </fieldset>
      <ColorPicker value={draft.color} onChange={(color) => set({ color })} />
      <TextAreaField label="Notas" value={draft.notes} onChange={(notes) => set({ notes })} rows={3} maxLength={4000} />
    </FormDialog>
  );
}

export function ActivityForm({ open, onClose, initial }) {
  const planner = usePlanner();
  const run = useRunner();
  const isEdit = Boolean(initial?.id);
  const [draft, setDraft] = useState(null);
  const [errors, setErrors] = useState(null);
  if (open && !draft) {
    setDraft({
      subjectId: initial?.subjectId ?? null,
      type: initial?.type ?? 'assignment',
      title: initial?.title ?? '',
      description: initial?.description ?? '',
      dueDate: initial?.dueDate ?? planner.today,
      dueTime: initial?.dueTime ?? '',
      status: initial?.status ?? 'pending',
      priority: initial?.priority ?? 'normal',
      weight: initial?.weight ?? '',
      grade: initial?.grade ?? '',
      reminders: initial?.reminders ?? (isEdit ? [] : [1440]),
      notes: initial?.notes ?? '',
    });
  }
  if (!open && draft) setDraft(null);
  if (!draft) return null;
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const submit = async () => {
    const data = {
      ...draft,
      dueTime: draft.dueTime || null,
      weight: draft.weight === '' ? null : Number(draft.weight),
      completedAt: draft.status === 'done' ? (initial?.completedAt ?? new Date().toISOString()) : null,
    };
    const { ok, errors: e } = await run(() => commit((tx) => (isEdit ? tx.update(initial.id, data) : tx.create('activity', data))), { success: isEdit ? 'Actividad actualizada' : 'Actividad creada: ya aparece en el calendario' });
    setErrors(e);
    return ok;
  };
  return (
    <FormDialog open={open} onClose={onClose} title={isEdit ? 'Editar actividad' : 'Nueva actividad académica'} onSubmit={submit} errors={errors} size="lg">
      <div className="org-form__row">
        <SelectField label="Tipo" value={draft.type} onChange={(type) => set({ type })} options={ACTIVITY_TYPES.map((t) => ({ value: t, label: ACTIVITY_LABELS[t] }))} />
        <SelectField
          label="Materia"
          value={draft.subjectId}
          onChange={(subjectId) => set({ subjectId })}
          placeholder="Sin materia"
          options={planner.subjects.filter((s) => !s.archived || s.id === draft.subjectId).map((s) => ({ value: s.id, label: s.name }))}
          error={errors?.subjectId}
        />
      </div>
      <InputField label="Título" value={draft.title} onChange={(title) => set({ title })} error={errors?.title} maxLength={120} autoFocus />
      <div className="org-form__row">
        <InputField label="Fecha" type="date" value={draft.dueDate} onChange={(dueDate) => set({ dueDate })} error={errors?.dueDate} />
        <InputField label="Hora (opcional)" type="time" value={draft.dueTime} onChange={(dueTime) => set({ dueTime })} />
        <SelectField label="Prioridad" value={draft.priority} onChange={(priority) => set({ priority })} options={Object.entries(PRIORITY_LABELS).map(([value, label]) => ({ value, label }))} />
      </div>
      <div className="org-form__row">
        <SelectField label="Estado" value={draft.status} onChange={(status) => set({ status })} options={Object.entries(ACTIVITY_STATUS).map(([value, label]) => ({ value, label }))} />
        <InputField label="Porcentaje de la nota" type="number" min="0" max="100" value={draft.weight} onChange={(weight) => set({ weight })} error={errors?.weight} />
        <InputField label="Nota obtenida" value={draft.grade} onChange={(grade) => set({ grade })} maxLength={12} />
      </div>
      <TextAreaField label="Descripción" value={draft.description} onChange={(description) => set({ description })} rows={3} maxLength={4000} />
      <RemindersField value={draft.reminders} onChange={(reminders) => set({ reminders })} />
      <TextAreaField label="Notas" value={draft.notes} onChange={(notes) => set({ notes })} rows={2} maxLength={4000} />
    </FormDialog>
  );
}
