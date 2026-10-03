import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Flag, FlipVertical2, RotateCcw, Settings2, Users } from 'lucide-react';
import { Button } from '../../../../components/common/Button.jsx';
import { ConfirmDialog } from '../../../../components/common/Dialog.jsx';
import { SegmentedControl } from '../../../../components/common/SegmentedControl.jsx';
import { GameOverlay } from '../../components/GameOverlay.jsx';
import { GameResults } from '../../components/GameResults.jsx';
import { useGameSession } from '../../hooks/useGameSession.js';
import { useGameRecord } from '../../hooks/useGameStatistics.js';
import { useGameAudio } from '../../hooks/useGameAudio.js';
import { useGameFrame, useInProgress } from '../../hooks/useGameFrame.js';
import { updateGameSettings } from '../../services/gameStorage.js';
import { cx } from '../../../../utils/cx.js';
import { BLACK, WHITE, colorOf, createGame, kingSquare, legalMoves, needsPromotion, playMove, squareName, typeOf } from './engine/chessEngine.js';
import { AI_LEVELS, findLevel, normalizeLevelId } from './engine/aiLevels.js';
import { createAIClient } from './engine/aiClient.js';
import { ChessPiece, pieceLabel } from './components/ChessPieces.jsx';
import './styles/chess.css';

const GAME_ID = 'chess';
const VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const SFX = {
  move: { wave: 'triangle', from: 300, to: 220, dur: 0.07, gain: 0.14 },
  capture: [
    { noise: true, from: 1800, to: 600, dur: 0.08, gain: 0.25 },
    { wave: 'triangle', from: 220, to: 160, dur: 0.09, gain: 0.12 },
  ],
  check: { wave: 'square', from: 660, to: 620, dur: 0.14, gain: 0.08 },
  end: [
    { wave: 'sine', from: 392, dur: 0.2, gain: 0.14 },
    { wave: 'sine', from: 523, dur: 0.35, gain: 0.14, delay: 0.18 },
  ],
};

const COLOR_NAME = { [WHITE]: 'blancas', [BLACK]: 'negras' };
const REASONS = {
  checkmate: 'Jaque mate',
  stalemate: 'Tablas por ahogado',
  insufficient: 'Tablas por material insuficiente',
  'fifty-moves': 'Tablas por la regla de los 50 movimientos',
  repetition: 'Tablas por triple repetición',
  resign: 'Abandono',
};

/** Configuración de la partida: modo, nivel de la IA y color. */
function Setup({ initial, onStart }) {
  const [mode, setMode] = useState(initial.mode ?? 'ai');
  const [level, setLevel] = useState(findLevel(initial.level ?? AI_LEVELS[0].id).id);
  const [color, setColor] = useState(initial.color ?? WHITE);
  return (
    <div className="chess-setup">
      <header>
        <p className="eyebrow">Ajedrez</p>
        <h2 className="chess-setup__title">Nueva partida</h2>
      </header>
      <SegmentedControl
        label="Modo de juego"
        layout="cards"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'ai', label: 'Contra la IA', description: 'Una IA local, sin conexión. Calcula sin bloquear la pantalla.', icon: Bot },
          { value: '2p', label: 'Dos jugadores', description: 'Por turnos en este mismo dispositivo.', icon: Users },
        ]}
      />
      {mode === 'ai' && (
        <>
          <div className="chess-levels">
            <SegmentedControl
              label="Nivel de la IA"
              value={level}
              onChange={setLevel}
              options={AI_LEVELS.map((l) => ({ value: l.id, label: l.name }))}
            />
            <p className="chess-levels__description" aria-live="polite">
              {findLevel(level).description}
            </p>
          </div>
          <SegmentedControl
            label="Juegas con"
            value={color}
            onChange={setColor}
            options={[
              { value: WHITE, label: 'Blancas (empiezas tú)' },
              { value: BLACK, label: 'Negras' },
            ]}
          />
        </>
      )}
      <Button size="lg" onClick={() => onStart({ mode, level, color })}>
        Empezar partida
      </Button>
    </div>
  );
}

