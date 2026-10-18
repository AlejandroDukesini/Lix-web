import { useMemo, useState } from 'react';
import { CalendarClock, Check, Pause, Pencil, Play, Plus, SkipForward, Trash2, Undo2, X } from 'lucide-react';
import { Button, IconButton } from '../../../../components/common/Button.jsx';
import { Badge } from '../../../../components/common/Card.jsx';
import { cx } from '../../../../utils/cx.js';
import { commit, deleteRecord, updateRecord } from '../../data/store.js';
import { useRunner } from '../../data/hooks.js';
import { addDays, describeRule, nextOccurrence } from '../../data/recurrence.js';
import { AmountField, InputField, RecurrenceField, SelectField, TagsField, TextAreaField } from '../../shared/Fields.jsx';
import { ActionMenu, DeleteDialog, EmptyState, FormDialog } from '../../shared/ui.jsx';
import { daysFromToday, shortDate } from '../../shared/format.js';
import { scheduleOccurrences } from '../ledger.js';
import { formatMoney, parseAmount, toAmountInput } from '../money.js';
import { recordOccurrence, setOccurrenceSkipped } from '../actions.js';
import { categoryOptions, METHOD_LABELS, PAY_KIND_LABELS, useFinance } from '../useFinance.js';

const STATE_LABELS = { paid: 'Pagado', recorded: 'Registrado (pendiente)', skipped: 'Omitido', overdue: 'Vencido', upcoming: 'Próximo', inactive: 'En pausa' };
const STATE_TONES = { paid: 'success', recorded: 'warning', overdue: 'warning', skipped: undefined, upcoming: undefined };
const STATUS_LABELS = { active: 'Activo', paused: 'En pausa', cancelled: 'Cancelado', finished: 'Terminado' };

/** Botones de una ocurrencia: registrar el pago (crea UN movimiento) u omitirla. */
export function OccurrenceActions({ occurrence, compact = false }) {
  const run = useRunner();
  const finance = useFinance();
  const { item, date, state } = occurrence;
  const income = item.flow === 'income';
  if (state === 'paid' || state === 'recorded') return compact ? <Badge tone="success">{STATE_LABELS[state]}</Badge> : null;
  if (state === 'skipped') {
    return (
      <Button size="sm" variant="ghost" icon={Undo2} onClick={() => run(() => setOccurrenceSkipped(item.id, date, false), { success: 'Ocurrencia restaurada' })}>
        Deshacer omisión
      </Button>
    );
  }
  const record = () =>
    run(() => recordOccurrence(item.id, date, { date: date > finance.today ? date : finance.today }), {
      success: income ? `Ingreso de «${item.name}» registrado` : `Pago de «${item.name}» registrado`,
    });
  return (
    <div className="org-row__end">
      <Button size="sm" icon={Check} onClick={record} aria-label={`${income ? 'Registrar ingreso' : 'Registrar pago'} de ${item.name} del ${shortDate(date)}`}>
        {compact ? (income ? 'Recibido' : 'Pagado') : income ? 'Registrar ingreso' : 'Registrar pago'}
      </Button>
      {!compact && (
        <IconButton icon={SkipForward} size="sm" label={`Omitir el ${shortDate(date)}`} onClick={() => run(() => setOccurrenceSkipped(item.id, date, true), { success: 'Ocurrencia omitida' })} />
      )}
    </div>
  );
}

