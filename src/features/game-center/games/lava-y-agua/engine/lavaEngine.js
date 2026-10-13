/**
 * Motor de «Lava y Agua»: rompecabezas por turnos en cuadrícula. Sin DOM y
 * determinista (el mismo movimiento da siempre el mismo resultado), así un
 * solucionador puede demostrar cada nivel y las pruebas reproducirlo.
 *
 * Cada turno: la persona se mueve una casilla (o espera) y después los
 * líquidos avanzan una casilla en las 4 direcciones:
 *   - la lava se extiende por el suelo; si alcanza a la persona, se pierde;
 *     si cubre la salida, ya no se puede escapar;
 *   - el agua se extiende igual y no hace daño (se puede pisar);
 *   - donde lava y agua se encuentran, ambas se convierten en piedra, que
 *     bloquea a los dos líquidos y se puede pisar.
 * Las compuertas cerradas frenan los líquidos y a la persona; pisar su
 * palanca las abre para siempre (y el agua o la lava que retenían sale).
 * Algunos niveles tienen lava lenta: avanza un turno de cada `lavaEvery`.
 *
 * NIVELES (ASCII):
 *   #  muro        .  suelo        P  salida de la persona     E  salida del nivel
 *   L  lava        W  agua         S  piedra
 *   a b c  palancas          A B C  compuertas que abre cada palanca
 */

export const DIRS = Object.freeze({ up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0], wait: [0, 0] });
export const MOVES = Object.freeze(['up', 'down', 'left', 'right', 'wait']);

const FLOWABLE = new Set(['.']);

export function parseLevel(def) {
  const width = Math.max(...def.rows.map((r) => r.length));
  const grid = [];
  let player = null;
  let exit = null;
  const switches = [];
  def.rows.forEach((row, y) => {
    [...row.padEnd(width, '#')].forEach((ch, x) => {
      let cell = ch;
      if (ch === 'P') {
        if (player) throw new Error(`${def.id}: más de una salida de la persona`);
        player = { x, y };
        cell = '.';
      } else if (ch === 'E') {
        exit = { x, y };
        cell = '.';
      } else if (/[a-c]/.test(ch)) {
        switches.push({ x, y, id: ch.toUpperCase() });
        cell = '.';
      } else if (!/[#.LWSA-C]/.test(ch)) {
        throw new Error(`${def.id}: carácter desconocido «${ch}»`);
      }
      grid.push(cell);
    });
  });
  if (!player) throw new Error(`${def.id}: falta P`);
  if (!exit) throw new Error(`${def.id}: falta E`);
  return { id: def.id, width, height: def.rows.length, grid, player, exit, switches, lavaEvery: def.lavaEvery ?? 1 };
}

export function createGame(levelOrDef) {
  const level = levelOrDef.grid ? levelOrDef : parseLevel(levelOrDef);
  return {
    level,
    grid: [...level.grid],
    player: { ...level.player },
    pressed: level.switches.map(() => false),
    turn: 0,
    moves: 0,
    status: 'playing', // playing | won | lost
    cause: null, // 'lava' | 'exit'
    history: [],
  };
}

const idx = (state, x, y) => y * state.level.width + x;
export const cellAt = (state, x, y) =>
  x < 0 || y < 0 || x >= state.level.width || y >= state.level.height ? '#' : state.grid[idx(state, x, y)];

/** ¿Puede la persona entrar en (x, y)? */
export function canEnter(state, x, y) {
  const c = cellAt(state, x, y);
  return c === '.' || c === 'W' || c === 'S';
}

/** Avance de los líquidos (un turno). Devuelve las casillas que cambiaron. */
export function flow(state) {
  const { width, height } = state.level;
  const lavaMoves = (state.turn + 1) % state.level.lavaEvery === 0;
  const lavaTo = new Set();
  const waterTo = new Set();
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const c = state.grid[y * width + x];
      if (c !== 'L' && c !== 'W') continue;
      if (c === 'L' && !lavaMoves) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const n = state.grid[ny * width + nx];
        const target = c === 'L' ? lavaTo : waterTo;
        if (FLOWABLE.has(n) || (c === 'L' && n === 'W') || (c === 'W' && n === 'L')) target.add(ny * width + nx);
      }
    }
  }
  const changed = [];
  const set = (i, v) => {
    if (state.grid[i] !== v) {
      state.grid[i] = v;
      changed.push({ i, v });
    }
  };
  for (const i of new Set([...lavaTo, ...waterTo])) {
    const c = state.grid[i];
    const l = lavaTo.has(i);
    const w = waterTo.has(i);
    if ((c === 'W' && l) || (c === 'L' && w) || (l && w)) set(i, 'S');
    else if (l) set(i, 'L');
    else if (w) set(i, 'W');
  }
  return changed;
}

