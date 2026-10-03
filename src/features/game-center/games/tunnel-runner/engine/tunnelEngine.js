/**
 * Motor de Tunnel Runner. Sin dependencias de la interfaz: el estado es un
 * objeto mutable que el bucle de juego avanza con `step()`.
 *
 * El túnel es un prisma de SIDES caras. La nave recorre su pared interior y
 * gira alrededor del eje (ángulo `angle`, 0 = abajo). Los obstáculos son anillos
 * con algunas caras bloqueadas; al cruzar un anillo, la nave debe estar sobre
 * caras libres.
 *
 * Justicia del generador (comprobada en las pruebas):
 *  - cada anillo deja un hueco de al menos MIN_GAP caras contiguas;
 *  - el centro de ese hueco está a una distancia angular que la nave puede
 *    recorrer, con margen, en el tiempo que tarda en llegar desde el anillo anterior;
 *  - los anillos que giran lo hacen en función de la distancia, de modo que al
 *    llegar a la nave siempre están en su posición calculada.
 */
import { createRng } from '../../../services/gameLifecycle.js';

export const SIDES = 12;
export const SIDE_ARC = (Math.PI * 2) / SIDES;
export const PLAYER_ARC = 0.3; // ancho angular de la nave (rad)
export const TURN_SPEED = 3.4; // rad/s a máxima rotación
export const TURN_ACCEL = 26; // rad/s² (la nave tiene un poco de inercia)
export const MIN_GAP = 2;
export const REACH_MARGIN = 0.6; // solo se usa el 60 % de lo que la nave puede girar
export const SECTOR_LENGTH = 450; // metros por sector
export const VIEW_DEPTH = 190; // distancia de dibujo
const FIRST_RING = 70;

const TAU = Math.PI * 2;
export const wrap = (angle) => ((angle % TAU) + TAU) % TAU;
/** Distancia angular mínima entre dos ángulos (0..π). */
export const angularDistance = (a, b) => {
  const d = Math.abs(wrap(a) - wrap(b));
  return Math.min(d, TAU - d);
};

/** Velocidad (m/s) según la distancia recorrida: empieza tranquila y sube de forma gradual. */
export function speedAt(distance) {
  return Math.min(68, 24 + distance * 0.011);
}

/** Separación entre anillos (m): menor cuanto más se avanza. */
export function spacingAt(distance) {
  return Math.max(17, 44 - distance * 0.007);
}

export const sectorAt = (distance) => Math.floor(distance / SECTOR_LENGTH);

/** Ángulo máximo que la nave puede girar entre dos anillos separados `spacing` metros. */
export function reachBetween(distance, spacing) {
  const seconds = spacing / speedAt(distance + spacing);
  return TURN_SPEED * seconds;
}

/**
 * Crea un anillo cuyo hueco principal está centrado en `center`.
 * pattern: 'gate' (una sola abertura) | 'comb' (aberturas alternas) | 'split' (dos aberturas)
 */
export function createRing({ z, center, gap, pattern, spin, rng }) {
  const blocked = new Array(SIDES).fill(true);
  // Caras del hueco: las `gap` caras más cercanas a `center`.
  const first = Math.round(wrap(center) / SIDE_ARC - gap / 2);
  const gapSides = [];
  for (let i = 0; i < gap; i += 1) gapSides.push((((first + i) % SIDES) + SIDES) % SIDES);
  gapSides.forEach((side) => {
    blocked[side] = false;
  });
  if (pattern === 'comb') {
    for (let side = 0; side < SIDES; side += 1) if (side % 2 === 0 && rng() < 0.5) blocked[side] = false;
  } else if (pattern === 'split') {
    const opposite = (first + Math.floor(SIDES / 2)) % SIDES;
    blocked[opposite] = false;
    blocked[(opposite + 1) % SIDES] = false;
  }
  return {
    z,
    blocked,
    gapSides,
    center: (first + gap / 2) * SIDE_ARC,
    // Giro por metro: el anillo rota mientras se acerca y llega en su posición.
    spin,
    passed: false,
  };
}

/** Desfase angular de un anillo cuando la nave ha recorrido `distance`. */
export const ringOffset = (ring, distance) => ring.spin * (ring.z - distance);

