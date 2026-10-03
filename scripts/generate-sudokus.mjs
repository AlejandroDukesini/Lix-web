/**
 * Genera el banco de Sudokus de la app (src/features/game-center/games/sudokus/levels/puzzles.js).
 *
 * Cada tablero tiene solución única y su dificultad la mide el graduador del
 * motor (técnicas lógicas necesarias), no una etiqueta. Es determinista: la
 * misma semilla produce el mismo banco. La app no genera en el dispositivo:
 * toma un tablero del banco y le aplica una transformación equivalente.
 *
 * Uso: node scripts/generate-sudokus.mjs [porDificultad=12]
 */
import { writeFileSync } from 'node:fs';
import { carve, createRng, grade, hasUniqueSolution, randomSolution, serialize } from '../src/features/game-center/games/sudokus/engine/sudokuEngine.js';

const PER_LEVEL = Number(process.argv[2] ?? 12);
// Pistas mínimas al tallar: más pistas = más fácil. Los niveles altos tallan hasta el mínimo.
const PLAN = {
  facil: { minClues: [40, 44] },
  medio: { minClues: [31, 34] },
  dificil: { minClues: [17, 17] },
  experto: { minClues: [17, 17] },
};

const bank = { facil: [], medio: [], dificil: [], experto: [] };
const rng = createRng(20261003);
const started = Date.now();
let attempts = 0;

while (Object.values(bank).some((list) => list.length < PER_LEVEL) && Date.now() - started < 10 * 60_000) {
  attempts += 1;
  const solution = randomSolution(rng);
  for (const [id, plan] of Object.entries(PLAN)) {
    if (bank[id].length >= PER_LEVEL) continue;
    const [lo, hi] = plan.minClues;
    const puzzle = carve(solution, rng, lo + Math.floor(rng() * (hi - lo + 1)));
    if (!hasUniqueSolution(puzzle)) continue;
    const level = grade(puzzle);
    if (level !== id) continue;
    const text = serialize(puzzle);
    if (!bank[id].includes(text)) bank[id].push(text);
  }
}

const clues = (text) => [...text].filter((ch) => ch !== '.').length;
const body = Object.entries(bank)
  .map(([id, list]) => `  ${id}: [\n${list.map((p) => `    '${p}', // ${clues(p)} pistas`).join('\n')}\n  ],`)
  .join('\n');

writeFileSync(
  'src/features/game-center/games/sudokus/levels/puzzles.js',
  `/**
 * Banco de Sudokus generado por scripts/generate-sudokus.mjs (no editar a mano).
 * Cada tablero tiene solución única y su dificultad la ha medido el graduador
 * del motor; las pruebas lo vuelven a comprobar. '.' = casilla vacía.
 */
export const PUZZLES = Object.freeze({
${body}
});
`,
);
console.log(Object.fromEntries(Object.entries(bank).map(([k, v]) => [k, v.length])), `${attempts} soluciones en ${Math.round((Date.now() - started) / 1000)} s`);
