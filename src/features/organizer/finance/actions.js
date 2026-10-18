/**
 * Operaciones de finanzas que tocan varias entidades a la vez. Cada una es un
 * único `commit`: se guarda todo o nada.
 */
import { commit, IntegrityError } from '../data/store.js';
import { occurrencesBetween } from '../data/recurrence.js';

/**
 * Registra la ocurrencia `date` de un pago programado como movimiento.
 * Nunca crea dos movimientos para la misma ocurrencia (regla 5 del libro contable).
 * Si el pago tiene un número de cuotas y esta era la última, el pago pasa a «terminado».
 */
export function recordOccurrence(itemId, date, overrides = {}) {
  return commit((tx) => {
    const item = tx.get(itemId);
    if (!item) throw new IntegrityError('El pago programado ya no existe.');
    const already = tx.list('transaction').find((t) => t.scheduleId === itemId && t.scheduleDate === date && t.status !== 'cancelled');
    if (already) throw new IntegrityError('Esta fecha ya está registrada: no se creará un movimiento duplicado.');
    const created = tx.create('transaction', {
      type: item.flow,
      amount: item.amount,
      date: overrides.date ?? date,
      accountId: item.accountId,
      categoryId: item.categoryId,
      description: item.name,
      method: item.method,
      status: overrides.status ?? 'completed',
      tags: item.tags,
      scheduleId: item.id,
      scheduleDate: date,
      ...overrides,
    });
    if (item.recurrence?.count || item.skipped.includes(date)) {
      const patch = { skipped: item.skipped.filter((d) => d !== date) };
      if (item.recurrence?.count) {
        const all = occurrencesBetween(item.startDate, item.recurrence, item.startDate, '9999-12-31');
        const done = new Set(tx.list('transaction').filter((t) => t.scheduleId === itemId && t.status !== 'cancelled').map((t) => t.scheduleDate));
        if (all.every((d) => done.has(d) || patch.skipped.includes(d))) patch.status = 'finished';
      }
      tx.update(item.id, patch);
    }
    return created;
  });
}

export function setOccurrenceSkipped(itemId, date, skipped) {
  return commit((tx) =>
    tx.update(itemId, (item) => ({ skipped: skipped ? [...item.skipped, date] : item.skipped.filter((d) => d !== date) })),
  );
}

/** Aporte (in) o retiro (out) de una meta: una transferencia real entre dos cuentas. */
export function moveGoalMoney(goalId, { fromAccountId, toAccountId, amount, date, direction = 'in', notes = '' }) {
  return commit((tx) => {
    const goal = tx.get(goalId);
    if (!goal) throw new IntegrityError('La meta ya no existe.');
    const created = tx.create('transaction', {
      type: 'transfer',
      amount,
      date,
      accountId: fromAccountId,
      toAccountId,
      description: `${direction === 'out' ? 'Retiro de' : 'Aporte a'} «${goal.name}»`,
      notes,
      method: 'transfer',
      status: 'completed',
      goalId,
      goalDirection: direction,
    });
    return created;
  });
}

/** Pasa todos los movimientos, presupuestos y pagos de una categoría a otra (antes de borrarla). */
export function reassignCategory(fromId, toId) {
  return commit((tx) => {
    const target = toId ? tx.get(toId) : null;
    if (toId && !target) throw new IntegrityError('La categoría de destino no existe.');
    let moved = 0;
    for (const t of tx.list('transaction')) {
      if (t.categoryId === fromId) {
        tx.update(t.id, { categoryId: toId });
        moved += 1;
      }
    }
    for (const s of tx.list('scheduled')) if (s.categoryId === fromId) tx.update(s.id, { categoryId: toId });
    for (const child of tx.list('category')) if (child.parentId === fromId) tx.update(child.id, { parentId: target?.parentId ? target.parentId : (toId ?? null) });
    return moved;
  });
}

/** Guarda varios movimientos importados de una vez (o ninguno si alguno no es válido). */
export function importTransactions(rows, { createCategories = false } = {}) {
  return commit((tx) => {
    const batch = new Date().toISOString().slice(0, 19);
    const createdCategories = new Map();
    let count = 0;
    for (const row of rows) {
      const data = { ...row.data, importBatch: batch };
      if (!data.categoryId && row.unknownCategory && createCategories) {
        const key = `${data.type}:${row.unknownCategory.toLocaleLowerCase('es')}`;
        if (!createdCategories.has(key)) createdCategories.set(key, tx.create('category', { name: row.unknownCategory, type: data.type }).id);
        data.categoryId = createdCategories.get(key);
      }
      tx.create('transaction', data);
      count += 1;
    }
    return { count, categories: createdCategories.size };
  });
}
