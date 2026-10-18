/**
 * Reglas contables de las finanzas personales. Todo se DERIVA de los movimientos
 * registrados: no hay saldos ni totales guardados que puedan desincronizarse.
 *
 *  1. Saldo de una cuenta = saldo inicial + ingresos − gastos − transferencias que salen
 *     + transferencias que entran. Solo cuentan los movimientos «completados» con fecha
 *     hasta el día consultado. Los pendientes se muestran aparte; los cancelados no cuentan.
 *  2. Una TRANSFERENCIA mueve dinero entre dos cuentas propias: no es ingreso ni gasto, no
 *     cambia el total y nunca aparece en los informes de gastos.
 *  3. TARJETA DE CRÉDITO: su saldo suele ser negativo (deuda). Una compra con la tarjeta es
 *     un gasto en la fecha de compra (sube la deuda). PAGAR la tarjeta es una transferencia
 *     desde otra cuenta (baja la deuda) y por eso no vuelve a contarse como gasto.
 *  4. METAS DE AHORRO: una aportación es una transferencia marcada con la meta (dirección
 *     «in»); un retiro, una transferencia con dirección «out». El dinero sigue en sus
 *     cuentas: la meta solo lo etiqueta, así que el saldo general no se duplica.
 *  5. PAGOS PROGRAMADOS: cada fecha es una ocurrencia; al registrarla se crea UN movimiento
 *     vinculado (scheduleId + scheduleDate). Una ocurrencia con movimiento ya no está
 *     pendiente: así una recurrencia nunca genera duplicados.
 *  6. MONEDAS: los totales se calculan en la moneda principal. Las cuentas en otras monedas
 *     se muestran con su propio saldo (la app no convierte divisas).
 */
import { addDays, addMonthsClamped, occurrencesBetween, weekdayOf } from '../data/recurrence.js';

export const LIQUID_TYPES = new Set(['cash', 'bank', 'wallet', 'savings', 'other']);

const isCounted = (tx, asOf) => tx.status === 'completed' && (!asOf || tx.date <= asOf);

/** Efecto de un movimiento sobre una cuenta (en unidades mínimas, con signo). */
export function effectOn(tx, accountId) {
  const amount = tx.amount ?? 0;
  if (tx.type === 'income') return tx.accountId === accountId ? amount : 0;
  if (tx.type === 'expense') return tx.accountId === accountId ? -amount : 0;
  if (tx.accountId === accountId) return -amount;
  if (tx.toAccountId === accountId) return amount;
  return 0;
}

/**
 * Saldos de todas las cuentas a una fecha: Map id → { balance, pendingIn, pendingOut }.
 * `balance` incluye el saldo inicial si la cuenta ya existía a esa fecha.
 */
export function accountBalances(accounts, transactions, asOf) {
  const out = new Map();
  for (const account of accounts) {
    out.set(account.id, {
      balance: !asOf || account.openingDate <= asOf ? (account.openingBalance ?? 0) : 0,
      pendingIn: 0,
      pendingOut: 0,
    });
  }
  for (const tx of transactions) {
    for (const id of [tx.accountId, tx.toAccountId]) {
      if (!id || !out.has(id)) continue;
      const effect = effectOn(tx, id);
      const entry = out.get(id);
      if (isCounted(tx, asOf)) entry.balance += effect;
      else if (tx.status === 'pending') {
        if (effect > 0) entry.pendingIn += effect;
        else entry.pendingOut -= effect;
      }
    }
  }
  return out;
}

/**
 * Resumen general en la moneda principal.
 *  - total: suma de saldos (las tarjetas restan su deuda).
 *  - liquid: dinero en efectivo, bancos, billeteras y ahorro.
 *  - available: liquid − gastos pendientes de esas cuentas.
 *  - debt: deuda de tarjetas de crédito.
 */
