import { describe, expect, it } from 'vitest';
import { createState, difficultyOf, findSolution, isCleared, isSolvable, levelProblems, move, reach, tapMove } from '../engine/jamEngine.js';
import { LEVELS } from '../levels/levels.js';

/**
 * Tablero de prueba (5×5):
 *   a: horizontal, fila 2, columnas 0-1, sale a la derecha (salida en la fila 2)
 *   b: vertical, columna 3, filas 1-2, sale hacia arriba (salida en la columna 3)
 *   c: horizontal, fila 4, columnas 0-1, sale a la derecha, pero la fila 4 NO tiene salida
 */
const LEVEL = {
  width: 5,
  height: 5,
  exits: [
    { side: 'right', index: 2 },
    { side: 'top', index: 3 },
  ],
  walls: [],
  cars: [
    { id: 'a', row: 2, col: 0, length: 2, axis: 'h', dir: 'right' },
    { id: 'b', row: 1, col: 3, length: 2, axis: 'v', dir: 'up' },
  ],
};

describe('movimientos', () => {
  it('un coche bloqueado solo avanza hasta el obstáculo', () => {
    const state = createState(LEVEL);
    expect(reach(LEVEL, state, 'a')).toEqual({ steps: 1, canExit: false });
    expect(reach(LEVEL, state, 'b')).toEqual({ steps: 1, canExit: true });
  });

  it('solo se mueve en su eje y hacia su flecha (nunca atrás ni de lado)', () => {
    const state = createState(LEVEL);
    expect(move(LEVEL, state, 'a', 2)).toBeNull(); // b bloquea
    expect(move(LEVEL, state, 'a', 0)).toBeNull();
    expect(move(LEVEL, state, 'a', -1)).toBeNull();
    const moved = move(LEVEL, state, 'a', 1);
    expect(moved.cars.a).toMatchObject({ row: 2, col: 1 });
  });

  it('sale solo por una salida de su línea y con el camino libre', () => {
    let state = createState(LEVEL);
    expect(move(LEVEL, state, 'a', 'exit')).toBeNull();
    state = move(LEVEL, state, 'b', 'exit');
    expect(state.cars.b).toBeUndefined();
    expect(reach(LEVEL, state, 'a')).toEqual({ steps: 3, canExit: true });
    state = move(LEVEL, state, 'a', 'exit');
    expect(isCleared(state)).toBe(true);
  });

  it('tocar un borde sin salida no lo saca: se detiene allí', () => {
    const level = { ...LEVEL, cars: [...LEVEL.cars, { id: 'c', row: 4, col: 0, length: 2, axis: 'h', dir: 'right' }] };
    const state = createState(level);
    expect(reach(level, state, 'c')).toEqual({ steps: 3, canExit: false });
    const tapped = tapMove(level, state, 'c');
    expect(tapped.exited).toBe(false);
    expect(tapped.state.cars.c).toMatchObject({ col: 3 });
    expect(levelProblems(level)).toContain('c: no tiene salida en su línea');
  });

  it('un toque saca el coche si puede y si no lo avanza todo lo posible', () => {
    const state = createState(LEVEL);
    expect(tapMove(LEVEL, state, 'b')).toMatchObject({ exited: true });
    const a = tapMove(LEVEL, state, 'a');
    expect(a.exited).toBe(false);
    expect(a.state.cars.a.col).toBe(1);
    const stuck = tapMove(LEVEL, a.state, 'a');
    expect(stuck.state).toBeNull();
  });

  it('detecta un bloqueo sin salida: cuatro coches que se esperan en círculo', () => {
    // x necesita (0,3) que ocupa y; y necesita (2,3) que ocupa w; w necesita (2,1) que ocupa v;
    // v necesita (0,1) que ocupa x. Todos tienen salida en su línea, pero ninguno puede moverse.
    const level = {
      width: 4,
      height: 4,
      exits: [
        { side: 'right', index: 0 },
        { side: 'bottom', index: 3 },
        { side: 'left', index: 2 },
        { side: 'top', index: 1 },
      ],
      walls: [],
      cars: [
        { id: 'x', row: 0, col: 1, length: 2, axis: 'h', dir: 'right' },
        { id: 'y', row: 0, col: 3, length: 2, axis: 'v', dir: 'down' },
        { id: 'w', row: 2, col: 2, length: 2, axis: 'h', dir: 'left' },
        { id: 'v', row: 1, col: 1, length: 2, axis: 'v', dir: 'up' },
      ],
    };
    expect(levelProblems(level)).toEqual([]);
    expect(isSolvable(level, createState(level))).toBe(false);
    expect(findSolution(level)).toBeNull();
  });

  it('valida niveles: solapes, coches fuera del tablero y direcciones fuera del eje', () => {
    const bad = {
      ...LEVEL,
      cars: [
        { id: 'a', row: 2, col: 0, length: 2, axis: 'h', dir: 'up' },
        { id: 'b', row: 2, col: 1, length: 2, axis: 'v', dir: 'up' },
        { id: 'c', row: 4, col: 4, length: 2, axis: 'h', dir: 'right' },
      ],
    };
    const problems = levelProblems(bad);
    expect(problems).toContain('a: dirección fuera de su eje');
    expect(problems).toContain('b: se superpone con a');
    expect(problems).toContain('c: fuera del tablero');
  });
});

describe('niveles', () => {
  it('hay quince niveles con dificultad creciente', () => {
    expect(LEVELS).toHaveLength(15);
    const first = difficultyOf(LEVELS[0]);
    const last = difficultyOf(LEVELS.at(-1));
    expect(last.rounds + (last.needsManeuver ? 3 : 0)).toBeGreaterThan(first.rounds + (first.needsManeuver ? 3 : 0));
    expect(LEVELS.at(-1).cars.length).toBeGreaterThan(LEVELS[0].cars.length);
  });

  it.each(LEVELS.map((l) => [l.name, l]))('«%s» es válido y su solución vacía el aparcamiento', (_, level) => {
    expect(levelProblems(level)).toEqual([]);
    // Al empezar, al menos un coche puede moverse y no todos pueden salir ya.
    const state = createState(level);
    const exitable = level.cars.filter((car) => reach(level, state, car.id).canExit).length;
    expect(exitable).toBeGreaterThan(0);
    expect(exitable).toBeLessThan(level.cars.length);
    const path = findSolution(level);
    expect(path).not.toBeNull();
    let s = state;
    for (const m of path) {
      s = move(level, s, m.id, m.k);
      expect(s).not.toBeNull();
    }
    expect(isCleared(s)).toBe(true);
  });
});
