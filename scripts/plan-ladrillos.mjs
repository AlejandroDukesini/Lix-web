/**
 * Planificador de «Reino de Ladrillos»: busca, con el MOTOR REAL, una secuencia
 * de entradas que lleva del inicio al mástil sin perder ninguna vida. Así se
 * demuestra que cada nivel se puede superar; las soluciones se guardan en
 * levels/solutions.js y las pruebas las reproducen fotograma a fotograma.
 *
 * Búsqueda en haz con «macros» de 8 fotogramas (correr, saltar largo o corto,
 * esperar, retroceder…), sin estados con muerte, agrupando los casi iguales y
 * conservando los mejores según la distancia al mástil por casillas libres.
 *
 * Uso: node scripts/plan-ladrillos.mjs [idNivel …]
 */
import { writeFileSync } from 'node:fs';
import { LEVELS } from '../src/features/game-center/games/reino-de-ladrillos/levels/levels.js';
import { T, cloneWorld, compressInputs, createWorld, decodeInput, isSolid, parseLevel, step } from '../src/features/game-center/games/reino-de-ladrillos/engine/brickEngine.js';

const OUT = new URL('../src/features/game-center/games/reino-de-ladrillos/levels/solutions.js', import.meta.url);
const MACROS = [
  [2, 2, 2, 2, 2, 2, 2, 2],
  [6, 6, 6, 6, 6, 6, 6, 6],
  [6, 6, 6, 2, 2, 2, 2, 2],
  [6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6],
  [0, 0, 0, 0, 0, 0, 0, 0],
  [4, 4, 4, 4, 4, 4, 4, 4],
  [1, 1, 1, 1, 1, 1, 1, 1],
  [5, 5, 5, 5, 5, 5, 5, 5],
];
const WIDTH = 500;
const PER_CELL = 8;
const MAX_STEPS = 1600;

function distanceField(level) {
  const tile = (c, r) => (c < 0 || c >= level.cols ? '=' : r < 0 || r >= level.rows ? ' ' : level.grid[r][c]);
  const dist = Array.from({ length: level.rows }, () => new Array(level.cols).fill(Infinity));
  const gc = Math.floor(level.flag.x / T);
  const gr = Math.floor(level.flag.bottom / T) - 2;
  const queue = [[gc, gr]];
  dist[gr][gc] = 0;
  for (let i = 0; i < queue.length; i += 1) {
    const [c, r] = queue[i];
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc;
      const nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= level.cols || nr >= level.rows || dist[nr][nc] !== Infinity) continue;
      const t = tile(nc, nr);
      if (isSolid(t) || t === 'L') continue;
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
    const c = Math.max(0, Math.min(level.cols - 1, Math.floor((p.x + p.w / 2) / T)));
    const r = Math.max(0, Math.min(level.rows - 1, Math.floor((p.y + p.h - 4) / T)));
    const d = dist[r][c] === Infinity ? 999 : dist[r][c];
    return -d * 16 + p.x * 0.05 + (p.onGround ? 4 : 0) + (p.big ? 30 : 0);
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
        const alive = w.enemies.map((e) => (e.alive ? (e.state === 'shell' ? (e.vx ? 3 : 2) : 1) : 0)).join('');
        const key = `${Math.round(p.x / 3)},${Math.round(p.y / 3)},${Math.round(p.vx / 40)},${Math.round(p.vy / 80)},${p.big},${alive}`;
        const score = scoreOf(w);
        const prev = next.get(key);
        if (!prev || prev.score < score) next.set(key, { w, inputs, score });
      }
    }
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
  `/**\n * Soluciones comprobadas de cada nivel (generadas con scripts/plan-ladrillos.mjs).\n * Entradas por fotograma, comprimidas: «máscara x fotogramas» (1 izquierda, 2 derecha, 4 salto).\n * Las pruebas las reproducen en el motor y exigen llegar al mástil sin perder vidas.\n */\nexport const SOLUTIONS = Object.freeze({\n${body.join('\n')}\n});\n`,
);
process.exit(failed ? 1 : 0);
