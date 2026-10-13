import { describe, expect, it } from 'vitest';
import {
  COLS,
  HIDDEN,
  LOCK_DELAY,
  MAX_LOCK_RESETS,
  ROWS,
  SHAPES,
  TYPES,
  boardFromRows,
  cellsOf,
  collides,
  createGame,
  dropDistance,
  gravityInterval,
  hardDrop,
  hold,
  move,
  preview,
  rotate,
  tick,
} from '../engine/blocksEngine.js';

/** Partida con una pieza concreta en juego (y el resto de la cola intacta). */
function withPiece(type, options = {}) {
  const state = createGame({ seed: 7, ...options });
  state.active = { type, rot: 0, x: 3, y: 1 };
  state.lowestY = 1;
  return state;
}

const filledRow = (except = []) => [...'##########'].map((c, i) => (except.includes(i) ? '.' : c)).join('');

describe('piezas', () => {
  it('cada pieza tiene 4 estados de 4 celdas y el giro completo vuelve al inicio', () => {
    for (const type of TYPES) {
      expect(SHAPES[type]).toHaveLength(4);
      for (const state of SHAPES[type]) expect(state).toHaveLength(4);
    }
    // T en estado R: la punta mira a la derecha.
    expect(SHAPES.T[1]).toEqual(expect.arrayContaining([[1, 0], [1, 1], [2, 1], [1, 2]]));
  });

  it('salen en bolsas de 7: cada bloque de 7 contiene las 7 piezas', () => {
    const state = createGame({ seed: 42 });
    const seen = [state.active.type, ...preview(state, 13)];
    expect(new Set(seen.slice(0, 7)).size).toBe(7);
    expect(new Set(seen.slice(7, 14)).size).toBe(7);
  });

  it('la misma semilla da la misma secuencia', () => {
    const a = createGame({ seed: 9 });
    const b = createGame({ seed: 9 });
    expect(preview(a, 10)).toEqual(preview(b, 10));
  });

  it('nace en la parte de arriba y centrada', () => {
    const state = createGame({ seed: 3 });
    const xs = cellsOf(state.active).map(([x]) => x);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(3);
    expect(Math.max(...xs)).toBeLessThanOrEqual(6);
    expect(Math.min(...cellsOf(state.active).map(([, y]) => y))).toBeLessThan(HIDDEN + 1);
  });
});

describe('movimiento y colisiones', () => {
  it('se mueve a los lados hasta la pared y no la atraviesa', () => {
    const state = withPiece('O');
    let moves = 0;
    while (move(state, -1)) moves += 1;
    expect(moves).toBe(4); // O ocupa las columnas 4-5 → llega a 0-1
    expect(Math.min(...cellsOf(state.active).map(([x]) => x))).toBe(0);
    while (move(state, 1));
    expect(Math.max(...cellsOf(state.active).map(([x]) => x))).toBe(COLS - 1);
  });

  it('no entra en celdas ocupadas', () => {
    const state = withPiece('O', { board: boardFromRows(['#.........']) });
    state.active = { type: 'O', rot: 0, x: -1, y: ROWS - 3 };
    expect(collides(state.board, state.active)).toBe(false);
    expect(move(state, 0, 1)).toBe(false); // debajo hay un bloque en la columna 0
  });

  it('la caída instantánea baja hasta el fondo, puntúa 2 por casilla y fija', () => {
    const state = withPiece('O');
    const distance = dropDistance(state);
    expect(distance).toBe(ROWS - 2 - 1);
    const events = hardDrop(state);
    expect(events[0]).toEqual({ type: 'hardDrop', distance });
    expect(state.score).toBe(2 * distance);
    expect(state.board[(ROWS - 1) * COLS + 4]).toBe('O');
    expect(state.pieces).toBe(1);
    expect(state.active.type).not.toBeUndefined(); // sale la siguiente
  });
});

