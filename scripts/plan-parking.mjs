/**
 * Busca, para cada nivel de «Aparcar el carro», una secuencia de entradas que
 * aparca el coche SIN TOCAR NADA, simulando el motor real a 60 fps. Escribe
 * las soluciones en src/features/game-center/games/aparcar/levels/solutions.js;
 * las pruebas las reproducen para demostrar que cada nivel se puede resolver.
 *
 * Búsqueda A* sobre maniobras: avanzar o retroceder con el volante en una
 * posición durante un tiempo y frenar hasta parar. Uso: node scripts/plan-parking.mjs [idNivel]
 */
import { writeFileSync } from 'node:fs';
import { LEVELS } from '../src/features/game-center/games/aparcar/levels/levels.js';
import { angleDiff, createParking, inSpot, step } from '../src/features/game-center/games/aparcar/engine/parkingEngine.js';

const DT = 1 / 60;
const ONLY = process.argv[2];
const STEERS = [-1, -0.5, 0, 0.5, 1];
const HOLDS = [12, 24, 42, 66]; // fotogramas acelerando
const MAX_EXPANSIONS = 120_000;

const clone = (state) => ({ ...state, car: { ...state.car } });

/** Ejecuta una maniobra; devuelve el nuevo estado y sus segmentos, o null si toca algo. */
function maneuver(state, dir, steer, hold) {
  const s = clone(state);
  const segments = [];
  for (let f = 0; f < hold; f += 1) {
    step(s, { throttle: dir, steer }, DT);
    if (s.hits) return null;
  }
  segments.push([dir, steer, hold]);
  let braking = 0;
  while (Math.abs(s.car.speed) > 0.05 && braking < 120) {
    step(s, { throttle: -dir, steer }, DT);
    braking += 1;
    if (s.hits) return null;
  }
  if (braking) segments.push([-dir, steer, braking]);
  return { state: s, segments };
}

const keyOf = ({ car }) =>
  [Math.round(car.x / 0.3), Math.round(car.y / 0.3), Math.round(car.angle / (Math.PI / 30)), Math.round(car.steer / 0.15)].join(',');

function heuristic(level, { car }) {
  const { spot } = level;
  const d = Math.hypot(car.x - spot.x, car.y - spot.y);
  const a = Math.min(angleDiff(car.angle, spot.angle), spot.either ? angleDiff(car.angle, spot.angle + Math.PI) : Infinity);
  return d + a * 2.2;
}

/** Cola de prioridad mínima (montículo binario). */
class Heap {
  items = [];
  push(item) {
    const a = this.items;
    a.push(item);
    for (let i = a.length - 1; i > 0; ) {
      const p = (i - 1) >> 1;
      if (a[p].f <= a[i].f) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.items;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      for (let i = 0; ; ) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l].f < a[m].f) m = l;
        if (r < a.length && a[r].f < a[m].f) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
  get size() {
    return this.items.length;
  }
}

function plan(level) {
  const open = new Heap();
  const seen = new Set();
  const start = createParking(level);
  open.push({ state: start, path: [], g: 0, f: heuristic(level, start) });
  let expansions = 0;
  while (open.size && expansions < MAX_EXPANSIONS) {
    const node = open.pop();
    const key = keyOf(node.state);
    if (seen.has(key)) continue;
    seen.add(key);
    expansions += 1;
    if (inSpot(level, node.state.car)) {
      // Comprobar que queda aparcado al esperar parado.
      const check = clone(node.state);
      for (let f = 0; f < 70; f += 1) step(check, { throttle: 0, steer: 0 }, DT);
      if (check.status === 'parked' && check.hits === 0) return { path: [...node.path, [0, 0, 70]], expansions };
    }
    for (const dir of [1, -1]) {
      for (const steer of STEERS) {
        for (const hold of HOLDS) {
          const next = maneuver(node.state, dir, steer, hold);
          if (!next) continue;
          const g = node.g + hold / 60 + 0.4;
          open.push({ state: next.state, path: [...node.path, ...next.segments], g, f: g + heuristic(level, next.state) * 1.6 });
        }
      }
    }
  }
  return { path: null, expansions };
}

const results = {};
for (const level of LEVELS) {
  if (ONLY && level.id !== ONLY) continue;
  const t0 = Date.now();
  const { path, expansions } = plan(level);
  const frames = path?.reduce((s, [, , f]) => s + f, 0);
  console.log(`${level.id}: ${path ? `solución de ${path.length} tramos, ${(frames / 60).toFixed(1)} s` : 'SIN SOLUCIÓN'} (${expansions} nodos, ${Date.now() - t0} ms)`);
  results[level.id] = path;
}

if (!ONLY) {
  const body = Object.entries(results)
    .map(([id, path]) => `  ${JSON.stringify(id)}: ${path ? JSON.stringify(path) : 'null'},`)
    .join('\n');
  writeFileSync(
    'src/features/game-center/games/aparcar/levels/solutions.js',
    `/**
 * Soluciones comprobadas de cada nivel (generadas por scripts/plan-parking.mjs; no editar a mano).
 * Cada tramo es [acelerador −1…1, volante −1…1, fotogramas a 60 fps]. Reproducidas con el
 * motor real, aparcan el coche sin tocar nada: lo comprueban las pruebas.
 */
export const SOLUTIONS = Object.freeze({
${body}
});
`,
  );
}
