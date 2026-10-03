import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Check, Flag, GraduationCap, ListOrdered, Lock, Minus, Plus, Swords, Zap } from 'lucide-react';
import { Button } from '../../../../components/common/Button.jsx';
import { SegmentedControl } from '../../../../components/common/SegmentedControl.jsx';
import { GameHUD } from '../../components/GameHUD.jsx';
import { GameResults } from '../../components/GameResults.jsx';
import { useGameSession } from '../../hooks/useGameSession.js';
import { useGameRecord } from '../../hooks/useGameStatistics.js';
import { useGameAudio } from '../../hooks/useGameAudio.js';
import { useGameFrame, useInProgress } from '../../hooks/useGameFrame.js';
import { useReducedMotion } from '../../../../hooks/useReducedMotion.js';
import { cx } from '../../../../utils/cx.js';
import { FACTIONS, PLAYER, createGame, endTurn, order, orderError, previewOrder, reinforce, targetsFrom, territoriesOf } from './engine/frontEngine.js';
import { AI_LEVELS, applyAction, nextAction } from './engine/frontAI.js';
import { FrontMap } from './components/FrontMap.jsx';
import { SCENARIOS, TUTORIAL } from './scenarios.js';
import './styles/frente-abierto.css';

const GAME_ID = 'frente-abierto';
const SFX = {
  place: { wave: 'triangle', from: 500, to: 600, dur: 0.06, gain: 0.06 },
  move: { wave: 'sine', from: 420, to: 520, dur: 0.1, gain: 0.06 },
  capture: [
    { wave: 'triangle', from: 600, dur: 0.1, gain: 0.1 },
    { wave: 'triangle', from: 900, dur: 0.14, gain: 0.1, delay: 0.08 },
  ],
  repelled: { wave: 'square', from: 220, to: 150, dur: 0.18, gain: 0.06 },
};

const SIZES = [
  { value: 3, label: 'Pequeño' },
  { value: 4, label: 'Mediano' },
  { value: 5, label: 'Grande' },
];

