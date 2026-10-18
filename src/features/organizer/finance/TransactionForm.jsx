import { useEffect, useMemo, useState } from 'react';
import { useToast } from '../../../components/feedback/ToastProvider.jsx';
import { commit, listKind } from '../data/store.js';
import { useRunner } from '../data/hooks.js';
import { AmountField, InputField, SelectField, TagsField, TextAreaField } from '../shared/Fields.jsx';
import { AttachmentsField } from '../shared/Attachments.jsx';
import { FormDialog } from '../shared/ui.jsx';
import { formatMoney, parseAmount, toAmountInput } from './money.js';
import { budgetStatus } from './ledger.js';
import { ACCOUNT_TYPE_LABELS, categoryOptions, METHOD_LABELS, STATUS_LABELS, TYPE_LABELS, useFinance } from './useFinance.js';

const METHOD_BY_ACCOUNT = { cash: 'cash', bank: 'debit', wallet: 'wallet', credit: 'credit', savings: 'transfer', other: 'other' };

function draftFrom(initial, finance) {
  const firstAccount = finance.accounts.find((a) => !a.archived);
  return {
    type: initial?.type ?? 'expense',
    amount: initial?.amount ? toAmountInput(initial.amount) : '',
    date: initial?.date ?? finance.today,
    time: initial?.time ?? '',
    accountId: initial?.accountId ?? firstAccount?.id ?? null,
    toAccountId: initial?.toAccountId ?? null,
    categoryId: initial?.categoryId ?? null,
    description: initial?.description ?? '',
    notes: initial?.notes ?? '',
    method: initial?.method ?? METHOD_BY_ACCOUNT[firstAccount?.type] ?? 'other',
    status: initial?.status ?? 'completed',
    tags: initial?.tags ?? [],
    attachmentIds: initial?.attachmentIds ?? [],
    goalId: initial?.goalId ?? null,
    goalDirection: initial?.goalDirection ?? 'in',
  };
}

/**
 * Avisos de presupuesto tras guardar un gasto: solo cuando este movimiento hizo que un
 * presupuesto pase a «cerca del límite» o «superado» (no en cada gasto).
 */
function budgetNotices(before, after) {
  const notices = [];
  for (const [id, state] of after) {
    const previous = before.get(id);
    if (state.state !== 'ok' && state.state !== previous?.state) notices.push(state);
  }
  return notices;
}

function budgetStates(anchor, finance) {
  const transactions = listKind('transaction');
  const out = new Map();
  for (const budget of listKind('budget')) {
    if (budget.archived) continue;
    out.set(budget.id, { budget, ...budgetStatus(budget, transactions, finance.categoriesById, anchor, { ...finance.periodOptions, accountIds: finance.mainAccountIds }) });
  }
  return out;
}

/**
 * Formulario de movimiento. `quick` muestra solo lo esencial (valor, categoría, cuenta)
 * para registrar un gasto pequeño en segundos; el resto toma valores por defecto.
 */
