import { describe, expect, it } from 'vitest';
import {
  DIFFICULTIES,
  clearPeerNotes,
  conflicts,
  countSolutions,
  createRng,
  grade,
  hasNote,
  hasUniqueSolution,
  isSolved,
  isValidPlacement,
  parse,
  solve,
  toggleNote,
  transform,
} from '../engine/sudokuEngine.js';
import { PUZZLES } from '../levels/puzzles.js';

const SAMPLE = parse('53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79');

describe('reglas', () => {
  it('no deja repetir en fila, columna ni bloque', () => {
    expect(isValidPlacement(SAMPLE, 2, 4)).toBe(true);
    expect(isValidPlacement(SAMPLE, 2, 5)).toBe(false); // fila (5 en la casilla 0)
    expect(isValidPlacement(SAMPLE, 2, 8)).toBe(false); // columna (8 más abajo)
    expect(isValidPlacement(SAMPLE, 2, 9)).toBe(false); // bloque (9 en la fila 2)
  });

  it('marca como conflicto las dos casillas que repiten', () => {
    const board = [...SAMPLE];
    board[2] = 5;
    expect([...conflicts(board)].sort((a, b) => a - b)).toEqual([0, 2]);
    expect(conflicts(SAMPLE).size).toBe(0);
  });

  it('resuelve y detecta la finalización', () => {
    const solution = solve(SAMPLE);
    expect(isSolved(solution)).toBe(true);
    expect(solution.every((v, i) => !SAMPLE[i] || SAMPLE[i] === v)).toBe(true);
    expect(isSolved(SAMPLE)).toBe(false);
  });

  it('cuenta soluciones: única, múltiple o ninguna', () => {
    expect(countSolutions(SAMPLE)).toBe(1);
    const open = [...SAMPLE];
    for (let i = 0; i < 40; i += 1) open[i] = 0;
    expect(countSolutions(open)).toBe(2);
    const broken = [...SAMPLE];
    broken[2] = 5;
    expect(countSolutions(broken)).toBe(0);
  });
});

describe('notas', () => {
  it('se activan y desactivan por número, y escribir borra la nota en las vecinas', () => {
    let notes = Array(81).fill(0);
    notes = toggleNote(notes, 10, 4);
    notes = toggleNote(notes, 11, 4);
    notes = toggleNote(notes, 11, 7);
    expect(hasNote(notes[11], 4)).toBe(true);
    notes = toggleNote(notes, 11, 7);
    expect(hasNote(notes[11], 7)).toBe(false);
    notes = clearPeerNotes(notes, 10, 4);
    expect(notes[10]).toBe(0);
    expect(hasNote(notes[11], 4)).toBe(false);
  });
});

describe('banco de tableros', () => {
  it('tiene tableros de las cuatro dificultades', () => {
    for (const { id } of DIFFICULTIES) expect(PUZZLES[id].length).toBeGreaterThanOrEqual(10);
  });

  it.each(DIFFICULTIES.map((d) => [d.name, d.id]))('%s: cada tablero tiene solución única y esa dificultad real', (_, id) => {
    for (const text of PUZZLES[id]) {
      const puzzle = parse(text);
      expect(hasUniqueSolution(puzzle)).toBe(true);
      expect(grade(puzzle)).toBe(id);
    }
  });

  it('la dificultad crece con las técnicas: más pistas en los fáciles', () => {
    const avg = (id) => PUZZLES[id].reduce((s, t) => s + [...t].filter((c) => c !== '.').length, 0) / PUZZLES[id].length;
    expect(avg('facil')).toBeGreaterThan(avg('medio'));
    expect(avg('medio')).toBeGreaterThan(avg('dificil'));
  });

  it('las variaciones conservan la solución única y la dificultad', () => {
    const rng = createRng(42);
    for (const { id } of DIFFICULTIES) {
      for (const text of PUZZLES[id].slice(0, 4)) {
        const puzzle = parse(text);
        const variant = transform(puzzle, rng);
        expect(variant).not.toEqual(puzzle);
        expect(variant.filter(Boolean).length).toBe(puzzle.filter(Boolean).length);
        expect(hasUniqueSolution(variant)).toBe(true);
        expect(grade(variant)).toBe(id);
      }
    }
  });
});
