import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, Lightbulb, ListOrdered, Lock, RotateCcw, Star, Undo2 } from 'lucide-react';
import { Button } from '../../../../components/common/Button.jsx';
import { GameHUD } from '../../components/GameHUD.jsx';
import { GameOverlay, PauseMenu } from '../../components/GameOverlay.jsx';
import { GameResults } from '../../components/GameResults.jsx';
import { useGameSession } from '../../hooks/useGameSession.js';
import { useGameRecord } from '../../hooks/useGameStatistics.js';
import { useGameAudio } from '../../hooks/useGameAudio.js';
import { useGameFrame, useInProgress, usePauseOnInterrupt } from '../../hooks/useGameFrame.js';
import { useKeyboard } from '../../hooks/useKeyboard.js';
import { formatTime } from '../../services/gameLifecycle.js';
import { cx } from '../../../../utils/cx.js';
import { DIRS, createState, directionTowards, headOf, isStuck, isWon, parseLevel, shrink, solve, stretch } from './engine/catEngine.js';
import { LEVELS, TIERS } from './levels/levels.js';
import './styles/gato-largo.css';

const GAME_ID = 'gato-largo';
const SFX = {
  stretch: { wave: 'sine', from: 260, to: 520, dur: 0.18, gain: 0.07 },
  bump: { wave: 'square', from: 160, to: 120, dur: 0.1, gain: 0.05 },
  shrink: { wave: 'sine', from: 480, to: 260, dur: 0.14, gain: 0.05 },
  meow: [
    { wave: 'triangle', from: 700, to: 980, dur: 0.12, gain: 0.07 },
    { wave: 'triangle', from: 980, to: 620, dur: 0.22, gain: 0.07, delay: 0.12 },
  ],
  stuck: { wave: 'sine', from: 330, to: 180, dur: 0.35, gain: 0.08 },
};
const CELL = 100;
const STEP_MS = 55; // por casilla recorrida
const ROTATION = { right: 0, down: 90, left: 180, up: 270 };
const ARROWS = { up: ArrowUp, right: ArrowRight, down: ArrowDown, left: ArrowLeft };
const DIR_TEXT = { up: 'arriba', right: 'a la derecha', down: 'abajo', left: 'a la izquierda' };

const isUnlocked = (index, completed) => index === 0 || Boolean(completed[LEVELS[index - 1].id]);
export const starsFor = (undos, usedHint) => {
  const stars = undos === 0 ? 3 : undos <= 3 ? 2 : 1;
  return usedHint ? Math.min(2, stars) : stars;
};
const starsText = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);
const center = (board, i) => [(i % board.width) * CELL + CELL / 2, Math.floor(i / board.width) * CELL + CELL / 2];
const pathD = (board, cells) => cells.map((i, k) => `${k ? 'L' : 'M'}${center(board, i).join(' ')}`).join(' ');

