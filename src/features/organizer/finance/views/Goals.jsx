import { useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Pencil, PiggyBank, Plus, Trash2 } from 'lucide-react';
import { Button } from '../../../../components/common/Button.jsx';
import { Badge } from '../../../../components/common/Card.jsx';
import { commit, deleteRecord } from '../../data/store.js';
import { useRunner } from '../../data/hooks.js';
import { AmountField, ColorPicker, InputField, SelectField, TextAreaField } from '../../shared/Fields.jsx';
import { ActionMenu, DeleteDialog, EmptyState, FormDialog, Progress } from '../../shared/ui.jsx';
import { daysFromToday, shortDate } from '../../shared/format.js';
import { goalProgress } from '../ledger.js';
import { formatMoney, parseAmount, toAmountInput } from '../money.js';
import { moveGoalMoney } from '../actions.js';
import { ACCOUNT_TYPE_LABELS, useFinance } from '../useFinance.js';

const STATUS = { active: 'Activa', achieved: 'Cumplida', paused: 'Pausada', cancelled: 'Cancelada' };

function GoalForm({ open, onClose, initial }) {
  const finance = useFinance();
  const run = useRunner();
  const isEdit = Boolean(initial?.id);
  const [draft, setDraft] = useState(null);
  const [errors, setErrors] = useState(null);
  if (open && !draft) {
    setDraft({
      name: initial?.name ?? '',
      description: initial?.description ?? '',
      target: initial?.target ? toAmountInput(initial.target) : '',
      startDate: initial?.startDate ?? finance.today,
      deadline: initial?.deadline ?? '',
      status: initial?.status ?? 'active',
      accountId: initial?.accountId ?? finance.accounts.find((a) => a.type === 'savings' && !a.archived)?.id ?? null,
      color: initial?.color ?? '#f5b961',
    });
  }
  if (!open && draft) setDraft(null);
  if (!draft) return null;
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const submit = async () => {
    const data = { ...draft, target: parseAmount(draft.target) ?? undefined, deadline: draft.deadline || null };
    const { ok, errors: e } = await run(() => commit((tx) => (isEdit ? tx.update(initial.id, data) : tx.create('goal', data))), { success: isEdit ? 'Meta actualizada' : 'Meta creada' });
    setErrors(e);
    return ok;
  };
  return (
    <FormDialog open={open} onClose={onClose} title={isEdit ? 'Editar meta' : 'Nueva meta de ahorro'} onSubmit={submit} errors={errors}>
      <InputField label="Nombre" value={draft.name} onChange={(name) => set({ name })} error={errors?.name} maxLength={60} placeholder="Ej.: Viaje a la costa, portátil nuevo" autoFocus />
      <AmountField label="Cantidad objetivo" value={draft.target} onChange={(target) => set({ target })} currency={finance.currency} error={errors?.target} />
      <div className="org-form__row">
        <InputField label="Inicio" type="date" value={draft.startDate} onChange={(startDate) => set({ startDate })} error={errors?.startDate} />
        <InputField label="Fecha límite (opcional)" type="date" value={draft.deadline} onChange={(deadline) => set({ deadline })} error={errors?.deadline} />
      </div>
      <div className="org-form__row">
        <SelectField
          label="Cuenta donde ahorras (opcional)"
          value={draft.accountId}
          onChange={(accountId) => set({ accountId })}
          placeholder="Sin cuenta fija"
          options={finance.accounts.filter((a) => !a.archived || a.id === draft.accountId).map((a) => ({ value: a.id, label: `${a.name} · ${ACCOUNT_TYPE_LABELS[a.type]}` }))}
        />
        {isEdit && <SelectField label="Estado" value={draft.status} onChange={(status) => set({ status })} options={Object.entries(STATUS).map(([value, label]) => ({ value, label }))} />}
      </div>
      <TextAreaField label="Descripción (opcional)" value={draft.description} onChange={(description) => set({ description })} rows={2} maxLength={400} />
      <ColorPicker value={draft.color} onChange={(color) => set({ color })} />
    </FormDialog>
  );
}

/** Aporte o retiro: una transferencia real entre dos cuentas, marcada con la meta. */
function MoveDialog({ goal, direction, onClose }) {
  const finance = useFinance();
  const run = useRunner();
  const accounts = finance.accounts.filter((a) => !a.archived);
  const [draft, setDraft] = useState(null);
  const [errors, setErrors] = useState(null);
  if (goal && !draft) {
    const savings = goal.accountId ?? accounts.find((a) => a.type === 'savings')?.id ?? null;
    const other = accounts.find((a) => a.id !== savings)?.id ?? null;
    setDraft({ amount: '', date: finance.today, from: direction === 'in' ? other : savings, to: direction === 'in' ? savings : other });
  }
  if (!goal && draft) setDraft(null);
  if (!draft) return null;
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const submit = async () => {
    const amount = parseAmount(draft.amount);
    const { ok, errors: e } = await run(
      () => moveGoalMoney(goal.id, { fromAccountId: draft.from, toAccountId: draft.to, amount: amount ?? undefined, date: draft.date, direction }),
      { success: direction === 'in' ? 'Aporte registrado' : 'Retiro registrado' },
    );
    setErrors(e);
    return ok;
  };
  const options = accounts.map((a) => ({ value: a.id, label: a.name }));
  return (
    <FormDialog
      open={Boolean(goal)}
      onClose={onClose}
      title={`${direction === 'in' ? 'Aportar a' : 'Retirar de'} «${goal?.name ?? ''}»`}
      description="Se registra como una transferencia entre tus cuentas: el dinero no se duplica, solo queda apartado para la meta."
      onSubmit={submit}
      errors={errors}
      submitLabel={direction === 'in' ? 'Aportar' : 'Retirar'}
    >
      {accounts.length < 2 ? (
        <p className="org-banner org-banner--warning">Necesitas dos cuentas (por ejemplo, tu cuenta habitual y una de ahorro) para mover dinero hacia la meta.</p>
      ) : (
        <>
          <AmountField value={draft.amount} onChange={(amount) => set({ amount })} currency={finance.currency} error={errors?.amount} autoFocus />
          <div className="org-form__row">
            <SelectField label="Desde" value={draft.from} onChange={(from) => set({ from })} options={options} error={errors?.accountId} />
            <SelectField label="Hacia" value={draft.to} onChange={(to) => set({ to })} options={options.filter((o) => o.value !== draft.from)} error={errors?.toAccountId} placeholder="Elige una cuenta" />
          </div>
          <InputField label="Fecha" type="date" value={draft.date} onChange={(date) => set({ date })} error={errors?.date} />
        </>
      )}
    </FormDialog>
  );
}

