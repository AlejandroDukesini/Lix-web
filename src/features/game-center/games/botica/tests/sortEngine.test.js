import { describe, expect, it } from 'vitest';
import { checkPour, createState, isSolved, pour, solve, topRun } from '../engine/sortEngine.js';
import { LEVELS, TIERS } from '../levels/levels.js';
import { starsFor } from '../Botica.jsx';

const state = (tubes, capacity = 4) => ({ tubes: tubes.map((t) => t.split('')), capacity });

describe('Botica de colores · reglas de vertido', () => {
  it('vierte la racha superior completa si cabe', () => {
    const next = pour(state(['abb', 'b', '']), 0, 1);
    expect(next.tubes.map((t) => t.join(''))).toEqual(['a', 'bbb', '']);
  });

  it('respeta la capacidad: vierte solo lo que cabe', () => {
    const next = pour(state(['abbb', 'abb', '']), 0, 1);
    expect(next.tubes.map((t) => t.join(''))).toEqual(['abb', 'abbb', '']);
  });

  it('rechaza colores distintos, destino lleno, origen vacío, frasco terminado y el mismo frasco', () => {
    expect(checkPour(state(['ab', 'a']), 0, 1)).toMatchObject({ ok: false, reason: 'mismatch' });
    expect(checkPour(state(['ab', 'abab']), 0, 1)).toMatchObject({ ok: false, reason: 'full' });
    expect(checkPour(state(['', 'a']), 0, 1)).toMatchObject({ ok: false, reason: 'empty' });
    expect(checkPour(state(['a', '']), 0, 0)).toMatchObject({ ok: false, reason: 'same' });
    expect(checkPour(state(['aaaa', '']), 0, 1)).toMatchObject({ ok: false, reason: 'done' });
    expect(pour(state(['ab', 'a']), 0, 1)).toBeNull();
  });

  it('un frasco vacío admite cualquier tintura', () => {
    expect(checkPour(state(['abb', '']), 0, 1)).toMatchObject({ ok: true, color: 'b', amount: 2 });
  });

  it('calcula la racha superior', () => {
    expect(topRun(['a', 'b', 'b'])).toEqual({ color: 'b', count: 2 });
    expect(topRun([])).toEqual({ color: null, count: 0 });
  });

  it('detecta la victoria solo con frascos vacíos o llenos de un color', () => {
    expect(isSolved(state(['aaaa', 'bbbb', '']))).toBe(true);
    expect(isSolved(state(['aaa', 'bbbb', 'a']))).toBe(false);
    expect(isSolved(state(['aaab', 'bbba', '']))).toBe(false);
  });

  it('el solucionador encuentra una secuencia válida y detecta los callejones sin salida', () => {
    const start = state(['ab', 'ba', ''], 2);
    const { moves } = solve(start);
    let s = start;
    for (const [from, to] of moves) s = pour(s, from, to);
    expect(isSolved(s)).toBe(true);
    expect(solve(state(['ab', 'ba'], 2))).toEqual({ moves: null, exhausted: false });
  });
});

describe('Botica de colores · niveles', () => {
  it('hay niveles en las cuatro dificultades, con ids únicos', () => {
    expect(TIERS.map((t) => t.id)).toEqual(['facil', 'medio', 'dificil', 'avanzado']);
    for (const tier of TIERS) expect(LEVELS.filter((l) => l.tier === tier.id).length).toBeGreaterThanOrEqual(5);
    expect(new Set(LEVELS.map((l) => l.id)).size).toBe(LEVELS.length);
  });

  it('cada nivel está bien formado: cada color llena exactamente un frasco', () => {
    for (const level of LEVELS) {
      const counts = {};
      for (const tube of level.tubes) {
        expect(tube.length).toBeLessThanOrEqual(level.capacity);
        for (const c of tube) counts[c] = (counts[c] ?? 0) + 1;
      }
      for (const n of Object.values(counts)) expect(n).toBe(level.capacity);
      expect(isSolved(createState(level))).toBe(false);
    }
  });

  it('todos los niveles tienen solución (se comprueba jugándola)', () => {
    for (const level of LEVELS) {
      let s = createState(level);
      const { moves } = solve(s, { budget: 400_000 });
      expect(moves, level.id).not.toBeNull();
      for (const [from, to] of moves) s = pour(s, from, to);
      expect(isSolved(s), level.id).toBe(true);
      expect(level.par).toBeLessThanOrEqual(moves.length);
    }
  });

  it('la dificultad crece: más tinturas y frascos más altos', () => {
    const colors = (tier) => Math.max(...LEVELS.filter((l) => l.tier === tier).map((l) => new Set(l.tubes.flat()).size));
    expect(colors('avanzado')).toBeGreaterThan(colors('medio'));
    expect(colors('medio')).toBeGreaterThan(colors('facil'));
    expect(LEVELS.filter((l) => l.tier === 'avanzado').every((l) => l.capacity === 5)).toBe(true);
    expect(LEVELS.some((l) => l.tier === 'dificil' && l.tubes.filter((t) => !t.length).length === 1)).toBe(true);
  });

  it('estrellas: en el par → 3, con pista → máximo 2', () => {
    expect(starsFor(10, 10, false)).toBe(3);
    expect(starsFor(13, 10, false)).toBe(2);
    expect(starsFor(30, 10, false)).toBe(1);
    expect(starsFor(10, 10, true)).toBe(2);
  });
});
