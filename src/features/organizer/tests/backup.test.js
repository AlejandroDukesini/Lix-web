import { describe, expect, it } from 'vitest';
import { createDefaultPreferences } from '../../../services/preferences/defaults.js';
import { compareBackup, parseFullBackup, restoreFullBackup, serializeFullBackup, undoLastRestore } from '../../../services/backup/backupService.js';
import { deleteAllLocalData } from '../../../services/preferences/preferencesService.js';
import { __resetDatabaseForTests } from '../../../services/storage/database.js';
import { __resetOrganizerForTests, createRecord, ensureLoaded, getRecord, listKind, updateRecord } from '../data/store.js';
import { readAttachment, saveAttachment } from '../data/attachments.js';

const prefs = createDefaultPreferences();
const context = { preferences: prefs, replacePreferences: () => {} };

async function reopen() {
  __resetOrganizerForTests();
  await ensureLoaded();
}

async function seedData() {
  await ensureLoaded();
  const bank = await createRecord('account', { name: 'Banco', openingDate: '2026-01-01', openingBalance: 100000 });
  await createRecord('transaction', { type: 'expense', amount: 5000, date: '2026-02-01', accountId: bank.id, categoryId: 'seed-cat-mercado' });
  const note = await createRecord('note', { title: 'Ideas', content: '- [ ] algo' });
  await createRecord('event', { title: 'Parcial', startDate: '2026-03-02', allDay: true });
  await createRecord('emotionLog', { at: '2026-03-01T10:00:00.000Z', primaryId: 'seed-emo-calma', intensity: 4, scale: 10 });
  return { bank, note };
}

describe('copias de la organización', () => {
  it('exportar → borrar todo → restaurar deja los cinco módulos idénticos', async () => {
    await seedData();
    const snapshot = (kind) => listKind(kind).map((r) => ({ ...r })).sort((a, b) => a.id.localeCompare(b.id));
    const before = Object.fromEntries(['account', 'transaction', 'note', 'event', 'emotionLog', 'category', 'emotion'].map((k) => [k, snapshot(k)]));
    const text = await serializeFullBackup(context);

    await deleteAllLocalData();
    __resetDatabaseForTests();
    await reopen();
    expect(listKind('transaction')).toHaveLength(0);

    await restoreFullBackup(parseFullBackup(text), context);
    await reopen();
    for (const [kind, records] of Object.entries(before)) expect(snapshot(kind)).toEqual(records);
  });

  it('combinar añade lo nuevo, actualiza lo más reciente y no borra nada; la vista previa lo anticipa', async () => {
    const { note } = await seedData();
    const text = await serializeFullBackup(context);
    // Después de la copia: una nota nueva aquí y un cambio local más reciente.
    const local = await createRecord('note', { title: 'Solo en este dispositivo' });
    await updateRecord(note.id, { title: 'Ideas (editada después)' });

    const plan = parseFullBackup(text);
    const comparison = await compareBackup(plan);
    expect(comparison['organizer:notes']).toMatchObject({ total: 1, existing: 1, added: 0, newer: 0 });

    await restoreFullBackup(plan, { ...context, mode: 'merge', selected: ['organizer:notes'] });
    expect(getRecord(local.id)).not.toBeNull();
    expect(getRecord(note.id).title).toBe('Ideas (editada después)');

    await restoreFullBackup(plan, { ...context, mode: 'replace', selected: ['organizer:notes'] });
    expect(getRecord(local.id)).toBeNull();
    expect(getRecord(note.id).title).toBe('Ideas');
    expect(listKind('account')).toHaveLength(1); // otros módulos intactos
  });

  it('copia selectiva: solo las secciones elegidas (y se puede restaurar sin configuración)', async () => {
    await seedData();
    const text = await serializeFullBackup({ ...context, include: ['organizer:emotions'] });
    const parsed = JSON.parse(text);
    expect(Object.keys(parsed.sections).sort()).toEqual(['meta', 'organizer:emotions']);
    const plan = parseFullBackup(text);
    expect(plan.sections.map((s) => s.id)).toEqual(['organizer:emotions', 'meta']);
    expect(plan.sections[0].summary).toMatch(/1 registro emocional/);
  });

  it('deshacer la última restauración devuelve el estado anterior', async () => {
    await seedData();
    const text = await serializeFullBackup(context);
    const later = await createRecord('note', { title: 'Escrita después de la copia' });
    await restoreFullBackup(parseFullBackup(text), { ...context, mode: 'replace', snapshot: true });
    expect(getRecord(later.id)).toBeNull();
    await undoLastRestore(context);
    expect(getRecord(later.id)).toMatchObject({ title: 'Escrita después de la copia' });
  });

  it('los adjuntos viajan en la copia (en base64) y se recuperan byte a byte', async () => {
    await ensureLoaded();
    const bytes = new Uint8Array([137, 80, 78, 71, 1, 2, 3, 250]);
    const file = new File([bytes], 'recibo.png', { type: 'image/png' });
    const saved = await saveAttachment(file);
    await createRecord('journalEntry', { body: 'con foto', writtenAt: new Date().toISOString(), eventDate: '2026-03-01', attachmentIds: [saved.id] });
    const text = await serializeFullBackup(context);
    await deleteAllLocalData();
    __resetDatabaseForTests();
    await reopen();
    expect(await readAttachment(saved.id)).toBeNull();
    await restoreFullBackup(parseFullBackup(text), context);
    const restored = await readAttachment(saved.id);
    expect(new Uint8Array(restored.data)).toEqual(bytes);
    expect(restored).toMatchObject({ name: 'recibo.png', type: 'image/png' });
  });

  it('rechaza adjuntos de tipos no permitidos o demasiado grandes', async () => {
    await ensureLoaded();
    await expect(saveAttachment(new File(['<html>'], 'x.html', { type: 'text/html' }))).rejects.toThrow(/Solo se pueden adjuntar/);
    await expect(saveAttachment(new File([new Uint8Array(3 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' }))).rejects.toThrow(/3 MB/);
  });
});