export function overview(accounts, transactions, asOf, mainCurrency) {
  const balances = accountBalances(accounts, transactions, asOf);
  const result = { total: 0, liquid: 0, available: 0, debt: 0, pendingIncome: 0, pendingExpense: 0, otherCurrencies: new Map() };
  for (const account of accounts) {
    if (account.archived) continue;
    const { balance, pendingIn, pendingOut } = balances.get(account.id);
    if (account.currency !== mainCurrency) {
      result.otherCurrencies.set(account.currency, (result.otherCurrencies.get(account.currency) ?? 0) + balance);
      continue;
    }
    result.total += balance;
    if (account.type === 'credit') result.debt += Math.max(0, -balance);
    else {
      result.liquid += balance;
      result.available += balance - pendingOut;
    }
  }
  for (const tx of transactions) {
    if (tx.status !== 'pending' || tx.type === 'transfer') continue;
    const account = accounts.find((a) => a.id === tx.accountId);
    if (!account || account.currency !== mainCurrency) continue;
    if (tx.type === 'income') result.pendingIncome += tx.amount;
    else result.pendingExpense += tx.amount;
  }
  return result;
}

/** Datos de una tarjeta de crédito: deuda, cupo disponible y próximas fechas de corte y pago. */
export function creditCardInfo(account, balance, today) {
  const debt = Math.max(0, -balance);
  const available = account.creditLimit ? account.creditLimit - debt : null;
  const month = `${today.slice(0, 8)}01`;
  const dayIn = (monthISO, day) => `${monthISO.slice(0, 8)}${String(Math.min(day, lastDayOf(monthISO))).padStart(2, '0')}`;
  const nextDay = (day) => {
    if (!day) return null;
    const current = dayIn(month, day);
    return current >= today ? current : dayIn(addMonthsClamped(month, 1), day);
  };
  return { debt, available, nextStatement: nextDay(account.statementDay), nextDue: nextDay(account.dueDay), overLimit: available !== null && available < 0 };
}

