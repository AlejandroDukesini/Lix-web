import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Hand, ListOrdered, Lock, Play, Smartphone } from 'lucide-react';
import { Button } from '../../../../components/common/Button.jsx';
import { GameHUD, GameProgress } from '../../components/GameHUD.jsx';
import { PauseMenu } from '../../components/GameOverlay.jsx';
import { GameResults } from '../../components/GameResults.jsx';
import { Countdown } from '../../components/Countdown.jsx';
import { ControlsHint, DragIndicator, SteerButtons, useDragSteer } from '../../components/TouchControls.jsx';
import { useCanvas } from '../../hooks/useCanvas.js';
import { useGameLoop } from '../../hooks/useGameLoop.js';
import { useGameSession } from '../../hooks/useGameSession.js';
import { useGameRecord } from '../../hooks/useGameStatistics.js';
import { useGameAudio } from '../../hooks/useGameAudio.js';
import { useGameFrame, useInProgress, usePauseOnInterrupt } from '../../hooks/useGameFrame.js';
import { useKeyboard } from '../../hooks/useKeyboard.js';
import { useReducedMotion } from '../../../../hooks/useReducedMotion.js';
import { formatTime } from '../../services/gameLifecycle.js';
import { updateGameSettings } from '../../services/gameStorage.js';
import { cx } from '../../../../utils/cx.js';
import { CIRCUITS } from './engine/circuits.js';
import { createRace, positionOf, progressOf, raceTimeMs, stepRace } from './engine/aquaparkEngine.js';
import { createAquaView, renderAquapark } from './engine/aquaparkRenderer.js';
import './styles/aquapark.css';

const GAME_ID = 'aquapark';
const SFX = {
  tick: { wave: 'sine', from: 520, dur: 0.1, gain: 0.12 },
  go: { wave: 'sine', from: 1040, dur: 0.25, gain: 0.12 },
  boost: { wave: 'sawtooth', from: 300, to: 900, dur: 0.35, gain: 0.07 },
  jump: { wave: 'sine', from: 300, to: 700, dur: 0.25, gain: 0.1 },
  land: { noise: true, from: 900, to: 300, dur: 0.18, gain: 0.2 },
  hit: [
    { wave: 'square', from: 180, to: 90, dur: 0.15, gain: 0.12 },
    { noise: true, from: 1200, to: 400, dur: 0.12, gain: 0.15 },
  ],
  fall: { noise: true, from: 2400, to: 200, dur: 0.8, gain: 0.35 },
  finish: [
    { wave: 'triangle', from: 523, dur: 0.15, gain: 0.15 },
    { wave: 'triangle', from: 659, dur: 0.15, gain: 0.15, delay: 0.14 },
    { wave: 'triangle', from: 1046, dur: 0.4, gain: 0.15, delay: 0.28 },
  ],
};
const ORDINAL = ['1.º', '2.º', '3.º', '4.º'];

const unlocked = (index, circuits) => index === 0 || Boolean(circuits[CIRCUITS[index - 1].id]?.finished);

