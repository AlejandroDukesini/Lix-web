import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Flag, Infinity as InfinityIcon, ListOrdered, Lock, Smartphone } from 'lucide-react';
import { Button } from '../../../../components/common/Button.jsx';
import { GameHUD } from '../../components/GameHUD.jsx';
import { PauseMenu } from '../../components/GameOverlay.jsx';
import { GameResults } from '../../components/GameResults.jsx';
import { Countdown } from '../../components/Countdown.jsx';
import { ControlsHint, DriveControls } from '../../components/TouchControls.jsx';
import { useCanvas } from '../../hooks/useCanvas.js';
import { useGameLoop } from '../../hooks/useGameLoop.js';
import { useGameSession } from '../../hooks/useGameSession.js';
import { useGameRecord } from '../../hooks/useGameStatistics.js';
import { useGameAudio } from '../../hooks/useGameAudio.js';
import { useGameFrame, useInProgress, usePauseOnInterrupt } from '../../hooks/useGameFrame.js';
import { useKeyboard } from '../../hooks/useKeyboard.js';
import { useMediaQuery } from '../../../../hooks/useMediaQuery.js';
import { useReducedMotion } from '../../../../hooks/useReducedMotion.js';
import { cx } from '../../../../utils/cx.js';
import { KMH, MISSIONS, createRide, missionProgress, sceneAt, step } from './engine/riderEngine.js';
import { createRenderState, renderRide } from './engine/riderRenderer.js';
import './styles/traffic-rider.css';

const GAME_ID = 'traffic-rider';
const FREE = Object.freeze({ id: 'libre', name: 'Carrera libre', type: 'free' });
const SFX = {
  tick: { wave: 'square', from: 440, dur: 0.08, gain: 0.08 },
  go: { wave: 'square', from: 880, dur: 0.2, gain: 0.1 },
  overtake: { wave: 'sine', from: 700, to: 1000, dur: 0.08, gain: 0.05 },
  close: [
    { wave: 'triangle', from: 880, dur: 0.08, gain: 0.08 },
    { wave: 'triangle', from: 1320, dur: 0.12, gain: 0.08, delay: 0.06 },
  ],
  crash: [
    { noise: true, from: 2000, to: 150, dur: 0.6, gain: 0.4 },
    { wave: 'sawtooth', from: 180, to: 50, dur: 0.5, gain: 0.12 },
  ],
  done: [
    { wave: 'triangle', from: 523, dur: 0.14, gain: 0.14 },
    { wave: 'triangle', from: 784, dur: 0.3, gain: 0.14, delay: 0.12 },
  ],
};
const NO_INPUT = Object.freeze({ up: false, down: false, left: false, right: false });

const describe = (m) =>
  ({
    distance: `Recorre ${(m.target / 1000).toLocaleString('es')} km sin chocar.`,
    time: `Recorre ${(m.target / 1000).toLocaleString('es')} km en menos de ${m.limit} s.`,
    overtakes: `Adelanta a ${m.target} vehículos.`,
    close: `Haz ${m.target} adelantamientos ajustados (carril de al lado, a más de 100 km/h).`,
    fast: `Recorre ${(m.target / 1000).toLocaleString('es')} km por encima de 100 km/h.`,
  })[m.type];

