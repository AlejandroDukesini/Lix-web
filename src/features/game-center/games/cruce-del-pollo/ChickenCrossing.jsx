import { useCallback, useEffect, useRef, useState } from 'react';
import { Hand } from 'lucide-react';
import { GameHUD } from '../../components/GameHUD.jsx';
import { PauseMenu } from '../../components/GameOverlay.jsx';
import { GameResults } from '../../components/GameResults.jsx';
import { Countdown } from '../../components/Countdown.jsx';
import { ControlsHint, DPad, useSwipe } from '../../components/TouchControls.jsx';
import { useCanvas } from '../../hooks/useCanvas.js';
import { useGameLoop } from '../../hooks/useGameLoop.js';
import { useGameSession } from '../../hooks/useGameSession.js';
import { useGameRecord } from '../../hooks/useGameStatistics.js';
import { useGameAudio } from '../../hooks/useGameAudio.js';
import { useGameFrame, useInProgress, usePauseOnInterrupt } from '../../hooks/useGameFrame.js';
import { useKeyboard } from '../../hooks/useKeyboard.js';
import { useReducedMotion } from '../../../../hooks/useReducedMotion.js';
import { ROUNDS, createRun, requestHop, step } from './engine/chickenEngine.js';
import { burst, chickenScreenPoint, createRenderState, renderChicken } from './engine/chickenRenderer.js';
import './styles/chicken.css';

const GAME_ID = 'cruce-del-pollo';
const SFX = {
  tick: { wave: 'square', from: 440, dur: 0.08, gain: 0.08 },
  go: { wave: 'square', from: 880, dur: 0.2, gain: 0.1 },
  hop: { wave: 'triangle', from: 520, to: 760, dur: 0.07, gain: 0.07 },
  blocked: { wave: 'square', from: 150, to: 120, dur: 0.06, gain: 0.05 },
  round: [
    { wave: 'triangle', from: 660, dur: 0.12, gain: 0.12 },
    { wave: 'triangle', from: 880, dur: 0.2, gain: 0.12, delay: 0.1 },
  ],
  // Derrota cómica: «¡cloc!» y un silbido que cae, nada realista.
  splat: [
    { wave: 'square', from: 900, to: 300, dur: 0.12, gain: 0.12 },
    { wave: 'sine', from: 700, to: 120, dur: 0.5, gain: 0.1, delay: 0.08 },
  ],
  splash: [
    { noise: true, from: 1800, to: 300, dur: 0.45, gain: 0.25 },
    { wave: 'sine', from: 500, to: 160, dur: 0.4, gain: 0.08 },
  ],
};

const DEFEAT = {
  car: { eyebrow: '¡Atropellada!', title: 'La gallina no vio venir ese coche' },
  water: { eyebrow: '¡Plaf!', title: 'La gallina acabó en el río' },
  current: { eyebrow: '¡Corriente!', title: 'El río se llevó a la gallina' },
};