function Setup({ record, onStart }) {
  const [radius, setRadius] = useState(4);
  const [rivals, setRivals] = useState(1);
  const [difficulty, setDifficulty] = useState('normal');
  const progress = record?.progress ?? {};
  const scenarios = progress.scenarios ?? {};
  return (
    <div className="fa-setup game-scroll">
      <header>
        <p className="eyebrow">Frente Abierto</p>
        <h2 className="fa-setup__title">Estrategia territorial por turnos</h2>
        <p className="fa-setup__text">Contra una IA local en este dispositivo: no hay jugadores conectados.</p>
      </header>
      <button type="button" className="fa-card fa-card--tutorial" onClick={() => onStart(TUTORIAL)}>
        <GraduationCap aria-hidden="true" />
        <span>
          <strong>Tutorial</strong>
          <small>{progress.tutorialDone ? 'Completado · repítelo cuando quieras' : 'Una partida pequeña con indicaciones paso a paso'}</small>
        </span>
      </button>
      <section className="fa-quick" aria-labelledby="fa-quick">
        <h3 id="fa-quick" className="fa-setup__subtitle">
          <Zap aria-hidden="true" /> Partida rápida
        </h3>
        <SegmentedControl label="Mapa" value={radius} onChange={setRadius} options={SIZES} />
        <SegmentedControl label="Rivales" value={rivals} onChange={setRivals} options={[1, 2, 3].map((n) => ({ value: n, label: String(n) }))} />
        <div className="fa-levels">
          <SegmentedControl label="Dificultad de la IA" value={difficulty} onChange={setDifficulty} options={AI_LEVELS.map((l) => ({ value: l.id, label: l.name }))} />
          <p className="fa-levels__text">{AI_LEVELS.find((l) => l.id === difficulty).description}</p>
        </div>
        <Button icon={Swords} onClick={() => onStart({ id: 'rapida', name: 'Partida rápida', radius, rivals, difficulty, seed: Date.now() % 100000 })}>
          Empezar
        </Button>
      </section>
      <section aria-labelledby="fa-scen">
        <h3 id="fa-scen" className="fa-setup__subtitle">
          <Flag aria-hidden="true" /> Escenarios
        </h3>
        <ol className="fa-scenarios">
          {SCENARIOS.map((s, i) => {
            const unlocked = i === 0 || scenarios[SCENARIOS[i - 1].id];
            const level = AI_LEVELS.find((l) => l.id === s.difficulty).name;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  className={cx('fa-card', scenarios[s.id] && 'is-done', !unlocked && 'is-locked')}
                  disabled={!unlocked}
                  onClick={() => onStart(s)}
                  aria-label={`Escenario ${i + 1}: ${s.name}. ${s.rivals} ${s.rivals === 1 ? 'rival' : 'rivales'}, IA ${level}.${scenarios[s.id] ? ' Ganado.' : ''}${unlocked ? '' : ' Bloqueado.'}`}
                >
                  <span className="fa-card__n">{i + 1}</span>
                  <span>
                    <strong>{s.name}</strong>
                    <small>
                      {s.rivals} {s.rivals === 1 ? 'rival' : 'rivales'} · IA {level}
                    </small>
                  </span>
                  {!unlocked ? <Lock aria-hidden="true" /> : scenarios[s.id] ? <Check aria-hidden="true" /> : null}
                </button>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

/** Indicación del siguiente paso (siempre en el tutorial; breve en el resto). */
function hintFor(state, selected, target) {
  if (state.current !== PLAYER) return `Turno de ${FACTIONS[state.current].name}…`;
  if (state.phase === 'reinforce') return `Refuerzos: te quedan ${state.reinforcements}. Toca uno de tus territorios (★) para colocarlos.`;
  if (target) return 'Elige cuántas tropas envías y confirma. El resultado se ve antes de confirmar.';
  if (selected) return 'Toca un vecino marcado: verde para mover tropas, rojo para atacar.';
  return 'Elige uno de tus territorios con 2 o más tropas que no haya actuado, o termina el turno.';
}

function Battle({ setup, frame, onMenu }) {
  const session = useGameSession(GAME_ID, { autoPause: false });
  const audio = useGameAudio();
  const reduced = useReducedMotion();
  const [state, setState] = useState(() => createGame(setup));
  const [selected, setSelected] = useState(null);
  const [target, setTarget] = useState(null);
  const [amount, setAmount] = useState(1);
  const [flash, setFlash] = useState(new Set());
  const [result, setResult] = useState(null);
  const [showRules, setShowRules] = useState(Boolean(setup.tutorial));
  const { start, finish } = session;
  const aiTimer = useRef(null);

  useEffect(() => {
    start();
    return () => clearTimeout(aiTimer.current);
  }, [start]);
  useInProgress(!result && state.turn > 1);

  // Turnos de la IA: una acción cada poco (se ven sus movimientos), sin bloquear la interfaz.
  useEffect(() => {
    if (state.status !== 'playing' || state.current === PLAYER) return undefined;
    aiTimer.current = setTimeout(
      () => {
        const action = nextAction(state);
        const { state: next, done, result: r } = applyAction(state, action);
        if (action?.type === 'order') {
          setFlash(new Set([action.to]));
          if (r) audio.play(r.type === 'capture' ? SFX.capture : r.type === 'repelled' ? SFX.repelled : SFX.move);
        }
        setState(done ? endTurn(next) : next);
      },
      reduced ? 30 : 260,
    );
    return () => clearTimeout(aiTimer.current);
  }, [state, reduced, audio]);

  const finishGame = useCallback(
    async (final) => {
      const won = final.status === 'won';
      setResult({ won, saving: true });
      await finish({
        completed: won,
        marks: won ? [{ key: `turns:${setup.difficulty}`, value: final.turn, better: 'lower' }] : [],
        progress: (p) => ({
          ...p,
          wins: { ...(p.wins ?? {}), [setup.difficulty]: (p.wins?.[setup.difficulty] ?? 0) + (won ? 1 : 0) },
          losses: { ...(p.losses ?? {}), [setup.difficulty]: (p.losses?.[setup.difficulty] ?? 0) + (won ? 0 : 1) },
          scenarios: won && setup.id.startsWith('s') ? { ...(p.scenarios ?? {}), [setup.id]: true } : (p.scenarios ?? {}),
          tutorialDone: p.tutorialDone || (won && Boolean(setup.tutorial)),
        }),
      });
      setResult({ won, saving: false });
    },
    [finish, setup],
  );
  useEffect(() => {
    if (state.status !== 'playing' && !result) finishGame(state);
  }, [state, result, finishGame]);

  const myTurn = state.current === PLAYER && state.status === 'playing' && !result;
  const targets = useMemo(() => (myTurn && selected ? targetsFrom(state, selected) : []), [myTurn, state, selected]);
  const source = selected ? state.map[selected] : null;
  const preview = target && source ? previewOrder(state, selected, target, amount) : null;

  const onTerritory = (key) => {
    if (!myTurn) return;
    const t = state.map[key];
    if (state.phase === 'reinforce') {
      if (t.owner === PLAYER) {
        setState(reinforce(state, key, 1));
        audio.play(SFX.place);
        setSelected(key);
      }
      return;
    }
    if (target === key) return;
    if (selected && targets.some((x) => x.key === key)) {
      setTarget(key);
      // Por defecto: lo justo para conquistar (o todas menos una si no alcanza); al mover, todas menos una.
      const max = source.troops - 1;
      const kind = targets.find((x) => x.key === key).kind;
      const need = Math.floor(state.map[key].troops * (state.map[key].kind === 'fort' ? 1.5 : 1)) + 1;
      setAmount(kind === 'move' ? max : Math.min(max, Math.max(1, need + 1)));
      return;
    }
    setTarget(null);
    setSelected(t.owner === PLAYER ? key : null);
  };

  const placeMany = (n) => {
    if (!selected || state.map[selected].owner !== PLAYER) return;
    const next = reinforce(state, selected, Math.min(n, state.reinforcements));
    if (next) {
      setState(next);
      audio.play(SFX.place);
    }
  };

  const confirmOrder = () => {
    const outcome = order(state, selected, target, amount);
    if (!outcome) return;
    audio.play(outcome.result.type === 'capture' ? SFX.capture : outcome.result.type === 'repelled' ? SFX.repelled : SFX.move);
    setFlash(new Set([target]));
    setState(outcome.state);
    setSelected(null);
    setTarget(null);
  };

  const endMyTurn = () => {
    setSelected(null);
    setTarget(null);
    setState(endTurn(state));
  };

  const mine = territoriesOf(state, PLAYER).length;
  const rivalsLeft = state.factions.filter((f) => f !== PLAYER && territoriesOf(state, f).length);
  const error = target ? orderError(state, selected, target, amount) : null;

  return (
    <div className="fa-play game-scroll">
      <GameHUD
        items={[
          { id: 'turn', label: 'Turno', value: String(state.turn) },
          { id: 'mine', label: 'Tus territorios', value: String(mine) },
          { id: 'rivals', label: 'Rivales', value: rivalsLeft.map((f) => FACTIONS[f].glyph).join(' ') || '—' },
        ]}
      />
      <div className="fa-layout">
        <div className="fa-map-wrap">
          <div className="fa-map-scroll">
            <FrontMap state={state} selected={selected} targets={targets} highlight={flash} onTerritory={onTerritory} />
          </div>
          <ul className="fa-legend" aria-label="Bandos">
            {state.factions.map((f) => (
              <li key={f} className={cx(!territoriesOf(state, f).length && 'is-out')}>
                <span style={{ background: FACTIONS[f].color }} aria-hidden="true">
                  {FACTIONS[f].glyph}
                </span>
                {FACTIONS[f].name} · {territoriesOf(state, f).length}
              </li>
            ))}
            <li>
              <span className="fa-legend__neutral" aria-hidden="true" /> Neutral
            </li>
          </ul>
        </div>

        <aside className="fa-panel" aria-label="Acciones">
          <p className={cx('fa-hint', setup.tutorial && 'is-tutorial')} role="status" aria-live="polite">
            {hintFor(state, selected, target)}
          </p>

          {myTurn && state.phase === 'reinforce' && selected && state.map[selected].owner === PLAYER && (
            <div className="fa-actions">
              <Button size="sm" variant="secondary" onClick={() => placeMany(3)}>
                +3
              </Button>
              <Button size="sm" onClick={() => placeMany(state.reinforcements)}>
                Todos aquí ({state.reinforcements})
              </Button>
            </div>
          )}

          {myTurn && target && source && (
            <div className="fa-order">
              <p className="fa-order__title">
                {preview.type === 'move'
                  ? `Mover tropas a un territorio tuyo (${state.map[target].troops})`
                  : `Atacar: ${state.map[target].troops} ${state.map[target].troops === 1 ? 'tropa' : 'tropas'}${state.map[target].kind === 'fort' ? `, fortaleza (defensa ${preview.defense})` : ''}`}
              </p>
              <div className="fa-stepper" role="group" aria-label="Tropas que se envían">
                <button type="button" onClick={() => setAmount((a) => Math.max(1, a - 1))} aria-label="Una menos" disabled={amount <= 1}>
                  <Minus aria-hidden="true" />
                </button>
                <output aria-live="polite">{amount}</output>
                <button type="button" onClick={() => setAmount((a) => Math.min(source.troops - 1, a + 1))} aria-label="Una más" disabled={amount >= source.troops - 1}>
                  <Plus aria-hidden="true" />
                </button>
                <button type="button" className="fa-stepper__max" onClick={() => setAmount(source.troops - 1)}>
                  Todas ({source.troops - 1})
                </button>
              </div>
              <p className={cx('fa-preview', preview.type === 'repelled' && 'is-bad')}>
                {preview.type === 'move' && `Quedarán ${state.map[target].troops + amount} tropas allí.`}
                {preview.type === 'capture' && `Conquistas el territorio y quedan ${preview.survivors} ${preview.survivors === 1 ? 'tropa' : 'tropas'}.`}
                {preview.type === 'repelled' && `No basta (defensa ${preview.defense}). Pierdes ${amount} y el defensor pierde ${preview.defenderLoss}.`}
              </p>
              <div className="fa-actions">
                <Button onClick={confirmOrder} disabled={Boolean(error)}>
                  {preview.type === 'move' ? 'Mover' : 'Atacar'}
                </Button>
                <Button variant="ghost" onClick={() => setTarget(null)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          <div className="fa-actions fa-actions--end">
            <Button variant={target ? 'secondary' : 'primary'} onClick={endMyTurn} disabled={!myTurn || state.phase !== 'orders'}>
              Terminar turno
            </Button>
            <Button variant="ghost" size="sm" icon={BookOpen} onClick={() => setShowRules((v) => !v)} aria-expanded={showRules}>
              Reglas
            </Button>
          </div>
          {showRules && (
            <ul className="fa-rules">
              <li>Refuerzos: territorios ÷ 3 (mínimo 3) + 2 por cada ciudad.</li>
              <li>Cada territorio actúa una vez por turno y siempre deja una tropa.</li>
              <li>Conquistas si envías más tropas que la defensa (fortaleza ×1,5); pierdes tantas como la defensa.</li>
              <li>Ganas al eliminar a todos los rivales. La IA juega con las mismas reglas.</li>
            </ul>
          )}
        </aside>
      </div>

      {result && (
        <GameResults
          outcome={result.won ? 'win' : 'lose'}
          eyebrow={result.won ? '¡Victoria!' : 'Derrota'}
          title={result.won ? `Mapa conquistado en ${state.turn} turnos` : 'Has perdido todos tus territorios'}
          message={`${setup.name} · IA ${AI_LEVELS.find((l) => l.id === setup.difficulty).name}.`}
          saving={result.saving}
          stats={[
            { label: 'Turnos', value: String(state.turn) },
            { label: 'Territorios', value: String(mine) },
          ]}
          onReplay={() => onMenu(setup)}
          replayLabel="Jugar de nuevo"
          extraActions={
            <Button variant="secondary" icon={ListOrdered} onClick={() => onMenu(null)}>
              Modos
            </Button>
          }
          onExit={frame.exit}
        />
      )}
    </div>
  );
}

/** Frente Abierto: tutorial, partida rápida y escenarios contra la IA local. */
export default function FrenteAbierto() {
  const frame = useGameFrame();
  const record = useGameRecord(GAME_ID);
  const [setup, setSetup] = useState(null);
  const [round, setRound] = useState(0);
  if (!setup) return <Setup record={record} onStart={setSetup} />;
  return (
    <Battle
      key={round}
      setup={setup}
      frame={frame}
      onMenu={(again) => {
        setSetup(again ? { ...again, seed: again.id === 'rapida' ? Date.now() % 100000 : again.seed } : null);
        setRound((r) => r + 1);
      }}
    />
  );
}
