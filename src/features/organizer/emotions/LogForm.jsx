import { useId, useState } from 'react';
import { Button } from '../../../components/common/Button.jsx';
import { cx } from '../../../utils/cx.js';
import { commit } from '../data/store.js';
import { useRunner } from '../data/hooks.js';
import { tagCounts } from '../data/tags.js';
import { ChipGroup, InputField, SelectField, TagsField, TextAreaField } from '../shared/Fields.jsx';
import { FormDialog } from '../shared/ui.jsx';
import { fromLocalDateTimeInput, shortDate, toLocalDateTimeInput } from '../shared/format.js';
import { toISODate } from '../../../utils/dates.js';
import { CONTEXTS, FACTORS, MOODS, NEEDS, REFLECTION_QUESTIONS, STRATEGIES, VALENCE_LABELS } from './content.js';
import { useEmotions } from './useEmotions.js';

function draftFrom(initial, data) {
  return {
    at: initial?.at ?? new Date().toISOString(),
    primaryId: initial?.primaryId ?? null,
    secondaryIds: initial?.secondaryIds ?? [],
    intensity: initial?.intensity ?? Math.ceil(data.settings.scale / 2),
    scale: initial?.scale ?? data.settings.scale,
    mood: initial?.mood ?? null,
    description: initial?.description ?? '',
    context: initial?.context ?? '',
    contextTags: initial?.contextTags ?? [],
    factors: initial?.factors ?? [],
    needs: initial?.needs ?? [],
    strategies: initial?.strategies ?? [],
    tags: initial?.tags ?? [],
    privateNotes: initial?.privateNotes ?? '',
    reflection: initial?.reflection ?? {},
    eventId: initial?.eventId ?? null,
    journalEntryId: initial?.journalEntryId ?? null,
  };
}