describe('rotación', () => {
  it('gira en el centro sin desplazarse', () => {
    const state = withPiece('T');
    expect(rotate(state, 1)).toBe(true);
    expect(state.active).toMatchObject({ rot: 1, x: 3, y: 1 });
    expect(rotate(state, -1)).toBe(true);
    expect(state.active.rot).toBe(0);
  });

  it('pegada a la pared, la patada la separa en lugar de impedir el giro', () => {
    const state = withPiece('I');
    rotate(state, 1); // vertical en la columna x+2
    while (move(state, 1));
    expect(Math.max(...cellsOf(state.active).map(([x]) => x))).toBe(COLS - 1);
    expect(rotate(state, 1)).toBe(true); // a horizontal: necesita retroceder
    const xs = cellsOf(state.active).map(([x]) => x);
    expect(Math.max(...xs)).toBe(COLS - 1);
    expect(Math.min(...xs)).toBe(COLS - 4);
  });

  it('junto a otros bloques prueba desplazamientos y, si ninguno cabe, no gira', () => {
    // T a ras del suelo en un pozo de 3 de ancho: girar debe encontrar hueco con patada o fallar sin romper nada.
    const board = boardFromRows(['###...####', '###...####', '###...####']);
    const state = withPiece('T', { board });
    state.active = { type: 'T', rot: 0, x: 3, y: ROWS - 2 };
    expect(collides(board, state.active)).toBe(false);
    const before = { ...state.active };
    const turned = rotate(state, 1);
    expect(collides(state.board, state.active)).toBe(false);
    if (!turned) expect(state.active).toEqual(before);

    // Encerrada por completo: no gira.
    const tight = boardFromRows(['##########', '###.######', '##...#####', '##########']);
    const s2 = withPiece('T', { board: tight });
    s2.active = { type: 'T', rot: 0, x: 2, y: ROWS - 3 };
    expect(collides(tight, s2.active)).toBe(false);
    expect(rotate(s2, 1)).toBe(false);
    expect(s2.active.rot).toBe(0);
  });

  it('la O no gira', () => {
    const state = withPiece('O');
    expect(rotate(state, 1)).toBe(false);
  });
});

describe('fijación y líneas', () => {
  it('al tocar el suelo espera el retardo de fijación antes de fijar', () => {
    const state = withPiece('O');
    state.active.y = ROWS - 2;
    expect(tick(state, LOCK_DELAY / 2)).toEqual([]);
    const events = tick(state, LOCK_DELAY);
    expect(events.some((e) => e.type === 'lock')).toBe(true);
  });

  it('mover sobre el suelo renueva la fijación, pero con límite', () => {
    const state = withPiece('O');
    state.active.y = ROWS - 2;
    for (let i = 0; i < MAX_LOCK_RESETS; i += 1) {
      tick(state, LOCK_DELAY * 0.8);
      move(state, i % 2 ? 1 : -1);
    }
    expect(state.pieces).toBe(0);
    const events = tick(state, 0.01);
    expect(events.some((e) => e.type === 'lock')).toBe(true);
  });

  it('una línea completa desaparece y lo de arriba baja', () => {
    const board = boardFromRows(['.....#....', filledRow([0, 1])]);
    const state = withPiece('O', { board });
    state.active = { type: 'O', rot: 0, x: -1, y: ROWS - 3 };
    const events = hardDrop(state);
    const lines = events.find((e) => e.type === 'lines');
    expect(lines.count).toBe(1);
    expect(state.lines).toBe(1);
    expect(state.score).toBe(2 + 100); // 1 casilla de caída instantánea + la línea
    // El bloque suelto de la fila de arriba bajó una fila; la O dejó su mitad superior.
    expect(state.board[(ROWS - 1) * COLS + 5]).toBe('Z');
    expect(state.board[(ROWS - 1) * COLS + 0]).toBe('O');
  });

  it('cuatro líneas a la vez valen 800 × nivel y seguidas ×1,5', () => {
    const rows = [filledRow([0]), filledRow([0]), filledRow([0]), filledRow([0])];
    const state = withPiece('I', { board: boardFromRows([...rows, ...rows]), startLevel: 2 });
    state.active = { type: 'I', rot: 1, x: -2, y: ROWS - 8 };
    hardDrop(state);
    expect(state.lines).toBe(4);
    expect(state.tetrises).toBe(1);
    const afterFirst = state.score;
    expect(afterFirst - 2 * dropDistanceFor(4)).toBe(800 * 2);
    state.active = { type: 'I', rot: 1, x: -2, y: ROWS - 8 };
    hardDrop(state);
    expect(state.lines).toBe(8);
    // ×1,5 por repetir + combo (50 × 1 × nivel).
    expect(state.score - afterFirst).toBe(2 * 4 + 1200 * 2 + 50 * 2);
  });

  it('dos y tres líneas a la vez', () => {
    const state = withPiece('I', { board: boardFromRows([filledRow([0]), filledRow([0]), filledRow([0])]) });
    state.active = { type: 'I', rot: 1, x: -2, y: ROWS - 5 };
    const events = hardDrop(state);
    expect(events.find((e) => e.type === 'lines').count).toBe(3);
    expect(state.lines).toBe(3);
  });

  it('cada 10 líneas sube el nivel y la gravedad acelera', () => {
    const state = withPiece('I', { board: boardFromRows([filledRow([0]), filledRow([0]), filledRow([0]), filledRow([0])]) });
    state.lines = 8;
    state.active = { type: 'I', rot: 1, x: -2, y: ROWS - 5 };
    const events = hardDrop(state);
    expect(events).toContainEqual({ type: 'levelUp', level: 2 });
    expect(state.level).toBe(2);
    expect(gravityInterval(2)).toBeLessThan(gravityInterval(1));
    expect(gravityInterval(15)).toBeLessThan(0.05);
  });

  it('la caída suave es más rápida y suma 1 punto por casilla', () => {
    const state = withPiece('O');
    tick(state, 0.5, { soft: true });
    expect(state.active.y).toBeGreaterThan(5);
    expect(state.score).toBe(state.active.y - 1);
  });
});

