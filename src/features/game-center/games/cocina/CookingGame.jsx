import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChefHat, ChevronRight, CircleAlert, CircleCheck, CircleMinus, CirclePlus, Flame, ListOrdered, Lock, RotateCcw, Send, Undo2, X } from 'lucide-react';
import { Button } from '../../../../components/common/Button.jsx';
import { GameHUD } from '../../components/GameHUD.jsx';
import { GameOverlay, PauseMenu } from '../../components/GameOverlay.jsx';
import { GameResults } from '../../components/GameResults.jsx';
import { useGameSession } from '../../hooks/useGameSession.js';
import { useGameRecord } from '../../hooks/useGameStatistics.js';
import { useGameAudio } from '../../hooks/useGameAudio.js';
import { useGameFrame, useInProgress, usePauseOnInterrupt } from '../../hooks/useGameFrame.js';
import { useGameLoop } from '../../hooks/useGameLoop.js';
import { useKeyboard } from '../../hooks/useKeyboard.js';
import { cx } from '../../../../utils/cx.js';
import {
  BAKE_ZONES,
  LEVEL_IDS,
  PLACEMENTS,
  SHIFT,
  activeSteps,
  createShift,
  deliver,
  describeOrder,
  emptyBuild,
  isLevelUnlocked,
  isShiftOver,
  placeItem,
  popItem,
  pushItem,
  setSingle,
  summarize,
  toggleItem,
  zoneLabel,
  zoneOf,
} from './engine/orders.js';
import './styles/cocina.css';

const SFX = {
  pick: { wave: 'triangle', from: 520, dur: 0.05, gain: 0.06 },
  add: { wave: 'sine', from: 380, to: 620, dur: 0.08, gain: 0.07 },
  remove: { wave: 'sine', from: 500, to: 300, dur: 0.08, gain: 0.05 },
  oven: { noise: true, from: 500, to: 300, dur: 0.25, gain: 0.05 },
  ding: [
    { wave: 'sine', from: 1320, dur: 0.25, gain: 0.08 },
    { wave: 'sine', from: 1760, dur: 0.35, gain: 0.05, delay: 0.05 },
  ],
  perfect: [
    { wave: 'triangle', from: 659, dur: 0.1, gain: 0.1 },
    { wave: 'triangle', from: 880, dur: 0.1, gain: 0.1, delay: 0.08 },
    { wave: 'triangle', from: 1175, dur: 0.22, gain: 0.1, delay: 0.16 },
  ],
  good: { wave: 'triangle', from: 600, to: 760, dur: 0.18, gain: 0.08 },
  bad: { wave: 'square', from: 220, to: 150, dur: 0.25, gain: 0.05 },
  win: [
    { wave: 'triangle', from: 523, dur: 0.12, gain: 0.12 },
    { wave: 'triangle', from: 659, dur: 0.12, gain: 0.12, delay: 0.1 },
    { wave: 'triangle', from: 784, dur: 0.3, gain: 0.12, delay: 0.2 },
  ],
  lose: { wave: 'sine', from: 330, to: 160, dur: 0.5, gain: 0.1 },
};

const BAKE_SPEED = { 1: 1 / 8, 2: 1 / 6.5, 3: 1 / 5 }; // fracción del indicador por segundo
const pct = (x) => `${Math.round(x * 100)} %`;
const STATUS = {
  ok: { icon: CircleCheck, label: 'Correcto' },
  partial: { icon: CircleAlert, label: 'Casi' },
  wrong: { icon: X, label: 'Incorrecto' },
  missing: { icon: CircleMinus, label: 'Falta' },
  extra: { icon: CirclePlus, label: 'Sobra' },
};
const starsText = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);

