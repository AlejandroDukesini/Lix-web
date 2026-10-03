/**
 * Planificador de «Saltos de Lumi»: busca, con el MOTOR REAL, una secuencia de
 * entradas que lleva a Lumi de la salida a la vela sin perder ninguna vida.
 * Así se demuestra que cada nivel se puede superar; las soluciones se guardan
 * en levels/solutions.js y las pruebas las reproducen fotograma a fotograma.
 *
 * Búsqueda en haz: cada paso aplica «macros» de 6 fotogramas (correr, saltar
 * largo o corto, esperar…), descarta los estados con muerte, agrupa los casi
 * iguales y conserva los mejores según la distancia a la vela por casillas libres.
 *
 * Uso: node scripts/plan-lumi.mjs [idNivel …]
 */
import { writeFileSync } from 'node:fs';
import { LEVELS } from '../src/features/game-center/games/saltos-de-lumi/levels/levels.js';
import { T, cloneWorld, compressInputs, createWorld, decodeInput, isSolidChar, parseLevel, step, tileAt } from '../src/features/game-center/games/saltos-de-lumi/engine/lumiEngine.js';

const OUT = new URL('../src/features/game-center/games/saltos-de-lumi/levels/solutions.js', import.meta.url);
const MACROS = [
  [2, 2, 2, 2, 2, 2],
  [6, 6, 6, 6, 6, 6],
  [6, 6, 2, 2, 2, 2],
  [1, 1, 1, 1, 1, 1],
  [5, 5, 5, 5, 5, 5],
  [5, 5, 1, 1, 1, 1],
  [0, 0, 0, 0, 0, 0],
  [4, 4, 4, 4, 4, 4],
  [2, 2, 2, 0, 0, 0],
  [0, 0, 0, 2, 2, 2],
];
const WIDTH = 400;
const PER_CELL = 6;
const MAX_STEPS = 1400;

/** Distancia (en casillas libres) de cada casilla a la vela. */
function distanceField(level) {
  const dist = Array.from({ length: level.rows }, () => new Array(level.cols).fill(Infinity));
  const gc = Math.floor(level.goal.base.x / T);
  const gr = Math.floor(level.goal.base.y / T);
  const queue = [[gc, gr]];
  dist[gr][gc] = 0;
  for (let i = 0; i < queue.length; i += 1) {
    const [c, r] = queue[i];
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc;
      const nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= level.cols || nr >= level.rows || dist[nr][nc] !== Infinity) continue;
      if (isSolidChar(tileAt(level, nc, nr))) continue;
      dist[nr][nc] = dist[r][c] + 1;
      queue.push([nc, nr]);
    }
  }
  return dist;
}

function plan(def) {
  const level = parseLevel(def);
  const dist = distanceField(level);
  const scoreOf = (w) => {
    const p = w.player;
    const c = Math.max(0, Math.min(level.cols - 1, Math.floor((p.x + 5) / T)));
    const r = Math.max(0, Math.min(level.rows - 1, Math.floor((p.y + 7) / T)));
    const d = dist[r][c] === Infinity ? 999 : dist[r][c];
    return -d * 16 - Math.abs(level.goal.x - p.x) * 0.05 + (p.onGround ? 4 : 0);
  };
  let beam = [{ w: createWorld(level, { lives: 1 }), inputs: [] }];
  let best = null;
  for (let s = 0; s < MAX_STEPS; s += 1) {
    const next = new Map();
    for (const node of beam) {
      for (const macro of MACROS) {
        const w = cloneWorld(node.w);
        let dead = false;
        for (const mask of macro) {
          const ev = step(w, decodeInput(mask));
          if (ev.some((e) => e.type === 'death')) {
            dead = true;
            break;
          }
          if (w.status === 'won') break;
        }
        if (dead) continue;
        const inputs = node.inputs.concat(macro);
        if (w.status === 'won') return { inputs, frames: w.frame };
        const p = w.player;
        const alive = w.enemies.map((e) => (e.alive ? 1 : 0)).join('');
        const key = `${Math.round(p.x / 3)},${Math.round(p.y / 3)},${Math.round(p.vx / 40)},${Math.round(p.vy / 80)},${p.ground},${alive}`;
        const score = scoreOf(w);
        const prev = next.get(key);
        if (!prev || prev.score < score) next.set(key, { w, inputs, score });
      }
    }
    // Diversidad: como mucho PER_CELL estados por casilla, para que no todos se
    // lancen al mismo salto (los que esperan o toman otro camino siguen vivos).
    const perCell = new Map();
    beam = [];
    for (const node of [...next.values()].sort((a, b) => b.score - a.score)) {
      const cell = `${Math.floor(node.w.player.x / T)},${Math.floor(node.w.player.y / T)}`;
      const n = perCell.get(cell) ?? 0;
      if (n >= PER_CELL) continue;
      perCell.set(cell, n + 1);
      beam.push(node);
      if (beam.length >= WIDTH) break;
    }
    if (beam.length && (!best || beam[0].score > best.score)) best = beam[0];
    if (!beam.length) break;
  }
  // Sin solución: dónde se quedó más cerca (para corregir el nivel).
  if (best) console.log(`  más cerca: casilla ${Math.floor(best.w.player.x / T)},${Math.floor(best.w.player.y / T)}`);
  return null;
}

const only = process.argv.slice(2);
const { SOLUTIONS: previous = {} } = await import(OUT).catch(() => ({}));
const solutions = { ...previous };
let failed = 0;
for (const def of LEVELS) {
  if (only.length && !only.includes(def.id)) continue;
  const started = Date.now();
  const found = plan(def);
  if (!found) {
    failed += 1;
    console.log(`✗ ${def.id} ${def.name}: sin solución`);
    delete solutions[def.id];
    continue;
  }
  solutions[def.id] = compressInputs(found.inputs);
  console.log(`✓ ${def.id} ${def.name}: ${(found.frames / 60).toFixed(1)} s · ${((Date.now() - started) / 1000).toFixed(1)} s de búsqueda`);
}

const body = LEVELS.filter((l) => solutions[l.id]).map((l) => `  ${l.id}: '${solutions[l.id]}',`);
writeFileSync(
  OUT,
  `/**\n * Soluciones comprobadas de cada nivel (generadas con scripts/plan-lumi.mjs).\n * Entradas por fotograma, comprimidas: «máscara x fotogramas» (1 izquierda, 2 derecha, 4 salto).\n * Las pruebas las reproducen en el motor y exigen llegar a la vela sin perder vidas.\n */\nexport const SOLUTIONS = Object.freeze({\n${body.join('\n')}\n});\n`,
);
process.exit(failed ? 1 : 0);
