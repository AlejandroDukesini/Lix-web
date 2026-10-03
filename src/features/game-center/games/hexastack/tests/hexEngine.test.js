import { describe, expect, it } from 'vitest';
import { CLEAR_SIZE, HAND_SIZE, boardCells, createGame, emptyCells, keyOf, neighborsOf, place, topColor, topRun } from '../engine/hexEngine.js';
import { CHALLENGES, FREE_PLAY } from '../levels/levels.js';

/** Partida con tablero y mano a medida (para probar reglas concretas). */
function custom({ board = {}, hand = [[0, 0]], radius = 2, target = null } = {}) {
  const state = createGame({ radius, colors: 3, target }, 1);
  for (const key of Object.keys(state.board)) state.board[key] = board[key] ?? [];
  state.hand = hand;
  return state;
}

describe('tablero y colocación', () => {
  it('un tablero de radio 2 tiene 19 celdas y uno de radio 3, 37 (menos las bloqueadas)', () => {
    expect(boardCells(2)).toHaveLength(19);
    expect(boardCells(3)).toHaveLength(37);
    expect(boardCells(3, ['0,0'])).toHaveLength(36);
  });

  it('cada celda interior tiene seis vecinas; las del borde, menos', () => {
    const state = custom();
    expect(neighborsOf(state, '0,0')).toHaveLength(6);
    expect(neighborsOf(state, '2,0').length).toBeLessThan(6);
  });

  it('solo se coloca en celdas vacías y existentes, con una pila de la mano', () => {
    const state = custom({ board: { '0,0': [1] } });
    expect(place(state, 0, '0,0')).toBeNull();
    expect(place(state, 0, '9,9')).toBeNull();
    expect(place(state, 5, '1,0')).toBeNull();
    const { state: next, events } = place(state, 0, '1,0');
    expect(next.board['1,0']).toEqual([0, 0]);
    expect(events[0]).toEqual({ type: 'place', key: '1,0', tiles: 2 });
    expect(next.score).toBe(2);
  });

  it('al gastar la mano llegan tres pilas nuevas', () => {
    const state = custom({ hand: [[0]] });
    const { state: next, events } = place(state, 0, '0,0');
    expect(next.hand).toHaveLength(HAND_SIZE);
    expect(events).toContainEqual({ type: 'deal' });
  });
});

describe('fusiones y despejes', () => {
  it('las vecinas con el mismo color arriba pasan sus fichas de arriba (las de debajo se quedan)', () => {
    const state = custom({ board: { '1,0': [2, 0, 0], '-1,0': [1] }, hand: [[1, 0]] });
    const { state: next } = place(state, 0, '0,0');
    expect(next.board['0,0']).toEqual([1, 0, 0, 0]);
    expect(next.board['1,0']).toEqual([2]);
    expect(next.board['-1,0']).toEqual([1]); // su color de arriba no coincidía
    expect(topRun(next.board['0,0'])).toBe(3);
  });

  it(`${CLEAR_SIZE} fichas del mismo color arriba se despejan y puntúan`, () => {
    const state = custom({ board: { '1,0': [2, 0, 0, 0, 0, 0, 0], '-1,0': [0, 0] }, hand: [[0, 0]] });
    const { state: next, events } = place(state, 0, '0,0');
    expect(events).toContainEqual(expect.objectContaining({ type: 'clear', tiles: CLEAR_SIZE, chain: 1 }));
    expect(next.board['0,0']).toEqual([]);
    expect(next.board['1,0']).toEqual([2]);
    expect(next.cleared).toBe(CLEAR_SIZE);
    // 2 por colocar + 10 × 10 × cadena 1.
    expect(next.score).toBe(2 + CLEAR_SIZE * 10);
  });

  it('las reacciones en cadena multiplican: el segundo despeje vale ×2', () => {
    // Al despejar el 0 de la celda central queda un 1 arriba, que atrae a dos vecinas con 1 y llega a 10.
    const state = custom({
      board: { '1,0': [0, 0, 0, 0, 0], '-1,0': [0, 0, 0], '0,1': [1, 1, 1, 1, 1], '0,-1': [1, 1, 1, 1] },
      hand: [[1, 0, 0]],
    });
    const { state: next, events } = place(state, 0, '0,0');
    const clears = events.filter((e) => e.type === 'clear');
    expect(clears.map((e) => e.chain)).toEqual([1, 2]);
    expect(next.cleared).toBe(20);
    expect(next.score).toBe(3 + 100 * 1 + 100 * 2);
  });

  it('la racha sube con jugadas que despejan y se reinicia con una que no', () => {
    let state = custom({ board: { '1,0': [0, 0, 0, 0, 0, 0, 0, 0] }, hand: [[0, 0], [1], [2]] });
    state = place(state, 0, '0,0').state;
    expect(state.streak).toBe(1);
    state = place(state, 0, '2,-2').state;
    expect(state.streak).toBe(0);
    expect(state.bestStreak).toBe(1);
  });
});

