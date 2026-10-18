import { useMemo, useState } from 'react';
import { ArrowLeftRight, Ban, Check, Copy, Download, Paperclip, Pencil, Plus, ReceiptText, Trash2, Upload } from 'lucide-react';
import { Button } from '../../../../components/common/Button.jsx';
import { Badge } from '../../../../components/common/Card.jsx';
import { cx } from '../../../../utils/cx.js';
import { deleteRecord, duplicateRecord, updateRecord } from '../../data/store.js';
import { useRunner } from '../../data/hooks.js';
import { downloadFile } from '../../data/csv.js';
import { SelectField } from '../../shared/Fields.jsx';
import { ActionMenu, DeleteDialog, EmptyState, PeriodNav, SearchField } from '../../shared/ui.jsx';
import { dayHeading, shortDate } from '../../shared/format.js';
import { matchesQuery } from '../../shared/text.js';
import { CategoryBadge } from '../CategoryIcon.jsx';
import { formatMoney } from '../money.js';
import { periodRange, shiftPeriod } from '../ledger.js';
import { transactionsToCSV } from '../transactionsCsv.js';
import { categoryPath, STATUS_LABELS, TYPE_LABELS, useFinance } from '../useFinance.js';
import { useFinanceActions } from '../FinanceContext.js';
import { ViewSwitch } from './Overview.jsx';
import { ImportDialog } from './ImportDialog.jsx';

/** Fila de un movimiento: importe con signo, categoría, cuenta, estado y acciones. */
export function TransactionRow({ transaction: t, compact = false }) {
  const finance = useFinance();
  const { openTransaction } = useFinanceActions();
  const run = useRunner();
  const [confirm, setConfirm] = useState(false);
  const account = finance.accountsById.get(t.accountId);
  const to = finance.accountsById.get(t.toAccountId);
  const category = finance.categoriesById.get(t.categoryId);
  const currency = account?.currency ?? finance.currency;
  const sign = t.type === 'income' ? 1 : t.type === 'expense' ? -1 : 0;
  const title = t.description || (t.type === 'transfer' ? `Transferencia a ${to?.name ?? 'otra cuenta'}` : categoryPath(t.categoryId, finance.categoriesById));

  return (
    <li className={cx('org-row', compact && 'org-row--compact', t.status === 'cancelled' && 'is-muted')}>
      {t.type === 'transfer' ? <CategoryBadge fallbackIcon={ArrowLeftRight} color="var(--c-secondary)" /> : <CategoryBadge category={category} />}
      <button type="button" className="org-row__main" onClick={() => openTransaction(t)} aria-label={`Editar: ${title}`}>
        <span className="org-row__title">{title}</span>
        <span className="org-row__meta">
          {compact && <span>{shortDate(t.date)}</span>}
          <span>{t.type === 'transfer' ? `${account?.name ?? '—'} → ${to?.name ?? '—'}` : account?.name ?? 'Cuenta eliminada'}</span>
          {t.description && t.type !== 'transfer' && <span>{categoryPath(t.categoryId, finance.categoriesById)}</span>}
          {t.time && !compact && <span>{t.time}</span>}
          {t.attachmentIds.length > 0 && <Paperclip aria-label="Con comprobante" width={14} height={14} />}
          {t.goalId && <span>Meta: {finance.goals.find((g) => g.id === t.goalId)?.name}</span>}
        </span>
      </button>
      <div className="org-row__end">
        <span className="org-stack-end">
          <span className={cx('org-row__amount', sign > 0 && 'is-positive', sign < 0 && 'is-negative')}>
            {sign === 0 ? formatMoney(t.amount, currency) : formatMoney(sign * t.amount, currency, { signed: true })}
          </span>
          {t.status !== 'completed' && <Badge tone={t.status === 'pending' ? 'warning' : undefined}>{STATUS_LABELS[t.status]}</Badge>}
        </span>
        {!compact && (
          <ActionMenu
            label={`Acciones de «${title}»`}
            items={[
              { label: 'Editar', icon: Pencil, onClick: () => openTransaction(t) },
              t.status === 'pending' && { label: 'Marcar como completado', icon: Check, onClick: () => run(() => updateRecord(t.id, { status: 'completed' }), { success: 'Movimiento completado' }) },
              t.status !== 'cancelled' && { label: 'Cancelar movimiento', icon: Ban, onClick: () => run(() => updateRecord(t.id, { status: 'cancelled' }), { success: 'Movimiento cancelado (se conserva en el historial)' }) },
              t.status === 'cancelled' && { label: 'Reactivar como pendiente', icon: Check, onClick: () => run(() => updateRecord(t.id, { status: 'pending' }), { success: 'Movimiento reactivado' }) },
              { label: 'Duplicar', icon: Copy, onClick: () => run(() => duplicateRecord(t.id, { description: t.description, date: finance.today, scheduleId: null, scheduleDate: null }), { success: 'Movimiento duplicado con fecha de hoy' }) },
              { label: 'Eliminar', icon: Trash2, danger: true, onClick: () => setConfirm(true) },
            ]}
          />
        )}
      </div>
      <DeleteDialog
        open={confirm}
        recordId={t.id}
        title="¿Eliminar este movimiento?"
        onCancel={() => setConfirm(false)}
        onConfirm={async () => {
          const { ok } = await run(() => deleteRecord(t.id), { success: 'Movimiento eliminado' });
          if (ok) setConfirm(false);
        }}
        extraWarning={t.scheduleId ? <p>Su pago programado volverá a aparecer como pendiente en esa fecha.</p> : null}
      />
    </li>
  );
}

