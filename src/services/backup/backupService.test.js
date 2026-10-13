import { describe, expect, it } from 'vitest';
import { createDefaultPreferences } from '../preferences/defaults.js';
import { deleteAllLocalData, serializeBackup } from '../preferences/preferencesService.js';
import { __resetDatabaseForTests, dbGet, dbPut, STORES } from '../storage/database.js';
import {
  __resetGameStorageForTests,
  readAllGameRecords,
  readCenterSettings,
  readGameRecord,
  recordGameResult,
  recordGameStart,
  updateCenterSettings,
  updateGameSettings,
} from '../../features/game-center/services/gameStorage.js';
import { BACKUP_FORMAT, BACKUP_SOURCES, createBackup, parseFullBackup, restoreFullBackup, serializeFullBackup } from './backupService.js';

const NOW = new Date(2026, 9, 1, 12, 0);

async function playSomeGames() {
  await recordGameStart('sudokus');
  await recordGameResult('sudokus', {
    completed: true,
    durationMs: 120_000,
    marks: [{ key: 'time:facil', value: 118_000, better: 'lower' }],
    progress: (progress) => ({ ...progress, solved: ['f-01', 'f-02'] }),
  });
  await recordGameStart('saltos-de-lumi');
  await recordGameStart('saltos-de-lumi');
  await recordGameResult('saltos-de-lumi', { completed: true, durationMs: 60_000, progress: () => ({ unlocked: 4, stars: { 1: 3, 2: 2 } }) });
  await updateGameSettings('traffic-rider', { control: 'swipe' });
  await updateCenterSettings({ sound: false, volume: 0.25 });
}

function customPreferences() {
  const prefs = createDefaultPreferences(NOW);
  prefs.appearance.theme = 'light';
  prefs.appearance.style = 'maximal';
  prefs.profile.nicknames = ['Mi cielo', 'Mi luna'];
  return prefs;
}

