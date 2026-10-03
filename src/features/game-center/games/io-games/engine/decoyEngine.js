/**
 * Señuelo — supervivencia en una arena.
 *
 * Drones del juego persiguen al jugador con un giro limitado: son algo más
 * lentos en las curvas que él, así que se les puede esquivar con cambios de
 * dirección bruscos. Si dos drones chocan entre sí, ambos se desintegran:
 * la estrategia es atraerlos para que se estrellen. Las chispas suman puntos.
 *
 * Justicia: cada dron se anuncia con una marca en el borde antes de entrar,
 * y nunca aparece cerca del jugador.
 *
 * Victoria: sobrevivir SURVIVE_TIME segundos. Fin: tocar un dron.
 */
import { createRng } from '../../../services/gameLifecycle.js';
import { clampUnit, distance, turnTowards } from './vector.js';

export const ARENA_RADIUS = 520;
export const PLAYER_RADIUS = 13;
export const PLAYER_SPEED = 215;
export const DRONE_RADIUS = 11;
export const SURVIVE_TIME = 90;
export const WARNING_TIME = 1.1; // s de aviso antes de que entre un dron
export const SAFE_SPAWN_DISTANCE = 300;
const MAX_DRONES = 14;
const SPARK_COUNT = 3;

/** Intervalo entre drones: cada vez más corto. */
export const spawnInterval = (time) => Math.max(1.4, 4 - time * 0.035);
/** Velocidad de los drones: crece poco a poco, siempre por debajo del jugador. */
export const droneSpeed = (time) => Math.min(PLAYER_SPEED * 0.92, 150 + time * 0.6);
export const DRONE_TURN = 2.1; // rad/s

function randomInArena(rng, margin = 60) {
  const angle = rng() * Math.PI * 2;
  const r = Math.sqrt(rng()) * (ARENA_RADIUS - margin);
  return { x: Math.cos(angle) * r, y: Math.sin(angle) * r };
}

export function createDecoy(seed = 1) {
  const rng = createRng(seed);
  return {
    rng,
    time: 0,
    player: { x: 0, y: 0, alive: true },
    drones: [],
    warnings: [],
    sparks: Array.from({ length: SPARK_COUNT }, () => randomInArena(rng)),
    nextSpawn: 1.5,
    popped: 0,
    collected: 0,
    over: false,
    result: null,
  };
}

/** Punto del borde lejos del jugador para anunciar un dron. */
export function spawnPosition(state) {
  for (let i = 0; i < 40; i += 1) {
    const angle = state.rng() * Math.PI * 2;
    const p = { x: Math.cos(angle) * (ARENA_RADIUS - 20), y: Math.sin(angle) * (ARENA_RADIUS - 20), angle };
    if (distance(p, state.player) >= SAFE_SPAWN_DISTANCE) return p;
  }
  // Siempre existe un punto opuesto al jugador lo bastante lejos.
  const angle = Math.atan2(-state.player.y, -state.player.x);
  return { x: Math.cos(angle) * (ARENA_RADIUS - 20), y: Math.sin(angle) * (ARENA_RADIUS - 20), angle };
}

export function stepDecoy(state, input, dt) {
  const events = [];
  if (state.over) return events;
  state.time += dt;
  const { player } = state;

  // Jugador
  const dir = clampUnit(input.x ?? 0, input.y ?? 0);
  player.x += dir.x * PLAYER_SPEED * dt;
  player.y += dir.y * PLAYER_SPEED * dt;
  const d = Math.hypot(player.x, player.y);
  const max = ARENA_RADIUS - PLAYER_RADIUS;
  if (d > max) {
    player.x *= max / d;
    player.y *= max / d;
  }

  // Avisos y aparición de drones
  state.nextSpawn -= dt;
  if (state.nextSpawn <= 0 && state.drones.length + state.warnings.length < MAX_DRONES) {
    state.warnings.push({ ...spawnPosition(state), in: WARNING_TIME });
    state.nextSpawn = spawnInterval(state.time);
    events.push({ type: 'warning' });
  }
  for (const warning of state.warnings) warning.in -= dt;
  for (const warning of state.warnings.filter((w) => w.in <= 0)) {
    state.drones.push({ x: warning.x, y: warning.y, heading: warning.angle + Math.PI, alive: true });
  }
  state.warnings = state.warnings.filter((w) => w.in > 0);

  // Drones: giran hacia el jugador con un límite de giro.
  const speed = droneSpeed(state.time);
  for (const drone of state.drones) {
    const target = Math.atan2(player.y - drone.y, player.x - drone.x);
    drone.heading = turnTowards(drone.heading, target, DRONE_TURN * dt);
    drone.x += Math.cos(drone.heading) * speed * dt;
    drone.y += Math.sin(drone.heading) * speed * dt;
    const dd = Math.hypot(drone.x, drone.y);
    if (dd > ARENA_RADIUS - DRONE_RADIUS) {
      drone.x *= (ARENA_RADIUS - DRONE_RADIUS) / dd;
      drone.y *= (ARENA_RADIUS - DRONE_RADIUS) / dd;
    }
  }

  // Drones que chocan entre sí se desintegran.
  for (let i = 0; i < state.drones.length; i += 1) {
    for (let j = i + 1; j < state.drones.length; j += 1) {
      const a = state.drones[i];
      const b = state.drones[j];
      if (a.alive && b.alive && distance(a, b) < DRONE_RADIUS * 2) {
        a.alive = false;
        b.alive = false;
        state.popped += 2;
        events.push({ type: 'pop', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      }
    }
  }
  state.drones = state.drones.filter((drone) => drone.alive);

  // Chispas
  for (const spark of state.sparks) {
    if (distance(spark, player) < PLAYER_RADIUS + 10) {
      Object.assign(spark, randomInArena(state.rng));
      state.collected += 1;
      events.push({ type: 'spark' });
    }
  }

  if (state.drones.some((drone) => distance(drone, player) < DRONE_RADIUS + PLAYER_RADIUS - 2)) {
    player.alive = false;
    state.over = true;
    state.result = 'caught';
    events.push({ type: 'caught' });
  } else if (state.time >= SURVIVE_TIME) {
    state.over = true;
    state.result = 'win';
    events.push({ type: 'win' });
  }
  return events;
}

/** Puntuación: segundos sobrevividos ×10, drones desintegrados ×25, chispas ×15. */
export const scoreOf = (state) => Math.floor(Math.min(state.time, SURVIVE_TIME) * 10) + state.popped * 25 + state.collected * 15;