function LevelSelect({ texts, record, onPick }) {
  const progress = record?.progress ?? {};
  const best = record?.best ?? {};
  return (
    <div className="ck-select game-scroll">
      <header>
        <p className="eyebrow">{texts.title}</p>
        <h2 className="ck-select__title">{texts.heading}</h2>
        <p className="ck-select__text">{texts.intro}</p>
      </header>
      <ol className="ck-levels">
        {LEVEL_IDS.map((level) => {
          const config = SHIFT[level];
          const unlocked = isLevelUnlocked(level, progress);
          const stars = progress.stars?.[level] ?? 0;
          const score = best[`score:${level}`];
          return (
            <li key={level}>
              <button
                type="button"
                className={cx('ck-level', stars > 0 && 'is-done')}
                disabled={!unlocked}
                onClick={() => onPick(level)}
                aria-label={`Nivel ${level}, ${config.label}: ${config.orders} pedidos, ${config.timeLimit ? `${config.timeLimit} segundos por pedido` : 'sin reloj'}.${stars ? ` ${stars} de 3 estrellas.` : ''}${unlocked ? '' : ' Bloqueado: supera el nivel anterior.'}`}
              >
                <span className="ck-level__badge">
                  <ChefHat aria-hidden="true" />
                  {level}
                </span>
                <span className="ck-level__body">
                  <strong>{config.label}</strong>
                  <small>
                    {config.orders} pedidos · {config.timeLimit ? `${config.timeLimit} s por pedido` : 'sin reloj'} · {texts.levels[level]}
                  </small>
                  <small className="ck-level__stars">
                    {stars ? starsText(stars) : unlocked ? 'Precisión mínima ' + pct(config.passAt) : 'Supera el nivel anterior'}
                    {Number.isFinite(score) ? ` · Récord ${score} pts` : ''}
                  </small>
                </span>
                {unlocked ? <ChevronRight aria-hidden="true" /> : <Lock aria-hidden="true" />}
              </button>
            </li>
          );
        })}
      </ol>
      {(progress.orders ?? 0) > 0 && (
        <p className="ck-select__totals">
          {progress.orders} pedidos entregados · {progress.perfect ?? 0} perfectos
        </p>
      )}
    </div>
  );
}

