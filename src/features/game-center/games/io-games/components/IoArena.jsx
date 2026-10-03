import { useCallback, useRef, useState } from 'react';
import { ListOrdered } from 'lucide-react';
import { Button } from '../../../../../components/common/Button.jsx';
import { GameHUD } from '../../../components/GameHUD.jsx';
import { PauseMenu } from '../../../components/GameOverlay.jsx';
import { GameResults } from '../../../components/GameResults.jsx';
import { Countdown } from '../../../components/Countdown.jsx';
import { DPad, Joystick, useSwipe } from '../../../components/TouchControls.jsx';
import { useCanvas } from '../../../hooks/useCanvas.js';
import { useGameLoop } from '../../../hooks/useGameLoop.js';
import { useGameSession } from '../../../hooks/useGameSession.js';
import { useGameAudio } from '../../../hooks/useGameAudio.js';
import { useGameFrame, useInProgress, usePauseOnInterrupt } from '../../../hooks/useGameFrame.js';
import { useKeyboard } from '../../../hooks/useKeyboard.js';
import { vectorFromKeys } from '../engine/vector.js';

const GAME_ID = 'io-games';
const COUNTDOWN_SFX = { wave: 'square', from: 520, dur: 0.08, gain: 0.08 };
const GO_SFX = { wave: 'square', from: 1040, dur: 0.18, gain: 0.08 };

/**
 * Arena común de los minijuegos .io. Cada modo aporta su configuración:
 *   create(seed), step(world, input, dt) → eventos, render(ctx, size, world, view, dt),
 *   hud(world) → items, summary(world) → { outcome, title, message, stats, score, won },
 *   input: 'vector' (joystick/ratón/teclado) | 'grid' (direcciones),
 *   steer(world, direction) para los modos de cuadrícula, sounds { [evento]: receta }.
 */
