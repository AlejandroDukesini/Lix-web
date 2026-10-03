import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, ListOrdered, Lock, RotateCcw, Star, Undo2 } from 'lucide-react';
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
import { DIRS, createState, isCleared, isSolvable, move, reach, tapMove } from './engine/jamEngine.js';
import { LEVELS } from './levels/levels.js';
import './styles/despejar.css';

const GAME_ID = 'despejar';
const SFX = {
  slide: { wave: 'triangle', from: 380, to: 520, dur: 0.1, gain: 0.08 },
  exit: { wave: 'triangle', from: 520, to: 1040, dur: 0.18, gain: 0.1 },
  blocked: { wave: 'square', from: 160, to: 120, dur: 0.1, gain: 0.06 },
  win: [
    { wave: 'triangle', from: 523, dur: 0.14, gain: 0.14 },
    { wave: 'triangle', from: 659, dur: 0.14, gain: 0.14, delay: 0.12 },
    { wave: 'triangle', from: 784, dur: 0.3, gain: 0.14, delay: 0.24 },
  ],
  stuck: { wave: 'sine', from: 330, to: 180, dur: 0.35, gain: 0.1 },
};
const ROTATION = { right: 0, down: 90, left: 180, up: 270 };
const SIDE_ROTATION = { right: 0, bottom: 90, left: 180, top: 270 };

const isUnlocked = (index, completed) => index === 0 || Boolean(completed[LEVELS[index - 1].id]);
const starsFor = (moves, par) => (moves <= par ? 3 : moves <= Math.ceil(par * 1.5) ? 2 : 1);

