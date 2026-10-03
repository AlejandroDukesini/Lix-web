/**
 * Motor de Traffic Rider (sin DOM, determinista con semilla).
 *
 * Unidades: metros y segundos. La carretera tiene LANES carriles en el mismo
 * sentido; x es la posición lateral (0 = centro), z la distancia recorrida.
 *
 * Moto: acelera menos cuanto más rápido va, frena con fuerza y el movimiento
 * lateral es progresivo (la velocidad lateral persigue la que pide la dirección,
 * nunca salta). Los quitamiedos de los bordes la contienen: no son un choque.
 *
 * Tráfico: cada vehículo va por su carril a su velocidad; si alcanza a otro más
 * lento se pone a su ritmo. Al crearse y mientras circula se evita el «muro»:
 * nunca hay coches en los cuatro carriles a la vez en una franja corta (si se
 * forma, el más reciente acelera hasta deshacerlo). Así siempre hay un hueco.
 *
 * Ningún vehículo alcanza a la moto por detrás: si la tiene delante en su
 * trayectoria, se pone a su ritmo (solo choca lo que se ve venir).
 *
 * Puntos: distancia (×1,5 por encima de 100 km/h), +40 por adelantamiento y
 * +100 extra si es ajustado (por el carril de al lado y a más de 100 km/h).
 */

export const LANES = 4;
export const LANE_W = 3.6;
export const ROAD_HALF = (LANES * LANE_W) / 2;
export const laneX = (lane) => -ROAD_HALF + LANE_W * (lane + 0.5);
export const BIKE = Object.freeze({ width: 0.8, length: 2.1 });
export const KMH = 3.6;

export const PHYSICS = Object.freeze({
  maxSpeed: 61, // ≈ 220 km/h
  accel: 11,
  brake: 20,
  drag: 2.2,
  lateralMax: 7.5,
  lateralAccel: 22,
});

export const VEHICLES = Object.freeze({
  car: { width: 1.8, length: 4.4, height: 1.4 },
  van: { width: 2.0, length: 5.2, height: 2.0 },
  truck: { width: 2.4, length: 9, height: 3.1 },
  bus: { width: 2.5, length: 11, height: 3.1 },
});

const SPAWN_AHEAD = 230;
const WALL_WINDOW = 14;
const FAST = 100 / KMH; // 100 km/h en m/s

