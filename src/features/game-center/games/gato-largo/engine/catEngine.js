/**
 * Gato largo — motor puro (sin React).
 *
 * Un gato muy elástico se estira por una habitación. En cada movimiento la
 * cabeza avanza en línea recta y no para hasta chocar con un mueble, la pared
 * o su propio cuerpo; cada casilla que recorre se queda ocupada por el cuerpo.
 * Hay que llenar la habitación entera. Si ninguna dirección avanza, el gato se
 * ha quedado encerrado: se deshace (encoge) el último estirón.
 *
 * Mapa: '#' mueble/pared · '.' suelo · 'S' donde duerme el gato (la cola).
 */

export const DIRS = Object.freeze({
  up: [-1, 0],
  right: [0, 1],
  down: [1, 0],
  left: [0, -1],
});
export const DIR_NAMES = Object.freeze(['up', 'right', 'down', 'left']);

export function parseLevel(level) {
  const rows = level.map;
  const height = rows.length;
  const width = rows[0].length;
  const open = [];
  let start = -1;
  for (let r = 0; r < height; r += 1) {
    if (rows[r].length !== width) throw new Error(`Fila ${r} con otro ancho`);
    for (let c = 0; c < width; c += 1) {
      const ch = rows[r][c];
      open.push(ch !== '#');
      if (ch === 'S') start = r * width + c;
    }
  }
  if (start < 0) throw new Error('Falta el gato (S)');
  return { width, height, open, start, total: open.filter(Boolean).length };
}

/** Estado: el recorrido del cuerpo (índices, de la cola a la cabeza) y los estirones. */
export function createState(board) {
  return { path: [board.start], moves: [] };
}

export const headOf = (state) => state.path.at(-1);

/** Casillas que recorrería la cabeza en esa dirección (vacío si no avanza). */
export function trace(board, state, dir) {
  const [dr, dc] = DIRS[dir];
  const body = new Set(state.path);
  const cells = [];
  let r = Math.floor(headOf(state) / board.width);
  let c = headOf(state) % board.width;
  for (;;) {
    r += dr;
    c += dc;
    if (r < 0 || c < 0 || r >= board.height || c >= board.width) break;
    const i = r * board.width + c;
    if (!board.open[i] || body.has(i)) break;
    cells.push(i);
  }
  return cells;
}

/** Estira el gato; null si en esa dirección no puede avanzar. */
export function stretch(board, state, dir) {
  const cells = trace(board, state, dir);
  if (!cells.length) return null;
  return { path: [...state.path, ...cells], moves: [...state.moves, { dir, length: cells.length }] };
}

/** Encoge el último estirón. */
export function shrink(state) {
  const last = state.moves.at(-1);
  if (!last) return state;
  return { path: state.path.slice(0, state.path.length - last.length), moves: state.moves.slice(0, -1) };
}

export const isWon = (board, state) => state.path.length === board.total;
export const availableDirs = (board, state) => DIR_NAMES.filter((d) => trace(board, state, d).length > 0);
export const isStuck = (board, state) => !isWon(board, state) && availableDirs(board, state).length === 0;

/**
 * Soluciones: devuelve la primera (lista de direcciones) y cuántas hay hasta `cap`.
 * Búsqueda en profundidad; el ramaje es como mucho de 3, así que es rápida.
 */
export function solve(board, state = createState(board), { cap = 1, budget = 500_000 } = {}) {
  let first = null;
  let count = 0;
  let explored = 0;
  const dirs = [];
  const dfs = (s) => {
    if (count >= cap || explored > budget) return;
    explored += 1;
    if (isWon(board, s)) {
      count += 1;
      first ??= [...dirs];
      return;
    }
    for (const d of DIR_NAMES) {
      const next = stretch(board, s, d);
      if (!next) continue;
      dirs.push(d);
      dfs(next);
      dirs.pop();
    }
  };
  dfs(state);
  return { solution: first, count, exhausted: explored > budget };
}

/** Dirección hacia una casilla en línea recta con la cabeza (para tocar/clic). */
export function directionTowards(board, state, target) {
  const head = headOf(state);
  const hr = Math.floor(head / board.width);
  const hc = head % board.width;
  const tr = Math.floor(target / board.width);
  const tc = target % board.width;
  if (hr === tr && hc !== tc) return tc > hc ? 'right' : 'left';
  if (hc === tc && hr !== tr) return tr > hr ? 'down' : 'up';
  return null;
}
