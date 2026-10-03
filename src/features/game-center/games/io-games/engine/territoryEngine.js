/**
 * Territorio — control de espacio en una cuadrícula.
 *
 * Cada jugador avanza celda a celda. Fuera de su territorio deja un rastro;
 * al volver a casa, el rastro y todo lo que encierra pasan a ser suyos.
 *  - Pisar tu propio rastro, o salir del mapa, te elimina.
 *  - Si cruzas el rastro de otro mientras está fuera, lo eliminas.
 * Los rivales son bots del juego que dibujan bucles cortos y vuelven a casa
 * en cuanto ven peligro.
 *
 * Victoria: dominar WIN_SHARE del mapa. Fin: ser eliminado o agotar el tiempo.
 */
import { createRng } from '../../../services/gameLifecycle.js';

export const SIZE = 40;
export const TICK = 0.12; // s por celda
export const WIN_SHARE = 0.4;
export const TIME_LIMIT = 150; // s
const BOT_RESPAWN = 3;
const HOME = 2; // radio del territorio inicial (5×5)

export const DIRS = Object.freeze({
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
});
const DIR_LIST = ['up', 'right', 'down', 'left'];
const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' };

export const PLAYER_ID = 1;
const BOTS = [
  { name: 'Bot Ámbar', color: '#ffb703' },
  { name: 'Bot Menta', color: '#2ec4b6' },
  { name: 'Bot Ciruela', color: '#9d4edd' },
];

const idx = (x, y) => y * SIZE + x;
const inside = (x, y) => x >= 0 && y >= 0 && x < SIZE && y < SIZE;

function claimHome(state, actor) {
  for (let y = actor.y - HOME; y <= actor.y + HOME; y += 1) {
    for (let x = actor.x - HOME; x <= actor.x + HOME; x += 1) if (inside(x, y)) state.owner[idx(x, y)] = actor.id;
  }
}

function freeHomeSpot(state) {
  for (let tries = 0; tries < 200; tries += 1) {
    const x = state.rng.int(HOME + 1, SIZE - HOME - 2);
    const y = state.rng.int(HOME + 1, SIZE - HOME - 2);
    let free = true;
    for (let yy = y - HOME - 1; yy <= y + HOME + 1 && free; yy += 1) {
      for (let xx = x - HOME - 1; xx <= x + HOME + 1 && free; xx += 1) {
        if (state.owner[idx(xx, yy)] || state.trail[idx(xx, yy)]) free = false;
      }
    }
    if (free) return { x, y };
  }
  return null;
}

export function createTerritory(seed = 1) {
  const state = {
    rng: createRng(seed),
    owner: new Int8Array(SIZE * SIZE),
    trail: new Int8Array(SIZE * SIZE),
    actors: [],
    time: 0,
    acc: 0,
    over: false,
    result: null,
    peakShare: 0,
    cuts: 0,
  };
  const corners = [
    { x: 8, y: 8 },
    { x: SIZE - 9, y: 8 },
    { x: 8, y: SIZE - 9 },
    { x: SIZE - 9, y: SIZE - 9 },
  ];
  const player = { id: PLAYER_ID, name: 'Tú', isBot: false, color: null, ...corners[3], dir: 'up', next: 'up', alive: true, trailLength: 0 };
  state.actors.push(player);
  BOTS.forEach((bot, i) => {
    state.actors.push({
      id: i + 2,
      ...bot,
      isBot: true,
      ...corners[i],
      dir: DIR_LIST[i],
      next: DIR_LIST[i],
      alive: true,
      trailLength: 0,
      plan: [],
      respawnIn: 0,
    });
  });
  for (const actor of state.actors) claimHome(state, actor);
  return state;
}

export const playerOf = (state) => state.actors[0];

/** Cambia la dirección del jugador (no puede dar media vuelta sobre sí mismo). */
export function steer(state, direction) {
  const player = playerOf(state);
  if (!DIRS[direction] || direction === OPPOSITE[player.dir]) return false;
  player.next = direction;
  return true;
}

function clearActor(state, actor) {
  for (let i = 0; i < state.owner.length; i += 1) {
    if (state.trail[i] === actor.id) state.trail[i] = 0;
    if (state.owner[i] === actor.id) state.owner[i] = 0;
  }
  actor.trailLength = 0;
}

