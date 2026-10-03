/**
 * Motor de HexaStack (sin interfaz, determinista con semilla).
 *
 * REGLAS
 *  1. El tablero es una rejilla de celdas hexagonales (coordenadas axiales q, r).
 *  2. Tienes una mano de 3 pilas. Cada pila es una torre de fichas de colores;
 *     el color de arriba es el que cuenta. Colocas una pila en una celda vacía.
 *  3. Al colocarla, las pilas vecinas cuyo color de arriba coincide le pasan todas
 *     sus fichas de arriba de ese color (las de debajo se quedan). Las pilas que
 *     cambian de color de arriba vuelven a comprobar a sus vecinas: reacciones en cadena.
 *  4. Cuando una pila junta CLEAR_SIZE o más fichas del mismo color arriba, esas
 *     fichas desaparecen y puntúan.
 *  5. Cuando usas las tres pilas de la mano, llegan tres nuevas.
 *  6. La partida termina si no queda ninguna celda vacía.
 *
 * PUNTOS (todo se cuenta solo cuando ocurre de verdad)
 *  - Colocar: 1 punto por ficha de la pila colocada.
 *  - Despejar: 10 puntos por ficha despejada × multiplicador de cadena (1.º grupo ×1,
 *    2.º en la misma jugada ×2, …).
 *  - Racha: jugadas seguidas que despejan algo. Una jugada sin despejar la reinicia.
 *    Con racha ≥ 2 cada despeje suma además +5 × racha.
 */

export const CLEAR_SIZE = 10;
export const HAND_SIZE = 3;
export const COLORS = Object.freeze([
  // `side`: tono oscuro precalculado para el canto de cada ficha (sin filtros CSS, más ligero en móvil).
  // `glyph`: símbolo para no depender solo del color.
  { id: 0, name: 'coral', hex: '#ff7a7a', side: '#c4525a', glyph: '●' },
  { id: 1, name: 'ámbar', hex: '#ffc65c', side: '#c4903a', glyph: '▲' },
  { id: 2, name: 'menta', hex: '#5fd6a0', side: '#3c9c73', glyph: '■' },
  { id: 3, name: 'cielo', hex: '#5fb4ff', side: '#3b7fc0', glyph: '◆' },
  { id: 4, name: 'lavanda', hex: '#b28cff', side: '#7d5cc2', glyph: '★' },
  { id: 5, name: 'rosa', hex: '#ff8fd0', side: '#c25d98', glyph: '♥' },
]);

export const NEIGHBORS = Object.freeze([
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
]);
export const keyOf = (q, r) => `${q},${r}`;
export const parseKey = (key) => key.split(',').map(Number);

