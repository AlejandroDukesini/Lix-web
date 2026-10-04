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
 *
 * Variedad de obstáculos (OBSTACLE_TYPES): además de los anillos con hueco hay
 * bloques de tres tamaños (pequeño 1–2 caras, mediano 3–4, grande 5–7), quietos
 * o «rápidos» (se lanzan hacia la nave). Todo obstáculo se define por su
 * distancia de encuentro `z`: un bloque rápido se dibuja más lejos y se acerca
 * más deprisa, pero llega exactamente a `z`, así que la colisión y la garantía
 * de alcance son las mismas que las de un anillo. Cada tipo tiene un valor de
 * dificultad y una distancia mínima de aparición; el presupuesto de dificultad
 * crece con la distancia, de forma gradual.
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
  // Antes 0,011 m/s por metro hasta 68 m/s: a los 2 km ya no daba tiempo a reaccionar.
  return Math.min(60, 24 + distance * 0.0085);
}

/** Separación entre anillos (m): menor cuanto más se avanza. */
export function spacingAt(distance) {
  // Nunca menos de ~0,4 s entre obstáculos a la velocidad del momento: a partir de
  // 4 km, 17 m a 60 m/s dejaban 0,28 s y la inercia del giro hacía imposibles
  // algunos huecos estrechos seguidos.
  return Math.max(17, 44 - distance * 0.007, speedAt(distance) * 0.4);
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

/**
 * Catálogo de obstáculos. faces: [mín, máx] caras bloqueadas; approach: fracción
 * de la velocidad de la nave con la que el obstáculo viene a su encuentro;
 * from: metros a partir de los que puede aparecer; spacing: separación extra
 * delante de él (más anticipación para lo grande y rápido).
 */
export const OBSTACLE_TYPES = Object.freeze([
  { id: 'small-slow', size: 'small', faces: [1, 2], approach: 0, difficulty: 1, from: 0, spacing: 1 },
  { id: 'medium-slow', size: 'medium', faces: [3, 4], approach: 0, difficulty: 2, from: 0, spacing: 1 },
  { id: 'small-fast', size: 'small', faces: [1, 2], approach: [0.3, 0.45], difficulty: 3, from: 300, spacing: 1.2 },
  { id: 'large-slow', size: 'large', faces: [5, 7], approach: 0, difficulty: 3, from: 200, spacing: 1.15 },
  { id: 'medium-fast', size: 'medium', faces: [3, 4], approach: [0.3, 0.45], difficulty: 4, from: 700, spacing: 1.3 },
  { id: 'large-fast', size: 'large', faces: [5, 6], approach: [0.25, 0.4], difficulty: 5, from: 1300, spacing: 1.55 },
]);

/** Dificultad máxima permitida a una distancia: sube de forma continua (sin saltos por tramo). */
export const difficultyBudget = (distance) => Math.min(6, 2 + distance / 520);

/** Posición en el túnel desde la que se dibuja un obstáculo (los rápidos vienen de más lejos). */
export function obstacleZ(ring, distance) {
  if (!ring.approach || distance >= ring.z) return ring.z;
  return ring.z + ring.approach * (ring.z - distance);
}

/** Bloque de `faces` caras que deja libre el hueco seguro centrado en `center`. */
export function createBlock({ z, center, faces, approach, type, spin, rng }) {
  const blocked = new Array(SIDES).fill(false);
  const first = Math.round(wrap(center) / SIDE_ARC - MIN_GAP / 2);
  const safe = new Set(Array.from({ length: MIN_GAP }, (_, i) => (((first + i) % SIDES) + SIDES) % SIDES));
  // El bloque empieza en alguna cara fuera del hueco seguro y nunca lo toca.
  const slack = SIDES - MIN_GAP - faces;
  const start = first + MIN_GAP + (slack > 0 ? rng.int(0, slack) : 0);
  for (let i = 0; i < faces; i += 1) blocked[(((start + i) % SIDES) + SIDES) % SIDES] = true;
  for (const side of safe) blocked[side] = false;
  // Caras libres contiguas al hueco seguro (para señalarlas al dibujar).
  const gapSides = [];
  for (let i = 0; i < SIDES; i += 1) {
    const side = (((start + faces + i) % SIDES) + SIDES) % SIDES;
    if (blocked[side]) break;
    gapSides.push(side);
  }
  return {
    z,
    kind: 'block',
    type: type.id,
    size: type.size,
    difficulty: type.difficulty,
    approach,
    blocked,
    gapSides,
    center: (first + MIN_GAP / 2) * SIDE_ARC,
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

/** Elige el tipo del siguiente obstáculo según el presupuesto de dificultad. */
function pickType(state, z) {
  const { rng } = state;
  const previous = state.rings[state.rings.length - 1];
  const budget = difficultyBudget(z);
  // Nunca dos obstáculos rápidos seguidos: tras uno, siempre algo que se ve venir.
  const eligible = OBSTACLE_TYPES.filter((t) => t.from <= z && t.difficulty <= budget && !(t.approach && previous?.approach));
  // Anillos: siempre presentes, menos frecuentes al principio (eran «muros» grandes).
  const ringWeight = z < 300 ? 0.25 : 0.4;
  if (!previous || rng() < ringWeight || !eligible.length) return null;
  // Más peso a lo difícil a medida que se avanza.
  const weights = eligible.map((t) => 1 + (t.difficulty / 6) * Math.min(1.5, z / 1500));
  let roll = rng() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < eligible.length; i += 1) {
    roll -= weights[i];
    if (roll <= 0) return eligible[i];
  }
  return eligible.at(-1);
}

/** Siguiente obstáculo, a partir del anterior. Garantiza que sea alcanzable. */
export function nextRing(state) {
  const { rng } = state;
  const previous = state.rings[state.rings.length - 1];
  const baseZ = previous ? previous.z + spacingAt(previous.z) : FIRST_RING;
  const type = pickType(state, baseZ);
  // Lo rápido y lo grande llegan con más separación delante: más tiempo de reacción.
  const z = previous && type ? previous.z + spacingAt(previous.z) * type.spacing : baseZ;
  const sector = sectorAt(z);
  const fromCenter = previous ? previous.center : state.angle;
  // Al encajar el hueco en caras enteras el centro puede moverse media cara: se
  // descuenta para que el margen de alcance (60 %) se cumpla de verdad.
  const reach = previous ? Math.max(0, reachBetween(previous.z, z - previous.z) * REACH_MARGIN - SIDE_ARC / 2) : Math.PI;
  const center = wrap(fromCenter + rng.range(-reach, reach));
  if (type) {
    const faces = rng.int(type.faces[0], type.faces[1]);
    const approach = Array.isArray(type.approach) ? rng.range(type.approach[0], type.approach[1]) : 0;
    // Algunos bloques quietos se deslizan alrededor del túnel (llegan a su sitio calculado).
    const drifts = !approach && sector >= 2 && rng() < 0.3;
    const spin = drifts ? rng.range(0.01, 0.018) * (rng() < 0.5 ? -1 : 1) : 0;
    return createBlock({ z, center, faces, approach, type, spin, rng });
  }
  // El hueco se estrecha con los sectores, sin bajar de MIN_GAP caras.
  const widest = Math.max(MIN_GAP, 6 - sector);
  const gap = rng.int(Math.max(MIN_GAP, widest - 1), widest);
  const patterns = sector === 0 ? ['gate'] : sector === 1 ? ['gate', 'comb'] : ['gate', 'comb', 'split'];
  const pattern = rng.pick(patterns);
  // Anillos giratorios a partir del sector 2; cada vez más frecuentes.
  const spins = sector >= 2 && rng() < Math.min(0.55, 0.15 * (sector - 1));
  const spin = spins ? rng.range(0.012, 0.022) * (rng() < 0.5 ? -1 : 1) : 0;
  const ring = createRing({ z, center, gap, pattern, spin, rng });
  return { ...ring, kind: 'ring', size: 'ring', approach: 0, difficulty: gap >= 5 ? 2 : gap >= 3 ? 3 : 4 };
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
    zone: 0,
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
  // Cada 1000 m cambia el aspecto del túnel (no la dificultad, que sube de forma continua).
  const zone = zoneAt(state.distance);
  if (zone !== state.zone) {
    state.zone = zone;
    events.push({ type: 'zone', zone });
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

/**
 * Tramos visuales de 1000 m: cada uno con su color, luz, dibujo de las paredes,
 * decoración y ambiente (ver tunnelRenderer). Se repiten en ciclo.
 */
export const ZONE_LENGTH = 1000;
export const ZONES = Object.freeze([
  { id: 'neon', name: 'Neón', hue: 188, sat: 62, light: 1, pattern: 'stripes', deco: 'rims', ambient: 'streaks' },
  { id: 'forja', name: 'Forja', hue: 22, sat: 78, light: 1.1, pattern: 'ribs', deco: 'lamps', ambient: 'embers' },
  { id: 'coral', name: 'Arrecife', hue: 345, sat: 58, light: 1.05, pattern: 'spiral', deco: 'rims', ambient: 'bubbles' },
  { id: 'glaciar', name: 'Glaciar', hue: 200, sat: 30, light: 1.3, pattern: 'panels', deco: 'lamps', ambient: 'snow' },
  { id: 'jungla', name: 'Jungla', hue: 140, sat: 55, light: 0.95, pattern: 'checker', deco: 'vines', ambient: 'fireflies' },
  { id: 'eclipse', name: 'Eclipse', hue: 276, sat: 70, light: 0.8, pattern: 'pulse', deco: 'rims', ambient: 'stars' },
]);
export const zoneAt = (distance) => Math.floor(Math.max(0, distance) / ZONE_LENGTH);
export const zoneOf = (index) => ZONES[((index % ZONES.length) + ZONES.length) % ZONES.length];

/** Hitos de progreso del juego (metros). */
export const MILESTONES = [500, 1500, 3000];
