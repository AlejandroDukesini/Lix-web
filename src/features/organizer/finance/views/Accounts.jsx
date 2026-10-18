import { useMemo, useState } from 'react';
import { Archive, ArchiveRestore, ArrowLeftRight, Banknote, CreditCard, Landmark, Pencil, PiggyBank, Plus, Scale, Smartphone, Trash2, Wallet } from 'lucide-react';
import { Button } from '../../../../components/common/Button.jsx';
import { Badge } from '../../../../components/common/Card.jsx';
import { cx } from '../../../../utils/cx.js';
import { commit, deleteRecord, saveSettings, updateRecord } from '../../data/store.js';
import { useRunner } from '../../data/hooks.js';
import { AmountField, ColorPicker, InputField, SelectField, TextAreaField } from '../../shared/Fields.jsx';
import { ActionMenu, DeleteDialog, EmptyState, FormDialog, Section } from '../../shared/ui.jsx';
import { shortDate } from '../../shared/format.js';
import { accountBalances, creditCardInfo } from '../ledger.js';
import { COMMON_CURRENCIES, formatMoney, parseAmount, toAmountInput } from '../money.js';
import { ACCOUNT_TYPE_LABELS, useFinance } from '../useFinance.js';
import { useFinanceActions } from '../FinanceContext.js';

export const ACCOUNT_ICONS = { cash: Banknote, bank: Landmark, wallet: Smartphone, credit: CreditCard, savings: PiggyBank, other: Wallet };

function AccountForm({ open, onClose, initial }) {
  const finance = useFinance();
  const run = useRunner();
  const isEdit = Boolean(initial?.id);
  const [draft, setDraft] = useState(null);
  const [errors, setErrors] = useState(null);
  if (open && !draft) {
    setDraft({
      name: initial?.name ?? '',
      type: initial?.type ?? 'bank',
      currency: initial?.currency ?? finance.currency,
      openingBalance: initial ? toAmountInput(initial.type === 'credit' ? -initial.openingBalance : initial.openingBalance) : '',
      openingDate: initial?.openingDate ?? finance.today,
      description: initial?.description ?? '',
      color: initial?.color ?? null,
      creditLimit: initial?.creditLimit ? toAmountInput(initial.creditLimit) : '',
      statementDay: initial?.statementDay ?? '',
      dueDay: initial?.dueDay ?? '',
    });
  }
  if (!open && draft) setDraft(null);
  if (!draft) return null;
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const credit = draft.type === 'credit';

  const submit = async () => {
    const opening = draft.openingBalance ? parseAmount(draft.openingBalance) : 0;
    const limit = draft.creditLimit ? parseAmount(draft.creditLimit) : null;
    if (opening === null || (draft.creditLimit && limit === null)) {
      setErrors({ ...(opening === null && { openingBalance: 'Importe no válido.' }), ...(draft.creditLimit && limit === null && { creditLimit: 'Importe no válido.' }) });
      return false;
    }
    const data = {
      ...draft,
      // En una tarjeta se escribe la deuda (positiva) y se guarda como saldo negativo.
      openingBalance: credit ? -Math.abs(opening) : opening,
      creditLimit: credit ? limit : null,
      statementDay: credit && draft.statementDay ? Number(draft.statementDay) : null,
      dueDay: credit && draft.dueDay ? Number(draft.dueDay) : null,
    };
    const { ok, errors: e } = await run(() => commit((tx) => (isEdit ? tx.update(initial.id, data) : tx.create('account', data))), {
      success: isEdit ? 'Cuenta actualizada' : 'Cuenta creada',
    });
    setErrors(e);
    return ok;
  };

  const dayOptions = Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }));
  return (
    <FormDialog open={open} onClose={onClose} title={isEdit ? 'Editar cuenta' : 'Nueva cuenta'} onSubmit={submit} errors={errors}>
      <InputField label="Nombre" value={draft.name} onChange={(name) => set({ name })} error={errors?.name} maxLength={60} placeholder="Ej.: Bancolombia, Nequi, Efectivo" autoFocus />
      <div className="org-form__row">
        <SelectField label="Tipo" value={draft.type} onChange={(type) => set({ type })} options={Object.entries(ACCOUNT_TYPE_LABELS).map(([value, label]) => ({ value, label }))} />
        <SelectField
          label="Moneda"
          value={draft.currency}
          onChange={(currency) => set({ currency })}
          options={[...new Set([draft.currency, ...COMMON_CURRENCIES])].map((c) => ({ value: c, label: c }))}
          hint={isEdit && draft.currency !== initial.currency ? 'Cambiar la moneda no convierte los importes ya registrados.' : undefined}
        />
      </div>
      <div className="org-form__row">
        <AmountField
          label={credit ? 'Deuda inicial' : 'Saldo inicial'}
          value={draft.openingBalance}
          onChange={(openingBalance) => set({ openingBalance })}
          currency={draft.currency}
          error={errors?.openingBalance}
          allowNegative={!credit}
        />
        <InputField label="Fecha de apertura" type="date" value={draft.openingDate} onChange={(openingDate) => set({ openingDate })} error={errors?.openingDate} hint="El saldo inicial cuenta desde este día." />
      </div>
      {credit && (
        <fieldset className="org-form__group">
          <legend>Tarjeta de crédito</legend>
          <AmountField label="Cupo total (opcional)" value={draft.creditLimit} onChange={(creditLimit) => set({ creditLimit })} currency={draft.currency} error={errors?.creditLimit} />
          <div className="org-form__row">
            <SelectField label="Día de corte" value={draft.statementDay ? String(draft.statementDay) : null} onChange={(statementDay) => set({ statementDay })} options={dayOptions} placeholder="—" />
            <SelectField label="Día límite de pago" value={draft.dueDay ? String(draft.dueDay) : null} onChange={(dueDay) => set({ dueDay })} options={dayOptions} placeholder="—" />
          </div>
          <p className="field__hint">Las compras con la tarjeta son gastos. Pagarla es una transferencia desde otra cuenta: así el gasto no se cuenta dos veces.</p>
        </fieldset>
      )}
      <TextAreaField label="Descripción (opcional)" value={draft.description} onChange={(description) => set({ description })} rows={2} maxLength={280} />
      <ColorPicker value={draft.color} onChange={(color) => set({ color })} allowNone />
    </FormDialog>
  );
}

