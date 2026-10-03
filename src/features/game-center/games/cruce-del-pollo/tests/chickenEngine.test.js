import { describe, expect, it } from 'vitest';
import {
  COLS,
  HIT_MARGIN,
  MAX_STREAK,
  ROUNDS,
  ROUND_BONUS,
  START_COL,
  canHop,
  cloneRun,
  createRun,
  requestHop,
  roundConfig,
  step,
} from '../engine/chickenEngine.js';

const DT = 1 / 60;
const run = (state, seconds) => {
  const events = [];
  for (let t = 0; t < seconds; t += DT) events.push(...step(state, DT));
  return events;
};
const hop = (state, direction) => {
  requestHop(state, direction);
  return run(state, 0.2);
};

/** Un mundo de pruebas con las filas indicadas (el resto, hierba). */
function worldWith(rows) {
  const state = createRun(7);
  state.rows = [{ type: 'grass', dir: 0, speed: 0, loop: COLS, items: [], flowers: [] }, ...rows];
  state.rows.push({ type: 'goal', dir: 0, speed: 0, loop: COLS, items: [], round: 1 });
  return state;
}

describe('movimiento', () => {
  it('salta en las cuatro direcciones, de casilla en casilla', () => {
    const state = worldWith([{ type: 'grass', dir: 0, speed: 0, loop: COLS, items: [], flowers: [] }]);
    hop(state, 'up');
    expect(state.chicken).toMatchObject({ row: 1, x: START_COL });
    hop(state, 'left');
    expect(state.chicken.x).toBe(START_COL - 1);
    hop(state, 'right');
    hop(state, 'right');
    expect(state.chicken.x).toBe(START_COL + 1);
    hop(state, 'down');
    expect(state.chicken.row).toBe(0);
  });

  it('no sale del borde ni retrocede por debajo del inicio de la ronda', () => {
    const state = createRun(3);
    expect(canHop(state, 'down')).toBe(false);
    state.chicken.x = 0;
    expect(canHop(state, 'left')).toBe(false);
    state.chicken.x = COLS - 1;
    expect(canHop(state, 'right')).toBe(false);
  });

  it('un salto pedido en pleno salto se encadena una sola vez (sin dobles)', () => {
    const state = worldWith([1, 2, 3].map(() => ({ type: 'grass', dir: 0, speed: 0, loop: COLS, items: [], flowers: [] })));
    requestHop(state, 'up');
    requestHop(state, 'up');
    requestHop(state, 'up');
    run(state, 0.5);
    expect(state.chicken.row).toBe(2);
  });

  it('puntúa cada fila nueva una sola vez', () => {
    const state = worldWith([1, 2].map(() => ({ type: 'grass', dir: 0, speed: 0, loop: COLS, items: [], flowers: [] })));
    hop(state, 'up');
    hop(state, 'down');
    hop(state, 'up');
    hop(state, 'up');
    expect(state.score).toBe(2);
  });
});

describe('colisiones', () => {
  const road = (x, len = 1.3) => ({ type: 'road', dir: 1, speed: 0, loop: 30, items: [{ kind: 'car', x, len }] });

  it('un coche en la casilla de llegada atropella a la gallina', () => {
    const state = worldWith([road(START_COL)]);
    const events = hop(state, 'up');
    expect(state.status).toBe('dead');
    expect(events).toContainEqual({ type: 'dead', cause: 'car' });
  });

  it('un roce con la esquina no cuenta: la caja de choque es más estrecha que la casilla', () => {
    const state = worldWith([road(START_COL + 1 - HIT_MARGIN + 0.01)]);
    hop(state, 'up');
    expect(state.status).toBe('playing');
  });

  it('los coches avanzan y atropellan aunque la gallina esté quieta', () => {
    const state = worldWith([{ type: 'road', dir: 1, speed: 3, loop: 30, items: [{ kind: 'car', x: 0, len: 1.3 }] }]);
    hop(state, 'up');
    expect(state.status).toBe('playing');
    run(state, 2);
    expect(state.cause).toBe('car');
  });

  it('en el río hay que caer sobre un tronco; el tronco la arrastra', () => {
    const river = (x) => ({ type: 'river', dir: 1, speed: 1, loop: 30, items: [{ kind: 'log', x, len: 3 }] });
    const wet = worldWith([river(START_COL + 3)]);
    hop(wet, 'up');
    expect(wet.cause).toBe('water');

    const dry = worldWith([river(START_COL - 1)]);
    hop(dry, 'up');
    expect(dry.status).toBe('playing');
    const before = dry.chicken.x;
    run(dry, 0.5);
    expect(dry.chicken.x).toBeGreaterThan(before + 0.4);
  });

  it('si el tronco la saca de la pantalla, la corriente se la lleva', () => {
    const state = worldWith([{ type: 'river', dir: 1, speed: 2, loop: 40, items: [{ kind: 'log', x: START_COL - 1, len: 20 }] }]);
    hop(state, 'up');
    run(state, 4);
    expect(state.cause).toBe('current');
  });
});

