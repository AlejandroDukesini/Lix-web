import { describe, expect, it } from 'vitest';
import {
  __resetOrganizerForTests,
  commit,
  createRecord,
  deleteRecord,
  duplicateRecord,
  ensureLoaded,
  exportModule,
  getRecord,
  IntegrityError,
  listKind,
  planDelete,
  restoreModule,
  sanitizeModule,
  updateRecord,
  ValidationError,
  compareWithCurrent,
} from '../data/store.js';
import { dbGet, STORES, DB_VERSION } from '../../../services/storage/database.js';

/** Simula cerrar y volver a abrir la app: se vacía la memoria y se relee IndexedDB. */
async function reopen() {
  __resetOrganizerForTests();
  await ensureLoaded();
}

const account = (overrides = {}) => createRecord('account', { name: 'Banco', type: 'bank', openingDate: '2026-01-01', openingBalance: 100000, ...overrides });

describe('almacén de la organización', () => {
  it('migra la base de datos a la v4 sin tocar los stores anteriores', async () => {
    await ensureLoaded();
    expect(DB_VERSION).toBe(4);
    expect(await dbGet(STORES.library, 'state')).toBeUndefined();
  });

  it('crea los datos iniciales una sola vez y con ids estables', async () => {
    await ensureLoaded();
    const categories = listKind('category').length;
    expect(categories).toBeGreaterThan(10);
    expect(listKind('eventCategory').map((c) => c.name)).toEqual(expect.arrayContaining(['Universidad', 'Personal', 'Salud', 'Familia', 'Ocio']));
    expect(listKind('emotion').length).toBeGreaterThanOrEqual(20);
    // Borrar una categoría inicial no la hace reaparecer al reabrir.
    await deleteRecord('seed-cat-regalos');
    await reopen();
    expect(getRecord('seed-cat-regalos')).toBeNull();
    expect(listKind('category').length).toBe(categories - 1);
  });

  it('CRUD completo con persistencia tras reabrir', async () => {
    await ensureLoaded();
    const created = await account();
    expect(created).toMatchObject({ kind: 'account', rev: 1, name: 'Banco', currency: 'COP' });
    await updateRecord(created.id, { name: 'Banco principal' });
    await reopen();
    expect(getRecord(created.id)).toMatchObject({ name: 'Banco principal', rev: 2 });
    await deleteRecord(created.id);
    await reopen();
    expect(getRecord(created.id)).toBeNull();
  });

  it('valida los campos y no guarda nada si algo es inválido', async () => {
    await ensureLoaded();
    await expect(createRecord('account', { name: '  ', openingDate: '2026-02-31' })).rejects.toMatchObject({
      name: 'ValidationError',
      errors: { name: 'El nombre es obligatorio.', openingDate: 'La fecha de apertura no es válida.' },
    });
    expect(listKind('account')).toHaveLength(0);
  });

  it('comprueba que las relaciones existen y aplica las reglas entre campos', async () => {
    await ensureLoaded();
    const bank = await account();
    await expect(createRecord('transaction', { type: 'expense', amount: 500, date: '2026-03-01', accountId: 'no-existe' })).rejects.toBeInstanceOf(ValidationError);
    await expect(
      createRecord('transaction', { type: 'income', amount: 500, date: '2026-03-01', accountId: bank.id, categoryId: 'seed-cat-mercado' }),
    ).rejects.toMatchObject({ errors: { categoryId: 'Elige una categoría de ingresos.' } });
    await expect(createRecord('transaction', { type: 'transfer', amount: 500, date: '2026-03-01', accountId: bank.id, toAccountId: bank.id })).rejects.toMatchObject({
      errors: { toAccountId: 'La cuenta de destino debe ser distinta de la de origen.' },
    });
    const usd = await account({ name: 'Dólares', currency: 'USD' });
    await expect(createRecord('transaction', { type: 'transfer', amount: 500, date: '2026-03-01', accountId: bank.id, toAccountId: usd.id })).rejects.toMatchObject({
      errors: { toAccountId: expect.stringContaining('misma moneda') },
    });
  });

  it('una transferencia nunca guarda categoría', async () => {
    await ensureLoaded();
    const a = await account();
    const b = await account({ name: 'Efectivo', type: 'cash' });
    const t = await createRecord('transaction', { type: 'transfer', amount: 500, date: '2026-03-01', accountId: a.id, toAccountId: b.id, categoryId: 'seed-cat-mercado' });
    expect(t.categoryId).toBeNull();
  });

  it('guarda el historial de cambios de los movimientos', async () => {
    await ensureLoaded();
    const bank = await account();
    const t = await createRecord('transaction', { type: 'expense', amount: 500, date: '2026-03-01', accountId: bank.id });
    await updateRecord(t.id, { amount: 800, description: 'Almuerzo' });
    const saved = getRecord(t.id);
    expect(saved.history).toHaveLength(1);
    expect(saved.history[0].changes).toMatchObject({ amount: [500, 800], description: ['', 'Almuerzo'] });
  });

  it('integridad: restringe, desvincula, mueve y borra en cascada según la relación', async () => {
    await ensureLoaded();
    const bank = await account();
    await createRecord('transaction', { type: 'expense', amount: 500, date: '2026-03-01', accountId: bank.id, categoryId: 'seed-cat-mercado' });
    // restrict: la cuenta tiene movimientos.
    await expect(deleteRecord(bank.id)).rejects.toBeInstanceOf(IntegrityError);
    expect(getRecord(bank.id)).not.toBeNull();
    // cascade (con plan visible antes): borrar una categoría con presupuesto borra el presupuesto.
    const budget = await createRecord('budget', { categoryId: 'seed-cat-ocio', amount: 100000 });
    expect(planDelete('seed-cat-ocio').cascade.map((e) => e.record.id)).toEqual([budget.id]);
    await deleteRecord('seed-cat-ocio');
    expect(getRecord(budget.id)).toBeNull();
    // reparent: al borrar una carpeta, sus notas y subcarpetas suben a la carpeta superior.
    const root = await createRecord('folder', { name: 'Universidad' });
    const child = await createRecord('folder', { name: 'Semestre 3', parentId: root.id });
    const grandchild = await createRecord('folder', { name: 'Cálculo', parentId: child.id });
    const note = await createRecord('note', { title: 'Apuntes', folderId: child.id });
    await deleteRecord(child.id);
    expect(getRecord(note.id).folderId).toBe(root.id);
    expect(getRecord(grandchild.id).parentId).toBe(root.id);
    // unlink: una tarea vinculada a un evento conserva la tarea.
    const ev = await createRecord('event', { title: 'Parcial', startDate: '2026-03-10', allDay: true });
    const task = await createRecord('task', { title: 'Estudiar', eventId: ev.id });
    await deleteRecord(ev.id);
    expect(getRecord(task.id)).toMatchObject({ title: 'Estudiar', eventId: null });
  });

  it('las carpetas no admiten ciclos ni más de tres niveles', async () => {
    await ensureLoaded();
    const a = await createRecord('folder', { name: 'A' });
    const b = await createRecord('folder', { name: 'B', parentId: a.id });
    const c = await createRecord('folder', { name: 'C', parentId: b.id });
    await expect(createRecord('folder', { name: 'D', parentId: c.id })).rejects.toBeInstanceOf(ValidationError);
    await expect(updateRecord(a.id, { parentId: c.id })).rejects.toBeInstanceOf(ValidationError);
  });

  it('un commit es atómico: si una operación falla no se guarda ninguna', async () => {
    await ensureLoaded();
    await expect(
      commit((tx) => {
        tx.create('account', { name: 'Uno', openingDate: '2026-01-01' });
        tx.create('account', { name: '', openingDate: '2026-01-01' });
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    await reopen();
    expect(listKind('account')).toHaveLength(0);
  });

  it('las escrituras seguidas no se pisan', async () => {
    await ensureLoaded();
    const note = await createRecord('note', { title: 'x', content: '' });
    await Promise.all(Array.from({ length: 10 }, (_, i) => updateRecord(note.id, (current) => ({ content: `${current.content}${i}` }))));
    expect(getRecord(note.id).content).toBe('0123456789');
  });

  it('duplica sin copiar los adjuntos y marca el título', async () => {
    await ensureLoaded();
    const note = await createRecord('note', { title: 'Lista', content: 'a' });
    const copy = await duplicateRecord(note.id);
    expect(copy.id).not.toBe(note.id);
    expect(copy.title).toBe('Lista (copia)');
  });

  it('sanea registros dañados al leerlos sin perder el resto', async () => {
    await ensureLoaded();
    const value = sanitizeModule('notes', {
      records: [
        { id: 'n1', kind: 'note', title: 'Bien', content: 'hola', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
        { id: 'n2', kind: 'note', title: 42, pinned: 'sí' },
        { id: '<script>', kind: 'note' },
        { id: 'a1', kind: 'account', name: 'De otro módulo' },
        'basura',
      ],
    });
    expect(value.value.records.map((r) => r.id)).toEqual(['n1', 'n2']);
    expect(value.value.records[1]).toMatchObject({ title: '', pinned: false });
    expect(value.issues.length).toBeGreaterThan(0);
  });

  it('restaura un módulo reemplazando o combinando, sin tocar otros módulos', async () => {
    await ensureLoaded();
    const bank = await account();
    const keep = await createRecord('note', { title: 'Solo aquí' });
    const shared = await createRecord('note', { title: 'Versión local' });
    const backup = await exportModule('notes');
    backup.records = backup.records.filter((r) => r.id !== keep.id);
    const remote = backup.records.find((r) => r.id === shared.id);
    remote.title = 'Versión de la copia';
    remote.updatedAt = '2099-01-01T00:00:00.000Z';
    backup.records.push({ id: 'nueva', kind: 'note', title: 'Nueva', createdAt: remote.createdAt, updatedAt: remote.createdAt });
    const plan = sanitizeModule('notes', backup).value;
    expect(compareWithCurrent(plan)).toMatchObject({ added: 1, existing: 1, newer: 1 });

    await restoreModule('notes', plan, 'merge');
    expect(getRecord(keep.id)).not.toBeNull(); // combinar nunca borra
    expect(getRecord(shared.id).title).toBe('Versión de la copia');
    expect(getRecord('nueva')).not.toBeNull();

    await restoreModule('notes', plan, 'replace');
    await reopen();
    expect(getRecord(keep.id)).toBeNull(); // reemplazar deja el módulo como en la copia
    expect(getRecord(bank.id)).not.toBeNull(); // otros módulos intactos
  });
});