function PromotionPicker({ color, onPick, onCancel }) {
  return (
    <GameOverlay
      eyebrow="Coronación"
      title="Elige la nueva pieza"
      actions={
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      }
    >
      <div className="chess-promotion">
        {['q', 'r', 'b', 'n'].map((type, i) => {
          const piece = color === WHITE ? type.toUpperCase() : type;
          return (
            <button key={type} type="button" className="chess-promotion__btn" onClick={() => onPick(type)} data-autofocus={i === 0 ? true : undefined}>
              <ChessPiece piece={piece} />
              <span>{pieceLabel(piece).split(' ')[0]}</span>
            </button>
          );
        })}
      </div>
    </GameOverlay>
  );
}

function Board({ game, orientation, selected, targets, onSquare, disabled }) {
  const [focus, setFocus] = useState(52); // e2
  const refs = useRef([]);
  const last = game.history[game.history.length - 1];
  const checkSquare = game.status.check ? kingSquare(game.state.board, game.state.turn) : -1;
  // Orden visual de las casillas según la orientación.
  const order = useMemo(() => {
    const squares = Array.from({ length: 64 }, (_, i) => i);
    return orientation === WHITE ? squares : squares.reverse();
  }, [orientation]);

  const moveFocus = (event, square) => {
    const visual = order.indexOf(square);
    const deltas = { ArrowUp: -8, ArrowDown: 8, ArrowLeft: -1, ArrowRight: 1 };
    const delta = deltas[event.key];
    if (!delta) return;
    event.preventDefault();
    const row = Math.floor(visual / 8);
    const col = visual % 8;
    const nextRow = row + (delta === -8 ? -1 : delta === 8 ? 1 : 0);
    const nextCol = col + (delta === -1 ? -1 : delta === 1 ? 1 : 0);
    if (nextRow < 0 || nextRow > 7 || nextCol < 0 || nextCol > 7) return;
    const next = order[nextRow * 8 + nextCol];
    setFocus(next);
    refs.current[next]?.focus();
  };

  return (
    <div className="chess-board" role="grid" aria-label="Tablero de ajedrez">
      {Array.from({ length: 8 }, (_, row) => (
        <div key={row} role="row" className="chess-board__row">
          {order.slice(row * 8, row * 8 + 8).map((square, col) => {
            const piece = game.state.board[square];
            const dark = ((square >> 3) + (square & 7)) % 2 === 1;
            const target = targets.get(square);
            const name = squareName(square);
            const label = [
              name,
              piece ? pieceLabel(piece) : 'vacía',
              selected === square && 'seleccionada',
              target && (target.captured ? 'captura posible' : 'movimiento posible'),
              checkSquare === square && 'en jaque',
            ]
              .filter(Boolean)
              .join(', ');
            return (
              <div key={square} role="gridcell" className="chess-board__cell">
                <button
                  ref={(el) => {
                    refs.current[square] = el;
                  }}
                  type="button"
                  className={cx(
                    'chess-square',
                    dark ? 'is-dark' : 'is-light',
                    selected === square && 'is-selected',
                    target && (target.captured ? 'is-capture' : 'is-move'),
                    last && (last.from === square || last.to === square) && 'is-last',
                    checkSquare === square && 'is-check',
                  )}
                  aria-label={label}
                  tabIndex={focus === square ? 0 : -1}
                  onFocus={() => setFocus(square)}
                  onKeyDown={(event) => moveFocus(event, square)}
                  onClick={() => !disabled && onSquare(square)}
                  aria-disabled={disabled || undefined}
                >
                  {piece && <ChessPiece piece={piece} />}
                  {col === 0 && <span className="chess-square__rank">{name[1]}</span>}
                  {row === 7 && <span className="chess-square__file">{name[0]}</span>}
                </button>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/**
 * Piezas de `color` capturadas por el rival: agrupadas por tipo, con contador.
 * Es información secundaria: tamaño pequeño y una sola línea, nunca compite con el tablero.
 */
function Captured({ history, color, owner }) {
  const counts = new Map();
  for (const move of history) {
    if (move.captured && colorOf(move.captured) === color) counts.set(move.captured, (counts.get(move.captured) ?? 0) + 1);
  }
  const groups = [...counts.entries()].sort((a, b) => VALUES[typeOf(b[0])] - VALUES[typeOf(a[0])]);
  const total = groups.reduce((sum, [, n]) => sum + n, 0);
  if (!total) return null;
  return (
    <span className="chess-captured" aria-label={`${owner} ha capturado ${total} ${total === 1 ? 'pieza' : 'piezas'}`}>
      {groups.map(([piece, n]) => (
        <span key={piece} className="chess-captured__group">
          <ChessPiece piece={piece} className="piece--mini" />
          {n > 1 && <span className="chess-captured__count">×{n}</span>}
        </span>
      ))}
    </span>
  );
}

function Match({ config, onNewGame, frame }) {
  const [game, setGame] = useState(() => createGame());
  const [selected, setSelected] = useState(null);
  const [promotion, setPromotion] = useState(null); // { from, to }
  const [thinking, setThinking] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [confirmResign, setConfirmResign] = useState(false);
  const [ending, setEnding] = useState(null); // { result, reason, winner, saving }
  const session = useGameSession(GAME_ID, { autoPause: false });
  const audio = useGameAudio();
  const ai = useRef(null);
  const { start, reset: resetSession, finish } = session;

  const vsAI = config.mode === 'ai';
  const humanColor = vsAI ? config.color : null;
  const aiColor = vsAI ? (config.color === WHITE ? BLACK : WHITE) : null;
  const level = findLevel(config.level);
  const orientation = vsAI ? humanColor : flipped ? BLACK : WHITE;

  useEffect(() => {
    ai.current = createAIClient();
    return () => ai.current.dispose();
  }, []);
  useEffect(() => {
    start();
  }, [start]);
  useInProgress(game.history.length > 0 && !ending);

  const conclude = useCallback(
    async (status, nextGame) => {
      audio.play(SFX.end);
      const winner = status.result === '1-0' ? WHITE : status.result === '0-1' ? BLACK : null;
      setEnding({ ...status, winner, saving: true });
      const outcome = vsAI ? (winner === null ? 'draws' : winner === humanColor ? 'wins' : 'losses') : null;
      await finish({
        completed: status.reason !== 'resign',
        progress: (p) => {
          if (!vsAI) return { ...p, twoPlayerGames: (p.twoPlayerGames ?? 0) + 1 };
          const results = { wins: 0, draws: 0, losses: 0, ...(p.results ?? {}) };
          results[outcome] += 1;
          const aiWins = { ...(p.aiWins ?? {}) };
          if (outcome === 'wins') aiWins[normalizeLevelId(level.id)] = true;
          return { ...p, results, aiWins, lastMoves: nextGame.history.length };
        },
      });
      setEnding((current) => current && { ...current, saving: false });
    },
    [audio, finish, vsAI, humanColor, level.id],
  );

  const apply = useCallback(
    (move) => {
      const next = playMove(game, move);
      if (!next) return false;
      const played = next.history[next.history.length - 1];
      audio.play(next.status.check ? SFX.check : played.captured ? SFX.capture : SFX.move);
      setGame(next);
      setSelected(null);
      if (next.status.over) conclude(next.status, next);
      return true;
    },
    [game, audio, conclude],
  );

  // Turno de la IA: se calcula en el Worker y se aplica al terminar (con una pausa mínima natural).
  useEffect(() => {
    if (!vsAI || game.status.over || ending || game.state.turn !== aiColor) return undefined;
    let cancelled = false;
    setThinking(true);
    const started = performance.now();
    ai.current.think(game.state, level.id).then((move) => {
      if (cancelled || !move) return;
      const wait = Math.max(0, 450 - (performance.now() - started));
      setTimeout(() => {
        if (cancelled) return;
        setThinking(false);
        apply({ from: move.from, to: move.to, promotion: move.promotion });
      }, wait);
    });
    return () => {
      cancelled = true;
      setThinking(false);
    };
  }, [vsAI, game, ending, aiColor, level.id, apply]);

  const legal = useMemo(() => legalMoves(game.state), [game.state]);
  const targets = useMemo(() => {
    const map = new Map();
    if (selected !== null) for (const move of legal) if (move.from === selected) map.set(move.to, move);
    return map;
  }, [legal, selected]);

  const myTurn = !game.status.over && !ending && (!vsAI || game.state.turn === humanColor);

  const onSquare = (square) => {
    if (!myTurn) return;
    const piece = game.state.board[square];
    if (selected !== null && targets.has(square)) {
      if (needsPromotion(game, selected, square)) setPromotion({ from: selected, to: square });
      else apply({ from: selected, to: square });
      return;
    }
    if (piece && colorOf(piece) === game.state.turn && legal.some((m) => m.from === square)) setSelected(square);
    else setSelected(null);
  };

  const restart = () => {
    ai.current.cancel();
    resetSession();
    setGame(createGame());
    setSelected(null);
    setPromotion(null);
    setEnding(null);
    setThinking(false);
    start();
  };

  const resign = () => {
    setConfirmResign(false);
    ai.current.cancel();
    const loser = vsAI ? humanColor : game.state.turn;
    conclude({ over: true, result: loser === WHITE ? '0-1' : '1-0', reason: 'resign' }, game);
  };

  const pairs = [];
  for (let i = 0; i < game.history.length; i += 2) pairs.push([game.history[i], game.history[i + 1]]);
  const material = (color) =>
    game.state.board.reduce((sum, p) => sum + (p && colorOf(p) === color ? VALUES[typeOf(p)] : 0), 0);
  const balance = material(WHITE) - material(BLACK);

  const turnText = game.status.over
    ? REASONS[game.status.reason]
    : vsAI
      ? game.state.turn === humanColor
        ? 'Tu turno'
        : `${level.name} está pensando…`
      : `Turno de las ${COLOR_NAME[game.state.turn]}`;

  const endTitle = ending
    ? ending.reason === 'checkmate'
      ? `Jaque mate · ganan las ${COLOR_NAME[ending.winner]}`
      : ending.reason === 'resign'
        ? `Abandono · ganan las ${COLOR_NAME[ending.winner]}`
        : REASONS[ending.reason]
    : '';
  const endOutcome = !ending ? 'end' : vsAI ? (ending.winner === null ? 'end' : ending.winner === humanColor ? 'win' : 'lose') : 'end';

  const top = orientation === WHITE ? BLACK : WHITE;
  const bottom = orientation;

  return (
    <div className="chess">
      <div className="chess__layout">
        <section className="chess__board-area" aria-label="Partida">
          <div className="chess__player">
            <span className={cx('chess__dot', `is-${top}`, game.state.turn === top && !game.status.over && 'is-turn')} aria-hidden="true" />
            <span className="chess__player-name">
              {vsAI ? (top === aiColor ? `IA · ${level.name}` : 'Tú') : `Las ${COLOR_NAME[top]}`}
            </span>
            <Captured history={game.history} color={bottom} owner={vsAI ? (top === aiColor ? 'La IA' : 'Tú') : `Las ${COLOR_NAME[top]}`} />
            {(top === WHITE ? balance : -balance) > 0 && <span className="chess__balance">+{Math.abs(balance)}</span>}
          </div>
          <Board game={game} orientation={orientation} selected={selected} targets={targets} onSquare={onSquare} disabled={!myTurn} />
          <div className="chess__player">
            <span className={cx('chess__dot', `is-${bottom}`, game.state.turn === bottom && !game.status.over && 'is-turn')} aria-hidden="true" />
            <span className="chess__player-name">
              {vsAI ? (bottom === aiColor ? `IA · ${level.name}` : 'Tú') : `Las ${COLOR_NAME[bottom]}`}
            </span>
            <Captured history={game.history} color={top} owner={vsAI ? (bottom === aiColor ? 'La IA' : 'Tú') : `Las ${COLOR_NAME[bottom]}`} />
            {(bottom === WHITE ? balance : -balance) > 0 && <span className="chess__balance">+{Math.abs(balance)}</span>}
          </div>
        </section>

        <aside className="chess__panel" aria-label="Estado de la partida">
          <p className={cx('chess__status', game.status.check && !game.status.over && 'is-check', thinking && 'is-thinking')} role="status">
            {game.status.check && !game.status.over ? `¡Jaque! ${turnText}` : turnText}
          </p>
          <div className="chess__history">
            <h3 className="chess__history-title">Movimientos</h3>
            {pairs.length ? (
              <ol className="chess__moves">
                {pairs.map(([white, black], i) => (
                  <li key={i}>
                    <span className="chess__move-number">{i + 1}.</span>
                    <span>{white.san}</span>
                    <span>{black?.san ?? ''}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="chess__empty">Aún no hay movimientos. Las blancas empiezan.</p>
            )}
          </div>
          <div className="chess__actions">
            {!vsAI && (
              <Button variant="secondary" size="sm" icon={FlipVertical2} onClick={() => setFlipped((f) => !f)}>
                Girar tablero
              </Button>
            )}
            <Button variant="secondary" size="sm" icon={RotateCcw} onClick={restart}>
              Reiniciar
            </Button>
            <Button variant="secondary" size="sm" icon={Settings2} onClick={onNewGame}>
              Cambiar modo
            </Button>
            <Button variant="danger" size="sm" icon={Flag} onClick={() => setConfirmResign(true)} disabled={Boolean(ending) || game.status.over}>
              Abandonar
            </Button>
          </div>
        </aside>
      </div>

      {promotion && (
        <PromotionPicker
          color={game.state.turn}
          onPick={(type) => {
            apply({ ...promotion, promotion: type });
            setPromotion(null);
          }}
          onCancel={() => setPromotion(null)}
        />
      )}

      {ending && (
        <GameResults
          outcome={endOutcome}
          eyebrow={vsAI ? (endOutcome === 'win' ? '¡Victoria!' : endOutcome === 'lose' ? 'Derrota' : 'Tablas') : 'Fin de la partida'}
          title={endTitle}
          message={vsAI && endOutcome === 'win' ? `Has vencido a ${level.name}.` : null}
          saving={ending.saving}
          stats={[
            { label: 'Resultado', value: ending.result.replace('1/2-1/2', '½-½') },
            { label: 'Jugadas', value: String(Math.ceil(game.history.length / 2)) },
          ]}
          onReplay={restart}
          replayLabel="Otra partida"
          extraActions={
            <Button variant="secondary" icon={Settings2} onClick={onNewGame}>
              Cambiar modo
            </Button>
          }
          onExit={frame.exit}
        />
      )}

      <ConfirmDialog
        open={confirmResign}
        title="¿Abandonar la partida?"
        description={vsAI ? 'La partida contará como derrota frente a la IA.' : `Abandonan las ${COLOR_NAME[game.state.turn]}: la partida termina.`}
        confirmLabel="Abandonar"
        onConfirm={resign}
        onCancel={() => setConfirmResign(false)}
      />
    </div>
  );
}

/** Ajedrez: configuración y partida. */
export default function Chess() {
  const frame = useGameFrame();
  const record = useGameRecord(GAME_ID);
  const [config, setConfig] = useState(null);
  const [round, setRound] = useState(0);

  if (!config) {
    // Se espera al registro guardado para proponer la última configuración usada
    // (sin volver a montar el formulario cuando la persona ya ha elegido algo).
    if (!record) return <div className="chess" aria-busy="true" />;
    return (
      <div className="chess">
        <Setup
          initial={record.settings}
          onStart={(next) => {
            updateGameSettings(GAME_ID, next).catch(() => {});
            setConfig(next);
            setRound((r) => r + 1);
          }}
        />
      </div>
    );
  }
  return <Match key={round} config={config} frame={frame} onNewGame={() => setConfig(null)} />;
}