describe('rondas y dificultad', () => {
  it('la dificultad crece: más carriles, más velocidad y río desde la ronda 3', () => {
    const configs = Array.from({ length: ROUNDS }, (_, i) => roundConfig(i + 1));
    for (let i = 1; i < configs.length; i += 1) {
      expect(configs[i].speed).toBeGreaterThan(configs[i - 1].speed);
      expect(configs[i].lanes).toBeGreaterThanOrEqual(configs[i - 1].lanes);
    }
    expect(configs[1].rivers).toBe(0);
    expect(configs[2].rivers).toBeGreaterThan(0);
  });

  it('llegar al nido supera la ronda, da bonificación y genera la siguiente', () => {
    const state = worldWith([]);
    const events = hop(state, 'up');
    expect(events).toContainEqual({ type: 'round', round: 1 });
    expect(state.round).toBe(2);
    expect(state.score).toBe(1 + ROUND_BONUS);
    expect(state.rows.at(-1)).toMatchObject({ type: 'goal', round: 2 });
  });

  it('los huecos entre coches dan tiempo a cruzar en todas las rondas', () => {
    for (let seed = 1; seed <= 30; seed += 1) {
      const state = createRun(seed);
      for (let round = 1; round <= ROUNDS; round += 1) {
        for (const row of state.rows.filter((r) => r.type === 'road')) {
          const cars = [...row.items].sort((a, b) => a.x - b.x);
          // Incluye el hueco de la vuelta: el primero reaparece `loop` casillas después.
          const ring = [...cars, { ...cars[0], x: cars[0].x + row.loop }];
          for (let i = 1; i < ring.length; i += 1) {
            const gap = ring[i].x - (ring[i - 1].x + ring[i - 1].len);
            // Hueco libre en el tiempo: más que un salto con su caja de choque.
            expect(gap / row.speed).toBeGreaterThan(0.6);
          }
        }
        // Forzar la ronda siguiente para inspeccionarla.
        state.chicken.row = state.rows.length - 1;
        state.chicken.hop = null;
        step(state, 0);
      }
    }
  });
});

/**
 * Piloto automático que juega como una persona prudente: solo sale de una zona
 * segura (hierba o nido) cuando encuentra, simulando el motor real, una secuencia
 * de «avanzar / esperar» que le lleva viva hasta la siguiente zona segura. Como
 * el motor es determinista, ese plan es una prueba de que el cruce es posible.
 * Si desde su casilla no hay plan, espera o se desplaza por la hierba.
 */
const SAFE = new Set(['grass', 'goal']);
function settle(s, action) {
  if (action === 'wait') return run(s, 0.12);
  if (!canHop(s, action)) return null;
  requestHop(s, action);
  return run(s, 0.17);
}
function planDash(state, depth = 10) {
  const startRow = state.chicken.row;
  const search = (s, d, plan) => {
    if (s.status === 'dead') return null;
    if (s.status === 'won') return plan;
    if (s.chicken.row > startRow && SAFE.has(s.rows[s.chicken.row].type)) return plan;
    if (d === 0) return null;
    for (const action of ['up', 'wait']) {
      const copy = cloneRun(s);
      if (settle(copy, action) === null) continue;
      const found = search(copy, d - 1, [...plan, action]);
      if (found) return found;
    }
    return null;
  };
  return search(state, depth, []);
}
function autopilot(state, maxSeconds = 900) {
  let drift = 1;
  let waited = 0;
  while (state.status === 'playing' && state.time < maxSeconds) {
    const plan = planDash(state);
    if (plan) {
      for (const action of plan) settle(state, action);
      waited = 0;
      continue;
    }
    // Sin plan desde aquí: esperar un poco y, de vez en cuando, cambiar de casilla en la hierba.
    waited += 1;
    if (waited % 8 === 0) {
      if (!canHop(state, drift > 0 ? 'right' : 'left')) drift = -drift;
      settle(state, drift > 0 ? 'right' : 'left');
    } else settle(state, 'wait');
  }
  return state;
}

describe('rondas superables', () => {
  it('un piloto automático supera las diez rondas con varias semillas', { timeout: 300_000 }, () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const state = autopilot(createRun(seed));
      expect({ seed, status: state.status, round: state.round, cause: state.cause }).toMatchObject({ seed, status: 'won' });
      // Ninguna zona de peligro tiene más de MAX_STREAK carriles seguidos.
      let streak = 0;
      for (const row of state.rows) {
        streak = SAFE.has(row.type) ? 0 : streak + 1;
        expect(streak).toBeLessThanOrEqual(MAX_STREAK);
      }
    }
  });
});
