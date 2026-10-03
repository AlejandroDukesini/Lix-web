/**
 * Motor de Sudoku (sin interfaz).
 *
 * Tablero: array de 81 números (0 = vacía), por filas. Las reglas clásicas:
 * cada fila, columna y bloque 3×3 contiene del 1 al 9 sin repetir.
 *
 * Incluye un resolvedor rápido (máscaras de bits, casilla con menos candidatos
 * primero), un contador de soluciones (para exigir solución única), un
 * graduador que resuelve como una persona —solo con técnicas lógicas— para
 * medir la dificultad real, un generador y transformaciones que crean tableros
 * nuevos conservando la solución única y la dificultad.
 */

export const SIZE = 9;
export const CELLS = 81;
export const ALL = 0x1ff; // candidatos 1–9 como bits 0–8

export const rowOf = (i) => Math.floor(i / 9);
export const colOf = (i) => i % 9;
export const boxOf = (i) => Math.floor(rowOf(i) / 3) * 3 + Math.floor(colOf(i) / 3);

/** Grupos (unidades): 9 filas, 9 columnas y 9 bloques, cada uno con sus 9 índices. */
export const UNITS = (() => {
  const units = [];
  for (let r = 0; r < 9; r += 1) units.push(Array.from({ length: 9 }, (_, c) => r * 9 + c));
  for (let c = 0; c < 9; c += 1) units.push(Array.from({ length: 9 }, (_, r) => r * 9 + c));
  for (let b = 0; b < 9; b += 1) {
    const r0 = Math.floor(b / 3) * 3;
    const c0 = (b % 3) * 3;
    units.push(Array.from({ length: 9 }, (_, k) => (r0 + Math.floor(k / 3)) * 9 + c0 + (k % 3)));
  }
  return units;
})();

/** Para cada casilla, las otras 20 que comparten fila, columna o bloque. */
export const PEERS = Array.from({ length: CELLS }, (_, i) => {
  const set = new Set();
  for (let k = 0; k < CELLS; k += 1) {
    if (k !== i && (rowOf(k) === rowOf(i) || colOf(k) === colOf(i) || boxOf(k) === boxOf(i))) set.add(k);
  }
  return [...set];
});

const bit = (v) => 1 << (v - 1);
const popcount = (m) => {
  let n = 0;
  for (let x = m; x; x &= x - 1) n += 1;
  return n;
};
const digitsOf = (mask) => {
  const out = [];
  for (let v = 1; v <= 9; v += 1) if (mask & bit(v)) out.push(v);
  return out;
};

export function parse(text) {
  const clean = text.replace(/\s/g, '');
  if (clean.length !== CELLS || /[^0-9.]/.test(clean)) throw new Error('Sudoku no válido');
  return Array.from(clean, (ch) => (ch === '.' ? 0 : Number(ch)));
}

export const serialize = (board) => board.map((v) => v || '.').join('');

/** Candidatos de una casilla vacía según sus vecinas. */
export function candidates(board, i) {
  let used = 0;
  for (const p of PEERS[i]) if (board[p]) used |= bit(board[p]);
  return ALL & ~used;
}

/** ¿Se puede poner `value` en `i` sin repetir en su fila, columna o bloque? */
export const isValidPlacement = (board, i, value) => PEERS[i].every((p) => board[p] !== value);

/** Casillas en conflicto: comparten valor con alguna vecina. */
export function conflicts(board) {
  const out = new Set();
  for (let i = 0; i < CELLS; i += 1) {
    if (!board[i]) continue;
    for (const p of PEERS[i]) if (board[p] === board[i]) out.add(i);
  }
  return out;
}

/** Tablero completo y sin conflictos (= resuelto según las reglas). */
export const isSolved = (board) => board.every(Boolean) && conflicts(board).size === 0;

/**
 * Búsqueda con retroceso: cuenta soluciones hasta `limit` y guarda la primera.
 * Rellena cada vez la casilla con menos candidatos.
 */