describe('fin de partida y objetivos', () => {
  it('termina cuando no queda ninguna celda vacía', () => {
    const board = Object.fromEntries(boardCells(2).map((k, i) => [k, [i % 3]]));
    const free = keyOf(0, 0);
    board[free] = [];
    // La pila que se coloca no coincide con ninguna vecina: el tablero se llena.
    const state = custom({ board, hand: [[4]] });
    const { state: next, events } = place(state, 0, free);
    expect(emptyCells(next)).toHaveLength(0);
    expect(next.status).toBe('over');
    expect(events.at(-1)).toEqual({ type: 'over' });
    expect(place(next, 0, free)).toBeNull();
  });

  it('en un desafío se gana al despejar el objetivo', () => {
    const state = custom({ board: { '1,0': [0, 0, 0, 0, 0, 0, 0, 0] }, hand: [[0, 0]], target: 10 });
    expect(place(state, 0, '0,0').state.status).toBe('won');
  });

  it('la mano nunca trae una pila que se despeje sola y favorece colores que ya están en juego', () => {
    let present = 0;
    let total = 0;
    for (let seed = 1; seed <= 40; seed += 1) {
      const state = createGame(FREE_PLAY, seed);
      const tops = new Set(Object.values(state.board).map(topColor).filter((c) => c !== null));
      for (const stack of state.hand) {
        expect(stack.length).toBeLessThan(CLEAR_SIZE);
        total += 1;
        if (tops.has(topColor(stack))) present += 1;
      }
    }
    expect(present / total).toBeGreaterThan(0.4);
  });
});

/** Piloto automático voraz: elige la jugada que más despeja; si no, la que más fusiona. */
function autopilot(state, maxMoves = 600) {
  let s = state;
  while (s.status === 'playing' && s.moves < maxMoves) {
    let best = null;
    for (let h = 0; h < s.hand.length; h += 1) {
      for (const key of emptyCells(s)) {
        const outcome = place(s, h, key);
        const merged = outcome.events.filter((e) => e.type === 'merge').reduce((n, e) => n + e.tiles, 0);
        const value = (outcome.state.cleared - s.cleared) * 100 + merged * 3 + emptyCells(outcome.state).length;
        if (!best || value > best.value) best = { value, next: outcome.state };
      }
    }
    s = best.next;
  }
  return s;
}

describe('desafíos alcanzables', () => {
  it('ocho desafíos con objetivo creciente', () => {
    expect(CHALLENGES).toHaveLength(8);
    for (let i = 1; i < CHALLENGES.length; i += 1) expect(CHALLENGES[i].target).toBeGreaterThanOrEqual(CHALLENGES[i - 1].target - 20);
  });

  it.each(CHALLENGES.map((c) => [c.name, c]))('«%s»: un piloto automático sencillo lo supera en la mayoría de partidas', { timeout: 60_000 }, (_, challenge) => {
    const seeds = [1, 2, 3, 4, 5, 6, 7, 8];
    const wins = seeds.filter((seed) => autopilot(createGame(challenge, seed)).status === 'won').length;
    expect(wins).toBeGreaterThanOrEqual(5);
  });
});
