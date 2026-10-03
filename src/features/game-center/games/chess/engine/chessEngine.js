/**
 * Motor de reglas de ajedrez. Sin dependencias y sin estado global.
 *
 * Tablero: array de 64 casillas en orden FEN (0 = a8, 7 = h8, 56 = a1, 63 = h1).
 * Piezas: 'P N B R Q K' blancas, 'p n b r q k' negras, null = vacía.
 *
 * Implementa todas las reglas: movimientos de cada pieza, capturas, jaque,
 * jaque mate, ahogado, enroque (con casillas atacadas), captura al paso,
 * promoción, regla de los 50 movimientos, triple repetición y material
 * insuficiente. Validado con perft (tests/chessEngine.test.js).
 */

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export const WHITE = 'w';
export const BLACK = 'b';

const FILES = 'abcdefgh';
export const fileOf = (sq) => sq & 7;
export const rankOf = (sq) => 8 - (sq >> 3); // 1..8
export const squareName = (sq) => `${FILES[fileOf(sq)]}${rankOf(sq)}`;
export const squareIndex = (name) => (8 - Number(name[1])) * 8 + FILES.indexOf(name[0]);

export const colorOf = (piece) => (piece ? (piece === piece.toUpperCase() ? WHITE : BLACK) : null);
export const typeOf = (piece) => (piece ? piece.toLowerCase() : null);
const opposite = (color) => (color === WHITE ? BLACK : WHITE);
const pieceOf = (type, color) => (color === WHITE ? type.toUpperCase() : type);

const KNIGHT = [
  [-2, -1],
  [-2, 1],
  [-1, -2],
  [-1, 2],
  [1, -2],
  [1, 2],
  [2, -1],
  [2, 1],
];
const KING = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];
const ROOK_DIRS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];
const BISHOP_DIRS = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

// --- FEN ------------------------------------------------------------------------

export function parseFEN(fen) {
  const [placement, turn = 'w', castling = '-', ep = '-', half = '0', full = '1'] = fen.trim().split(/\s+/);
  const board = new Array(64).fill(null);
  const rows = placement.split('/');
  if (rows.length !== 8) throw new Error('FEN no válido');
  rows.forEach((row, r) => {
    let f = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) f += Number(ch);
      else {
        if (!/[pnbrqkPNBRQK]/.test(ch) || f > 7) throw new Error('FEN no válido');
        board[r * 8 + f] = ch;
        f += 1;
      }
    }
    if (f !== 8) throw new Error('FEN no válido');
  });
  return {
    board,
    turn: turn === 'b' ? BLACK : WHITE,
    castling: {
      K: castling.includes('K'),
      Q: castling.includes('Q'),
      k: castling.includes('k'),
      q: castling.includes('q'),
    },
    ep: ep === '-' ? null : squareIndex(ep),
    halfmove: Number(half) || 0,
    fullmove: Number(full) || 1,
  };
}

/** Clave de posición para la repetición: piezas, turno, enroques y captura al paso. */
export function positionKey(state) {
  let placement = '';
  for (let r = 0; r < 8; r += 1) {
    let empty = 0;
    for (let f = 0; f < 8; f += 1) {
      const piece = state.board[r * 8 + f];
      if (piece) {
        if (empty) placement += empty;
        placement += piece;
        empty = 0;
      } else empty += 1;
    }
    if (empty) placement += empty;
    if (r < 7) placement += '/';
  }
  const c = state.castling;
  const castling = `${c.K ? 'K' : ''}${c.Q ? 'Q' : ''}${c.k ? 'k' : ''}${c.q ? 'q' : ''}` || '-';
  // La captura al paso solo cuenta si realmente es posible (regla FIDE de repetición).
  const ep = state.ep !== null && hasEnPassantCapture(state) ? squareName(state.ep) : '-';
  return `${placement} ${state.turn} ${castling} ${ep}`;
}

export function toFEN(state) {
  const key = positionKey(state).split(' ');
  key[3] = state.ep !== null ? squareName(state.ep) : '-';
  return `${key.join(' ')} ${state.halfmove} ${state.fullmove}`;
}

// --- Ataques --------------------------------------------------------------------

const inside = (r, f) => r >= 0 && r < 8 && f >= 0 && f < 8;

