import { useCallback, useEffect, useRef, useState } from 'react';
import { GameHUD } from '../../components/GameHUD.jsx';
import { PauseMenu } from '../../components/GameOverlay.jsx';
import { GameResults } from '../../components/GameResults.jsx';
import { Countdown } from '../../components/Countdown.jsx';
import { Hand } from 'lucide-react';
import { ControlsHint, DragIndicator, SteerButtons, useDragSteer } from '../../components/TouchControls.jsx';
import { useCanvas } from '../../hooks/useCanvas.js';
import { useGameLoop } from '../../hooks/useGameLoop.js';
import { useGameSession } from '../../hooks/useGameSession.js';
import { useGameRecord } from '../../hooks/useGameStatistics.js';
import { useGameAudio } from '../../hooks/useGameAudio.js';
import { useGameFrame, useInProgress, usePauseOnInterrupt } from '../../hooks/useGameFrame.js';
import { useKeyboard } from '../../hooks/useKeyboard.js';
import { useReducedMotion } from '../../../../hooks/useReducedMotion.js';
import { MILESTONES, createTunnel, scoreOf, sectorName, step } from './engine/tunnelEngine.js';
import { createRenderState, renderTunnel } from './engine/tunnelRenderer.js';
import './styles/tunnel-runner.css';

const GAME_ID = 'tunnel-runner';
const SFX = {
  tick: { wave: 'square', from: 440, dur: 0.08, gain: 0.08 },
  go: { wave: 'square', from: 880, dur: 0.2, gain: 0.1 },
  pass: { wave: 'sine', from: 900, to: 1200, dur: 0.05, gain: 0.04 },
  sector: [
    { wave: 'sawtooth', from: 330, to: 660, dur: 0.25, gain: 0.07 },
    { wave: 'sawtooth', from: 495, to: 990, dur: 0.3, gain: 0.06, delay: 0.12 },
  ],
  crash: [
    { noise: true, from: 2400, to: 120, dur: 0.6, gain: 0.45 },
    { wave: 'sawtooth', from: 160, to: 40, dur: 0.5, gain: 0.15 },
  ],
};

