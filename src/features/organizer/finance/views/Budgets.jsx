import { useMemo, useState } from 'react';
import { Archive, ArchiveRestore, Gauge, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '../../../../components/common/Button.jsx';
import { commit, deleteRecord, updateRecord } from '../../data/store.js';
import { useRunner } from '../../data/hooks.js';
import { AmountField, CheckboxField, InputField, SelectField } from '../../shared/Fields.jsx';
import { ActionMenu, DeleteDialog, EmptyState, FormDialog, Progress } from '../../shared/ui.jsx';
import { shortDate } from '../../shared/format.js';
import { budgetStatus } from '../ledger.js';
import { formatMoney, parseAmount, toAmountInput } from '../money.js';
import { categoryOptions, useFinance } from '../useFinance.js';

const PERIOD_LABELS = { weekly: 'Semanal', monthly: 'Mensual', yearly: 'Anual' };
const STATE_LABELS = { ok: 'Dentro del límite', warning: 'Cerca del límite', over: 'Superado' };

function BudgetForm({ open, onClose, initial }) {
  const finance = useFinance();
  const run = useRunner();
  const isEdit = Boolean(initial?.id);
  const [draft, setDraft] = useState(null);
  const [errors, setErrors] = useState(null);
  if (open && !draft) {
    setDraft({
      name: initial?.name ?? '',
      categoryId: initial?.categoryId ?? null,
      amount: initial?.amount ? toAmountInput(initial.amount) : '',
      period: initial?.period ?? 'monthly',
      alertPercent: initial?.alertPercent ?? 80,
      includePending: initial?.includePending ?? false,
    });
  }
  if (!open && draft) setDraft(null);
  if (!draft) return null;
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const submit = async () => {
    const amount = parseAmount(draft.amount);
    const data = { ...draft, amount: amount ?? undefined };
    const { ok, errors: e } = await run(() => commit((tx) => (isEdit ? tx.update(initial.id, data) : tx.create('budget', data))), {
      success: isEdit ? 'Presupuesto actualizado' : 'Presupuesto creado',
    });
    setErrors(e);
    return ok;
  };
  return (
    <FormDialog open={open} onClose={onClose} title={isEdit ? 'Editar presupuesto' : 'Nuevo presupuesto'} onSubmit={submit} errors={errors}>
      <SelectField
        label="¿Qué limita?"
        value={draft.categoryId}
        onChange={(categoryId) => set({ categoryId })}
        options={categoryOptions(finance.categories, 'expense', draft.categoryId)}
        placeholder="Todos los gastos (presupuesto general)"
        error={errors?.categoryId}
        hint="Un presupuesto de una categoría principal incluye sus subcategorías."
      />
      <InputField label="Nombre (opcional)" value={draft.name} onChange={(name) => set({ name })} maxLength={60} />
      <div className="org-form__row">
        <AmountField label="Límite" value={draft.amount} onChange={(amount) => set({ amount })} currency={finance.currency} error={errors?.amount} />
        <SelectField label="Período" value={draft.period} onChange={(period) => set({ period })} options={Object.entries(PERIOD_LABELS).map(([value, label]) => ({ value, label }))} />
      </div>
      <SelectField
        label="Avisarme al llegar al"
        value={String(draft.alertPercent)}
        onChange={(v) => set({ alertPercent: Number(v) })}
        options={[50, 60, 70, 75, 80, 85, 90, 95, 100].map((n) => ({ value: String(n), label: `${n} %` }))}
      />
      <CheckboxField label="Contar también los gastos pendientes" checked={draft.includePending} onChange={(includePending) => set({ includePending })} />
    </FormDialog>
  );
}

export function Budgets() {
  const finance = useFinance();
  const run = useRunner();
  const [form, setForm] = useState(null);
  const [remove, setRemove] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const list = finance.budgets.filter((b) => Boolean(b.archived) === showArchived);
  const statuses = useMemo(
    () => new Map(finance.budgets.map((b) => [b.id, budgetStatus(b, finance.transactions, finance.categoriesById, finance.today, { ...finance.periodOptions, accountIds: finance.mainAccountIds })])),
    [finance],
  );
  const name = (b) => b.name || (b.categoryId ? finance.categoriesById.get(b.categoryId)?.name ?? 'Categoría eliminada' : 'Todos los gastos');

  return (
    <div className="org-stack">
      <p className="org-muted">
        Cada presupuesto compara lo gastado en su período actual con el límite. Solo cuentan los gastos completados en {finance.currency} (las transferencias y los pagos de tarjeta no).
      </p>
      <div className="org-toolbar">
        <Button icon={Plus} onClick={() => setForm({ initial: null })}>
          Nuevo presupuesto
        </Button>
        {finance.budgets.some((b) => b.archived) && (
          <Button variant="ghost" onClick={() => setShowArchived((v) => !v)} aria-pressed={showArchived}>
            {showArchived ? 'Ver activos' : 'Ver archivados'}
          </Button>
        )}
      </div>
      {list.length ? (
        <ul className="org-list">
          {[...list]
            .sort((a, b) => statuses.get(b.id).percent - statuses.get(a.id).percent)
            .map((b) => {
              const s = statuses.get(b.id);
              return (
                <li key={b.id} className="org-panel org-budget">
                  <div className="org-budget__head">
                    <div>
                      <h3 className="org-row__title">{name(b)}</h3>
                      <p className="org-subtle">
                        {PERIOD_LABELS[b.period]} · {shortDate(s.range.from)} – {shortDate(s.range.to)} · aviso al {b.alertPercent} %
                      </p>
                    </div>
                    <ActionMenu
                      label={`Acciones de ${name(b)}`}
                      items={[
                        { label: 'Editar', icon: Pencil, onClick: () => setForm({ initial: b }) },
                        { label: b.archived ? 'Restaurar' : 'Archivar', icon: b.archived ? ArchiveRestore : Archive, onClick: () => run(() => updateRecord(b.id, { archived: !b.archived }), { success: b.archived ? 'Presupuesto restaurado' : 'Presupuesto archivado' }) },
                        { label: 'Eliminar', icon: Trash2, danger: true, onClick: () => setRemove(b) },
                      ]}
                    />
                  </div>
                  <p>
                    <strong>{formatMoney(s.spent, finance.currency)}</strong> de {formatMoney(s.limit, finance.currency)} ·{' '}
                    <span className={s.state === 'over' ? 'is-negative' : s.state === 'warning' ? 'org-warning-text' : undefined}>
                      {STATE_LABELS[s.state]}
                      {s.remaining >= 0 ? ` · quedan ${formatMoney(s.remaining, finance.currency)}` : ` · ${formatMoney(-s.remaining, finance.currency)} por encima`}
                    </span>
                  </p>
                  <Progress value={s.spent} max={s.limit} label={`Consumo de ${name(b)}`} tone={s.state} showValue />
                </li>
              );
            })}
        </ul>
      ) : (
        <EmptyState icon={Gauge} title={showArchived ? 'No hay presupuestos archivados' : 'Sin presupuestos'} action={!showArchived && <Button icon={Plus} onClick={() => setForm({ initial: null })}>Crear un presupuesto</Button>}>
          Pon un límite general al mes o uno por categoría (por ejemplo, salidas o domicilios) y la app te avisará al acercarte.
        </EmptyState>
      )}
      <BudgetForm open={Boolean(form)} initial={form?.initial} onClose={() => setForm(null)} />
      <DeleteDialog
        open={Boolean(remove)}
        recordId={remove?.id}
        title="¿Eliminar este presupuesto?"
        onCancel={() => setRemove(null)}
        onConfirm={async () => {
          const { ok } = await run(() => deleteRecord(remove.id), { success: 'Presupuesto eliminado' });
          if (ok) setRemove(null);
        }}
        extraWarning={<p>Los movimientos no se modifican: solo desaparece el límite.</p>}
      />
    </div>
  );
}
