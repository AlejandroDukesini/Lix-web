import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ChevronsDown, Infinity as InfinityIcon, ListOrdered, Repeat2, RotateCcw, RotateCw, Timer } from 'lucide-react';
import { Button } from '../../../../components/common/Button.jsx';
import { SegmentedControl } from '../../../../components/common/SegmentedControl.jsx';
import { GameHUD } from '../../components/GameHUD.jsx';
import { PauseMenu } from '../../components/GameOverlay.jsx';
import { GameResults } from '../../components/GameResults.jsx';
import { Countdown } from '../../components/Countdown.jsx';
import { ControlsHint, HoldButton, TapButton, useTouchUI } from '../../components/TouchControls.jsx';
import { useCanvas } from '../../hooks/useCanvas.js';
import { useGameLoop } from '../../hooks/useGameLoop.js';
import { useGameSession } from '../../hooks/useGameSession.js';
import { useGameRecord } from '../../hooks/useGameStatistics.js';
import { useGameAudio } from '../../hooks/useGameAudio.js';
import { useGameFrame, useInProgress, usePauseOnInterrupt } from '../../hooks/useGameFrame.js';
import { useKeyboard } from '../../hooks/useKeyboard.js';
import { updateGameSettings } from '../../services/gameStorage.js';
import { formatTime } from '../../services/gameLifecycle.js';
import { useReducedMotion } from '../../../../hooks/useReducedMotion.js';
import { cx } from '../../../../utils/cx.js';
import { MODES, createGame, hardDrop, hold, move, rotate, tick } from './engine/blocksEngine.js';
import { addEffects, createRenderState, renderBlocks } from './engine/blocksRenderer.js';
import { MILESTONES, milestonesFor } from './milestones.js';
import './styles/bloques.css';

const GAME_ID = 'bloques';
const DAS = 0.16; // retardo antes de que se repita el movimiento lateral
const ARR = 0.045; // intervalo de repetición
const NO_INPUT = Object.freeze({ left: false, right: false, down: false });
const START_LEVELS = [1, 5, 10];

const SFX = {
  tick: { wave: 'square', from: 440, dur: 0.08, gain: 0.07 },
  go: { wave: 'square', from: 880, dur: 0.18, gain: 0.08 },
  move: { wave: 'triangle', from: 300, dur: 0.03, gain: 0.03 },
  rotate: { wave: 'triangle', from: 520, to: 600, dur: 0.04, gain: 0.04 },
  lock: { wave: 'sine', from: 180, to: 120, dur: 0.07, gain: 0.08 },
  drop: { wave: 'sine', from: 260, to: 90, dur: 0.1, gain: 0.1 },
  hold: { wave: 'triangle', from: 660, to: 440, dur: 0.08, gain: 0.05 },
  lines: [
    { wave: 'triangle', from: 660, dur: 0.08, gain: 0.09 },
    { wave: 'triangle', from: 880, dur: 0.14, gain: 0.09, delay: 0.06 },
  ],
  tetris: [
    { wave: 'triangle', from: 523, dur: 0.1, gain: 0.11 },
    { wave: 'triangle', from: 659, dur: 0.1, gain: 0.11, delay: 0.08 },
    { wave: 'triangle', from: 784, dur: 0.1, gain: 0.11, delay: 0.16 },
    { wave: 'triangle', from: 1046, dur: 0.26, gain: 0.11, delay: 0.24 },
  ],
  level: [
    { wave: 'square', from: 523, dur: 0.08, gain: 0.05 },
    { wave: 'square', from: 784, dur: 0.16, gain: 0.05, delay: 0.08 },
  ],
  over: { wave: 'sawtooth', from: 330, to: 80, dur: 0.6, gain: 0.08 },
  win: [
    { wave: 'triangle', from: 523, dur: 0.12, gain: 0.12 },
    { wave: 'triangle', from: 659, dur: 0.12, gain: 0.12, delay: 0.1 },
    { wave: 'triangle', from: 784, dur: 0.12, gain: 0.12, delay: 0.2 },
    { wave: 'triangle', from: 1046, dur: 0.35, gain: 0.12, delay: 0.3 },
  ],
};

const fmt = (n) => n.toLocaleString('es');