describe('copia de seguridad completa', () => {
  it('registra cada fuente persistente una sola vez', () => {
    const ids = BACKUP_SOURCES.map((s) => s.id);
    expect(ids).toEqual(expect.arrayContaining(['preferences', 'games', 'library', 'meta']));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('exporta los registros reales de los juegos, no solo la configuración', async () => {
    await playSomeGames();
    const backup = await createBackup({ preferences: customPreferences() }, NOW);
    expect(backup).toMatchObject({ format: BACKUP_FORMAT, schemaVersion: 2, createdAt: NOW.toISOString() });
    expect(backup.sections.preferences.appearance.theme).toBe('light');
    expect(backup.sections.games.records.sudokus).toMatchObject({ plays: 1, completions: 1, best: { 'time:facil': 118_000 } });
    expect(backup.sections.games.records['saltos-de-lumi'].progress).toEqual({ unlocked: 4, stars: { 1: 3, 2: 2 } });
    expect(backup.sections.games.records['traffic-rider'].settings).toEqual({ control: 'swipe' });
    expect(backup.sections.games.center).toMatchObject({ sound: false, volume: 0.25 });
  });

  it('extremo a extremo: exportar → borrar todo → restaurar (dos veces) recupera exactamente lo mismo', async () => {
    await playSomeGames();
    const before = await readAllGameRecords();
    const text = await serializeFullBackup({ preferences: customPreferences() }, NOW);

    // Borrado total, como "Borrar todos los datos".
    await deleteAllLocalData();
    __resetDatabaseForTests();
    __resetGameStorageForTests();
    expect(await readAllGameRecords()).toEqual({});

    let applied = null;
    const context = { replacePreferences: (prefs) => (applied = prefs) };
    const plan = parseFullBackup(text);
    expect(plan.sections.map((s) => s.id)).toEqual(['preferences', 'games', 'library', 'meta']);
    expect(plan.sections.find((s) => s.id === 'games').summary).toMatch(/3 juegos · 3 partidas/);

    await restoreFullBackup(plan, context);
    expect(applied.appearance).toMatchObject({ theme: 'light', style: 'maximal' });
    expect(applied.profile.nicknames).toEqual(['Mi cielo', 'Mi luna']);
    expect(await readAllGameRecords()).toEqual(before);
    expect(await readCenterSettings()).toMatchObject({ sound: false, volume: 0.25 });

    // Restaurar otra vez la misma copia no duplica partidas ni tiempos.
    await restoreFullBackup(parseFullBackup(text), context);
    expect(await readAllGameRecords()).toEqual(before);

    // Y los juegos siguen funcionando sobre los datos recuperados.
    await recordGameStart('sudokus');
    expect((await readGameRecord('sudokus')).plays).toBe(2);
  });

  it('restaura en un dispositivo que nunca jugó y reemplaza datos que no venían en la copia', async () => {
    await recordGameStart('sudokus');
    const text = await serializeFullBackup({ preferences: customPreferences() }, NOW);
    await recordGameStart('chess');
    await restoreFullBackup(parseFullBackup(text), { replacePreferences: () => {} });
    const records = await readAllGameRecords();
    expect(Object.keys(records)).toEqual(['sudokus']);
  });

  it('valida antes de escribir: un archivo dañado no toca los datos actuales', async () => {
    await recordGameStart('sudokus');
    expect(() => parseFullBackup('no json')).toThrow(/JSON/);
    expect(() => parseFullBackup('{"format":"otra-app"}')).toThrow(/copia/);
    expect(() => parseFullBackup(JSON.stringify({ format: BACKUP_FORMAT, schemaVersion: 99, sections: {} }))).toThrow(/más reciente/);
    expect(() => parseFullBackup(JSON.stringify({ format: BACKUP_FORMAT, schemaVersion: 2, sections: { games: {} } }))).toThrow(/Configuración/);
    expect((await readGameRecord('sudokus')).plays).toBe(1);
  });

  it('descarta registros con ids o valores inválidos sin interpretarlos', () => {
    const plan = parseFullBackup(
      JSON.stringify({
        format: BACKUP_FORMAT,
        schemaVersion: 2,
        sections: {
          preferences: customPreferences(),
          games: { records: { 'Bad Id!': { plays: 3 }, sudokus: { plays: -4, totalTimeMs: 'mucho', best: { a: 'x', b: 5 } } }, center: { volume: 9 } },
          unknownFuture: { anything: true },
        },
      }),
    );
    const games = plan.sections.find((s) => s.id === 'games').value;
    expect(Object.keys(games.records)).toEqual(['sudokus']);
    expect(games.records.sudokus).toMatchObject({ plays: 0, totalTimeMs: 0, best: { b: 5 } });
    expect(games.center.volume).toBe(1);
    expect(plan.issues).toContain('games.records.Bad Id!');
  });

  it('migra copias antiguas (solo preferencias) sin borrar los datos de juegos', async () => {
    await recordGameStart('sudokus');
    const legacy = serializeBackup(customPreferences());
    const plan = parseFullBackup(legacy);
    expect(plan.legacy).toBe(true);
    expect(plan.sections.map((s) => s.id)).toEqual(['preferences']);
    let applied = null;
    await restoreFullBackup(plan, { replacePreferences: (prefs) => (applied = prefs) });
    expect(applied.appearance.theme).toBe('light');
    expect((await readGameRecord('sudokus')).plays).toBe(1);
  });

  it('conserva la fecha de instalación más antigua', async () => {
    await dbPut(STORES.meta, 'firstOpenedAt', '2026-09-01T00:00:00.000Z');
    const text = await serializeFullBackup({ preferences: customPreferences() }, NOW);
    await dbPut(STORES.meta, 'firstOpenedAt', '2026-10-03T00:00:00.000Z');
    await restoreFullBackup(parseFullBackup(text), { replacePreferences: () => {} });
    expect(await dbGet(STORES.meta, 'firstOpenedAt')).toBe('2026-09-01T00:00:00.000Z');
  });
});
