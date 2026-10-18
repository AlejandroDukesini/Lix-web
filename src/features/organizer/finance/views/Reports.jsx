import { useMemo, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import { Button } from '../../../../components/common/Button.jsx';
import { downloadFile } from '../../data/csv.js';
import { addDays } from '../../data/recurrence.js';
import { BarList, ChartFrame, Columns, DataTable } from '../../shared/Charts.jsx';
import { Figure, PeriodNav, Section } from '../../shared/ui.jsx';
import { InputField } from '../../shared/Fields.jsx';
import { monthLabel, shortDate } from '../../shared/format.js';
import { budgetStatus, monthlySeries, periodRange, savingsSeries, scheduleOccurrences, shiftPeriod, summarize } from '../ledger.js';
import { formatMoney } from '../money.js';
import { transactionsToCSV } from '../transactionsCsv.js';
import { categoryPath, useFinance } from '../useFinance.js';

const INCOME_COLOR = 'var(--c-secondary)';
const EXPENSE_COLOR = 'var(--c-primary)';

function daysIn(from, to) {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1;
}

export function Reports() {
  const finance = useFinance();
  const { transactions, categoriesById, accountsById, currency, today, periodOptions, mainAccountIds } = finance;
  const [mode, setMode] = useState('month');
  const [range, setRange] = useState(() => periodRange('month', today, periodOptions));
  const [custom, setCustom] = useState({ from: addDays(today, -29), to: today });
  const active = mode === 'custom' ? { view: 'custom', from: custom.from, to: custom.to, label: `${shortDate(custom.from)} – ${shortDate(custom.to)}` } : range;
  const fmt = (v) => formatMoney(v, currency);

  const report = useMemo(() => {
    const options = { accountIds: mainAccountIds, categoriesById };
    const period = summarize(transactions, active.from, active.to, options);
    const inPeriod = transactions.filter((t) => t.date >= active.from && t.date <= active.to && mainAccountIds.has(t.accountId));
    const expenses = inPeriod.filter((t) => t.type === 'expense' && t.status === 'completed');
    const largest = [...expenses].sort((a, b) => b.amount - a.amount).slice(0, 5);
    const top = [...period.expenseByCategory]
      .map(([id, value]) => ({ id, value, label: categoriesById.get(id)?.name ?? 'Sin categoría', color: categoriesById.get(id)?.color ?? '#8a8a9a' }))
      .sort((a, b) => b.value - a.value);
    const incomeTop = [...period.incomeByCategory]
      .map(([id, value]) => ({ id, value, label: categoriesById.get(id)?.name ?? 'Sin categoría', color: categoriesById.get(id)?.color ?? '#8a8a9a' }))
      .sort((a, b) => b.value - a.value);
    const endMonth = active.to.slice(0, 7);
    const monthly = monthlySeries(transactions, endMonth, 12, options);
    const savings = savingsSeries(transactions, endMonth, 12);
    const budgets = finance.budgets
      .filter((b) => !b.archived)
      .map((b) => ({ budget: b, ...budgetStatus(b, transactions, categoriesById, active.to > today ? today : active.to, { ...periodOptions, accountIds: mainAccountIds }) }));
    const pending = inPeriod.filter((t) => t.status === 'pending');
    const overdue = finance.scheduled.flatMap((item) => scheduleOccurrences(item, transactions, active.from, active.to, today).filter((o) => o.state === 'overdue'));
    const days = daysIn(active.from, active.to);
    return { period, largest, top, incomeTop, monthly, savings, budgets, pending, overdue, days, count: inPeriod.length, inPeriod };
  }, [transactions, active.from, active.to, mainAccountIds, categoriesById, finance.budgets, finance.scheduled, periodOptions, today]);

  const exportCsv = () => downloadFile(`movimientos-${active.from}_${active.to}.csv`, transactionsToCSV(report.inPeriod, { accountsById, categoriesById }));

  const changeMode = (next) => {
    setMode(next);
    if (next !== 'custom') setRange(periodRange(next, today, periodOptions));
  };

  return (
    <div className="org-stack org-report">
      <div className="org-toolbar org-toolbar--split org-noprint">
        <div className="org-segment" role="group" aria-label="Período del informe">
          {[
            ['month', 'Mes'],
            ['year', 'Año'],
            ['custom', 'Personalizado'],
          ].map(([value, label]) => (
            <button key={value} type="button" aria-pressed={mode === value} onClick={() => changeMode(value)}>
              {label}
            </button>
          ))}
        </div>
        {mode === 'custom' ? (
          <div className="org-form__row org-report__custom">
            <InputField label="Desde" type="date" value={custom.from} max={custom.to} onChange={(from) => from && setCustom((c) => ({ ...c, from }))} />
            <InputField label="Hasta" type="date" value={custom.to} min={custom.from} onChange={(to) => to && setCustom((c) => ({ ...c, to }))} />
          </div>
        ) : (
          <PeriodNav label={range.label} onPrev={() => setRange(shiftPeriod(range, -1, periodOptions))} onNext={() => setRange(shiftPeriod(range, 1, periodOptions))} onToday={() => setRange(periodRange(range.view, today, periodOptions))} />
        )}
        <div className="org-toolbar__end">
          <Button variant="secondary" size="sm" icon={Download} onClick={exportCsv} disabled={!report.inPeriod.length}>
            CSV del período
          </Button>
          <Button variant="secondary" size="sm" icon={Printer} onClick={() => window.print()}>
            Imprimir o guardar PDF
          </Button>
        </div>
      </div>

      <header className="org-report__title">
        <h2>Informe financiero · {active.label}</h2>
        <p className="org-subtle">
          Importes en {currency}. Solo movimientos completados de cuentas en {currency}; las transferencias no son ingresos ni gastos.
        </p>
      </header>

      <section className="org-panel" aria-label="Balance del período">
        <dl className="org-figures">
          <Figure label="Ingresos" value={fmt(report.period.income)} tone="positive" />
          <Figure label="Gastos" value={fmt(report.period.expense)} tone="negative" />
          <Figure label="Balance" value={formatMoney(report.period.net, currency, { signed: true })} detail={report.period.income ? `${Math.round((report.period.net / report.period.income) * 100)} % de los ingresos` : undefined} />
          <Figure label="Gasto medio por día" value={fmt(Math.round(report.period.expense / report.days))} detail={`${report.days} días`} />
          <Figure label="Movimientos" value={report.count.toLocaleString('es')} />
        </dl>
      </section>

      <div className="org-two">
        <Section title="Categorías con mayor gasto">
          <ChartFrame
            title="Gasto por categoría"
            table={report.top.length > 0 && <DataTable caption="Gasto por categoría" head={['Categoría', 'Gasto', '%']} rows={report.top.map((d) => [d.label, fmt(d.value), `${Math.round((d.value / report.period.expense) * 100)} %`])} />}
          >
            {report.top.length ? <BarList entries={report.top.slice(0, 8)} format={fmt} /> : <p className="org-muted">Sin gastos en este período.</p>}
          </ChartFrame>
        </Section>
        <Section title="De dónde vinieron los ingresos">
          {report.incomeTop.length ? <BarList entries={report.incomeTop} format={fmt} /> : <p className="org-muted">Sin ingresos en este período.</p>}
        </Section>
      </div>

      <Section title="Comparación mensual" description={`Ingresos y gastos de los 12 meses que terminan en ${monthLabel(active.to.slice(0, 7)).toLowerCase()}.`}>
        <ChartFrame
          title="Ingresos y gastos por mes"
          note="Ambas series comparten la misma escala, que empieza en cero."
          table={<DataTable caption="Ingresos y gastos por mes" head={['Mes', 'Ingresos', 'Gastos', 'Balance']} rows={report.monthly.map((m) => [monthLabel(m.month), fmt(m.income), fmt(m.expense), formatMoney(m.net, currency, { signed: true })])} />}
        >
          <Columns
            label="Ingresos y gastos de los últimos 12 meses"
            items={report.monthly.map((m) => ({ key: m.month, label: monthLabel(m.month).slice(0, 3), values: [m.income, m.expense] }))}
            series={[
              { label: 'Ingresos', color: INCOME_COLOR },
              { label: 'Gastos', color: EXPENSE_COLOR },
            ]}
            format={fmt}
          />
        </ChartFrame>
      </Section>

      <div className="org-two">
        <Section title="Evolución del ahorro" description="Saldo acumulado de tus metas al final de cada mes (aportes − retiros).">
          {report.savings.some((s) => s.saved) ? (
            <ChartFrame title="Ahorro en metas" table={<DataTable caption="Ahorro acumulado" head={['Mes', 'Ahorro']} rows={report.savings.map((s) => [monthLabel(s.month), fmt(s.saved)])} />}>
              <Columns label="Ahorro acumulado por mes" items={report.savings.map((s) => ({ key: s.month, label: monthLabel(s.month).slice(0, 3), values: [Math.max(0, s.saved)] }))} series={[{ label: 'Ahorro acumulado', color: 'var(--c-accent)' }]} format={fmt} />
            </ChartFrame>
          ) : (
            <p className="org-muted">Todavía no hay aportes a metas de ahorro.</p>
          )}
        </Section>
        <Section title="Cumplimiento de presupuestos">
          {report.budgets.length ? (
            <DataTable
              caption="Presupuestos"
              head={['Presupuesto', 'Gastado', 'Límite', '%']}
              rows={report.budgets.map((b) => [
                b.budget.name || (b.budget.categoryId ? categoriesById.get(b.budget.categoryId)?.name ?? '—' : 'General'),
                fmt(b.spent),
                fmt(b.limit),
                `${Math.round(b.percent)} %${b.state === 'over' ? ' ⚠' : ''}`,
              ])}
            />
          ) : (
            <p className="org-muted">No hay presupuestos activos.</p>
          )}
        </Section>
      </div>

      <div className="org-two">
        <Section title="Gastos más grandes">
          {report.largest.length ? (
            <ul className="org-mini-list">
              {report.largest.map((t) => (
                <li key={t.id}>
                  <span>
                    {shortDate(t.date)} · {t.description || categoryPath(t.categoryId, categoriesById)}
                  </span>
                  <strong>{fmt(t.amount)}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="org-muted">Sin gastos.</p>
          )}
        </Section>
        <Section title="Pendiente">
          {report.pending.length || report.overdue.length ? (
            <ul className="org-mini-list">
              {report.pending.map((t) => (
                <li key={t.id}>
                  <span>
                    {shortDate(t.date)} · {t.description || categoryPath(t.categoryId, categoriesById)}
                  </span>
                  <strong>{fmt(t.amount)}</strong>
                </li>
              ))}
              {report.overdue.map((o) => (
                <li key={`${o.item.id}-${o.date}`}>
                  <span>
                    {shortDate(o.date)} · {o.item.name} (programado, sin registrar)
                  </span>
                  <strong>{fmt(o.item.amount)}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className="org-muted">Nada pendiente en este período.</p>
          )}
        </Section>
      </div>
    </div>
  );
}