export function Goals() {
  const finance = useFinance();
  const run = useRunner();
  const [form, setForm] = useState(null);
  const [move, setMove] = useState(null);
  const [remove, setRemove] = useState(null);
  const progress = useMemo(() => new Map(finance.goals.map((g) => [g.id, goalProgress(g, finance.transactions)])), [finance.goals, finance.transactions]);
  const order = { active: 0, paused: 1, achieved: 2, cancelled: 3 };

  return (
    <div className="org-stack">
      <p className="org-muted">Cada aporte es una transferencia real hacia la cuenta donde ahorras. El progreso se calcula con esos movimientos.</p>
      <div className="org-toolbar">
        <Button icon={Plus} onClick={() => setForm({ initial: null })}>
          Nueva meta
        </Button>
      </div>
      {finance.goals.length ? (
        <ul className="org-grid org-list">
          {[...finance.goals]
            .sort((a, b) => order[a.status] - order[b.status] || a.name.localeCompare(b.name, 'es'))
            .map((goal) => {
              const p = progress.get(goal.id);
              return (
                <li key={goal.id} className="org-panel org-goal" style={{ '--badge-color': goal.color }}>
                  <div className="org-budget__head">
                    <div>
                      <h3 className="org-row__title">{goal.name}</h3>
                      <p className="org-subtle">
                        {STATUS[goal.status]}
                        {goal.deadline && ` · hasta el ${shortDate(goal.deadline)} (${daysFromToday(goal.deadline, finance.today)})`}
                      </p>
                    </div>
                    <ActionMenu
                      label={`Acciones de ${goal.name}`}
                      items={[
                        { label: 'Editar', icon: Pencil, onClick: () => setForm({ initial: goal }) },
                        p.saved > 0 && { label: 'Retirar dinero', icon: ArrowUpRight, onClick: () => setMove({ goal, direction: 'out' }) },
                        { label: 'Eliminar', icon: Trash2, danger: true, onClick: () => setRemove(goal) },
                      ]}
                    />
                  </div>
                  <p className="org-goal__amount">
                    <strong>{formatMoney(p.saved, finance.currency)}</strong> <span className="org-subtle">de {formatMoney(goal.target, finance.currency)}</span>
                  </p>
                  <Progress value={p.saved} max={goal.target} label={`Progreso de ${goal.name}`} tone={p.reached ? 'done' : 'ok'} showValue />
                  {goal.description && <p className="org-subtle">{goal.description}</p>}
                  {p.reached && goal.status === 'active' && (
                    <p className="org-banner org-banner--success">
                      ¡Meta alcanzada!{' '}
                      <Button size="sm" variant="ghost" onClick={() => run(() => commit((tx) => tx.update(goal.id, { status: 'achieved' })), { success: 'Meta marcada como cumplida' })}>
                        Marcar como cumplida
                      </Button>
                    </p>
                  )}
                  {goal.status === 'active' && (
                    <Button size="sm" icon={ArrowDownLeft} onClick={() => setMove({ goal, direction: 'in' })}>
                      Aportar
                    </Button>
                  )}
                  {p.contributions.length > 0 && (
                    <details className="org-more">
                      <summary>Aportes y retiros ({p.contributions.length})</summary>
                      <ul className="org-mini-list">
                        {p.contributions.slice(0, 12).map((t) => (
                          <li key={t.id}>
                            <span>{shortDate(t.date)}</span>
                            <span className={t.goalDirection === 'out' ? 'is-negative' : 'is-positive'}>
                              {t.goalDirection === 'out' ? '−' : '+'}
                              {formatMoney(t.amount, finance.currency)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                  {goal.status !== 'active' && <Badge>{STATUS[goal.status]}</Badge>}
                </li>
              );
            })}
        </ul>
      ) : (
        <EmptyState icon={PiggyBank} title="Sin metas de ahorro" action={<Button icon={Plus} onClick={() => setForm({ initial: null })}>Crear una meta</Button>}>
          Ponle nombre y cifra a lo que quieres lograr; cada aporte te acerca y se ve el progreso real.
        </EmptyState>
      )}
      <GoalForm open={Boolean(form)} initial={form?.initial} onClose={() => setForm(null)} />
      <MoveDialog goal={move?.goal} direction={move?.direction} onClose={() => setMove(null)} />
      <DeleteDialog
        open={Boolean(remove)}
        recordId={remove?.id}
        title={`¿Eliminar la meta «${remove?.name ?? ''}»?`}
        onCancel={() => setRemove(null)}
        onConfirm={async () => {
          const { ok } = await run(() => deleteRecord(remove.id), { success: 'Meta eliminada' });
          if (ok) setRemove(null);
        }}
      />
    </div>
  );
}