/**
 * Conciliar: la persona escribe el saldo real (el que dice el banco o lo que hay en la
 * billetera) y se registra un ajuste por la diferencia, visible en el historial.
 */
function ReconcileDialog({ account, balance, onClose }) {
  const run = useRunner();
  const finance = useFinance();
  const [value, setValue] = useState('');
  const [error, setError] = useState(null);
  const real = parseAmount(value);
  const credit = account?.type === 'credit';
  const target = real === null ? null : credit ? -Math.abs(real) : real;
  const diff = target === null ? 0 : target - balance;
  const submit = async () => {
    if (target === null) {
      setError('Escribe el saldo real.');
      return false;
    }
    if (diff === 0) return true;
    const { ok } = await run(
      () =>
        commit((tx) =>
          tx.create('transaction', {
            type: diff > 0 ? 'income' : 'expense',
            amount: Math.abs(diff),
            date: finance.today,
            accountId: account.id,
            description: 'Ajuste de conciliación',
            notes: `Saldo en la app: ${formatMoney(balance, account.currency)}. Saldo real: ${formatMoney(target, account.currency)}.`,
            tags: ['conciliación'],
          }),
        ),
      { success: 'Saldo conciliado' },
    );
    return ok;
  };
  return (
    <FormDialog open={Boolean(account)} onClose={onClose} title={`Conciliar «${account?.name ?? ''}»`} onSubmit={submit} submitLabel="Conciliar" description="Compara con el saldo real. Si no coinciden, se registra un ajuste por la diferencia (puedes verlo y borrarlo en Movimientos).">
      {account && (
        <>
          <p>
            Saldo según la app: <strong>{formatMoney(balance, account.currency)}</strong>
          </p>
          <AmountField label={credit ? 'Deuda real de la tarjeta' : 'Saldo real'} value={value} onChange={setValue} currency={account.currency} error={error} allowNegative={!credit} autoFocus />
          {target !== null && (
            <p className={diff ? 'org-banner org-banner--warning' : 'org-banner org-banner--success'} role="status">
              {diff ? `Se registrará un ${diff > 0 ? 'ingreso' : 'gasto'} de ajuste de ${formatMoney(Math.abs(diff), account.currency)}.` : 'El saldo coincide: no hace falta ajuste.'}
            </p>
          )}
        </>
      )}
    </FormDialog>
  );
}

