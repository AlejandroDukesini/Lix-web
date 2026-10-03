import { describe, expect, it } from 'vitest';
import {
  applyMove,
  availableMoves,
  coveredCount,
  createState,
  directionTowards,
  evaluate,
  invalidReason,
  isWon,
  parseLevel,
  solve,
  undoMove,
} from '../engine/gridEngine.js';

const slide = (map, limit = 10) => parseLevel({ id: 't', rule: 'slide', limit, map });
const path = (map, limit) => parseLevel({ id: 't', rule: 'path', limit, map });

describe('tablero', () => {
  it('interpreta muros, celdas, salida y tamaño', () => {
    const board = slide(['S.#', '...']);
    expect(board.width).toBe(3);
    expect(board.height).toBe(2);
    expect(board.total).toBe(5);
    expect(board.start).toBe(0);
  });

  it('rechaza mapas sin salida, con dos salidas o con caracteres desconocidos', () => {
    expect(() => slide(['...'])).toThrow(/salida/);
    expect(() => slide(['S.S'])).toThrow(/más de una/);
    expect(() => slide(['S.x'])).toThrow(/no válido/);
  });

  it('la salida cuenta como cubierta desde el principio', () => {
    const board = slide(['S..']);
    expect(coveredCount(board, createState(board))).toBe(1);
  });
});

describe('regla Deslizar', () => {
  it('avanza hasta chocar con un muro y pinta todo el recorrido', () => {
    const board = slide(['S...#.']);
    const next = applyMove(board, createState(board), 'right');
    expect(next.pos).toBe(3);
    expect(coveredCount(board, next)).toBe(4);
    expect(next.moves).toBe(1);
  });

  it('respeta los límites del tablero (fuera del mapa es muro)', () => {
    const board = slide(['S..']);
    const state = createState(board);
    expect(applyMove(board, state, 'up')).toBeNull();
    expect(applyMove(board, state, 'left')).toBeNull();
    expect(applyMove(board, applyMove(board, state, 'right'), 'right')).toBeNull();
  });

  it('no permite repetir casillas: el deslizamiento se detiene ante una cubierta', () => {
    const board = slide(['S..', '.#.', '...'], 9);
    let state = applyMove(board, createState(board), 'right');
    // Volver por la fila ya cubierta no es válido, y se explica por qué.
    expect(applyMove(board, state, 'left')).toBeNull();
    expect(invalidReason(board, state, 'left')).toBe('covered');
    expect(invalidReason(board, state, 'up')).toBe('wall');
    state = applyMove(board, state, 'down');
    state = applyMove(board, state, 'left');
    // Subir se detiene justo antes de la salida (cubierta) en lugar de atravesarla.
    state = applyMove(board, state, 'up');
    expect(state.pos).toBe(3);
    expect(isWon(board, state)).toBe(true);
  });

  it('cuenta movimientos y no deja superar el límite', () => {
    const board = slide(['S.', '..'], 1);
    const one = applyMove(board, createState(board), 'right');
    expect(one.moves).toBe(1);
    expect(applyMove(board, one, 'down')).toBeNull();
    expect(evaluate(board, one)).toEqual({ status: 'lost', reason: 'moves' });
  });

  it('detecta la victoria al cubrir todas las celdas', () => {
    const board = slide(['S.', '#.'], 2);
    const done = applyMove(board, applyMove(board, createState(board), 'right'), 'down');
    expect(isWon(board, done)).toBe(true);
    expect(evaluate(board, done).status).toBe('won');
    expect(availableMoves(board, done)).toEqual([]);
  });

  it('declara derrota cuando ya no existe solución con los movimientos restantes', () => {
    // Con 3 movimientos hay que ir primero a la derecha; bajar primero deja una celda inalcanzable.
    const board = slide(['S..', '...'], 3);
    const wrong = applyMove(board, createState(board), 'down');
    expect(evaluate(board, wrong)).toEqual({ status: 'lost', reason: 'unsolvable' });
  });

  it('deshacer restaura posición, celdas y contador', () => {
    const board = slide(['S..', '...'], 5);
    const start = createState(board);
    const moved = applyMove(board, start, 'right');
    const undone = undoMove(moved);
    expect(undone.pos).toBe(start.pos);
    expect(undone.covered).toBe(start.covered);
    expect(undone.moves).toBe(0);
  });
});

describe('regla Trazo único', () => {
  it('avanza una sola celda', () => {
    const board = path(['S..'], 2);
    expect(applyMove(board, createState(board), 'right').pos).toBe(1);
  });

  it('no permite volver a pisar una celda cubierta', () => {
    const board = path(['S..'], 2);
    const moved = applyMove(board, createState(board), 'right');
    expect(applyMove(board, moved, 'left')).toBeNull();
  });

  it('se queda sin salida si el camino se encierra', () => {
    const board = path(['.S.'], 2);
    const stuck = applyMove(board, createState(board), 'right');
    expect(evaluate(board, stuck)).toEqual({ status: 'lost', reason: 'stuck' });
  });
});

describe('interacción', () => {
  it('traduce el clic en una celda a una dirección', () => {
    const board = slide(['S..', '...', '...']);
    expect(directionTowards(board, 0, 2)).toBe('right');
    expect(directionTowards(board, 0, 6)).toBe('down');
    expect(directionTowards(board, 8, 6)).toBe('left');
    expect(directionTowards(board, 8, 2)).toBe('up');
    expect(directionTowards(board, 0, 4)).toBeNull();
    expect(directionTowards(board, 0, 0)).toBeNull();
  });

  it('el solucionador devuelve una ruta que realmente gana', () => {
    // Un anillo: hay que rodearlo entero y volver por el tramo inicial.
    const board = slide(['..S..', '.###.', '.....'], 5);
    const result = solve(board, createState(board));
    expect(result.solvable).toBe(true);
    let state = createState(board);
    for (const direction of result.path) state = applyMove(board, state, direction);
    expect(isWon(board, state)).toBe(true);
  });
});