const SORTS = {
  'date-desc': (a, b) => b.date.localeCompare(a.date) || (b.time ?? '').localeCompare(a.time ?? '') || b.createdAt.localeCompare(a.createdAt),
  'date-asc': (a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? ''),
  'amount-desc': (a, b) => b.amount - a.amount,
  'amount-asc': (a, b) => a.amount - b.amount,
};

export function Transactions() {
  const finance = useFinance();
  const { openTransaction } = useFinanceActions();
  const { transactions, categoriesById, accountsById, today, periodOptions } = finance;
  const [range, setRange] = useState(() => periodRange('month', today, periodOptions));
  const [allTime, setAllTime] = useState(false);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({ type: null, status: null, accountId: null, categoryId: null, sort: 'date-desc' });
  const [importing, setImporting] = useState(false);
  const setFilter = (patch) => setFilters((f) => ({ ...f, ...patch }));

  const visible = useMemo(() => {
    const matchCategory = (id) => !filters.categoryId || id === filters.categoryId || categoriesById.get(id)?.parentId === filters.categoryId;
    return transactions
      .filter((t) => allTime || (t.date >= range.from && t.date <= range.to))
      .filter((t) => !filters.type || t.type === filters.type)
      .filter((t) => !filters.status || t.status === filters.status)
      .filter((t) => !filters.accountId || t.accountId === filters.accountId || t.toAccountId === filters.accountId)
      .filter((t) => matchCategory(t.categoryId))
      .filter((t) =>
        matchesQuery(query, t.description, t.notes, t.tags, categoryPath(t.categoryId, categoriesById), accountsById.get(t.accountId)?.name, accountsById.get(t.toAccountId)?.name),
      )
      .sort(SORTS[filters.sort]);
  }, [transactions, allTime, range, filters, query, categoriesById, accountsById]);

  const byDate = filters.sort.startsWith('date');
  const groups = useMemo(() => {
    if (!byDate) return [['', visible]];
    const map = new Map();
    for (const t of visible) {
      if (!map.has(t.date)) map.set(t.date, []);
      map.get(t.date).push(t);
    }
    return [...map];
  }, [visible, byDate]);

  const exportCsv = () => {
    const csv = transactionsToCSV(visible, { accountsById, categoriesById });
    downloadFile(`movimientos-${allTime ? 'todos' : `${range.from}_${range.to}`}.csv`, csv);
  };

  const rootCategories = finance.categories.filter((c) => !c.parentId).sort((a, b) => a.name.localeCompare(b.name, 'es'));

  return (
    <div className="org-stack">
      <div className="org-toolbar org-toolbar--split">
        {!allTime && <ViewSwitch value={range.view} onChange={(view) => setRange(periodRange(view, today, periodOptions))} />}
        {!allTime && (
          <PeriodNav
            label={range.label}
            onPrev={() => setRange(shiftPeriod(range, -1, periodOptions))}
            onNext={() => setRange(shiftPeriod(range, 1, periodOptions))}
            onToday={() => setRange(periodRange(range.view, today, periodOptions))}
          />
        )}
        <Button variant="ghost" size="sm" onClick={() => setAllTime((v) => !v)} aria-pressed={allTime}>
          {allTime ? 'Ver por período' : 'Ver todo el historial'}
        </Button>
        <div className="org-toolbar__end">
          <Button variant="secondary" size="sm" icon={Upload} onClick={() => setImporting(true)}>
            Importar CSV
          </Button>
          <Button variant="secondary" size="sm" icon={Download} onClick={exportCsv} disabled={!visible.length}>
            Exportar CSV
          </Button>
          <Button size="sm" icon={Plus} onClick={() => openTransaction(null)}>
            Movimiento
          </Button>
        </div>
      </div>

      <SearchField label="Buscar movimientos" value={query} onChange={setQuery} placeholder="Buscar por descripción, nota, etiqueta, categoría o cuenta…" />
      <div className="org-filters">
        <SelectField label="Tipo" value={filters.type} onChange={(type) => setFilter({ type })} placeholder="Todos" options={Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label }))} />
        <SelectField label="Estado" value={filters.status} onChange={(status) => setFilter({ status })} placeholder="Todos" options={Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))} />
        <SelectField label="Cuenta" value={filters.accountId} onChange={(accountId) => setFilter({ accountId })} placeholder="Todas" options={finance.accounts.map((a) => ({ value: a.id, label: a.name }))} />
        <SelectField
          label="Categoría"
          value={filters.categoryId}
          onChange={(categoryId) => setFilter({ categoryId })}
          placeholder="Todas"
          options={rootCategories.flatMap((root) => [
            { value: root.id, label: root.name, group: root.type === 'income' ? 'Ingresos' : 'Gastos' },
            ...finance.categories.filter((c) => c.parentId === root.id).map((c) => ({ value: c.id, label: `   ${c.name}`, group: root.type === 'income' ? 'Ingresos' : 'Gastos' })),
          ])}
        />
        <SelectField
          label="Ordenar por"
          value={filters.sort}
          onChange={(sort) => setFilter({ sort: sort ?? 'date-desc' })}
          options={[
            { value: 'date-desc', label: 'Más recientes' },
            { value: 'date-asc', label: 'Más antiguos' },
            { value: 'amount-desc', label: 'Mayor valor' },
            { value: 'amount-asc', label: 'Menor valor' },
          ]}
        />
      </div>
      <p className="org-subtle" aria-live="polite">
        {visible.length === 1 ? '1 movimiento' : `${visible.length.toLocaleString('es')} movimientos`}
      </p>

      {visible.length ? (
        groups.map(([date, list]) => (
          <section key={date || 'all'} aria-label={date ? dayHeading(date) : 'Movimientos'}>
            {date && <h3 className="org-group-title">{dayHeading(date)}</h3>}
            <ul className="org-list">
              {list.map((t) => (
                <TransactionRow key={t.id} transaction={t} />
              ))}
            </ul>
          </section>
        ))
      ) : (
        <EmptyState icon={ReceiptText} title={transactions.length ? 'Nada coincide con los filtros' : 'Todavía no hay movimientos'}>
          {transactions.length ? 'Prueba con otro período o quita algún filtro.' : 'Registra un gasto o un ingreso, o importa tus movimientos desde un CSV.'}
        </EmptyState>
      )}
      <ImportDialog open={importing} onClose={() => setImporting(false)} />
    </div>
  );
}