function dropDistanceFor(rows) {
  return rows; // la I vertical cae `rows` filas hasta encajar (ver la prueba)
}

describe('reserva', () => {
  it('guarda una vez por pieza', () => {
    const state = createGame({ seed: 5 });
    const first = state.active.type;
    const next = preview(state, 1)[0];
    hold(state);
    expect(state.hold).toBe(first);
    expect(state.active.type).toBe(next);
    expect(hold(state)).toEqual([]); // segunda vez seguida: no
    hardDrop(state);
    hold(state);
    expect(state.active.type).toBe(first);
  });
});

describe('fin de partida', () => {
  it('termina si la pieza nueva no cabe', () => {
    const rows = Array.from({ length: ROWS - 1 }, (_, i) => (i % 2 ? filledRow([9]) : filledRow([0])));
    const state = createGame({ seed: 1, board: boardFromRows(rows) });
    // El tablero llega hasta arriba: la primera pieza ya no cabe.
    expect(state.over).toBe(true);
  });

  it('termina si una pieza se fija entera por encima del tablero visible', () => {
    const rows = Array.from({ length: ROWS - HIDDEN }, (_, i) => (i % 2 ? filledRow([9]) : filledRow([0])));
    const state = createGame({ seed: 1, board: boardFromRows(rows) });
    expect(state.over).toBe(false);
    const events = hardDrop(state);
    expect(state.over).toBe(true);
    expect(events.some((e) => e.type === 'gameOver')).toBe(true);
    expect(move(state, 1)).toBe(false);
    expect(tick(state, 1)).toEqual([]);
  });

  it('el modo contrarreloj se gana al llegar a 40 líneas', () => {
    const state = withPiece('I', { mode: 'sprint', board: boardFromRows([filledRow([0]), filledRow([0]), filledRow([0]), filledRow([0])]) });
    state.lines = 36;
    state.active = { type: 'I', rot: 1, x: -2, y: ROWS - 5 };
    const events = hardDrop(state);
    expect(events).toContainEqual({ type: 'win' });
    expect(state.won).toBe(true);
    expect(state.active).toBeNull();
  });
});
