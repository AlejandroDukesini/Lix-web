import { describe, expect, it } from 'vitest';
import {
  START_FEN,
  createGame,
  evaluateStatus,
  inCheck,
  legalMoves,
  needsPromotion,
  parseFEN,
  perft,
  playMove,
  squareIndex,
  toFEN,
} from '../engine/chessEngine.js';
import { findBestMove } from '../engine/chessAI.js';

const sq = squareIndex;
const play = (game, ...moves) =>
  moves.reduce((g, text) => {
    const next = playMove(g, { from: sq(text.slice(0, 2)), to: sq(text.slice(2, 4)), promotion: text[4] ?? null });
    if (!next) throw new Error(`Movimiento ilegal en la prueba: ${text}`);
    return next;
  }, game);
const sans = (game) => game.history.map((m) => m.san);

describe('generador de movimientos (perft)', () => {
  // Valores de referencia publicados por la comunidad de programación de ajedrez.
  it('posición inicial', () => {
    const state = parseFEN(START_FEN);
    expect(perft(state, 1)).toBe(20);
    expect(perft(state, 2)).toBe(400);
    expect(perft(state, 3)).toBe(8902);
  });

  it('«Kiwipete»: enroques, capturas al paso y promociones', () => {
    const state = parseFEN('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1');
    expect(perft(state, 1)).toBe(48);
    expect(perft(state, 2)).toBe(2039);
    expect(perft(state, 3)).toBe(97862);
  });

  it('final de torres con capturas al paso y clavadas', () => {
    const state = parseFEN('8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1');
    expect(perft(state, 1)).toBe(14);
    expect(perft(state, 2)).toBe(191);
    expect(perft(state, 3)).toBe(2812);
    expect(perft(state, 4)).toBe(43238);
  });

  it('promociones con jaque y enroque prohibido', () => {
    const state = parseFEN('r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1');
    expect(perft(state, 1)).toBe(6);
    expect(perft(state, 2)).toBe(264);
    expect(perft(state, 3)).toBe(9467);
  });

  it('posición 5', () => {
    const state = parseFEN('rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8');
    expect(perft(state, 1)).toBe(44);
    expect(perft(state, 2)).toBe(1486);
  });
});