/** ¿Ataca alguna pieza de `by` la casilla `sq`? */
export function isAttacked(board, sq, by) {
  const r = sq >> 3;
  const f = sq & 7;
  // Peones: un peón blanco ataca hacia arriba (fila menor en el array).
  const pawnRow = by === WHITE ? r + 1 : r - 1;
  for (const df of [-1, 1]) {
    if (inside(pawnRow, f + df) && board[pawnRow * 8 + f + df] === pieceOf('p', by)) return true;
  }
  for (const [dr, df] of KNIGHT) {
    if (inside(r + dr, f + df) && board[(r + dr) * 8 + f + df] === pieceOf('n', by)) return true;
  }
  for (const [dr, df] of KING) {
    if (inside(r + dr, f + df) && board[(r + dr) * 8 + f + df] === pieceOf('k', by)) return true;
  }
  const rays = (dirs, types) => {
    for (const [dr, df] of dirs) {
      let rr = r + dr;
      let ff = f + df;
      while (inside(rr, ff)) {
        const piece = board[rr * 8 + ff];
        if (piece) {
          if (colorOf(piece) === by && types.includes(typeOf(piece))) return true;
          break;
        }
        rr += dr;
        ff += df;
      }
    }
    return false;
  };
  return rays(ROOK_DIRS, ['r', 'q']) || rays(BISHOP_DIRS, ['b', 'q']);
}

export function kingSquare(board, color) {
  return board.indexOf(pieceOf('k', color));
}

export function inCheck(state, color = state.turn) {
  const king = kingSquare(state.board, color);
  return king >= 0 && isAttacked(state.board, king, opposite(color));
}

// --- Generación de movimientos -------------------------------------------------

/**
 * Movimiento: { from, to, piece, captured, promotion, flag }
 *   flag: 'normal' | 'double' (avance doble) | 'ep' (al paso) | 'castle-k' | 'castle-q'
 */
function pseudoMoves(state) {
  const { board, turn } = state;
  const moves = [];
  const add = (from, to, flag = 'normal', captured = board[to]) => {
    const piece = board[from];
    const toRank = rankOf(to);
    if (typeOf(piece) === 'p' && (toRank === 8 || toRank === 1)) {
      for (const promotion of ['q', 'r', 'b', 'n']) moves.push({ from, to, piece, captured, promotion, flag });
    } else moves.push({ from, to, piece, captured, promotion: null, flag });
  };

  for (let sq = 0; sq < 64; sq += 1) {
    const piece = board[sq];
    if (!piece || colorOf(piece) !== turn) continue;
    const r = sq >> 3;
    const f = sq & 7;
    const type = typeOf(piece);

    if (type === 'p') {
      const dir = turn === WHITE ? -1 : 1;
      const startRow = turn === WHITE ? 6 : 1;
      const one = (r + dir) * 8 + f;
      if (inside(r + dir, f) && !board[one]) {
        add(sq, one);
        const two = (r + 2 * dir) * 8 + f;
        if (r === startRow && !board[two]) add(sq, two, 'double');
      }
      for (const df of [-1, 1]) {
        if (!inside(r + dir, f + df)) continue;
        const target = (r + dir) * 8 + f + df;
        if (board[target] && colorOf(board[target]) !== turn) add(sq, target);
        else if (target === state.ep) add(sq, target, 'ep', pieceOf('p', opposite(turn)));
      }
      continue;
    }

    if (type === 'n' || type === 'k') {
      for (const [dr, df] of type === 'n' ? KNIGHT : KING) {
        if (!inside(r + dr, f + df)) continue;
        const target = (r + dr) * 8 + f + df;
        if (!board[target] || colorOf(board[target]) !== turn) add(sq, target);
      }
      if (type === 'k') addCastling(state, sq, moves);
      continue;
    }

    const dirs = type === 'r' ? ROOK_DIRS : type === 'b' ? BISHOP_DIRS : [...ROOK_DIRS, ...BISHOP_DIRS];
    for (const [dr, df] of dirs) {
      let rr = r + dr;
      let ff = f + df;
      while (inside(rr, ff)) {
        const target = rr * 8 + ff;
        if (board[target]) {
          if (colorOf(board[target]) !== turn) add(sq, target);
          break;
        }
        add(sq, target);
        rr += dr;
        ff += df;
      }
    }
  }
  return moves;
}