export default function TunnelRunner() {
  const frame = useGameFrame();
  const record = useGameRecord(GAME_ID);
  const session = useGameSession(GAME_ID);
  const audio = useGameAudio();
  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState('countdown'); // countdown | run | over
  const [hud, setHud] = useState({ distance: 0, speed: 0, sector: 0 });
  const [banner, setBanner] = useState(null);
  const [result, setResult] = useState(null);
  const world = useRef(createTunnel(Date.now()));
  const view = useRef(createRenderState());
  const touch = useRef({ left: false, right: false });
  const hudClock = useRef(0);
  const reduced = useReducedMotion();
  const { start, reset: resetSession, finish } = session;
  const drag = useDragSteer({ enabled: phase === 'run' && session.isPlaying, range: 80 });

  const draw = useCallback((dt = 0) => renderTunnel(ctxRef.current, sizeRef.current, world.current, view.current, dt), []);
  const { canvasRef, ctxRef, sizeRef } = useCanvas(() => draw(0));

  useInProgress(session.isPlaying || session.isPaused);
  usePauseOnInterrupt(session.pause);

  const keys = useKeyboard({
    active: phase !== 'over',
    onAction: (action) => {
      if (action === 'pause' && phase === 'run') session.togglePause();
    },
  });

  const end = useCallback(async () => {
    const state = world.current;
    const distance = scoreOf(state);
    setPhase('over');
    setResult({ distance, sector: state.sector, passed: state.passed, saving: true });
    const saved = await finish({
      completed: false,
      marks: [{ key: 'distance', value: distance, better: 'higher' }],
      progress: (p) => ({ ...p, rings: Math.max(p.rings ?? 0, state.passed) }),
    });
    setResult((r) => r && { ...r, saving: false, mark: saved.marks.distance });
  }, [finish]);

  // Bucle: corre durante la cuenta atrás (solo dibuja) y la carrera (simula y dibuja).
  useGameLoop(
    (dt) => {
      const running = phase === 'run' && session.statusRef.current === 'playing';
      if (running) {
        const pressed = keys.current;
        const left = pressed.has('left') || touch.current.left;
        const right = pressed.has('right') || touch.current.right;
        // Teclado y botones mandan; si no se usan, el arrastre táctil gira de forma proporcional.
        const input = left || right ? { left, right } : { steer: drag.steerRef.current };
        view.current.reduced = reduced;
        for (const event of step(world.current, input, dt)) {
          if (event.type === 'crash') {
            audio.play(SFX.crash);
            view.current.flash = 1;
            view.current.shake = 1;
            end();
          } else if (event.type === 'sector') {
            audio.play(SFX.sector);
            setBanner({ sector: event.sector, key: Date.now() });
          } else if (event.type === 'pass') {
            audio.play(SFX.pass);
          }
        }
        hudClock.current += dt;
        if (hudClock.current > 0.1) {
          hudClock.current = 0;
          const s = world.current;
          setHud({ distance: scoreOf(s), speed: Math.round(s.speed * 3.6), sector: s.sector });
        }
      }
      draw(running ? dt : dt * 0.25);
    },
    phase === 'countdown' || (phase === 'run' && session.isPlaying) || (phase === 'over' && view.current.flash > 0),
  );

  useEffect(() => {
    if (!banner) return undefined;
    const timer = setTimeout(() => setBanner(null), 2200);
    return () => clearTimeout(timer);
  }, [banner]);

  const restart = useCallback(() => {
    resetSession();
    world.current = createTunnel(Date.now());
    view.current = createRenderState();
    touch.current = { left: false, right: false };
    setHud({ distance: 0, speed: 0, sector: 0 });
    setResult(null);
    setBanner(null);
    setPhase('countdown');
    setRound((r) => r + 1);
    draw(0);
  }, [resetSession, draw]);

  const best = record?.best?.distance;
  const nextMilestone = MILESTONES.find((m) => m > Math.max(hud.distance, best ?? 0));

  return (
    <div className="game-stage tunnel" {...drag.handlers}>
      <canvas ref={canvasRef} aria-label="Túnel de neón visto desde la nave" role="img" />
      <DragIndicator indicator={drag.indicator} />
      <GameHUD
        onPause={phase === 'run' ? session.togglePause : undefined}
        paused={session.isPaused}
        items={[
          { id: 'distance', label: 'Distancia', value: `${hud.distance.toLocaleString('es')} m` },
          { id: 'speed', label: 'Velocidad', value: `${hud.speed} km/h` },
          { id: 'sector', label: `Sector ${hud.sector + 1}`, value: sectorName(hud.sector) },
          {
            id: 'best',
            label: 'Récord',
            value: Number.isFinite(best) ? `${best.toLocaleString('es')} m` : '—',
            tone: Number.isFinite(best) && hud.distance > best ? 'good' : undefined,
          },
        ]}
      />
      {phase === 'run' && <SteerButtons inputRef={touch} />}
      {phase === 'run' && (
        <ControlsHint
          key={round}
          icon={Hand}
          touch="Desliza ← → para girar"
          desktop="← → o A D para girar · Esc para pausar"
        />
      )}
      {banner && (
        <p key={banner.key} className="tunnel__banner" role="status">
          <span>Sector {banner.sector + 1}</span> {sectorName(banner.sector)}
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
          outcome="lose"
          eyebrow="¡Choque!"
          title={`${result.distance.toLocaleString('es')} metros`}
          message={nextMilestone ? `Próximo hito: ${nextMilestone.toLocaleString('es')} m.` : 'Has superado todos los hitos del túnel.'}
          saving={result.saving}
          stats={[
            {
              label: 'Distancia',
              value: `${result.distance.toLocaleString('es')} m`,
              record: result.mark?.isRecord,
              best: result.mark && !result.mark.isRecord ? `${result.mark.best.toLocaleString('es')} m` : null,
            },
            { label: 'Sector', value: `${result.sector + 1} · ${sectorName(result.sector)}` },
            { label: 'Anillos', value: String(result.passed) },
          ]}
          onReplay={restart}
          onExit={frame.exit}
        />
      )}
    </div>
  );
}
