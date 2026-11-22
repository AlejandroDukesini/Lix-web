/**
 * Botica de colores — motor puro (sin React) del rompecabezas de ordenar líquidos.
 *
 * Un frasco es un array de colores de abajo arriba; todos los frascos de un nivel
 * tienen la misma capacidad. Verter mueve la «racha» superior (las capas seguidas
 * del mismo color) a otro frasco que esté vacío o cuyo color de arriba coincida,
 * tanto como quepa. El nivel se resuelve cuando cada frasco está vacío o lleno de
 * un único color.
 */

export const keyOf = (tubes) => tubes.map((t) => t.join('')).join('|');

/** Clave canónica: el orden de los frascos no importa para la búsqueda. */
const canonical = (tubes) => tubes.map((t) => t.join('')).sort().join('|');

export function createState(level) {
  return { tubes: level.tubes.map((t) => [...t]), capacity: level.capacity };
}

/** Color y número de capas seguidas de arriba. */
export function topRun(tube) {
  if (!tube.length) return { color: null, count: 0 };
  const color = tube.at(-1);
  let count = 0;
  for (let i = tube.length - 1; i >= 0 && tube[i] === color; i -= 1) count += 1;
  return { color, count };
}

export const isUniformFull = (tube, capacity) => tube.length === capacity && tube.every((c) => c === tube[0]);

/**
 * ¿Se puede verter de `from` a `to`? Devuelve el motivo si no:
 * 'same' | 'empty' | 'full' | 'mismatch' | 'done' (el origen ya está terminado).
 */
export function checkPour(state, from, to) {
  const { tubes, capacity } = state;
  if (from === to) return { ok: false, reason: 'same' };
  const source = tubes[from];
  const target = tubes[to];
  if (!source?.length) return { ok: false, reason: 'empty' };
  if (isUniformFull(source, capacity)) return { ok: false, reason: 'done' };
  if (target.length >= capacity) return { ok: false, reason: 'full' };
  const run = topRun(source);
  if (target.length && target.at(-1) !== run.color) return { ok: false, reason: 'mismatch' };
  return { ok: true, color: run.color, amount: Math.min(run.count, capacity - target.length) };
}

/** Vierte y devuelve el estado nuevo (o null si no es válido). */
export function pour(state, from, to) {
  const check = checkPour(state, from, to);
  if (!check.ok) return null;
  const tubes = state.tubes.map((t) => t);
  tubes[from] = state.tubes[from].slice(0, state.tubes[from].length - check.amount);
  tubes[to] = [...state.tubes[to], ...Array(check.amount).fill(check.color)];
  return { ...state, tubes };
}

export function isSolved(state) {
  return state.tubes.every((t) => t.length === 0 || isUniformFull(t, state.capacity));
}

/** Movimientos válidos que tienen sentido (evita vaciar una racha completa en un frasco vacío). */
export function usefulMoves(state) {
  const moves = [];
  const { tubes } = state;
  for (let from = 0; from < tubes.length; from += 1) {
    const source = tubes[from];
    if (!source.length) continue;
    const run = topRun(source);
    let triedEmpty = false;
    for (let to = 0; to < tubes.length; to += 1) {
      const check = checkPour(state, from, to);
      if (!check.ok) continue;
      if (!tubes[to].length) {
        if (run.count === source.length) continue; // mover un frasco de un solo color a uno vacío no avanza
        if (triedEmpty) continue; // los frascos vacíos son intercambiables
        triedEmpty = true;
      }
      moves.push([from, to]);
    }
  }
  return moves;
}

/** Cuántas capas «bien colocadas» hay: heurística para ordenar la búsqueda. */
function score(state) {
  let s = 0;
  for (const tube of state.tubes) {
    for (let i = 1; i < tube.length; i += 1) if (tube[i] === tube[i - 1]) s += 1;
    if (isUniformFull(tube, state.capacity)) s += 2;
  }
  return s;
}

/**
 * Busca una solución (lista de [from, to]) desde `state`, o null si no la hay.
 * Búsqueda en profundidad con memoria y los movimientos más prometedores primero.
 * `budget` limita los estados explorados para que nunca bloquee la interfaz.
 */
export function solve(state, { budget = 200_000 } = {}) {
  const seen = new Set();
  const path = [];
  let explored = 0;
  let exhausted = false;
  const dfs = (current) => {
    if (isSolved(current)) return true;
    if (explored >= budget) {
      exhausted = true;
      return false;
    }
    const key = canonical(current.tubes);
    if (seen.has(key)) return false;
    seen.add(key);
    explored += 1;
    const options = usefulMoves(current)
      .map(([from, to]) => ({ from, to, next: pour(current, from, to) }))
      .sort((a, b) => score(b.next) - score(a.next));
    for (const option of options) {
      path.push([option.from, option.to]);
      if (dfs(option.next)) return true;
      path.pop();
    }
    return false;
  };
  const found = dfs(state);
  if (found) return { moves: [...path], exhausted: false };
  return { moves: null, exhausted };
}

/** ¿Queda alguna jugada válida? (si no, el jugador está atascado). */
export const hasAnyMove = (state) => usefulMoves(state).length > 0;