function addCastling(state, kingSq, moves) {
  const { board, turn, castling } = state;
  const home = turn === WHITE ? 60 : 4;
  if (kingSq !== home) return;
  const enemy = opposite(turn);
  if (isAttacked(board, home, enemy)) return;
  const king = board[home];
  const rook = pieceOf('r', turn);
  const short = turn === WHITE ? castling.K : castling.k;
  const long = turn === WHITE ? castling.Q : castling.q;
  // Corto: f y g vacías y no atacadas.
  if (short && board[home + 3] === rook && !board[home + 1] && !board[home + 2]) {
    if (!isAttacked(board, home + 1, enemy) && !isAttacked(board, home + 2, enemy)) {
      moves.push({ from: home, to: home + 2, piece: king, captured: null, promotion: null, flag: 'castle-k' });
    }
  }
  // Largo: b, c y d vacías; c y d no atacadas (b puede estarlo).
  if (long && board[home - 4] === rook && !board[home - 1] && !board[home - 2] && !board[home - 3]) {
    if (!isAttacked(board, home - 1, enemy) && !isAttacked(board, home - 2, enemy)) {
      moves.push({ from: home, to: home - 2, piece: king, captured: null, promotion: null, flag: 'castle-q' });
    }
  }
}

/** Aplica un movimiento (se asume pseudo-legal) y devuelve un estado nuevo. */
export function makeMove(state, move) {
  const board = state.board.slice();
  const { from, to, piece, flag } = move;
  const turn = state.turn;
  board[from] = null;
  board[to] = move.promotion ? pieceOf(move.promotion, turn) : piece;
  if (flag === 'ep') board[to + (turn === WHITE ? 8 : -8)] = null;
  if (flag === 'castle-k') {
    board[to - 1] = board[to + 1];
    board[to + 1] = null;
  }
  if (flag === 'castle-q') {
    board[to + 1] = board[to - 2];
    board[to - 2] = null;
  }

  const castling = { ...state.castling };
  const touch = (sq) => {
    if (sq === 60) castling.K = castling.Q = false;
    if (sq === 4) castling.k = castling.q = false;
    if (sq === 63) castling.K = false;
    if (sq === 56) castling.Q = false;
    if (sq === 7) castling.k = false;
    if (sq === 0) castling.q = false;
  };
  touch(from);
  touch(to);

  const isPawn = typeOf(piece) === 'p';
  return {
    board,
    turn: opposite(turn),
    castling,
    ep: flag === 'double' ? (from + to) / 2 : null,
    halfmove: isPawn || move.captured ? 0 : state.halfmove + 1,
    fullmove: turn === BLACK ? state.fullmove + 1 : state.fullmove,
  };
}

/** Movimientos legales: los que no dejan al propio rey en jaque. */
export function legalMoves(state) {
  return pseudoMoves(state).filter((move) => !inCheck(makeMove(state, move), state.turn));
}

function hasEnPassantCapture(state) {
  return pseudoMoves(state).some((move) => move.flag === 'ep' && !inCheck(makeMove(state, move), state.turn));
}

export function movesFrom(state, square) {
  return legalMoves(state).filter((move) => move.from === square);
}

// --- Final de partida ----------------------------------------------------------

/** Material insuficiente para dar mate: K-K, K+menor-K, K+A-K+A con alfiles del mismo color. */
export function insufficientMaterial(board) {
  const minors = [];
  for (let sq = 0; sq < 64; sq += 1) {
    const type = typeOf(board[sq]);
    if (!type || type === 'k') continue;
    if (type === 'p' || type === 'r' || type === 'q') return false;
    minors.push({ type, sq });
  }
  if (minors.length <= 1) return true;
  if (minors.every((m) => m.type === 'b')) {
    const shade = (sq) => ((sq >> 3) + (sq & 7)) % 2;
    return minors.every((m) => shade(m.sq) === shade(minors[0].sq));
  }
  return false;
}

