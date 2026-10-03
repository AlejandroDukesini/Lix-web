/**
 * Genera los niveles de «Despejar el estacionamiento»
 * (src/features/game-center/games/despejar/levels/levels.js).
 *
 * Coloca coches solo en filas o columnas con salida en el sentido de su
 * flecha, descarta los tableros triviales (casi todos los coches deben
 * empezar bloqueados en los niveles altos) y resuelve cada candidato con el
 * resolvedor del motor para conocer su mínimo de movimientos. Se quedan los
 * que tienen solución, ordenados por dificultad. Determinista con semilla.
 *
 * Uso: node scripts/generate-parking-jam.mjs
 */
import { writeFileSync } from 'node:fs';
import { createState, difficultyOf, findSolution, levelProblems, reach } from '../src/features/game-center/games/despejar/engine/jamEngine.js';

function createRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = createRng(20261003);
const int = (a, b) => a + Math.floor(rng() * (b - a + 1));
const pick = (list) => list[Math.floor(rng() * list.length)];

// Escalones: tamaño, coches, salidas, pilares y exigencia mínima.
const TIERS = [
  { size: 5, cars: [4, 5], exits: [3, 4], walls: [0, 0], blocked: 0.4, rounds: 2, take: 3, name: 'Primeros pasos' },
  { size: 6, cars: [6, 7], exits: [3, 4], walls: [0, 1], blocked: 0.5, rounds: 3, take: 3, name: 'Hora punta' },
  { size: 6, cars: [8, 9], exits: [3, 4], walls: [1, 2], blocked: 0.6, rounds: 3, take: 3, name: 'Atasco' },
  { size: 7, cars: [9, 11], exits: [3, 5], walls: [1, 3], blocked: 0.65, rounds: 4, take: 3, name: 'Centro comercial' },
  { size: 7, cars: [11, 13], exits: [3, 4], walls: [2, 3], blocked: 0.7, rounds: 4, take: 3, name: 'Gran aparcamiento' },
];
const SIDE_DIR = { right: ['h', 'right'], left: ['h', 'left'], top: ['v', 'up'], bottom: ['v', 'down'] };
const LETTERS = 'abcdefghijklmnopq';

function candidate(tier) {
  const size = tier.size;
  const exits = [];
  const nExits = int(...tier.exits);
  while (exits.length < nExits) {
    const e = { side: pick(['right', 'left', 'top', 'bottom']), index: int(0, size - 1) };
    if (!exits.some((x) => x.side === e.side && x.index === e.index)) exits.push(e);
  }
  const grid = Array.from({ length: size }, () => Array(size).fill(null));
  const walls = [];
  for (let n = int(...tier.walls); walls.length < n; ) {
    const r = int(1, size - 2);
    const c = int(1, size - 2);
    if (!grid[r][c]) {
      grid[r][c] = '#';
      walls.push(`${r},${c}`);
    }
  }
  const cars = [];
  const target = int(...tier.cars);
  for (let attempt = 0; attempt < 400 && cars.length < target; attempt += 1) {
    const gate = pick(exits);
    const [axis, dir] = SIDE_DIR[gate.side];
    const length = rng() < 0.7 ? 2 : 3;
    const offset = int(0, size - length);
    const row = axis === 'h' ? gate.index : offset;
    const col = axis === 'h' ? offset : gate.index;
    const cells = Array.from({ length }, (_, k) => (axis === 'h' ? [row, col + k] : [row + k, col]));
    if (cells.some(([r, c]) => grid[r][c])) continue;
    const id = LETTERS[cars.length];
    for (const [r, c] of cells) grid[r][c] = id;
    cars.push({ id, row, col, length, axis, dir, hue: Math.floor(rng() * 360) });
  }
  return { width: size, height: size, exits, walls, cars };
}

const levels = [];
TIERS.forEach((tier, t) => {
  const found = [];
  for (let attempt = 0; attempt < 6000 && found.length < tier.take * 6; attempt += 1) {
    const level = candidate(tier);
    if (level.cars.length < tier.cars[0] || levelProblems(level).length) continue;
    const state = createState(level);
    const blocked = level.cars.filter((car) => !reach(level, state, car.id).canExit).length;
    if (blocked < Math.ceil(level.cars.length * tier.blocked)) continue;
    const solution = findSolution(level, state, 150_000);
    if (!solution) continue;
    const { rounds, needsManeuver, traps } = difficultyOf(level);
    if (rounds < tier.rounds && !needsManeuver) continue;
    const score = rounds + (needsManeuver ? 3 : 0) + Math.min(4, traps) * 0.5;
    found.push({ ...level, par: solution.length, rounds, needsManeuver, traps, score, blocked });
  }
  // Los más exigentes del escalón, de menos a más.
  found.sort((a, b) => a.score - b.score || a.blocked - b.blocked);
  const chosen = found.slice(-tier.take).map(({ score, blocked, ...level }) => level);
  chosen.forEach((level, i) => levels.push({ id: `n${t + 1}-${i + 1}`, name: `${tier.name} ${i + 1}`, ...level }));
  console.log(`${tier.name}: ${found.length} candidatos, elegidos ${chosen.map((l) => `${l.rounds} tandas${l.needsManeuver ? ' + maniobra' : ''}, ${l.traps} trampas`).join(' | ')}`);
});

writeFileSync(
  'src/features/game-center/games/despejar/levels/levels.js',
  `/**
 * Niveles de «Despejar el estacionamiento», generados por scripts/generate-parking-jam.mjs
 * (no editar a mano). Todos tienen solución (las pruebas la vuelven a buscar).
 *   par            movimientos de una solución encontrada (referencia para las estrellas)
 *   rounds         tandas de salidas necesarias · needsManeuver: hay que apartar un coche a medias
 *   traps          primeros movimientos que dejan el tablero sin solución
 */
export const LEVELS = Object.freeze(${JSON.stringify(levels, null, 2)});
`,
);
