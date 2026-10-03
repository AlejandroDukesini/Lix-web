import { describe, expect, it } from 'vitest';
import { FORT_BONUS, PLAYER, createGame, endTurn, generateMap, income, neighborsOf, order, orderError, previewOrder, reinforce, targetsFrom, territoriesOf } from '../engine/frontEngine.js';
import { applyAction, nextAction } from '../engine/frontAI.js';

/** Estado mínimo a medida: territorios en línea 0,0 – 1,0 – 2,0 … */
function lineGame(cells, { current = PLAYER } = {}) {
  const map = {};
  cells.forEach(([owner, troops, kind = 'plain'], i) => {
    const key = `${i},0`;
    map[key] = { key, owner, troops, kind };
  });
  return { map, factions: [PLAYER, 'a1'], difficulty: 'normal', turn: 1, current, phase: 'orders', reinforcements: 0, acted: [], status: 'playing', log: [], seed: 1 };
}

describe('mapa', () => {
  it('genera una isla conexa con capitales lejanas, ciudades y fortalezas', () => {
    for (const seed of [1, 2, 3]) {
      const map = generateMap({ radius: 4, rivals: 2, seed });
      const keys = Object.keys(map);
      const seen = new Set([keys[0]]);
      const stack = [keys[0]];
      while (stack.length) for (const n of neighborsOf(map, stack.pop())) if (!seen.has(n)) seen.add(n) && stack.push(n);
      expect(seen.size).toBe(keys.length);
      const capitals = Object.values(map).filter((t) => t.capital);
      expect(capitals.map((t) => t.owner).sort()).toEqual(['a1', 'a2', 'p']);
      expect(Object.values(map).some((t) => t.kind === 'fort')).toBe(true);
      expect(Object.values(map).filter((t) => t.kind === 'city').length).toBeGreaterThanOrEqual(5);
    }
  });

  it('todos los bandos empiezan igual: capital y tres territorios', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      for (const [radius, rivals] of [[3, 1], [4, 2], [5, 3]]) {
        const map = generateMap({ radius, rivals, seed });
        const owners = ['p', 'a1', 'a2', 'a3'].slice(0, rivals + 1);
        for (const owner of owners) {
          const own = Object.values(map).filter((t) => t.owner === owner);
          expect(own.length, `${seed} r${radius} ${owner}`).toBe(4);
          expect(own.reduce((sum, t) => sum + t.troops, 0)).toBe(5 + 3 * 2);
        }
      }
    }
  });

  it('es determinista con la misma semilla', () => {
    expect(generateMap({ seed: 9 })).toEqual(generateMap({ seed: 9 }));
  });
});

describe('refuerzos', () => {
  it('ingreso: territorios/3 (mínimo 3) + 2 por ciudad', () => {
    const state = lineGame([[PLAYER, 3, 'city'], [PLAYER, 1], [PLAYER, 1], ['a1', 1]]);
    expect(income(state, PLAYER)).toBe(3 + 2);
  });

  it('solo en territorios propios y sin pasarse; al acabar empiezan las órdenes', () => {
    const state = { ...lineGame([[PLAYER, 3], ['a1', 2]]), phase: 'reinforce', reinforcements: 3 };
    expect(reinforce(state, '1,0', 1)).toBeNull();
    expect(reinforce(state, '0,0', 4)).toBeNull();
    let s = reinforce(state, '0,0', 2);
    expect(s.map['0,0'].troops).toBe(5);
    expect(s.phase).toBe('reinforce');
    s = reinforce(s, '0,0', 1);
    expect(s.phase).toBe('orders');
  });
});

describe('órdenes y combate', () => {
  it('se conquista enviando más tropas que la defensa; sobreviven las que sobran', () => {
    const state = lineGame([[PLAYER, 6], [null, 3]]);
    expect(previewOrder(state, '0,0', '1,0', 5)).toMatchObject({ type: 'capture', survivors: 2 });
    const { state: s } = order(state, '0,0', '1,0', 5);
    expect(s.map['1,0']).toMatchObject({ owner: PLAYER, troops: 2 });
    expect(s.map['0,0'].troops).toBe(1);
  });

  it('un ataque insuficiente se repele: se pierden las enviadas y el defensor pierde algunas', () => {
    const state = lineGame([[PLAYER, 4], ['a1', 4]]);
    const { state: s, result } = order(state, '0,0', '1,0', 3);
    expect(result.type).toBe('repelled');
    expect(s.map['1,0']).toMatchObject({ owner: 'a1', troops: 1 });
    expect(s.map['0,0'].troops).toBe(1);
  });

  it(`las fortalezas defienden ×${FORT_BONUS}`, () => {
    const state = lineGame([[PLAYER, 6], [null, 3, 'fort']]);
    expect(previewOrder(state, '0,0', '1,0', 4).type).toBe('repelled');
    expect(previewOrder(state, '0,0', '1,0', 5)).toMatchObject({ type: 'capture', survivors: 0 + 1 });
  });

  it('mover entre territorios propios suma tropas', () => {
    const state = lineGame([[PLAYER, 5], [PLAYER, 1], ['a1', 1]]);
    const { state: s } = order(state, '0,0', '1,0', 3);
    expect(s.map['1,0'].troops).toBe(4);
  });

  it('reglas de legalidad: vecinos, propio, al menos una tropa, una vez por turno', () => {
    const state = lineGame([[PLAYER, 5], ['a1', 1], [PLAYER, 3], ['a1', 2]]);
    expect(orderError(state, '0,0', '2,0', 1)).toMatch(/vecinos/);
    expect(orderError(state, '1,0', '0,0', 1)).toMatch(/no es tuyo/);
    expect(orderError(state, '0,0', '1,0', 5)).toMatch(/Cantidad/);
    const { state: s } = order(state, '0,0', '1,0', 2);
    expect(orderError(s, '0,0', '1,0', 1)).toMatch(/ya actuó/);
    // El territorio conquistado tampoco actúa en este turno.
    expect(targetsFrom(s, '1,0')).toEqual([]);
  });

  it('victoria al eliminar al rival y derrota al perderlo todo', () => {
    const win = order(lineGame([[PLAYER, 5], ['a1', 1]]), '0,0', '1,0', 4).state;
    expect(win.status).toBe('won');
    const lose = order(lineGame([['a1', 5], [PLAYER, 1]], { current: 'a1' }), '0,0', '1,0', 4).state;
    expect(lose.status).toBe('lost');
  });

  it('terminar el turno pasa al siguiente bando con sus refuerzos', () => {
    const state = createGame({ radius: 3, rivals: 1, seed: 2 });
    const s = endTurn({ ...state, phase: 'orders', reinforcements: 0 });
    expect(s.current).toBe('a1');
    expect(s.phase).toBe('reinforce');
    expect(s.reinforcements).toBe(income(s, 'a1'));
    expect(endTurn({ ...s, phase: 'orders' }).turn).toBe(2);
  });
});

