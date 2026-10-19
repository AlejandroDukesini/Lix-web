import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ChevronRight, ListOrdered, Lock, Smartphone } from 'lucide-react';
import { Button } from '../../../../components/common/Button.jsx';
import { GameHUD } from '../../components/GameHUD.jsx';
import { GameOverlay, PauseMenu } from '../../components/GameOverlay.jsx';
import { GameResults } from '../../components/GameResults.jsx';
import { Countdown } from '../../components/Countdown.jsx';
import { ControlsHint, PlatformControls, useTouchUI } from '../../components/TouchControls.jsx';
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
import { DT, coinTotal, createWorld, step } from './engine/brickEngine.js';
import { addEffects, createRenderState, disposeRenderState, renderBricks } from './engine/brickRenderer.js';
import { LEVELS, THEME_NAMES } from './levels/levels.js';
import './styles/reino.css';

const GAME_ID = 'reino-de-ladrillos';
const NO_INPUT = Object.freeze({ left: false, right: false, jump: false });
const SFX = {
  tick: { wave: 'square', from: 440, dur: 0.08, gain: 0.07 },
  go: { wave: 'square', from: 880, dur: 0.18, gain: 0.08 },
  jump: { wave: 'square', from: 260, to: 620, dur: 0.12, gain: 0.04 },
  coin: [
    { wave: 'square', from: 988, dur: 0.05, gain: 0.05 },
    { wave: 'square', from: 1319, dur: 0.12, gain: 0.05, delay: 0.05 },
  ],
  stomp: { wave: 'square', from: 300, to: 120, dur: 0.1, gain: 0.07 },
  kick: { wave: 'square', from: 200, to: 400, dur: 0.06, gain: 0.07 },
  kill: { wave: 'square', from: 500, to: 150, dur: 0.15, gain: 0.06 },
  bump: { wave: 'triangle', from: 140, dur: 0.06, gain: 0.08 },
  brick: { noise: true, from: 1200, to: 200, dur: 0.2, gain: 0.12 },
  powerupSpawn: { wave: 'triangle', from: 300, to: 900, dur: 0.3, gain: 0.06 },
  powerup: [
    { wave: 'square', from: 523, dur: 0.06, gain: 0.05 },
    { wave: 'square', from: 659, dur: 0.06, gain: 0.05, delay: 0.06 },
    { wave: 'square', from: 784, dur: 0.06, gain: 0.05, delay: 0.12 },
    { wave: 'square', from: 1046, dur: 0.12, gain: 0.05, delay: 0.18 },
  ],
  shrink: { wave: 'square', from: 700, to: 200, dur: 0.35, gain: 0.05 },
  oneUp: [
    { wave: 'triangle', from: 659, dur: 0.08, gain: 0.09 },
    { wave: 'triangle', from: 988, dur: 0.08, gain: 0.09, delay: 0.08 },
    { wave: 'triangle', from: 1319, dur: 0.16, gain: 0.09, delay: 0.16 },
  ],
  checkpoint: [
    { wave: 'triangle', from: 523, dur: 0.1, gain: 0.08 },
    { wave: 'triangle', from: 784, dur: 0.16, gain: 0.08, delay: 0.08 },
  ],
  death: { wave: 'sawtooth', from: 440, to: 80, dur: 0.6, gain: 0.07 },
  flag: [
    { wave: 'triangle', from: 392, dur: 0.12, gain: 0.12 },
    { wave: 'triangle', from: 523, dur: 0.12, gain: 0.12, delay: 0.12 },
    { wave: 'triangle', from: 659, dur: 0.12, gain: 0.12, delay: 0.24 },
    { wave: 'triangle', from: 784, dur: 0.36, gain: 0.12, delay: 0.36 },
  ],
};

const fmt = (n) => n.toLocaleString('es');

