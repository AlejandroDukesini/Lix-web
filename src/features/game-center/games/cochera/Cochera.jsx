import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Lightbulb, ListOrdered, Lock, RotateCcw, Star, Undo2 } from 'lucide-react';
import { Button } from '../../../../components/common/Button.jsx';
import { GameHUD } from '../../components/GameHUD.jsx';
import { PauseMenu } from '../../components/GameOverlay.jsx';
import { GameResults } from '../../components/GameResults.jsx';
import { useGameSession } from '../../hooks/useGameSession.js';
import { useGameRecord } from '../../hooks/useGameStatistics.js';
import { useGameAudio } from '../../hooks/useGameAudio.js';
import { useGameFrame, useInProgress, usePauseOnInterrupt } from '../../hooks/useGameFrame.js';
import { useKeyboard } from '../../hooks/useKeyboard.js';
import { formatTime } from '../../services/gameLifecycle.js';
import { cx } from '../../../../utils/cx.js';
import { EXIT_ROW, SIZE, TARGET, createState, isWon, range, slide, solve } from './engine/busEngine.js';
import { LEVELS, TIERS } from './levels/levels.js';
import { VEHICLE_COLORS, VehicleArt } from './components/VehicleArt.jsx';
import './styles/cochera.css';

const GAME_ID = 'cochera';
const SFX = {
  pick: { wave: 'triangle', from: 520, dur: 0.04, gain: 0.05 },
  slide: { wave: 'triangle', from: 300, to: 420, dur: 0.1, gain: 0.07 },
  bump: { wave: 'square', from: 150, to: 110, dur: 0.1, gain: 0.06 },
  horn: [
    { wave: 'square', from: 440, dur: 0.12, gain: 0.05 },
    { wave: 'square', from: 554, dur: 0.18, gain: 0.05, delay: 0.14 },
  ],
  win: [
    { wave: 'triangle', from: 523, dur: 0.14, gain: 0.12 },
    { wave: 'triangle', from: 659, dur: 0.14, gain: 0.12, delay: 0.12 },
    { wave: 'triangle', from: 784, dur: 0.3, gain: 0.12, delay: 0.24 },
  ],
};
const DRIVE_OUT_MS = 900;

const isUnlocked = (index, completed) => index === 0 || Boolean(completed[LEVELS[index - 1].id]);
export const starsFor = (moves, par, usedHint) => {
  const stars = moves <= par ? 3 : moves <= par + Math.ceil(par * 0.5) ? 2 : 1;
  return usedHint ? Math.min(2, stars) : stars;
};
const starsText = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);
const colorOf = (id) => (id === TARGET ? '#f2b417' : VEHICLE_COLORS[(id.charCodeAt(0) - 97) % VEHICLE_COLORS.length]);
const kindOf = (v) => (v.id === TARGET ? 'el microbús dorado' : v.len === 3 ? 'autobús' : 'coche');