/** Comanda: el pedido escrito (y dibujado en pequeño). */
function Ticket({ recipe, level, order, Visual, index, total }) {
  const lines = describeOrder(recipe, level, order.spec);
  return (
    <section className="ck-ticket" aria-labelledby="ck-ticket-title">
      <header className="ck-ticket__head">
        <span className="ck-ticket__number">
          Pedido {index + 1}/{total}
        </span>
        <h3 id="ck-ticket-title">Para {order.customer}</h3>
      </header>
      <Visual spec={order.spec} className="ck-ticket__visual" />
      <dl className="ck-ticket__lines">
        {lines.map((line) => (
          <div key={line.step}>
            <dt>{line.step}</dt>
            <dd>
              {line.list ? (
                <ol>
                  {line.list.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ol>
              ) : (
                line.text
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Oven({ value, baking, level, onStart, onStop, disabled }) {
  const zone = zoneOf(value);
  return (
    <div className="ck-oven">
      <div className="ck-oven__gauge" role="meter" aria-label="Punto de cocción" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((value ?? 0) * 100)} aria-valuetext={value === null ? 'Sin hornear' : zoneLabel(zone)}>
        {BAKE_ZONES.map((z) => (
          <span key={z.id} className={cx('ck-oven__zone', `is-${z.id}`)} style={{ flexGrow: Math.min(1, z.to) - z.from }}>
            {z.label}
          </span>
        ))}
        {value !== null && <span className="ck-oven__needle" style={{ left: `${Math.min(100, value * 100)}%` }} />}
      </div>
      <p className="ck-oven__state" aria-live="polite">
        {value === null ? 'Aún sin hornear.' : baking ? `En el horno: ${zoneLabel(zone).toLowerCase()}…` : `Horneada: ${zoneLabel(zone).toLowerCase()}.`}
      </p>
      {baking ? (
        <Button icon={Flame} onClick={onStop}>
          Sacar del horno
        </Button>
      ) : (
        <Button icon={Flame} variant="secondary" onClick={onStart} disabled={disabled || value !== null}>
          {value === null ? 'Meter al horno' : 'Ya está horneada'}
        </Button>
      )}
      {level === 1 && value === null && <p className="ck-oven__tip">Sácala cuando la aguja esté en la zona pedida.</p>}
    </div>
  );
}

function Station({ recipe, level, build, setBuild, stepIndex, setStepIndex, placement, setPlacement, bake, audio }) {
  const steps = activeSteps(recipe, level);
  const step = steps[stepIndex];
  const options = step.options?.filter((o) => (o.from ?? 1) <= level) ?? [];
  const value = build[step.id];
  const filled = (s) => (s.kind === 'single' || s.kind === 'bake' ? build[s.id] !== null && build[s.id] !== undefined : build[s.id].length > 0);

  const choose = (id) => {
    if (step.kind === 'single') {
      setBuild(setSingle(build, step.id, id));
      audio.play(SFX.pick);
    } else if (step.kind === 'sequence') {
      const next = pushItem(build, step, id, level);
      if (next !== build) audio.play(SFX.add);
      setBuild(next);
    } else if (step.kind === 'set') {
      audio.play(value.includes(id) ? SFX.remove : SFX.add);
      setBuild(toggleItem(build, step.id, id));
    } else if (step.kind === 'placement') {
      const has = value.find((p) => p.id === id);
      audio.play(has?.place === placement ? SFX.remove : SFX.add);
      setBuild(placeItem(build, step.id, id, placement));
    }
  };

  return (
    <section className="ck-station" aria-label="Preparación">
      <div className="ck-steps" role="tablist" aria-label="Pasos">
        {steps.map((s, i) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={i === stepIndex}
            className={cx('ck-step', i === stepIndex && 'is-current', filled(s) && 'is-filled')}
            onClick={() => setStepIndex(i)}
          >
            {filled(s) && <Check aria-hidden="true" />}
            {s.label}
          </button>
        ))}
      </div>
      <div className="ck-panel" role="tabpanel" aria-label={step.label}>
        {step.hint && <p className="ck-panel__hint">{step.hint}</p>}
        {step.kind === 'placement' && level >= (step.halvesFrom ?? 99) && (
          <div className="ck-placement" role="radiogroup" aria-label="Dónde poner el ingrediente">
            {PLACEMENTS.map((p) => (
              <button key={p.id} type="button" role="radio" aria-checked={placement === p.id} className={cx('ck-chip', placement === p.id && 'is-on')} onClick={() => setPlacement(p.id)}>
                {p.label}
              </button>
            ))}
          </div>
        )}
        {step.kind === 'bake' ? (
          <Oven value={build[step.id]} baking={bake.baking} level={level} onStart={bake.start} onStop={bake.stop} disabled={!build.tamano} />
        ) : (
          <div className="ck-options">
            {options.map((o, i) => {
              let pressed = false;
              let badge = null;
              if (step.kind === 'single') pressed = value === o.id;
              else if (step.kind === 'set') pressed = value.includes(o.id);
              else if (step.kind === 'placement') {
                const p = value.find((x) => x.id === o.id);
                pressed = Boolean(p);
                badge = p && p.place !== 'toda' ? (p.place === 'izq' ? 'Izq.' : 'Der.') : null;
              } else if (step.kind === 'sequence') {
                const n = value.filter((v) => v === o.id).length;
                badge = n ? `×${n}` : null;
              }
              return (
                <button
                  key={o.id}
                  type="button"
                  className={cx('ck-option', pressed && 'is-on')}
                  aria-pressed={step.kind === 'sequence' ? undefined : pressed}
                  onClick={() => choose(o.id)}
                  style={{ '--swatch': o.color && o.color !== 'transparent' ? o.color : 'transparent' }}
                >
                  <span className="ck-option__swatch" aria-hidden="true" />
                  <span className="ck-option__label">{o.label}</span>
                  {badge && <span className="ck-option__badge">{badge}</span>}
                  <kbd className="ck-option__key" aria-hidden="true">
                    {i + 1}
                  </kbd>
                </button>
              );
            })}
          </div>
        )}
        {step.kind === 'sequence' && (
          <div className="ck-sequence">
            <p>
              {value.length ? (
                <>
                  {step.itemLabel}s: {value.map((id) => options.find((o) => o.id === id)?.label ?? id).join(' → ')}
                </>
              ) : (
                `Aún sin ${step.label.toLowerCase()}.`
              )}
            </p>
            <Button
              variant="ghost"
              size="sm"
              icon={Undo2}
              disabled={!value.length}
              onClick={() => {
                audio.play(SFX.remove);
                setBuild(popItem(build, step.id));
              }}
            >
              Quitar la última
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

function Shift({ gameId, recipe, Visual, texts, level, frame, onMenu }) {
  const session = useGameSession(gameId);
  const audio = useGameAudio();
  const [shift, setShift] = useState(() => createShift(recipe, level, Date.now() >>> 0));
  const [build, setBuild] = useState(() => emptyBuild(recipe, level));
  const [stepIndex, setStepIndex] = useState(0);
  const [placement, setPlacement] = useState('toda');
  const [phase, setPhase] = useState('order'); // order | feedback | done
  const [baking, setBaking] = useState(false);
  const [timeLeft, setTimeLeft] = useState(SHIFT[level].timeLimit);
  const [result, setResult] = useState(null);
  const buildRef = useRef(build);
  buildRef.current = build;
  const { start, finish, reset } = session;
  const steps = useMemo(() => activeSteps(recipe, level), [recipe, level]);
  const bakeStep = steps.find((s) => s.kind === 'bake');
  const config = SHIFT[level];

  useEffect(() => {
    start();
  }, [start, shift.orders]);
  useInProgress(session.isPlaying || session.isPaused);
  usePauseOnInterrupt(session.pause);

  const order = shift.orders[Math.min(shift.index, shift.orders.length - 1)];

  const submit = useCallback(
    (timedOut = false) => {
      if (phase !== 'order') return;
      setBaking(false);
      const next = deliver(shift, recipe, buildRef.current, { timeLeftFraction: config.timeLimit ? Math.max(0, timeLeft) / config.timeLimit : null });
      next.last.timedOut = timedOut;
      audio.play(next.last.perfect ? SFX.perfect : next.last.precision >= 0.6 ? SFX.good : SFX.bad);
      setShift(next);
      setPhase('feedback');
    },
    [phase, shift, recipe, config.timeLimit, timeLeft, audio],
  );

  const nextOrder = useCallback(async () => {
    if (!isShiftOver(shift)) {
      setBuild(emptyBuild(recipe, level));
      setStepIndex(0);
      setPlacement('toda');
      setTimeLeft(config.timeLimit);
      setPhase('order');
      return;
    }
    const summary = summarize(shift);
    setPhase('done');
    audio.play(summary.won ? SFX.win : SFX.lose);
    setResult({ ...summary, saving: true });
    const saved = await finish({
      completed: summary.won,
      marks: [
        { key: `score:${level}`, value: summary.points, better: 'higher' },
        { key: `precision:${level}`, value: Math.round(summary.precision * 1000) / 10, better: 'higher' },
      ],
      progress: (p) => ({
        ...p,
        orders: (p.orders ?? 0) + summary.orders,
        perfect: (p.perfect ?? 0) + summary.perfect,
        stars: { ...(p.stars ?? {}), [level]: Math.max(p.stars?.[level] ?? 0, summary.stars) },
      }),
    });
    setResult((r) => r && { ...r, saving: false, marks: saved.marks });
  }, [shift, recipe, level, config.timeLimit, audio, finish]);

  const playing = session.isPlaying;
  useGameLoop(
    (dt) => {
      if (baking && bakeStep) {
        setBuild((b) => {
          const v = Math.min(1.05, (b[bakeStep.id] ?? 0) + dt * BAKE_SPEED[level]);
          return { ...b, [bakeStep.id]: v };
        });
      }
      if (config.timeLimit) {
        setTimeLeft((t) => {
          const n = Math.max(0, t - dt);
          return n;
        });
      }
    },
    playing && phase === 'order' && (baking || Boolean(config.timeLimit)),
  );

  // Se acabó el tiempo del pedido: se entrega tal cual está.
  useEffect(() => {
    if (config.timeLimit && timeLeft <= 0 && phase === 'order' && playing) submit(true);
  }, [timeLeft, phase, playing, config.timeLimit, submit]);

  // Si se pasa del todo en el horno, se saca sola (quemada).
  useEffect(() => {
    if (baking && bakeStep && (build[bakeStep.id] ?? 0) >= 1.05) {
      setBaking(false);
      audio.play(SFX.bad);
    }
  }, [baking, bakeStep, build, audio]);

  const bake = {
    baking,
    start: () => {
      if (!bakeStep) return;
      setBuild((b) => ({ ...b, [bakeStep.id]: 0 }));
      setBaking(true);
      audio.play(SFX.oven);
    },
    stop: () => {
      setBaking(false);
      audio.play(SFX.ding);
    },
  };

  const restartShift = useCallback(() => {
    reset();
    setShift(createShift(recipe, level, Date.now() >>> 0));
    setBuild(emptyBuild(recipe, level));
    setStepIndex(0);
    setPlacement('toda');
    setTimeLeft(config.timeLimit);
    setBaking(false);
    setResult(null);
    setPhase('order');
  }, [reset, recipe, level, config.timeLimit]);

  useKeyboard({
    active: phase === 'order' && !session.isPaused,
    onAction: (action) => {
      if (action === 'pause' && config.timeLimit) session.togglePause();
      else if (action === 'left') setStepIndex((i) => Math.max(0, i - 1));
      else if (action === 'right') setStepIndex((i) => Math.min(steps.length - 1, i + 1));
    },
  });

  // Teclas 1-9: elegir opción del paso actual (simula el clic sobre el botón).
  useEffect(() => {
    if (phase !== 'order') return undefined;
    const onKey = (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey || !/^[1-9]$/.test(event.key)) return;
      const target = document.querySelectorAll('.ck-options .ck-option')[Number(event.key) - 1];
      target?.click();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase]);

  const last = shift.last;
  const pointsSoFar = shift.results.reduce((a, r) => a + r.points, 0);
  const lowTime = config.timeLimit && timeLeft <= 10;

  return (
    <div className="ck-play game-scroll">
      <GameHUD
        onPause={config.timeLimit && phase === 'order' ? session.togglePause : undefined}
        paused={session.isPaused}
        items={[
          { id: 'order', label: 'Pedido', value: `${Math.min(shift.index + 1, shift.orders.length)}/${shift.orders.length}` },
          { id: 'points', label: 'Puntos', value: String(pointsSoFar) },
          config.timeLimit
            ? { id: 'time', label: 'Tiempo', value: `${Math.ceil(timeLeft)} s`, tone: lowTime ? 'warn' : undefined }
            : { id: 'level', label: 'Nivel', value: config.label },
        ]}
      />
      <div className="ck-layout">
        <Ticket recipe={recipe} level={level} order={order} Visual={Visual} index={Math.min(shift.index, shift.orders.length - 1)} total={shift.orders.length} />
        <section className="ck-bench" aria-label={`Tu ${recipe.noun}`}>
          <Visual spec={build} bakeValue={bakeStep ? (build[bakeStep.id] ?? undefined) : undefined} className={cx('ck-bench__visual', baking && 'is-baking')} />
          <div className="ck-bench__actions">
            <Button
              variant="ghost"
              size="sm"
              icon={RotateCcw}
              onClick={() => {
                setBaking(false);
                setBuild(emptyBuild(recipe, level));
                audio.play(SFX.remove);
              }}
            >
              Empezar de nuevo
            </Button>
            <Button icon={Send} onClick={() => submit(false)} disabled={phase !== 'order' || baking}>
              Entregar
            </Button>
          </div>
        </section>
        <Station
          recipe={recipe}
          level={level}
          build={build}
          setBuild={setBuild}
          stepIndex={stepIndex}
          setStepIndex={setStepIndex}
          placement={placement}
          setPlacement={setPlacement}
          bake={bake}
          audio={audio}
        />
      </div>

      {session.isPaused && phase === 'order' && <PauseMenu onResume={session.resume} onRestart={restartShift} onExit={frame.exit}><p>El reloj está detenido.</p></PauseMenu>}

      {phase === 'feedback' && last && (
        <GameOverlay
          tone={last.perfect ? 'win' : last.precision >= 0.6 ? 'neutral' : 'lose'}
          eyebrow={last.timedOut ? 'Se acabó el tiempo' : `${last.customer} recibe su ${recipe.noun}`}
          title={last.perfect ? '¡Perfecto!' : last.precision >= 0.8 ? '¡Muy bien!' : last.precision >= 0.6 ? 'Casi' : 'No era lo que pidió'}
          className="ck-feedback"
          actions={
            <Button icon={ChevronRight} onClick={nextOrder} data-autofocus>
              {isShiftOver(shift) ? 'Ver el resultado del turno' : 'Siguiente pedido'}
            </Button>
          }
        >
          <p className="ck-feedback__score">
            Precisión <strong>{pct(last.precision)}</strong> · {last.points} puntos{last.bonus ? ` (incluye ${last.bonus} por rapidez)` : ''}
          </p>
          <ul className="ck-feedback__items">
            {last.items.map((item, i) => {
              const { icon: Icon, label } = STATUS[item.status];
              return (
                <li key={i} className={`is-${item.status}`}>
                  <Icon aria-hidden="true" />
                  <span>
                    <strong>{label}</strong> · {item.step}: {item.text}
                  </span>
                </li>
              );
            })}
          </ul>
        </GameOverlay>
      )}

      {phase === 'done' && result && (
        <GameResults
          outcome={result.won ? 'win' : 'lose'}
          eyebrow={result.won ? `Turno superado · ${starsText(result.stars)}` : 'Turno no superado'}
          title={`${result.points} puntos`}
          message={
            result.won
              ? `${texts.winMessage} Precisión media: ${pct(result.precision)}.`
              : `Precisión media ${pct(result.precision)}; hacía falta ${pct(config.passAt)}. Lee la comanda con calma: el orden de las ${steps.find((s) => s.kind === 'sequence')?.itemLabel?.toLowerCase() ?? 'cosas'}s también cuenta.`
          }
          saving={result.saving}
          stats={[
            { label: 'Puntos', value: String(result.points), record: result.marks?.[`score:${level}`]?.isRecord && result.marks[`score:${level}`].previous !== null },
            { label: 'Precisión media', value: pct(result.precision) },
            { label: 'Pedidos perfectos', value: `${result.perfect}/${result.orders}` },
          ]}
          onReplay={restartShift}
          replayLabel="Otro turno"
          extraActions={
            <Button variant="secondary" icon={ListOrdered} onClick={onMenu}>
              Niveles
            </Button>
          }
          onExit={frame.exit}
        />
      )}
      {config.timeLimit && phase === 'order' && lowTime && (
        <p className="sr-only" role="status">
          Quedan {Math.ceil(timeLeft)} segundos.
        </p>
      )}
    </div>
  );
}

/** Juego de cocina genérico: una receta, un dibujo y sus textos. */
export function CookingGame({ gameId, recipe, Visual, texts }) {
  const frame = useGameFrame();
  const record = useGameRecord(gameId);
  const [level, setLevel] = useState(null);
  if (level === null) return <LevelSelect texts={texts} record={record} onPick={setLevel} />;
  return <Shift key={level} gameId={gameId} recipe={recipe} Visual={Visual} texts={texts} level={level} frame={frame} onMenu={() => setLevel(null)} />;
}