function ModeSelect({ record, onPick }) {
  const done = record?.progress?.missions ?? {};
  const best = record?.best ?? {};
  return (
    <div className="tr-select game-scroll">
      <header>
        <p className="eyebrow">Traffic Rider</p>
        <h2 className="tr-select__title">A la carretera</h2>
        <p className="tr-select__text">Esquiva el tráfico, adelanta y llega lejos. Más de 100 km/h suma más puntos.</p>
      </header>
      <button type="button" className="tr-free" onClick={() => onPick(FREE)}>
        <InfinityIcon aria-hidden="true" />
        <span>
          <strong>Carrera libre</strong>
          <small>
            {Number.isFinite(best.distance) ? `Récord: ${(best.distance / 1000).toLocaleString('es', { maximumFractionDigits: 2 })} km · ${Math.round(best.score ?? 0).toLocaleString('es')} puntos` : 'Sin final: el tráfico aumenta con la distancia'}
          </small>
        </span>
      </button>
      <section aria-labelledby="tr-missions">
        <h3 id="tr-missions" className="tr-select__subtitle">
          Misiones
        </h3>
        <ol className="tr-missions">
          {MISSIONS.map((m, i) => {
            const unlocked = i === 0 || done[MISSIONS[i - 1].id];
            return (
              <li key={m.id}>
                <button
                  type="button"
                  className={cx('tr-mission', done[m.id] && 'is-done', !unlocked && 'is-locked')}
                  disabled={!unlocked}
                  onClick={() => onPick(m)}
                  aria-label={`Misión ${i + 1}: ${m.name}. ${describe(m)}${done[m.id] ? ' Cumplida.' : ''}${unlocked ? '' : ' Bloqueada.'}`}
                >
                  <span className="tr-mission__n">{i + 1}</span>
                  <span className="tr-mission__body">
                    <strong>{m.name}</strong>
                    <small>{describe(m)}</small>
                  </span>
                  {!unlocked ? <Lock aria-hidden="true" /> : done[m.id] ? <Check aria-hidden="true" /> : <Flag aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

function Ride({ mode, frame, record, onMenu }) {
  const session = useGameSession(GAME_ID);
  const audio = useGameAudio();
  const reduced = useReducedMotion();
  const touchUI = useMediaQuery('(hover: none), (pointer: coarse)');
  const lowLandscape = useMediaQuery('(orientation: landscape) and (max-height: 500px)');
  const portraitPhone = useMediaQuery('(orientation: portrait) and (max-width: 599px)');
  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState('countdown');
  const [hud, setHud] = useState({ speed: 0, distance: 0, score: 0, progress: null, scene: sceneAt(0).name });
  const [result, setResult] = useState(null);
  const world = useRef(createRide(Date.now()));
  const view = useRef(createRenderState());
  const touch = useRef(NO_INPUT);
  const hudClock = useRef(0);
  const { start, reset: resetSession, finish } = session;
  const bottomInset = touchUI && !lowLandscape ? 140 : 12;
  const insetRef = useRef(bottomInset);
  insetRef.current = bottomInset;

  const draw = useCallback((dt = 0) => renderRide(ctxRef.current, sizeRef.current, world.current, view.current, insetRef.current, dt), []);
  const { canvasRef, ctxRef, sizeRef } = useCanvas(() => draw(0));

  useInProgress(session.isPlaying || session.isPaused);
  usePauseOnInterrupt(session.pause);
  useEffect(() => {
    if (!session.isPlaying) touch.current = NO_INPUT;
  }, [session.isPlaying]);
  useEffect(() => {
    const release = () => {
      touch.current = NO_INPUT;
    };
    window.addEventListener('blur', release);
    return () => window.removeEventListener('blur', release);
  }, []);

  const end = useCallback(
    async (outcome) => {
      const s = world.current;
      const distance = Math.round(s.bike.z);
      const score = Math.round(s.score);
      setPhase('over');
      setResult({ outcome, distance, score, overtakes: s.overtakes, close: s.close, saving: true });
      const marks = [
        { key: 'distance', value: distance, better: 'higher' },
        { key: 'score', value: score, better: 'higher' },
      ];
      const saved = await finish({
        completed: outcome === 'done',
        marks,
        progress: (p) => ({
          ...p,
          overtakes: (p.overtakes ?? 0) + s.overtakes,
          missions: outcome === 'done' && mode.type !== 'free' ? { ...(p.missions ?? {}), [mode.id]: true } : (p.missions ?? {}),
        }),
      });
      setResult((r) => r && { ...r, saving: false, mark: saved.marks.distance, scoreMark: saved.marks.score });
    },
    [finish, mode],
  );

  const keys = useKeyboard({
    active: phase !== 'over',
    onAction: (action) => {
      if (action === 'pause' && phase === 'run') session.togglePause();
    },
  });

  useGameLoop(
    (dt) => {
      const running = phase === 'run' && session.statusRef.current === 'playing';
      if (running) {
        const pressed = keys.current;
        const t = touch.current;
        const input = {
          throttle: (pressed.has('up') || t.up ? 1 : 0) - (pressed.has('down') || t.down ? 1 : 0),
          steer: (pressed.has('right') || t.right ? 1 : 0) - (pressed.has('left') || t.left ? 1 : 0),
        };
        view.current.reduced = reduced;
        for (const event of step(world.current, input, dt)) {
          if (event.type === 'crash') {
            audio.play(SFX.crash);
            navigator.vibrate?.(80);
            end('crash');
          } else if (event.type === 'overtake') audio.play(event.close ? SFX.close : SFX.overtake);
        }
        const s = world.current;
        if (mode.type !== 'free' && s.status === 'riding') {
          const progress = missionProgress(mode, s);
          if (progress.done) {
            audio.play(SFX.done);
            end('done');
          } else if (progress.failed) end('timeout');
        }
        hudClock.current += dt;
        if (hudClock.current > 0.12) {
          hudClock.current = 0;
          setHud({
            speed: Math.round(s.bike.speed * KMH),
            distance: s.bike.z,
            score: Math.round(s.score),
            progress: mode.type !== 'free' ? missionProgress(mode, s) : null,
            time: s.time,
            scene: sceneAt(s.bike.z).name,
          });
        }
      }
      draw(running ? dt : 0);
    },
    phase === 'countdown' || (phase === 'run' && session.isPlaying),
  );

  const restart = useCallback(() => {
    resetSession();
    world.current = createRide(Date.now());
    view.current = createRenderState();
    touch.current = NO_INPUT;
    setHud({ speed: 0, distance: 0, score: 0, progress: null, scene: sceneAt(0).name });
    setResult(null);
    setPhase('countdown');
    setRound((r) => r + 1);
    draw(0);
  }, [resetSession, draw]);

  useEffect(() => {
    const onKey = (event) => {
      if ((event.key === 'r' || event.key === 'R') && !event.ctrlKey && !event.metaKey) restart();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [restart]);

  const goalItem =
    mode.type === 'free'
      ? { id: 'score', label: 'Puntos', value: hud.score.toLocaleString('es') }
      : {
          id: 'goal',
          label: mode.type === 'time' ? `Meta · ${Math.max(0, Math.ceil(mode.limit - (hud.time ?? 0)))} s` : 'Misión',
          value: hud.progress ? `${mode.type === 'distance' || mode.type === 'time' || mode.type === 'fast' ? `${(hud.progress.value / 1000).toFixed(1)}/${mode.target / 1000} km` : `${hud.progress.value}/${hud.progress.target}`}` : '—',
        };

  return (
    <div className={cx('game-stage', 'rider', touchUI && 'has-touch')}>
      <canvas ref={canvasRef} role="img" aria-label={`Carretera vista desde detrás de la moto. Escenario: ${hud.scene}.`} />
      <GameHUD
        onPause={phase === 'run' ? session.togglePause : undefined}
        paused={session.isPaused}
        items={[
          { id: 'speed', label: 'km/h', value: String(hud.speed) },
          { id: 'distance', label: 'Distancia', value: `${(hud.distance / 1000).toFixed(2)} km` },
          goalItem,
        ]}
      />
      {touchUI && phase !== 'over' && <DriveControls key={round} inputRef={touch} side={lowLandscape} />}
      {phase === 'run' && <ControlsHint key={round} touch="Pedales a la derecha · dirección a la izquierda" desktop="↑ acelerar · ↓ frenar · ← → cambiar de carril · Esc pausa" />}
      {phase === 'countdown' && portraitPhone && (
        <p className="rotate-hint">
          <Smartphone aria-hidden="true" /> En horizontal verás más carretera
        </p>
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
      {session.isPaused && phase === 'run' && <PauseMenu onResume={session.resume} onRestart={restart} onExit={frame.exit} />}
      {result && (
        <GameResults
          outcome={result.outcome === 'done' ? 'win' : 'lose'}
          eyebrow={result.outcome === 'done' ? '¡Misión cumplida!' : result.outcome === 'timeout' ? 'Se acabó el tiempo' : '¡Choque!'}
          title={`${(result.distance / 1000).toLocaleString('es', { maximumFractionDigits: 2 })} km`}
          message={`${result.overtakes} adelantamientos${result.close ? `, ${result.close} ajustados` : ''}.`}
          saving={result.saving}
          stats={[
            {
              label: 'Distancia',
              value: `${(result.distance / 1000).toLocaleString('es', { maximumFractionDigits: 2 })} km`,
              record: result.mark?.isRecord && result.mark.previous !== null,
              best: result.mark && !result.mark.isRecord ? `${(result.mark.best / 1000).toLocaleString('es', { maximumFractionDigits: 2 })} km` : null,
            },
            {
              label: 'Puntos',
              value: result.score.toLocaleString('es'),
              record: result.scoreMark?.isRecord && result.scoreMark.previous !== null,
            },
          ]}
          onReplay={restart}
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

/** Traffic Rider: carrera libre y misiones. */
export default function TrafficRider() {
  const frame = useGameFrame();
  const record = useGameRecord(GAME_ID);
  const [mode, setMode] = useState(null);
  if (!mode) return <ModeSelect record={record} onPick={setMode} />;
  return <Ride key={mode.id} mode={mode} frame={frame} record={record} onMenu={() => setMode(null)} />;
}
