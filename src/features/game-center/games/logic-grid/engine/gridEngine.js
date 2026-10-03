/**
 * Motor del juego de lógica "Cubrir todo el espacio". Sin dependencias de la interfaz.
 *
 * Un nivel se describe con un mapa de texto:
 *   '#' muro    '.' celda que hay que cubrir    'S' salida (cuenta como cubierta)
 * Todo lo que queda fuera del mapa también es muro.
 *
 * Regla común: ninguna celda se pisa dos veces. Cubrir todo el tablero es,
 * por tanto, recorrerlo entero sin repetir.
 *
 * Reglas de movimiento (campo `rule` del nivel):
 *   'slide' — Deslizar: cada movimiento avanza en línea recta y se detiene ante un
 *             muro, el borde o una celda ya cubierta, pintando a su paso. Un
 *             movimiento que no pisaría ninguna celda nueva no es válido.
 *   'path'  — Trazo único: cada movimiento avanza una sola celda (libre).
 *             Hay que hacer exactamente celdas − 1 pasos.
 *
 * El objetivo es cubrir todas las celdas sin superar `limit` movimientos.
 * Las celdas cubiertas se guardan como máscara de bits (BigInt): cabe cualquier
 * tablero de hasta 64 celdas abiertas y el estado se compara en tiempo constante.
 */

export const DIRECTIONS = Object.freeze({
  up: { dr: -1, dc: 0 },
  down: { dr: 1, dc: 0 },
  left: { dr: 0, dc: -1 },
  right: { dr: 0, dc: 1 },
});
export const DIRECTION_NAMES = Object.freeze(['up', 'right', 'down', 'left']);

export const RULES = Object.freeze({
  slide: {
    id: 'slide',
    name: 'Deslizar',
    summary: 'Te deslizas en línea recta hasta un muro o una casilla ya cubierta. No se repite ninguna casilla.',
  },
  path: {
    id: 'path',
    name: 'Trazo único',
    summary: 'Avanzas de una en una. No se repite ninguna casilla.',
  },
});

/** Convierte un nivel en un tablero listo para jugar. Lanza si el mapa es inválido. */
export function parseLevel(level) {
  const rows = level.map;
  const height = rows.length;
  const width = Math.max(...rows.map((row) => row.length));
  const open = new Array(width * height).fill(false);
  const bit = new Array(width * height).fill(-1);
  let start = null;
  let total = 0;
  rows.forEach((row, r) => {
    for (let c = 0; c < width; c += 1) {
      const ch = row[c] ?? '#';
      if (ch === '#') continue;
      if (ch !== '.' && ch !== 'S') throw new Error(`Carácter no válido "${ch}" en ${level.id}`);
      const index = r * width + c;
      open[index] = true;
      bit[index] = total;
      total += 1;
      if (ch === 'S') {
        if (start !== null) throw new Error(`El nivel ${level.id} tiene más de una salida`);
        start = index;
      }
    }
  });
  if (start === null) throw new Error(`El nivel ${level.id} no tiene salida`);
  if (total > 64) throw new Error(`El nivel ${level.id} supera las 64 celdas`);
  if (!RULES[level.rule]) throw new Error(`Regla desconocida en ${level.id}`);
  return {
    id: level.id,
    rule: level.rule,
    limit: level.limit,
    width,
    height,
    open,
    bit,
    start,
    total,
    full: (1n << BigInt(total)) - 1n,
  };
}

const maskOf = (board, index) => 1n << BigInt(board.bit[index]);
export const rowOf = (board, index) => Math.floor(index / board.width);
export const colOf = (board, index) => index % board.width;

export function isOpen(board, r, c) {
  return r >= 0 && c >= 0 && r < board.height && c < board.width && board.open[r * board.width + c];
}

export function createState(board) {
  return { pos: board.start, covered: maskOf(board, board.start), moves: 0, history: [] };
}

export const isCovered = (board, state, index) => board.open[index] && (state.covered & maskOf(board, index)) !== 0n;

export function coveredCount(board, state) {
  let count = 0;
  let mask = state.covered;
  while (mask) {
    count += Number(mask & 1n);
    mask >>= 1n;
  }
  return count;
}

/** Motivo por el que un movimiento no es válido (para explicarlo en la interfaz). */
export function invalidReason(board, state, direction) {
  const delta = DIRECTIONS[direction];
  if (!delta || !canMove(board, state)) return null;
  const r = rowOf(board, state.pos) + delta.dr;
  const c = colOf(board, state.pos) + delta.dc;
  if (!isOpen(board, r, c)) return 'wall';
  if (isCovered(board, state, r * board.width + c)) return 'covered';
  return null;
}

/**
 * Celdas que recorrería un movimiento en `direction` desde el estado actual,
 * o null si el movimiento no es válido según la regla del nivel.
 */
