import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Lightbulb, ListOrdered, Lock, RotateCcw, Undo2 } from 'lucide-react';
import { Button } from '../../../../components/common/Button.jsx';
import { GameHUD } from '../../components/GameHUD.jsx';
import { GameOverlay, PauseMenu } from '../../components/GameOverlay.jsx';
import { GameResults } from '../../components/GameResults.jsx';
import { useSwipe } from '../../components/TouchControls.jsx';
import { useGameSession } from '../../hooks/useGameSession.js';
import { useGameRecord } from '../../hooks/useGameStatistics.js';
import { useGameAudio } from '../../hooks/useGameAudio.js';
import { useGameFrame, useInProgress, usePauseOnInterrupt } from '../../hooks/useGameFrame.js';
import { useKeyboard } from '../../hooks/useKeyboard.js';
import { formatTime } from '../../services/gameLifecycle.js';
import { cx } from '../../../../utils/cx.js';
import {
  RULES,
  applyMove,
  availableMoves,
  colOf,
  coveredCount,
  createState,
  directionTowards,
  evaluate,
  invalidReason,
  isCovered,
  parseLevel,
  rowOf,
  undoMove,
} from './engine/gridEngine.js';
import { LEVELS, SERIES, levelsOf } from './levels/levels.js';
import './styles/logic-grid.css';

const GAME_ID = 'logic-grid';
const STEP_MS = 55; // animación por celda recorrida

const SFX = {
  slide: { wave: 'triangle', from: 520, to: 780, dur: 0.12, gain: 0.12 },
  blocked: { wave: 'square', from: 140, to: 110, dur: 0.08, gain: 0.06 },
  win: [
    { wave: 'triangle', from: 523, dur: 0.14, gain: 0.16 },
    { wave: 'triangle', from: 659, dur: 0.14, gain: 0.16, delay: 0.12 },
    { wave: 'triangle', from: 784, dur: 0.3, gain: 0.16, delay: 0.24 },
  ],
  stuck: { wave: 'sine', from: 330, to: 180, dur: 0.35, gain: 0.12 },
};

const isUnlocked = (level, completed) => {
  const series = levelsOf(level.rule);
  const index = series.indexOf(level);
  return index === 0 || Boolean(completed[series[index - 1].id]);
};