describe('reglas', () => {
  it('rechaza movimientos ilegales y respeta los turnos', () => {
    const game = createGame();
    expect(playMove(game, { from: sq('e2'), to: sq('e5') })).toBeNull(); // el peón no avanza tres
    expect(playMove(game, { from: sq('e7'), to: sq('e5') })).toBeNull(); // no es el turno de las negras
    expect(playMove(game, { from: sq('b1'), to: sq('d2') })).toBeNull(); // casilla ocupada por pieza propia
    const after = play(game, 'e2e4');
    expect(after.state.turn).toBe('b');
    expect(playMove(after, { from: sq('d2'), to: sq('d4') })).toBeNull(); // otra vez las blancas: no
  });

  it('no permite dejar al propio rey en jaque (pieza clavada)', () => {
    const game = createGame('4k3/4r3/8/8/8/8/4B3/4K3 w - - 0 1');
    expect(playMove(game, { from: sq('e2'), to: sq('d3') })).toBeNull();
    expect(legalMoves(game.state).every((m) => m.from !== sq('e2') || m.to === sq('e3') || m.to === sq('e4'))).toBe(true);
  });

  it('detecta el jaque y obliga a responder', () => {
    const game = play(createGame(), 'e2e4', 'f7f6', 'd1h5');
    expect(game.status.check).toBe(true);
    expect(sans(game).at(-1)).toBe('Qh5+');
    // Toda respuesta legal saca al rey del jaque.
    for (const move of legalMoves(game.state)) expect(move.to === sq('g6') || move.from === sq('g7')).toBe(true);
  });

  it('jaque mate (mate del loco)', () => {
    const game = play(createGame(), 'f2f3', 'e7e5', 'g2g4', 'd8h4');
    expect(game.status).toMatchObject({ over: true, result: '0-1', reason: 'checkmate' });
    expect(sans(game).at(-1)).toBe('Qh4#');
    expect(playMove(game, { from: sq('a2'), to: sq('a3') })).toBeNull();
  });

  it('ahogado', () => {
    const game = play(createGame('7k/5Q2/6K1/8/8/8/8/8 w - - 0 1'), 'g6h6');
    expect(game.status).toMatchObject({ over: true, result: '1/2-1/2', reason: 'stalemate' });
  });

  it('enroque corto y largo, y prohibido a través de casillas atacadas', () => {
    const game = createGame('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
    const short = play(game, 'e1g1');
    expect(short.state.board[sq('f1')]).toBe('R');
    expect(short.state.board[sq('g1')]).toBe('K');
    expect(sans(short)[0]).toBe('O-O');
    const long = play(short, 'e8c8');
    expect(long.state.board[sq('d8')]).toBe('r');
    expect(sans(long)[1]).toBe('O-O-O');

    // Un alfil negro ataca f1: no se puede enrocar corto.
    const attacked = createGame('r3k2r/8/8/8/8/8/6b1/R3K2R w KQkq - 0 1');
    expect(playMove(attacked, { from: sq('e1'), to: sq('g1') })).toBeNull();
    // En jaque tampoco.
    const check = createGame('r3k2r/8/8/8/8/8/8/R3K1qR w KQkq - 0 1');
    expect(inCheck(check.state)).toBe(true);
    expect(playMove(check, { from: sq('e1'), to: sq('c1') })).toBeNull();
  });

  it('pierde el derecho de enroque al mover el rey o la torre', () => {
    const game = play(createGame('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'), 'h1h2', 'a8a7', 'h2h1', 'a7a8');
    expect(playMove(game, { from: sq('e1'), to: sq('g1') })).toBeNull();
    expect(play(game, 'e1c1').state.board[sq('d1')]).toBe('R');
  });

  it('captura al paso solo inmediatamente después del avance doble', () => {
    const game = play(createGame(), 'e2e4', 'a7a6', 'e4e5', 'd7d5');
    const ep = play(game, 'e5d6');
    expect(ep.state.board[sq('d5')]).toBeNull();
    expect(ep.state.board[sq('d6')]).toBe('P');
    expect(sans(ep).at(-1)).toBe('exd6');

    const late = play(game, 'h2h3', 'h7h6');
    expect(playMove(late, { from: sq('e5'), to: sq('d6') })).toBeNull();
  });

  it('promoción a la pieza elegida', () => {
    const game = createGame('8/P6k/8/8/8/8/8/K7 w - - 0 1');
    expect(needsPromotion(game, sq('a7'), sq('a8'))).toBe(true);
    const knight = play(game, 'a7a8n');
    expect(knight.state.board[sq('a8')]).toBe('N');
    expect(sans(knight)[0]).toBe('a8=N');
    const queen = play(game, 'a7a8q');
    expect(queen.state.board[sq('a8')]).toBe('Q');
  });

  it('tablas por material insuficiente', () => {
    expect(evaluateStatus(parseFEN('8/8/8/4k3/8/8/8/4K3 w - - 0 1'))).toMatchObject({ over: true, reason: 'insufficient' });
    expect(evaluateStatus(parseFEN('8/8/8/4k3/8/8/8/3NK3 w - - 0 1'))).toMatchObject({ over: true, reason: 'insufficient' });
    expect(evaluateStatus(parseFEN('8/8/8/4k3/8/8/8/3RK3 w - - 0 1')).over).toBe(false);
  });

  it('tablas por la regla de los 50 movimientos', () => {
    expect(evaluateStatus(parseFEN('8/8/8/4k3/8/8/8/3RK3 w - - 100 80'))).toMatchObject({ over: true, reason: 'fifty-moves' });
  });

  it('tablas por triple repetición', () => {
    let game = createGame();
    for (let i = 0; i < 2; i += 1) game = play(game, 'g1f3', 'g8f6', 'f3g1', 'f6g8');
    expect(game.status).toMatchObject({ over: true, result: '1/2-1/2', reason: 'repetition' });
  });

  it('notación con desambiguación', () => {
    const game = play(createGame('4k3/8/8/8/8/8/4K3/R6R w - - 0 1'), 'a1d1');
    expect(sans(game)[0]).toBe('Rad1');
  });

  it('FEN de ida y vuelta', () => {
    const fen = 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1';
    expect(toFEN(parseFEN(fen))).toBe(fen);
  });
});

describe('IA local', () => {
  it('da mate en una cuando puede', () => {
    const state = parseFEN('6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1');
    const { move } = findBestMove(state, { depth: 2, timeMs: 5000 });
    expect(move).toMatchObject({ from: sq('d1'), to: sq('d8') });
  });

  it('captura una dama indefensa', () => {
    const state = parseFEN('4k3/8/8/3q4/8/8/8/3RK3 w - - 0 1');
    const { move } = findBestMove(state, { depth: 2, timeMs: 5000 });
    expect(move).toMatchObject({ from: sq('d1'), to: sq('d5') });
  });

  it('siempre devuelve una jugada legal, también con factor de error', () => {
    const state = parseFEN(START_FEN);
    let seed = 0.37;
    const rng = () => {
      seed = (seed * 9301 + 0.49297) % 1;
      return seed;
    };
    for (let i = 0; i < 4; i += 1) {
      const { move } = findBestMove(state, { depth: 1, randomness: 0.6, rng });
      expect(legalMoves(state).some((m) => m.from === move.from && m.to === move.to)).toBe(true);
    }
  });

  it('respeta el tiempo máximo', () => {
    const state = parseFEN('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1');
    const started = Date.now();
    const { move } = findBestMove(state, { depth: 8, timeMs: 300 });
    expect(move).not.toBeNull();
    expect(Date.now() - started).toBeLessThan(2500);
  });
});

describe('cinco niveles de IA', () => {
  // Generador determinista para que las pruebas estadísticas sean reproducibles.
  const seeded = (seed) => () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const exact = (level) => ({ ...level, randomChance: 0, randomness: 0, timeMs: 8000 });

  it('existen Bebé, Niño, Adolescente, Joven y Adulto, con dificultad creciente', async () => {
    const { AI_LEVELS, findLevel } = await import('../engine/aiLevels.js');
    expect(AI_LEVELS.map((l) => l.name)).toEqual(['Bebé', 'Niño', 'Adolescente', 'Joven', 'Adulto']);
    for (let i = 1; i < AI_LEVELS.length; i += 1) {
      expect(AI_LEVELS[i].depth).toBeGreaterThanOrEqual(AI_LEVELS[i - 1].depth);
      expect(AI_LEVELS[i].randomChance).toBeLessThanOrEqual(AI_LEVELS[i - 1].randomChance);
    }
    // Las partidas guardadas con los niveles antiguos siguen funcionando.
    expect(findLevel('novato').id).toBe('nino');
    expect(findLevel('avanzado').id).toBe('adulto');
  });

  it('Niño come un peón envenenado (no ve la recaptura); Adolescente no', async () => {
    const { findLevel } = await import('../engine/aiLevels.js');
    // Dxd5 gana un peón pero ...exd5 gana la dama.
    const state = parseFEN('4k3/8/4p3/3p4/8/8/8/3QK3 w - - 0 1');
    const child = findBestMove(state, exact(findLevel('nino'))).move;
    const teen = findBestMove(state, exact(findLevel('adolescente'))).move;
    expect(child).toMatchObject({ from: sq('d1'), to: sq('d5') });
    expect(teen.to).not.toBe(sq('d5'));
  });

  it('Adulto encuentra un mate en dos; Adolescente (2 medias jugadas) no lo ve', async () => {
    const { findLevel } = await import('../engine/aiLevels.js');
    const state = parseFEN('r1b2k1r/ppp1bppp/8/1B1Q4/5q2/2P5/PPP2PPP/R3R1K1 w - - 1 0');
    expect(findBestMove(state, exact(findLevel('adulto'))).move).toMatchObject({ from: sq('d5'), to: sq('d8') });
    expect(findBestMove(state, exact(findLevel('adolescente'))).move.to).not.toBe(sq('d8'));
  });

  it('Bebé es accesible: a menudo no captura una dama regalada; Joven siempre la captura', async () => {
    const { findLevel } = await import('../engine/aiLevels.js');
    const state = parseFEN('4k3/8/8/3q4/8/8/8/3RK3 w - - 0 1');
    const captures = (levelId, seed) => {
      const rng = seeded(seed);
      let count = 0;
      for (let i = 0; i < 40; i += 1) {
        const { move } = findBestMove(state, { ...findLevel(levelId), rng });
        if (move.to === sq('d5')) count += 1;
      }
      return count;
    };
    expect(captures('bebe', 7)).toBeLessThan(32);
    expect(captures('joven', 7)).toBe(40);
  });

  it('todos los niveles juegan siempre movimientos legales', async () => {
    const { AI_LEVELS } = await import('../engine/aiLevels.js');
    const state = parseFEN('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1');
    const legal = legalMoves(state);
    for (const level of AI_LEVELS) {
      const { move } = findBestMove(state, { ...level, timeMs: 400, rng: seeded(3) });
      expect(legal.some((m) => m.from === move.from && m.to === move.to)).toBe(true);
    }
  });
});