function ScheduledForm({ open, onClose, initial }) {
  const finance = useFinance();
  const run = useRunner();
  const isEdit = Boolean(initial?.id);
  const [draft, setDraft] = useState(null);
  const [errors, setErrors] = useState(null);
  if (open && !draft) {
    setDraft({
      name: initial?.name ?? '',
      flow: initial?.flow ?? 'expense',
      payKind: initial?.payKind ?? 'subscription',
      amount: initial?.amount ? toAmountInput(initial.amount) : '',
      accountId: initial?.accountId ?? finance.accounts.find((a) => !a.archived)?.id ?? null,
      categoryId: initial?.categoryId ?? null,
      method: initial?.method ?? 'other',
      startDate: initial?.startDate ?? finance.today,
      recurrence: initial ? initial.recurrence : { freq: 'monthly', interval: 1, until: null, count: null, weekdays: [] },
      reminderDays: initial?.reminderDays ?? 2,
      status: initial?.status ?? 'active',
      notes: initial?.notes ?? '',
      tags: initial?.tags ?? [],
    });
  }
  if (!open && draft) setDraft(null);
  if (!draft) return null;
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const currency = finance.currencyOf(draft.accountId);
  const submit = async () => {
    const data = { ...draft, amount: parseAmount(draft.amount) ?? undefined };
    const { ok, errors: e } = await run(() => commit((tx) => (isEdit ? tx.update(initial.id, data) : tx.create('scheduled', data))), {
      success: isEdit ? 'Pago programado actualizado' : 'Pago programado creado',
    });
    setErrors(e);
    return ok;
  };
  return (
    <FormDialog open={open} onClose={onClose} title={isEdit ? 'Editar pago programado' : 'Nuevo pago programado'} onSubmit={submit} errors={errors} size="lg">
      <div className="org-segment" role="group" aria-label="Tipo">
        {[
          ['expense', 'Pago o gasto'],
          ['income', 'Ingreso esperado'],
        ].map(([flow, label]) => (
          <button key={flow} type="button" aria-pressed={draft.flow === flow} onClick={() => set({ flow, categoryId: null, payKind: flow === 'income' ? 'salary' : 'subscription' })}>
            {label}
          </button>
        ))}
      </div>
      <InputField label="Nombre" value={draft.name} onChange={(name) => set({ name })} error={errors?.name} maxLength={80} placeholder="Ej.: Matrícula, Spotify, arriendo, cuota del celular" autoFocus />
      <div className="org-form__row">
        <SelectField label="Clase" value={draft.payKind} onChange={(payKind) => set({ payKind })} options={Object.entries(PAY_KIND_LABELS).map(([value, label]) => ({ value, label }))} />
        <AmountField value={draft.amount} onChange={(amount) => set({ amount })} currency={currency} error={errors?.amount} />
      </div>
      <div className="org-form__row">
        <SelectField label="Cuenta" value={draft.accountId} onChange={(accountId) => set({ accountId })} options={finance.accounts.filter((a) => !a.archived || a.id === draft.accountId).map((a) => ({ value: a.id, label: a.name }))} error={errors?.accountId} />
        <SelectField label="Categoría" value={draft.categoryId} onChange={(categoryId) => set({ categoryId })} options={categoryOptions(finance.categories, draft.flow, draft.categoryId)} placeholder="Sin categoría" error={errors?.categoryId} />
      </div>
      <div className="org-form__row">
        <InputField label="Primera fecha (o próxima)" type="date" value={draft.startDate} onChange={(startDate) => set({ startDate })} error={errors?.startDate} />
        <SelectField label="Método de pago" value={draft.method} onChange={(method) => set({ method })} options={Object.entries(METHOD_LABELS).map(([value, label]) => ({ value, label }))} />
      </div>
      <RecurrenceField
        value={draft.recurrence}
        onChange={(recurrence) => set({ recurrence })}
        startDate={draft.startDate}
        error={errors?.recurrence}
        label={draft.payKind === 'debt' ? 'Repetición (para cuotas, usa «Un número de veces»)' : 'Repetición'}
      />
      <div className="org-form__row">
        <SelectField
          label="Recordármelo"
          value={String(draft.reminderDays)}
          onChange={(v) => set({ reminderDays: Number(v) })}
          options={[0, 1, 2, 3, 5, 7, 15].map((n) => ({ value: String(n), label: n === 0 ? 'El mismo día' : `${n} ${n === 1 ? 'día' : 'días'} antes` }))}
        />
        {isEdit && <SelectField label="Estado" value={draft.status} onChange={(status) => set({ status })} options={Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))} />}
      </div>
      <TextAreaField label="Notas (opcional)" value={draft.notes} onChange={(notes) => set({ notes })} rows={2} maxLength={1000} />
      <TagsField value={draft.tags} onChange={(tags) => set({ tags })} />
    </FormDialog>
  );
}

