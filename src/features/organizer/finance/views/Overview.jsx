import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { CalendarClock, Plus, Wallet, Zap } from 'lucide-react';
import { Button } from '../../../../components/common/Button.jsx';
import { BarList, ChartFrame, DataTable } from '../../shared/Charts.jsx';
import { EmptyState, Figure, PeriodNav, Progress, Section } from '../../shared/ui.jsx';
import { daysFromToday, shortDate } from '../../shared/format.js';
import { budgetStatus, dueOccurrences, expectedInPeriod, goalProgress, overview, periodRange, shiftPeriod, summarize } from '../ledger.js';
import { formatMoney } from '../money.js';
import { addDays } from '../../data/recurrence.js';
import { useFinance } from '../useFinance.js';
import { TransactionRow } from './Transactions.jsx';
import { OccurrenceActions } from './Scheduled.jsx';

export const VIEWS = [
  { value: 'day', label: 'Día' },
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mes' },
  { value: 'year', label: 'Año' },
];

export function ViewSwitch({ value, onChange }) {
  return (
    <div className="org-segment" role="group" aria-label="Vista del período">
      {VIEWS.map((v) => (
        <button key={v.value} type="button" aria-pressed={value === v.value} onClick={() => onChange(v.value)}>
          {v.label}
        </button>
      ))}
    </div>
  );
}

/** Variación respecto al período anterior, como texto («+12 % que el mes anterior»). */
function change(current, previous, noun) {
  if (!previous) return current ? `sin datos del ${noun} anterior` : null;
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return `igual que el ${noun} anterior`;
  return `${pct > 0 ? '+' : '−'}${Math.abs(pct)} % que el ${noun} anterior`;
}

const NOUNS = { day: 'día', week: 'semana', month: 'mes', year: 'año' };

