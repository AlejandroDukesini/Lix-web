import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Lightbulb, ListOrdered, Lock, RotateCcw, Star, Undo2 } from 'lucide-react';
import { Button } from '../../../../components/common/Button.jsx';
import { GameHUD } from '../../components/GameHUD.jsx';
import { GameOverlay, PauseMenu } from '../../components/GameOverlay.jsx';
import { GameResults } from '../../components/GameResults.jsx';
import { useGameSession } from '../../hooks/useGameSession.js';
import { useGameRecord } from '../../hooks/useGameStatistics.js';
import { useGameAudio } from '../../hooks/useGameAudio.js';
import { useGameFrame, useInProgress, usePauseOnInterrupt } from '../../hooks/useGameFrame.js';
import { useKeyboard } from '../../hooks/useKeyboard.js';
import { formatTime } from '../../services/gameLifecycle.js';
import { cx } from '../../../../utils/cx.js';
import { checkPour, createState, isSolved, isUniformFull, pour, solve, usefulMoves } from './engine/sortEngine.js';
import { LEVELS, TIERS } from './levels/levels.js';
import { TINCTURES, tinctureName } from './palette.js';
import './styles/botica.css';

const GAME_ID = 'botica';
const SFX = {
  lift: { wave: 'triangle', from: 640, dur: 0.05, gain: 0.05 },
  pour: { noise: true, from: 1400, to: 700, dur: 0.38, gain: 0.04 },
  glug: { wave: 'sine', from: 300, to: 520, dur: 0.12, gain: 0.07 },
  sealed: [
    { wave: 'sine', from: 988, dur: 0.12, gain: 0.07 },
    { wave: 'sine', from: 1319, dur: 0.22, gain: 0.05, delay: 0.06 },
  ],
  invalid: { wave: 'square', from: 180, to: 130, dur: 0.12, gain: 0.05 },
  win: [
    { wave: 'triangle', from: 523, dur: 0.14, gain: 0.12 },
    { wave: 'triangle', from: 659, dur: 0.14, gain: 0.12, delay: 0.12 },
    { wave: 'triangle', from: 784, dur: 0.14, gain: 0.12, delay: 0.24 },
    { wave: 'triangle', from: 1047, dur: 0.34, gain: 0.12, delay: 0.36 },
  ],
  stuck: { wave: 'sine', from: 330, to: 180, dur: 0.35, gain: 0.09 },
};
const REASON_TEXT = {
  mismatch: 'Solo se vierte sobre la misma tintura o en un frasco vacío.',
  full: 'Ese frasco ya está lleno.',
  empty: 'Ese frasco está vacío: elige uno con tintura.',
  done: 'Ese frasco ya está terminado y sellado.',
};
// Duraciones del vertido (ms): llevar el frasco, verter y devolverlo.
const LIFT_MS = 260;
const POUR_MS = 420;
const BACK_MS = 240;

const isUnlocked = (index, completed) => index === 0 || Boolean(completed[LEVELS[index - 1].id]);
export const starsFor = (moves, par, usedHint) => {
  const stars = moves <= par ? 3 : moves <= Math.ceil(par * 1.35) ? 2 : 1;
  return usedHint ? Math.min(2, stars) : stars;
};
const starsText = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);

