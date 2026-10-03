import { beforeEach, describe, expect, it } from 'vitest';
import {
  CENTER_KEY,
  __resetGameStorageForTests,
  isBetter,
  normalizeRecord,
  readAllGameRecords,
  readCenterSettings,
  readGameRecord,
  recordGameResult,
  recordGameStart,
  updateCenterSettings,
  updateGameRecord,
} from '../services/gameStorage.js';
import { GAME_STATUS, formatLastPlayed, formatPlayTime, formatTime, transition } from '../services/gameLifecycle.js';
import { GAMES, filterGames, findGame } from '../registry/gameRegistry.js';
import { CATEGORIES, categoryLabel } from '../registry/categories.js';
import { ROADMAP } from '../registry/roadmap.js';
import { summarizeRecords } from '../hooks/useGameStatistics.js';
import { DB_VERSION, STORES, dbGet } from '../../../services/storage/database.js';

beforeEach(() => __resetGameStorageForTests());

describe('ciclo de vida', () => {
  const { READY, PLAYING, PAUSED, COMPLETED, GAME_OVER } = GAME_STATUS;

  it('sigue las transiciones válidas', () => {
    expect(transition(READY, 'start')).toBe(PLAYING);
    expect(transition(PLAYING, 'pause')).toBe(PAUSED);
    expect(transition(PAUSED, 'resume')).toBe(PLAYING);
    expect(transition(PLAYING, 'complete')).toBe(COMPLETED);
    expect(transition(PLAYING, 'gameOver')).toBe(GAME_OVER);
    expect(transition(COMPLETED, 'start')).toBe(PLAYING);
    expect(transition(GAME_OVER, 'reset')).toBe(READY);
  });

  it('ignora las transiciones inválidas', () => {
    expect(transition(READY, 'pause')).toBe(READY);
    expect(transition(PAUSED, 'complete')).toBe(PAUSED);
    expect(transition(COMPLETED, 'resume')).toBe(COMPLETED);
    expect(transition(PLAYING, 'inventada')).toBe(PLAYING);
  });

  it('formatea tiempos y fechas', () => {
    expect(formatTime(61_234)).toBe('1:01.2');
    expect(formatTime(5_000, { decimals: 0 })).toBe('0:05');
    expect(formatPlayTime(45_000)).toBe('45 s');
    expect(formatPlayTime(4 * 60_000)).toBe('4 min');
    expect(formatPlayTime(72 * 60_000)).toBe('1 h 12 min');
    const now = new Date(2026, 9, 2, 12);
    expect(formatLastPlayed(new Date(2026, 9, 2, 8).toISOString(), now)).toBe('hoy');
    expect(formatLastPlayed(new Date(2026, 9, 1, 23).toISOString(), now)).toBe('ayer');
    expect(formatLastPlayed(new Date(2026, 8, 29).toISOString(), now)).toBe('hace 3 días');
    expect(formatLastPlayed(null)).toBeNull();
  });
});

describe('almacenamiento de juegos', () => {
  it('usa su propio store en la base de datos de la app (migración v2)', async () => {
    expect(DB_VERSION).toBe(2);
    await recordGameStart('chess');
    const raw = await dbGet(STORES.games, 'chess');
    expect(raw).toMatchObject({ version: 1, gameId: 'chess', plays: 1 });
  });

  it('un registro dañado se repara con valores válidos', () => {
    const fixed = normalizeRecord({ plays: -3, best: { a: 'x', b: 12 }, progress: 'no', lastPlayedAt: 'ayer' }, 'g');
    expect(fixed).toMatchObject({ plays: 0, best: { b: 12 }, progress: {}, lastPlayedAt: null });
    expect(normalizeRecord(null, 'g').plays).toBe(0);
  });

  it('compara récords según el sentido de la marca', () => {
    expect(isBetter(10, 12, 'lower')).toBe(true);
    expect(isBetter(12, 10, 'lower')).toBe(false);
    expect(isBetter(12, 10, 'higher')).toBe(true);
    expect(isBetter(5, undefined, 'higher')).toBe(true);
    expect(isBetter(NaN, 1, 'higher')).toBe(false);
  });

  it('solo declara récord si supera lo guardado', async () => {
    const first = await recordGameResult('tunnel-runner', { marks: [{ key: 'distance', value: 500, better: 'higher' }] });
    expect(first.marks.distance).toMatchObject({ isRecord: true, previous: null });
    const worse = await recordGameResult('tunnel-runner', { marks: [{ key: 'distance', value: 300, better: 'higher' }] });
    expect(worse.marks.distance).toMatchObject({ isRecord: false, best: 500, previous: 500 });
    const better = await recordGameResult('tunnel-runner', { marks: [{ key: 'distance', value: 900, better: 'higher' }] });
    expect(better.marks.distance.isRecord).toBe(true);
    expect((await readGameRecord('tunnel-runner')).best.distance).toBe(900);
  });

  it('cuenta partidas, partidas terminadas, tiempo y progreso por juego', async () => {
    await recordGameStart('logic-grid');
    await recordGameResult('logic-grid', {
      completed: true,
      durationMs: 30_000,
      progress: (p) => ({ ...p, completed: { 'slide-01': true } }),
    });
    const record = await readGameRecord('logic-grid');
    expect(record).toMatchObject({ plays: 1, completions: 1, totalTimeMs: 30_000, progress: { completed: { 'slide-01': true } } });
    expect(record.lastPlayedAt).not.toBeNull();
    // Los datos de un juego no tocan a los demás.
    expect((await readGameRecord('chess')).plays).toBe(0);
  });

  it('las escrituras simultáneas no se pisan', async () => {
    await Promise.all(Array.from({ length: 10 }, () => updateGameRecord('aquapark', (r) => ({ ...r, plays: r.plays + 1 }))));
    expect((await readGameRecord('aquapark')).plays).toBe(10);
  });

  it('lee todos los registros, sin incluir las preferencias del centro', async () => {
    await recordGameStart('chess');
    await updateCenterSettings({ sound: false });
    const all = await readAllGameRecords();
    expect(Object.keys(all)).toEqual(['chess']);
    expect(all[CENTER_KEY]).toBeUndefined();
  });

  it('preferencias de sonido con valores por defecto y validación', async () => {
    expect(await readCenterSettings()).toMatchObject({ sound: true, volume: 0.6 });
    await updateCenterSettings({ volume: 3 });
    expect((await readCenterSettings()).volume).toBe(1);
  });

  it('no altera las preferencias generales de la app', async () => {
    localStorage.setItem('uamc:preferences', '{"a":1}');
    await recordGameStart('chess');
    await updateCenterSettings({ sound: false });
    expect(localStorage.getItem('uamc:preferences')).toBe('{"a":1}');
  });
});

