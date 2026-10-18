import { beforeAll, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { byValence, dayTones, distribution, intensityPercent, periodSummary, series } from '../emotions/emotionStats.js';
import { createRecord, deleteRecord, ensureLoaded, getRecord, IntegrityError, listKind } from '../data/store.js';
import { lockNow, setPin } from '../shared/privacy.js';
import { remindersBetween } from '../reminders/schedule.js';
import { openApp, preloadOrganizerPages } from './helpers.jsx';

beforeAll(() => preloadOrganizerPages(), 120_000);

const emotions = new Map([
  ['a', { id: 'a', valence: 'pleasant', color: '#f00' }],
  ['t', { id: 't', valence: 'unpleasant', color: '#00f' }],
]);
const log = (at, primaryId, intensity, scale = 10, extra = {}) => ({ at, primaryId, intensity, scale, secondaryIds: [], mood: null, ...extra });

describe('cálculos del diario emocional', () => {
  const logs = [
    log('2026-03-01T15:00:00', 'a', 10),
    log('2026-03-01T20:00:00', 't', 1, 10, { secondaryIds: ['a'], mood: -1 }),
    log('2026-03-03T10:00:00', 't', 5, 5, { mood: 1 }),
  ];
  it('normaliza la intensidad según la escala de cada registro', () => {
    expect(logs.map(intensityPercent)).toEqual([100, 0, 100]);
  });
  it('distribución, tono, serie por día y resumen del período', () => {
    expect(distribution(logs)).toEqual([
      { id: 't', primary: 2, secondary: 0 },
      { id: 'a', primary: 1, secondary: 1 },
    ]);
    expect(byValence(logs, emotions)).toEqual({ pleasant: 1, unpleasant: 2, mixed: 0, neutral: 0 });
    const s = series(logs, '2026-03-01', '2026-03-03');
    expect(s.map((d) => [d.count, d.intensity, d.mood])).toEqual([
      [2, 50, -1],
      [0, null, null],
      [1, 100, 1],
    ]);
    expect(periodSummary(logs, '2026-03-01', '2026-03-31', emotions)).toMatchObject({ count: 3, days: 2, averageIntensity: 67, averageMood: 0, topEmotionId: 't' });
    expect(dayTones(logs, emotions).get('2026-03-01').tone).toBe('mixed');
    expect(dayTones(logs, emotions).get('2026-03-03').tone).toBe('unpleasant');
  });
});

describe('recordatorios', () => {
  it('calcula avisos de eventos, tareas y pagos una sola vez por ventana, y nunca de emociones', () => {
    const records = {
      events: [{ id: 'e', title: 'Parcial', startDate: '2026-03-10', endDate: '2026-03-10', startTime: '10:00', allDay: false, recurrence: null, exceptions: {}, reminders: [30, 1440], status: 'scheduled' }],
      tasks: [{ id: 't', title: 'Leer', dueDate: '2026-03-10', dueTime: null, status: 'todo', reminders: [0] }],
      activities: [],
      scheduled: [{ id: 'p', name: 'Arriendo', flow: 'expense', status: 'active', startDate: '2026-03-12', recurrence: null, skipped: [], reminderDays: 2, amount: 1, accountId: 'x' }],
      transactions: [],
    };
    const due = remindersBetween(records, new Date(2026, 2, 9, 9, 0), new Date(2026, 2, 10, 9, 45));
    expect(due.map((r) => r.key)).toEqual(['event:e:2026-03-10:1440', 'task:t:2026-03-10:0', 'payment:p:2026-03-12:2880', 'event:e:2026-03-10:30']);
    // La ventana siguiente no repite los avisos ya calculados.
    expect(remindersBetween(records, new Date(2026, 2, 10, 9, 45), new Date(2026, 2, 10, 12, 0))).toEqual([]);
  });
});

describe('Diario emocional: interfaz', () => {
  it('registra una emoción con intensidad y la muestra en el historial de hoy', async () => {
    const { user } = await openApp('#/emociones');
    const form = await screen.findByRole('form', { name: 'Nuevo registro emocional' });
    const primary = await within(form).findByRole('group', { name: '¿Qué sientes principalmente?' });
    await user.click(within(primary).getByRole('button', { name: 'Gratitud' }));
    await user.click(within(form).getByRole('button', { name: 'Guardar registro' }));
    await waitFor(() => expect(listKind('emotionLog')).toHaveLength(1));
    expect(listKind('emotionLog')[0]).toMatchObject({ primaryId: 'seed-emo-gratitud', intensity: 5, scale: 10 });
    const today = await screen.findByRole('region', { name: 'Hoy' });
    expect(await within(today).findByText('Gratitud')).toBeInTheDocument();
  });

  it('pide la emoción principal antes de guardar', async () => {
    const { user } = await openApp('#/emociones');
    const form = await screen.findByRole('form', { name: 'Nuevo registro emocional' });
    await user.click(within(form).getByRole('button', { name: 'Guardar registro' }));
    expect(await within(form).findByText(/Elige la emoción/)).toBeInTheDocument();
    expect(listKind('emotionLog')).toHaveLength(0);
  });

  it('una emoción usada no se borra (se archiva) y borrar todo exige confirmación', async () => {
    await ensureLoaded();
    await createRecord('emotionLog', { at: new Date().toISOString(), primaryId: 'seed-emo-calma', intensity: 3, scale: 10 });
    await expect(deleteRecord('seed-emo-calma')).rejects.toBeInstanceOf(IntegrityError);
    const { user } = await openApp('#/emociones/ajustes');
    await user.click(await screen.findByRole('button', { name: 'Borrar todos mis registros' }));
    const dialog = screen.getAllByRole('dialog').at(-1);
    expect(within(dialog).getByRole('button', { name: 'Borrar registros' })).toBeDisabled();
    await user.type(within(dialog).getByLabelText('Escribe BORRAR para confirmar'), 'BORRAR');
    await user.click(within(dialog).getByRole('button', { name: 'Borrar registros' }));
    await waitFor(() => expect(listKind('emotionLog')).toHaveLength(0));
    expect(getRecord('seed-emo-calma')).not.toBeNull();
  });

  it('con PIN, los registros quedan ocultos pero los ejercicios siguen disponibles', async () => {
    await ensureLoaded();
    await createRecord('emotionLog', { at: new Date().toISOString(), primaryId: 'seed-emo-tristeza', intensity: 8, scale: 10, description: 'muy privado' });
    await setPin('1357');
    lockNow();
    await openApp('#/emociones/historial');
    expect(await screen.findByText('El diario emocional está protegido')).toBeInTheDocument();
    expect(screen.queryByText(/muy privado/)).toBeNull();
    window.location.hash = '#/emociones/bienestar';
    expect(await screen.findByRole('heading', { name: 'Respiración cuadrada' })).toBeInTheDocument();
  });
});
