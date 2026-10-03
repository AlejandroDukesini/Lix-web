/**
 * Estado de una partida de Sudoku (puro, sin interfaz).
 *
 * { difficulty, puzzle, solution, board, notes, hints, checks, history }
 *   puzzle    enunciado (las casillas con número son fijas)
 *   board     lo que hay escrito ahora (enunciado + respuestas)
 *   notes     máscara de notas por casilla (bit v-1 = nota v)
 *   history   pasos para deshacer (board y notes anteriores)
 *
 * La solución se calcula al crear la partida (es única) y solo se usa para
 * las pistas y la comprobación: nunca se muestra entera.
 */
import { CELLS, DIFFICULTIES, clearPeerNotes, createRng, hasUniqueSolution, isSolved, parse, serialize, solve, toggleNote, transform } from './sudokuEngine.js';
import { PUZZLES } from '../levels/puzzles.js';

export const MAX_HINTS = 3;
const HISTORY = 60;

/** Un Sudoku nuevo de esa dificultad: tablero del banco con una variación al azar. */
export function newPuzzle(difficulty, seed = Date.now()) {
  const rng = createRng(seed);
  const list = PUZZLES[difficulty] ?? PUZZLES.facil;
  const base = parse(list[Math.floor(rng() * list.length)]);
  return transform(base, rng);
}

export function createGame(difficulty, puzzle) {
  return {
    difficulty,
    puzzle: [...puzzle],
    solution: solve(puzzle),
    board: [...puzzle],
    notes: Array(CELLS).fill(0),
    hints: 0,
    checks: 0,
    history: [],
  };
}

export const isGiven = (game, i) => game.puzzle[i] !== 0;
const remember = (game) => [...game.history.slice(-HISTORY + 1), { board: game.board, notes: game.notes }];

/** Escribir un número (o borrarlo con 0). Las casillas del enunciado no se tocan. */
export function setValue(game, i, value) {
  if (isGiven(game, i) || game.board[i] === value) return game;
  const board = [...game.board];
  board[i] = value;
  const notes = value ? clearPeerNotes(game.notes, i, value) : game.notes;
  return { ...game, board, notes, history: remember(game) };
}

export const erase = (game, i) => {
  if (isGiven(game, i)) return game;
  if (game.board[i]) return setValue(game, i, 0);
  if (!game.notes[i]) return game;
  return { ...game, notes: game.notes.map((m, k) => (k === i ? 0 : m)), history: remember(game) };
};

/** Nota (lápiz) en una casilla vacía. */
export function toggleNoteAt(game, i, value) {
  if (isGiven(game, i) || game.board[i]) return game;
  return { ...game, notes: toggleNote(game.notes, i, value), history: remember(game) };
}

export function undo(game) {
  const last = game.history.at(-1);
  if (!last) return game;
  return { ...game, board: last.board, notes: last.notes, history: game.history.slice(0, -1) };
}

/**
 * Pista: escribe el valor correcto en la casilla elegida (o, si no hay o ya es
 * correcta, en la primera vacía). Hay MAX_HINTS por partida.
 */
export function applyHint(game, preferred = -1) {
  if (game.hints >= MAX_HINTS) return { game, cell: -1 };
  const needs = (i) => i >= 0 && !isGiven(game, i) && game.board[i] !== game.solution[i];
  const cell = needs(preferred) ? preferred : game.board.findIndex((v, i) => !v && needs(i));
  if (cell === -1) return { game, cell: -1 };
  const next = setValue(game, cell, game.solution[cell]);
  return { game: { ...next, hints: game.hints + 1 }, cell };
}

/** Comprobar: casillas escritas que no coinciden con la solución (sin decir cuál sería el número correcto). */
export function check(game) {
  const wrong = game.board.flatMap((v, i) => (v && !isGiven(game, i) && v !== game.solution[i] ? [i] : []));
  return { game: { ...game, checks: game.checks + 1 }, wrong };
}

export const isWon = (game) => isSolved(game.board);

/** Cuántas veces está ya escrito cada número (para el teclado). */
export function counts(game) {
  const out = Array(10).fill(0);
  for (const v of game.board) if (v) out[v] += 1;
  return out;
}

// --- Guardar y reanudar ---------------------------------------------------------

export const toSaved = (game, elapsedMs) => ({
  difficulty: game.difficulty,
  puzzle: serialize(game.puzzle),
  board: serialize(game.board),
  notes: game.notes,
  hints: game.hints,
  checks: game.checks,
  elapsedMs: Math.round(elapsedMs),
});

/** Restaura una partida guardada. Si el dato está dañado o no es válido, devuelve null. */
export function fromSaved(saved) {
  try {
    if (!saved || !DIFFICULTIES.some((d) => d.id === saved.difficulty)) return null;
    const puzzle = parse(saved.puzzle);
    const board = parse(saved.board);
    if (!hasUniqueSolution(puzzle)) return null;
    if (board.some((v, i) => puzzle[i] && v !== puzzle[i])) return null;
    const notes = Array.isArray(saved.notes) && saved.notes.length === CELLS && saved.notes.every((m) => Number.isInteger(m) && m >= 0 && m < 512) ? saved.notes : Array(CELLS).fill(0);
    const game = createGame(saved.difficulty, puzzle);
    return {
      game: { ...game, board, notes, hints: Math.min(MAX_HINTS, Math.max(0, saved.hints | 0)), checks: Math.max(0, saved.checks | 0) },
      elapsedMs: Number.isFinite(saved.elapsedMs) && saved.elapsedMs >= 0 ? saved.elapsedMs : 0,
    };
  } catch {
    return null;
  }
}