function random(state) {
  state.rng = (state.rng + 0x6d2b79f5) >>> 0;
  let t = state.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Dificultad 0…1 según la distancia (más tráfico y más variado). */
export const difficultyAt = (z) => Math.min(1, z / 8000);

export function createRide(seed = 1, { startSpeed = 22 } = {}) {
  const state = {
    rng: seed >>> 0,
    bike: { x: laneX(1), z: 0, speed: startSpeed, vx: 0 },
    traffic: [],
    nextId: 1,
    nextSpawnZ: 60,
    score: 0,
    overtakes: 0,
    close: 0,
    fastDistance: 0,
    time: 0,
    status: 'riding', // 'riding' | 'crashed'
  };
  return state;
}

function lanesBusyAround(state, z) {
  const busy = new Set();
  for (const v of state.traffic) if (Math.abs(v.z - z) < WALL_WINDOW + v.length / 2) busy.add(v.lane);
  return busy;
}

function spawn(state) {
  const d = difficultyAt(state.bike.z);
  const z = state.nextSpawnZ;
  const busy = lanesBusyAround(state, z);
  const free = [...Array(LANES).keys()].filter((lane) => !busy.has(lane));
  // Nunca se ocupa el último hueco: deben quedar al menos dos carriles libres en la franja.
  if (free.length >= 2) {
    const lane = free[Math.floor(random(state) * free.length)];
    const roll = random(state);
    const kind = roll < 0.58 ? 'car' : roll < 0.8 ? 'van' : roll < 0.93 ? 'truck' : 'bus';
    const base = kind === 'truck' || kind === 'bus' ? 15 : 19;
    // Los carriles de la izquierda van algo más rápido.
    const speed = base + (LANES - 1 - lane) * 2.2 + random(state) * (4 + d * 6);
    state.traffic.push({ id: state.nextId++, kind, lane, x: laneX(lane), z, speed, cruise: speed, passed: false, ...VEHICLES[kind] });
  }
  const gap = 58 - d * 36;
  state.nextSpawnZ = z + gap * (0.6 + random(state) * 0.8);
}

const overlap = (a0, a1, b0, b1) => a0 < b1 && b0 < a1;

/**
 * Avanza `dt` segundos con { throttle: −1…1, steer: −1…1 }.
 * Eventos: { type: 'overtake', close } | { type: 'crash', with }.
 */
export function step(state, input, dt) {
  const events = [];
  if (state.status !== 'riding') return events;
  const { bike } = state;
  state.time += dt;
  const throttle = Math.max(-1, Math.min(1, input.throttle ?? 0));
  const steer = Math.max(-1, Math.min(1, input.steer ?? 0));

  // Velocidad: la aceleración cae al acercarse a la máxima.
  if (throttle > 0) bike.speed += PHYSICS.accel * throttle * (1 - (bike.speed / PHYSICS.maxSpeed) ** 2) * dt;
  else if (throttle < 0) bike.speed += PHYSICS.brake * throttle * dt;
  else bike.speed -= PHYSICS.drag * dt;
  bike.speed = Math.max(8, Math.min(PHYSICS.maxSpeed, bike.speed));

  // Movimiento lateral progresivo.
  const targetVx = steer * PHYSICS.lateralMax;
  const dv = targetVx - bike.vx;
  bike.vx += Math.sign(dv) * Math.min(Math.abs(dv), PHYSICS.lateralAccel * dt);
  bike.x += bike.vx * dt;
  const limit = ROAD_HALF - BIKE.width / 2 - 0.2;
  if (Math.abs(bike.x) > limit) {
    bike.x = Math.sign(bike.x) * limit;
    bike.vx = 0;
  }

  const dz = bike.speed * dt;
  bike.z += dz;
  const fast = bike.speed >= FAST;
  if (fast) state.fastDistance += dz;
  state.score += dz * (fast ? 1.5 : 1);

  // Tráfico: aparece por delante, se adapta al de delante y desaparece por detrás.
  while (state.nextSpawnZ < bike.z + SPAWN_AHEAD) spawn(state);
  const byLane = Array.from({ length: LANES }, () => []);
  for (const v of state.traffic) byLane[v.lane].push(v);
  for (const lane of byLane) {
    lane.sort((a, b) => a.z - b.z);
    for (let i = 0; i < lane.length; i += 1) {
      const v = lane[i];
      const ahead = lane[i + 1];
      let target = v.boost ? v.cruise * 1.35 : v.cruise;
      if (ahead && ahead.z - ahead.length / 2 - (v.z + v.length / 2) < 22) target = Math.min(target, ahead.speed);
      v.speed += Math.sign(target - v.speed) * Math.min(Math.abs(target - v.speed), 6 * dt);
    }
  }
  // Nadie embiste a la moto por detrás (la cámara mira hacia delante: sería un choque
  // imposible de prever). Un vehículo que la alcanza en su trayectoria se pone a su ritmo.
  for (const v of state.traffic) {
    const inPath = Math.abs(v.x - bike.x) < (v.width + BIKE.width) / 2 + 0.4;
    const gap = bike.z - BIKE.length / 2 - (v.z + v.length / 2);
    if (inPath && gap > -0.5 && gap < 14 && v.speed > bike.speed - 0.5) v.speed = Math.max(0, bike.speed - 0.5);
  }
  for (const v of state.traffic) v.z += v.speed * dt;
  // Deshacer muros que se formen por delante: el más reciente de la franja acelera.
  for (const v of state.traffic) {
    if (v.z < bike.z || v.z > bike.z + SPAWN_AHEAD) continue;
    const group = state.traffic.filter((o) => Math.abs(o.z - v.z) < WALL_WINDOW);
    if (new Set(group.map((o) => o.lane)).size >= LANES) {
      const newest = group.reduce((a, b) => (a.id > b.id ? a : b));
      newest.boost = 3;
    }
  }
  for (const v of state.traffic) if (v.boost) v.boost = Math.max(0, v.boost - dt) || undefined;

  // Adelantamientos y colisiones.
  for (const v of state.traffic) {
    if (!v.passed && v.z + v.length / 2 < bike.z - BIKE.length / 2) {
      v.passed = true;
      const close = Math.abs(v.x - bike.x) < LANE_W * 1.25 && bike.speed >= FAST;
      state.overtakes += 1;
      state.score += 40 + (close ? 100 : 0);
      if (close) state.close += 1;
      events.push({ type: 'overtake', close });
    }
    const hit =
      overlap(bike.x - BIKE.width / 2, bike.x + BIKE.width / 2, v.x - v.width / 2 + 0.1, v.x + v.width / 2 - 0.1) &&
      overlap(bike.z - BIKE.length / 2, bike.z + BIKE.length / 2, v.z - v.length / 2 + 0.1, v.z + v.length / 2 - 0.1);
    if (hit) {
      state.status = 'crashed';
      events.push({ type: 'crash', with: v.kind });
      return events;
    }
  }
  state.traffic = state.traffic.filter((v) => v.z > bike.z - 40);
  return events;
}

export const cloneRide = (state) => structuredClone(state);

/** Escenario por distancia: cambia cada 2,5 km y se repite. */
export const SCENES = Object.freeze([
  { id: 'afueras', name: 'Afueras por la mañana' },
  { id: 'costa', name: 'Costa al atardecer' },
  { id: 'desierto', name: 'Desierto' },
  { id: 'ciudad', name: 'Ciudad de noche' },
]);
export const sceneAt = (z) => SCENES[Math.floor(z / 2500) % SCENES.length];

/**
 * Misiones (modo carrera). type:
 *  'distance' recorrer `target` m · 'time' recorrer `target` m antes de `limit` s
 *  'overtakes' adelantar `target` vehículos · 'close' `target` adelantamientos ajustados
 *  'fast' recorrer `target` m por encima de 100 km/h
 * Chocar antes de cumplirla es fallarla.
 */
export const MISSIONS = Object.freeze([
  { id: 'm1', name: 'Primer paseo', type: 'distance', target: 1500 },
  { id: 'm2', name: 'Adelantando', type: 'overtakes', target: 15 },
  { id: 'm3', name: 'Contrarreloj', type: 'time', target: 3000, limit: 100 },
  { id: 'm4', name: 'A más de cien', type: 'fast', target: 2000 },
  { id: 'm5', name: 'Por los pelos', type: 'close', target: 8 },
  { id: 'm6', name: 'Gran ruta', type: 'distance', target: 6000 },
]);

/** Progreso de una misión: { value, target, done, failed }. */
export function missionProgress(mission, state) {
  const value =
    mission.type === 'overtakes' ? state.overtakes : mission.type === 'close' ? state.close : mission.type === 'fast' ? state.fastDistance : state.bike.z;
  const done = value >= mission.target && state.status !== 'crashed';
  const failed = state.status === 'crashed' || (mission.type === 'time' && state.time > mission.limit && !done);
  return { value: Math.min(value, mission.target), target: mission.target, done, failed };
}
