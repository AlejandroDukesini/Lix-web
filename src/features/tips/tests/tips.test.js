import { describe, expect, it, vi } from 'vitest';
import { BUILTIN_TIPS, TIP_CATEGORIES } from '../content/tips.js';
import { appendHistory, currentSlot, HISTORY_LIMIT, nextSlotTime, pickTip, tipPool, upcomingSlots } from '../tipsLogic.js';
import { ensureLoaded, getSettings, listKind, saveSettings } from '../../organizer/data/store.js';
import { runTipCheck } from '../TipsRunner.jsx';

const base = { enabled: true, inApp: true, notifications: false, frequencyMinutes: 60, startTime: '08:00', endTime: '21:00', days: [0, 1, 2, 3, 4, 5, 6], categories: Object.keys(TIP_CATEGORIES) };
// Miércoles 11 de noviembre de 2026.
const at = (h, m = 0, day = 11) => new Date(2026, 10, day, h, m);

describe('Colección de consejos', () => {
  it('10 categorías con 12 consejos cada una, ids únicos y fuentes honestas', () => {
    expect(Object.keys(TIP_CATEGORIES)).toHaveLength(10);
    expect(BUILTIN_TIPS).toHaveLength(120);
    expect(new Set(BUILTIN_TIPS.map((t) => t.id)).size).toBe(120);
    for (const tip of BUILTIN_TIPS) {
      expect(['lix', 'dicho']).toContain(tip.source);
      expect(tip.text.length).toBeGreaterThan(15);
      expect(tip.text.length).toBeLessThanOrEqual(280);
    }
    expect(BUILTIN_TIPS.some((t) => t.text.startsWith('El barco no se hunde'))).toBe(true);
  });
});

describe('Franjas', () => {
  it('una franja por hora dentro del horario, con clave estable', () => {
    expect(currentSlot(at(7, 59), base)).toBeNull();
    expect(currentSlot(at(8, 0), base)).toMatchObject({ key: '2026-11-11#0', index: 0 });
    expect(currentSlot(at(8, 59), base).key).toBe('2026-11-11#0');
    expect(currentSlot(at(9, 0), base).key).toBe('2026-11-11#1');
    expect(currentSlot(at(21, 0), base)).toBeNull();
    expect(currentSlot(at(10), { ...base, enabled: false })).toBeNull();
    expect(currentSlot(at(10), { ...base, days: [1, 2] })).toBeNull();
  });

  it('frecuencia de 30 minutos y una vez al día', () => {
    expect(currentSlot(at(8, 45), { ...base, frequencyMinutes: 30 }).index).toBe(1);
    expect(currentSlot(at(20, 59), { ...base, frequencyMinutes: 1440 }).index).toBe(0);
  });

  it('próxima franja y franjas de los próximos días (para Android)', () => {
    expect(nextSlotTime(at(10, 15), base)).toEqual(at(11));
    expect(nextSlotTime(at(21, 30), base)).toEqual(at(8, 0, 12));
    // Solo lunes: desde el miércoles, el próximo es el lunes 16.
    expect(nextSlotTime(at(10), { ...base, days: [1] })).toEqual(at(8, 0, 16));
    const slots = upcomingSlots(at(19, 30), base, 2);
    expect(slots[0]).toEqual({ key: '2026-11-11#12', at: at(20) });
    expect(slots).toHaveLength(1 + 13);
  });
});

describe('Elección sin repeticiones', () => {
  const pool = tipPool([], ['amor']);

  it('filtra por categorías preferidas e incluye los propios', () => {
    expect(pool.every((t) => t.category === 'amor')).toBe(true);
    const mine = tipPool([{ id: 'mio-1', category: 'amor', text: 'Mi consejo' }], ['amor']);
    expect(mine.find((t) => t.id === 'mio-1')).toMatchObject({ source: 'propio', builtin: false });
    // Sin categorías elegidas se usan todas.
    expect(tipPool([], [])).toHaveLength(120);
  });

  it('es determinista por franja y no repite los recientes', () => {
    expect(pickTip(pool, [], 'franja-a').id).toBe(pickTip(pool, [], 'franja-a').id);
    let history = [];
    for (let i = 0; i < pool.length - 1; i += 1) {
      const tip = pickTip(pool, history, `franja-${i}`);
      expect(history.map((h) => h.tipId)).not.toContain(tip.id);
      history = appendHistory(history, { tipId: tip.id });
    }
  });

  it('el historial no pasa de su límite', () => {
    let history = [];
    for (let i = 0; i < HISTORY_LIMIT + 20; i += 1) history = appendHistory(history, { tipId: `t${i}` });
    expect(history).toHaveLength(HISTORY_LIMIT);
    expect(history[0].tipId).toBe('t20');
  });
});

describe('Motor de la app (una vez por franja, sin duplicados)', () => {
  it('muestra el consejo en la app, lo registra y no lo repite en la misma franja', async () => {
    const showInApp = vi.fn();
    const first = await runTipCheck({ now: at(10, 5), visible: true, showInApp });
    expect(first.action).toBe('app');
    expect(showInApp).toHaveBeenCalledTimes(1);
    expect(getSettings('tipState')).toMatchObject({ lastSlot: '2026-11-11#2' });
    expect(getSettings('tipState').history).toHaveLength(1);
    expect((await runTipCheck({ now: at(10, 40), visible: true, showInApp })).action).toBe('already');
    expect(showInApp).toHaveBeenCalledTimes(1);
    expect((await runTipCheck({ now: at(11, 1), visible: true, showInApp })).action).toBe('app');
    expect(getSettings('tipState').history.map((h) => h.tipId)).toHaveLength(2);
  });

  it('con la app oculta usa la notificación del sistema solo si está activada; si no, espera', async () => {
    const showInApp = vi.fn();
    const showSystem = vi.fn(async () => true);
    expect((await runTipCheck({ now: at(12, 0), visible: false, showInApp, showSystem })).action).toBe('deferred');
    expect(showSystem).not.toHaveBeenCalled();
    await saveSettings('tipSettings', { notifications: true });
    const result = await runTipCheck({ now: at(12, 0), visible: false, showInApp, showSystem });
    expect(result.action).toBe('system');
    expect(getSettings('tipState').history.at(-1).channel).toBe('system');
    expect(showInApp).not.toHaveBeenCalled();
  });

  it('respeta los ajustes: desactivado o fuera de horario no muestra nada', async () => {
    await ensureLoaded();
    const showInApp = vi.fn();
    await saveSettings('tipSettings', { enabled: false });
    expect((await runTipCheck({ now: at(12), visible: true, showInApp })).action).toBe('none');
    await saveSettings('tipSettings', { enabled: true, startTime: '13:00', endTime: '14:00' });
    expect((await runTipCheck({ now: at(12), visible: true, showInApp })).action).toBe('none');
    expect(showInApp).not.toHaveBeenCalled();
    expect(listKind('tip')).toHaveLength(0);
  });

  it('valida los ajustes: el fin debe ser posterior al inicio', async () => {
    await ensureLoaded();
    await expect(saveSettings('tipSettings', { startTime: '20:00', endTime: '09:00' })).rejects.toThrow();
  });
});