export function IoArena({ mode, config, onMenu }) {
  const frame = useGameFrame();
  const session = useGameSession(GAME_ID);
  const audio = useGameAudio();
  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState('countdown');
  const [hud, setHud] = useState(() => config.hud(config.create(1)));
  const [result, setResult] = useState(null);
  const world = useRef(config.create(Date.now()));
  const view = useRef({});
  const joystick = useRef({ x: 0, y: 0 });
  const mouse = useRef(null); // destino del ratón en coordenadas de pantalla
  const hudClock = useRef(0);
  const ended = useRef(false);
  const { start, reset: resetSession, finish } = session;

  const draw = useCallback((dt = 0) => config.render(ctxRef.current, sizeRef.current, world.current, view.current, dt), [config]);
  const { canvasRef, ctxRef, sizeRef } = useCanvas(() => draw(0));

  useInProgress(session.isPlaying || session.isPaused);
  usePauseOnInterrupt(session.pause);

  const steer = useCallback(
    (direction) => {
      if (phase !== 'run' || !session.isPlaying) return;
      config.steer?.(world.current, direction);
    },
    [config, phase, session.isPlaying],
  );

  const keys = useKeyboard({
    active: phase !== 'over',
    onAction: (action) => {
      if (action === 'pause' && phase === 'run') session.togglePause();
      else if (config.input === 'grid' && ['up', 'down', 'left', 'right'].includes(action)) steer(action);
    },
  });

  const end = useCallback(async () => {
    const summary = config.summary(world.current);
    setPhase('over');
    setResult({ ...summary, saving: true });
    const key = `${mode.id}:score`;
    const saved = await finish({
      completed: summary.won,
      marks: [{ key, value: summary.score, better: 'higher' }],
      progress: (p) => {
        const wins = { ...(p.wins ?? {}) };
        if (summary.won) wins[mode.id] = true;
        const played = { ...(p.played ?? {}), [mode.id]: (p.played?.[mode.id] ?? 0) + 1 };
        return { ...p, wins, played };
      },
    });
    setResult((r) => r && { ...r, saving: false, mark: saved.marks[key] });
  }, [config, finish, mode.id]);

  /** Dirección analógica para los modos de movimiento libre. */
  const vectorInput = () => {
    const fromKeys = vectorFromKeys(keys.current);
    if (fromKeys.x || fromKeys.y) return fromKeys;
    if (joystick.current.x || joystick.current.y) return joystick.current;
    const target = mouse.current;
    const origin = view.current.playerScreen;
    if (target && origin) {
      const dx = target.x - origin.x;
      const dy = target.y - origin.y;
      const length = Math.hypot(dx, dy);
      if (length < 8) return { x: 0, y: 0 };
      const strength = Math.min(1, length / 90);
      return { x: (dx / length) * strength, y: (dy / length) * strength };
    }
    return { x: 0, y: 0 };
  };

  useGameLoop(
    (dt) => {
      const running = phase === 'run' && session.statusRef.current === 'playing';
      if (running) {
        const input = config.input === 'vector' ? vectorInput() : {};
        for (const event of config.step(world.current, input, dt)) {
          const sound = config.sounds?.[event.type];
          if (sound) audio.play(sound);
        }
        if (world.current.over && !ended.current) {
          ended.current = true;
          end();
        }
        hudClock.current += dt;
        if (hudClock.current > 0.15) {
          hudClock.current = 0;
          setHud(config.hud(world.current));
        }
      }
      draw(running ? dt : 0);
    },
    phase === 'countdown' || (phase === 'run' && session.isPlaying),
  );

  const restart = useCallback(() => {
    resetSession();
    world.current = config.create(Date.now());
    ended.current = false;
    view.current = {};
    joystick.current = { x: 0, y: 0 };
    setHud(config.hud(world.current));
    setResult(null);
    setPhase('countdown');
    setRound((r) => r + 1);
    draw(0);
  }, [config, resetSession, draw]);

  const swipe = useSwipe((direction) => steer(direction));
  const stageHandlers =
    config.input === 'grid'
      ? swipe
      : {
          onPointerMove: (event) => {
            if (event.pointerType !== 'mouse') return;
            const rect = event.currentTarget.getBoundingClientRect();
            mouse.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
          },
          onPointerLeave: (event) => {
            if (event.pointerType === 'mouse') mouse.current = null;
          },
        };

  return (
    <div className={`game-stage io-arena io-arena--${mode.id}`} {...stageHandlers}>
      <canvas ref={canvasRef} role="img" aria-label={`Arena de ${mode.name}`} />
      {config.input === 'vector' && <Joystick vectorRef={joystick} disabled={phase !== 'run' || !session.isPlaying} />}
      <GameHUD onPause={phase === 'run' ? session.togglePause : undefined} paused={session.isPaused} items={hud.items}>
        {hud.board && (
          <ol className="io-board" aria-label="Clasificación">
            {hud.board.map((row) => (
              <li key={row.id} className={row.isBot ? undefined : 'is-you'}>
                <span>{row.name}</span>
                <span>{row.value}</span>
              </li>
            ))}
          </ol>
        )}
      </GameHUD>
      {config.input === 'grid' && phase === 'run' && <DPad onDirection={steer} />}
      {phase === 'countdown' && (
        <Countdown
          key={round}
          paused={frame.interrupted}
          onTick={() => audio.play(COUNTDOWN_SFX)}
          onDone={() => {
            audio.play(GO_SFX);
            setPhase('run');
            start();
          }}
        />
      )}
      {session.isPaused && phase === 'run' && <PauseMenu onResume={session.resume} onRestart={restart} onExit={frame.exit} />}
      {result && (
        <GameResults
          outcome={result.outcome}
          title={result.title}
          message={result.message}
          saving={result.saving}
          stats={[
            {
              label: 'Puntuación',
              value: mode.formatScore(result.score),
              record: result.mark?.isRecord,
              best: result.mark && !result.mark.isRecord ? mode.formatScore(result.mark.best) : null,
            },
            ...result.stats,
          ]}
          onReplay={restart}
          extraActions={
            <Button variant="secondary" icon={ListOrdered} onClick={onMenu}>
              Otros minijuegos
            </Button>
          }
          onExit={frame.exit}
        />
      )}
    </div>
  );
}