/** Selector de la emoción principal, agrupado por tono, con el color de cada emoción. */
function EmotionPicker({ emotions, value, onChange, error }) {
  const id = useId();
  const groups = ['pleasant', 'unpleasant', 'mixed', 'neutral'].map((v) => [v, emotions.filter((e) => e.valence === v)]).filter(([, list]) => list.length);
  return (
    <fieldset className={cx('field org-emotion-picker', error && 'field--invalid')} aria-describedby={error ? `${id}-e` : undefined}>
      <legend className="field__label">¿Qué sientes principalmente?</legend>
      {groups.map(([valence, list]) => (
        <div key={valence} className="org-emotion-group">
          <span className="org-emotion-group__label">{VALENCE_LABELS[valence]}</span>
          <div className="org-chips">
            {list.map((emotion) => (
              <button
                key={emotion.id}
                type="button"
                className={cx('org-chip org-emotion-chip', value === emotion.id && 'is-active')}
                style={{ '--chip-color': emotion.color }}
                aria-pressed={value === emotion.id}
                title={emotion.description || undefined}
                onClick={() => onChange(emotion.id)}
              >
                <span className="org-dot" aria-hidden="true" />
                {emotion.name}
              </button>
            ))}
          </div>
        </div>
      ))}
      {error && (
        <p id={`${id}-e`} className="field__error" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}

/**
 * Registro emocional. Solo la emoción principal y la intensidad son necesarias;
 * todo lo demás (contexto, necesidades, reflexión…) es opcional y se puede omitir.
 * `inline` lo muestra como bloque de la página; si no, en un diálogo.
 */
export function LogForm({ initial, open = true, onClose, inline = false }) {
  const data = useEmotions();
  const run = useRunner();
  const uid = useId();
  const isEdit = Boolean(initial?.id);
  const [draft, setDraft] = useState(() => draftFrom(initial, data));
  const [errors, setErrors] = useState(null);
  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setDraft(draftFrom(initial, data));
      setErrors(null);
    }
  }
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const used = (field, base) => [...new Set([...base, ...tagCounts(data.logs, field).map((t) => t.tag)])];
  const day = toISODate(new Date(draft.at));
  const nearbyEvents = data.events.filter((e) => e.startDate <= day && e.endDate >= day);
  const dayEntries = data.entries.filter((e) => e.eventDate === day);

  const submit = async () => {
    if (!draft.primaryId) {
      setErrors({ primaryId: 'Elige la emoción que más se parece a lo que sientes (puedes crear otra en Ajustes).' });
      return false;
    }
    const { ok, errors: e } = await run(() => commit((tx) => (isEdit ? tx.update(initial.id, draft) : tx.create('emotionLog', draft))), { success: isEdit ? 'Registro actualizado' : 'Registro guardado' });
    setErrors(e);
    if (ok && inline) setDraft(draftFrom(null, data));
    return ok;
  };

  const fields = (
    <>
      <EmotionPicker emotions={data.emotions.filter((e) => !e.archived || e.id === draft.primaryId)} value={draft.primaryId} onChange={(primaryId) => set({ primaryId, secondaryIds: draft.secondaryIds.filter((x) => x !== primaryId) })} error={errors?.primaryId} />
      <div className="field">
        <label className="field__label" htmlFor={`${uid}-intensity`}>
          Intensidad: {draft.intensity} de {draft.scale}
        </label>
        <input
          id={`${uid}-intensity`}
          type="range"
          className="org-range"
          min="1"
          max={draft.scale}
          step="1"
          value={draft.intensity}
          onChange={(e) => set({ intensity: Number(e.target.value) })}
          aria-valuetext={`${draft.intensity} de ${draft.scale}`}
        />
        <span className="org-range__labels" aria-hidden="true">
          <span>Muy leve</span>
          <span>Muy intensa</span>
        </span>
      </div>
      <div className="field">
        <span className="field__label" id={`${uid}-mood`}>
          Ánimo general (opcional)
        </span>
        <div className="org-segment" role="group" aria-labelledby={`${uid}-mood`}>
          {MOODS.map((m) => (
            <button key={m.value} type="button" aria-pressed={draft.mood === m.value} onClick={() => set({ mood: draft.mood === m.value ? null : m.value })}>
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <TextAreaField label="¿Qué está pasando? (opcional)" value={draft.description} onChange={(description) => set({ description })} rows={3} maxLength={4000} placeholder="Escribe libremente, todo lo que quieras o nada." />
      <details className="org-more" open={isEdit && Boolean(draft.secondaryIds.length || draft.context || draft.factors.length || draft.needs.length || draft.strategies.length)}>
        <summary>Más detalle: otras emociones, contexto, necesidades y lo que ayudó</summary>
        <div className="org-more__body">
          <ChipGroup
            label="Otras emociones presentes"
            options={data.active.filter((e) => e.id !== draft.primaryId).map((e) => ({ value: e.id, label: e.name, color: e.color }))}
            values={draft.secondaryIds}
            onChange={(secondaryIds) => set({ secondaryIds: secondaryIds.slice(0, 6) })}
          />
          <InputField label="Situación o contexto" value={draft.context} onChange={(context) => set({ context })} maxLength={400} placeholder="Ej.: después del parcial, en casa" />
          <TagsField label="Ámbitos" value={draft.contextTags} onChange={(contextTags) => set({ contextTags })} suggestions={used('contextTags', CONTEXTS)} max={10} />
          <TagsField label="Lo que pudo influir" value={draft.factors} onChange={(factors) => set({ factors })} suggestions={used('factors', FACTORS)} max={15} />
          <TagsField label="Lo que necesitaba" value={draft.needs} onChange={(needs) => set({ needs })} suggestions={used('needs', NEEDS)} max={15} />
          <TagsField label="Lo que hice para cuidarme" value={draft.strategies} onChange={(strategies) => set({ strategies })} suggestions={used('strategies', STRATEGIES)} max={15} />
        </div>
      </details>
      {data.settings.showReflection && (
        <details className="org-more" open={isEdit && Object.keys(draft.reflection).length > 0}>
          <summary>Reflexión guiada (opcional: responde solo lo que quieras)</summary>
          <div className="org-more__body">
            {REFLECTION_QUESTIONS.map((q) => (
              <TextAreaField key={q.id} label={q.text} value={draft.reflection[q.id] ?? ''} onChange={(text) => set({ reflection: { ...draft.reflection, [q.id]: text } })} rows={2} maxLength={4000} />
            ))}
          </div>
        </details>
      )}
      <details className="org-more" open={isEdit && Boolean(draft.privateNotes || draft.tags.length || draft.eventId || draft.journalEntryId)}>
        <summary>Fecha, notas privadas, etiquetas y vínculos</summary>
        <div className="org-more__body">
          <InputField label="Cuándo" type="datetime-local" value={toLocalDateTimeInput(draft.at)} onChange={(v) => fromLocalDateTimeInput(v) && set({ at: fromLocalDateTimeInput(v) })} error={errors?.at} />
          <TextAreaField label="Notas privadas" value={draft.privateNotes} onChange={(privateNotes) => set({ privateNotes })} rows={2} maxLength={4000} />
          <TagsField value={draft.tags} onChange={(tags) => set({ tags })} suggestions={tagCounts(data.logs).map((t) => t.tag)} />
          <div className="org-form__row">
            <SelectField label="Evento de ese día" value={draft.eventId} onChange={(eventId) => set({ eventId })} placeholder={nearbyEvents.length ? 'Ninguno' : 'No hay eventos ese día'} options={nearbyEvents.map((e) => ({ value: e.id, label: e.title }))} />
            <SelectField label="Entrada del diario" value={draft.journalEntryId} onChange={(journalEntryId) => set({ journalEntryId })} placeholder={dayEntries.length ? 'Ninguna' : 'No hay entradas ese día'} options={dayEntries.map((e) => ({ value: e.id, label: e.title || `Diario del ${shortDate(e.eventDate)}` }))} />
          </div>
        </div>
      </details>
    </>
  );

  if (inline) {
    return (
      <form
        className="org-panel org-form org-log-form"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        noValidate
        aria-label="Nuevo registro emocional"
      >
        {fields}
        <Button type="submit">Guardar registro</Button>
      </form>
    );
  }
  return (
    <FormDialog open={open} onClose={onClose} title={isEdit ? 'Editar registro' : 'Nuevo registro'} onSubmit={submit} errors={errors} size="lg">
      {fields}
    </FormDialog>
  );
}
