import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Lock, RotateCcw, Star } from 'lucide-react';
import { Button } from '../../../../components/common/Button.jsx';
import { GameHUD } from '../../components/GameHUD.jsx';
import { PauseMenu } from '../../components/GameOverlay.jsx';
import { GameResults } from '../../components/GameResults.jsx';
import { ControlsHint, DriveControls } from '../../components/TouchControls.jsx';
import { useCanvas } from '../../hooks/useCanvas.js';
import { useGameLoop } from '../../hooks/useGameLoop.js';
import { useGameSession } from '../../hooks/useGameSession.js';
import { useGameRecord } from '../../hooks/useGameStatistics.js';
import { useGameAudio } from '../../hooks/useGameAudio.js';
import { useGameFrame, useInProgress, usePauseOnInterrupt } from '../../hooks/useGameFrame.js';
import { useKeyboard } from '../../hooks/useKeyboard.js';
import { useMediaQuery } from '../../../../hooks/useMediaQuery.js';
import { formatTime } from '../../services/gameLifecycle.js';
import { cx } from '../../../../utils/cx.js';
import { MAX_HITS, createParking, starsFor, step } from './engine/parkingEngine.js';
import { createRenderState, renderParking } from './engine/parkingRenderer.js';
import { LEVELS } from './levels/levels.js';
import './styles/aparcar.css';

const GAME_ID = 'aparcar';
const SFX = {
  hit: [
    { noise: true, from: 900, to: 200, dur: 0.18, gain: 0.25 },
    { wave: 'square', from: 140, to: 90, dur: 0.15, gain: 0.08 },
  ],
  parked: [
    { wave: 'triangle', from: 523, dur: 0.14, gain: 0.14 },
    { wave: 'triangle', from: 784, dur: 0.3, gain: 0.14, delay: 0.12 },
  ],
  wrecked: { wave: 'sawtooth', from: 300, to: 80, dur: 0.6, gain: 0.1 },
};
const NO_INPUT = Object.freeze({ up: false, down: false, left: false, right: false });

const isUnlocked = (index, completed) => index === 0 || Boolean(completed[LEVELS[index - 1].id]);