function search(board, limit, state) {
  let best = -1;
  let bestMask = 0;
  let bestCount = 10;
  for (let i = 0; i < CELLS; i += 1) {
    if (board[i]) continue;
    const mask = candidates(board, i);
    const n = popcount(mask);
    if (n === 0) return;
    if (n < bestCount) {
      best = i;
      bestMask = mask;
      bestCount = n;
      if (n === 1) break;
    }
  }
  if (best === -1) {
    state.count += 1;
    if (!state.solution) state.solution = [...board];
    return;
  }
  for (const v of state.order ? state.order(bestMask) : digitsOf(bestMask)) {
    board[best] = v;
    search(board, limit, state);
    board[best] = 0;
    if (state.count >= limit) return;
  }
}

export function solve(board) {
  if (conflicts(board).size) return null;
  const state = { count: 0, solution: null };
  search([...board], 1, state);
  return state.solution;
}

export function countSolutions(board, limit = 2) {
  if (conflicts(board).size) return 0;
  const state = { count: 0, solution: null };
  search([...board], limit, state);
  return state.count;
}

export const hasUniqueSolution = (board) => countSolutions(board, 2) === 1;

// --- Graduador: resolver como una persona -----------------------------------

export const DIFFICULTIES = Object.freeze([
  { id: 'facil', name: 'Fácil', technique: 'candidato único' },
  { id: 'medio', name: 'Medio', technique: 'casilla única en su grupo' },
  { id: 'dificil', name: 'Difícil', technique: 'bloqueos de candidatos y parejas' },
  { id: 'experto', name: 'Experto', technique: 'hay que hacer suposiciones' },
]);

/**
 * Resuelve solo con técnicas lógicas, en orden de dificultad, y devuelve la
 * dificultad de la técnica más exigente que necesitó. Si se atasca sin
 * terminar, el tablero exige suposiciones: «experto».
 */
export function grade(puzzle) {
  const board = [...puzzle];
  const cand = board.map((v, i) => (v ? 0 : candidates(board, i)));
  let level = 0;

  const place = (i, v) => {
    board[i] = v;
    cand[i] = 0;
    for (const p of PEERS[i]) cand[p] &= ~bit(v);
  };

  const nakedSingle = () => {
    for (let i = 0; i < CELLS; i += 1) {
      if (!board[i] && popcount(cand[i]) === 1) {
        place(i, digitsOf(cand[i])[0]);
        return true;
      }
    }
    return false;
  };

  const hiddenSingle = () => {
    for (const unit of UNITS) {
      for (let v = 1; v <= 9; v += 1) {
        const spots = unit.filter((i) => !board[i] && cand[i] & bit(v));
        if (spots.length === 1) {
          place(spots[0], v);
          return true;
        }
      }
    }
    return false;
  };

  // Eliminaciones: candidatos bloqueados (apuntadores / reclamantes) y parejas desnudas.
  const eliminate = () => {
    let changed = false;
    for (let b = 18; b < 27; b += 1) {
      const box = UNITS[b];
      for (let v = 1; v <= 9; v += 1) {
        const spots = box.filter((i) => !board[i] && cand[i] & bit(v));
        if (spots.length < 2) continue;
        for (const line of [rowOf, colOf]) {
          const id = line(spots[0]);
          if (!spots.every((i) => line(i) === id)) continue;
          const unit = UNITS[(line === rowOf ? 0 : 9) + id];
          for (const i of unit) {
            if (!board[i] && boxOf(i) !== b - 18 && cand[i] & bit(v)) {
              cand[i] &= ~bit(v);
              changed = true;
            }
          }
        }
      }
    }
    for (let u = 0; u < 18; u += 1) {
      const line = UNITS[u];
      for (let v = 1; v <= 9; v += 1) {
        const spots = line.filter((i) => !board[i] && cand[i] & bit(v));
        if (spots.length < 2 || !spots.every((i) => boxOf(i) === boxOf(spots[0]))) continue;
        for (const i of UNITS[18 + boxOf(spots[0])]) {
          if (!board[i] && !line.includes(i) && cand[i] & bit(v)) {
            cand[i] &= ~bit(v);
            changed = true;
          }
        }
      }
    }
    for (const unit of UNITS) {
      const pairs = unit.filter((i) => !board[i] && popcount(cand[i]) === 2);
      for (let a = 0; a < pairs.length; a += 1) {
        for (let b = a + 1; b < pairs.length; b += 1) {
          if (cand[pairs[a]] !== cand[pairs[b]]) continue;
          for (const i of unit) {
            if (!board[i] && i !== pairs[a] && i !== pairs[b] && cand[i] & cand[pairs[a]]) {
              cand[i] &= ~cand[pairs[a]];
              changed = true;
            }
          }
        }
      }
    }
    return changed;
  };

  for (;;) {
    if (board.every(Boolean)) break;
    if (nakedSingle()) continue;
    if (hiddenSingle()) {
      level = Math.max(level, 1);
      continue;
    }
    if (eliminate()) {
      level = Math.max(level, 2);
      continue;
    }
    level = 3;
    break;
  }
  return DIFFICULTIES[level].id;
}

