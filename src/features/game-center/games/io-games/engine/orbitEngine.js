/**
 * Órbita — recolectar y crecer.
 *
 * Una célula de luz recorre una arena circular recogiendo partículas para
 * ganar masa. Las entidades bastante más grandes absorben a las pequeñas.
 * Las rivales son bots del juego con un comportamiento legible:
 *   huyen de quien puede absorberlas, persiguen a quien pueden absorber y,
 *   si no, van a por la partícula más cercana.
 *
 * Victoria: alcanzar TARGET_MASS. Fin: ser absorbido o agotar el tiempo.
 */
import { createRng } from '../../../services/gameLifecycle.js';
import { clampUnit, distance, normalize } from './vector.js';

export const ARENA_RADIUS = 1100;
export const PELLETS = 200;
export const PELLET_MASS = 1;
export const START_MASS = 12;
export const TARGET_MASS = 260;
export const TIME_LIMIT = 180; // s
export const EAT_RATIO = 1.2; // hay que ser un 20 % más grande para absorber
export const BOT_COUNT = 8;
const BOT_THINK = 0.25; // s entre decisiones
const RESPAWN_DELAY = 2.5;

export const radiusOf = (mass) => 4 * Math.sqrt(mass) + 4;
/** Cuanto más grande, más lento: el clásico equilibrio del género. */
export const speedOf = (mass) => 250 / (1 + radiusOf(mass) / 55);

const BOT_NAMES = ['Bot Nébula', 'Bot Cometa', 'Bot Pulsar', 'Bot Quásar', 'Bot Aurora', 'Bot Vega', 'Bot Lira', 'Bot Orión'];
const BOT_COLORS = ['#ff6b6b', '#ffd93d', '#6bcB77', '#4d96ff', '#c77dff', '#ff9f68', '#3ddbd9', '#f15bb5'];

function randomPoint(rng, maxRadius = ARENA_RADIUS - 40) {
  const angle = rng() * Math.PI * 2;
  const r = Math.sqrt(rng()) * maxRadius;
  return { x: Math.cos(angle) * r, y: Math.sin(angle) * r };
}

/** Punto aleatorio lejos de `avoid` (para no aparecer encima de nadie). */
function spawnPoint(rng, avoid, minDistance) {
  for (let i = 0; i < 30; i += 1) {
    const p = randomPoint(rng);
    if (!avoid || distance(p, avoid) >= minDistance) return p;
  }
  return randomPoint(rng);
}

export function createOrbit(seed = 1) {
  const rng = createRng(seed);
  const player = { id: 'player', name: 'Tú', isBot: false, x: 0, y: 0, mass: START_MASS, alive: true, color: null };
  const bots = BOT_NAMES.slice(0, BOT_COUNT).map((name, i) => ({
    id: `bot-${i}`,
    name,
    isBot: true,
    color: BOT_COLORS[i],
    ...spawnPoint(rng, player, 350),
    // Tamaños escalonados: algunos más pequeños que el jugador, otros más grandes.
    mass: [7, 9, 10, 14, 18, 24, 34, 46][i],
    alive: true,
    respawnIn: 0,
    think: rng() * BOT_THINK,
    goal: null,
  }));
  const pellets = Array.from({ length: PELLETS }, () => ({ ...randomPoint(rng), hue: Math.floor(rng() * 360) }));
  return { rng, time: 0, player, bots, pellets, eaten: 0, absorbed: 0, peak: START_MASS, over: false, result: null };
}

const entities = (state) => [state.player, ...state.bots].filter((e) => e.alive);

function move(entity, dir, dt) {
  const speed = speedOf(entity.mass);
  entity.x += dir.x * speed * dt;
  entity.y += dir.y * speed * dt;
  // Borde de la arena: la entidad se queda dentro.
  const d = Math.hypot(entity.x, entity.y);
  const max = ARENA_RADIUS - radiusOf(entity.mass);
  if (d > max) {
    entity.x *= max / d;
    entity.y *= max / d;
  }
}