function FinanceSettings() {
  const finance = useFinance();
  const run = useRunner();
  const currencies = [...new Set([finance.currency, ...finance.accounts.map((a) => a.currency), ...COMMON_CURRENCIES])];
  return (
    <Section title="Ajustes de finanzas" description="Los totales del resumen se calculan en la moneda principal. El inicio del mes sirve si recibes tu dinero, por ejemplo, el día 15.">
      <div className="org-form__row">
        <SelectField
          label="Moneda principal"
          value={finance.currency}
          onChange={(mainCurrency) => mainCurrency && run(() => saveSettings('financeSettings', { mainCurrency }), { success: 'Moneda principal actualizada' })}
          options={currencies.map((c) => ({ value: c, label: c }))}
        />
        <SelectField
          label="El mes financiero empieza el día"
          value={String(finance.settings.monthStartDay)}
          onChange={(day) => run(() => saveSettings('financeSettings', { monthStartDay: Number(day) || 1 }), { success: 'Inicio del mes actualizado' })}
          options={Array.from({ length: 28 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))}
        />
      </div>
    </Section>
  );
}

export function Accounts() {
  const finance = useFinance();
  const { openTransaction } = useFinanceActions();
  const run = useRunner();
  const [form, setForm] = useState(null); // { initial }
  const [reconcile, setReconcile] = useState(null);
  const [remove, setRemove] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const balances = useMemo(() => accountBalances(finance.accounts, finance.transactions, finance.today), [finance.accounts, finance.transactions, finance.today]);
  const active = finance.accounts.filter((a) => !a.archived);
  const archived = finance.accounts.filter((a) => a.archived);
  const list = showArchived ? archived : active;

  return (
    <div className="org-stack">
      <div className="org-toolbar">
        <Button icon={Plus} onClick={() => setForm({ initial: null })}>
          Nueva cuenta
        </Button>
        {active.length >= 2 && (
          <Button variant="secondary" icon={ArrowLeftRight} onClick={() => openTransaction({ type: 'transfer' })}>
            Transferir entre cuentas
          </Button>
        )}
        {archived.length > 0 && (
          <Button variant="ghost" onClick={() => setShowArchived((v) => !v)} aria-pressed={showArchived}>
            {showArchived ? 'Ver activas' : `Archivadas (${archived.length})`}
          </Button>
        )}
      </div>

      {list.length ? (
        <ul className="org-grid org-list">
          {list.map((account) => {
            const Icon = ACCOUNT_ICONS[account.type];
            const { balance, pendingIn, pendingOut } = balances.get(account.id);
            const card = account.type === 'credit' ? creditCardInfo(account, balance, finance.today) : null;
            const usage = card && account.creditLimit ? (card.debt / account.creditLimit) * 100 : null;
            return (
              <li key={account.id} className="org-panel org-account" style={{ '--badge-color': account.color ?? 'var(--c-secondary)' }}>
                <div className="org-account__head">
                  <span className="org-icon-badge" aria-hidden="true">
                    <Icon />
                  </span>
                  <div className="org-account__name">
                    <h3>{account.name}</h3>
                    <p className="org-subtle">
                      {ACCOUNT_TYPE_LABELS[account.type]} · {account.currency}
                    </p>
                  </div>
                  <ActionMenu
                    label={`Acciones de ${account.name}`}
                    items={[
                      { label: 'Editar', icon: Pencil, onClick: () => setForm({ initial: account }) },
                      { label: 'Conciliar saldo', icon: Scale, onClick: () => setReconcile({ account, balance }) },
                      account.archived
                        ? { label: 'Restaurar', icon: ArchiveRestore, onClick: () => run(() => updateRecord(account.id, { archived: false }), { success: 'Cuenta restaurada' }) }
                        : { label: 'Archivar', icon: Archive, onClick: () => run(() => updateRecord(account.id, { archived: true }), { success: 'Cuenta archivada: su historial se conserva' }) },
                      { label: 'Eliminar', icon: Trash2, danger: true, onClick: () => setRemove(account) },
                    ]}
                  />
                </div>
                <p className={cx('org-account__balance', balance < 0 && 'is-negative')}>
                  {card ? (
                    <>
                      <span className="org-subtle">Deuda</span> {formatMoney(card.debt, account.currency)}
                    </>
                  ) : (
                    formatMoney(balance, account.currency)
                  )}
                </p>
                {(pendingIn > 0 || pendingOut > 0) && (
                  <p className="org-subtle">
                    Pendiente: {pendingIn > 0 && `+${formatMoney(pendingIn, account.currency)}`} {pendingOut > 0 && `−${formatMoney(pendingOut, account.currency)}`}
                  </p>
                )}
                {card && (
                  <div className="org-account__card">
                    {card.available !== null && (
                      <p className={card.overLimit ? 'is-negative' : 'org-muted'}>
                        Cupo disponible: {formatMoney(card.available, account.currency)} de {formatMoney(account.creditLimit, account.currency)}
                      </p>
                    )}
                    {usage !== null && <div className="org-progress"><div className="org-progress__track" role="progressbar" aria-label="Cupo usado" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(usage)}><span style={{ inlineSize: `${Math.min(100, usage)}%` }} /></div></div>}
                    <p className="org-subtle">
                      {card.nextStatement && `Próximo corte: ${shortDate(card.nextStatement)}`}
                      {card.nextStatement && card.nextDue && ' · '}
                      {card.nextDue && `Pagar antes del ${shortDate(card.nextDue)}`}
                    </p>
                    {card.debt > 0 && (
                      <Button size="sm" variant="secondary" onClick={() => openTransaction({ type: 'transfer', toAccountId: account.id, accountId: active.find((a) => a.type !== 'credit')?.id, amount: card.debt, description: `Pago de ${account.name}` })}>
                        Registrar pago de la tarjeta
                      </Button>
                    )}
                  </div>
                )}
                {account.archived && <Badge>Archivada</Badge>}
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState icon={Wallet} title={showArchived ? 'No hay cuentas archivadas' : 'Todavía no tienes cuentas'} action={!showArchived && <Button icon={Plus} onClick={() => setForm({ initial: null })}>Crear una cuenta</Button>}>
          Efectivo, banco, billetera digital, tarjeta de crédito o ahorro: cada una lleva su propio saldo.
        </EmptyState>
      )}

      <FinanceSettings />

      <AccountForm open={Boolean(form)} initial={form?.initial} onClose={() => setForm(null)} />
      <ReconcileDialog account={reconcile?.account} balance={reconcile?.balance ?? 0} onClose={() => setReconcile(null)} />
      <DeleteDialog
        open={Boolean(remove)}
        recordId={remove?.id}
        title={`¿Eliminar «${remove?.name ?? ''}»?`}
        onCancel={() => setRemove(null)}
        onConfirm={async () => {
          const { ok } = await run(() => deleteRecord(remove.id), { success: 'Cuenta eliminada' });
          if (ok) setRemove(null);
        }}
        alternative={
          remove && !remove.archived
            ? {
                label: 'Archivar',
                hint: 'Archívala: deja de aparecer en los formularios y conserva todos sus movimientos.',
                onClick: async () => {
                  await run(() => updateRecord(remove.id, { archived: true }), { success: 'Cuenta archivada' });
                  setRemove(null);
                },
              }
            : undefined
        }
      />
    </div>
  );
}
