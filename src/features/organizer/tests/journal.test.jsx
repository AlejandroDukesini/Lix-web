import { beforeAll, describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { memoriesFor, neighbourDays, summarize } from '../journal/journalStats.js';
import { createRecord, ensureLoaded, listKind } from '../data/store.js';
import { isLocked, lockNow, removePin, setPin, unlock } from '../shared/privacy.js';
import { todayISO } from '../shared/format.js';
import { openApp, preloadOrganizerPages } from './helpers.jsx';

beforeAll(() => preloadOrganizerPages(), 120_000);

const e = (eventDate, extra = {}) => ({ id: eventDate + (extra.id ?? ''), eventDate, writtenAt: `${eventDate}T20:00:00.000Z`, title: '', body: 'uno dos tres', tags: [], status: 'published', favorite: false, trashedAt: null, ...extra });

describe('cálculos del diario', () => {
  it('recuerdos de años anteriores, resumen y días vecinos', () => {
    const entries = [e('2024-03-10'), e('2025-03-10', { status: 'draft' }), e('2026-03-08'), e('2026-03-09', { tags: ['uni'], favorite: true }), e('2026-03-09', { id: 'b' }), e('2026-03-12'), e('2026-02-01', { trashedAt: '2026-02-02T00:00:00.000Z' })];
    expect(memoriesFor(entries, '2026-03-10').map((x) => x.eventDate)).toEqual(['2024-03-10']);
    const march = summarize(entries, '2026-03');
    expect(march).toMatchObject({ entries: 4, days: 3, words: 12, favorites: 1, longestStreak: 2 });
    expect(march.tags).toEqual([{ tag: 'uni', count: 1 }]);
    expect(summarize(entries, '2026').byMonth.get('2026-02')).toBeUndefined();
    expect(neighbourDays(entries, '2026-03-09')).toEqual({ previous: '2026-03-08', next: '2026-03-12' });
  });
});

describe('Diario: interfaz', () => {
  it('escribe una entrada con guardado automático y la muestra en la línea de tiempo', async () => {
    const { user } = await openApp('#/diario/nueva');
    await user.type(await screen.findByLabelText('Texto de la entrada'), 'Hoy fuimos al mirador.');
    await waitFor(() => expect(listKind('journalEntry')[0]?.body).toBe('Hoy fuimos al mirador.'), { timeout: 4000 });
    expect(listKind('journalEntry')[0]).toMatchObject({ eventDate: todayISO(), status: 'published' });
    await user.click(screen.getByRole('link', { name: 'Volver al diario' }));
    expect(await screen.findByText('Hoy fuimos al mirador.')).toBeInTheDocument();
  });

  it('las plantillas son opcionales y una entrada vacía abandonada no se guarda', async () => {
    const { user } = await openApp('#/diario/nueva');
    await user.click(await screen.findByRole('button', { name: 'Tres cosas buenas' }));
    expect(screen.getByLabelText('Texto de la entrada').value).toContain('Tres cosas buenas de hoy');
    await user.clear(screen.getByLabelText('Texto de la entrada'));
    await user.click(screen.getByRole('link', { name: 'Volver al diario' }));
    await waitFor(() => expect(listKind('journalEntry')).toHaveLength(0), { timeout: 4000 });
  });

  it('con PIN, el diario pide desbloqueo y el PIN no se guarda en claro', async () => {
    await ensureLoaded();
    await createRecord('journalEntry', { body: 'secreto', writtenAt: new Date().toISOString(), eventDate: todayISO() });
    await setPin('2468');
    const settings = listKind('privacySettings')[0];
    expect(JSON.stringify(settings)).not.toContain('2468');
    lockNow();
    expect(isLocked('journal')).toBe(true);
    const { user } = await openApp('#/diario');
    expect(await screen.findByText('El diario está protegido')).toBeInTheDocument();
    expect(screen.queryByText('secreto')).toBeNull();
    await user.type(screen.getByLabelText('PIN'), '1111');
    await user.click(screen.getByRole('button', { name: 'Desbloquear' }));
    expect(await screen.findByText(/PIN incorrecto/)).toBeInTheDocument();
    await user.type(screen.getByLabelText('PIN'), '2468');
    await user.click(screen.getByRole('button', { name: 'Desbloquear' }));
    expect(await screen.findByText('secreto')).toBeInTheDocument();
    expect((await unlock('2468')).ok).toBe(true);
    await removePin();
    expect(isLocked('journal')).toBe(false);
  });
});