function lastDayOf(iso) {
  const [y, m] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/* ----------------------------------------------------------------------------------- */
/* Períodos                                                                               */
/* ----------------------------------------------------------------------------------- */

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function shortDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1].slice(0, 3)} ${y}`;
}

/**
 * Rango de un período que contiene `anchor`.
 *  - month: si `monthStartDay` > 1, el «mes» va de ese día al anterior del mes siguiente
 *    (útil cuando el dinero llega, por ejemplo, el día 15).
 *  - week: empieza en `weekStartsOn` (0 domingo, 1 lunes).
 */
export function periodRange(view, anchor, { monthStartDay = 1, weekStartsOn = 1 } = {}) {
  if (view === 'day') return { view, from: anchor, to: anchor, label: shortDate(anchor) };
  if (view === 'week') {
    const offset = (weekdayOf(anchor) - weekStartsOn + 7) % 7;
    const from = addDays(anchor, -offset);
    const to = addDays(from, 6);
    return { view, from, to, label: `${shortDate(from)} – ${shortDate(to)}` };
  }
  if (view === 'year') {
    const year = anchor.slice(0, 4);
    return { view, from: `${year}-01-01`, to: `${year}-12-31`, label: year };
  }
  const [y, m, d] = anchor.split('-').map(Number);
  const startDay = Math.min(monthStartDay, 28);
  let from = `${y}-${String(m).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`;
  if (d < startDay) from = addMonthsClamped(from, -1);
  const to = addDays(addMonthsClamped(from, 1), -1);
  const [fy, fm] = from.split('-').map(Number);
  const label = startDay === 1 ? `${MONTHS[fm - 1]} de ${fy}` : `${shortDate(from)} – ${shortDate(to)}`;
  return { view, from, to, label: label.charAt(0).toUpperCase() + label.slice(1) };
}

/** Período anterior o siguiente (`step` = −1 / +1). */
export function shiftPeriod(range, step, options) {
  if (range.view === 'day') return periodRange('day', addDays(range.from, step), options);
  if (range.view === 'week') return periodRange('week', addDays(range.from, 7 * step), options);
  if (range.view === 'year') return periodRange('year', addMonthsClamped(range.from, 12 * step), options);
  return periodRange('month', addMonthsClamped(range.from, step), options);
}

/* ----------------------------------------------------------------------------------- */
/* Resúmenes                                                                              */
/* ----------------------------------------------------------------------------------- */

/** Categoría principal de una categoría (las subcategorías se agrupan en su padre). */
export function rootCategoryId(categoryId, categoriesById) {
  const cat = categoriesById.get(categoryId);
  return cat?.parentId ?? categoryId ?? null;
}

/**
 * Ingresos y gastos completados entre dos fechas, en las cuentas indicadas.
 * Las transferencias se excluyen siempre (regla 2).
 */
export function summarize(transactions, from, to, { accountIds, categoriesById = new Map(), includePending = false } = {}) {
  const result = { income: 0, expense: 0, net: 0, count: 0, expenseByCategory: new Map(), incomeByCategory: new Map() };
  for (const tx of transactions) {
    if (tx.type === 'transfer' || tx.date < from || tx.date > to) continue;
    if (tx.status === 'cancelled' || (tx.status === 'pending' && !includePending)) continue;
    if (accountIds && !accountIds.has(tx.accountId)) continue;
    result.count += 1;
    const root = rootCategoryId(tx.categoryId, categoriesById) ?? 'none';
    if (tx.type === 'income') {
      result.income += tx.amount;
      result.incomeByCategory.set(root, (result.incomeByCategory.get(root) ?? 0) + tx.amount);
    } else {
      result.expense += tx.amount;
      result.expenseByCategory.set(root, (result.expenseByCategory.get(root) ?? 0) + tx.amount);
    }
  }
  result.net = result.income - result.expense;
  return result;
}

/** Ingresos y gastos por mes (AAAA-MM) de los últimos `months` meses hasta `endMonth` incluido. */
export function monthlySeries(transactions, endMonth, months, options = {}) {
  const series = [];
  for (let i = months - 1; i >= 0; i -= 1) {
    const from = addMonthsClamped(`${endMonth}-01`, -i);
    const to = addDays(addMonthsClamped(from, 1), -1);
    const { income, expense } = summarize(transactions, from, to, options);
    series.push({ month: from.slice(0, 7), from, to, income, expense, net: income - expense });
  }
  return series;
}

/* ----------------------------------------------------------------------------------- */
/* Presupuestos                                                                           */
/* ----------------------------------------------------------------------------------- */

/** Estado de un presupuesto en el período que contiene `anchor`. */
export function budgetStatus(budget, transactions, categoriesById, anchor, options = {}) {
  const view = budget.period === 'weekly' ? 'week' : budget.period === 'yearly' ? 'year' : 'month';
  const range = periodRange(view, anchor, options);
  const matches = (categoryId) =>
    !budget.categoryId || categoryId === budget.categoryId || categoriesById.get(categoryId)?.parentId === budget.categoryId;
  let spent = 0;
  for (const tx of transactions) {
    if (tx.type !== 'expense' || tx.date < range.from || tx.date > range.to) continue;
    if (tx.status === 'cancelled' || (tx.status === 'pending' && !budget.includePending)) continue;
    if (options.accountIds && !options.accountIds.has(tx.accountId)) continue;
    if (matches(tx.categoryId)) spent += tx.amount;
  }
  const percent = budget.amount ? (spent / budget.amount) * 100 : 0;
  const state = percent >= 100 ? 'over' : percent >= budget.alertPercent ? 'warning' : 'ok';
  return { range, spent, limit: budget.amount, remaining: budget.amount - spent, percent, state };
}

/* ----------------------------------------------------------------------------------- */
/* Metas de ahorro                                                                        */
/* ----------------------------------------------------------------------------------- */

export function goalProgress(goal, transactions) {
  let saved = 0;
  const contributions = [];
  for (const tx of transactions) {
    if (tx.goalId !== goal.id || tx.type !== 'transfer' || tx.status !== 'completed') continue;
    saved += tx.goalDirection === 'out' ? -tx.amount : tx.amount;
    contributions.push(tx);
  }
  contributions.sort((a, b) => b.date.localeCompare(a.date));
  const percent = goal.target ? Math.max(0, (saved / goal.target) * 100) : 0;
  return { saved, percent, remaining: Math.max(0, goal.target - saved), reached: saved >= goal.target, contributions };
}

/** Ahorro acumulado mes a mes (suma de aportes − retiros de todas las metas). */
export function savingsSeries(transactions, endMonth, months) {
  const out = [];
  let running = 0;
  const firstFrom = addMonthsClamped(`${endMonth}-01`, -(months - 1));
  for (const tx of transactions) {
    if (tx.goalId && tx.type === 'transfer' && tx.status === 'completed' && tx.date < firstFrom) running += tx.goalDirection === 'out' ? -tx.amount : tx.amount;
  }
  for (let i = months - 1; i >= 0; i -= 1) {
    const from = addMonthsClamped(`${endMonth}-01`, -i);
    const to = addDays(addMonthsClamped(from, 1), -1);
    for (const tx of transactions) {
      if (!tx.goalId || tx.type !== 'transfer' || tx.status !== 'completed' || tx.date < from || tx.date > to) continue;
      running += tx.goalDirection === 'out' ? -tx.amount : tx.amount;
    }
    out.push({ month: from.slice(0, 7), saved: running });
  }
  return out;
}

/* ----------------------------------------------------------------------------------- */
/* Pagos programados                                                                      */
/* ----------------------------------------------------------------------------------- */

/**
 * Ocurrencias de un pago programado entre dos fechas, con su estado:
 *   paid      → tiene un movimiento completado vinculado
 *   recorded  → tiene un movimiento pendiente vinculado
 *   skipped   → se marcó «omitir esta vez»
 *   overdue   → ya pasó la fecha y no tiene movimiento
 *   upcoming  → todavía no llega
 */
export function scheduleOccurrences(item, transactions, from, to, today) {
  if (item.status === 'cancelled') return [];
  const linked = new Map();
  for (const tx of transactions) {
    if (tx.scheduleId === item.id && tx.scheduleDate && tx.status !== 'cancelled') linked.set(tx.scheduleDate, tx);
  }
  const dates = occurrencesBetween(item.startDate, item.recurrence, from, to);
  const skipped = new Set(item.skipped);
  return dates.map((date) => {
    const tx = linked.get(date) ?? null;
    let state;
    if (tx) state = tx.status === 'completed' ? 'paid' : 'recorded';
    else if (skipped.has(date)) state = 'skipped';
    else if (item.status === 'paused' || item.status === 'finished') state = 'inactive';
    else state = date < today ? 'overdue' : 'upcoming';
    return { item, date, state, transaction: tx };
  });
}

/**
 * Ocurrencias que requieren atención: vencidas (hasta `lookbackDays` atrás) y próximas
 * (hasta `to`), ordenadas por fecha.
 */
export function dueOccurrences(items, transactions, today, to, lookbackDays = 60) {
  const from = addDays(today, -lookbackDays);
  const out = [];
  for (const item of items) {
    if (item.status !== 'active') continue;
    for (const occ of scheduleOccurrences(item, transactions, from, to, today)) {
      if (occ.state === 'overdue' || occ.state === 'upcoming') out.push(occ);
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** Cuánto suman las ocurrencias pendientes (sin movimiento) de un período, por flujo. */
export function expectedInPeriod(items, transactions, from, to, today, mainCurrencyAccounts) {
  let income = 0;
  let expense = 0;
  for (const item of items) {
    if (item.status !== 'active' || (mainCurrencyAccounts && !mainCurrencyAccounts.has(item.accountId))) continue;
    for (const occ of scheduleOccurrences(item, transactions, from, to, today)) {
      if (occ.state !== 'overdue' && occ.state !== 'upcoming') continue;
      if (item.flow === 'income') income += item.amount;
      else expense += item.amount;
    }
  }
  return { income, expense };
}
