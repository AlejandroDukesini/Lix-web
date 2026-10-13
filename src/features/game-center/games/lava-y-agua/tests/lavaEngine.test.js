import { describe, expect, it } from 'vitest';
import { act, cellAt, createGame, flow, parseLevel, solve, starsFor, undo } from '../engine/lavaEngine.js';
import { LEVELS } from '../levels/levels.js';

const level = (rows, extra = {}) => ({ id: 'test', rows, ...extra });
const play = (def, moves) => {
  const g = createGame(def);
  for (const m of moves) act(g, m);
  return g;
};

/** Camino más corto ignorando los líquidos (lo que haría alguien que va «recto»). */
function naivePath(def) {
  const l = parseLevel(def);
  const names = { '1,0': 'right', '-1,0': 'left', '0,1': 'down', '0,-1': 'up' };
  const prev = new Map([[`${l.player.x},${l.player.y}`, null]]);
  const queue = [[l.player.x, l.player.y]];
  while (queue.length) {
    const [x, y] = queue.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      const c = l.grid[ny * l.width + nx];
      if (!c || c === '#' || c === 'L' || /[A-C]/.test(c) || prev.has(`${nx},${ny}`)) continue;
      prev.set(`${nx},${ny}`, [x, y, names[`${dx},${dy}`]]);
      queue.push([nx, ny]);
    }
  }
  const path = [];
  let key = `${l.exit.x},${l.exit.y}`;
  if (!prev.has(key)) return null;
  while (prev.get(key)) {
    const [x, y, m] = prev.get(key);
    path.unshift(m);
    key = `${x},${y}`;
  }
  return path;
}

describe('líquidos', () => {
  it('la lava avanza una casilla en las 4 direcciones por turno y no atraviesa muros', () => {
    const g = createGame(level(['#######', '#.....#', '#..L#.#', '#.....#', '#P...E#', '#######']));
    flow(g);
    expect(cellAt(g, 2, 2)).toBe('L');
    expect(cellAt(g, 3, 1)).toBe('L');
    expect(cellAt(g, 3, 3)).toBe('L');
    expect(cellAt(g, 4, 2)).toBe('#');
    expect(cellAt(g, 2, 1)).toBe('.'); // diagonal: no
  });

  it('lava y agua que se encuentran se vuelven piedra (también en la misma casilla)', () => {
    const touching = createGame(level(['######', '#LW..#', '#P..E#', '######']));
    flow(touching);
    expect(cellAt(touching, 1, 1)).toBe('S');
    expect(cellAt(touching, 2, 1)).toBe('S');
    const meeting = createGame(level(['#######', '#L.W..#', '#P...E#', '#######']));
    flow(meeting);
    expect(cellAt(meeting, 2, 1)).toBe('S');
  });

  it('la piedra bloquea a los dos líquidos', () => {
    const g = createGame(level(['######', '#LS..#', '#P#.E#', '######']));
    for (let i = 0; i < 4; i += 1) flow(g);
    expect(cellAt(g, 3, 1)).toBe('.');
  });

  it('la lava espesa avanza un turno de cada dos', () => {
    const g = createGame(level(['########', '#L.....#', '#P....E#', '########'], { lavaEvery: 2 }));
    act(g, 'wait');
    expect(cellAt(g, 2, 1)).toBe('.');
    act(g, 'wait');
    expect(cellAt(g, 2, 1)).toBe('L');
  });
});