export function moveTrace(board, state, direction) {
  const delta = DIRECTIONS[direction];
  if (!delta) return null;
  let r = rowOf(board, state.pos);
  let c = colOf(board, state.pos);
  const path = [];
  if (board.rule === 'path') {
    r += delta.dr;
    c += delta.dc;
    if (!isOpen(board, r, c)) return null;
    const index = r * board.width + c;
    if (isCovered(board, state, index)) return null;
    return [index];
  }
  // Se avanza mientras la siguiente celda exista, no sea muro y no esté cubierta.
  while (isOpen(board, r + delta.dr, c + delta.dc) && !isCovered(board, state, (r + delta.dr) * board.width + c + delta.dc)) {
    r += delta.dr;
    c += delta.dc;
    path.push(r * board.width + c);
  }
  return path.length ? path : null;
}

export function canMove(board, state) {
  return state.moves < board.limit && !isWon(board, state);
}

/** Aplica un movimiento. Devuelve el nuevo estado o null si no es válido. */
export function applyMove(board, state, direction) {
  if (!canMove(board, state)) return null;
  const path = moveTrace(board, state, direction);
  if (!path) return null;
  let covered = state.covered;
  for (const index of path) covered |= maskOf(board, index);
  return {
    pos: path[path.length - 1],
    covered,
    moves: state.moves + 1,
    history: [...state.history, { direction, from: state.pos, covered: state.covered }],
  };
}

export function undoMove(state) {
  const last = state.history[state.history.length - 1];
  if (!last) return state;
  return { pos: last.from, covered: last.covered, moves: state.moves - 1, history: state.history.slice(0, -1) };
}

/** Movimientos posibles ahora mismo: [{ direction, path, end }]. */
export function availableMoves(board, state) {
  if (!canMove(board, state)) return [];
  return DIRECTION_NAMES.map((direction) => {
    const path = moveTrace(board, state, direction);
    return path ? { direction, path, end: path[path.length - 1] } : null;
  }).filter(Boolean);
}

/** Dirección de un movimiento hacia una celda pulsada (debe estar en la misma fila o columna). */
export function directionTowards(board, from, target) {
  const dr = rowOf(board, target) - rowOf(board, from);
  const dc = colOf(board, target) - colOf(board, from);
  if (dr === 0 && dc === 0) return null;
  if (dr !== 0 && dc !== 0) return null;
  if (dr < 0) return 'up';
  if (dr > 0) return 'down';
  return dc < 0 ? 'left' : 'right';
}

export const isWon = (board, state) => state.covered === board.full;

/**
 * Busca una solución desde `state` con los movimientos que quedan.
 * Devuelve { solvable: true, path }, { solvable: false } o, si se agota el
 * presupuesto de búsqueda, { solvable: null } (no se puede afirmar nada).
 */
export function solve(board, state, { budget = 400_000 } = {}) {
  const failed = new Map(); // "pos|máscara" → mayor número de movimientos restantes que ya fracasó
  let nodes = 0;
  const path = [];

  const search = (current) => {
    if (isWon(board, current)) return true;
    const remaining = board.limit - current.moves;
    if (remaining <= 0) return false;
    nodes += 1;
    if (nodes > budget) throw new RangeError('budget');
    const key = `${current.pos}|${current.covered}`;
    if ((failed.get(key) ?? -1) >= remaining) return false;
    for (const direction of DIRECTION_NAMES) {
      const next = applyMove(board, current, direction);
      if (!next) continue;
      path.push(direction);
      if (search({ ...next, history: [] })) return true;
      path.pop();
    }
    failed.set(key, remaining);
    return false;
  };

  try {
    return search({ ...state, history: [] }) ? { solvable: true, path: [...path] } : { solvable: false };
  } catch (error) {
    if (error instanceof RangeError) return { solvable: null };
    throw error;
  }
}

/** Menor número de movimientos que resuelve el nivel desde la salida (profundización iterativa). */
export function optimalMoves(level, { max = 30, budget = 2_000_000 } = {}) {
  for (let limit = 1; limit <= max; limit += 1) {
    const board = parseLevel({ ...level, limit });
    const result = solve(board, createState(board), { budget });
    if (result.solvable) return { moves: limit, path: result.path };
    if (result.solvable === null) return null;
  }
  return null;
}

/**
 * Estado de la partida:
 *   'won'     — todo cubierto dentro del límite.
 *   'lost'    — se acabaron los movimientos, no quedan movimientos válidos, o el
 *               solucionador demostró que ya no existe solución.
 *   'playing' — se puede seguir (o no se pudo demostrar lo contrario a tiempo).
 */
export function evaluate(board, state, { budget = 60_000 } = {}) {
  if (isWon(board, state)) return { status: 'won' };
  if (state.moves >= board.limit) return { status: 'lost', reason: 'moves' };
  if (availableMoves(board, state).length === 0) return { status: 'lost', reason: 'stuck' };
  const result = solve(board, state, { budget });
  if (result.solvable === false) return { status: 'lost', reason: 'unsolvable' };
  return { status: 'playing', hint: result.solvable ? result.path[0] : null };
}