function LevelSelect({ completed, onPick }) {
  return (
    <div className="jm-select game-scroll">
      <header>
        <p className="eyebrow">Despejar el estacionamiento</p>
        <h2 className="jm-select__title">Elige un aparcamiento</h2>
        <p className="jm-select__text">Saca todos los coches por las salidas. Cada uno solo avanza hacia su flecha: piensa en qué orden.</p>
      </header>
      <ol className="jm-levels">
        {LEVELS.map((level, index) => {
          const unlocked = isUnlocked(index, completed);
          const stars = completed[level.id];
          return (
            <li key={level.id}>
              <button
                type="button"
                className={cx('jm-level', stars && 'is-done', !unlocked && 'is-locked')}
                disabled={!unlocked}
                onClick={() => onPick(level)}
                aria-label={`Nivel ${index + 1}: ${level.name}, ${level.cars.length} coches.${stars ? ` ${stars} de 3 estrellas.` : ''}${unlocked ? '' : ' Bloqueado.'}`}
              >
                <span className="jm-level__number">{index + 1}</span>
                <span className="jm-level__meta">
                  {!unlocked ? (
                    <Lock aria-hidden="true" />
                  ) : stars ? (
                    <span className="jm-stars" aria-hidden="true">
                      {[1, 2, 3].map((n) => (
                        <Star key={n} className={n <= stars ? 'is-on' : undefined} />
                      ))}
                    </span>
                  ) : (
                    `${level.cars.length} coches`
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Tablero: pilares, salidas marcadas en el borde y coches que se arrastran en su eje. */
function Board({ level, state, leaving, onMove, disabled }) {
  const boardRef = useRef(null);
  const drag = useRef(null);
  const [offset, setOffset] = useState(null); // { id, cells, invalid }

  const cellPx = () => boardRef.current.getBoundingClientRect().width / level.width;

  const onPointerDown = (event, id) => {
    if (disabled) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const car = state.cars[id];
    drag.current = { id, pointer: event.pointerId, x: event.clientX, y: event.clientY, at: performance.now(), dir: DIRS[car.dir], reach: reach(level, state, id), moved: 0 };
  };
  const onPointerMove = (event) => {
    const d = drag.current;
    if (!d || d.pointer !== event.pointerId) return;
    // Solo cuenta el desplazamiento a lo largo de su eje, en el sentido de la flecha.
    const along = ((event.clientX - d.x) * d.dir[1] + (event.clientY - d.y) * d.dir[0]) / cellPx();
    const limit = d.reach.canExit ? d.reach.steps + 1.2 : d.reach.steps;
    d.moved = Math.max(Math.abs(event.clientX - d.x), Math.abs(event.clientY - d.y));
    setOffset({ id: d.id, cells: Math.max(0, Math.min(limit, along)), invalid: along < -0.25 || (!d.reach.canExit && along > d.reach.steps + 0.35) });
  };
  const onPointerUp = (event) => {
    const d = drag.current;
    if (!d || d.pointer !== event.pointerId) return;
    drag.current = null;
    const cells = offset?.id === d.id ? offset.cells : 0;
    const invalid = offset?.id === d.id && offset.invalid;
    setOffset(null);
    // Un toque (sin arrastre): avanzar todo lo posible o salir.
    if (d.moved < 8 && performance.now() - d.at < 400) return onMove(d.id, 'tap');
    if (d.reach.canExit && cells >= d.reach.steps + 0.6) return onMove(d.id, 'exit');
    const k = Math.round(Math.min(cells, d.reach.steps));
    if (k >= 1) return onMove(d.id, k);
    return onMove(d.id, invalid ? 'invalid' : 'none');
  };
  const cancel = () => {
    drag.current = null;
    setOffset(null);
  };

  const pct = (n, total) => `${(n / total) * 100}%`;
  return (
    <div className="jm-board-wrap">
      <div ref={boardRef} className="jm-board" style={{ aspectRatio: `${level.width} / ${level.height}`, '--cols': level.width, '--rows': level.height }}>
        {(level.walls ?? []).map((key) => {
          const [r, c] = key.split(',').map(Number);
          return <span key={key} className="jm-wall" style={{ left: pct(c, level.width), top: pct(r, level.height), width: pct(1, level.width), height: pct(1, level.height) }} aria-hidden="true" />;
        })}
        {level.exits.map((exit) => {
          const horizontal = exit.side === 'left' || exit.side === 'right';
          const style = horizontal
            ? { top: pct(exit.index, level.height), height: pct(1, level.height), [exit.side]: 0 }
            : { left: pct(exit.index, level.width), width: pct(1, level.width), [exit.side]: 0 };
          return (
            <span key={`${exit.side}-${exit.index}`} className={`jm-exit jm-exit--${exit.side}`} style={style} aria-hidden="true">
              <ArrowRight style={{ transform: `rotate(${SIDE_ROTATION[exit.side]}deg)` }} />
            </span>
          );
        })}
        {[...Object.values(state.cars), ...leaving].map((car) => {
          const isLeaving = leaving.includes(car);
          const moving = offset?.id === car.id ? offset : null;
          const [dr, dc] = DIRS[car.dir];
          const shift = isLeaving ? Math.max(level.width, level.height) + car.length : moving?.cells ?? 0;
          const w = car.axis === 'h' ? car.length : 1;
          const h = car.axis === 'h' ? 1 : car.length;
          const { steps, canExit } = isLeaving ? { steps: 0, canExit: false } : reach(level, state, car.id);
          return (
            <button
              key={car.id}
              type="button"
              className={cx('jm-car', `jm-car--${car.axis}`, moving && 'is-dragging', moving?.invalid && 'is-invalid', isLeaving && 'is-leaving', !isLeaving && !steps && !canExit && 'is-blocked')}
              style={{
                left: pct(car.col, level.width),
                top: pct(car.row, level.height),
                width: pct(w, level.width),
                height: pct(h, level.height),
                '--hue': car.hue,
                transform: `translate(${shift * dc * 100 / w}%, ${shift * dr * 100 / h}%)`,
              }}
              aria-label={`Coche ${car.axis === 'h' ? 'horizontal' : 'vertical'} de ${car.length} casillas hacia ${{ right: 'la derecha', left: 'la izquierda', up: 'arriba', down: 'abajo' }[car.dir]}. ${canExit ? 'Puede salir.' : steps ? `Puede avanzar ${steps}.` : 'Bloqueado.'}`}
              disabled={disabled || isLeaving}
              data-car={car.id}
              data-dir={car.dir}
              onPointerDown={(event) => onPointerDown(event, car.id)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={cancel}
              onLostPointerCapture={() => drag.current && cancel()}
              onClick={(event) => event.detail === 0 && onMove(car.id, 'tap')}
            >
              <span className="jm-car__body">
                <ArrowRight className="jm-car__arrow" style={{ transform: `rotate(${ROTATION[car.dir]}deg)` }} aria-hidden="true" />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Play({ level, frame, onLevels, onNext }) {
  const session = useGameSession(GAME_ID);
  const audio = useGameAudio();
  const [history, setHistory] = useState([]);
  const [state, setState] = useState(() => createState(level));
  const [leaving, setLeaving] = useState([]);
  const [notice, setNotice] = useState(null);
  const [stuck, setStuck] = useState(false);
  const [result, setResult] = useState(null);
  const [clock, setClock] = useState(0);
  const { start, finish, elapsedMs } = session;

  useEffect(() => {
    start();
  }, [start]);
  useInProgress(!result && history.length > 0);
  usePauseOnInterrupt(session.pause);
  useEffect(() => {
    if (!session.isPlaying) return undefined;
    const timer = setInterval(() => setClock(elapsedMs()), 500);
    return () => clearInterval(timer);
  }, [session.isPlaying, elapsedMs]);

  const win = useCallback(
    async (moves) => {
      audio.play(SFX.win);
      const timeMs = Math.round(elapsedMs());
      const stars = starsFor(moves, level.par);
      setResult({ moves, stars, timeMs, saving: true });
      const saved = await finish({
        completed: true,
        marks: [
          { key: `moves:${level.id}`, value: moves, better: 'lower' },
          { key: `time:${level.id}`, value: timeMs, better: 'lower' },
        ],
        progress: (p) => ({ ...p, completed: { ...(p.completed ?? {}), [level.id]: Math.max(p.completed?.[level.id] ?? 0, stars) } }),
      });
      setResult({ moves, stars, timeMs, saving: false, mark: saved.marks[`moves:${level.id}`] });
    },
    [audio, elapsedMs, finish, level],
  );

  const playing = session.isPlaying && !result && !stuck;
  const act = useCallback(
    (id, kind) => {
      if (!playing) return;
      if (kind === 'none') return;
      if (kind === 'invalid') {
        audio.play(SFX.blocked);
        setNotice({ key: Date.now(), text: 'Cada coche solo avanza en la dirección de su flecha.' });
        return;
      }
      let next;
      let exited = false;
      if (kind === 'tap') {
        const outcome = tapMove(level, state, id);
        next = outcome.state;
        exited = outcome.exited;
        if (!next) {
          audio.play(SFX.blocked);
          setNotice({ key: Date.now(), text: 'Ese coche está bloqueado: libera antes su camino.' });
          return;
        }
      } else {
        next = move(level, state, id, kind);
        exited = kind === 'exit';
        if (!next) return;
      }
      audio.play(exited ? SFX.exit : SFX.slide);
      setNotice(null);
      if (exited) {
        const car = state.cars[id];
        setLeaving((list) => [...list, car]);
        setTimeout(() => setLeaving((list) => list.filter((c) => c !== car)), 420);
      }
      setHistory((h) => [...h, state]);
      setState(next);
      const moves = history.length + 1;
      if (isCleared(next)) win(moves);
      else if (!isSolvable(level, next, 60_000)) {
        audio.play(SFX.stuck);
        setStuck(true);
      }
    },
    [playing, level, state, history.length, audio, win],
  );

  const undo = useCallback(() => {
    if (!history.length || result) return;
    setState(history.at(-1));
    setHistory((h) => h.slice(0, -1));
    setStuck(false);
    setNotice(null);
  }, [history, result]);
  const restart = useCallback(() => {
    setState(createState(level));
    setHistory([]);
    setStuck(false);
    setNotice(null);
    setLeaving([]);
  }, [level]);

  // Teclado: con un coche enfocado, Intro lo hace avanzar (o salir) y la flecha de su dirección, una casilla.
  useKeyboard({
    active: !result,
    onAction: (action, event) => {
      if (action === 'pause') return session.togglePause();
      const id = document.activeElement?.dataset?.car;
      const dir = document.activeElement?.dataset?.dir;
      if (!id || action !== dir) return;
      event?.preventDefault?.();
      const { steps, canExit } = reach(level, state, id);
      act(id, steps ? 1 : canExit ? 'exit' : 'tap');
    },
  });
  useEffect(() => {
    const onKey = (event) => {
      if (event.ctrlKey || event.metaKey) return;
      if (event.key === 'z' || event.key === 'Z' || event.key === 'Backspace') undo();
      else if (event.key === 'r' || event.key === 'R') restart();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, restart]);

  const left = Object.keys(state.cars).length;
  return (
    <div className="jm-play game-scroll">
      <GameHUD
        onPause={session.togglePause}
        paused={session.isPaused}
        pauseDisabled={Boolean(result)}
        items={[
          { id: 'level', label: `Nivel ${LEVELS.indexOf(level) + 1}`, value: level.name, wide: true },
          { id: 'cars', label: 'Coches', value: `${left}/${level.cars.length}` },
          { id: 'moves', label: 'Movimientos', value: String(history.length), tone: history.length > level.par ? 'warn' : undefined },
          { id: 'time', label: 'Tiempo', value: formatTime(clock, { decimals: 0 }) },
        ]}
      />
      <Board level={level} state={state} leaving={leaving} onMove={act} disabled={!playing} />
      <p className="jm-notice" role="status" aria-live="polite">
        {notice ? <span key={notice.key}>{notice.text}</span> : `Arrastra o toca un coche. Para 3 estrellas: ${level.par} movimientos o menos.`}
      </p>
      <div className="jm-actions">
        <Button variant="secondary" size="sm" icon={Undo2} onClick={undo} disabled={!history.length || Boolean(result)}>
          Deshacer
        </Button>
        <Button variant="secondary" size="sm" icon={RotateCcw} onClick={restart} disabled={Boolean(result)}>
          Reiniciar
        </Button>
        <Button variant="ghost" size="sm" icon={ListOrdered} onClick={onLevels}>
          Niveles
        </Button>
      </div>

      {session.isPaused && !result && <PauseMenu onResume={session.resume} onRestart={restart} onExit={frame.exit} />}
      {stuck && !result && (
        <GameOverlay
          tone="lose"
          eyebrow="Sin salida"
          title="Así ya no se pueden sacar todos"
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
          <p>Algún coche ha quedado cerrando el paso a otro que lo necesitaba. Deshaz el último movimiento y prueba otro orden.</p>
        </GameOverlay>
      )}
      {result && (
        <GameResults
          outcome="win"
          eyebrow="¡Aparcamiento despejado!"
          title={`${level.name}: ${'★'.repeat(result.stars)}${'☆'.repeat(3 - result.stars)}`}
          message={result.stars === 3 ? 'Con los movimientos justos.' : `Para las tres estrellas: ${level.par} movimientos o menos.`}
          saving={result.saving}
          stats={[
            {
              label: 'Movimientos',
              value: String(result.moves),
              record: result.mark?.isRecord && result.mark.previous !== null,
              best: result.mark && !result.mark.isRecord ? String(result.mark.best) : null,
            },
            { label: 'Tiempo', value: formatTime(result.timeMs, { decimals: 0 }) },
          ]}
          onReplay={onNext ?? onLevels}
          replayLabel={onNext ? 'Siguiente nivel' : 'Ver niveles'}
          extraActions={
            <Button variant="secondary" icon={Check} onClick={onLevels}>
              Niveles
            </Button>
          }
          onExit={frame.exit}
        />
      )}
    </div>
  );
}

/** Despejar el estacionamiento: niveles y partida. */
export default function Despejar() {
  const frame = useGameFrame();
  const record = useGameRecord(GAME_ID);
  const [level, setLevel] = useState(null);
  const completed = record?.progress?.completed ?? {};
  const index = level ? LEVELS.indexOf(level) : -1;
  const next = index >= 0 ? LEVELS[index + 1] ?? null : null;

  if (!level) return <LevelSelect completed={completed} onPick={setLevel} />;
  return <Play key={level.id} level={level} frame={frame} onLevels={() => setLevel(null)} onNext={next ? () => setLevel(next) : null} />;
}
