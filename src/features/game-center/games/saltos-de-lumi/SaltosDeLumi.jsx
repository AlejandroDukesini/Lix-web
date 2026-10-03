import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ChevronRight, ListOrdered, Lock, Smartphone } from 'lucide-react';
import { Button } from '../../../../components/common/Button.jsx';
import { GameHUD } from '../../components/GameHUD.jsx';
import { PauseMenu } from '../../components/GameOverlay.jsx';
import { GameResults } from '../../components/GameResults.jsx';
import { Countdown } from '../../components/Countdown.jsx';
import { ControlsHint, PlatformControls } from '../../components/TouchControls.jsx';
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
import { DT, createWorld, step } from './engine/lumiEngine.js';
import { addEffects, createRenderState, renderLumi } from './engine/lumiRenderer.js';
import { LEVELS } from './levels/levels.js';
import './styles/lumi.css';

const GAME_ID = 'saltos-de-lumi';
const NO_INPUT = Object.freeze({ left: false, right: false, jump: false });
const THEME_NAMES = { pradera: 'Pradera al atardecer', bosque: 'Bosque', cueva: 'Cueva', nubes: 'Entre las nubes', noche: 'Noche' };
const SFX = {
  tick: { wave: 'square', from: 440, dur: 0.08, gain: 0.07 },
  go: { wave: 'square', from: 880, dur: 0.18, gain: 0.08 },
  jump: { wave: 'square', from: 300, to: 560, dur: 0.1, gain: 0.04 },
  coin: [
    { wave: 'triangle', from: 990, dur: 0.06, gain: 0.07 },
    { wave: 'triangle', from: 1320, dur: 0.1, gain: 0.07, delay: 0.05 },
  ],
  stomp: { wave: 'sine', from: 260, to: 120, dur: 0.14, gain: 0.12 },
  spring: { wave: 'sine', from: 200, to: 900, dur: 0.25, gain: 0.08 },
  checkpoint: [
    { wave: 'triangle', from: 523, dur: 0.1, gain: 0.08 },
    { wave: 'triangle', from: 784, dur: 0.16, gain: 0.08, delay: 0.08 },
  ],
  death: { wave: 'sawtooth', from: 400, to: 90, dur: 0.45, gain: 0.08 },
  win: [
    { wave: 'triangle', from: 523, dur: 0.12, gain: 0.12 },
    { wave: 'triangle', from: 659, dur: 0.12, gain: 0.12, delay: 0.1 },
    { wave: 'triangle', from: 784, dur: 0.3, gain: 0.12, delay: 0.2 },
  ],
};

const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
const totalCoins = (def) => def.rows.join('').split('o').length - 1;

