import { useMemo, useState } from 'react';
import { CalendarPlus, Pencil, PartyPopper, Trash2 } from 'lucide-react';
import { Button } from '../../../components/common/Button.jsx';
import { cx } from '../../../utils/cx.js';
import { commit, deleteRecord, saveSettings } from '../../organizer/data/store.js';
import { useRunner } from '../../organizer/data/hooks.js';
import { CheckboxField, InputField, SelectField, TextAreaField } from '../../organizer/shared/Fields.jsx';
import { ActionMenu, DeleteDialog, FormDialog, PeriodNav, Section } from '../../organizer/shared/ui.jsx';
import { dayHeading, formatClock, shortDate } from '../../organizer/shared/format.js';
import { ACTIVITY_LABELS } from '../../organizer/planner/agenda.js';
import { ActivityRow } from '../../organizer/planner/views/University.jsx';
import { monthMatrix } from '../academicLogic.js';
import { useAcademic } from '../useAcademic.js';

export const DATE_TYPES = { holiday: 'Festivo', academic: 'Evento académico', important: 'Fecha importante' };
const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

function AcademicDateForm({ open, initial, onClose, region }) {
  const run = useRunner();
  const isEdit = Boolean(initial?.id);
  const [draft, setDraft] = useState(null);
  const [errors, setErrors] = useState(null);
  if (open && !draft) {
    setDraft({
      type: initial?.type ?? 'holiday',
      name: initial?.name ?? '',
      date: initial?.date ?? '',
      endDate: initial?.endDate ?? '',
      yearly: initial?.yearly ?? false,
      region: initial?.region ?? region ?? '',
      notes: initial?.notes ?? '',
    });
  }
  if (!open && draft) setDraft(null);
  if (!draft) return null;
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const submit = async () => {
    const data = { ...draft, endDate: draft.endDate || null };
    const { ok, errors: e } = await run(() => commit((tx) => (isEdit ? tx.update(initial.id, data) : tx.create('academicDate', data))), { success: isEdit ? 'Fecha actualizada' : 'Fecha añadida' });
    setErrors(e);
    return ok;
  };
  return (
    <FormDialog open={open} onClose={onClose} title={isEdit ? 'Editar fecha' : 'Nueva fecha del calendario académico'} onSubmit={submit} errors={errors}>
      <div className="org-form__row">
        <SelectField label="Tipo" value={draft.type} onChange={(type) => set({ type })} options={Object.entries(DATE_TYPES).map(([value, label]) => ({ value, label }))} />
        <InputField label="Calendario o país" value={draft.region} onChange={(r) => set({ region: r })} maxLength={60} placeholder="Ej.: Colombia, Universidad" />
      </div>
      <InputField label="Nombre" value={draft.name} onChange={(name) => set({ name })} error={errors?.name} maxLength={120} autoFocus placeholder={draft.type === 'holiday' ? 'Ej.: Día de la Independencia' : 'Ej.: Semana de parciales'} />
      <div className="org-form__row">
        <InputField label="Fecha" type="date" value={draft.date} onChange={(date) => set({ date })} error={errors?.date} />
        <InputField label="Hasta (opcional)" type="date" value={draft.endDate} onChange={(endDate) => set({ endDate })} error={errors?.endDate} hint="Para semanas de receso o de exámenes." />
      </div>
      <CheckboxField label="Se repite cada año en la misma fecha" checked={draft.yearly} onChange={(yearly) => set({ yearly })} description="Útil para festivos fijos. Los festivos que cambian de fecha cada año regístralos año a año." />
      <TextAreaField label="Notas" value={draft.notes} onChange={(notes) => set({ notes })} rows={2} maxLength={1000} />
    </FormDialog>
  );
}

