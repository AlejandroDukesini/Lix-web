import { describe, expect, it } from 'vitest';
import { formatMoney, parseAmount, toAmountInput } from '../finance/money.js';
import {
  accountBalances,
  budgetStatus,
  creditCardInfo,
  dueOccurrences,
  goalProgress,
  monthlySeries,
  overview,
  periodRange,
  scheduleOccurrences,
  shiftPeriod,
  summarize,
} from '../finance/ledger.js';
import { addMonthsClamped, describeRule, nextOccurrence, occurrencesBetween } from '../data/recurrence.js';
import { createRecord, ensureLoaded, getRecord, listKind } from '../data/store.js';
import { importTransactions, moveGoalMoney, reassignCategory, recordOccurrence } from '../finance/actions.js';
import { previewTransactionsCSV, transactionsToCSV } from '../finance/transactionsCsv.js';
import { parseCSV, toCSV } from '../data/csv.js';

describe('importes', () => {
  it.each([
    ['12500', 1250000],
    ['12.500', 1250000],
    ['12.500,50', 1250050],
    ['12,500.50', 1250050],
    ['12500,5', 1250050],
    ['$ 1.234.567', 123456700],
    ['0,99', 99],
    ['7.5', 750],
  ])('«%s» → %i', (input, expected) => expect(parseAmount(input)).toBe(expected));

  it.each(['', 'abc', '1,2,3', '12.34.5', '1,234,56'])('rechaza «%s»', (input) => expect(parseAmount(input)).toBeNull());

  it('formatea sin decimales cuando no hay centavos', () => {
    expect(formatMoney(1250000, 'COP')).toMatch(/12\.500$/);
    expect(formatMoney(1250050, 'COP')).toMatch(/12\.500,50$/);
    expect(formatMoney(-500, 'COP')).toMatch(/^−/);
    expect(toAmountInput(1250050)).toBe('12500,5');
    expect(parseAmount(toAmountInput(1250050))).toBe(1250050);
  });
});

describe('repeticiones', () => {
  it('mensual el día 31 cae en el último día y vuelve al 31', () => {
    expect(occurrencesBetween('2026-01-31', { freq: 'monthly', interval: 1 }, '2026-01-01', '2026-05-31')).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
      '2026-05-31',
    ]);
  });

  it('semanal en varios días, con límite de repeticiones y fecha final', () => {
    const rule = { freq: 'weekly', interval: 1, weekdays: [1, 3] };
    expect(occurrencesBetween('2026-03-02', rule, '2026-03-01', '2026-03-15')).toEqual(['2026-03-02', '2026-03-04', '2026-03-09', '2026-03-11']);
    expect(occurrencesBetween('2026-03-02', { ...rule, count: 3 }, '2026-03-01', '2026-12-31')).toHaveLength(3);
    expect(occurrencesBetween('2026-03-02', { ...rule, until: '2026-03-04' }, '2026-03-01', '2026-12-31')).toEqual(['2026-03-02', '2026-03-04']);
  });

  it('salta directamente a rangos lejanos sin perder ocurrencias', () => {
    const daily = occurrencesBetween('2020-01-01', { freq: 'daily', interval: 3 }, '2026-06-01', '2026-06-10');
    const brute = [];
    for (let t = Date.parse('2026-06-01'); t <= Date.parse('2026-06-10'); t += 86400000) {
      if ((t - Date.parse('2020-01-01')) % (3 * 86400000) === 0) brute.push(new Date(t).toISOString().slice(0, 10));
    }
    expect(daily).toEqual(brute);
    expect(occurrencesBetween('2024-02-29', { freq: 'yearly', interval: 1 }, '2025-01-01', '2025-12-31')).toEqual(['2025-02-28']);
    expect(nextOccurrence('2026-01-15', { freq: 'monthly', interval: 2 }, '2026-04-01')).toBe('2026-05-15');
    expect(addMonthsClamped('2026-12-15', 1)).toBe('2027-01-15');
  });

  it('describe la regla en español', () => {
    expect(describeRule({ freq: 'weekly', interval: 2, weekdays: [4, 1] })).toBe('Cada 2 semanas los lunes y jueves');
    expect(describeRule({ freq: 'monthly', interval: 1, count: 6 })).toBe('Cada mes, 6 veces');
  });
});