function LevelSelect({ record, onPick }) {
  const completed = record?.progress?.completed ?? {};
  const coins = record?.progress?.coins ?? {};
  const best = record?.best ?? {};
  return (
    <div className="lumi-select game-scroll">
      <header>
        <p className="eyebrow">Saltos de Lumi</p>
        <h2 className="lumi-select__title">Una chispa en busca de su vela</h2>
        <p className="lumi-select__text">Lumi es una chispita de luz. Recoge chispas, enciende los faroles y llega hasta la vela de cada nivel.</p>
      </header>
      <ol className="lumi-levels">
        {LEVELS.map((level, i) => {
          const unlocked = i === 0 || completed[LEVELS[i - 1].id];
          const time = best[`time:${level.id}`];
          const total = totalCoins(level);
          return (
            <li key={level.id}>
              <button
                type="button"
                className={cx('lumi-level', `is-${level.theme}`, completed[level.id] && 'is-done', !unlocked && 'is-locked')}
                disabled={!unlocked}
                onClick={() => onPick(i)}
                aria-label={`Nivel ${i + 1}: ${level.name}. ${THEME_NAMES[level.theme]}.${completed[level.id] ? ` Superado${Number.isFinite(time) ? ` en ${formatTime(time)}` : ''}, ${coins[level.id] ?? 0} de ${total} chispas.` : ''}${unlocked ? '' : ' Bloqueado: supera el anterior.'}`}
              >
                <span className="lumi-level__n">{i + 1}</span>
                <span className="lumi-level__body">
                  <strong>{level.name}</strong>
                  <small>{completed[level.id] ? `${Number.isFinite(time) ? formatTime(time) : '—'} · ${coins[level.id] ?? 0}/${total} chispas` : THEME_NAMES[level.theme]}</small>
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

function Play({ index, frame, onMenu, onNext }) {
  const def = LEVELS[index];
  const session = useGameSession(GAME_ID);
  const audio = useGameAudio();
  const reduced = useReducedMotion();
  const touchUI = useMediaQuery('(hover: none), (pointer: coarse)');
  const portraitPhone = useMediaQuery('(orientation: portrait) and (max-width: 599px)');
  const lowLandscape = useMediaQuery('(orientation: landscape) and (max-height: 500px)');
  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState('countdown');
  const [hud, setHud] = useState({ coins: 0, lives: 3, time: 0 });
  const [result, setResult] = useState(null);
  const world = useRef(createWorld(def));
  const view = useRef(createRenderState());
  const touch = useRef(NO_INPUT);
  const acc = useRef(0);
  const hudClock = useRef(0);
  const { start, reset: resetSession, finish } = session;
  const total = world.current.coins.length;
  const options = useRef({ reduced, insetBottom: 0 });
  // Con controles táctiles el nivel se apoya encima de ellos; en un teléfono en
  // horizontal no hay alto de sobra y los controles quedan en las esquinas.
  options.current = { reduced, insetBottom: !touchUI || lowLandscape ? 0 : portraitPhone ? 150 : 112, insetX: touchUI && lowLandscape ? 110 : 0 };

  const draw = useCallback((dt = 0) => renderLumi(ctxRef.current, sizeRef.current, world.current, view.current, dt, options.current), []);
  const { canvasRef, ctxRef, sizeRef } = useCanvas(() => draw(0));

  useInProgress(session.isPlaying || session.isPaused);
  usePauseOnInterrupt(session.pause);
  useEffect(() => {
    if (!session.isPlaying) touch.current = NO_INPUT;
  }, [session.isPlaying]);

  const end = useCallback(
    async (outcome) => {
      const w = world.current;
      const time = Math.round(w.t * 100) / 100;
      setPhase('over');
      setResult({ outcome, time, coins: w.coinCount, deaths: w.deaths, saving: true });
      const won = outcome === 'win';
      const saved = await finish({
        completed: won,
        marks: won
          ? [
              { key: `time:${def.id}`, value: time, better: 'lower' },
              { key: `coins:${def.id}`, value: w.coinCount, better: 'higher' },
            ]
          : [],
        progress: (p) => ({
          ...p,
          completed: won ? { ...(p.completed ?? {}), [def.id]: true } : (p.completed ?? {}),
          coins: won ? { ...(p.coins ?? {}), [def.id]: Math.max(p.coins?.[def.id] ?? 0, w.coinCount) } : (p.coins ?? {}),
          stomps: (p.stomps ?? 0) + w.stomps,
        }),
      });
      setResult((r) => r && { ...r, saving: false, timeMark: saved.marks[`time:${def.id}`] });
    },
    [finish, def.id],
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
          left: pressed.has('left') || t.left,
          right: pressed.has('right') || t.right,
          jump: pressed.has('up') || pressed.has('action') || t.jump,
        };
        const w = world.current;
        // Paso fijo: el mismo resultado a 30, 60 o 120 Hz.
        acc.current += dt;
        while (acc.current >= DT && w.status === 'playing') {
          acc.current -= DT;
          const events = step(w, input);
          if (!events.length) continue;
          addEffects(view.current, events, w, reduced);
          for (const e of events) {
            if (SFX[e.type]) audio.play(SFX[e.type]);
            if (e.type === 'death') navigator.vibrate?.(60);
          }
        }
        if (w.status === 'won') end('win');
        else if (w.status === 'lost') end('lost');
        hudClock.current += dt;
        if (hudClock.current > 0.1 || w.status !== 'playing') {
          hudClock.current = 0;
          setHud({ coins: w.coinCount, lives: w.lives, time: w.t });
        }
      }
      draw(running || phase === 'over' ? dt : 0);
    },
    phase === 'countdown' || (phase === 'run' && session.isPlaying),
  );

  const restart = useCallback(() => {
    resetSession();
    world.current = createWorld(def);
    view.current = createRenderState();
    touch.current = NO_INPUT;
    acc.current = 0;
    setHud({ coins: 0, lives: 3, time: 0 });
    setResult(null);
    setPhase('countdown');
    setRound((r) => r + 1);
    draw(0);
  }, [resetSession, def, draw]);

  useEffect(() => {
    const onKey = (event) => {
      if ((event.key === 'r' || event.key === 'R') && !event.ctrlKey && !event.metaKey) restart();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [restart]);

  const next = index + 1 < LEVELS.length ? index + 1 : null;
  const won = result?.outcome === 'win';

  return (
    <div className={cx('game-stage', 'lumi', touchUI && 'has-touch')}>
      <canvas ref={canvasRef} role="img" aria-label={`Nivel ${index + 1}: ${def.name}. Lumi avanza hacia la vela.`} />
      <GameHUD
        onPause={phase === 'run' ? session.togglePause : undefined}
        paused={session.isPaused}
        items={[
          { id: 'level', label: 'Nivel', value: `${index + 1}/${LEVELS.length}` },
          { id: 'coins', label: 'Chispas', value: `${hud.coins}/${total}` },
          { id: 'lives', label: 'Vidas', value: String(hud.lives) },
          { id: 'time', label: 'Tiempo', value: formatTime(hud.time) },
        ]}
      />
      {touchUI && phase !== 'over' && <PlatformControls key={round} inputRef={touch} />}
      {phase === 'run' && (
        <ControlsHint key={round} touch="‹ › moverse (desliza el pulgar) · botón redondo: saltar" desktop="← → moverse · Espacio o ↑ saltar (mantén para más altura) · Esc pausa" />
      )}
      {phase === 'countdown' && (
        <div className="lumi-intro" aria-hidden="true">
          <strong>{def.name}</strong>
          <span>{def.hint}</span>
        </div>
      )}
      {phase === 'countdown' && portraitPhone && (
        <p className="rotate-hint">
          <Smartphone aria-hidden="true" /> En horizontal verás más del nivel
        </p>
      )}
      {phase === 'countdown' && (
        <Countdown
          key={round}
          paused={frame.interrupted}
          onTick={() => audio.play(SFX.tick)}
          onDone={() => {
            audio.play(SFX.go);
            acc.current = 0;
            setPhase('run');
            start();
          }}
        />
      )}
      {session.isPaused && phase === 'run' && <PauseMenu onResume={session.resume} onRestart={restart} onExit={frame.exit} />}
      {result && (
        <GameResults
          outcome={won ? 'win' : 'lose'}
          eyebrow={won ? '¡Vela encendida!' : 'Sin vidas'}
          title={won ? `Nivel ${index + 1} superado` : 'Lumi necesita otro intento'}
          message={won ? (next === null ? 'Has encendido todas las velas. ¡Gracias por jugar!' : `${def.name}: ${result.coins} de ${total} chispas.`) : 'Vuelve a intentarlo: los faroles guardan tu avance dentro del nivel.'}
          saving={result.saving}
          stats={
            won
              ? [
                  {
                    label: 'Tiempo',
                    value: formatTime(result.time),
                    record: result.timeMark?.isRecord && result.timeMark.previous !== null,
                    best: result.timeMark && !result.timeMark.isRecord ? formatTime(result.timeMark.best) : null,
                  },
                  { label: 'Chispas', value: `${result.coins}/${total}` },
                  { label: 'Vidas perdidas', value: String(result.deaths) },
                ]
              : [{ label: 'Chispas', value: `${result.coins}/${total}` }]
          }
          onReplay={restart}
          replayLabel={won ? 'Repetir' : 'Reintentar'}
          extraActions={
            <>
              {won && next !== null && (
                <Button icon={ChevronRight} onClick={() => onNext(next)}>
                  Siguiente nivel
                </Button>
              )}
              <Button variant="secondary" icon={ListOrdered} onClick={onMenu}>
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

/** Saltos de Lumi: plataformas originales, 8 niveles. */
export default function SaltosDeLumi() {
  const frame = useGameFrame();
  const record = useGameRecord(GAME_ID);
  const [level, setLevel] = useState(null);
  if (level === null) return <LevelSelect record={record} onPick={setLevel} />;
  return <Play key={level} index={level} frame={frame} onMenu={() => setLevel(null)} onNext={setLevel} />;
}