function LevelSelect({ completed, onPick }) {
  return (
    <div className="bt-select game-scroll">
      <header className="bt-select__head">
        <p className="eyebrow">Botica de colores</p>
        <h2 className="bt-select__title">El estante de las tinturas</h2>
        <p className="bt-select__text">Las tinturas se han mezclado en los frascos. Viértelas de uno a otro hasta que cada frasco guarde un único color.</p>
      </header>
      {TIERS.map((tier) => (
        <section key={tier.id} className="bt-tier" aria-labelledby={`bt-tier-${tier.id}`}>
          <h3 id={`bt-tier-${tier.id}`} className="bt-tier__title">
            {tier.label} <small>{tier.note}</small>
          </h3>
          <ol className="bt-levels">
            {LEVELS.filter((l) => l.tier === tier.id).map((level) => {
              const index = LEVELS.indexOf(level);
              const unlocked = isUnlocked(index, completed);
              const stars = completed[level.id] ?? 0;
              const colors = new Set(level.tubes.flat()).size;
              return (
                <li key={level.id}>
                  <button
                    type="button"
                    className={cx('bt-level', stars > 0 && 'is-done')}
                    disabled={!unlocked}
                    onClick={() => onPick(level)}
                    aria-label={`Nivel ${index + 1}: ${colors} tinturas, ${level.tubes.length} frascos.${stars ? ` ${stars} de 3 estrellas.` : ''}${unlocked ? '' : ' Bloqueado: supera el anterior.'}`}
                  >
                    <span className="bt-level__flask" aria-hidden="true">
                      {[...new Set(level.tubes.flat())].slice(0, 4).map((c) => (
                        <i key={c} style={{ background: TINCTURES[c].color }} />
                      ))}
                    </span>
                    <span className="bt-level__number">{index + 1}</span>
                    <span className="bt-level__meta">
                      {!unlocked ? (
                        <Lock aria-hidden="true" />
                      ) : stars ? (
                        <span className="bt-stars" aria-hidden="true">
                          {[1, 2, 3].map((n) => (
                            <Star key={n} className={n <= stars ? 'is-on' : undefined} />
                          ))}
                        </span>
                      ) : (
                        `${colors} colores`
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}

/** Un frasco: capas fijas (una por hueco) que suben y bajan con una transición. */
function Flask({ tube, index, capacity, selected, hinted, shaking, sealed, pouring, disabled, onPick, flaskRef }) {
  const run = tube.length ? tube.at(-1) : null;
  const label = tube.length
    ? `Frasco ${index + 1}: ${tube.map(tinctureName).join(', ')} (de abajo arriba)${sealed ? ', terminado' : ''}.`
    : `Frasco ${index + 1}: vacío.`;
  return (
    <button
      ref={flaskRef}
      type="button"
      className={cx('bt-flask', selected && 'is-selected', hinted && 'is-hinted', shaking && 'is-shaking', sealed && 'is-sealed', pouring && 'is-pouring')}
      style={{ '--cap': capacity, ...(pouring ? pouring.style : null) }}
      aria-label={label}
      aria-pressed={selected}
      disabled={disabled}
      data-flask={index}
      onClick={() => onPick(index)}
    >
      <span className="bt-flask__cork" aria-hidden="true" />
      <span className="bt-flask__glass" aria-hidden="true">
        {Array.from({ length: capacity }, (_, slot) => {
          const color = tube[slot];
          return (
            <span
              key={slot}
              className={cx('bt-layer', color && 'is-full', slot === tube.length - 1 && 'is-top')}
              style={{ '--slot': slot, '--ink': color ? TINCTURES[color].color : 'transparent' }}
            >
              {color && <span className="bt-layer__glyph">{TINCTURES[color].glyph}</span>}
            </span>
          );
        })}
        <span className="bt-flask__shine" />
      </span>
      {run && selected && <span className="bt-flask__tag">{tinctureName(run)}</span>}
    </button>
  );
}

function Play({ level, frame, onLevels, onNext }) {
  const session = useGameSession(GAME_ID);
  const audio = useGameAudio();
  const [state, setState] = useState(() => createState(level));
  const [history, setHistory] = useState([]);
  const [selected, setSelected] = useState(null);
  const [anim, setAnim] = useState(null); // { from, to, color, stage, style, stream }
  const [shake, setShake] = useState(null);
  const [hint, setHint] = useState(null);
  const [usedHint, setUsedHint] = useState(false);
  const [notice, setNotice] = useState(null);
  const [stuck, setStuck] = useState(false);
  const [result, setResult] = useState(null);
  const [clock, setClock] = useState(0);
  const boardRef = useRef(null);
  const flaskRefs = useRef([]);
  const timers = useRef(new Set());
  const { start, finish, elapsedMs } = session;

  const later = useCallback((fn, ms) => {
    const id = setTimeout(() => {
      timers.current.delete(id);
      fn();
    }, ms);
    timers.current.add(id);
  }, []);
  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    start();
  }, [start]);
  useInProgress(!result && history.length > 0);
  usePauseOnInterrupt(session.pause);
  useEffect(() => {
    if (!session.isPlaying) return undefined;
    const timer = setInterval(() => setClock(elapsedMs()), 500);
    return () => clearInterval(timer);
  }, [session.isPlaying, elapsedMs]);

  const win = useCallback(
    async (moves) => {
      audio.play(SFX.win);
      const timeMs = Math.round(elapsedMs());
      const stars = starsFor(moves, level.par, usedHint);
      setResult({ moves, stars, timeMs, saving: true });
      const saved = await finish({
        completed: true,
        marks: [
          { key: `moves:${level.id}`, value: moves, better: 'lower' },
          { key: `time:${level.id}`, value: timeMs, better: 'lower' },
        ],
        progress: (p) => ({ ...p, completed: { ...(p.completed ?? {}), [level.id]: Math.max(p.completed?.[level.id] ?? 0, stars) } }),
      });
      setResult({ moves, stars, timeMs, saving: false, mark: saved.marks[`moves:${level.id}`] });
    },
    [audio, elapsedMs, finish, level, usedHint],
  );

  const busy = anim !== null;
  const playing = session.isPlaying && !result && !stuck;

  const reject = useCallback(
    (index, reason) => {
      audio.play(SFX.invalid);
      setShake({ index, key: Date.now() });
      later(() => setShake((s) => (s?.index === index ? null : s)), 420);
      if (REASON_TEXT[reason]) setNotice({ key: Date.now(), text: REASON_TEXT[reason] });
    },
    [audio, later],
  );

  /** Geometría del vertido: el frasco viaja sobre el destino y se inclina hacia él. */
  const pourGeometry = (from, to) => {
    const board = boardRef.current?.getBoundingClientRect();
    const a = flaskRefs.current[from]?.getBoundingClientRect();
    const b = flaskRefs.current[to]?.getBoundingClientRect();
    if (!board || !a || !b || !a.width) return null;
    const side = b.left >= a.left ? 1 : -1; // vierte hacia la derecha o hacia la izquierda
    const dx = b.left + b.width / 2 - (a.left + a.width / 2) - side * a.width * 0.55;
    const dy = b.top - a.top - a.height * 0.42;
    const mouthX = b.left + b.width / 2 - board.left;
    const mouthY = b.top - board.top + 4;
    return { side, dx, dy, mouthX, mouthY, streamTop: a.top + dy - board.top + a.height * 0.14, height: b.top - board.top + b.height * 0.9 };
  };

  const doPour = useCallback(
    (from, to) => {
      const check = checkPour(state, from, to);
      if (!check.ok) return reject(to, check.reason);
      const next = pour(state, from, to);
      setSelected(null);
      setHint(null);
      setNotice(null);
      const geo = pourGeometry(from, to);
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      const commit = () => {
        setHistory((h) => [...h, state]);
        setState(next);
        const moves = history.length + 1;
        if (isUniformFull(next.tubes[to], next.capacity)) later(() => audio.play(SFX.sealed), 180);
        if (isSolved(next)) {
          later(() => win(moves), 520);
          return;
        }
        // ¿Queda salida? (búsqueda acotada fuera del clic para no frenar la animación)
        later(() => {
          if (!usefulMoves(next).length || (() => {
            const res = solve(next, { budget: 40_000 });
            return !res.moves && !res.exhausted;
          })()) {
            audio.play(SFX.stuck);
            setStuck(true);
          }
        }, 60);
      };
      if (!geo || reduced) {
        audio.play(SFX.glug);
        commit();
        return undefined;
      }
      const lifted = { transform: `translate(${geo.dx}px, ${geo.dy}px) rotate(${geo.side * 62}deg)`, zIndex: 3 };
      setAnim({ from, to, color: check.color, stage: 'lift', style: lifted, geo });
      later(() => {
        audio.play(SFX.pour);
        setAnim((a) => a && { ...a, stage: 'pour' });
        commit();
      }, LIFT_MS);
      later(() => setAnim((a) => a && { ...a, stage: 'back', style: { transform: 'none', zIndex: 3 } }), LIFT_MS + POUR_MS);
      later(() => setAnim(null), LIFT_MS + POUR_MS + BACK_MS);
      return undefined;
    },
    // pourGeometry solo lee refs del DOM.
    [state, history.length, reject, audio, later, win],
  );

  const pick = useCallback(
    (index) => {
      if (!playing || busy) return;
      if (selected === null) {
        const tube = state.tubes[index];
        if (!tube.length) return reject(index, 'empty');
        if (isUniformFull(tube, state.capacity)) return reject(index, 'done');
        audio.play(SFX.lift);
        setSelected(index);
        return undefined;
      }
      if (selected === index) {
        setSelected(null);
        return undefined;
      }
      return doPour(selected, index);
    },
    [playing, busy, selected, state, reject, audio, doPour],
  );

  const undo = useCallback(() => {
    if (!history.length || result || busy) return;
    setState(history.at(-1));
    setHistory((h) => h.slice(0, -1));
    setSelected(null);
    setHint(null);
    setStuck(false);
    setNotice(null);
  }, [history, result, busy]);

  const restart = useCallback(() => {
    if (busy) return;
    setState(createState(level));
    setHistory([]);
    setSelected(null);
    setHint(null);
    setStuck(false);
    setNotice(null);
  }, [level, busy]);

  const askHint = useCallback(() => {
    if (!playing || busy) return;
    const res = solve(state, { budget: 120_000 });
    if (!res.moves?.length) {
      setNotice({ key: Date.now(), text: res.exhausted ? 'No encuentro una pista ahora: prueba a deshacer un par de movimientos.' : 'Desde aquí ya no hay solución: deshaz algún movimiento.' });
      return;
    }
    const [from, to] = res.moves[0];
    setUsedHint(true);
    setSelected(null);
    setHint({ from, to });
    setNotice({ key: Date.now(), text: `Pista: vierte el frasco ${from + 1} en el ${to + 1}.` });
  }, [playing, busy, state]);

  useKeyboard({
    active: !result,
    onAction: (action) => {
      if (action === 'pause') session.togglePause();
    },
  });
  useEffect(() => {
    if (result) return undefined;
    const onKey = (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === 'z' || event.key === 'Z' || event.key === 'Backspace') undo();
      else if (event.key === 'r' || event.key === 'R') restart();
      else if (event.key === 'h' || event.key === 'H') askHint();
      else if (/^[0-9]$/.test(event.key)) {
        const index = event.key === '0' ? 9 : Number(event.key) - 1;
        if (index < state.tubes.length) pick(index);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, restart, askHint, pick, state.tubes.length, result]);

  const sealedCount = state.tubes.filter((t) => isUniformFull(t, state.capacity)).length;
  const colors = new Set(level.tubes.flat()).size;
  const index = LEVELS.indexOf(level);
  const tier = TIERS.find((t) => t.id === level.tier);
  const perRow = state.tubes.length > 7 ? Math.ceil(state.tubes.length / 2) : state.tubes.length;

  return (
    <div className="bt-play game-scroll">
      <GameHUD
        onPause={session.togglePause}
        paused={session.isPaused}
        pauseDisabled={Boolean(result)}
        items={[
          { id: 'level', label: `Nivel · ${tier.label}`, value: String(index + 1) },
          { id: 'sealed', label: 'Terminados', value: `${sealedCount}/${colors}` },
          { id: 'moves', label: 'Movimientos', value: String(history.length), tone: history.length > level.par ? 'warn' : undefined },
          { id: 'time', label: 'Tiempo', value: formatTime(clock, { decimals: 0 }) },
        ]}
      />
      <div ref={boardRef} className={cx('bt-shelf', state.capacity === 5 && 'is-tall')} style={{ '--per-row': perRow }}>
        <div className="bt-shelf__window" aria-hidden="true" />
        <div className="bt-flasks" role="group" aria-label="Frascos. Elige uno de origen y después uno de destino.">
          {state.tubes.map((tube, i) => (
            <Flask
              key={i}
              tube={tube}
              index={i}
              capacity={state.capacity}
              selected={selected === i || (anim?.from === i && anim.stage !== 'back')}
              hinted={hint && (hint.from === i || hint.to === i)}
              shaking={shake?.index === i}
              sealed={isUniformFull(tube, state.capacity)}
              pouring={anim?.from === i ? anim : null}
              disabled={!playing}
              onPick={pick}
              flaskRef={(el) => {
                flaskRefs.current[i] = el;
              }}
            />
          ))}
        </div>
        {anim?.stage === 'pour' && (
          <span
            className="bt-stream"
            aria-hidden="true"
            style={{
              left: `${anim.geo.mouthX}px`,
              top: `${anim.geo.streamTop}px`,
              height: `${Math.max(12, anim.geo.height - anim.geo.streamTop)}px`,
              '--ink': TINCTURES[anim.color].color,
              '--pour-ms': `${POUR_MS}ms`,
            }}
          />
        )}
      </div>
      <p className="bt-notice" role="status" aria-live="polite">
        {notice ? (
          <span key={notice.key}>{notice.text}</span>
        ) : selected !== null ? (
          `Frasco ${selected + 1} en la mano: ahora elige dónde verter.`
        ) : (
          `Toca un frasco y luego otro para verter. Tres estrellas con ${level.par} movimientos o menos.`
        )}
      </p>
      <div className="bt-actions">
        <Button variant="secondary" size="sm" icon={Undo2} onClick={undo} disabled={!history.length || Boolean(result) || busy}>
          Deshacer
        </Button>
        <Button variant="secondary" size="sm" icon={RotateCcw} onClick={restart} disabled={Boolean(result) || busy}>
          Reiniciar
        </Button>
        <Button variant="ghost" size="sm" icon={Lightbulb} onClick={askHint} disabled={!playing || busy}>
          Pista
        </Button>
        <Button variant="ghost" size="sm" icon={ListOrdered} onClick={onLevels}>
          Niveles
        </Button>
      </div>

      {session.isPaused && !result && <PauseMenu onResume={session.resume} onRestart={restart} onExit={frame.exit} />}
      {stuck && !result && (
        <GameOverlay
          tone="lose"
          eyebrow="Sin salida"
          title="Así ya no se pueden ordenar"
          actions={
            <>
              <Button icon={Undo2} onClick={undo} data-autofocus>
                Deshacer
              </Button>
              <Button variant="secondary" icon={RotateCcw} onClick={restart}>
                Reiniciar nivel
              </Button>
            </>
          }
        >
          <p>Ningún orden de vertidos resuelve ya el estante. Deshaz el último movimiento y prueba a guardar un frasco vacío para más adelante.</p>
        </GameOverlay>
      )}
      {result && (
        <GameResults
          outcome="win"
          eyebrow="¡Estante ordenado!"
          title={`Nivel ${index + 1}: ${starsText(result.stars)}`}
          message={
            result.stars === 3
              ? 'Cada tintura en su frasco, con los vertidos justos.'
              : usedHint
                ? 'Con pista, el máximo son dos estrellas. ¡Prueba sin ella!'
                : `Para las tres estrellas: ${level.par} movimientos o menos.`
          }
          saving={result.saving}
          stats={[
            {
              label: 'Movimientos',
              value: String(result.moves),
              record: result.mark?.isRecord && result.mark.previous !== null,
              best: result.mark && !result.mark.isRecord ? String(result.mark.best) : null,
            },
            { label: 'Tiempo', value: formatTime(result.timeMs, { decimals: 0 }) },
          ]}
          onReplay={onNext ?? onLevels}
          replayLabel={onNext ? 'Siguiente nivel' : 'Ver niveles'}
          extraActions={
            <Button variant="secondary" icon={Check} onClick={onLevels}>
              Niveles
            </Button>
          }
          onExit={frame.exit}
        />
      )}
    </div>
  );
}

/** Botica de colores: niveles y partida. */
export default function Botica() {
  const frame = useGameFrame();
  const record = useGameRecord(GAME_ID);
  const [level, setLevel] = useState(null);
  const completed = record?.progress?.completed ?? {};
  const index = level ? LEVELS.indexOf(level) : -1;
  const next = index >= 0 ? (LEVELS[index + 1] ?? null) : null;
  if (!level) return <LevelSelect completed={completed} onPick={setLevel} />;
  return <Play key={level.id} level={level} frame={frame} onLevels={() => setLevel(null)} onNext={next ? () => setLevel(next) : null} />;
}