function CircuitSelect({ record, onPick }) {
  const circuits = record?.progress?.circuits ?? {};
  return (
    <div className="aq-menu">
      <header className="aq-menu__head">
        <p className="eyebrow">Aquapark</p>
        <h2 className="aq-menu__title">Elige tu tobogán</h2>
        <p className="aq-menu__text">Termina un circuito para desbloquear el siguiente. Compites contra tres bots del parque.</p>
      </header>
      <ol className="aq-circuits">
        {CIRCUITS.map((circuit, index) => {
          const open = unlocked(index, circuits);
          const best = record?.best?.[`time:${circuit.id}`];
          const info = circuits[circuit.id];
          return (
            <li key={circuit.id}>
              <button
                type="button"
                className={cx('aq-circuit', !open && 'is-locked')}
                style={{ '--sky-a': circuit.theme.sky[0], '--sky-b': circuit.theme.sky[1], '--slide-a': circuit.theme.slide[0], '--slide-b': circuit.theme.slide[1] }}
                disabled={!open}
                onClick={() => onPick(circuit)}
              >
                <span className="aq-circuit__scene" aria-hidden="true">
                  <span className="aq-circuit__slide" />
                </span>
                <span className="aq-circuit__body">
                  <span className="aq-circuit__difficulty">{circuit.difficulty}</span>
                  <span className="aq-circuit__name">{circuit.name}</span>
                  <span className="aq-circuit__text">{circuit.description}</span>
                  <span className="aq-circuit__meta">
                    {!open ? (
                      <>
                        <Lock aria-hidden="true" /> Termina «{CIRCUITS[index - 1].name}» para desbloquearlo
                      </>
                    ) : Number.isFinite(best) ? (
                      <>
                        <Check aria-hidden="true" /> Mejor tiempo {formatTime(best)}
                        {info?.bestPosition ? ` · mejor puesto ${ORDINAL[info.bestPosition - 1]}` : ''}
                      </>
                    ) : (
                      <>
                        <Play aria-hidden="true" /> Sin tiempo todavía
                      </>
                    )}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Race({ circuit, onCircuits, onNext, frame }) {
  const session = useGameSession(GAME_ID);
  const audio = useGameAudio();
  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState('countdown');
  const [hud, setHud] = useState({ time: 0, position: 4, progress: 0, speed: 0 });
  const [result, setResult] = useState(null);
  const [toast, setToast] = useState(null);
  const reduced = useReducedMotion();
  const race = useRef(createRace(circuit));
  const view = useRef(createAquaView());
  const touch = useRef({ left: false, right: false });
  const hudClock = useRef(0);
  const { start, reset: resetSession, finish } = session;

  const draw = useCallback((dt = 0) => renderAquapark(ctxRef.current, sizeRef.current, race.current, view.current, dt), []);
  const { canvasRef, ctxRef, sizeRef } = useCanvas(() => draw(0));

  useInProgress(session.isPlaying || session.isPaused);
  usePauseOnInterrupt(session.pause);
  const keys = useKeyboard({
    active: phase !== 'over',
    onAction: (action) => {
      if (action === 'pause' && phase === 'run') session.togglePause();
    },
  });

  const drag = useDragSteer({ enabled: phase === 'run' && session.isPlaying });

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 1400);
    return () => clearTimeout(timer);
  }, [toast]);

  const end = useCallback(async () => {
    const r = race.current;
    const timeMs = raceTimeMs(r);
    const position = positionOf(r);
    setPhase('over');
    setResult({ timeMs, position, stats: { ...r.stats }, saving: true });
    const saved = await finish({
      completed: true,
      marks: [{ key: `time:${circuit.id}`, value: timeMs, better: 'lower' }],
      progress: (p) => {
        const circuits = { ...(p.circuits ?? {}) };
        const previous = circuits[circuit.id] ?? {};
        circuits[circuit.id] = {
          finished: true,
          bestPosition: Math.min(previous.bestPosition ?? 4, position),
          podiums: (previous.podiums ?? 0) + (position === 1 ? 1 : 0),
        };
        return { ...p, circuits };
      },
    });
    setResult((current) => current && { ...current, saving: false, mark: saved.marks[`time:${circuit.id}`] });
  }, [circuit.id, finish]);

  useGameLoop(
    (dt) => {
      const running = phase === 'run' && session.statusRef.current === 'playing';
      if (running) {
        const pressed = keys.current;
        const left = pressed.has('left') || touch.current.left;
        const right = pressed.has('right') || touch.current.right;
        // Teclado y botones mandan; si no se usan, el arrastre táctil da una dirección analógica.
        const input = left || right ? { left, right } : { steer: drag.steerRef.current };
        view.current.reduced = reduced;
        for (const event of stepRace(race.current, input, dt)) {
          if (event.type === 'finish') {
            audio.play(SFX.finish);
            end();
          } else if (event.type === 'checkpoint') {
            setToast({ key: event.section, text: `Tramo ${event.section} de ${event.total} superado` });
          } else {
            if (event.type === 'hit') view.current.bump = 1;
            if (SFX[event.type]) audio.play(SFX[event.type]);
          }
        }
        hudClock.current += dt;
        if (hudClock.current > 0.1) {
          hudClock.current = 0;
          const r = race.current;
          setHud({ time: raceTimeMs(r), position: positionOf(r), progress: progressOf(r), speed: Math.round(r.player.speed * 3.6) });
        }
      }
      draw(running ? dt : dt * 0.3);
    },
    phase === 'countdown' || (phase === 'run' && session.isPlaying),
  );

  const restart = useCallback(() => {
    resetSession();
    race.current = createRace(circuit);
    view.current = createAquaView();
    touch.current = { left: false, right: false };
    setHud({ time: 0, position: 4, progress: 0, speed: 0 });
    setResult(null);
    setPhase('countdown');
    setRound((r) => r + 1);
    draw(0);
  }, [circuit, resetSession, draw]);

  const position = result?.position;
  return (
    <div className="game-stage aquapark" {...drag.handlers}>
      <canvas ref={canvasRef} role="img" aria-label={`Tobogán ${circuit.name}, visto desde detrás del flotador`} />
      <DragIndicator indicator={drag.indicator} />
      {toast && (
        <p key={toast.key} className="aq-toast" role="status">
          {toast.text}
        </p>
      )}
      <GameHUD
        onPause={phase === 'run' ? session.togglePause : undefined}
        paused={session.isPaused}
        items={[
          { id: 'time', label: 'Tiempo', value: formatTime(hud.time) },
          { id: 'position', label: 'Puesto', value: `${ORDINAL[hud.position - 1]} de 4`, tone: hud.position === 1 ? 'good' : undefined },
          { id: 'speed', label: 'Velocidad', value: `${hud.speed} km/h` },
        ]}
      />
      <GameProgress value={hud.progress} label="Recorrido del circuito" />
      {phase === 'run' && <SteerButtons inputRef={touch} />}
      {phase === 'countdown' && (
        <p className="rotate-hint">
          <Smartphone aria-hidden="true" /> En horizontal verás más tobogán
        </p>
      )}
      {phase === 'run' && (
        <ControlsHint
          key={round}
          icon={Hand}
          touch="Desliza ← → para moverte"
          desktop="← → o A D para moverte · Esc para pausar"
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
      {session.isPaused && phase === 'run' && <PauseMenu onResume={session.resume} onRestart={restart} onExit={frame.exit} />}
      {result && (
        <GameResults
          outcome={position === 1 ? 'win' : 'end'}
          eyebrow={position === 1 ? '¡Primer puesto!' : `Llegaste en ${ORDINAL[position - 1]} lugar`}
          title={`${circuit.name}: ${formatTime(result.timeMs)}`}
          message={
            result.stats.falls || result.stats.hits
              ? `${result.stats.falls ? `${result.stats.falls} ${result.stats.falls === 1 ? 'caída' : 'caídas'} al agua` : ''}${result.stats.falls && result.stats.hits ? ' · ' : ''}${result.stats.hits ? `${result.stats.hits} ${result.stats.hits === 1 ? 'choque' : 'choques'} con flotadores` : ''}`
              : 'Recorrido limpio: sin caídas ni choques.'
          }
          saving={result.saving}
          stats={[
            {
              label: 'Tiempo',
              value: formatTime(result.timeMs),
              record: result.mark?.isRecord,
              best: result.mark && !result.mark.isRecord ? formatTime(result.mark.best) : null,
            },
            { label: 'Puesto', value: `${ORDINAL[position - 1]} de 4` },
            { label: 'Impulsos', value: String(result.stats.boosts) },
          ]}
          onReplay={onNext ?? restart}
          replayLabel={onNext ? 'Siguiente circuito' : 'Repetir circuito'}
          extraActions={
            <>
              {onNext && (
                <Button variant="secondary" onClick={restart}>
                  Repetir circuito
                </Button>
              )}
              <Button variant="secondary" icon={ListOrdered} onClick={onCircuits}>
                Circuitos
              </Button>
            </>
          }
          onExit={frame.exit}
        />
      )}
    </div>
  );
}

/** Aquapark: selección de circuito y carrera. */
export default function Aquapark() {
  const frame = useGameFrame();
  const record = useGameRecord(GAME_ID);
  const [circuit, setCircuit] = useState(null);
  const circuits = record?.progress?.circuits ?? {};

  if (!circuit) {
    return (
      <CircuitSelect
        record={record}
        onPick={(picked) => {
          updateGameSettings(GAME_ID, { circuit: picked.id }).catch(() => {});
          setCircuit(picked);
        }}
      />
    );
  }
  const index = CIRCUITS.indexOf(circuit);
  const next = CIRCUITS[index + 1];
  // "Siguiente" solo si ya está desbloqueado o este circuito acaba de terminarse (se desbloquea al guardar).
  const nextAvailable = next && (circuits[circuit.id]?.finished || unlocked(index + 1, circuits));
  return (
    <Race
      key={circuit.id}
      circuit={circuit}
      frame={frame}
      onCircuits={() => setCircuit(null)}
      onNext={nextAvailable ? () => setCircuit(next) : null}
    />
  );
}