function kill(state, actor, cause, events) {
  if (!actor.alive) return;
  actor.alive = false;
  clearActor(state, actor);
  events.push({ type: 'eliminated', id: actor.id, name: actor.name, cause });
  if (actor.isBot) actor.respawnIn = BOT_RESPAWN;
}

/**
 * Convierte el rastro en territorio y rellena lo encerrado.
 * Relleno por inundación desde los bordes del mapa: todo lo que no se alcanza
 * sin atravesar el territorio del actor queda encerrado y pasa a ser suyo.
 */
export function capture(state, actor) {
  const { owner, trail } = state;
  for (let i = 0; i < trail.length; i += 1) {
    if (trail[i] === actor.id) {
      trail[i] = 0;
      owner[i] = actor.id;
    }
  }
  const reached = new Uint8Array(SIZE * SIZE);
  const queue = [];
  const visit = (x, y) => {
    const i = idx(x, y);
    if (reached[i] || owner[i] === actor.id) return;
    reached[i] = 1;
    queue.push(i);
  };
  for (let k = 0; k < SIZE; k += 1) {
    visit(k, 0);
    visit(k, SIZE - 1);
    visit(0, k);
    visit(SIZE - 1, k);
  }
  while (queue.length) {
    const i = queue.pop();
    const x = i % SIZE;
    const y = (i - x) / SIZE;
    if (x > 0) visit(x - 1, y);
    if (x < SIZE - 1) visit(x + 1, y);
    if (y > 0) visit(x, y - 1);
    if (y < SIZE - 1) visit(x, y + 1);
  }
  let gained = 0;
  for (let i = 0; i < owner.length; i += 1) {
    if (!reached[i] && owner[i] !== actor.id) {
      owner[i] = actor.id;
      if (trail[i]) trail[i] = 0;
      gained += 1;
    }
  }
  actor.trailLength = 0;
  return gained;
}

export function shareOf(state, id) {
  let count = 0;
  for (let i = 0; i < state.owner.length; i += 1) if (state.owner[i] === id) count += 1;
  return count / state.owner.length;
}

// --- IA de los bots ------------------------------------------------------------

const manhattan = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

function safeDirections(state, bot) {
  return DIR_LIST.filter((dir) => {
    if (dir === OPPOSITE[bot.dir]) return false;
    const x = bot.x + DIRS[dir].dx;
    const y = bot.y + DIRS[dir].dy;
    return inside(x, y) && state.trail[idx(x, y)] !== bot.id;
  });
}

function nearestHome(state, bot) {
  let best = null;
  let bestD = Infinity;
  for (let i = 0; i < state.owner.length; i += 1) {
    if (state.owner[i] !== bot.id) continue;
    const cell = { x: i % SIZE, y: Math.floor(i / SIZE) };
    const d = manhattan(cell, bot);
    if (d < bestD) {
      bestD = d;
      best = cell;
    }
  }
  return best;
}

/** Plan de un bucle: salir, girar, avanzar y volver (rectángulo). */
function planLoop(state, bot) {
  const out = state.rng.int(3, 6);
  const side = state.rng.int(3, 6);
  const options = safeDirections(state, bot);
  const first = state.rng.pick(options.length ? options : DIR_LIST);
  const turn = state.rng() < 0.5 ? 1 : -1;
  const second = DIR_LIST[(DIR_LIST.indexOf(first) + turn + 4) % 4];
  const third = OPPOSITE[first];
  return [...Array(out).fill(first), ...Array(side).fill(second), ...Array(out + 1).fill(third)];
}

function botDecide(state, bot) {
  const player = playerOf(state);
  const inHome = state.owner[idx(bot.x, bot.y)] === bot.id;
  // Peligro: el jugador está cerca de su rastro → volver a casa ya.
  const danger = bot.trailLength > 0 && player.alive && manhattan(player, bot) <= 5;
  if (inHome && bot.trailLength === 0 && (!bot.plan.length || danger)) bot.plan = danger ? [] : planLoop(state, bot);
  let wanted = bot.plan.length && !danger ? bot.plan.shift() : null;
  if (!wanted && !inHome) {
    const home = nearestHome(state, bot);
    if (home) {
      const options = safeDirections(state, bot);
      options.sort((a, b) => {
        const da = manhattan({ x: bot.x + DIRS[a].dx, y: bot.y + DIRS[a].dy }, home);
        const db = manhattan({ x: bot.x + DIRS[b].dx, y: bot.y + DIRS[b].dy }, home);
        return da - db;
      });
      wanted = options[0];
    }
  }
  if (!wanted) wanted = bot.dir;
  const safe = safeDirections(state, bot);
  if (!safe.includes(wanted)) wanted = safe[0] ?? wanted;
  bot.next = wanted;
}