export function TransactionForm({ open, onClose, initial, quick = false, title }) {
  const finance = useFinance();
  const run = useRunner();
  const { toast } = useToast();
  const [draft, setDraft] = useState(() => draftFrom(initial, finance));
  const [errors, setErrors] = useState(null);

  useEffect(() => {
    if (open) {
      setDraft(draftFrom(initial, finance));
      setErrors(null);
    }
    // Se reinicia al abrir; `finance` cambia con cada guardado y no debe borrar lo escrito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial]);

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const accountOptions = useMemo(
    () =>
      finance.accounts
        .filter((a) => !a.archived || a.id === draft.accountId || a.id === draft.toAccountId)
        .map((a) => ({ value: a.id, label: `${a.name} · ${ACCOUNT_TYPE_LABELS[a.type]}${a.currency !== finance.currency ? ` (${a.currency})` : ''}` })),
    [finance.accounts, finance.currency, draft.accountId, draft.toAccountId],
  );
  const currency = finance.currencyOf(draft.accountId);
  const isEdit = Boolean(initial?.id);

  if (!finance.accounts.length) {
    return (
      <FormDialog open={open} onClose={onClose} title="Primero, una cuenta" submitLabel="Entendido" onSubmit={() => true}>
        <p>Para registrar movimientos necesitas al menos una cuenta (efectivo, banco, billetera…). Créala en la pestaña «Cuentas».</p>
      </FormDialog>
    );
  }

  const submit = async () => {
    const amount = parseAmount(draft.amount);
    const data = { ...draft, amount: amount ?? undefined, time: draft.time || null };
    if (amount === null && draft.amount) {
      setErrors({ amount: 'El valor no es un importe válido.' });
      return false;
    }
    const before = draft.type === 'expense' ? budgetStates(draft.date, finance) : null;
    const { ok, errors: fieldErrors } = await run(
      () => commit((tx) => (isEdit ? tx.update(initial.id, data) : tx.create('transaction', data))),
      { success: isEdit ? 'Movimiento actualizado' : `${TYPE_LABELS[draft.type]} registrado` },
    );
    setErrors(fieldErrors);
    if (ok && before) {
      for (const notice of budgetNotices(before, budgetStates(draft.date, finance))) {
        const name = notice.budget.name || (notice.budget.categoryId ? finance.categoriesById.get(notice.budget.categoryId)?.name : 'Presupuesto general');
        toast({
          tone: notice.state === 'over' ? 'error' : 'info',
          message:
            notice.state === 'over'
              ? `Presupuesto «${name}» superado: ${formatMoney(notice.spent, finance.currency)} de ${formatMoney(notice.limit, finance.currency)}.`
              : `Presupuesto «${name}» al ${Math.round(notice.percent)} %: quedan ${formatMoney(notice.remaining, finance.currency)}.`,
          duration: 7000,
        });
      }
    }
    return ok;
  };

  const typeButtons = (
    <div className="org-segment" role="group" aria-label="Tipo de movimiento">
      {['expense', 'income', 'transfer'].map((type) => (
        <button key={type} type="button" aria-pressed={draft.type === type} onClick={() => set({ type, categoryId: null })}>
          {TYPE_LABELS[type]}
        </button>
      ))}
    </div>
  );

  const categorySelect =
    draft.type !== 'transfer' ? (
      <SelectField
        label="Categoría"
        value={draft.categoryId}
        onChange={(categoryId) => set({ categoryId })}
        options={categoryOptions(finance.categories, draft.type, draft.categoryId)}
        placeholder="Sin categoría"
        error={errors?.categoryId}
      />
    ) : null;

  const accountSelect = (
    <SelectField
      label={draft.type === 'transfer' ? 'Desde la cuenta' : 'Cuenta'}
      value={draft.accountId}
      onChange={(accountId) => set({ accountId, method: METHOD_BY_ACCOUNT[finance.accountsById.get(accountId)?.type] ?? draft.method })}
      options={accountOptions}
      error={errors?.accountId}
    />
  );

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={title ?? (isEdit ? 'Editar movimiento' : quick ? 'Gasto rápido' : 'Nuevo movimiento')}
      onSubmit={submit}
      errors={errors}
      size={quick ? 'sm' : 'lg'}
      submitLabel={isEdit ? 'Guardar cambios' : 'Registrar'}
    >
      {!quick && typeButtons}
      <AmountField value={draft.amount} onChange={(amount) => set({ amount })} currency={currency} error={errors?.amount} autoFocus />
      {quick ? (
        <>
          {categorySelect}
          <InputField label="Descripción (opcional)" value={draft.description} onChange={(description) => set({ description })} maxLength={120} placeholder="Ej.: almuerzo" />
          {accountSelect}
        </>
      ) : (
        <>
          <div className="org-form__row">
            <InputField label="Fecha" type="date" value={draft.date} onChange={(date) => set({ date })} error={errors?.date} required />
            <InputField label="Hora (opcional)" type="time" value={draft.time} onChange={(time) => set({ time })} error={errors?.time} />
          </div>
          <div className="org-form__row">
            {accountSelect}
            {draft.type === 'transfer' ? (
              <SelectField
                label="Hacia la cuenta"
                value={draft.toAccountId}
                onChange={(toAccountId) => set({ toAccountId })}
                options={accountOptions.filter((o) => o.value !== draft.accountId)}
                placeholder="Elige la cuenta de destino"
                error={errors?.toAccountId}
                hint={finance.accountsById.get(draft.toAccountId)?.type === 'credit' ? 'Pagar la tarjeta reduce su deuda y no cuenta como gasto nuevo.' : undefined}
              />
            ) : (
              categorySelect
            )}
          </div>
          <InputField label="Descripción" value={draft.description} onChange={(description) => set({ description })} maxLength={120} error={errors?.description} />
          <div className="org-form__row">
            <SelectField label="Estado" value={draft.status} onChange={(status) => set({ status })} options={Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))} hint={draft.status === 'pending' ? 'Los pendientes no cambian el saldo hasta completarlos.' : undefined} />
            <SelectField label="Método de pago" value={draft.method} onChange={(method) => set({ method })} options={Object.entries(METHOD_LABELS).map(([value, label]) => ({ value, label }))} />
          </div>
          {draft.type === 'transfer' && finance.goals.some((g) => g.status === 'active' || g.id === draft.goalId) && (
            <div className="org-form__row">
              <SelectField
                label="Meta de ahorro (opcional)"
                value={draft.goalId}
                onChange={(goalId) => set({ goalId })}
                placeholder="Ninguna"
                options={finance.goals.filter((g) => g.status === 'active' || g.id === draft.goalId).map((g) => ({ value: g.id, label: g.name }))}
              />
              {draft.goalId && (
                <SelectField label="Para la meta es un…" value={draft.goalDirection} onChange={(goalDirection) => set({ goalDirection })} options={[{ value: 'in', label: 'Aporte' }, { value: 'out', label: 'Retiro' }]} />
              )}
            </div>
          )}
          <details className="org-more" open={Boolean(draft.notes || draft.tags.length || draft.attachmentIds.length)}>
            <summary>Notas, etiquetas y comprobantes</summary>
            <div className="org-more__body">
              <TextAreaField label="Notas" value={draft.notes} onChange={(notes) => set({ notes })} rows={3} maxLength={2000} />
              <TagsField value={draft.tags} onChange={(tags) => set({ tags })} suggestions={[...new Set(finance.transactions.flatMap((t) => t.tags))]} />
              <AttachmentsField label="Comprobantes" value={draft.attachmentIds} onChange={(attachmentIds) => set({ attachmentIds })} />
            </div>
          </details>
          {isEdit && initial.history?.length > 0 && (
            <details className="org-more">
              <summary>Historial de cambios ({initial.history.length})</summary>
              <ul className="org-history">
                {[...initial.history].reverse().map((entry) => (
                  <li key={entry.at}>
                    <time dateTime={entry.at}>{new Date(entry.at).toLocaleString('es')}</time>: {Object.keys(entry.changes).map(fieldLabel).join(', ')}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </FormDialog>
  );
}

const FIELD_LABELS = {
  type: 'tipo',
  amount: 'valor',
  date: 'fecha',
  time: 'hora',
  accountId: 'cuenta',
  toAccountId: 'cuenta de destino',
  categoryId: 'categoría',
  description: 'descripción',
  notes: 'notas',
  method: 'método',
  status: 'estado',
  tags: 'etiquetas',
  attachmentIds: 'comprobantes',
  goalId: 'meta',
  goalDirection: 'aporte o retiro',
};
const fieldLabel = (key) => FIELD_LABELS[key] ?? key;