/** ¿Choca una nave en `angle` con el anillo (en su posición de llegada)? */
export function collides(ring, angle) {
  const half = PLAYER_ARC / 2;
  // Se muestrea el arco de la nave en sus bordes y su centro.
  for (const sample of [angle - half, angle, angle + half]) {
    const side = Math.floor(wrap(sample) / SIDE_ARC) % SIDES;
    if (ring.blocked[side]) return true;
  }
  return false;
}

/** Siguiente anillo, a partir del anterior. Garantiza que sea alcanzable. */
export function nextRing(state) {
  const { rng } = state;
  const previous = state.rings[state.rings.length - 1];
  const z = previous ? previous.z + spacingAt(previous.z) : FIRST_RING;
  const sector = sectorAt(z);
  const fromCenter = previous ? previous.center : state.angle;
  const reach = previous ? reachBetween(previous.z, z - previous.z) * REACH_MARGIN : Math.PI;
  const center = wrap(fromCenter + rng.range(-reach, reach));
  // El hueco se estrecha con los sectores, sin bajar de MIN_GAP caras.
  const widest = Math.max(MIN_GAP, 6 - sector);
  const gap = rng.int(Math.max(MIN_GAP, widest - 1), widest);
  const patterns = sector === 0 ? ['gate'] : sector === 1 ? ['gate', 'comb'] : ['gate', 'comb', 'split'];
  const pattern = rng.pick(patterns);
  // Anillos giratorios a partir del sector 2; cada vez más frecuentes.
  const spins = sector >= 2 && rng() < Math.min(0.55, 0.15 * (sector - 1));
  const spin = spins ? rng.range(0.012, 0.022) * (rng() < 0.5 ? -1 : 1) : 0;
  return createRing({ z, center, gap, pattern, spin, rng });
}

export function createTunnel(seed = Date.now()) {
  const state = {
    seed,
    rng: createRng(seed),
    distance: 0,
    speed: speedAt(0),
    angle: 0,
    omega: 0,
    rings: [],
    sector: 0,
    passed: 0,
    alive: true,
    time: 0,
  };
  while (!state.rings.length || state.rings[state.rings.length - 1].z < VIEW_DEPTH + 40) state.rings.push(nextRing(state));
  return state;
}

/**
 * Avanza la simulación `dt` segundos. `input`: { left, right } (o `steer` entre −1 y 1
 * para controles analógicos). Devuelve eventos: { type: 'pass' | 'crash' | 'sector' }.
 */
export function step(state, input, dt) {
  const events = [];
  if (!state.alive) return events;
  state.time += dt;

  // Rotación con un poco de inercia.
  const steer = input.steer ?? (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const target = steer * TURN_SPEED;
  const change = TURN_ACCEL * dt;
  state.omega += Math.max(-change, Math.min(change, target - state.omega));
  state.angle = wrap(state.angle + state.omega * dt);

  const before = state.distance;
  state.speed = speedAt(state.distance);
  state.distance += state.speed * dt;

  for (const ring of state.rings) {
    if (ring.passed || ring.z > state.distance) continue;
    if (ring.z <= before) continue;
    ring.passed = true;
    if (collides(ring, state.angle)) {
      state.alive = false;
      state.distance = ring.z;
      events.push({ type: 'crash', ring });
      return events;
    }
    state.passed += 1;
    events.push({ type: 'pass', ring });
  }

  const sector = sectorAt(state.distance);
  if (sector !== state.sector) {
    state.sector = sector;
    events.push({ type: 'sector', sector });
  }

  // Se retiran los anillos superados y se generan los nuevos.
  while (state.rings.length && state.rings[0].z < state.distance - 10) state.rings.shift();
  while (state.rings[state.rings.length - 1].z < state.distance + VIEW_DEPTH + 40) state.rings.push(nextRing(state));
  return events;
}

/** Puntuación: metros recorridos. */
export const scoreOf = (state) => Math.floor(state.distance);

export const SECTOR_NAMES = ['Aurora', 'Ámbar', 'Coral', 'Índigo', 'Esmeralda', 'Eclipse'];
export const sectorName = (sector) => SECTOR_NAMES[sector % SECTOR_NAMES.length];

/** Hitos de progreso del juego (metros). */
export const MILESTONES = [500, 1500, 3000];