/** Juega una partida completa con IA en todos los bandos (`playerLevel` controla a «p»). */
function playOut({ playerLevel, rivalLevel, seed, rivals = 1, radius = 3, maxTurns = 70 }) {
  let state = createGame({ radius, rivals, difficulty: rivalLevel, seed });
  let actions = 0;
  while (state.status === 'playing' && state.turn <= maxTurns) {
    const level = state.current === PLAYER ? playerLevel : rivalLevel;
    const action = nextAction({ ...state, difficulty: level });
    if (action?.type === 'order') expect(orderError(state, action.from, action.to, action.k)).toBeNull();
    const { state: next, done } = applyAction(state, action);
    state = done ? endTurn(next) : next;
    actions += 1;
    if (actions > 20_000) break;
  }
  return state;
}

describe('IA local', () => {
  it('solo hace jugadas legales en todos los niveles (también entre iguales)', () => {
    // playOut comprueba la legalidad de cada orden; entre dos IA iguales una partida
    // puede alargarse (como entre dos personas igual de prudentes), así que aquí no se exige final.
    for (const seed of [1, 2, 3]) for (const level of ['facil', 'normal', 'dificil']) playOut({ playerLevel: level, rivalLevel: level, seed, maxTurns: 30 });
  });

  it('tiene objetivos claros: ante una persona que no hace nada, se expande y la vence', () => {
    for (const level of ['facil', 'normal', 'dificil']) {
      for (const seed of [1, 2, 3]) {
        const neutralOf = (st) => Object.values(st.map).filter((t) => t.owner === null).length;
        let state = createGame({ radius: 3, rivals: 1, difficulty: level, seed });
        const start = neutralOf(state);
        let midNeutral = null;
        while (state.status === 'playing' && state.turn <= 60) {
          // La persona solo coloca sus refuerzos y pasa el turno.
          const action = state.current === PLAYER ? (state.phase === 'reinforce' ? { type: 'reinforce', key: territoriesOf(state, PLAYER)[0].key, n: state.reinforcements } : null) : nextAction(state);
          const { state: next, done } = applyAction(state, action);
          state = done ? endTurn(next) : next;
          if (state.turn === 15 && midNeutral === null) midNeutral = neutralOf(state);
        }
        // Si ganó antes del turno 15, cuenta el mapa final (ya se expandió).
        midNeutral ??= neutralOf(state);
        // Difícil guarda reservas ante la gran pila de la persona: se expande algo más despacio, pero se expande.
        expect(midNeutral, `${level} ${seed}`).toBeLessThan(start * 0.8);
        expect(state.status, `${level} ${seed}`).toBe('lost');
      }
    }
  });

  it('las partidas entre niveles distintos terminan con un ganador', () => {
    let finished = 0;
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      if (playOut({ playerLevel: 'dificil', rivalLevel: 'facil', seed }).status !== 'playing') finished += 1;
      if (playOut({ playerLevel: 'facil', rivalLevel: 'normal', seed }).status !== 'playing') finished += 1;
    }
    expect(finished).toBeGreaterThanOrEqual(11);
  });

  it('la dificultad cambia de verdad: Normal y Difícil ganan a Fácil casi siempre', () => {
    const seeds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const wins = (playerLevel, rivalLevel) => seeds.filter((seed) => playOut({ playerLevel, rivalLevel, seed }).status === 'won').length;
    expect(wins('normal', 'facil')).toBeGreaterThanOrEqual(8);
    expect(wins('dificil', 'facil')).toBeGreaterThanOrEqual(8);
    // Y en el otro sentido, Fácil pierde contra ellas.
    expect(wins('facil', 'dificil')).toBeLessThanOrEqual(2);
  });

  it('Fácil no ataca a la persona en los tres primeros turnos', () => {
    let state = createGame({ radius: 3, rivals: 1, difficulty: 'facil', seed: 4 });
    while (state.turn <= 3) {
      const action = nextAction(state);
      if (state.current === 'a1' && action?.type === 'order') expect(state.map[action.to].owner).not.toBe(PLAYER);
      const { state: next, done } = applyAction(state, action);
      state = done ? endTurn(next) : next;
    }
    expect(territoriesOf(state, PLAYER).length).toBeGreaterThan(0);
  });
});