const ACC = [
  { id: 'bank', type: 'bank', currency: 'COP', openingBalance: 1000000, openingDate: '2026-01-01', archived: false },
  { id: 'cash', type: 'cash', currency: 'COP', openingBalance: 0, openingDate: '2026-01-01', archived: false },
  { id: 'card', type: 'credit', currency: 'COP', openingBalance: 0, openingDate: '2026-01-01', creditLimit: 500000, statementDay: 31, dueDay: 15, archived: false },
  { id: 'usd', type: 'bank', currency: 'USD', openingBalance: 10000, openingDate: '2026-01-01', archived: false },
];
const tx = (o) => ({ status: 'completed', tags: [], ...o });

describe('libro contable', () => {
  const movements = [
    tx({ id: 1, type: 'income', amount: 200000, date: '2026-03-01', accountId: 'bank', categoryId: 'salary' }),
    tx({ id: 2, type: 'expense', amount: 50000, date: '2026-03-02', accountId: 'bank', categoryId: 'food' }),
    tx({ id: 3, type: 'transfer', amount: 100000, date: '2026-03-03', accountId: 'bank', toAccountId: 'cash' }),
    tx({ id: 4, type: 'expense', amount: 120000, date: '2026-03-04', accountId: 'card', categoryId: 'food' }), // compra con tarjeta
    tx({ id: 5, type: 'transfer', amount: 120000, date: '2026-03-20', accountId: 'bank', toAccountId: 'card' }), // pago de la tarjeta
    tx({ id: 6, type: 'expense', amount: 30000, date: '2026-03-25', accountId: 'cash', status: 'pending' }),
    tx({ id: 7, type: 'expense', amount: 99999, date: '2026-03-26', accountId: 'cash', status: 'cancelled' }),
    tx({ id: 8, type: 'expense', amount: 1000, date: '2026-04-02', accountId: 'cash' }),
  ];

  it('saldos: transferencias mueven dinero sin crearlo ni destruirlo', () => {
    const balances = accountBalances(ACC, movements, '2026-03-31');
    expect(balances.get('bank').balance).toBe(1000000 + 200000 - 50000 - 100000 - 120000);
    expect(balances.get('cash')).toMatchObject({ balance: 100000, pendingOut: 30000 });
    expect(balances.get('card').balance).toBe(0); // compró y pagó
    const total = [...balances.values()].filter((_, i) => ACC[i].currency === 'COP').reduce((s, b) => s + b.balance, 0);
    expect(total).toBe(1000000 + 200000 - 50000 - 120000); // solo ingresos y gastos reales
  });

  it('el pago de la tarjeta no es un gasto: el gasto se cuenta una vez, en la compra', () => {
    const march = summarize(movements, '2026-03-01', '2026-03-31');
    expect(march.expense).toBe(50000 + 120000);
    expect(march.income).toBe(200000);
    expect(march.expenseByCategory.get('food')).toBe(170000);
  });

  it('resumen general en la moneda principal, con deuda y disponible', () => {
    const before = movements.filter((m) => m.id !== 5);
    const o = overview(ACC, before, '2026-03-31', 'COP');
    expect(o.debt).toBe(120000);
    expect(o.liquid).toBe(1000000 + 200000 - 50000);
    expect(o.available).toBe(o.liquid - 30000);
    expect(o.pendingExpense).toBe(30000);
    expect(o.otherCurrencies.get('USD')).toBe(10000);
    const card = creditCardInfo(ACC[2], -120000, '2026-04-10');
    expect(card).toMatchObject({ debt: 120000, available: 380000, nextStatement: '2026-04-30', nextDue: '2026-04-15' });
  });

  it('períodos mensuales con día de inicio, semanas y años', () => {
    expect(periodRange('month', '2026-03-10', { monthStartDay: 15 })).toMatchObject({ from: '2026-02-15', to: '2026-03-14' });
    expect(periodRange('month', '2026-03-10')).toMatchObject({ from: '2026-03-01', to: '2026-03-31', label: 'Marzo de 2026' });
    expect(periodRange('week', '2026-03-12', { weekStartsOn: 1 })).toMatchObject({ from: '2026-03-09', to: '2026-03-15' });
    expect(shiftPeriod(periodRange('month', '2026-01-31'), 1)).toMatchObject({ from: '2026-02-01', to: '2026-02-28' });
    expect(monthlySeries(movements, '2026-04', 2).map((m) => m.expense)).toEqual([170000, 1000]);
  });

  it('presupuestos: porcentaje consumido y alertas', () => {
    const cats = new Map([['sub', { id: 'sub', parentId: 'food' }]]);
    const list = [...movements, tx({ id: 9, type: 'expense', amount: 20000, date: '2026-03-05', accountId: 'cash', categoryId: 'sub' })];
    const budget = { categoryId: 'food', amount: 200000, period: 'monthly', alertPercent: 80, includePending: false };
    expect(budgetStatus(budget, list, cats, '2026-03-15')).toMatchObject({ spent: 190000, state: 'warning' });
    expect(budgetStatus({ ...budget, amount: 150000 }, list, cats, '2026-03-15').state).toBe('over');
    expect(budgetStatus({ ...budget, categoryId: null, amount: 1e9 }, list, cats, '2026-03-15').spent).toBe(50000 + 120000 + 20000);
  });

  it('metas: aportes y retiros son transferencias marcadas y no duplican dinero', () => {
    const goal = { id: 'g', target: 100000 };
    const list = [
      tx({ type: 'transfer', amount: 70000, date: '2026-03-01', accountId: 'bank', toAccountId: 'cash', goalId: 'g', goalDirection: 'in' }),
      tx({ type: 'transfer', amount: 20000, date: '2026-03-09', accountId: 'cash', toAccountId: 'bank', goalId: 'g', goalDirection: 'out' }),
      tx({ type: 'transfer', amount: 50000, date: '2026-03-10', accountId: 'bank', toAccountId: 'cash', goalId: 'g', status: 'pending' }),
    ];
    expect(goalProgress(goal, list)).toMatchObject({ saved: 50000, percent: 50, remaining: 50000 });
    expect(summarize(list, '2026-01-01', '2026-12-31')).toMatchObject({ income: 0, expense: 0 });
  });

  it('pagos programados: estados de cada ocurrencia', () => {
    const item = { id: 's', status: 'active', startDate: '2026-01-10', recurrence: { freq: 'monthly', interval: 1 }, skipped: ['2026-02-10'], flow: 'expense', amount: 1 };
    const list = [tx({ scheduleId: 's', scheduleDate: '2026-01-10', status: 'completed' }), tx({ scheduleId: 's', scheduleDate: '2026-03-10', status: 'pending' })];
    const states = scheduleOccurrences(item, list, '2026-01-01', '2026-05-31', '2026-04-15').map((o) => o.state);
    expect(states).toEqual(['paid', 'skipped', 'recorded', 'overdue', 'upcoming']);
    expect(dueOccurrences([item], list, '2026-04-15', '2026-05-31').map((o) => o.date)).toEqual(['2026-04-10', '2026-05-10']);
  });
});