function LevelSelect({ completed, onPick }) {
  return (
    <div className="ch-select game-scroll">
      <header>
        <p className="eyebrow">Salida de la cochera</p>
        <h2 className="ch-select__title">Elige un turno</h2>
        <p className="ch-select__text">Los pasajeros esperan en la parada. Desliza coches y autobuses para abrir paso al microbús dorado hasta la salida.</p>
      </header>
      {TIERS.map((tier) => (
        <section key={tier.id} className="ch-tier" aria-labelledby={`ch-tier-${tier.id}`}>
          <h3 id={`ch-tier-${tier.id}`} className="ch-tier__title">
            {tier.label} <small>{tier.note}</small>
          </h3>
          <ol className="ch-levels">
            {LEVELS.filter((l) => l.tier === tier.id).map((level) => {
              const index = LEVELS.indexOf(level);
              const unlocked = isUnlocked(index, completed);
              const stars = completed[level.id] ?? 0;
              return (
                <li key={level.id}>
                  <button
                    type="button"
                    className={cx('ch-level', stars > 0 && 'is-done')}
                    disabled={!unlocked}
                    onClick={() => onPick(level)}
                    aria-label={`Nivel ${index + 1}: solución en ${level.par} movimientos.${stars ? ` ${stars} de 3 estrellas.` : ''}${unlocked ? '' : ' Bloqueado: supera el anterior.'}`}
                  >
                    <span className="ch-level__number">{index + 1}</span>
                    <span className="ch-level__meta">
                      {!unlocked ? (
                        <Lock aria-hidden="true" />
                      ) : stars ? (
                        <span className="ch-stars" aria-hidden="true">
                          {[1, 2, 3].map((n) => (
                            <Star key={n} className={n <= stars ? 'is-on' : undefined} />
                          ))}
                        </span>
                      ) : (
                        `${level.par} mov.`
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

const pct = (n) => `${(n / SIZE) * 100}%`;

function Board({ state, drag, bump, hint, selected, escaping, disabled, onPointerDown, onPointerMove, onPointerUp, onCancel, onSelect, boardRef }) {
  return (
    <div className="ch-depot">
      <div className="ch-stop" aria-hidden="true" style={{ top: `calc(${pct(EXIT_ROW)} + 14px)` }}>
        <span className="ch-stop__sign">BUS</span>
        <span className={cx('ch-stop__people', escaping && 'is-boarding')}>
          <i />
          <i />
          <i />
        </span>
      </div>
      <div ref={boardRef} className="ch-board" role="group" aria-label="Cochera de 6 por 6. Elige un vehículo y desplázalo por su carril.">
        <span className="ch-exit" style={{ top: pct(EXIT_ROW), height: pct(1) }} aria-hidden="true" />
        <span className="ch-lane" style={{ top: pct(EXIT_ROW), height: pct(1) }} aria-hidden="true" />
        {state.walls.map(([r, c]) => (
          <span key={`${r}-${c}`} className="ch-bollard" style={{ top: pct(r), left: pct(c), width: pct(1), height: pct(1) }} aria-hidden="true" />
        ))}
        {state.vehicles.map((v) => {
          const offset = drag?.id === v.id ? drag.offset : 0;
          const w = v.axis === 'h' ? v.len : 1;
          const h = v.axis === 'h' ? 1 : v.len;
          const exitShift = escaping && v.id === TARGET ? SIZE - v.col + 1 : 0;
          const shift = offset + exitShift;
          const { min, max } = range(state, v.id);
          const hinted = hint?.id === v.id;
          return (
            <button
              key={v.id}
              type="button"
              className={cx(
                'ch-vehicle',
                `is-${v.axis}`,
                v.id === TARGET && 'is-target',
                drag?.id === v.id && 'is-dragging',
                bump?.id === v.id && 'is-bumped',
                selected === v.id && 'is-selected',
                hinted && 'is-hinted',
                escaping && v.id === TARGET && 'is-escaping',
              )}
              style={{
                left: pct(v.col),
                top: pct(v.row),
                width: pct(w),
                height: pct(h),
                transform: v.axis === 'h' ? `translateX(${(shift * 100) / w}%)` : `translateY(${(shift * 100) / h}%)`,
                '--drive-ms': `${DRIVE_OUT_MS}ms`,
                '--len': v.len,
                '--bump': bump?.id === v.id ? bump.dir : 0,
              }}
              data-vehicle={v.id}
              disabled={disabled}
              aria-pressed={selected === v.id}
              aria-label={`${kindOf(v)[0].toUpperCase()}${kindOf(v).slice(1)} ${v.axis === 'h' ? 'horizontal' : 'vertical'} de ${v.len} casillas, en la fila ${v.row + 1}, columna ${v.col + 1}. ${min || max ? `Puede moverse ${v.axis === 'h' ? `${-min} a la izquierda y ${max} a la derecha` : `${-min} hacia arriba y ${max} hacia abajo`}.` : 'Bloqueado.'}`}
              onPointerDown={(event) => onPointerDown(event, v)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onCancel}
              onLostPointerCapture={onCancel}
              onClick={(event) => event.detail === 0 && onSelect(v.id)}
            >
              <span className="ch-vehicle__body">
                <VehicleArt len={v.len} color={colorOf(v.id)} golden={v.id === TARGET} uid={v.id} />
              </span>
              {hinted && <span className={cx('ch-hint', `is-${hint.delta > 0 ? 'fwd' : 'back'}`)} aria-hidden="true" />}
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
  const [state, setState] = useState(() => createState(level));
  const [history, setHistory] = useState([]);
  const [drag, setDrag] = useState(null); // { id, offset }
  const [bump, setBump] = useState(null);
  const [selected, setSelected] = useState(null);
  const [hint, setHint] = useState(null);
  const [usedHint, setUsedHint] = useState(false);
  const [escaping, setEscaping] = useState(false);
  const [notice, setNotice] = useState(null);
  const [result, setResult] = useState(null);
  const [clock, setClock] = useState(0);
  const boardRef = useRef(null);
  const pointer = useRef(null);
  const timers = useRef(new Set());
  const { start, finish, elapsedMs } = session;

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
  useInProgress(!result && history.length > 0);
  usePauseOnInterrupt(session.pause);
  useEffect(() => {
    if (!session.isPlaying) return undefined;
    const timer = setInterval(() => setClock(elapsedMs()), 500);
    return () => clearInterval(timer);
  }, [session.isPlaying, elapsedMs]);

  const playing = session.isPlaying && !result && !escaping;

  const win = useCallback(
    async (moves) => {
      setEscaping(true);
      audio.play(SFX.horn);
      const timeMs = Math.round(elapsedMs());
      const stars = starsFor(moves, level.par, usedHint);
      later(async () => {
        audio.play(SFX.win);
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
      }, DRIVE_OUT_MS + 250);
    },
    [audio, elapsedMs, finish, level, usedHint, later],
  );

  const doBump = useCallback(
    (id, dir, text) => {
      audio.play(SFX.bump);
      setBump({ id, dir, key: Date.now() });
      later(() => setBump((b) => (b?.id === id ? null : b)), 320);
      if (text) setNotice({ key: Date.now(), text });
    },
    [audio, later],
  );

  const commit = useCallback(
    (id, delta) => {
      const next = slide(state, id, delta);
      if (!next) return false;
      audio.play(SFX.slide);
      setHistory((h) => [...h, state]);
      setState(next);
      setHint(null);
      setNotice(null);
      if (isWon(next)) win(history.length + 1);
      return true;
    },
    [state, audio, win, history.length],
  );

  /** Mover con teclado o botón: una casilla en el eje del vehículo. */
  const nudge = useCallback(
    (id, dir) => {
      if (!playing) return;
      const v = state.vehicles.find((x) => x.id === id);
      if (!v) return;
      const along = v.axis === 'h' ? { left: -1, right: 1 }[dir] : { up: -1, down: 1 }[dir];
      if (!along) {
        doBump(id, 0, v.axis === 'h' ? 'Ese vehículo va en horizontal: solo se mueve a izquierda y derecha.' : 'Ese vehículo va en vertical: solo se mueve arriba y abajo.');
        return;
      }
      if (!commit(id, along)) doBump(id, along, 'Por ahí está bloqueado.');
    },
    [playing, state, commit, doBump],
  );

  const cellPx = () => boardRef.current.getBoundingClientRect().width / SIZE;
  const onPointerDown = (event, v) => {
    if (!playing) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pointer.current = { id: v.id, axis: v.axis, x: event.clientX, y: event.clientY, pid: event.pointerId, range: range(state, v.id), moved: 0, at: performance.now() };
    setSelected(v.id);
    audio.play(SFX.pick);
  };
  const onPointerMove = (event) => {
    const p = pointer.current;
    if (!p || p.pid !== event.pointerId) return;
    const raw = ((p.axis === 'h' ? event.clientX - p.x : event.clientY - p.y) / cellPx());
    p.moved = Math.max(p.moved, Math.abs(event.clientX - p.x), Math.abs(event.clientY - p.y));
    // Resistencia elástica al chocar: se puede empujar un poco más allá, pero vuelve.
    const clamp = (value, lo, hi) => (value < lo ? lo - Math.min(0.15, (lo - value) * 0.2) : value > hi ? hi + Math.min(0.15, (value - hi) * 0.2) : value);
    p.blocked = raw < p.range.min - 0.3 ? -1 : raw > p.range.max + 0.3 ? 1 : 0;
    setDrag({ id: p.id, offset: clamp(raw, p.range.min, p.range.max) });
  };
  const onPointerUp = (event) => {
    const p = pointer.current;
    if (!p || p.pid !== event.pointerId) return;
    pointer.current = null;
    const offset = drag?.id === p.id ? drag.offset : 0;
    setDrag(null);
    const delta = Math.round(Math.max(p.range.min, Math.min(p.range.max, offset)));
    if (delta) commit(p.id, delta);
    else if (p.blocked) doBump(p.id, p.blocked, 'Hay algo en medio: libera antes su carril.');
    else if (p.moved < 6 && !p.range.min && !p.range.max) doBump(p.id, 0, 'Ese vehículo está encerrado por ahora.');
  };
  const onCancel = () => {
    pointer.current = null;
    setDrag(null);
  };

  const undo = useCallback(() => {
    if (!history.length || result || escaping) return;
    setState(history.at(-1));
    setHistory((h) => h.slice(0, -1));
    setHint(null);
    setNotice(null);
  }, [history, result, escaping]);
  const restart = useCallback(() => {
    if (escaping) return;
    setState(createState(level));
    setHistory([]);
    setHint(null);
    setNotice(null);
    setSelected(null);
  }, [level, escaping]);
  const askHint = useCallback(() => {
    if (!playing) return;
    const path = solve(state);
    if (!path?.length) return;
    setUsedHint(true);
    setHint(path[0]);
    setSelected(path[0].id);
    const v = state.vehicles.find((x) => x.id === path[0].id);
    const dirText = v.axis === 'h' ? (path[0].delta > 0 ? 'a la derecha' : 'a la izquierda') : path[0].delta > 0 ? 'hacia abajo' : 'hacia arriba';
    setNotice({ key: Date.now(), text: `Pista: mueve ${kindOf(v) === 'el microbús dorado' ? 'el microbús' : `el ${kindOf(v)} marcado`} ${Math.abs(path[0].delta)} ${Math.abs(path[0].delta) === 1 ? 'casilla' : 'casillas'} ${dirText}. Quedan ${path.length} movimientos.` });
  }, [playing, state]);

  useKeyboard({
    active: !result,
    onAction: (action, event) => {
      if (action === 'pause') return session.togglePause();
      if (!['left', 'right', 'up', 'down'].includes(action)) return undefined;
      const id = document.activeElement?.dataset?.vehicle ?? selected;
      if (!id) return undefined;
      event?.preventDefault?.();
      setSelected(id);
      nudge(id, action);
      return undefined;
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
    <div className="ch-play game-scroll">
      <GameHUD
        onPause={session.togglePause}
        paused={session.isPaused}
        pauseDisabled={Boolean(result)}
        items={[
          { id: 'level', label: `Nivel · ${tier.label}`, value: String(index + 1) },
          { id: 'moves', label: 'Movimientos', value: String(history.length), tone: history.length > level.par ? 'warn' : undefined },
          { id: 'par', label: 'Mínimo', value: String(level.par) },
          { id: 'time', label: 'Tiempo', value: formatTime(clock, { decimals: 0 }) },
        ]}
      />
      <Board
        state={state}
        drag={drag}
        bump={bump}
        hint={hint}
        selected={selected}
        escaping={escaping}
        disabled={!playing}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onCancel={onCancel}
        onSelect={setSelected}
        boardRef={boardRef}
      />
      <p className="ch-notice" role="status" aria-live="polite">
        {notice ? <span key={notice.key}>{notice.text}</span> : escaping ? '¡Vía libre! Los pasajeros suben.' : 'Arrastra cada vehículo por su carril. Con teclado: Tab para elegir y flechas para mover.'}
      </p>
      <div className="ch-actions">
        <Button variant="secondary" size="sm" icon={Undo2} onClick={undo} disabled={!history.length || Boolean(result) || escaping}>
          Deshacer
        </Button>
        <Button variant="secondary" size="sm" icon={RotateCcw} onClick={restart} disabled={Boolean(result) || escaping}>
          Reiniciar
        </Button>
        <Button variant="ghost" size="sm" icon={Lightbulb} onClick={askHint} disabled={!playing}>
          Pista
        </Button>
        <Button variant="ghost" size="sm" icon={ListOrdered} onClick={onLevels}>
          Niveles
        </Button>
      </div>
      {session.isPaused && !result && <PauseMenu onResume={session.resume} onRestart={restart} onExit={frame.exit} />}
      {result && (
        <GameResults
          outcome="win"
          eyebrow="¡El microbús salió de la cochera!"
          title={`Nivel ${index + 1}: ${starsText(result.stars)}`}
          message={result.stars === 3 ? `En el mínimo posible: ${level.par} movimientos.` : usedHint ? 'Con pista, el máximo son dos estrellas.' : `El mínimo posible son ${level.par} movimientos. ¿Lo intentas?`}
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

/** Salida de la cochera: niveles y partida. */
export default function Cochera() {
  const frame = useGameFrame();
  const record = useGameRecord(GAME_ID);
  const [level, setLevel] = useState(null);
  const completed = record?.progress?.completed ?? {};
  const index = level ? LEVELS.indexOf(level) : -1;
  const next = index >= 0 ? (LEVELS[index + 1] ?? null) : null;
  if (!level) return <LevelSelect completed={completed} onPick={setLevel} />;
  return <Play key={level.id} level={level} frame={frame} onLevels={() => setLevel(null)} onNext={next ? () => setLevel(next) : null} />;
}