function LevelSelect({ completed, onPick }) {
  return (
    <div className="lc-select game-scroll">
      <header>
        <p className="eyebrow">Gato largo</p>
        <h2 className="lc-select__title">¿Dónde se estira hoy?</h2>
        <p className="lc-select__text">El gato se estira en línea recta hasta chocar con algo. Llena cada habitación con su cuerpo sin quedarte encerrado.</p>
      </header>
      {TIERS.map((tier) => (
        <section key={tier.id} className="lc-tier" aria-labelledby={`lc-tier-${tier.id}`}>
          <h3 id={`lc-tier-${tier.id}`} className="lc-tier__title">
            {tier.label} <small>{tier.note}</small>
          </h3>
          <ol className="lc-levels">
            {LEVELS.filter((l) => l.tier === tier.id).map((level) => {
              const index = LEVELS.indexOf(level);
              const unlocked = isUnlocked(index, completed);
              const stars = completed[level.id] ?? 0;
              return (
                <li key={level.id}>
                  <button
                    type="button"
                    className={cx('lc-level', stars > 0 && 'is-done')}
                    disabled={!unlocked}
                    onClick={() => onPick(level)}
                    aria-label={`Habitación ${index + 1}, ${level.map[0].length} por ${level.map.length}.${stars ? ` ${stars} de 3 estrellas.` : ''}${unlocked ? '' : ' Bloqueada: supera la anterior.'}`}
                  >
                    <span className="lc-level__mini" aria-hidden="true" style={{ gridTemplateColumns: `repeat(${level.map[0].length}, 1fr)` }}>
                      {level.map.join('').split('').map((ch, i) => (
                        <i key={i} className={ch === '#' ? 'is-wall' : ch === 'S' ? 'is-cat' : undefined} />
                      ))}
                    </span>
                    <span className="lc-level__number">{index + 1}</span>
                    <span className="lc-level__meta">
                      {!unlocked ? (
                        <Lock aria-hidden="true" />
                      ) : stars ? (
                        <span className="lc-stars" aria-hidden="true">
                          {[1, 2, 3].map((n) => (
                            <Star key={n} className={n <= stars ? 'is-on' : undefined} />
                          ))}
                        </span>
                      ) : null}
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

/** Muebles: cada casilla bloqueada es un cojín, una maceta o una caja (siempre igual para la misma casilla). */
function Furniture({ x, y, kind }) {
  if (kind === 0)
    return (
      <g transform={`translate(${x} ${y})`}>
        <rect x="8" y="10" width="84" height="80" rx="22" fill="#d98fa6" />
        <rect x="8" y="10" width="84" height="80" rx="22" fill="none" stroke="#b9677f" strokeWidth="4" strokeDasharray="6 6" />
        <circle cx="50" cy="50" r="6" fill="#b9677f" />
      </g>
    );
  if (kind === 1)
    return (
      <g transform={`translate(${x} ${y})`}>
        <path d="M30 60 H70 L64 92 H36 Z" fill="#c9773f" />
        <ellipse cx="50" cy="40" rx="30" ry="26" fill="#5fae5a" />
        <ellipse cx="38" cy="30" rx="12" ry="16" fill="#79c56f" />
        <ellipse cx="62" cy="34" rx="12" ry="15" fill="#4f9a4b" />
      </g>
    );
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x="10" y="14" width="80" height="76" rx="6" fill="#c8a06a" />
      <path d="M10 34 H90" stroke="#a37d48" strokeWidth="4" />
      <rect x="40" y="14" width="20" height="20" fill="#e4c48f" />
    </g>
  );
}

function CatBoard({ board, state, anim, hint, onTapCell, onSwipe, disabled, stuck, won }) {
  const svgRef = useRef(null);
  const touch = useRef(null);
  const head = headOf(state);
  const [hx, hy] = center(board, head);
  const lastMove = state.moves.at(-1);
  const facing = lastMove?.dir ?? 'right';
  const committed = anim ? state.path.slice(0, state.path.length - anim.length) : state.path;
  const fresh = anim ? state.path.slice(state.path.length - anim.length - 1) : null;
  const covered = new Set(state.path);

  const onPointerDown = (event) => {
    if (disabled) return;
    touch.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
  };
  const onPointerUp = (event) => {
    const t = touch.current;
    touch.current = null;
    if (!t || t.id !== event.pointerId || disabled) return;
    const dx = event.clientX - t.x;
    const dy = event.clientY - t.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) >= 24) {
      onSwipe(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
      return;
    }
    const rect = svgRef.current.getBoundingClientRect();
    const c = Math.floor(((event.clientX - rect.left) / rect.width) * board.width);
    const r = Math.floor(((event.clientY - rect.top) / rect.height) * board.height);
    if (r >= 0 && c >= 0 && r < board.height && c < board.width) onTapCell(r * board.width + c);
  };

  return (
    <div className="lc-room">
      <svg
        ref={svgRef}
        className={cx('lc-board', stuck && 'is-stuck', won && 'is-won')}
        viewBox={`0 0 ${board.width * CELL} ${board.height * CELL}`}
        style={{ aspectRatio: `${board.width} / ${board.height}` }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (touch.current = null)}
        role="img"
        aria-label={`Habitación de ${board.width} por ${board.height}. El gato ocupa ${state.path.length} de ${board.total} casillas.`}
      >
        <defs>
          <pattern id="lc-planks" width="200" height="50" patternUnits="userSpaceOnUse">
            <rect width="200" height="50" fill="#e9c999" />
            <path d="M0 49 H200 M120 0 V50" stroke="#d3ad78" strokeWidth="3" />
            <path d="M20 22 q20 -6 40 0 M140 30 q16 -5 32 0" stroke="#dcb886" strokeWidth="2" fill="none" />
          </pattern>
        </defs>
        <rect width={board.width * CELL} height={board.height * CELL} fill="url(#lc-planks)" />
        {board.open.map((open, i) => {
          const [x, y] = [(i % board.width) * CELL, Math.floor(i / board.width) * CELL];
          if (!open) return <Furniture key={i} x={x} y={y} kind={(i * 7 + board.width) % 3} />;
          if (covered.has(i)) return null;
          return <circle key={i} cx={x + 50} cy={y + 50} r="7" className="lc-dot" />;
        })}
        {/* Cuerpo: un tubo naranja con rayas, de la cola a la cabeza. */}
        <g className="lc-body">
          <path d={pathD(board, committed)} className="lc-body__fur" />
          <path d={pathD(board, committed)} className="lc-body__stripes" />
          {fresh && (
            <g key={anim.key} style={{ '--draw-ms': `${anim.ms}ms` }}>
              <path d={pathD(board, fresh)} className="lc-body__fur is-fresh" pathLength="1" />
              <path d={pathD(board, fresh)} className="lc-body__stripes is-fresh" pathLength="1" />
            </g>
          )}
        </g>
        {/* Cola: enroscada junto a la casilla de salida. */}
        <g transform={`translate(${center(board, board.start).join(' ')})`} className="lc-tail">
          <path d="M0 0 q-34 -6 -38 -32 q-2 -14 10 -16" fill="none" stroke="#f0913a" strokeWidth="18" strokeLinecap="round" />
          <path d="M-36 -40 q8 -6 14 2" fill="none" stroke="#fff3e0" strokeWidth="14" strokeLinecap="round" />
        </g>
        <g className={cx('lc-head', anim && 'is-moving')} style={{ transform: `translate(${hx}px, ${hy}px)`, '--move-ms': `${anim?.ms ?? 0}ms` }}>
          <g style={{ transform: `rotate(${ROTATION[facing]}deg)` }} className="lc-head__turn">
            <g transform="rotate(90)">
              <path d="M-34 -14 L-30 -50 L-8 -30 Z" fill="#f0913a" />
              <path d="M34 -14 L30 -50 L8 -30 Z" fill="#f0913a" />
              <path d="M-28 -22 L-26 -42 L-14 -30 Z" fill="#ffb7c2" />
              <path d="M28 -22 L26 -42 L14 -30 Z" fill="#ffb7c2" />
              <ellipse cx="0" cy="0" rx="40" ry="36" fill="#f6a04d" />
              <path d="M-12 -34 L-8 -22 M0 -36 L0 -22 M12 -34 L8 -22" stroke="#d8742a" strokeWidth="5" strokeLinecap="round" />
              <ellipse cx="0" cy="12" rx="18" ry="13" fill="#fff3e0" />
              {stuck ? (
                <>
                  <path d="M-20 -6 l10 6 M-20 6 l10 -6 M20 -6 l-10 6 M20 6 l-10 -6" stroke="#3a2a20" strokeWidth="4" strokeLinecap="round" />
                </>
              ) : won ? (
                <path d="M-22 -2 q7 -8 14 0 M8 -2 q7 -8 14 0" stroke="#3a2a20" strokeWidth="4" fill="none" strokeLinecap="round" />
              ) : (
                <>
                  <ellipse cx="-14" cy="-2" rx="6" ry="8" fill="#3a2a20" />
                  <ellipse cx="14" cy="-2" rx="6" ry="8" fill="#3a2a20" />
                  <circle cx="-12" cy="-5" r="2" fill="#fff" />
                  <circle cx="16" cy="-5" r="2" fill="#fff" />
                </>
              )}
              <path d="M-4 8 L4 8 L0 13 Z" fill="#e8737f" />
              <path d="M0 13 q-5 6 -10 3 M0 13 q5 6 10 3" stroke="#3a2a20" strokeWidth="2.5" fill="none" strokeLinecap="round" />
              <path d="M-22 10 H-44 M-22 16 L-42 22 M22 10 H44 M22 16 L42 22" stroke="#fff" strokeWidth="2" opacity="0.8" />
            </g>
          </g>
          {hint && (
            <g style={{ transform: `rotate(${ROTATION[hint]}deg)` }} className="lc-hint">
              <path d="M58 -14 L84 0 L58 14 Z" fill="#1d74e8" />
            </g>
          )}
        </g>
      </svg>
    </div>
  );
}

function Play({ level, frame, onLevels, onNext }) {
  const board = useState(() => parseLevel(level))[0];
  const session = useGameSession(GAME_ID);
  const audio = useGameAudio();
  const [state, setState] = useState(() => createState(board));
  const [anim, setAnim] = useState(null);
  const [undos, setUndos] = useState(0);
  const [hint, setHint] = useState(null);
  const [usedHint, setUsedHint] = useState(false);
  const [notice, setNotice] = useState(null);
  const [result, setResult] = useState(null);
  const [clock, setClock] = useState(0);
  const timers = useRef(new Set());
  const { start, finish, elapsedMs } = session;
  const stuck = isStuck(board, state) && !anim;
  const won = isWon(board, state);

  const later = useCallback((fn, ms) => {
    const id = setTimeout(() => {
      timers.current.delete(id);
      fn();
    }, ms);
    timers.current.add(id);
  }, []);
  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);
  useEffect(() => {
    start();
  }, [start]);
  useInProgress(!result && state.moves.length > 0);
  usePauseOnInterrupt(session.pause);
  useEffect(() => {
    if (!session.isPlaying) return undefined;
    const timer = setInterval(() => setClock(elapsedMs()), 500);
    return () => clearInterval(timer);
  }, [session.isPlaying, elapsedMs]);

  const win = useCallback(async () => {
    audio.play(SFX.meow);
    const timeMs = Math.round(elapsedMs());
    const stars = starsFor(undos, usedHint);
    setResult({ stars, timeMs, saving: true });
    const saved = await finish({
      completed: true,
      marks: [{ key: `time:${level.id}`, value: timeMs, better: 'lower' }],
      progress: (p) => ({ ...p, completed: { ...(p.completed ?? {}), [level.id]: Math.max(p.completed?.[level.id] ?? 0, stars) } }),
    });
    setResult({ stars, timeMs, saving: false, mark: saved.marks[`time:${level.id}`] });
  }, [audio, elapsedMs, finish, level.id, undos, usedHint]);

  const playing = session.isPlaying && !result && !anim;
  const go = useCallback(
    (dir) => {
      if (!playing || won) return;
      const next = stretch(board, state, dir);
      if (!next) {
        audio.play(SFX.bump);
        setNotice({ key: Date.now(), text: `Hacia ${DIR_TEXT[dir]} no hay sitio: algo le tapa el paso.` });
        return;
      }
      const length = next.moves.at(-1).length;
      const ms = Math.min(520, 90 + length * STEP_MS);
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      audio.play(SFX.stretch);
      setHint(null);
      setNotice(null);
      setState(next);
      if (!reduced) {
        setAnim({ length, ms, key: Date.now() });
        later(() => setAnim(null), ms + 30);
      }
      if (isWon(board, next)) later(win, reduced ? 0 : ms + 200);
      else if (isStuck(board, next)) later(() => audio.play(SFX.stuck), reduced ? 0 : ms + 50);
    },
    [playing, won, board, state, audio, later, win],
  );

  const undo = useCallback(() => {
    if (!state.moves.length || result || anim) return;
    audio.play(SFX.shrink);
    setState((s) => shrink(s));
    setUndos((u) => u + 1);
    setHint(null);
    setNotice(null);
  }, [state.moves.length, result, anim, audio]);
  const restart = useCallback(() => {
    if (anim) return;
    setState(createState(board));
    setHint(null);
    setNotice(null);
    if (state.moves.length) setUndos((u) => u + 1);
  }, [anim, board, state.moves.length]);
  const askHint = useCallback(() => {
    if (!playing) return;
    const { solution } = solve(board, state, { budget: 200_000 });
    if (!solution) {
      setNotice({ key: Date.now(), text: 'Desde aquí no se puede llenar la habitación: encoge algún estirón.' });
      return;
    }
    setUsedHint(true);
    setHint(solution[0]);
    setNotice({ key: Date.now(), text: `Pista: estírate ${DIR_TEXT[solution[0]]}.` });
  }, [playing, board, state]);

  useKeyboard({
    active: !result,
    onAction: (action) => {
      if (action === 'pause') session.togglePause();
      else if (DIRS[action]) go(action);
    },
  });
  useEffect(() => {
    if (result) return undefined;
    const onKey = (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === 'z' || event.key === 'Z' || event.key === 'Backspace') undo();
      else if (event.key === 'r' || event.key === 'R') restart();
      else if (event.key === 'h' || event.key === 'H') askHint();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, restart, askHint, result]);

  const index = LEVELS.indexOf(level);
  const tier = TIERS.find((t) => t.id === level.tier);
  return (
    <div className="lc-play game-scroll">
      <GameHUD
        onPause={session.togglePause}
        paused={session.isPaused}
        pauseDisabled={Boolean(result)}
        items={[
          { id: 'level', label: `Habitación · ${tier.label}`, value: String(index + 1) },
          { id: 'covered', label: 'Cubierto', value: `${Math.round((state.path.length / board.total) * 100)} %` },
          { id: 'undos', label: 'Encogidas', value: String(undos), tone: undos > 3 ? 'warn' : undefined },
          { id: 'time', label: 'Tiempo', value: formatTime(clock, { decimals: 0 }) },
        ]}
      />
      <CatBoard
        board={board}
        state={state}
        anim={anim}
        hint={hint}
        stuck={stuck}
        won={won}
        disabled={!playing}
        onSwipe={go}
        onTapCell={(cell) => {
          const dir = directionTowards(board, state, cell);
          if (dir) go(dir);
        }}
      />
      <p className="lc-notice" role="status" aria-live="polite">
        {notice ? <span key={notice.key}>{notice.text}</span> : 'Flechas, deslizar o tocar una casilla en línea con la cabeza.'}
      </p>
      <div className="lc-pad" role="group" aria-label="Direcciones">
        {['up', 'left', 'down', 'right'].map((dir) => {
          const Icon = ARROWS[dir];
          return (
            <button key={dir} type="button" className={cx('lc-pad__btn', `is-${dir}`)} onClick={() => go(dir)} disabled={!playing || won} aria-label={`Estirarse ${DIR_TEXT[dir]}`}>
              <Icon aria-hidden="true" />
            </button>
          );
        })}
      </div>
      <div className="lc-actions">
        <Button variant="secondary" size="sm" icon={Undo2} onClick={undo} disabled={!state.moves.length || Boolean(result) || Boolean(anim)}>
          Encoger
        </Button>
        <Button variant="secondary" size="sm" icon={RotateCcw} onClick={restart} disabled={Boolean(result) || Boolean(anim)}>
          Reiniciar
        </Button>
        <Button variant="ghost" size="sm" icon={Lightbulb} onClick={askHint} disabled={!playing}>
          Pista
        </Button>
        <Button variant="ghost" size="sm" icon={ListOrdered} onClick={onLevels}>
          Habitaciones
        </Button>
      </div>
      {session.isPaused && !result && <PauseMenu onResume={session.resume} onRestart={restart} onExit={frame.exit} />}
      {stuck && !result && session.isPlaying && (
        <GameOverlay
          tone="lose"
          eyebrow="¡Atrapado!"
          title="El gato no puede estirarse más"
          actions={
            <>
              <Button icon={Undo2} onClick={undo} data-autofocus>
                Encoger
              </Button>
              <Button variant="secondary" icon={RotateCcw} onClick={restart}>
                Empezar de nuevo
              </Button>
            </>
          }
        >
          <p>Quedan {board.total - state.path.length} casillas libres, pero ninguna dirección está despejada. Encoge el último estirón y prueba otro camino.</p>
        </GameOverlay>
      )}
      {result && (
        <GameResults
          outcome="win"
          eyebrow="¡Habitación llena de gato!"
          title={`Habitación ${index + 1}: ${starsText(result.stars)}`}
          message={result.stars === 3 ? 'A la primera, sin encoger ni una vez.' : usedHint ? 'Con pista, el máximo son dos estrellas.' : 'Tres estrellas si lo resuelves sin encoger.'}
          saving={result.saving}
          stats={[
            { label: 'Tiempo', value: formatTime(result.timeMs, { decimals: 0 }), record: result.mark?.isRecord && result.mark.previous !== null },
            { label: 'Encogidas', value: String(undos) },
          ]}
          onReplay={onNext ?? onLevels}
          replayLabel={onNext ? 'Siguiente habitación' : 'Ver habitaciones'}
          extraActions={
            <Button variant="secondary" icon={Check} onClick={onLevels}>
              Habitaciones
            </Button>
          }
          onExit={frame.exit}
        />
      )}
    </div>
  );
}

/** Gato largo: habitaciones y partida. */
export default function GatoLargo() {
  const frame = useGameFrame();
  const record = useGameRecord(GAME_ID);
  const [level, setLevel] = useState(null);
  const completed = record?.progress?.completed ?? {};
  const index = level ? LEVELS.indexOf(level) : -1;
  const next = index >= 0 ? (LEVELS[index + 1] ?? null) : null;
  if (!level) return <LevelSelect completed={completed} onPick={setLevel} />;
  return <Play key={level.id} level={level} frame={frame} onLevels={() => setLevel(null)} onNext={next ? () => setLevel(next) : null} />;
}