describe('persona', () => {
  const room = level(['#######', '#P.#..#', '#..W..#', '#.L..E#', '#######']);

  it('se mueve por suelo, agua y piedra; no por muros ni lava', () => {
    const g = createGame(room);
    expect(act(g, 'up').ok).toBe(false); // muro
    expect(g.turn).toBe(0); // un movimiento imposible no gasta turno
    expect(act(g, 'right').ok).toBe(true);
    expect(act(g, 'right').ok).toBe(false);
  });

  it('esperar gasta un turno sin moverse', () => {
    const g = createGame(room);
    const { ok, events } = act(g, 'wait');
    expect(ok).toBe(true);
    expect(events[0].type).toBe('wait');
    expect(g.turn).toBe(1);
    expect(g.moves).toBe(0);
    expect(g.player).toEqual({ x: 1, y: 1 });
  });

  it('pierde si la lava la alcanza', () => {
    const g = createGame(level(['######', '#P.L.#', '#....#', '#...E#', '######']));
    act(g, 'right'); // queda junto a la lava, que avanza encima
    expect(g.status).toBe('lost');
    expect(g.cause).toBe('lava');
    expect(act(g, 'down').ok).toBe(false);
  });

  it('pierde si la lava cubre la salida', () => {
    const g = createGame(level(['#######', '#P....#', '#...LE#', '#######']));
    act(g, 'right');
    expect(g.status).toBe('lost');
    expect(g.cause).toBe('exit');
  });

  it('gana al llegar a la salida (antes de que fluya la lava)', () => {
    const g = play(level(['#####', '#PEL#', '#####']), ['right']);
    expect(g.status).toBe('won');
  });

  it('la palanca abre su compuerta para siempre y el agua sale', () => {
    const def = level(['########', '#WA....#', '###a...#', '#P....E#', '########']);
    const g = createGame(def);
    expect(act(g, 'up').ok).toBe(false);
    act(g, 'right');
    act(g, 'right');
    const { events } = act(g, 'up');
    expect(events).toContainEqual({ type: 'switch', id: 'A' });
    expect(cellAt(g, 2, 1)).not.toBe('A');
    act(g, 'wait');
    expect(cellAt(g, 3, 1)).toBe('W');
  });

  it('deshacer recupera el turno anterior, también después de perder', () => {
    const g = createGame(level(['######', '#P.L.#', '#....#', '#...E#', '######']));
    act(g, 'down');
    const snapshot = { grid: [...g.grid], player: { ...g.player }, turn: g.turn };
    act(g, 'right'); // la lava llega a esa casilla
    expect(g.status).toBe('lost');
    expect(undo(g)).toBe(true);
    expect(g.status).toBe('playing');
    expect({ grid: g.grid, player: g.player, turn: g.turn }).toEqual(snapshot);
    expect(undo(g)).toBe(true);
    expect(g.player).toEqual({ x: 1, y: 1 });
    expect(undo(g)).toBe(false);
  });
});

describe('solucionador y estrellas', () => {
  it('encuentra la solución más corta y detecta niveles imposibles', () => {
    expect(solve(level(['#######', '#P...E#', '#######']))).toEqual(['right', 'right', 'right', 'right']);
    expect(solve(level(['#######', '#P.LE.#', '#######']))).toBeNull();
  });

  it('estrellas según los turnos', () => {
    expect(starsFor(9, 9)).toBe(3);
    expect(starsFor(13, 9)).toBe(2);
    expect(starsFor(14, 9)).toBe(1);
  });
});

describe('niveles', () => {
  it('ids únicos y bien formados', () => {
    expect(new Set(LEVELS.map((l) => l.id)).size).toBe(LEVELS.length);
    for (const def of LEVELS) expect(() => parseLevel(def)).not.toThrow();
  });

  it.each(LEVELS.map((l) => [l.name, l]))('«%s» tiene solución con exactamente su par de turnos', (_, def) => {
    const solution = solve(def);
    expect(solution).not.toBeNull();
    expect(solution).toHaveLength(def.par);
    expect(play(def, solution).status).toBe('won');
  });

  it.each(LEVELS.slice(1).map((l) => [l.name, l]))('«%s»: ir recto ignorando los líquidos acaba mal', (_, def) => {
    const path = naivePath(def);
    if (path) expect(play(def, path).status).not.toBe('won');
  });

  it('cada mecánica es necesaria en su grupo de niveles', () => {
    for (const def of LEVELS.filter((l) => l.tier === 'compuerta')) {
      expect(solve({ ...def, rows: def.rows.map((r) => r.replace(/[a-c]/g, '.')) })).toBeNull();
    }
    for (const def of LEVELS.filter((l) => l.tier === 'espesa')) {
      expect(solve({ ...def, lavaEvery: 1 })).toBeNull();
    }
    for (const def of LEVELS.filter((l) => l.tier === 'agua')) {
      const g = createGame(def);
      let onStone = false;
      for (const m of solve(def)) {
        act(g, m);
        if (cellAt(g, g.player.x, g.player.y) === 'S') onStone = true;
      }
      expect(onStone).toBe(true);
    }
  });
});
