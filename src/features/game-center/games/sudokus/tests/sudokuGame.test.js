import { describe, expect, it } from 'vitest';
import { hasUniqueSolution, isSolved } from '../engine/sudokuEngine.js';
import { MAX_HINTS, applyHint, check, counts, createGame, erase, fromSaved, isWon, newPuzzle, setValue, toSaved, toggleNoteAt, undo } from '../engine/sudokuGame.js';

const game0 = () => createGame('facil', newPuzzle('facil', 7));
const firstEmpty = (game) => game.board.findIndex((v) => !v);

describe('partida', () => {
  it('un Sudoku nuevo es válido, con solución única', () => {
    for (const difficulty of ['facil', 'medio', 'dificil', 'experto']) {
      const game = createGame(difficulty, newPuzzle(difficulty, 99));
      expect(hasUniqueSolution(game.puzzle)).toBe(true);
      expect(isSolved(game.solution)).toBe(true);
    }
  });

  it('las casillas del enunciado no se pueden cambiar ni borrar', () => {
    const game = game0();
    const given = game.puzzle.findIndex(Boolean);
    expect(setValue(game, given, 1)).toBe(game);
    expect(erase(game, given)).toBe(game);
    expect(toggleNoteAt(game, given, 3)).toBe(game);
  });

  it('escribir, borrar y deshacer', () => {
    let game = game0();
    const i = firstEmpty(game);
    game = setValue(game, i, 5);
    expect(game.board[i]).toBe(5);
    game = erase(game, i);
    expect(game.board[i]).toBe(0);
    game = undo(game);
    expect(game.board[i]).toBe(5);
    game = undo(game);
    expect(game.board[i]).toBe(0);
    expect(undo(game)).toBe(game);
  });

  it('las notas solo van en casillas vacías y escribir un número limpia esa nota en las vecinas', () => {
    let game = game0();
    const [a, b] = game.board.flatMap((v, i) => (!v ? [i] : [])).filter((i, _, list) => Math.floor(i / 9) === Math.floor(list[0] / 9)).slice(0, 2);
    game = toggleNoteAt(game, a, 4);
    game = toggleNoteAt(game, b, 4);
    expect(game.notes[b]).toBe(1 << 3);
    game = setValue(game, a, 4);
    expect(game.notes[b]).toBe(0);
    expect(toggleNoteAt(game, a, 2)).toBe(game);
  });

  it('las pistas escriben el valor correcto y están limitadas', () => {
    let game = game0();
    const i = firstEmpty(game);
    let cell;
    ({ game, cell } = applyHint(game, i));
    expect(cell).toBe(i);
    expect(game.board[i]).toBe(game.solution[i]);
    for (let k = 1; k < MAX_HINTS; k += 1) ({ game } = applyHint(game));
    expect(game.hints).toBe(MAX_HINTS);
    expect(applyHint(game).cell).toBe(-1);
  });

  it('comprobar señala las respuestas erróneas sin revelar la solución', () => {
    let game = game0();
    const i = firstEmpty(game);
    const wrongValue = (game.solution[i] % 9) + 1;
    game = setValue(game, i, wrongValue);
    const result = check(game);
    expect(result.wrong).toEqual([i]);
    expect(result.game.board[i]).toBe(wrongValue);
    expect(result.game.checks).toBe(1);
  });

  it('se gana solo con el tablero completo y correcto', () => {
    let game = game0();
    expect(isWon(game)).toBe(false);
    game.board.forEach((v, i) => {
      if (!v) game = setValue(game, i, game.solution[i]);
    });
    expect(isWon(game)).toBe(true);
    expect(counts(game).slice(1).every((n) => n === 9)).toBe(true);
  });
});

describe('guardar y reanudar', () => {
  it('una partida guardada se restaura igual', () => {
    let game = game0();
    const i = firstEmpty(game);
    game = setValue(game, i, 3);
    game = toggleNoteAt(game, firstEmpty(game), 6);
    const restored = fromSaved(JSON.parse(JSON.stringify(toSaved(game, 61_000))));
    expect(restored.elapsedMs).toBe(61_000);
    expect(restored.game.board).toEqual(game.board);
    expect(restored.game.notes).toEqual(game.notes);
    expect(restored.game.puzzle).toEqual(game.puzzle);
  });

  it('un dato dañado se descarta sin romper nada', () => {
    const saved = toSaved(game0(), 0);
    expect(fromSaved(null)).toBeNull();
    expect(fromSaved({ ...saved, difficulty: 'imposible' })).toBeNull();
    expect(fromSaved({ ...saved, puzzle: 'abc' })).toBeNull();
    // Respuestas que pisan el enunciado: no es la misma partida.
    const given = saved.puzzle.search(/[1-9]/);
    const board = saved.board.slice(0, given) + (saved.puzzle[given] === '9' ? '1' : '9') + saved.board.slice(given + 1);
    expect(fromSaved({ ...saved, board })).toBeNull();
    // Notas inválidas: se descartan solo las notas.
    expect(fromSaved({ ...saved, notes: 'x' }).game.notes.every((m) => m === 0)).toBe(true);
  });
});