// --- Generación y variaciones -------------------------------------------------

/** Generador pseudoaleatorio con semilla (mulberry32). */
export function createRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(list, rng) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Un tablero completo al azar. */
export function randomSolution(rng) {
  const state = { count: 0, solution: null, order: (mask) => shuffled(digitsOf(mask), rng) };
  search(Array(CELLS).fill(0), 1, state);
  return state.solution;
}

/**
 * Quita pistas al azar mientras la solución siga siendo única. Devuelve el
 * enunciado mínimo alcanzado en ese orden (para generar el banco de tableros).
 */
export function carve(solution, rng, minClues = 17) {
  const puzzle = [...solution];
  let clues = CELLS;
  for (const i of shuffled([...Array(CELLS).keys()], rng)) {
    if (clues <= minClues) break;
    const keep = puzzle[i];
    puzzle[i] = 0;
    if (hasUniqueSolution(puzzle)) clues -= 1;
    else puzzle[i] = keep;
  }
  return puzzle;
}

/**
 * Variación equivalente: permuta dígitos, filas dentro de su banda, bandas,
 * columnas dentro de su pila, pilas y, a veces, traspone. La solución sigue
 * siendo única y la dificultad (las técnicas necesarias) no cambia.
 */
export function transform(board, rng) {
  const digits = shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9], rng);
  const lines = () => shuffled([0, 1, 2], rng).flatMap((band) => shuffled([0, 1, 2], rng).map((k) => band * 3 + k));
  const rows = lines();
  const cols = lines();
  const transpose = rng() < 0.5;
  const out = Array(CELLS).fill(0);
  for (let r = 0; r < 9; r += 1) {
    for (let c = 0; c < 9; c += 1) {
      const [sr, sc] = transpose ? [cols[c], rows[r]] : [rows[r], cols[c]];
      const v = board[sr * 9 + sc];
      out[r * 9 + c] = v ? digits[v - 1] : 0;
    }
  }
  return out;
}

// --- Notas (lápiz) ------------------------------------------------------------

export const toggleNote = (notes, i, value) => notes.map((mask, k) => (k === i ? mask ^ bit(value) : mask));
export const hasNote = (mask, value) => Boolean(mask & bit(value));

/** Al escribir un número, se borra esa nota de las vecinas (como al hacerlo a mano). */
export function clearPeerNotes(notes, i, value) {
  const peers = new Set(PEERS[i]);
  return notes.map((mask, k) => (k === i ? 0 : peers.has(k) ? mask & ~bit(value) : mask));
}