export default function ChickenCrossing() {
  const frame = useGameFrame();
  const record = useGameRecord(GAME_ID);
  const session = useGameSession(GAME_ID);
  const audio = useGameAudio();
  const reduced = useReducedMotion();
  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState('countdown'); // countdown | run | over
  const [hud, setHud] = useState({ score: 0, round: 1 });
  const [banner, setBanner] = useState(null);
  const [result, setResult] = useState(null);
  const world = useRef(createRun(Date.now()));
  const view = useRef(createRenderState());
  const { start, reset: resetSession, finish } = session;

  const draw = useCallback((dt = 0) => renderChicken(ctxRef.current, sizeRef.current, world.current, view.current, dt), []);
  const { canvasRef, ctxRef, sizeRef } = useCanvas(() => draw(0));

  useInProgress(session.isPlaying || session.isPaused);
  usePauseOnInterrupt(session.pause);

  const playing = phase === 'run' && session.isPlaying;

  /** Una única entrada para teclado, deslizamiento, toque y cruceta: no hay acciones dobles. */
  const hop = useCallback(
    (direction) => {
      if (phase !== 'run' || session.statusRef.current !== 'playing') return;
      audio.play(requestHop(world.current, direction) ? SFX.hop : SFX.blocked);
    },
    [phase, session.statusRef, audio],
  );

  useKeyboard({
    active: phase !== 'over',
    onAction: (action) => {
      if (action === 'pause' && phase === 'run') session.togglePause();
      else if (['up', 'down', 'left', 'right'].includes(action)) hop(action);
    },
  });
  const swipe = useSwipe(hop, { onTap: () => hop('up') });

  const end = useCallback(
    async (won) => {
      const state = world.current;
      setPhase('over');
      setResult({ won, cause: state.cause, score: state.score, round: state.round, saving: true });
      const roundsCleared = won ? ROUNDS : state.round - 1;
      const saved = await finish({
        completed: won,
        marks: [
          { key: 'score', value: state.score, better: 'higher' },
          { key: 'round', value: roundsCleared, better: 'higher' },
        ],
        progress: (p) => ({ ...p, bestRound: Math.max(p.bestRound ?? 0, roundsCleared), wins: (p.wins ?? 0) + (won ? 1 : 0) }),
      });
      setResult((r) => r && { ...r, saving: false, mark: saved.marks.score });
    },
    [finish],
  );

  useGameLoop(
    (dt) => {
      const running = phase === 'run' && session.statusRef.current === 'playing';
      if (running) {
        view.current.reduced = reduced;
        for (const event of step(world.current, dt)) {
          if (event.type === 'dead') {
            const point = chickenScreenPoint(sizeRef.current, world.current, view.current);
            burst(view.current, point.x, point.y, event.cause === 'car' ? 'car' : 'water');
            view.current.deathAt = view.current.time;
            audio.play(event.cause === 'car' ? SFX.splat : SFX.splash);
            end(false);
          } else if (event.type === 'won') {
            audio.play(SFX.round);
            end(true);
          } else if (event.type === 'round') {
            audio.play(SFX.round);
            setBanner({ round: event.round, key: Date.now() });
          } else if (event.type === 'hop') {
            audio.play(SFX.hop);
          }
        }
        const s = world.current;
        setHud((h) => (h.score === s.score && h.round === s.round ? h : { score: s.score, round: s.round }));
      }
      draw(running || phase === 'over' ? dt : 0);
    },
    phase === 'countdown' || playing || (phase === 'over' && view.current.particles.length > 0),
  );

  useEffect(() => {
    if (!banner) return undefined;
    const timer = setTimeout(() => setBanner(null), 1600);
    return () => clearTimeout(timer);
  }, [banner]);

  const restart = useCallback(() => {
    resetSession();
    world.current = createRun(Date.now());
    view.current = createRenderState();
    setHud({ score: 0, round: 1 });
    setResult(null);
    setBanner(null);
    setPhase('countdown');
    setRound((r) => r + 1);
    draw(0);
  }, [resetSession, draw]);

  const best = record?.best?.score;
  const defeat = result && !result.won ? DEFEAT[result.cause] ?? DEFEAT.car : null;

  return (
    <div className="game-stage chicken" {...swipe}>
      <canvas ref={canvasRef} role="img" aria-label="Carreteras y ríos vistos desde arriba, con la gallina abajo" />
      <GameHUD
        onPause={phase === 'run' ? session.togglePause : undefined}
        paused={session.isPaused}
        items={[
          { id: 'score', label: 'Puntos', value: String(hud.score) },
          { id: 'round', label: 'Ronda', value: `${hud.round}/${ROUNDS}` },
          {
            id: 'best',
            label: 'Récord',
            value: Number.isFinite(best) ? String(best) : '—',
            tone: Number.isFinite(best) && hud.score > best ? 'good' : undefined,
          },
        ]}
      />
      {phase === 'run' && <DPad onDirection={hop} />}
      {phase === 'run' && (
        <ControlsHint key={round} icon={Hand} touch="Toca para avanzar · desliza para moverte" desktop="Flechas o WASD para saltar · Esc para pausar" />
      )}
      {banner && (
        <p key={banner.key} className="chicken__banner" role="status">
          ¡Ronda {banner.round} superada!
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
          outcome={result.won ? 'win' : 'lose'}
          eyebrow={result.won ? '¡Todas las rondas!' : defeat.eyebrow}
          title={result.won ? 'La gallina cruzó las diez rondas' : defeat.title}
          message={result.won ? 'Ni un rasguño. Bueno, alguna pluma.' : `Llegaste a la ronda ${result.round} de ${ROUNDS}.`}
          saving={result.saving}
          stats={[
            {
              label: 'Puntos',
              value: String(result.score),
              record: result.mark?.isRecord,
              best: result.mark && !result.mark.isRecord ? String(result.mark.best) : null,
            },
            { label: 'Rondas superadas', value: `${result.won ? ROUNDS : result.round - 1}/${ROUNDS}` },
          ]}
          onReplay={restart}
          onExit={frame.exit}
        />
      )}
    </div>
  );
}
