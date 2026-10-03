/**
 * IA local de ajedrez: negamax con poda alfa-beta, ordenación de jugadas
 * (capturas MVV-LVA primero), búsqueda de quietud en capturas y tablas de
 * posición por pieza. Profundización iterativa con límite de tiempo, así que
 * siempre devuelve una jugada aunque la posición sea complicada.
 *
 * Se ejecuta en un Web Worker (ai.worker.js) para no bloquear la interfaz.
 * Las tablas posicionales son valores propios, inspirados en principios
 * clásicos (centralizar caballos, enrocar, avanzar peones).
 */
import { WHITE, colorOf, inCheck, legalMoves, makeMove, typeOf } from './chessEngine.js';

export { AI_LEVELS, findLevel } from './aiLevels.js';

const VALUE = { p: 100, n: 320, b: 335, r: 500, q: 900, k: 0 };
const MATE = 100_000;

// Tablas desde el punto de vista de las blancas (índice 0 = a8).
const PST = {
  p: [
    0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 12, 12, 20, 32, 32, 20, 12, 12, 6, 6, 10, 26, 26, 10, 6, 6, 0, 0,
    4, 22, 22, 4, 0, 0, 4, -4, -8, 2, 2, -8, -4, 4, 4, 8, 8, -18, -18, 8, 8, 4, 0, 0, 0, 0, 0, 0, 0, 0,
  ],
  n: [
    -50, -38, -30, -30, -30, -30, -38, -50, -38, -18, 0, 2, 2, 0, -18, -38, -30, 2, 12, 16, 16, 12, 2, -30, -30, 6, 16, 22, 22,
    16, 6, -30, -30, 2, 16, 22, 22, 16, 2, -30, -30, 6, 12, 16, 16, 12, 6, -30, -38, -18, 2, 6, 6, 2, -18, -38, -50, -36, -30,
    -30, -30, -30, -36, -50,
  ],
  b: [
    -20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 6, 10, 10, 6, 0, -10, -10, 6, 6, 10, 10, 6, 6,
    -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 6, 0, 0, 0, 0, 6, -10, -20, -10, -12, -10, -10,
    -12, -10, -20,
  ],
  r: [
    0, 0, 0, 0, 0, 0, 0, 0, 6, 12, 12, 12, 12, 12, 12, 6, -6, 0, 0, 0, 0, 0, 0, -6, -6, 0, 0, 0, 0, 0, 0, -6, -6, 0, 0, 0, 0, 0,
    0, -6, -6, 0, 0, 0, 0, 0, 0, -6, -6, 0, 0, 0, 0, 0, 0, -6, 0, 0, 2, 6, 6, 2, 0, 0,
  ],
  q: [
    -20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0,
    5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20,
  ],
  k: [
    -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30,
    -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 16, 16,
    -4, -4, -4, -4, 16, 16, 18, 28, 12, -4, 0, 8, 30, 20,
  ],
  // Rey en el final: centralizarse.
  kEnd: [
    -50, -30, -30, -30, -30, -30, -30, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -10,
    30, 40, 40, 30, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -30, 0, 0, 0, 0, -30,
    -30, -50, -30, -30, -30, -30, -30, -30, -50,
  ],
};

const mirror = (sq) => (7 - (sq >> 3)) * 8 + (sq & 7);

/** Evaluación estática desde el punto de vista del bando que mueve (centipeones). */
export function evaluate(state) {
  let score = 0;
  let nonPawn = 0;
  for (let sq = 0; sq < 64; sq += 1) {
    const type = typeOf(state.board[sq]);
    if (type && type !== 'p' && type !== 'k') nonPawn += VALUE[type];
  }
  const endgame = nonPawn <= 1300;
  for (let sq = 0; sq < 64; sq += 1) {
    const piece = state.board[sq];
    if (!piece) continue;
    const type = typeOf(piece);
    const white = colorOf(piece) === WHITE;
    const table = type === 'k' && endgame ? PST.kEnd : PST[type];
    const value = VALUE[type] + table[white ? sq : mirror(sq)];
    score += white ? value : -value;
  }
  return state.turn === WHITE ? score : -score;
}