export function AcademicCalendar() {
  const data = useAcademic();
  const run = useRunner();
  const [cursor, setCursor] = useState(() => ({ year: Number(data.today.slice(0, 4)), month: Number(data.today.slice(5, 7)) - 1 }));
  const [selected, setSelected] = useState(data.today);
  const [form, setForm] = useState(null);
  const [remove, setRemove] = useState(null);
  const [region, setRegion] = useState(data.academicSettings.region);

  const weeks = useMemo(() => monthMatrix(cursor.year, cursor.month, { activities: data.activities, academicDates: data.academicDates }), [cursor, data.activities, data.academicDates]);
  const label = new Date(cursor.year, cursor.month, 1).toLocaleDateString('es', { month: 'long', year: 'numeric' });
  const move = (delta) => setCursor(({ year, month }) => ({ year: year + Math.floor((month + delta) / 12), month: (((month + delta) % 12) + 12) % 12 }));
  const day = weeks.flat().find((d) => d.day === selected);
  const sortedDates = [...data.academicDates].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="org-stack">
      <div className="org-toolbar org-toolbar--split">
        <PeriodNav
          label={label}
          onPrev={() => move(-1)}
          onNext={() => move(1)}
          onToday={() => {
            setCursor({ year: Number(data.today.slice(0, 4)), month: Number(data.today.slice(5, 7)) - 1 });
            setSelected(data.today);
          }}
          prevLabel="Mes anterior"
          nextLabel="Mes siguiente"
        />
        <Button icon={CalendarPlus} onClick={() => setForm({ initial: { date: selected } })}>
          Festivo o evento
        </Button>
      </div>

      <div className="acad-calendar">
        <div className="org-month" role="group" aria-label={label}>
          <div className="org-month__head" aria-hidden="true">
            {WEEKDAYS.map((d) => (
              <span key={d} className="org-month__weekday">
                {d}
              </span>
            ))}
          </div>
          {weeks.map((week) => (
            <div key={week[0].day} className="org-month__week">
              {week.map((cell) => {
                const items = [
                  ...cell.dates.map((r) => ({ key: r.id, label: r.name, color: r.type === 'holiday' ? 'var(--danger)' : r.type === 'academic' ? 'var(--c-secondary)' : 'var(--c-accent)' })),
                  ...cell.activities.map((a) => ({ key: a.id, label: `${ACTIVITY_LABELS[a.type]}: ${a.title}`, color: data.subjectsById.get(a.subjectId)?.color ?? 'var(--c-primary)', done: a.status === 'done' })),
                ];
                const holiday = cell.dates.some((r) => r.type === 'holiday');
                return (
                  <button
                    key={cell.day}
                    type="button"
                    className={cx('org-month__day', !cell.inMonth && 'is-outside', cell.day === data.today && 'is-today', cell.day === selected && 'is-selected', holiday && 'acad-holiday')}
                    onClick={() => setSelected(cell.day)}
                    aria-label={`${dayHeading(cell.day)}${items.length ? `: ${items.map((i) => i.label).join(', ')}` : ''}`}
                    aria-pressed={cell.day === selected}
                  >
                    <span className="org-month__number">{Number(cell.day.slice(8))}</span>
                    <span className="org-month__items" aria-hidden="true">
                      {items.slice(0, 3).map((item) => (
                        <span key={item.key} className={cx('org-month__item', item.done && 'is-done')} style={{ '--item-color': item.color }}>
                          {item.label}
                        </span>
                      ))}
                      {items.length > 3 && <span className="org-month__more">+{items.length - 3}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <Section title={day ? dayHeading(day.day) : shortDate(selected)} className="acad-day">
          {day?.dates.map((r) => (
            <p key={r.id} className={`acad-date is-${r.type}`}>
              <span>{r.name}</span>
              <span className="org-subtle">
                {DATE_TYPES[r.type]}
                {r.region && ` · ${r.region}`}
              </span>
            </p>
          ))}
          {day?.activities.length ? (
            <ul className="org-list">
              {day.activities.map((a) => (
                <ActivityRow key={a.id} activity={a} compact />
              ))}
            </ul>
          ) : (
            !day?.dates.length && <p className="org-muted">Nada este día.</p>
          )}
          {day?.activities.some((a) => a.dueTime) && (
            <p className="org-subtle">Horas: {day.activities.filter((a) => a.dueTime).map((a) => `${a.title} ${formatClock(a.dueTime, data.hourCycle)}`).join(' · ')}</p>
          )}
        </Section>
      </div>

      <Section
        title="Festivos y fechas importantes"
        description="La app no descarga ni inventa festivos: los registras tú, una vez, y quedan guardados en este dispositivo."
      >
        <form
          className="acad-region"
          onSubmit={(event) => {
            event.preventDefault();
            run(() => saveSettings('academicSettings', { region: region.trim() }), { success: 'Calendario guardado' });
          }}
        >
          <InputField label="País o calendario que sigues" value={region} onChange={setRegion} maxLength={60} placeholder="Ej.: Colombia · Universidad Nacional" hint="Se propone al crear nuevas fechas." />
          <Button type="submit" variant="secondary" size="sm" disabled={region.trim() === data.academicSettings.region}>
            Guardar
          </Button>
        </form>
        {sortedDates.length ? (
          <ul className="acad-dates">
            {sortedDates.map((r) => (
              <li key={r.id} className={`acad-date is-${r.type}`}>
                <span className="acad-date__day">
                  {shortDate(r.date)}
                  {r.endDate && r.endDate !== r.date && ` – ${shortDate(r.endDate)}`}
                </span>
                <span>
                  {r.name}
                  {r.yearly && <span className="org-subtle"> · cada año</span>}
                </span>
                <span className="org-subtle">
                  {DATE_TYPES[r.type]}
                  {r.region && ` · ${r.region}`}
                </span>
                <ActionMenu
                  label={`Acciones de ${r.name}`}
                  items={[
                    { label: 'Editar', icon: Pencil, onClick: () => setForm({ initial: r }) },
                    { label: 'Eliminar', icon: Trash2, danger: true, onClick: () => setRemove(r) },
                  ]}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="org-muted acad-place">
            <PartyPopper aria-hidden="true" /> Aún no hay festivos ni eventos. Añade los de tu país y los de tu universidad.
          </p>
        )}
      </Section>

      <AcademicDateForm open={Boolean(form)} initial={form?.initial} region={data.academicSettings.region} onClose={() => setForm(null)} />
      <DeleteDialog
        open={Boolean(remove)}
        recordId={remove?.id}
        title={`¿Eliminar «${remove?.name}»?`}
        onCancel={() => setRemove(null)}
        onConfirm={async () => {
          const { ok } = await run(() => deleteRecord(remove.id), { success: 'Fecha eliminada' });
          if (ok) setRemove(null);
        }}
      />
    </div>
  );
}