function ModeSelect({ record, onPick }) {
  const best = record?.best ?? {};
  const [startLevel, setStartLevel] = useState(() => (START_LEVELS.includes(record?.settings?.startLevel) ? record.settings.startLevel : 1));
  const done = milestonesFor(record);
  return (
    <div className="bq-select game-scroll">
      <header>
        <p className="eyebrow">Bloques que caen</p>
        <h2 className="bq-select__title">Encaja el cielo, línea a línea</h2>
        <p className="bq-select__text">
          Gira y coloca las piezas para completar filas. Cada fila completa se va como una estrella fugaz; cuantas más a
          la vez, más brillan.
        </p>
      </header>
      <div className="bq-modes">
        <section className="bq-mode">
          <InfinityIcon aria-hidden="true" className="bq-mode__icon" />
          <h3>Maratón</h3>
          <p>{MODES.maraton.goalLines} líneas para ganar. Cada 10 líneas sube el nivel y las piezas caen más rápido.</p>
          <SegmentedControl
            label="Nivel inicial"
            options={START_LEVELS.map((l) => ({ value: l, label: `Nivel ${l}` }))}
            value={startLevel}
            onChange={setStartLevel}
          />
          <p className="bq-mode__best">
            {Number.isFinite(best['score:maraton']) ? `Récord: ${fmt(best['score:maraton'])} puntos · nivel ${best['level:maraton'] ?? '—'}` : 'Aún sin récord'}
          </p>
          <Button
            onClick={() => {
              updateGameSettings(GAME_ID, { startLevel }).catch(() => {});
              onPick({ mode: 'maraton', startLevel });
            }}
          >
            Jugar maratón
          </Button>
        </section>
        <section className="bq-mode">
          <Timer aria-hidden="true" className="bq-mode__icon" />
          <h3>Contrarreloj</h3>
          <p>{MODES.sprint.goalLines} líneas lo más rápido posible, desde el nivel 1.</p>
          <p className="bq-mode__best">{Number.isFinite(best['time:sprint']) ? `Mejor tiempo: ${formatTime(best['time:sprint'] * 1000)}` : 'Aún sin tiempo'}</p>
          <Button variant="secondary" onClick={() => onPick({ mode: 'sprint', startLevel: 1 })}>
            Jugar contrarreloj
          </Button>
        </section>
      </div>
      <section aria-labelledby="bq-goals" className="bq-goals">
        <h3 id="bq-goals">Hitos</h3>
        <ul>
          {MILESTONES.map((m) => (
            <li key={m.id} className={cx(done[m.id] && 'is-done')}>
              <span aria-hidden="true">{done[m.id] ? '★' : '☆'}</span> {m.label}
              <span className="sr-only">{done[m.id] ? ' (conseguido)' : ' (pendiente)'}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Play({ config, frame, onMenu }) {
  const session = useGameSession(GAME_ID);
  const audio = useGameAudio();
  const reduced = useReducedMotion();
  const touchUI = useTouchUI();
  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState('countdown'); // countdown | run | over
  const [hud, setHud] = useState({ score: 0, lines: 0, level: config.startLevel, time: 0 });
  const [result, setResult] = useState(null);
  const game = useRef(createGame({ seed: Date.now() >>> 0, ...config }));
  const view = useRef(createRenderState());
  const touch = useRef(NO_INPUT);
  const repeat = useRef({ left: { held: false, t: 0 }, right: { held: false, t: 0 } });
  const gesture = useRef(null);
  const { start, finish, reset: resetSession } = session;
  const options = useRef({});
  options.current = { insetBottom: touchUI ? 132 : 0, reduced };

  const draw = useCallback((dt = 0) => renderBlocks(ctxRef.current, sizeRef.current, game.current, view.current, dt, options.current), []);
  const { canvasRef, ctxRef, sizeRef } = useCanvas(() => draw(0));

  useInProgress(session.isPlaying || session.isPaused);
  usePauseOnInterrupt(session.pause);

  const running = () => phase === 'run' && session.statusRef.current === 'playing';

  const syncHud = useCallback(() => {
    const g = game.current;
    setHud({ score: g.score, lines: g.lines, level: g.level, time: g.time });
  }, []);

  const end = useCallback(
    async (won) => {
      const g = game.current;
      setPhase('over');
      audio.play(won ? SFX.win : SFX.over);
      const summary = { won, score: g.score, lines: g.lines, level: g.level, time: g.time, tetrises: g.tetrises, saving: true };
      setResult(summary);
      const mode = g.mode;
      const marks =
        mode === 'sprint'
          ? won
            ? [{ key: 'time:sprint', value: Math.round(g.time * 100) / 100, better: 'lower' }]
            : []
          : [
              { key: 'score:maraton', value: g.score, better: 'higher' },
              { key: 'lines:maraton', value: g.lines, better: 'higher' },
              { key: 'level:maraton', value: g.level, better: 'higher' },
            ];
      const saved = await finish({
        completed: won,
        marks,
        progress: (p) => ({
          ...p,
          totalLines: (p.totalLines ?? 0) + g.lines,
          tetrises: (p.tetrises ?? 0) + g.tetrises,
          maxLinesGame: Math.max(p.maxLinesGame ?? 0, g.lines),
          maxLevel: Math.max(p.maxLevel ?? 0, g.level),
          wins: won ? { ...(p.wins ?? {}), [mode]: (p.wins?.[mode] ?? 0) + 1 } : (p.wins ?? {}),
        }),
      });
      setResult((r) => r && { ...r, saving: false, marks: saved.marks });
    },
    [audio, finish],
  );

  const handle = useCallback(
    (events) => {
      if (!events.length) return;
      addEffects(view.current, events, reduced);
      for (const e of events) {
        if (e.type === 'lines') {
          audio.play(e.count === 4 ? SFX.tetris : SFX.lines);
          if (e.count === 4) navigator.vibrate?.(40);
        } else if (e.type === 'levelUp') audio.play(SFX.level);
        else if (e.type === 'lock') audio.play(SFX.lock);
      }
      syncHud();
      const g = game.current;
      if (g.won) end(true);
      else if (g.over) end(false);
    },
    [audio, end, reduced, syncHud],
  );

  const act = useCallback(
    (action) => {
      if (!running()) return;
      const g = game.current;
      if (action === 'left' || action === 'right') {
        if (move(g, action === 'left' ? -1 : 1)) audio.play(SFX.move);
      } else if (action === 'cw' || action === 'ccw') {
        if (rotate(g, action === 'cw' ? 1 : -1)) audio.play(SFX.rotate);
      } else if (action === 'drop') {
        audio.play(SFX.drop);
        handle(hardDrop(g));
      } else if (action === 'hold') {
        const events = hold(g);
        if (events.length) audio.play(SFX.hold);
        handle(events);
      } else if (action === 'softStep') {
        if (move(g, 0, 1)) {
          g.score += 1;
          syncHud();
        }
      }
      draw(0);
    },
    [phase, audio, handle, draw, syncHud],
  );

  const keys = useKeyboard({
    active: phase !== 'over',
    onAction: (action) => {
      if (action === 'pause') {
        if (phase === 'run') session.togglePause();
        return;
      }
      if (action === 'up') act('cw');
      else if (action === 'action') act('drop');
      else if (action === 'left' || action === 'right') {
        // La primera pulsación mueve al instante; la repetición la lleva el bucle.
        act(action);
        repeat.current[action] = { held: true, t: -DAS, fromKey: true };
      }
    },
  });

  // Teclas propias del género: Z/X giran, C o Mayús guardan, R reinicia.
  useEffect(() => {
    if (phase === 'over') return undefined;
    const onKey = (event) => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      const k = event.key;
      if (k === 'z' || k === 'Z') act('ccw');
      else if (k === 'x' || k === 'X') act('cw');
      else if (k === 'c' || k === 'C' || k === 'Shift') act('hold');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [act, phase]);

  useEffect(() => {
    if (!session.isPlaying) {
      touch.current = NO_INPUT;
      repeat.current = { left: { held: false, t: 0 }, right: { held: false, t: 0 } };
    }
  }, [session.isPlaying]);

  useGameLoop(
    (dt) => {
      if (running()) {
        const g = game.current;
        const pressed = keys.current;
        for (const dir of ['left', 'right']) {
          const held = pressed.has(dir) || touch.current[dir];
          const r = repeat.current[dir];
          if (!held) {
            repeat.current[dir] = { held: false, t: 0 };
            continue;
          }
          if (!r.held) {
            // Pulsación nueva desde un botón táctil (las de teclado ya movieron en onAction).
            act(dir);
            repeat.current[dir] = { held: true, t: -DAS };
            continue;
          }
          r.t += dt;
          while (r.t >= ARR) {
            r.t -= ARR;
            move(g, dir === 'left' ? -1 : 1);
          }
        }
        const soft = pressed.has('down') || touch.current.down;
        const before = g.score;
        handle(tick(g, dt, { soft }));
        if (soft && g.score !== before) syncHud();
        if (g.mode === 'sprint') {
          view.current.hudClock = (view.current.hudClock ?? 0) + dt;
          if (view.current.hudClock > 0.1) {
            view.current.hudClock = 0;
            syncHud();
          }
        }
      }
      draw(phase === 'over' ? dt : running() ? dt : 0);
    },
    phase === 'countdown' || (phase === 'run' && session.isPlaying) || (phase === 'over' && view.current.effects.length > 0),
  );

  const restart = useCallback(() => {
    resetSession();
    game.current = createGame({ seed: Date.now() >>> 0, ...config });
    view.current = createRenderState();
    touch.current = NO_INPUT;
    setHud({ score: 0, lines: 0, level: config.startLevel, time: 0 });
    setResult(null);
    setPhase('countdown');
    setRound((r) => r + 1);
    draw(0);
  }, [resetSession, config, draw]);

  useEffect(() => {
    const onKey = (event) => {
      if ((event.key === 'r' || event.key === 'R') && !event.ctrlKey && !event.metaKey) restart();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [restart]);

  // Gestos sobre el tablero: tocar = girar, arrastrar = mover casilla a casilla, deslizar rápido hacia abajo = soltar.
  const gestures = {
    onPointerDown: (event) => {
      if (event.pointerType === 'mouse' || event.target.closest?.('button, [data-no-gesture]')) return;
      gesture.current = { id: event.pointerId, x0: event.clientX, y0: event.clientY, ax: event.clientX, ay: event.clientY, at: performance.now(), moved: false };
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    onPointerMove: (event) => {
      const gs = gesture.current;
      if (!gs || gs.id !== event.pointerId || !running()) return;
      const cell = view.current.layout?.cell ?? 24;
      const dx = event.clientX - gs.ax;
      if (Math.abs(dx) >= cell) {
        const steps = Math.trunc(dx / cell);
        for (let i = 0; i < Math.abs(steps); i += 1) act(steps < 0 ? 'left' : 'right');
        gs.ax += steps * cell;
        gs.moved = true;
      }
      const dy = event.clientY - gs.ay;
      if (dy >= cell) {
        const steps = Math.trunc(dy / cell);
        for (let i = 0; i < steps; i += 1) act('softStep');
        gs.ay += steps * cell;
        gs.moved = true;
      }
    },
    onPointerUp: (event) => {
      const gs = gesture.current;
      gesture.current = null;
      if (!gs || gs.id !== event.pointerId) return;
      const dt = performance.now() - gs.at;
      const dy = event.clientY - gs.y0;
      const dx = event.clientX - gs.x0;
      if (dy > 60 && dy / Math.max(1, dt) > 0.9 && Math.abs(dy) > Math.abs(dx) * 1.5) act('drop');
      else if (!gs.moved && dt < 300 && Math.hypot(dx, dy) < 12) act('cw');
    },
    onPointerCancel: () => {
      gesture.current = null;
    },
  };

  const sprint = config.mode === 'sprint';
  const won = result?.won;
  const marks = result?.marks ?? {};
  const scoreMark = marks['score:maraton'];
  const timeMark = marks['time:sprint'];

  return (
    <div className={cx('game-stage', 'bq', touchUI && 'has-touch')} {...gestures}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`Tablero de bloques: ${hud.lines} líneas, nivel ${hud.level}, ${fmt(hud.score)} puntos.`}
      />
      <GameHUD
        onPause={phase === 'run' ? session.togglePause : undefined}
        paused={session.isPaused}
        items={[
          { id: 'score', label: 'Puntos', value: fmt(hud.score) },
          { id: 'lines', label: 'Líneas', value: `${hud.lines}/${MODES[config.mode].goalLines}` },
          sprint ? { id: 'time', label: 'Tiempo', value: formatTime(hud.time * 1000) } : { id: 'level', label: 'Nivel', value: String(hud.level) },
        ]}
      />
      {touchUI && phase !== 'over' && (
        <div className="bq-pad" data-no-gesture key={round}>
          <div className="bq-pad__row">
            <TapButton label="Guardar pieza" icon={Repeat2} onPress={() => act('hold')} className="bq-btn bq-btn--small" />
            <TapButton label="Girar a la izquierda" icon={RotateCcw} onPress={() => act('ccw')} className="bq-btn" />
            <TapButton label="Girar a la derecha" icon={RotateCw} onPress={() => act('cw')} className="bq-btn" />
            <TapButton label="Caída instantánea" icon={ChevronsDown} onPress={() => act('drop')} className="bq-btn bq-btn--drop" />
          </div>
          <div className="bq-pad__row">
            <HoldButton label="Mover a la izquierda" icon={ArrowLeft} onChange={(v) => (touch.current = { ...touch.current, left: v })} className="bq-btn" />
            <HoldButton label="Bajar más rápido" icon={ArrowDown} onChange={(v) => (touch.current = { ...touch.current, down: v })} className="bq-btn" />
            <HoldButton label="Mover a la derecha" icon={ArrowRight} onChange={(v) => (touch.current = { ...touch.current, right: v })} className="bq-btn" />
          </div>
        </div>
      )}
      {phase === 'run' && (
        <ControlsHint
          key={round}
          touch="Toca el tablero para girar · arrastra para mover · desliza rápido hacia abajo para soltar"
          desktop="← → mover · ↑ o X girar · Z girar al revés · ↓ bajar · Espacio soltar · C guardar · Esc pausa"
        />
      )}
      {phase === 'countdown' && (
        <Countdown
          key={round}
          paused={frame.interrupted}
          onTick={() => audio.play(SFX.tick)}
          onDone={() => {
            audio.play(SFX.go);
            setPhase('run');
            start();
          }}
        />
      )}
      {session.isPaused && phase === 'run' && (
        <PauseMenu onResume={session.resume} onRestart={restart} onExit={frame.exit}>
          <p>El tablero está detenido. Nada cae hasta que continúes.</p>
        </PauseMenu>
      )}
      {result && (
        <GameResults
          outcome={won ? 'win' : 'lose'}
          eyebrow={won ? (sprint ? '¡40 líneas!' : '¡Maratón completado!') : 'El tablero se llenó'}
          title={won ? (sprint ? formatTime(result.time * 1000) : `${fmt(result.score)} puntos`) : `${fmt(result.score)} puntos`}
          message={
            won
              ? sprint
                ? 'Contrarreloj terminado.'
                : `Llegaste a las ${MODES.maraton.goalLines} líneas.`
              : `Las piezas llegaron arriba en el nivel ${result.level}.`
          }
          saving={result.saving}
          stats={[
            ...(sprint
              ? won
                ? [{ label: 'Tiempo', value: formatTime(result.time * 1000), record: timeMark?.isRecord && timeMark.previous !== null, best: timeMark && !timeMark.isRecord ? formatTime(timeMark.best * 1000) : null }]
                : []
              : [{ label: 'Puntos', value: fmt(result.score), record: scoreMark?.isRecord && scoreMark.previous !== null, best: scoreMark && !scoreMark.isRecord ? fmt(scoreMark.best) : null }]),
            { label: 'Líneas', value: String(result.lines) },
            { label: 'Nivel', value: String(result.level) },
            { label: 'Cuatro de golpe', value: String(result.tetrises) },
          ]}
          onReplay={restart}
          replayLabel="Otra partida"
          extraActions={
            <Button variant="secondary" icon={ListOrdered} onClick={onMenu}>
              Modos
            </Button>
          }
          onExit={frame.exit}
        />
      )}
    </div>
  );
}

/** Bloques que caen: maratón de 150 líneas y contrarreloj de 40. */
export default function Bloques() {
  const frame = useGameFrame();
  const record = useGameRecord(GAME_ID);
  const [config, setConfig] = useState(null);
  const [key, setKey] = useState(0);
  if (!config) return <ModeSelect record={record} onPick={(c) => (setConfig(c), setKey((k) => k + 1))} />;
  return <Play key={key} config={config} frame={frame} onMenu={() => setConfig(null)} />;
}
