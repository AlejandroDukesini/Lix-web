import { useMemo } from 'react';
import { usePreferences } from '../../../app/providers/PreferencesProvider.jsx';
import { useKind, useSettings } from '../data/hooks.js';
import { todayISO } from '../shared/format.js';

/** Todo lo que las vistas de finanzas necesitan, con índices por id ya calculados. */
export function useFinance() {
  const accounts = useKind('account');
  const categories = useKind('category');
  const transactions = useKind('transaction');
  const budgets = useKind('budget');
  const goals = useKind('goal');
  const scheduled = useKind('scheduled');
  const settings = useSettings('financeSettings');
  const { preferences } = usePreferences();
  const weekStartsOn = preferences.calendar.weekStartsOn;
  const today = todayISO();

  return useMemo(() => {
    const accountsById = new Map(accounts.map((a) => [a.id, a]));
    const categoriesById = new Map(categories.map((c) => [c.id, c]));
    const currency = settings.mainCurrency;
    const mainAccountIds = new Set(accounts.filter((a) => a.currency === currency).map((a) => a.id));
    const periodOptions = { monthStartDay: settings.monthStartDay, weekStartsOn };
    return {
      accounts,
      categories,
      transactions,
      budgets,
      goals,
      scheduled,
      settings,
      currency,
      today,
      accountsById,
      categoriesById,
      mainAccountIds,
      periodOptions,
      currencyOf: (accountId) => accountsById.get(accountId)?.currency ?? currency,
    };
  }, [accounts, categories, transactions, budgets, goals, scheduled, settings, weekStartsOn, today]);
}

/** Nombre de una categoría con su principal: «Alimentación › Mercado». */
export function categoryPath(categoryId, categoriesById) {
  const cat = categoriesById.get(categoryId);
  if (!cat) return 'Sin categoría';
  const parent = cat.parentId ? categoriesById.get(cat.parentId) : null;
  return parent ? `${parent.name} › ${cat.name}` : cat.name;
}

/** Opciones agrupadas para un selector de categorías del tipo dado (activas, más la actual). */
export function categoryOptions(categories, type, currentId) {
  const list = categories.filter((c) => c.type === type && (!c.archived || c.id === currentId));
  const roots = list.filter((c) => !c.parentId).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  const out = [];
  for (const root of roots) {
    out.push({ value: root.id, label: root.name });
    for (const child of list.filter((c) => c.parentId === root.id).sort((a, b) => a.name.localeCompare(b.name, 'es'))) {
      out.push({ value: child.id, label: `   ${root.name} › ${child.name}` });
    }
  }
  return out;
}

export const ACCOUNT_TYPE_LABELS = {
  cash: 'Efectivo',
  bank: 'Cuenta bancaria',
  wallet: 'Billetera digital',
  credit: 'Tarjeta de crédito',
  savings: 'Ahorro',
  other: 'Otra',
};

export const TYPE_LABELS = { expense: 'Gasto', income: 'Ingreso', transfer: 'Transferencia' };
export const STATUS_LABELS = { completed: 'Completado', pending: 'Pendiente', cancelled: 'Cancelado' };
export const METHOD_LABELS = { cash: 'Efectivo', debit: 'Tarjeta débito', credit: 'Tarjeta crédito', transfer: 'Transferencia', wallet: 'Billetera digital', other: 'Otro' };
export const PAY_KIND_LABELS = {
  subscription: 'Suscripción',
  tuition: 'Matrícula / universidad',
  service: 'Servicio',
  purchase: 'Compra pendiente',
  debt: 'Deuda o cuotas',
  salary: 'Ingreso fijo',
  other: 'Otro',
};