/** Decisión de un bot: huir, perseguir o recolectar. */
export function decide(state, bot) {
  const r = radiusOf(bot.mass);
  let threat = null;
  let prey = null;
  for (const other of entities(state)) {
    if (other === bot) continue;
    const d = distance(bot, other) - radiusOf(other.mass) - r;
    if (other.mass > bot.mass * EAT_RATIO && d < 160 && (!threat || d < threat.d)) threat = { e: other, d };
    if (bot.mass > other.mass * EAT_RATIO && d < 240 && (!prey || d < prey.d)) prey = { e: other, d };
  }
  if (threat) return { type: 'flee', from: threat.e };
  if (prey) return { type: 'chase', target: prey.e };
  let nearest = null;
  let best = Infinity;
  for (const pellet of state.pellets) {
    const d = (pellet.x - bot.x) ** 2 + (pellet.y - bot.y) ** 2;
    if (d < best) {
      best = d;
      nearest = pellet;
    }
  }
  return nearest ? { type: 'collect', target: nearest } : { type: 'idle' };
}

function goalDirection(bot, goal) {
  if (!goal) return { x: 0, y: 0 };
  if (goal.type === 'flee') {
    const away = normalize(bot.x - goal.from.x, bot.y - goal.from.y);
    // Si huir lleva contra el borde, se desvía hacia el centro.
    const toCenter = normalize(-bot.x, -bot.y);
    const nearEdge = Math.hypot(bot.x, bot.y) > ARENA_RADIUS * 0.8;
    return nearEdge ? normalize(away.x + toCenter.x, away.y + toCenter.y) : away;
  }
  if (goal.type === 'chase' || goal.type === 'collect') return normalize(goal.target.x - bot.x, goal.target.y - bot.y);
  return { x: 0, y: 0 };
}

/**
 * Avanza `dt` segundos. `input`: { x, y } dirección del jugador (longitud ≤ 1).
 * Devuelve eventos: pellet, absorb (el jugador absorbe), absorbed (absorbido), win, timeout.
 */
export function stepOrbit(state, input, dt) {
  const events = [];
  if (state.over) return events;
  state.time += dt;

  move(state.player, clampUnit(input.x ?? 0, input.y ?? 0), dt);

  for (const bot of state.bots) {
    if (!bot.alive) {
      bot.respawnIn -= dt;
      if (bot.respawnIn <= 0) {
        Object.assign(bot, spawnPoint(state.rng, state.player, 600), { alive: true, mass: 6 + Math.floor(state.rng() * 10), goal: null });
      }
      continue;
    }
    bot.think -= dt;
    if (bot.think <= 0 || bot.goal?.target?.alive === false) {
      bot.goal = decide(state, bot);
      bot.think = BOT_THINK;
    }
    move(bot, goalDirection(bot, bot.goal), dt);
  }

  // Partículas: quien las toca las recoge y reaparecen en otro punto.
  for (const entity of entities(state)) {
    const r = radiusOf(entity.mass);
    for (const pellet of state.pellets) {
      if ((pellet.x - entity.x) ** 2 + (pellet.y - entity.y) ** 2 < r * r) {
        entity.mass += PELLET_MASS;
        Object.assign(pellet, randomPoint(state.rng));
        if (entity === state.player) {
          state.eaten += 1;
          events.push({ type: 'pellet' });
        }
      }
    }
  }

  // Absorciones entre entidades.
  const alive = entities(state);
  for (const a of alive) {
    for (const b of alive) {
      if (a === b || !a.alive || !b.alive) continue;
      if (a.mass <= b.mass * EAT_RATIO) continue;
      // El centro de la pequeña debe quedar dentro de la grande.
      if (distance(a, b) < radiusOf(a.mass) - radiusOf(b.mass) * 0.35) {
        a.mass += b.mass * 0.8;
        b.alive = false;
        if (b.isBot) b.respawnIn = RESPAWN_DELAY;
        if (a === state.player) {
          state.absorbed += 1;
          events.push({ type: 'absorb', name: b.name });
        }
        if (b === state.player) events.push({ type: 'absorbed', by: a.name });
      }
    }
  }

  state.peak = Math.max(state.peak, state.player.mass);
  if (!state.player.alive) {
    state.over = true;
    state.result = 'absorbed';
  } else if (state.player.mass >= TARGET_MASS) {
    state.over = true;
    state.result = 'win';
    events.push({ type: 'win' });
  } else if (state.time >= TIME_LIMIT) {
    state.over = true;
    state.result = 'timeout';
    events.push({ type: 'timeout' });
  }
  return events;
}

/** Clasificación por masa (jugador y bots vivos). */
export function leaderboard(state) {
  return entities(state)
    .map((e) => ({ id: e.id, name: e.name, mass: Math.floor(e.mass), isBot: e.isBot }))
    .sort((a, b) => b.mass - a.mass);
}

export const scoreOf = (state) => Math.floor(state.peak);
