/**
 * Motor de «Aparcar el carro» (vista cenital, sin DOM, determinista).
 *
 * Unidades: metros, segundos y radianes. Ejes: x a la derecha, y hacia abajo;
 * ángulo 0 = el coche mira a la derecha, π/2 = mira hacia abajo.
 *
 * Movimiento: modelo de bicicleta (el giro depende de la velocidad: parado no
 * gira), aceleración progresiva, frenada más fuerte que la aceleración, marcha
 * atrás más lenta y volante que se mueve a velocidad limitada y vuelve al
 * centro al soltarlo. Prioriza el control y la precisión, no el realismo.
 *
 * Colisiones: el coche y los obstáculos son rectángulos orientados (teorema
 * del eje separador); los bordes del aparcamiento son muros. Al chocar, el
 * coche no atraviesa nada: vuelve a su posición anterior y rebota un poco.
 * Un golpe cuenta una vez por contacto: seguir apretando contra el muro no
 * suma más golpes hasta que el coche se separa.
 *
 * Aparcado: las cuatro esquinas dentro de la plaza, orientado como pide la
 * plaza (±PARK_ANGLE) y parado (o casi) durante PARK_HOLD segundos.
 */

export const CAR = Object.freeze({ length: 4.2, width: 1.8, wheelbase: 2.6 });
export const PHYSICS = Object.freeze({
  accel: 3.2,
  brake: 7.5,
  drag: 1.6,
  maxForward: 5.5,
  maxReverse: 2.8,
  steerMax: 0.6,
  steerRate: 2.4,
  steerReturn: 3.2,
});
export const PARK_ANGLE = (12 * Math.PI) / 180;
export const PARK_SPEED = 0.25;
export const PARK_HOLD = 0.8;
export const MAX_HITS = 3;
// Distancia a la que hay que separarse para que un nuevo contacto cuente como otro golpe.
const SEPARATION = 0.35;

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
export const angleDiff = (a, b) => Math.abs(wrap(a - b));

/** Esquinas de un rectángulo orientado { x, y, w (largo), h (ancho), angle } centrado en (x, y). */
export function corners({ x, y, w, h, angle = 0 }) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const hw = w / 2;
  const hh = h / 2;
  return [
    [x + c * hw - s * hh, y + s * hw + c * hh],
    [x + c * hw + s * hh, y + s * hw - c * hh],
    [x - c * hw + s * hh, y - s * hw - c * hh],
    [x - c * hw - s * hh, y - s * hw + c * hh],
  ];
}

const project = (points, ax, ay) => {
  let min = Infinity;
  let max = -Infinity;
  for (const [px, py] of points) {
    const d = px * ax + py * ay;
    if (d < min) min = d;
    if (d > max) max = d;
  }
  return [min, max];
};

/** ¿Se solapan dos rectángulos orientados? (eje separador) */
export function overlap(a, b) {
  const pa = corners(a);
  const pb = corners(b);
  for (const angle of [a.angle ?? 0, (a.angle ?? 0) + Math.PI / 2, b.angle ?? 0, (b.angle ?? 0) + Math.PI / 2]) {
    const ax = Math.cos(angle);
    const ay = Math.sin(angle);
    const [minA, maxA] = project(pa, ax, ay);
    const [minB, maxB] = project(pb, ax, ay);
    if (maxA <= minB || maxB <= minA) return false;
  }
  return true;
}

/** ¿El punto está dentro del rectángulo orientado (con un margen hacia dentro)? */
function inside(rect, [px, py], margin = 0) {
  const c = Math.cos(-(rect.angle ?? 0));
  const s = Math.sin(-(rect.angle ?? 0));
  const dx = px - rect.x;
  const dy = py - rect.y;
  const lx = dx * c - dy * s;
  const ly = dx * s + dy * c;
  return Math.abs(lx) <= rect.w / 2 - margin && Math.abs(ly) <= rect.h / 2 - margin;
}

export const carRect = (car) => ({ x: car.x, y: car.y, w: CAR.length, h: CAR.width, angle: car.angle });

export function createParking(level) {
  return {
    level,
    car: { x: level.start.x, y: level.start.y, angle: level.start.angle, speed: 0, steer: 0 },
    hits: 0,
    touching: false,
    parkTimer: 0,
    time: 0,
    status: 'driving', // 'driving' | 'parked' | 'wrecked'
  };
}