function ScheduledItem({ item, onEdit, onDelete }) {
  const finance = useFinance();
  const run = useRunner();
  const [open, setOpen] = useState(false);
  const currency = finance.currencyOf(item.accountId);
  const from = addDays(finance.today, -120);
  const to = addDays(finance.today, 120);
  const occurrences = useMemo(() => scheduleOccurrences(item, finance.transactions, from, to, finance.today), [item, finance.transactions, from, to, finance.today]);
  const pending = occurrences.filter((o) => o.state === 'overdue' || o.state === 'upcoming');
  const next = pending[0] ?? null;
  const following = item.status === 'active' ? nextOccurrence(item.startDate, item.recurrence, finance.today) : null;
  const paidCount = finance.transactions.filter((t) => t.scheduleId === item.id && t.status !== 'cancelled').length;

  return (
    <li className={cx('org-panel org-scheduled', item.status !== 'active' && 'is-muted')}>
      <div className="org-budget__head">
        <div>
          <h3 className="org-row__title">
            {item.name} <span className={item.flow === 'income' ? 'is-positive' : undefined}>{formatMoney(item.amount, currency)}</span>
          </h3>
          <p className="org-subtle">
            {PAY_KIND_LABELS[item.payKind]} · {describeRule(item.recurrence, shortDate)}
            {item.recurrence?.count ? ` · ${paidCount} de ${item.recurrence.count} registradas` : ''}
          </p>
        </div>
        <ActionMenu
          label={`Acciones de ${item.name}`}
          items={[
            { label: 'Editar', icon: Pencil, onClick: onEdit },
            item.status === 'active'
              ? { label: 'Pausar', icon: Pause, onClick: () => run(() => updateRecord(item.id, { status: 'paused' }), { success: 'Pago en pausa' }) }
              : item.status !== 'finished' && { label: 'Reanudar', icon: Play, onClick: () => run(() => updateRecord(item.id, { status: 'active' }), { success: 'Pago reanudado' }) },
            item.status !== 'cancelled' && { label: 'Cancelar (conserva el historial)', icon: X, onClick: () => run(() => updateRecord(item.id, { status: 'cancelled' }), { success: 'Pago cancelado' }) },
            { label: 'Eliminar', icon: Trash2, danger: true, onClick: onDelete },
          ]}
        />
      </div>
      {item.status !== 'active' && <Badge>{STATUS_LABELS[item.status]}</Badge>}
      {next ? (
        <div className="org-row org-row--compact">
          <CalendarClock aria-hidden="true" width={20} height={20} />
          <span className="org-row__main">
            <span className={cx('org-row__title', next.state === 'overdue' && 'is-negative')}>
              {next.state === 'overdue' ? 'Vencido' : 'Próximo'}: {shortDate(next.date)} ({daysFromToday(next.date, finance.today)})
            </span>
            {pending.length > 1 && <span className="org-row__meta">{pending.length - 1} más en los próximos meses</span>}
          </span>
          <OccurrenceActions occurrence={next} />
        </div>
      ) : (
        item.status === 'active' && <p className="org-subtle">{following ? `Siguiente: ${shortDate(following)}` : 'No quedan fechas pendientes.'}</p>
      )}
      <details className="org-more" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
        <summary>Historial y próximas fechas</summary>
        {open && (
          <ul className="org-mini-list">
            {occurrences.map((o) => (
              <li key={o.date}>
                <span>{shortDate(o.date)}</span>
                <Badge tone={STATE_TONES[o.state]}>{STATE_LABELS[o.state]}</Badge>
                {o.state === 'overdue' || o.state === 'skipped' || o.state === 'upcoming' ? <OccurrenceActions occurrence={o} /> : <span />}
              </li>
            ))}
            {!occurrences.length && <li>No hay fechas en los últimos ni en los próximos cuatro meses.</li>}
          </ul>
        )}
      </details>
      {item.notes && <p className="org-subtle">{item.notes}</p>}
    </li>
  );
}

export function Scheduled() {
  const finance = useFinance();
  const run = useRunner();
  const [form, setForm] = useState(null);
  const [remove, setRemove] = useState(null);
  const [filter, setFilter] = useState('active');
  const list = finance.scheduled.filter((s) => (filter === 'active' ? s.status === 'active' || s.status === 'paused' : s.status === 'cancelled' || s.status === 'finished'));
  const nextOf = (s) => nextOccurrence(s.startDate, s.recurrence, addDays(finance.today, -60)) ?? '9999';

  return (
    <div className="org-stack">
      <p className="org-muted">
        Suscripciones, matrícula, servicios, cuotas o ingresos fijos. Cada fecha aparece como pendiente y en el calendario; al registrarla se crea un solo
        movimiento (nunca duplicados).
      </p>
      <div className="org-toolbar">
        <Button icon={Plus} onClick={() => setForm({ initial: null })} disabled={!finance.accounts.length}>
          Nuevo pago programado
        </Button>
        <div className="org-segment" role="group" aria-label="Mostrar">
          <button type="button" aria-pressed={filter === 'active'} onClick={() => setFilter('active')}>
            Vigentes
          </button>
          <button type="button" aria-pressed={filter === 'closed'} onClick={() => setFilter('closed')}>
            Terminados y cancelados
          </button>
        </div>
      </div>
      {!finance.accounts.length && <p className="org-banner org-banner--warning">Primero crea una cuenta en la pestaña «Cuentas».</p>}
      {list.length ? (
        <ul className="org-list">
          {[...list]
            .sort((a, b) => nextOf(a).localeCompare(nextOf(b)))
            .map((item) => (
              <ScheduledItem key={item.id} item={item} onEdit={() => setForm({ initial: item })} onDelete={() => setRemove(item)} />
            ))}
        </ul>
      ) : (
        <EmptyState icon={CalendarClock} title={filter === 'active' ? 'Sin pagos programados' : 'Nada por aquí'}>
          {filter === 'active' ? 'Agrega lo que pagas o recibes con regularidad y deja de depender de la memoria.' : 'Los pagos terminados o cancelados aparecerán aquí con su historial.'}
        </EmptyState>
      )}
      <ScheduledForm open={Boolean(form)} initial={form?.initial} onClose={() => setForm(null)} />
      <DeleteDialog
        open={Boolean(remove)}
        recordId={remove?.id}
        title={`¿Eliminar «${remove?.name ?? ''}»?`}
        onCancel={() => setRemove(null)}
        onConfirm={async () => {
          const { ok } = await run(() => deleteRecord(remove.id), { success: 'Pago programado eliminado' });
          if (ok) setRemove(null);
        }}
        extraWarning={<p>Si solo quieres dejar de verlo, cancélalo: así conservas su historial.</p>}
      />
    </div>
  );
}