export function Overview({ onNewTransaction, onQuickExpense }) {
  const finance = useFinance();
  const { accounts, transactions, categoriesById, currency, today, periodOptions, mainAccountIds } = finance;
  const [range, setRange] = useState(() => periodRange('month', today, periodOptions));

  const data = useMemo(() => {
    const options = { accountIds: mainAccountIds, categoriesById };
    const current = summarize(transactions, range.from, range.to, options);
    const prevRange = shiftPeriod(range, -1, periodOptions);
    const previous = summarize(transactions, prevRange.from, prevRange.to, options);
    const general = overview(accounts, transactions, today, currency);
    const expected = expectedInPeriod(finance.scheduled, transactions, range.from, range.to, today, mainAccountIds);
    const saved = finance.goals.filter((g) => g.status !== 'cancelled').reduce((sum, g) => sum + goalProgress(g, transactions).saved, 0);
    const distribution = [...current.expenseByCategory]
      .map(([id, value]) => {
        const cat = categoriesById.get(id);
        return { id, value, label: cat?.name ?? 'Sin categoría', color: cat?.color ?? '#8a8a9a' };
      })
      .sort((a, b) => b.value - a.value);
    const monthlyBudget = finance.budgets.find((b) => !b.archived && !b.categoryId && b.period === 'monthly');
    const budget = monthlyBudget ? budgetStatus(monthlyBudget, transactions, categoriesById, range.view === 'month' ? range.from : today, { ...periodOptions, accountIds: mainAccountIds }) : null;
    const upcoming = dueOccurrences(finance.scheduled, transactions, today, addDays(today, 30), 45).slice(0, 6);
    const recent = [...transactions].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)).slice(0, 6);
    return { current, previous, general, expected, saved, distribution, budget, upcoming, recent };
  }, [transactions, range, accounts, today, currency, finance.scheduled, finance.goals, finance.budgets, categoriesById, mainAccountIds, periodOptions]);

  if (!accounts.length) {
    return (
      <EmptyState
        icon={Wallet}
        title="Empieza por tus cuentas"
        action={
          <Button to="/finanzas/cuentas" icon={Plus}>
            Crear mi primera cuenta
          </Button>
        }
      >
        Una cuenta es donde vive tu dinero: efectivo, banco, una billetera digital o una tarjeta de crédito. Con ella, cada gasto e ingreso
        actualiza su saldo solo.
      </EmptyState>
    );
  }

  const { current, previous, general, expected, saved, distribution, budget, upcoming, recent } = data;
  const fmt = (v) => formatMoney(v, currency);
  const noun = NOUNS[range.view];

  return (
    <div className="org-stack">
      <div className="org-toolbar org-toolbar--split">
        <ViewSwitch value={range.view} onChange={(view) => setRange(periodRange(view, today, periodOptions))} />
        <PeriodNav
          label={range.label}
          onPrev={() => setRange(shiftPeriod(range, -1, periodOptions))}
          onNext={() => setRange(shiftPeriod(range, 1, periodOptions))}
          onToday={() => setRange(periodRange(range.view, today, periodOptions))}
        />
        <div className="org-toolbar__end org-noprint">
          <Button variant="secondary" size="sm" icon={Zap} onClick={onQuickExpense}>
            Gasto rápido
          </Button>
          <Button size="sm" icon={Plus} onClick={onNewTransaction}>
            Movimiento
          </Button>
        </div>
      </div>

      <section className="org-panel" aria-labelledby="fin-now">
        <h2 id="fin-now" className="sr-only">
          Situación actual
        </h2>
        <dl className="org-figures">
          <Figure label="Balance actual" value={fmt(general.total)} detail={general.debt ? `incluye ${fmt(general.debt)} de deuda en tarjetas` : 'suma de todas tus cuentas'} />
          <Figure label="Dinero disponible" value={fmt(general.available)} detail={general.pendingExpense ? `descontando ${fmt(general.pendingExpense)} pendientes` : 'efectivo, bancos y billeteras'} />
          <Figure label={`Ingresos del ${noun}`} value={fmt(current.income)} detail={change(current.income, previous.income, noun)} tone="positive" />
          <Figure label={`Gastos del ${noun}`} value={fmt(current.expense)} detail={change(current.expense, previous.expense, noun)} tone="negative" />
          <Figure label="Resultado" value={formatMoney(current.net, currency, { signed: true })} detail="ingresos − gastos (sin transferencias)" />
          <Figure label="Gastos pendientes" value={fmt(general.pendingExpense + expected.expense)} detail={expected.expense ? `${fmt(expected.expense)} son pagos programados` : 'movimientos sin completar'} />
          <Figure label="Ingresos esperados" value={fmt(general.pendingIncome + expected.income)} detail="pendientes y programados" />
          <Figure label="Ahorro acumulado" value={fmt(saved)} detail={finance.goals.length ? 'en tus metas de ahorro' : 'crea una meta para seguirlo'} />
        </dl>
        {general.otherCurrencies.size > 0 && (
          <p className="org-subtle">
            Otras monedas (no se suman al total):{' '}
            {[...general.otherCurrencies].map(([code, value]) => formatMoney(value, code)).join(' · ')}
          </p>
        )}
      </section>

      <div className="org-two">
        <div className="org-stack">
          {budget ? (
            <section className="org-panel" aria-labelledby="fin-budget">
              <h2 id="fin-budget" className="org-section__title">
                Presupuesto del mes
              </h2>
              <p className="org-muted">
                {fmt(budget.spent)} de {fmt(budget.limit)} · {budget.remaining >= 0 ? `quedan ${fmt(budget.remaining)}` : `superado en ${fmt(-budget.remaining)}`}
              </p>
              <Progress value={budget.spent} max={budget.limit} label="Presupuesto consumido" tone={budget.state} showValue />
            </section>
          ) : (
            <p className="org-subtle">
              Sin presupuesto mensual general. <Link to="/finanzas/presupuestos">Crear uno</Link> te avisa al acercarte al límite.
            </p>
          )}

          <section className="org-panel">
            <ChartFrame
              title={`Gastos por categoría · ${range.label}`}
              note="Cada barra suma los gastos completados de la categoría (las subcategorías se agrupan en su principal). Las transferencias y los pagos de tarjeta no son gastos."
              table={
                distribution.length > 0 && (
                  <DataTable
                    caption="Gastos por categoría"
                    head={['Categoría', 'Gasto', '% del total']}
                    rows={distribution.map((d) => [d.label, fmt(d.value), `${Math.round((d.value / current.expense) * 100)} %`])}
                  />
                )
              }
            >
              {distribution.length ? (
                <BarList entries={distribution.map((d) => ({ ...d, detail: `${Math.round((d.value / current.expense) * 100)} %` }))} format={fmt} />
              ) : (
                <p className="org-muted">No hay gastos completados en este período.</p>
              )}
            </ChartFrame>
          </section>
        </div>

        <div className="org-stack">
          <Section
            title="Próximos pagos"
            action={
              <Button to="/finanzas/pagos" variant="ghost" size="sm" icon={CalendarClock}>
                Ver todos
              </Button>
            }
          >
            {upcoming.length ? (
              <ul className="org-list">
                {upcoming.map((occ) => (
                  <li key={`${occ.item.id}-${occ.date}`} className="org-row org-row--compact">
                    <span className="org-dot" style={{ '--dot-color': occ.state === 'overdue' ? 'var(--danger)' : 'var(--c-accent)' }} aria-hidden="true" />
                    <span className="org-row__main">
                      <span className="org-row__title">{occ.item.name}</span>
                      <span className="org-row__meta">
                        <span className={occ.state === 'overdue' ? 'is-negative' : undefined}>
                          {occ.state === 'overdue' ? 'Vencido' : 'Vence'} {daysFromToday(occ.date, today)} · {shortDate(occ.date)}
                        </span>
                        <span>{formatMoney(occ.item.amount, finance.currencyOf(occ.item.accountId))}</span>
                      </span>
                    </span>
                    <OccurrenceActions occurrence={occ} compact />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="org-muted">No hay pagos programados pendientes en las próximas semanas.</p>
            )}
          </Section>

          <Section
            title="Movimientos recientes"
            action={
              <Button to="/finanzas/movimientos" variant="ghost" size="sm">
                Ver todos
              </Button>
            }
          >
            {recent.length ? (
              <ul className="org-list">
                {recent.map((t) => (
                  <TransactionRow key={t.id} transaction={t} compact />
                ))}
              </ul>
            ) : (
              <p className="org-muted">Todavía no hay movimientos. Registra el primero con «Movimiento» o «Gasto rápido».</p>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
