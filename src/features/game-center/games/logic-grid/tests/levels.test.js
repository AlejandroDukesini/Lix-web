import { describe, expect, it } from 'vitest';
import { applyMove, coveredCount, createState, isWon, moveTrace, parseLevel, solve } from '../engine/gridEngine.js';
import { LEVELS, SERIES, levelsOf } from '../levels/levels.js';

describe('niveles del juego de lógica', () => {
  it('tienen identificadores únicos y pertenecen a una serie', () => {
    const ids = LEVELS.map((level) => level.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const level of LEVELS) expect(SERIES.map((s) => s.id)).toContain(level.rule);
    expect(levelsOf('slide').length).toBeGreaterThanOrEqual(10);
    expect(levelsOf('path').length).toBeGreaterThanOrEqual(6);
  });

  for (const level of LEVELS) {
    it(`${level.id} «${level.name}»: tiene solución en exactamente ${level.limit} movimientos`, () => {
      const board = parseLevel(level);
      const result = solve(board, createState(board), { budget: 5_000_000 });
      expect(result.solvable).toBe(true);

      // La solución encontrada se reproduce con el motor real y gana dentro del límite.
      let state = createState(board);
      for (const direction of result.path) {
        // Ninguna casilla se repite: cada jugada solo pisa casillas nuevas.
        const trace = moveTrace(board, state, direction);
        const before = coveredCount(board, state);
        state = applyMove(board, state, direction);
        expect(state).not.toBeNull();
        expect(coveredCount(board, state)).toBe(before + trace.length);
      }
      expect(coveredCount(board, state)).toBe(board.total);
      expect(isWon(board, state)).toBe(true);
      expect(state.moves).toBeLessThanOrEqual(level.limit);

      // Y no existe solución con un movimiento menos: el límite es exacto.
      const tighter = parseLevel({ ...level, limit: level.limit - 1 });
      expect(solve(tighter, createState(tighter), { budget: 5_000_000 }).solvable).toBe(false);

      if (level.rule === 'path') expect(level.limit).toBe(board.total - 1);
    });
  }
});