// --- Simulación -----------------------------------------------------------------

function advance(state, events) {
  const alive = state.actors.filter((a) => a.alive);
  for (const actor of alive) {
    if (actor.isBot) botDecide(state, actor);
    actor.dir = actor.next;
  }
  const targets = new Map();
  for (const actor of alive) {
    const x = actor.x + DIRS[actor.dir].dx;
    const y = actor.y + DIRS[actor.dir].dy;
    if (!inside(x, y)) {
      kill(state, actor, 'wall', events);
      continue;
    }
    targets.set(actor, { x, y });
  }
  // Choques frontales: si dos cabezas llegan a la misma celda, cae quien esté fuera de casa.
  for (const [a, pa] of targets) {
    for (const [b, pb] of targets) {
      if (a.id >= b.id || pa.x !== pb.x || pa.y !== pb.y) continue;
      const aHome = state.owner[idx(pa.x, pa.y)] === a.id;
      const bHome = state.owner[idx(pb.x, pb.y)] === b.id;
      if (!aHome) kill(state, a, 'collision', events);
      if (!bHome) kill(state, b, 'collision', events);
    }
  }
  for (const [actor, target] of targets) {
    if (!actor.alive) continue;
    const i = idx(target.x, target.y);
    const trailOwner = state.trail[i];
    if (trailOwner === actor.id) {
      kill(state, actor, 'self', events);
      continue;
    }
    if (trailOwner) {
      const victim = state.actors.find((a) => a.id === trailOwner);
      if (victim) {
        kill(state, victim, 'cut', events);
        if (actor.id === PLAYER_ID) {
          state.cuts += 1;
          events.push({ type: 'cut', name: victim.name });
        }
      }
    }
    actor.x = target.x;
    actor.y = target.y;
    if (state.owner[i] === actor.id) {
      if (actor.trailLength > 0) {
        const gained = capture(state, actor);
        if (actor.id === PLAYER_ID) events.push({ type: 'capture', gained });
      }
    } else {
      state.trail[i] = actor.id;
      actor.trailLength += 1;
    }
  }
}

export function stepTerritory(state, dt) {
  const events = [];
  if (state.over) return events;
  state.time += dt;
  for (const bot of state.actors) {
    if (bot.isBot && !bot.alive) {
      bot.respawnIn -= dt;
      const spot = bot.respawnIn <= 0 ? freeHomeSpot(state) : null;
      if (spot) {
        Object.assign(bot, spot, { alive: true, plan: [], trailLength: 0, dir: 'up', next: 'up' });
        claimHome(state, bot);
      }
    }
  }
  state.acc += dt;
  while (state.acc >= TICK && !state.over) {
    state.acc -= TICK;
    advance(state, events);
    const share = shareOf(state, PLAYER_ID);
    state.peakShare = Math.max(state.peakShare, share);
    if (!playerOf(state).alive) {
      state.over = true;
      state.result = 'eliminated';
    } else if (share >= WIN_SHARE) {
      state.over = true;
      state.result = 'win';
      events.push({ type: 'win' });
    }
  }
  if (!state.over && state.time >= TIME_LIMIT) {
    state.over = true;
    state.result = 'timeout';
    events.push({ type: 'timeout' });
  }
  return events;
}

export function standings(state) {
  return state.actors
    .map((a) => ({ id: a.id, name: a.name, color: a.color, share: shareOf(state, a.id), alive: a.alive, isBot: a.isBot }))
    .sort((a, b) => b.share - a.share);
}

/** Puntuación: porcentaje máximo del mapa dominado (en décimas de punto). */
export const scoreOf = (state) => Math.round(state.peakShare * 1000) / 10;