function snapshot(state) {
  return { grid: [...state.grid], player: { ...state.player }, pressed: [...state.pressed], turn: state.turn, moves: state.moves };
}

/**
 * Un turno: mover (o esperar) y que fluyan los líquidos.
 * Devuelve { ok, events } — ok false si el movimiento no es posible (no gasta turno).
 */
export function act(state, move, { record = true } = {}) {
  if (state.status !== 'playing') return { ok: false, events: [] };
  const [dx, dy] = DIRS[move] ?? [0, 0];
  const nx = state.player.x + dx;
  const ny = state.player.y + dy;
  if (move !== 'wait' && !canEnter(state, nx, ny)) return { ok: false, events: [{ type: 'blocked' }] };
  if (record) state.history.push(snapshot(state));
  const events = [];
  state.player = { x: nx, y: ny };
  if (move !== 'wait') state.moves += 1;
  events.push({ type: move === 'wait' ? 'wait' : 'step' });

  state.level.switches.forEach((sw, i) => {
    if (!state.pressed[i] && sw.x === nx && sw.y === ny) {
      state.pressed[i] = true;
      for (let j = 0; j < state.grid.length; j += 1) if (state.grid[j] === sw.id) state.grid[j] = '.';
      events.push({ type: 'switch', id: sw.id });
    }
  });

  if (nx === state.level.exit.x && ny === state.level.exit.y) {
    state.turn += 1;
    state.status = 'won';
    events.push({ type: 'win' });
    return { ok: true, events };
  }

  const changed = flow(state);
  state.turn += 1;
  if (changed.some((c) => c.v === 'S')) events.push({ type: 'stone' });
  if (cellAt(state, nx, ny) === 'L') {
    state.status = 'lost';
    state.cause = 'lava';
    events.push({ type: 'lose', cause: 'lava' });
  } else if (cellAt(state, state.level.exit.x, state.level.exit.y) === 'L') {
    state.status = 'lost';
    state.cause = 'exit';
    events.push({ type: 'lose', cause: 'exit' });
  }
  return { ok: true, events };
}

/** Deshacer el último turno (también tras perder). */
export function undo(state) {
  const prev = state.history.pop();
  if (!prev) return false;
  Object.assign(state, { ...prev, grid: prev.grid, player: prev.player, pressed: prev.pressed, status: 'playing', cause: null });
  return true;
}

const keyOf = (state) => `${state.player.x},${state.player.y}|${state.turn % state.level.lavaEvery}|${state.grid.join('')}`;

/**
 * Búsqueda en anchura: la secuencia más corta de turnos (incluidas las esperas)
 * que lleva a la salida, o null si no existe dentro de `maxTurns`.
 */
export function solve(levelOrDef, { maxTurns = 80, maxStates = 400_000 } = {}) {
  const start = createGame(levelOrDef);
  const seen = new Set([keyOf(start)]);
  let frontier = [{ state: start, path: [] }];
  for (let depth = 0; depth < maxTurns && frontier.length; depth += 1) {
    const next = [];
    for (const { state, path } of frontier) {
      for (const move of MOVES) {
        const copy = { ...state, grid: [...state.grid], player: { ...state.player }, pressed: [...state.pressed], history: [] };
        const { ok } = act(copy, move, { record: false });
        if (!ok || copy.status === 'lost') continue;
        if (copy.status === 'won') return [...path, move];
        const key = keyOf(copy);
        if (seen.has(key)) continue;
        seen.add(key);
        if (seen.size > maxStates) return null;
        next.push({ state: copy, path: [...path, move] });
      }
    }
    frontier = next;
  }
  return null;
}

/** Estrellas: 3 con la solución más corta (en turnos), 2 con hasta 4 turnos más, 1 al superar el nivel. */
export function starsFor(turns, par) {
  if (turns <= par) return 3;
  if (turns <= par + 4) return 2;
  return 1;
}