const orderScore = (move) =>
  (move.captured ? 10 * VALUE[typeOf(move.captured)] - VALUE[typeOf(move.piece)] + 1000 : 0) + (move.promotion ? 800 : 0);

function ordered(moves, first) {
  return moves
    .map((move) => ({ move, score: orderScore(move) + (first && same(move, first) ? 100_000 : 0) }))
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.move);
}

const same = (a, b) => a.from === b.from && a.to === b.to && a.promotion === b.promotion;

class Timeout extends Error {}

/**
 * Busca la mejor jugada.
 *   options: { depth (profundidad máxima), timeMs (tope), quiescence (ver recapturas),
 *              randomChance (jugada legal al azar), randomness + margin (elegir entre las
 *              jugadas razonables), rng } — ver aiLevels.js
 * Devuelve { move, score, depth } o { move: null } si no hay jugadas.
 */
export function findBestMove(
  state,
  { depth = 3, timeMs = 1500, quiescence = true, randomChance = 0, randomness = 0, margin, rng = Math.random, now = () => Date.now() } = {},
) {
  const root = legalMoves(state);
  if (root.length === 0) return { move: null, score: 0, depth: 0 };
  // Niveles iniciales: a veces juegan cualquier jugada legal (nunca una ilegal).
  if (randomChance > 0 && rng() < randomChance) {
    return { move: root[Math.floor(rng() * root.length)], score: 0, depth: 0, random: true };
  }
  const deadline = now() + timeMs;
  let nodes = 0;

  const quiesce = (s, alpha, beta, qDepth) => {
    nodes += 1;
    const stand = evaluate(s);
    if (stand >= beta) return beta;
    if (alpha < stand) alpha = stand;
    if (qDepth <= 0) return alpha;
    const captures = legalMoves(s).filter((m) => m.captured || m.promotion);
    for (const move of ordered(captures)) {
      const score = -quiesce(makeMove(s, move), -beta, -alpha, qDepth - 1);
      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }
    return alpha;
  };

  const search = (s, d, alpha, beta, ply) => {
    nodes += 1;
    if ((nodes & 1023) === 0 && now() > deadline) throw new Timeout();
    const moves = legalMoves(s);
    if (moves.length === 0) return inCheck(s) ? -MATE + ply : 0;
    if (s.halfmove >= 100) return 0;
    if (d === 0) return quiescence ? quiesce(s, alpha, beta, 4) : evaluate(s);
    for (const move of ordered(moves)) {
      const score = -search(makeMove(s, move), d - 1, -beta, -alpha, ply + 1);
      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }
    return alpha;
  };

  let best = { move: root[0], score: -Infinity, depth: 0 };
  let previousBest = null;
  for (let d = 1; d <= depth; d += 1) {
    try {
      const scored = [];
      let alpha = -Infinity;
      for (const move of ordered(root, previousBest)) {
        // Con factor de error hace falta la puntuación exacta de cada jugada (ventana completa);
        // sin él basta con saber si mejora la mejor encontrada (ventana alfa-beta, mucho más rápida).
        const score = -search(makeMove(state, move), d - 1, -Infinity, randomness > 0 ? Infinity : -alpha, 1);
        scored.push({ move, score });
        if (score > alpha) alpha = score;
      }
      scored.sort((a, b) => b.score - a.score);
      best = { move: scored[0].move, score: scored[0].score, depth: d, scored };
      previousBest = best.move;
      if (Math.abs(best.score) > MATE - 100) break;
    } catch (error) {
      if (!(error instanceof Timeout)) throw error;
      break;
    }
  }

  // Niveles bajos: a veces elige entre las jugadas razonables, nunca regala un mate evidente.
  if (randomness > 0 && best.scored && rng() < randomness) {
    const allowed = margin ?? 60 + 240 * randomness;
    const candidates = best.scored.filter((entry) => entry.score >= best.score - allowed && entry.score > -MATE + 100);
    const pick = candidates[Math.floor(rng() * candidates.length)];
    if (pick) return { move: pick.move, score: pick.score, depth: best.depth, nodes };
  }
  return { move: best.move, score: best.score, depth: best.depth, nodes };
}