describe('operaciones de finanzas', () => {
  async function setup() {
    await ensureLoaded();
    const bank = await createRecord('account', { name: 'Banco', openingDate: '2026-01-01', openingBalance: 500000 });
    const savings = await createRecord('account', { name: 'Ahorros', type: 'savings', openingDate: '2026-01-01' });
    return { bank, savings };
  }

  it('registrar una ocurrencia dos veces no crea duplicados y termina las cuotas', async () => {
    const { bank } = await setup();
    const debt = await createRecord('scheduled', {
      name: 'Celular a cuotas',
      payKind: 'debt',
      amount: 100000,
      accountId: bank.id,
      startDate: '2026-01-05',
      recurrence: { freq: 'monthly', interval: 1, count: 2 },
    });
    await recordOccurrence(debt.id, '2026-01-05');
    await expect(recordOccurrence(debt.id, '2026-01-05')).rejects.toThrow('duplicado');
    expect(listKind('transaction').filter((t) => t.scheduleId === debt.id)).toHaveLength(1);
    await recordOccurrence(debt.id, '2026-02-05');
    expect(getRecord(debt.id).status).toBe('finished');
  });

  it('un aporte a una meta es una transferencia real entre cuentas', async () => {
    const { bank, savings } = await setup();
    const goal = await createRecord('goal', { name: 'Viaje', target: 300000, startDate: '2026-01-01' });
    await moveGoalMoney(goal.id, { fromAccountId: bank.id, toAccountId: savings.id, amount: 100000, date: '2026-02-01' });
    const transactions = listKind('transaction');
    expect(transactions[0]).toMatchObject({ type: 'transfer', goalId: goal.id, categoryId: null });
    expect(goalProgress(goal, transactions).saved).toBe(100000);
    const b = accountBalances(listKind('account'), transactions, '2026-12-31');
    expect(b.get(bank.id).balance + b.get(savings.id).balance).toBe(500000);
  });

  it('reasignar una categoría permite borrarla sin perder movimientos', async () => {
    const { bank } = await setup();
    const t = await createRecord('transaction', { type: 'expense', amount: 1000, date: '2026-02-01', accountId: bank.id, categoryId: 'seed-cat-cafe' });
    await reassignCategory('seed-cat-cafe', 'seed-cat-restaurantes');
    expect(getRecord(t.id).categoryId).toBe('seed-cat-restaurantes');
  });

  it('CSV: exporta, previsualiza con validación y duplicados, e importa', async () => {
    const { bank } = await setup();
    await createRecord('transaction', { type: 'expense', amount: 1250050, date: '2026-02-01', accountId: bank.id, categoryId: 'seed-cat-mercado', description: 'Mercado, semana 1', tags: ['casa'] });
    const accountsById = new Map(listKind('account').map((a) => [a.id, a]));
    const categoriesById = new Map(listKind('category').map((c) => [c.id, c]));
    const csv = transactionsToCSV(listKind('transaction'), { accountsById, categoriesById });
    expect(parseCSV(csv)[1]).toEqual(expect.arrayContaining(['2026-02-01', 'gasto', '12500.50', 'Banco', 'Alimentación', 'Mercado', 'Mercado, semana 1', 'casa']));

    const input = toCSV([
      ['Fecha', 'Tipo', 'Valor', 'Cuenta', 'Categoría', 'Descripción'],
      ['2026-02-01', 'gasto', '12.500,50', 'banco', 'Mercado', 'Mercado, semana 1'], // ya existe
      ['2026-02-02', 'ingreso', '50000', 'Banco', 'Trabajo', 'Monitoría'],
      ['2026-02-02', 'ingreso', '50000', 'Banco', 'Trabajo', 'Monitoría'], // repetida en el archivo
      ['2026-02-30', 'gasto', '-5', 'Nequi', '', ''],
      ['2026-02-03', 'gasto', '9000', 'Banco', 'Mascotas', 'Concentrado'],
    ], { separator: ';' });
    const preview = previewTransactionsCSV(input, { accounts: listKind('account'), categories: listKind('category'), transactions: listKind('transaction') });
    expect(preview.missing).toEqual([]);
    expect(preview.rows.map((r) => r.duplicate)).toEqual(['existing', null, 'file', null, null]);
    expect(preview.rows[3].errors.length).toBe(3);
    expect(preview.rows[4].unknownCategory).toBe('Mascotas');

    const chosen = preview.rows.filter((r) => !r.errors.length && !r.duplicate);
    const result = await importTransactions(chosen, { createCategories: true });
    expect(result).toEqual({ count: 2, categories: 1 });
    expect(listKind('transaction')).toHaveLength(3);
    expect(listKind('category').some((c) => c.name === 'Mascotas' && c.type === 'expense')).toBe(true);
  });

  it('CSV: avisa de columnas obligatorias que faltan', () => {
    const preview = previewTransactionsCSV('fecha,valor\n2026-01-01,5', { accounts: [], categories: [], transactions: [] });
    expect(preview.missing).toEqual(['tipo', 'cuenta']);
  });
});