function LevelSelect({ completed, best, onPick }) {
  return (
    <div className="pk-select game-scroll">
      <header>
        <p className="eyebrow">Aparcar el carro</p>
        <h2 className="pk-select__title">Elige un aparcamiento</h2>
        <p className="pk-select__text">Lleva el coche hasta la plaza verde, mirando hacia donde marca la flecha, y detente. Cada nivel superado abre el siguiente.</p>
      </header>
      <ol className="pk-levels">
        {LEVELS.map((level, index) => {
          const unlocked = isUnlocked(index, completed);
          const stars = completed[level.id];
          const time = best[`time:${level.id}`];
          return (
            <li key={level.id}>
              <button
                type="button"
                className={cx('pk-level', stars && 'is-done', !unlocked && 'is-locked')}
                disabled={!unlocked}
                onClick={() => onPick(level)}
                aria-label={`Nivel ${index + 1}: ${level.name}.${stars ? ` ${stars} de 3 estrellas.` : ''}${unlocked ? '' : ' Bloqueado.'}`}
              >
                <span className="pk-level__number">{index + 1}</span>
                <span className="pk-level__name">{level.name}</span>
                <span className="pk-level__meta">
                  {!unlocked ? (
                    <Lock aria-hidden="true" />
                  ) : stars ? (
                    <>
                      <span className="pk-stars" aria-hidden="true">
                        {[1, 2, 3].map((n) => (
                          <Star key={n} className={n <= stars ? 'is-on' : undefined} />
                        ))}
                      </span>
                      {Number.isFinite(time) ? formatTime(time, { decimals: 0 }) : ''}
                    </>
                  ) : (
                    level.tip
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

function Drive({ level, frame, onLevels, onNext }) {
  const session = useGameSession(GAME_ID);
  const audio = useGameAudio();
  const touchUI = useMediaQuery('(hover: none), (pointer: coarse)');
  const lowLandscape = useMediaQuery('(orientation: landscape) and (max-height: 500px)');
  const [round, setRound] = useState(0);
  const [hud, setHud] = useState({ hits: 0, time: 0, gear: 'N' });
  const [result, setResult] = useState(null);
  const world = useRef(createParking(level));
  const view = useRef(createRenderState());
  const touch = useRef(NO_INPUT);
  const lastInput = useRef({ throttle: 0, steer: 0 });
  const hudClock = useRef(0);
  const { start, reset: resetSession, finish } = session;
  // Zona reservada para el marcador y los controles: el aparcamiento se dibuja en el resto.
  const insets = touchUI ? (lowLandscape ? { top: 78, bottom: 4, left: 112, right: 112 } : { top: 84, bottom: 150 }) : { top: 84, bottom: 8 };
  const insetsRef = useRef(insets);
  insetsRef.current = insets;

  const draw = useCallback((dt = 0) => renderParking(ctxRef.current, sizeRef.current, world.current, view.current, lastInput.current, insetsRef.current, dt), []);
  const { canvasRef, ctxRef, sizeRef } = useCanvas(() => draw(0));

  useEffect(() => {
    start();
  }, [start]);
  useInProgress(session.isPlaying || session.isPaused);
  usePauseOnInterrupt(session.pause);

  // Nada queda pulsado si la ventana pierde el foco o se pausa (ni el acelerador, ni el volante).
  useEffect(() => {
    const release = () => {
      touch.current = NO_INPUT;
    };
    window.addEventListener('blur', release);
    return () => window.removeEventListener('blur', release);
  }, []);
  useEffect(() => {
    if (!session.isPlaying) touch.current = NO_INPUT;
  }, [session.isPlaying]);

  const restart = useCallback(() => {
    resetSession();
    world.current = createParking(level);
    view.current = createRenderState();
    touch.current = NO_INPUT;
    setHud({ hits: 0, time: 0, gear: 'N' });
    setResult(null);
    setRound((r) => r + 1);
    start();
    draw(0);
  }, [resetSession, level, start, draw]);

  const keys = useKeyboard({
    active: !result,
    onAction: (action) => {
      if (action === 'pause') session.togglePause();
    },
  });
  useEffect(() => {
    const onKey = (event) => {
      if ((event.key === 'r' || event.key === 'R') && !event.ctrlKey && !event.metaKey) restart();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [restart]);

  const end = useCallback(
    async (parked) => {
      const state = world.current;
      const timeMs = Math.round(state.time * 1000);
      const stars = parked ? starsFor(state) : 0;
      setResult({ parked, stars, timeMs, hits: state.hits, saving: true });
      const saved = await finish({
        completed: parked,
        marks: parked ? [{ key: `time:${level.id}`, value: timeMs, better: 'lower' }] : [],
        progress: parked ? (p) => ({ ...p, completed: { ...(p.completed ?? {}), [level.id]: Math.max(p.completed?.[level.id] ?? 0, stars) } }) : undefined,
      });
      setResult((r) => r && { ...r, saving: false, mark: saved.marks[`time:${level.id}`] });
    },
    [finish, level.id],
  );

  useGameLoop(
    (dt) => {
      const playing = session.statusRef.current === 'playing' && !result;
      if (playing) {
        const pressed = keys.current;
        const t = touch.current;
        const up = pressed.has('up') || t.up;
        const down = pressed.has('down') || t.down;
        const left = pressed.has('left') || t.left;
        const right = pressed.has('right') || t.right;
        const input = { throttle: (up ? 1 : 0) - (down ? 1 : 0), steer: (right ? 1 : 0) - (left ? 1 : 0) };
        lastInput.current = input;
        for (const event of step(world.current, input, dt)) {
          if (event.type === 'hit') {
            audio.play(SFX.hit);
            view.current.flash = 1;
            navigator.vibrate?.(40);
          } else if (event.type === 'parked') {
            audio.play(SFX.parked);
            end(true);
          } else if (event.type === 'wrecked') {
            audio.play(SFX.wrecked);
            end(false);
          }
        }
        hudClock.current += dt;
        if (hudClock.current > 0.15) {
          hudClock.current = 0;
          const { car, hits, time } = world.current;
          setHud({ hits, time, gear: car.speed < -0.05 ? 'R' : car.speed > 0.05 ? 'D' : 'N' });
        }
      }
      draw(dt);
    },
    (session.isPlaying && !result) || view.current.flash > 0,
  );

  return (
    <div className={cx('game-stage', 'parking', touchUI && 'has-touch', lowLandscape && 'is-low')}>
      <canvas ref={canvasRef} role="img" aria-label={`Aparcamiento visto desde arriba: lleva el coche rojo hasta la plaza verde. ${level.tip}`} />
      <GameHUD
        onPause={session.togglePause}
        paused={session.isPaused}
        pauseDisabled={Boolean(result)}
        items={[
          { id: 'level', label: 'Nivel', value: level.name, wide: true },
          { id: 'hits', label: 'Golpes', value: `${hud.hits}/${MAX_HITS}`, tone: hud.hits >= MAX_HITS - 1 ? 'warn' : undefined },
          { id: 'time', label: 'Tiempo', value: formatTime(hud.time * 1000, { decimals: 0 }) },
          { id: 'gear', label: 'Marcha', value: hud.gear },
        ]}
      />
      {touchUI && !result && <DriveControls key={round} inputRef={touch} brakeLabel="Frenar o marcha atrás" side={lowLandscape} />}
      {!result && <ControlsHint key={round} touch={level.tip} desktop={`${level.tip} · Flechas o WASD para conducir`} duration={5000} />}
      {session.isPaused && !result && <PauseMenu onResume={session.resume} onRestart={restart} onExit={frame.exit} />}
      {result && (
        <GameResults
          outcome={result.parked ? 'win' : 'lose'}
          eyebrow={result.parked ? '¡Aparcado!' : 'Demasiados golpes'}
          title={result.parked ? `${level.name}: ${'★'.repeat(result.stars)}${'☆'.repeat(3 - result.stars)}` : 'Hoy el seguro no está contento'}
          message={
            result.parked
              ? result.stars === 3
                ? 'Sin un rasguño y a tiempo.'
                : `Para las tres estrellas: sin golpes y en menos de ${level.par} s.`
              : `El coche tocó obstáculos ${MAX_HITS} veces. Ve más despacio y usa la marcha atrás.`
          }
          saving={result.saving}
          stats={[
            {
              label: 'Tiempo',
              value: formatTime(result.timeMs, { decimals: 0 }),
              record: result.parked && result.mark?.isRecord && result.mark.previous !== null,
              best: result.mark && !result.mark.isRecord ? formatTime(result.mark.best, { decimals: 0 }) : null,
            },
            { label: 'Golpes', value: `${result.hits}/${MAX_HITS}` },
          ]}
          onReplay={result.parked && onNext ? onNext : restart}
          replayLabel={result.parked && onNext ? 'Siguiente nivel' : 'Repetir'}
          extraActions={
            <>
              {result.parked && (
                <Button variant="secondary" icon={RotateCcw} onClick={restart}>
                  Repetir
                </Button>
              )}
              <Button variant="secondary" icon={Check} onClick={onLevels}>
                Niveles
              </Button>
            </>
          }
          onExit={frame.exit}
        />
      )}
    </div>
  );
}

/** Aparcar el carro: selección de nivel y conducción. */
export default function Aparcar() {
  const frame = useGameFrame();
  const record = useGameRecord(GAME_ID);
  const [level, setLevel] = useState(null);
  const completed = record?.progress?.completed ?? {};
  const index = level ? LEVELS.indexOf(level) : -1;
  const next = index >= 0 ? LEVELS[index + 1] ?? null : null;

  if (!level) return <LevelSelect completed={completed} best={record?.best ?? {}} onPick={setLevel} />;
  return <Drive key={level.id} level={level} frame={frame} onLevels={() => setLevel(null)} onNext={next ? () => setLevel(next) : null} />;
}