/**
 * Resultado de la posición.
 *   { over: false, check } o
 *   { over: true, result: '1-0' | '0-1' | '1/2-1/2', reason }
 * `repetitions`: veces que ha aparecido la posición actual (para la triple repetición).
 */
export function evaluateStatus(state, repetitions = 1) {
  const moves = legalMoves(state);
  const check = inCheck(state);
  if (moves.length === 0) {
    if (check) return { over: true, result: state.turn === WHITE ? '0-1' : '1-0', reason: 'checkmate', check };
    return { over: true, result: '1/2-1/2', reason: 'stalemate', check };
  }
  if (insufficientMaterial(state.board)) return { over: true, result: '1/2-1/2', reason: 'insufficient', check };
  if (state.halfmove >= 100) return { over: true, result: '1/2-1/2', reason: 'fifty-moves', check };
  if (repetitions >= 3) return { over: true, result: '1/2-1/2', reason: 'repetition', check };
  return { over: false, check };
}

// --- Notación algebraica ------------------------------------------------------

const SAN_PIECE = { n: 'N', b: 'B', r: 'R', q: 'Q', k: 'K' };

/** Notación algebraica estándar (SAN) de un movimiento legal en `state`. */
export function toSAN(state, move, legal = legalMoves(state)) {
  let san;
  if (move.flag === 'castle-k') san = 'O-O';
  else if (move.flag === 'castle-q') san = 'O-O-O';
  else {
    const type = typeOf(move.piece);
    const capture = Boolean(move.captured);
    if (type === 'p') {
      san = `${capture ? `${FILES[fileOf(move.from)]}x` : ''}${squareName(move.to)}`;
      if (move.promotion) san += `=${SAN_PIECE[move.promotion]}`;
    } else {
      const rivals = legal.filter((m) => m.to === move.to && m.piece === move.piece && m.from !== move.from);
      let disambiguation = '';
      if (rivals.length) {
        const sameFile = rivals.some((m) => fileOf(m.from) === fileOf(move.from));
        const sameRank = rivals.some((m) => rankOf(m.from) === rankOf(move.from));
        if (!sameFile) disambiguation = FILES[fileOf(move.from)];
        else if (!sameRank) disambiguation = String(rankOf(move.from));
        else disambiguation = squareName(move.from);
      }
      san = `${SAN_PIECE[type]}${disambiguation}${capture ? 'x' : ''}${squareName(move.to)}`;
    }
  }
  const next = makeMove(state, move);
  if (inCheck(next)) san += legalMoves(next).length === 0 ? '#' : '+';
  return san;
}

// --- Partida --------------------------------------------------------------------

/** Partida completa: estado, historial y conteo de posiciones para la repetición. */
export function createGame(fen = START_FEN) {
  const state = parseFEN(fen);
  const key = positionKey(state);
  return { state, history: [], positions: { [key]: 1 }, status: evaluateStatus(state, 1) };
}

/**
 * Juega un movimiento identificado por origen, destino y promoción.
 * Devuelve la partida nueva, o null si el movimiento es ilegal o la partida terminó.
 */
export function playMove(game, { from, to, promotion = null }) {
  if (game.status.over) return null;
  const legal = legalMoves(game.state);
  const move = legal.find((m) => m.from === from && m.to === to && (m.promotion ?? null) === (m.promotion ? promotion ?? 'q' : null));
  if (!move) return null;
  const san = toSAN(game.state, move, legal);
  const state = makeMove(game.state, move);
  const key = positionKey(state);
  const positions = { ...game.positions, [key]: (game.positions[key] ?? 0) + 1 };
  return {
    state,
    history: [...game.history, { ...move, san, color: game.state.turn }],
    positions,
    status: evaluateStatus(state, positions[key]),
  };
}

/** ¿Este movimiento requiere elegir pieza de promoción? */
export function needsPromotion(game, from, to) {
  return legalMoves(game.state).some((m) => m.from === from && m.to === to && m.promotion);
}

/** Número de nodos hoja a profundidad `depth`: la prueba estándar de corrección de un generador. */
export function perft(state, depth) {
  if (depth === 0) return 1;
  const moves = legalMoves(state);
  if (depth === 1) return moves.length;
  let nodes = 0;
  for (const move of moves) nodes += perft(makeMove(state, move), depth - 1);
  return nodes;
}