const PHASE_2_IDS = ['cruce-del-pollo', 'resolver-casos', 'sudokus', 'aparcar', 'despejar'];
const PHASE_3_IDS = ['hexastack', 'traffic-rider', 'frente-abierto', 'saltos-de-lumi'];

describe('registro de juegos', () => {
  it('tiene los juegos de las Fases 1, 2 y 3, con manifiesto completo', () => {
    expect(GAMES.filter((g) => g.phase === 1).map((g) => g.id)).toEqual(['aquapark', 'io-games', 'logic-grid', 'chess', 'tunnel-runner']);
    expect(GAMES.filter((g) => g.phase === 2).map((g) => g.id)).toEqual(PHASE_2_IDS);
    expect(GAMES.filter((g) => g.phase === 3).map((g) => g.id)).toEqual(PHASE_3_IDS);
    expect(new Set(GAMES.map((g) => g.id)).size).toBe(GAMES.length);
    const categoryIds = CATEGORIES.map((c) => c.id);
    for (const game of GAMES) {
      expect(game.title).toBeTruthy();
      expect(game.description.length).toBeGreaterThan(40);
      expect(game.howTo.length).toBeGreaterThan(1);
      expect(game.controls.keyboard.length).toBeGreaterThan(0);
      expect(game.controls.touch.length).toBeGreaterThan(0);
      expect(typeof game.load).toBe('function');
      expect(typeof game.Art).toBe('function');
      for (const category of game.categories) expect(categoryIds).toContain(category);
      expect(game.progress(null)).toMatchObject({ done: 0 });
      expect(game.progress(null).total).toBeGreaterThan(0);
    }
    expect(findGame('chess').title).toBe('Ajedrez');
    expect(findGame('no-existe')).toBeNull();
  });

  it('las fases futuras solo son planificación (sin componente ni carga)', () => {
    expect(ROADMAP.map((p) => p.phase)).toEqual([4]);
    const planned = ROADMAP.flatMap((p) => p.games);
    expect(planned.length).toBeGreaterThan(0);
    for (const game of planned) {
      expect(game.load).toBeUndefined();
      expect(findGame(game.id)).toBeNull();
    }
  });

  it('busca por nombre y categoría, sin distinguir tildes ni mayúsculas', () => {
    const titles = (query, category) => filterGames(GAMES, { query, category }, categoryLabel).map((g) => g.title);
    expect(titles('AJEDREZ')).toEqual(['Ajedrez']);
    expect(titles('logica')).toEqual(['Cubrir el espacio', 'Ajedrez', 'Resolver casos', 'Sudokus', 'Despejar el estacionamiento', 'HexaStack']);
    expect(titles('', 'carreras')).toEqual(['Aquapark', 'Tunnel Runner', 'Aparcar el carro', 'Traffic Rider']);
    expect(titles('tunnel', 'logica')).toEqual([]);
    expect(titles('zzz')).toEqual([]);
  });

  it('resume estadísticas y progreso general', () => {
    const records = {
      chess: { ...normalizeRecord({ plays: 3, completions: 2, totalTimeMs: 60_000, lastPlayedAt: '2026-10-01T10:00:00.000Z', progress: { aiWins: { novato: true } } }, 'chess') },
      'tunnel-runner': normalizeRecord({ plays: 1, best: { distance: 1600 }, lastPlayedAt: '2026-10-02T10:00:00.000Z' }, 'tunnel-runner'),
    };
    const summary = summarizeRecords(records, GAMES);
    expect(summary).toMatchObject({ plays: 4, completions: 2, totalTimeMs: 60_000, lastPlayed: { id: 'tunnel-runner' } });
    // 1 nivel de IA (guardado con el id antiguo «novato», que equivale a «Niño») + 2 hitos de distancia.
    expect(summary.milestonesDone).toBe(3);
    // Fase 1: 3 circuitos + 3 minijuegos + 20 niveles + 5 niveles de IA + 3 hitos; más los de cada juego nuevo.
    const phase2 = GAMES.filter((g) => g.phase >= 2).reduce((sum, g) => sum + g.progress(null).total, 0);
    expect(summary.milestonesTotal).toBe(3 + 3 + 20 + 5 + 3 + phase2);
  });
});
