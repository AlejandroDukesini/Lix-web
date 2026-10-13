/**
 * Motor de «Bloques que caen» (clásico de encajar piezas). Sin DOM y determinista
 * con semilla: lo usan la interfaz y las pruebas.
 *
 * Tablero de 10 × 22: las 2 filas de arriba están ocultas (ahí nacen las piezas)
 * y se ven las 20 de abajo. Coordenadas: x a la derecha, y hacia abajo.
 *
 * Reglas (las habituales del género, con nombres propios):
 *  - 7 piezas; salen en «bolsas» barajadas de 7 (nunca más de 12 sin ver una).
 *  - Rotación con patadas de pared estándar (SRS): una pieza pegada a la pared
 *    o a otros bloques prueba 5 desplazamientos antes de rendirse.
 *  - Gravedad por nivel; caída suave (1 punto por casilla) e instantánea (2).
 *  - Retardo de fijación de 0,5 s al tocar el suelo, que se renueva al mover o
 *    girar hasta 15 veces (no se puede «flotar» para siempre).
 *  - Reserva: una pieza se puede guardar una vez por pieza.
 *  - Líneas: 100 / 300 / 500 / 800 × nivel; cuatro seguidas tras otras cuatro ×1,5;
 *    combo de piezas seguidas que limpian: 50 × combo × nivel.
 *  - Fin: la pieza nueva no cabe, o una pieza se fija entera por encima del tablero visible.
 */
import { createRng } from '../../../services/gameLifecycle.js';

export const COLS = 10;
export const HIDDEN = 2;
export const VISIBLE_ROWS = 20;
export const ROWS = VISIBLE_ROWS + HIDDEN;
export const TYPES = Object.freeze(['I', 'O', 'T', 'S', 'Z', 'J', 'L']);
export const LOCK_DELAY = 0.5;
export const MAX_LOCK_RESETS = 15;
export const LINES_PER_LEVEL = 10;
export const MAX_LEVEL = 20;

export const MODES = Object.freeze({
  maraton: { id: 'maraton', goalLines: 150 },
  sprint: { id: 'sprint', goalLines: 40 },
});

const BASE = {
  I: [[0, 1], [1, 1], [2, 1], [3, 1]],
  O: [[1, 0], [2, 0], [1, 1], [2, 1]],
  T: [[1, 0], [0, 1], [1, 1], [2, 1]],
  S: [[1, 0], [2, 0], [0, 1], [1, 1]],
  Z: [[0, 0], [1, 0], [1, 1], [2, 1]],
  J: [[0, 0], [0, 1], [1, 1], [2, 1]],
  L: [[2, 0], [0, 1], [1, 1], [2, 1]],
};

/** Los 4 estados de giro de cada pieza (giro horario dentro de su caja de 3 o 4). */
export const SHAPES = Object.freeze(
  Object.fromEntries(
    TYPES.map((type) => {
      if (type === 'O') return [type, [0, 1, 2, 3].map(() => BASE.O)];
      const size = type === 'I' ? 4 : 3;
      const states = [BASE[type]];
      for (let r = 1; r < 4; r += 1) states.push(states[r - 1].map(([x, y]) => [size - 1 - y, x]));
      return [type, states];
    }),
  ),
);

// Patadas SRS (en la notación habitual y crece hacia arriba; aquí se invierte).
const flip = (list) => list.map(([x, y]) => [x, -y]);
const KICKS_JLSTZ = {
  '0>1': flip([[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]]),
  '1>0': flip([[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]]),
  '1>2': flip([[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]]),
  '2>1': flip([[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]]),
  '2>3': flip([[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]]),
  '3>2': flip([[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]]),
  '3>0': flip([[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]]),
  '0>3': flip([[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]]),
};
const KICKS_I = {
  '0>1': flip([[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]]),
  '1>0': flip([[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]]),
  '1>2': flip([[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]]),
  '2>1': flip([[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]]),
  '2>3': flip([[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]]),
  '3>2': flip([[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]]),
  '3>0': flip([[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]]),
  '0>3': flip([[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]]),
};

export const LINE_POINTS = Object.freeze([0, 100, 300, 500, 800]);

/** Segundos que tarda una pieza en bajar una fila en cada nivel (curva habitual del género). */
export function gravityInterval(level) {
  const l = Math.min(MAX_LEVEL, Math.max(1, level));
  return (0.8 - (l - 1) * 0.007) ** (l - 1);
}

export const cellsOf = (piece) => SHAPES[piece.type][piece.rot].map(([x, y]) => [piece.x + x, piece.y + y]);

