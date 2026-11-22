/**
 * Salida de la cochera — motor puro del rompecabezas de vehículos deslizantes.
 *
 * Tablero de 6 × 6. Cada vehículo ocupa 2 casillas (coches y furgonetas) o 3
 * (autobuses) y solo se desliza a lo largo de su eje, sin atravesar a otros ni
 * salir del tablero. El microbús dorado ('x') está en la fila de la salida y
 * escapa al llegar al borde derecho. Un movimiento es desplazar un vehículo
 * cualquier número de casillas en una dirección.
 *
 * Los niveles se escriben como 36 caracteres (fila a fila): '.' libre, 'x' el
 * microbús, una letra por vehículo, 'o' un bolardo fijo.
 */

export const SIZE = 6;
export const EXIT_ROW = 2;
export const TARGET = 'x';

/** Convierte la cadena de un nivel en vehículos. */
export function parseBoard(text) {
  if (text.length !== SIZE * SIZE) throw new Error(`Tablero de ${text.length} casillas`);
  const cells = {};
  const walls = [];
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '.') continue;
    if (ch === 'o') {
      walls.push([Math.floor(i / SIZE), i % SIZE]);
      continue;
    }
    (cells[ch] ??= []).push([Math.floor(i / SIZE), i % SIZE]);
  }
  const vehicles = Object.entries(cells).map(([id, list]) => {
    const [r0, c0] = list[0];
    const axis = list.every(([r]) => r === r0) ? 'h' : 'v';
    const ok = list.every(([r, c], k) => (axis === 'h' ? r === r0 && c === c0 + k : c === c0 && r === r0 + k));
    if (!ok || list.length < 2 || list.length > 3) throw new Error(`Vehículo ${id} mal formado`);
    return { id, row: r0, col: c0, len: list.length, axis };
  });
  const target = vehicles.find((v) => v.id === TARGET);
  if (!target || target.axis !== 'h' || target.row !== EXIT_ROW) throw new Error('El microbús debe ir en horizontal por la fila de salida');
  return { vehicles, walls };
}

export function createState(level) {
  const { vehicles, walls } = parseBoard(level.board);
  return { vehicles, walls, exited: false };
}

/** Rejilla de ocupación: id del vehículo, 'o' para bolardos o null. */
export function occupancy(state) {
  const grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  for (const [r, c] of state.walls) grid[r][c] = 'o';
  for (const v of state.vehicles) {
    for (let k = 0; k < v.len; k += 1) {
      if (v.axis === 'h') grid[v.row][v.col + k] = v.id;
      else grid[v.row + k][v.col] = v.id;
    }
  }
  return grid;
}

/**
 * Cuánto puede desplazarse un vehículo hacia atrás (izquierda/arriba, negativo)
 * y hacia delante (derecha/abajo, positivo).
 */
export function range(state, id) {
  const v = state.vehicles.find((x) => x.id === id);
  if (!v) return { min: 0, max: 0 };
  const grid = occupancy(state);
  let min = 0;
  let max = 0;
  if (v.axis === 'h') {
    while (v.col + min - 1 >= 0 && grid[v.row][v.col + min - 1] === null) min -= 1;
    while (v.col + v.len + max < SIZE && grid[v.row][v.col + v.len + max] === null) max += 1;
  } else {
    while (v.row + min - 1 >= 0 && grid[v.row + min - 1][v.col] === null) min -= 1;
    while (v.row + v.len + max < SIZE && grid[v.row + v.len + max][v.col] === null) max += 1;
  }
  return { min, max };
}

/** Desliza un vehículo `delta` casillas; null si choca o se sale. */
export function slide(state, id, delta) {
  if (!delta) return null;
  const { min, max } = range(state, id);
  if (delta < min || delta > max) return null;
  const vehicles = state.vehicles.map((v) => (v.id !== id ? v : v.axis === 'h' ? { ...v, col: v.col + delta } : { ...v, row: v.row + delta }));
  return { ...state, vehicles };
}

/** ¿El microbús tiene el camino libre hasta la salida? */
export function canEscape(state) {
  const target = state.vehicles.find((v) => v.id === TARGET);
  return Boolean(target) && target.col + target.len + range(state, TARGET).max === SIZE;
}

export const isWon = (state) => {
  const target = state.vehicles.find((v) => v.id === TARGET);
  return Boolean(target) && target.col + target.len === SIZE;
};

const keyOf = (state) => state.vehicles.map((v) => (v.axis === 'h' ? v.col : v.row)).join('');

/** Todos los estados alcanzables con un movimiento (con el movimiento que lleva a cada uno). */
export function neighbors(state) {
  const out = [];
  for (const v of state.vehicles) {
    const { min, max } = range(state, v.id);
    for (let d = min; d <= max; d += 1) if (d) out.push({ id: v.id, delta: d, state: slide(state, v.id, d) });
  }
  return out;
}

/**
 * Solución óptima (en movimientos) por búsqueda en anchura: [{ id, delta }] o null.
 * El orden de los vehículos no cambia nunca, así que la clave es solo su posición.
 */
export function solve(start, { limit = 300_000 } = {}) {
  if (isWon(start)) return [];
  const startKey = keyOf(start);
  const parent = new Map([[startKey, null]]);
  let frontier = [start];
  while (frontier.length) {
    const next = [];
    for (const state of frontier) {
      for (const n of neighbors(state)) {
        const key = keyOf(n.state);
        if (parent.has(key)) continue;
        parent.set(key, { prev: keyOf(state), id: n.id, delta: n.delta });
        if (isWon(n.state)) {
          const path = [];
          let k = key;
          while (parent.get(k)) {
            const p = parent.get(k);
            path.unshift({ id: p.id, delta: p.delta });
            k = p.prev;
          }
          return path;
        }
        if (parent.size > limit) return null;
        next.push(n.state);
      }
    }
    frontier = next;
  }
  return null;
}