/** ¿El coche (agrandado `margin` metros por cada lado) choca con algo en esta posición? */
export function collides(level, car, margin = 0) {
  const base = carRect(car);
  const rect = { ...base, w: base.w + margin * 2, h: base.h + margin * 2 };
  if (corners(rect).some(([px, py]) => px < 0 || py < 0 || px > level.width || py > level.height)) return true;
  return level.obstacles.some((o) => overlap(rect, o));
}

/** ¿Está bien aparcado (sin contar el tiempo de espera)? */
export function inSpot(level, car) {
  const { spot } = level;
  const aligned = angleDiff(car.angle, spot.angle) < PARK_ANGLE || (Boolean(spot.either) && angleDiff(car.angle, spot.angle + Math.PI) < PARK_ANGLE);
  return aligned && corners(carRect(car)).every((p) => inside(spot, p, 0.02));
}

function approach(value, target, rate) {
  if (value < target) return Math.min(target, value + rate);
  return Math.max(target, value - rate);
}

/**
 * Avanza `dt` segundos con la entrada { throttle: −1…1, steer: −1…1 }.
 * throttle > 0 acelera hacia delante (o frena si iba marcha atrás);
 * throttle < 0 frena y, ya parado, da marcha atrás.
 * Devuelve eventos: { type: 'hit' } | { type: 'parked' } | { type: 'wrecked' }.
 */
export function step(state, input, dt) {
  const events = [];
  if (state.status !== 'driving') return events;
  const { car } = state;
  const throttle = Math.max(-1, Math.min(1, input.throttle ?? 0));
  const steer = Math.max(-1, Math.min(1, input.steer ?? 0));
  state.time += dt;

  // Volante: hacia la posición pedida a velocidad limitada; al soltar vuelve al centro.
  const target = steer * PHYSICS.steerMax;
  car.steer = approach(car.steer, target, (steer === 0 ? PHYSICS.steerReturn : PHYSICS.steerRate) * dt);

  // Velocidad.
  let v = car.speed;
  if (throttle > 0) v = v < -0.05 ? Math.min(0, v + PHYSICS.brake * dt) : v + PHYSICS.accel * throttle * dt;
  else if (throttle < 0) v = v > 0.05 ? Math.max(0, v - PHYSICS.brake * dt) : v + PHYSICS.accel * throttle * dt;
  else v = approach(v, 0, PHYSICS.drag * dt);
  car.speed = Math.max(-PHYSICS.maxReverse, Math.min(PHYSICS.maxForward, v));

  // Posición (modelo de bicicleta).
  const previous = { ...car };
  car.angle = wrap(car.angle + (car.speed / CAR.wheelbase) * Math.tan(car.steer) * dt);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;

  if (collides(state.level, car)) {
    Object.assign(car, previous, { speed: -previous.speed * 0.25 });
    if (!state.touching) {
      state.hits += 1;
      state.touching = true;
      events.push({ type: 'hit' });
      if (state.hits >= (state.level.maxHits ?? MAX_HITS)) {
        state.status = 'wrecked';
        events.push({ type: 'wrecked' });
        return events;
      }
    }
  } else if (state.touching && !collides(state.level, car, SEPARATION)) state.touching = false;

  if (inSpot(state.level, car) && Math.abs(car.speed) < PARK_SPEED) {
    state.parkTimer += dt;
    if (state.parkTimer >= PARK_HOLD) {
      state.status = 'parked';
      events.push({ type: 'parked' });
    }
  } else state.parkTimer = 0;
  return events;
}

/** Estrellas: 3 sin golpes y dentro del tiempo del nivel; 2 con un golpe o algo lento; si no, 1. */
export function starsFor(state) {
  const par = state.level.par ?? 30;
  if (state.hits === 0 && state.time <= par) return 3;
  if (state.hits <= 1 && state.time <= par * 1.6) return 2;
  return 1;
}

/** ¿Algún obstáculo invade la plaza o la salida? (para validar niveles) */
export function levelProblems(level) {
  const problems = [];
  const start = { ...level.start, speed: 0, steer: 0 };
  if (collides(level, start)) problems.push('el coche empieza chocando');
  if (level.obstacles.some((o) => overlap(level.spot, o))) problems.push('un obstáculo invade la plaza');
  if (inSpot(level, start)) problems.push('el coche empieza ya aparcado');
  if (level.spot.w < CAR.length + 0.3 || level.spot.h < CAR.width + 0.3) problems.push('la plaza es más pequeña que el coche con margen');
  return problems;
}