export function emptyBoard() {
  return new Array(COLS * ROWS).fill(null);
}

export const cellAt = (board, x, y) => board[y * COLS + x];

/** ¿La pieza se sale o pisa un bloque? */
export function collides(board, piece) {
  for (const [x, y] of cellsOf(piece)) {
    if (x < 0 || x >= COLS || y >= ROWS) return true;
    if (y >= 0 && board[y * COLS + x]) return true;
  }
  return false;
}

function refillBag(state) {
  const bag = [...TYPES];
  for (let i = bag.length - 1; i > 0; i -= 1) {
    const j = Math.floor(state.rng() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  state.queue.push(...bag);
}

const spawnPiece = (type) => ({ type, rot: 0, x: type === 'O' ? 3 : 3, y: 0 });

function takeNext(state) {
  while (state.queue.length < 7) refillBag(state);
  return state.queue.shift();
}

function spawn(state, type, events) {
  const piece = spawnPiece(type);
  state.active = piece;
  state.lockTimer = 0;
  state.lockResets = 0;
  state.gravityAcc = 0;
  state.lowestY = piece.y;
  if (collides(state.board, piece)) {
    state.over = true;
    state.active = null;
    events.push({ type: 'gameOver', reason: 'blockOut' });
    return;
  }
  // Nace en las filas ocultas y, si hay sitio, aparece ya una fila más abajo.
  if (!collides(state.board, { ...piece, y: piece.y + 1 })) piece.y += 1;
}

export function createGame({ seed = 1, mode = 'maraton', startLevel = 1, board } = {}) {
  const state = {
    mode: MODES[mode] ? mode : 'maraton',
    rng: createRng(seed),
    board: board ? [...board] : emptyBoard(),
    queue: [],
    active: null,
    hold: null,
    canHold: true,
    score: 0,
    lines: 0,
    startLevel: Math.min(MAX_LEVEL, Math.max(1, startLevel)),
    level: Math.min(MAX_LEVEL, Math.max(1, startLevel)),
    combo: -1,
    backToBack: false,
    pieces: 0,
    tetrises: 0,
    maxCombo: 0,
    over: false,
    won: false,
    gravityAcc: 0,
    lockTimer: 0,
    lockResets: 0,
    lowestY: 0,
    time: 0,
  };
  refillBag(state);
  spawn(state, takeNext(state), []);
  return state;
}

export const isGrounded = (state) => Boolean(state.active) && collides(state.board, { ...state.active, y: state.active.y + 1 });

/** Mover o girar sobre el suelo renueva el retardo de fijación (con límite). */
function touchLock(state) {
  if (!isGrounded(state)) return;
  if (state.lockResets < MAX_LOCK_RESETS) {
    state.lockTimer = 0;
    state.lockResets += 1;
  }
}

function trackDescent(state) {
  if (state.active.y > state.lowestY) {
    // Bajar a una fila nueva devuelve las renovaciones (como en las reglas habituales).
    state.lowestY = state.active.y;
    state.lockResets = 0;
  }
}

/** Desplaza la pieza activa. Devuelve true si se movió. */
export function move(state, dx, dy = 0) {
  if (state.over || state.won || !state.active) return false;
  const next = { ...state.active, x: state.active.x + dx, y: state.active.y + dy };
  if (collides(state.board, next)) return false;
  state.active = next;
  if (dy > 0) trackDescent(state);
  touchLock(state);
  return true;
}

/** Gira la pieza activa (dir 1 = horario, -1 = antihorario) probando las patadas SRS. */
export function rotate(state, dir = 1) {
  if (state.over || state.won || !state.active) return false;
  const piece = state.active;
  if (piece.type === 'O') return false;
  const to = (piece.rot + (dir > 0 ? 1 : 3)) % 4;
  const table = piece.type === 'I' ? KICKS_I : KICKS_JLSTZ;
  for (const [kx, ky] of table[`${piece.rot}>${to}`]) {
    const next = { ...piece, rot: to, x: piece.x + kx, y: piece.y + ky };
    if (!collides(state.board, next)) {
      state.active = next;
      trackDescent(state);
      touchLock(state);
      return true;
    }
  }
  return false;
}

/** Fila en la que caería la pieza (para la sombra y la caída instantánea). */
export function dropDistance(state) {
  if (!state.active) return 0;
  let d = 0;
  while (!collides(state.board, { ...state.active, y: state.active.y + d + 1 })) d += 1;
  return d;
}

export const ghostOf = (state) => (state.active ? { ...state.active, y: state.active.y + dropDistance(state) } : null);

function levelFor(state) {
  return Math.min(MAX_LEVEL, state.startLevel + Math.floor(state.lines / LINES_PER_LEVEL));
}

/** Fija la pieza activa, limpia líneas, puntúa y saca la siguiente. Devuelve eventos. */
function lock(state) {
  const events = [];
  const cells = cellsOf(state.active);
  for (const [x, y] of cells) state.board[y * COLS + x] = state.active.type;
  state.pieces += 1;
  events.push({ type: 'lock', cells });
  if (cells.every(([, y]) => y < HIDDEN)) {
    state.over = true;
    state.active = null;
    events.push({ type: 'gameOver', reason: 'lockOut' });
    return events;
  }

  const full = [];
  for (let y = 0; y < ROWS; y += 1) {
    let filled = true;
    for (let x = 0; x < COLS; x += 1) if (!state.board[y * COLS + x]) filled = false;
    if (filled) full.push(y);
  }
  if (full.length) {
    const kept = [];
    for (let y = 0; y < ROWS; y += 1) if (!full.includes(y)) kept.push(state.board.slice(y * COLS, (y + 1) * COLS));
    const fresh = Array.from({ length: full.length }, () => new Array(COLS).fill(null));
    state.board = [...fresh, ...kept].flat();
    const level = state.level;
    const tetris = full.length === 4;
    let points = LINE_POINTS[full.length] * level;
    if (tetris && state.backToBack) points = Math.round(points * 1.5);
    state.combo += 1;
    if (state.combo > 0) points += 50 * state.combo * level;
    state.maxCombo = Math.max(state.maxCombo, state.combo);
    state.backToBack = tetris;
    if (tetris) state.tetrises += 1;
    state.score += points;
    state.lines += full.length;
    const nextLevel = levelFor(state);
    events.push({ type: 'lines', rows: full, count: full.length, points, combo: state.combo });
    if (nextLevel > state.level) events.push({ type: 'levelUp', level: nextLevel });
    state.level = nextLevel;
    const goal = MODES[state.mode].goalLines;
    if (state.lines >= goal) {
      state.won = true;
      state.active = null;
      events.push({ type: 'win' });
      return events;
    }
  } else {
    state.combo = -1;
  }

  state.canHold = true;
  spawn(state, takeNext(state), events);
  return events;
}

/** Caída instantánea: baja hasta el fondo y fija. */
export function hardDrop(state) {
  if (state.over || state.won || !state.active) return [];
  const d = dropDistance(state);
  state.active = { ...state.active, y: state.active.y + d };
  state.score += 2 * d;
  return [{ type: 'hardDrop', distance: d }, ...lock(state)];
}

/** Guarda la pieza activa (una vez por pieza) y saca la reservada o la siguiente. */
export function hold(state) {
  if (state.over || state.won || !state.active || !state.canHold) return [];
  const current = state.active.type;
  const events = [{ type: 'hold' }];
  const next = state.hold ?? takeNext(state);
  state.hold = current;
  spawn(state, next, events);
  state.canHold = false;
  return events;
}

/**
 * Avanza el tiempo `dt` segundos. `soft` = caída suave pulsada (20× más rápida,
 * 1 punto por casilla). Devuelve los eventos ocurridos.
 */
export function tick(state, dt, { soft = false } = {}) {
  if (state.over || state.won || !state.active) return [];
  state.time += dt;
  const events = [];
  const interval = soft ? Math.min(gravityInterval(state.level), 0.05) : gravityInterval(state.level);
  state.gravityAcc += dt;
  while (state.gravityAcc >= interval && !isGrounded(state)) {
    state.gravityAcc -= interval;
    state.active = { ...state.active, y: state.active.y + 1 };
    trackDescent(state);
    if (soft) state.score += 1;
  }
  if (isGrounded(state)) {
    state.gravityAcc = 0;
    state.lockTimer += dt;
    if (state.lockTimer >= LOCK_DELAY || state.lockResets >= MAX_LOCK_RESETS) events.push(...lock(state));
  } else {
    state.lockTimer = 0;
  }
  return events;
}

/** Próximas piezas visibles. */
export function preview(state, count = 3) {
  while (state.queue.length < count) refillBag(state);
  return state.queue.slice(0, count);
}

/** Tablero a partir de filas de texto ('.' vacío, cualquier otra letra = bloque). Para pruebas. */
export function boardFromRows(rows) {
  const board = emptyBoard();
  const offset = ROWS - rows.length;
  rows.forEach((row, r) => {
    [...row].forEach((ch, x) => {
      if (ch !== '.') board[(offset + r) * COLS + x] = ch === '#' ? 'Z' : ch;
    });
  });
  return board;
}