function LevelSelect({ record, onPick }) {
  const completed = record?.progress?.completed ?? {};
  const best = record?.best ?? {};
  return (
    <div className="rl-select game-scroll">
      <header>
        <p className="eyebrow">Reino de Ladrillos</p>
        <h2 className="rl-select__title">Cuatro tramos hasta el último observatorio</h2>
        <p className="rl-select__text">
          Un homenaje a los plataformas clásicos de desplazamiento lateral, con dibujos, personajes y niveles propios. Golpea
          bloques, recoge monedas, crece con el corazón y llega al mástil antes de que se acabe el tiempo. Las vidas, las
          monedas y los puntos pasan de un nivel al siguiente.
        </p>
        {Number.isFinite(best.score) && <p className="rl-select__best">Mejor partida: {fmt(best.score)} puntos</p>}
      </header>
      <ol className="rl-levels">
        {LEVELS.map((level, i) => {
          const unlocked = i === 0 || completed[LEVELS[i - 1].id];
          const time = best[`time:${level.id}`];
          return (
            <li key={level.id}>
              <button
                type="button"
                className={cx('rl-level', `is-${level.theme}`, completed[level.id] && 'is-done')}
                disabled={!unlocked}
                onClick={() => onPick(i)}
                aria-label={`Nivel 1-${i + 1}: ${level.name}. ${THEME_NAMES[level.theme]}.${completed[level.id] ? ` Superado${Number.isFinite(time) ? ` en ${time.toFixed(1)} segundos` : ''}.` : ''}${unlocked ? ' Empezar la partida aquí.' : ' Bloqueado: supera el anterior.'}`}
              >
                <span className="rl-level__n">1-{i + 1}</span>
                <span className="rl-level__body">
                  <strong>{level.name}</strong>
                  <small>{completed[level.id] ? `Superado${Number.isFinite(time) ? ` · ${time.toFixed(1)} s` : ''}` : THEME_NAMES[level.theme]}</small>
                </span>
                {!unlocked ? <Lock aria-hidden="true" /> : completed[level.id] ? <Check aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Play({ startIndex, frame, onMenu }) {
  const session = useGameSession(GAME_ID);
  const audio = useGameAudio();
  const reduced = useReducedMotion();
  const touchUI = useTouchUI();
  const portraitPhone = useMediaQuery('(orientation: portrait) and (max-width: 599px)');
  const lowLandscape = useMediaQuery('(orientation: landscape) and (max-height: 500px)');
  const [index, setIndex] = useState(startIndex);
  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState('countdown'); // countdown | run | cleared | over
  const [hud, setHud] = useState({ score: 0, coins: 0, lives: 3, time: LEVELS[startIndex].time ?? 200 });
  const [cleared, setCleared] = useState(null);
  const [result, setResult] = useState(null);
  const world = useRef(createWorld(LEVELS[startIndex]));
  const view = useRef(createRenderState());
  useEffect(() => () => disposeRenderState(view.current), []);
  const touch = useRef(NO_INPUT);
  const acc = useRef(0);
  const hudClock = useRef(0);
  const runStats = useRef({ stomps: 0, bricks: 0, levels: 0 });
  // Un nivel ganado o perdido se procesa una sola vez; el retardo final se cancela al salir.
  const handled = useRef(false);
  const finalTimer = useRef(null);
  useEffect(() => () => clearTimeout(finalTimer.current), []);
  const { start, finish, saveProgress, reset: resetSession } = session;
  const options = useRef({});
  options.current = { reduced, insetBottom: touchUI && !lowLandscape ? (portraitPhone ? 150 : 112) : 0 };
  const def = LEVELS[index];

  const draw = useCallback((dt = 0) => renderBricks(ctxRef.current, sizeRef.current, world.current, view.current, dt, options.current), []);
  const { canvasRef, ctxRef, sizeRef } = useCanvas(() => draw(0));

  useInProgress(session.isPlaying || session.isPaused || phase === 'cleared');
  usePauseOnInterrupt(session.pause);
  useEffect(() => {
    if (!session.isPlaying) touch.current = NO_INPUT;
  }, [session.isPlaying]);

  const syncHud = () => {
    const w = world.current;
    setHud({ score: w.score, coins: w.coinCount, lives: w.lives, time: w.timeLeft });
  };

  const endRun = useCallback(
    async (won) => {
      const w = world.current;
      setPhase('over');
      const summary = { won, score: w.score, coins: w.coinCount, levels: runStats.current.levels, saving: true };
      setResult(summary);
      const saved = await finish({
        completed: won,
        marks: [{ key: 'score', value: w.score, better: 'higher' }],
        progress: (p) => ({
          ...p,
          coins: (p.coins ?? 0) + w.coinCount,
          stomps: (p.stomps ?? 0) + runStats.current.stomps + w.stomps,
          worldWins: (p.worldWins ?? 0) + (won && startIndex === 0 ? 1 : 0),
        }),
      });
      setResult((r) => r && { ...r, saving: false, mark: saved.marks.score });
    },
    [finish, startIndex],
  );

  const levelCleared = useCallback(() => {
    const w = world.current;
    const time = Math.round((def.time - w.timeLeft) * 10) / 10;
    runStats.current = { stomps: runStats.current.stomps + w.stomps, bricks: runStats.current.bricks + w.bricks, levels: runStats.current.levels + 1 };
    saveProgress({
      marks: [{ key: `time:${def.id}`, value: time, better: 'lower' }],
      progress: (p) => ({ ...p, completed: { ...(p.completed ?? {}), [def.id]: true } }),
    });
    if (index + 1 >= LEVELS.length) {
      // Último nivel: deja ver la bandera un momento y termina la partida.
      finalTimer.current = setTimeout(() => endRun(true), reduced ? 300 : 1400);
      setPhase('over-pending');
    } else {
      setCleared({ time, coins: w.levelCoins, total: coinTotal(def) });
      setPhase('cleared');
    }
  }, [def, index, saveProgress, endRun, reduced]);

  const keys = useKeyboard({
    active: phase === 'run' || phase === 'countdown',
    onAction: (action) => {
      if (action === 'pause' && phase === 'run') session.togglePause();
    },
  });

  useGameLoop(
    (dt) => {
      const w = world.current;
      const running = phase === 'run' && session.statusRef.current === 'playing';
      if (running) {
        const pressed = keys.current;
        const t = touch.current;
        const input = {
          left: pressed.has('left') || t.left,
          right: pressed.has('right') || t.right,
          jump: pressed.has('up') || pressed.has('action') || t.jump,
        };
        acc.current += dt;
        while (acc.current >= DT && (w.status === 'playing' || w.status === 'dying')) {
          acc.current -= DT;
          const events = step(w, input);
          if (!events.length) continue;
          addEffects(view.current, events, reduced);
          for (const e of events) {
            if (SFX[e.type]) audio.play(SFX[e.type]);
            if (e.type === 'death' || e.type === 'shrink') navigator.vibrate?.(50);
          }
        }
        hudClock.current += dt;
        if (hudClock.current > 0.1 || w.status !== 'playing') {
          hudClock.current = 0;
          syncHud();
        }
        if (!handled.current && (w.status === 'won' || w.status === 'lost')) {
          handled.current = true;
          if (w.status === 'won') levelCleared();
          else endRun(false);
        }
      }
      draw(running || phase === 'over-pending' ? dt : 0);
    },
    phase === 'countdown' || (phase === 'run' && session.isPlaying) || phase === 'over-pending',
  );

  // Arranca la sesión una vez por partida (no por nivel).
  const started = useRef(false);
  const beginLevel = () => {
    audio.play(SFX.go);
    acc.current = 0;
    setPhase('run');
    if (!started.current) {
      started.current = true;
      start();
    }
  };

  const nextLevel = () => {
    const w = world.current;
    const carry = { lives: w.lives, coins: w.coinCount, score: w.score, big: w.player.big };
    world.current = createWorld(LEVELS[index + 1], carry);
    handled.current = false;
    view.current = createRenderState();
    setIndex((i) => i + 1);
    setCleared(null);
    setPhase('countdown');
    setRound((r) => r + 1);
    syncHud();
  };

  const restart = useCallback(() => {
    resetSession();
    clearTimeout(finalTimer.current);
    handled.current = false;
    started.current = false;
    runStats.current = { stomps: 0, bricks: 0, levels: 0 };
    world.current = createWorld(LEVELS[startIndex]);
    view.current = createRenderState();
    touch.current = NO_INPUT;
    setIndex(startIndex);
    setResult(null);
    setCleared(null);
    setPhase('countdown');
    setRound((r) => r + 1);
    setHud({ score: 0, coins: 0, lives: 3, time: LEVELS[startIndex].time ?? 200 });
    draw(0);
  }, [resetSession, startIndex, draw]);

  const won = result?.won;

  return (
    <div className={cx('game-stage', 'rl', touchUI && 'has-touch')}>
      <canvas ref={canvasRef} role="img" aria-label={`Nivel 1-${index + 1}: ${def.name}. ${hud.lives} vidas, ${hud.coins} monedas, ${Math.ceil(hud.time)} segundos.`} />
      <GameHUD
        onPause={phase === 'run' ? session.togglePause : undefined}
        paused={session.isPaused}
        items={[
          { id: 'level', label: 'Nivel', value: `1-${index + 1}` },
          { id: 'score', label: 'Puntos', value: fmt(hud.score) },
          { id: 'coins', label: 'Monedas', value: String(hud.coins) },
          { id: 'lives', label: 'Vidas', value: String(hud.lives) },
          { id: 'time', label: 'Tiempo', value: String(Math.ceil(hud.time)), tone: hud.time < 30 ? 'warn' : undefined },
        ]}
      />
      {touchUI && (phase === 'run' || phase === 'countdown') && <PlatformControls key={`platformcontrols-${round}`} inputRef={touch} />}
      {phase === 'run' && <ControlsHint key={`controlshint-${round}`} touch="‹ › moverse · botón redondo: saltar (mantén para más altura)" desktop="← → moverse · Espacio o ↑ saltar (mantén para más altura) · Esc pausa" />}
      {phase === 'countdown' && (
        <div className="rl-intro" aria-hidden="true">
          <span>Nivel 1-{index + 1}</span>
          <strong>{def.name}</strong>
          <small>{def.hint}</small>
        </div>
      )}
      {phase === 'countdown' && portraitPhone && (
        <p className="rotate-hint">
          <Smartphone aria-hidden="true" /> En horizontal verás más del nivel
        </p>
      )}
      {phase === 'countdown' && <Countdown key={`countdown-${round}`} paused={frame.interrupted} onTick={() => audio.play(SFX.tick)} onDone={beginLevel} />}
      {session.isPaused && phase === 'run' && <PauseMenu onResume={session.resume} onRestart={restart} onExit={frame.exit} />}
      {phase === 'cleared' && cleared && (
        <GameOverlay
          tone="win"
          eyebrow="¡Mástil alcanzado!"
          title={`Nivel 1-${index + 1} superado`}
          actions={
            <Button icon={ChevronRight} onClick={nextLevel} data-autofocus>
              Nivel 1-{index + 2}
            </Button>
          }
        >
          <p>
            {cleared.time.toFixed(1)} s · {cleared.coins} de {cleared.total} monedas · {fmt(hud.score)} puntos · {hud.lives} {hud.lives === 1 ? 'vida' : 'vidas'}
          </p>
        </GameOverlay>
      )}
      {result && (
        <GameResults
          outcome={won ? 'win' : 'lose'}
          eyebrow={won ? '¡Reino recorrido!' : 'Sin vidas'}
          title={`${fmt(result.score)} puntos`}
          message={won ? 'Has llegado al último observatorio. ¡Gracias por jugar!' : `Llegaste al nivel 1-${index + 1}. Los niveles superados quedan abiertos para empezar desde ellos.`}
          saving={result.saving}
          stats={[
            { label: 'Puntos', value: fmt(result.score), record: result.mark?.isRecord && result.mark.previous !== null, best: result.mark && !result.mark.isRecord ? fmt(result.mark.best) : null },
            { label: 'Monedas', value: String(result.coins) },
            { label: 'Niveles superados', value: String(result.levels) },
          ]}
          onReplay={restart}
          replayLabel={won ? 'Jugar de nuevo' : 'Reintentar'}
          extraActions={
            <Button variant="secondary" icon={ListOrdered} onClick={onMenu}>
              Niveles
            </Button>
          }
          onExit={frame.exit}
        />
      )}
    </div>
  );
}

/** Reino de Ladrillos: plataformas de desplazamiento lateral, 4 niveles. */
export default function ReinoDeLadrillos() {
  const frame = useGameFrame();
  const record = useGameRecord(GAME_ID);
  const [level, setLevel] = useState(null);
  if (level === null) return <LevelSelect record={record} onPick={setLevel} />;
  return <Play key={level} startIndex={level} frame={frame} onMenu={() => setLevel(null)} />;
}