function LevelSelect({ completed, best, onPick }) {
  return (
    <div className="lg-select">
      <header className="lg-select__head">
        <p className="eyebrow">Cubrir el espacio</p>
        <h2 className="lg-select__title">Elige un nivel</h2>
        <p className="lg-select__text">Cada serie se desbloquea nivel a nivel. Todos tienen solución con los movimientos indicados.</p>
      </header>
      {SERIES.map((series) => (
        <section key={series.id} className="lg-series" aria-labelledby={`series-${series.id}`}>
          <h3 id={`series-${series.id}`} className="lg-series__title">
            {series.name}
          </h3>
          <p className="lg-series__text">{series.description}</p>
          <ol className="lg-levels">
            {levelsOf(series.id).map((level, i) => {
              const unlocked = isUnlocked(level, completed);
              const done = completed[level.id];
              const time = best[`time:${level.id}`];
              return (
                <li key={level.id}>
                  <button
                    type="button"
                    className={cx('lg-level', done && 'is-done', !unlocked && 'is-locked')}
                    disabled={!unlocked}
                    onClick={() => onPick(level)}
                    aria-label={`Nivel ${i + 1}: ${level.name}. ${level.limit} movimientos.${done ? ' Superado.' : ''}${unlocked ? '' : ' Bloqueado.'}`}
                  >
                    <span className="lg-level__number">{i + 1}</span>
                    <span className="lg-level__name">{level.name}</span>
                    <span className="lg-level__meta">
                      {!unlocked ? (
                        <Lock aria-hidden="true" />
                      ) : done ? (
                        <>
                          <Check aria-hidden="true" /> {Number.isFinite(time) ? formatTime(time) : ''}
                        </>
                      ) : (
                        `${level.limit} mov.`
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}

function Board({ board, state, animating, hint, onMove, swipe, shake }) {
  const moves = useMemo(() => (animating ? [] : availableMoves(board, state)), [board, state, animating]);
  const targets = new Map(moves.map((m) => [m.end, m.direction]));
  const last = state.history[state.history.length - 1];
  // Orden en el que se pintó cada celda del último movimiento (para la animación en cascada).
  const order = new Map();
  if (last) {
    let r = rowOf(board, last.from);
    let c = colOf(board, last.from);
    const delta = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] }[last.direction];
    for (let i = 1; r * board.width + c !== state.pos && i < 64; i += 1) {
      r += delta[0];
      c += delta[1];
      order.set(r * board.width + c, i);
    }
  }
  const hintTarget = hint ? moves.find((m) => m.direction === hint)?.end : null;
  const ballRow = rowOf(board, state.pos);
  const ballCol = colOf(board, state.pos);

  return (
    <div className="lg-board-wrap" {...swipe}>
      <div
        className={cx('lg-board', `is-${board.rule}`)}
        style={{ '--cols': board.width, '--rows': board.height }}
        role="grid"
        aria-label={`Tablero de ${board.width} por ${board.height}`}
      >
        {Array.from({ length: board.height }, (_, r) => (
          <div key={r} role="row" className="lg-row">
            {Array.from({ length: board.width }, (_, c) => {
              const index = r * board.width + c;
              if (!board.open[index]) return <div key={c} role="gridcell" className="lg-cell is-wall" aria-label="Muro" />;
              const covered = isCovered(board, state, index);
              const direction = targets.get(index);
              const here = index === state.pos;
              const label = `${here ? 'Ficha. ' : ''}${covered ? 'Cubierta' : 'Por cubrir'}${direction ? '. Mover aquí' : ''}`;
              return (
                <div key={c} role="gridcell" className="lg-cell-slot">
                  <button
                    type="button"
                    className={cx(
                      'lg-cell',
                      covered && 'is-covered',
                      direction && 'is-target',
                      hintTarget === index && 'is-hint',
                      board.start === index && 'is-start',
                    )}
                    style={order.has(index) ? { '--delay': `${order.get(index) * STEP_MS}ms` } : undefined}
                    aria-label={label}
                    tabIndex={direction ? 0 : -1}
                    disabled={!direction}
                    onClick={() => direction && onMove(direction)}
                  />
                </div>
              );
            })}
          </div>
        ))}
        <span
          className="lg-ball"
          style={{
            '--r': ballRow,
            '--c': ballCol,
            '--travel': `${Math.max(1, order.size) * STEP_MS}ms`,
          }}
          aria-hidden="true"
        >
          <span key={shake ?? 'still'} className={cx('lg-ball__body', shake && 'is-shaking')} />
        </span>
      </div>
    </div>
  );
}

function Play({ level, onLevels, onNext, frame }) {
  const board = useMemo(() => parseLevel(level), [level]);
  const [state, setState] = useState(() => createState(board));
  const [verdict, setVerdict] = useState({ status: 'playing' });
  const [animating, setAnimating] = useState(false);
  const [hint, setHint] = useState(null);
  const [hints, setHints] = useState(0);
  const [result, setResult] = useState(null);
  const [notice, setNotice] = useState(null);
  const session = useGameSession(GAME_ID);
  const audio = useGameAudio();
  const animTimer = useRef(null);
  const { start, reset: resetSession } = session;

  useEffect(() => {
    start();
  }, [start]);
  useEffect(() => () => clearTimeout(animTimer.current), []);
  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 2200);
    return () => clearTimeout(timer);
  }, [notice]);
  useInProgress(session.isPlaying && state.moves > 0 && !result);
  usePauseOnInterrupt(session.pause);

  const restart = useCallback(() => {
    clearTimeout(animTimer.current);
    resetSession();
    setState(createState(board));
    setVerdict({ status: 'playing' });
    setAnimating(false);
    setHint(null);
    setHints(0);
    setResult(null);
    start();
  }, [board, resetSession, start]);

  const move = useCallback(
    (direction) => {
      if (animating || !session.isPlaying || verdict.status !== 'playing') return;
      const next = applyMove(board, state, direction);
      if (!next) {
        audio.play(SFX.blocked);
        const reason = invalidReason(board, state, direction);
        setNotice({
          key: performance.now(),
          text: reason === 'covered' ? 'Esa casilla ya está cubierta: ninguna se puede repetir.' : 'Por ahí hay un muro o el borde del tablero.',
        });
        return;
      }
      setNotice(null);
      audio.play(SFX.slide);
      setState(next);
      setHint(null);
      setAnimating(true);
      const cells = Math.abs(rowOf(board, next.pos) - rowOf(board, state.pos)) + Math.abs(colOf(board, next.pos) - colOf(board, state.pos));
      const travel = cells * STEP_MS;
      clearTimeout(animTimer.current);
      animTimer.current = setTimeout(async () => {
        setAnimating(false);
        const outcome = evaluate(board, next);
        setVerdict(outcome);
        if (outcome.status === 'won') {
          audio.play(SFX.win);
          const timeMs = Math.round(session.elapsedMs());
          setResult({ timeMs, saving: true });
          const saved = await session.finish({
            completed: true,
            marks: [{ key: `time:${level.id}`, value: timeMs, better: 'lower' }],
            progress: (p) => ({ ...p, completed: { ...(p.completed ?? {}), [level.id]: true } }),
          });
          setResult({ timeMs, saving: false, mark: saved.marks[`time:${level.id}`] });
        } else if (outcome.status === 'lost') {
          audio.play(SFX.stuck);
        }
      }, travel + 40);
    },
    [animating, session, verdict.status, board, state, audio, level.id],
  );

  const undo = useCallback(() => {
    if (animating || !state.history.length || result) return;
    setState(undoMove(state));
    setVerdict({ status: 'playing' });
    setHint(null);
  }, [animating, state, result]);

  const showHint = () => {
    const outcome = evaluate(board, state, { budget: 200_000 });
    if (outcome.hint) {
      setHint(outcome.hint);
      setHints((n) => n + 1);
    }
  };

  useKeyboard({
    active: !result,
    onAction: (action) => {
      if (action === 'pause') session.togglePause();
      else if (['up', 'down', 'left', 'right'].includes(action)) move(action);
    },
  });
  useEffect(() => {
    const onKey = (event) => {
      if (event.target instanceof HTMLElement && ['INPUT', 'TEXTAREA'].includes(event.target.tagName)) return;
      if (event.key === 'z' || event.key === 'Z' || event.key === 'Backspace') {
        event.preventDefault();
        undo();
      } else if ((event.key === 'r' || event.key === 'R') && !event.ctrlKey && !event.metaKey) restart();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, restart]);

  const swipe = useSwipe((direction) => move(direction));
  const series = levelsOf(level.rule);
  const number = series.indexOf(level) + 1;
  const covered = coveredCount(board, state);
  const left = board.limit - state.moves;

  return (
    <div className="lg-play">
      <GameHUD
        onPause={session.togglePause}
        paused={session.isPaused}
        pauseDisabled={Boolean(result)}
        items={[
          { id: 'level', label: `${RULES[level.rule].name} · ${number}`, value: level.name, wide: true },
          { id: 'moves', label: 'Movimientos', value: `${state.moves}/${board.limit}`, tone: left <= 1 && verdict.status === 'playing' ? 'warn' : undefined },
          { id: 'cells', label: 'Cubiertas', value: `${covered}/${board.total}` },
        ]}
      />
      <p className="lg-rule">{RULES[level.rule].summary}</p>

      <Board board={board} state={state} animating={animating} hint={hint} onMove={move} swipe={swipe} shake={notice?.key} />
      <p className="lg-notice" role="status" aria-live="polite">
        {notice && <span key={notice.key}>{notice.text}</span>}
      </p>

      <div className="lg-actions">
        <Button variant="secondary" size="sm" icon={Undo2} onClick={undo} disabled={!state.history.length || animating || Boolean(result)}>
          Deshacer
        </Button>
        <Button variant="secondary" size="sm" icon={RotateCcw} onClick={restart}>
          Reiniciar
        </Button>
        <Button variant="ghost" size="sm" icon={Lightbulb} onClick={showHint} disabled={verdict.status !== 'playing' || animating || Boolean(result)}>
          Pista
        </Button>
        <Button variant="ghost" size="sm" icon={ListOrdered} onClick={onLevels}>
          Niveles
        </Button>
      </div>

      {session.isPaused && !result && <PauseMenu onResume={session.resume} onRestart={restart} onExit={frame.exit} />}

      {verdict.status === 'lost' && !result && (
        <GameOverlay
          tone="lose"
          eyebrow="Sin salida"
          title={
            verdict.reason === 'moves'
              ? 'Se acabaron los movimientos'
              : verdict.reason === 'stuck'
                ? 'No queda ningún movimiento posible'
                : 'Ya no es posible cubrirlo todo'
          }
          actions={
            <>
              <Button icon={Undo2} onClick={undo} data-autofocus>
                Deshacer
              </Button>
              <Button variant="secondary" icon={RotateCcw} onClick={restart}>
                Reiniciar nivel
              </Button>
            </>
          }
        >
          <p>
            {verdict.reason === 'unsolvable'
              ? `Con ${left} ${left === 1 ? 'movimiento' : 'movimientos'} no se pueden cubrir las ${board.total - covered} celdas que faltan desde aquí.`
              : `Quedan ${board.total - covered} celdas por cubrir.`}
          </p>
        </GameOverlay>
      )}

      {result && (
        <GameResults
          outcome="win"
          title="¡Tablero cubierto!"
          message={`${level.name} en ${state.moves} movimientos${hints ? ` (con ${hints} ${hints === 1 ? 'pista' : 'pistas'})` : ''}.`}
          saving={result.saving}
          stats={[
            { label: 'Movimientos', value: `${state.moves}/${board.limit}` },
            {
              label: 'Tiempo',
              value: formatTime(result.timeMs),
              record: result.mark?.isRecord && result.mark.previous !== null,
              best: result.mark && !result.mark.isRecord ? formatTime(result.mark.best) : null,
            },
          ]}
          onReplay={onNext ?? onLevels}
          replayLabel={onNext ? 'Siguiente nivel' : 'Ver niveles'}
          extraActions={
            <Button variant="secondary" icon={RotateCcw} onClick={restart}>
              Repetir
            </Button>
          }
          onExit={frame.exit}
        />
      )}
      <span className="sr-only" aria-live="polite">
        {verdict.status === 'playing' && state.moves > 0 ? `${covered} de ${board.total} celdas cubiertas, quedan ${left} movimientos` : ''}
      </span>
    </div>
  );
}

/** Juego de lógica: selección de nivel y partida. */
export default function LogicGrid() {
  const frame = useGameFrame();
  const record = useGameRecord(GAME_ID);
  const [level, setLevel] = useState(null);
  const completed = record?.progress?.completed ?? {};
  const best = record?.best ?? {};

  // Siguiente: el próximo de la misma serie o, al terminarla, el primero pendiente de la otra.
  const series = level ? levelsOf(level.rule) : [];
  const next = level
    ? (series[series.indexOf(level) + 1] ?? LEVELS.find((l) => l.rule !== level.rule && !completed[l.id] && isUnlocked(l, completed)) ?? null)
    : null;

  if (!level) return <LevelSelect completed={completed} best={best} onPick={setLevel} />;
  return (
    <Play
      key={level.id}
      level={level}
      frame={frame}
      onLevels={() => setLevel(null)}
      onNext={next ? () => setLevel(next) : null}
    />
  );
}