// --- Aleatoriedad con semilla (en el estado, para poder clonar y reproducir). ---
function random(state) {
  state.rng = (state.rng + 0x6d2b79f5) >>> 0;
  let t = state.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Celdas de un tablero hexagonal de radio `radius`, sin las bloqueadas. */
export function boardCells(radius, blocked = []) {
  const cells = [];
  for (let q = -radius; q <= radius; q += 1) {
    for (let r = Math.max(-radius, -q - radius); r <= Math.min(radius, -q + radius); r += 1) {
      if (!blocked.includes(keyOf(q, r))) cells.push(keyOf(q, r));
    }
  }
  return cells;
}

export const topColor = (stack) => (stack?.length ? stack[stack.length - 1] : null);

/** Número de fichas seguidas del color de arriba. */
export function topRun(stack) {
  if (!stack?.length) return 0;
  const color = topColor(stack);
  let n = 0;
  for (let i = stack.length - 1; i >= 0 && stack[i] === color; i -= 1) n += 1;
  return n;
}

/**
 * Pila nueva para la mano. Para que no dependa solo del azar, los colores que
 * ya están arriba en el tablero son más probables (siempre hay jugadas útiles).
 * Ninguna pila supera `maxStack` fichas (< CLEAR_SIZE): nunca se despeja sola.
 */
function makeStack(state) {
  const { colors } = state.config;
  const tops = Object.values(state.board)
    .map(topColor)
    .filter((c) => c !== null);
  const pickColor = () => (tops.length && random(state) < 0.55 ? tops[Math.floor(random(state) * tops.length)] : Math.floor(random(state) * colors));
  const size = 2 + Math.floor(random(state) * (state.config.maxStack - 1));
  const layers = 1 + Math.floor(random(state) * Math.min(3, colors));
  const stack = [];
  let color = pickColor();
  for (let layer = 0; layer < layers; layer += 1) {
    const remaining = size - stack.length;
    const count = layer === layers - 1 ? remaining : 1 + Math.floor(random(state) * Math.max(1, remaining - (layers - layer - 1)));
    for (let i = 0; i < count && stack.length < size; i += 1) stack.push(color);
    let next = Math.floor(random(state) * colors);
    if (next === color) next = (next + 1) % colors;
    color = layer === layers - 2 ? pickColor() : next;
  }
  return stack;
}

function dealHand(state) {
  state.hand = Array.from({ length: HAND_SIZE }, () => makeStack(state));
}

/**
 * config: { radius, blocked, colors, maxStack, target (fichas a despejar; null = libre), prefill }
 */
export function createGame(config, seed = 1) {
  const state = {
    config: { maxStack: 6, colors: 4, blocked: [], target: null, prefill: 0, ...config },
    rng: seed >>> 0,
    board: {},
    hand: [],
    score: 0,
    cleared: 0,
    groups: 0,
    streak: 0,
    bestStreak: 0,
    moves: 0,
    status: 'playing', // 'playing' | 'won' | 'over'
  };
  for (const key of boardCells(state.config.radius, state.config.blocked)) state.board[key] = [];
  // Algunas pilas iniciales para empezar con jugadas posibles (sin despejes gratis).
  const keys = Object.keys(state.board);
  for (let i = 0; i < state.config.prefill; i += 1) {
    const key = keys[Math.floor(random(state) * keys.length)];
    if (!state.board[key].length) state.board[key] = makeStack(state).slice(0, 3);
  }
  dealHand(state);
  return state;
}

export const emptyCells = (state) => Object.keys(state.board).filter((key) => !state.board[key].length);

export function neighborsOf(state, key) {
  const [q, r] = parseKey(key);
  return NEIGHBORS.map(([dq, dr]) => keyOf(q + dq, r + dr)).filter((k) => k in state.board);
}

/**
 * Coloca la pila `handIndex` en la celda `key` y resuelve fusiones y despejes.
 * Devuelve { state, events } o null si la jugada no es válida.
 * events: [{ type: 'place' | 'merge' | 'clear' | 'deal' | 'won' | 'over', … }]
 */
export function place(prev, handIndex, key) {
  if (prev.status !== 'playing') return null;
  const stack = prev.hand[handIndex];
  if (!stack || !(key in prev.board) || prev.board[key].length) return null;
  const state = structuredClone(prev);
  const events = [{ type: 'place', key, tiles: stack.length }];
  state.board[key] = [...stack];
  state.hand.splice(handIndex, 1);
  state.score += stack.length;
  state.moves += 1;

  // Resolución en cadena: cola de celdas cuyo color de arriba puede atraer a sus vecinas.
  const queue = [key];
  let chain = 0;
  let clearedThisMove = 0;
  let guard = 0;
  while (queue.length && guard < 500) {
    guard += 1;
    const cell = queue.shift();
    const color = topColor(state.board[cell]);
    if (color === null) continue;
    for (const n of neighborsOf(state, cell)) {
      if (topColor(state.board[n]) !== color) continue;
      const run = topRun(state.board[n]);
      const moved = state.board[n].splice(state.board[n].length - run, run);
      state.board[cell].push(...moved);
      events.push({ type: 'merge', from: n, to: cell, tiles: run, color });
      if (state.board[n].length) queue.push(n);
    }
    const run = topRun(state.board[cell]);
    if (run >= CLEAR_SIZE) {
      chain += 1;
      state.board[cell].splice(state.board[cell].length - run, run);
      clearedThisMove += run;
      state.cleared += run;
      state.groups += 1;
      state.score += run * 10 * chain;
      events.push({ type: 'clear', key: cell, tiles: run, color, chain });
      // La nueva cima y las vecinas pueden reaccionar.
      if (state.board[cell].length) queue.push(cell);
      for (const n of neighborsOf(state, cell)) if (state.board[n].length) queue.push(n);
    }
  }

  if (clearedThisMove) {
    state.streak += 1;
    state.bestStreak = Math.max(state.bestStreak, state.streak);
    if (state.streak >= 2) state.score += 5 * state.streak;
  } else state.streak = 0;

  if (!state.hand.length) {
    dealHand(state);
    events.push({ type: 'deal' });
  }
  if (state.config.target !== null && state.cleared >= state.config.target) {
    state.status = 'won';
    events.push({ type: 'won' });
  } else if (!emptyCells(state).length) {
    state.status = 'over';
    events.push({ type: 'over' });
  }
  return { state, events };
}
