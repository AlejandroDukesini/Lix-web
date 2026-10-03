import { useCallback, useEffect, useRef, useState } from 'react';
import { BookOpen, Check, Infinity as InfinityIcon, ListOrdered, Lock, RotateCcw } from 'lucide-react';
import { Button } from '../../../../components/common/Button.jsx';
import { Dialog } from '../../../../components/common/Dialog.jsx';
import { GameHUD } from '../../components/GameHUD.jsx';
import { PauseMenu } from '../../components/GameOverlay.jsx';
import { GameResults } from '../../components/GameResults.jsx';
import { useGameSession } from '../../hooks/useGameSession.js';
import { useGameRecord } from '../../hooks/useGameStatistics.js';
import { useGameAudio } from '../../hooks/useGameAudio.js';
import { useGameFrame, useInProgress, usePauseOnInterrupt } from '../../hooks/useGameFrame.js';
import { useKeyboard } from '../../hooks/useKeyboard.js';
import { updateGameSettings } from '../../services/gameStorage.js';
import { cx } from '../../../../utils/cx.js';
import { CLEAR_SIZE, createGame, place } from './engine/hexEngine.js';
import { CHALLENGES, FREE_PLAY } from './levels/levels.js';
import { HexBoard, Stack } from './components/HexBoard.jsx';
import './styles/hexastack.css';

const GAME_ID = 'hexastack';
const SFX = {
  place: { wave: 'triangle', from: 420, to: 520, dur: 0.08, gain: 0.08 },
  merge: { wave: 'sine', from: 600, to: 900, dur: 0.1, gain: 0.07 },
  clear: [
    { wave: 'triangle', from: 660, dur: 0.1, gain: 0.12 },
    { wave: 'triangle', from: 990, dur: 0.18, gain: 0.12, delay: 0.08 },
  ],
  over: { wave: 'sine', from: 330, to: 160, dur: 0.5, gain: 0.1 },
};

/** Reglas: se muestran antes de la primera partida y siempre desde «Reglas». */
export function HexRules() {
  return (
    <ol className="hx-rules">
      <li>Elige una de las tres pilas de abajo y colócala en una celda vacía.</li>
      <li>Las pilas vecinas con el <strong>mismo color arriba</strong> le pasan esas fichas. Las de debajo se quedan.</li>
      <li>
        Con <strong>{CLEAR_SIZE} fichas</strong> del mismo color arriba, desaparecen y suman puntos. Una fusión puede
        provocar otra: las cadenas valen el doble, el triple…
      </li>
      <li>Jugadas seguidas que despejan forman una racha con puntos extra.</li>
      <li>Si el tablero se llena, se acaba. En los desafíos, gana despejando el objetivo antes.</li>
    </ol>
  );
}

function ModeSelect({ record, onPick, onRules }) {
  const completed = record?.progress?.completed ?? {};
  const best = record?.best ?? {};
  return (
    <div className="hx-select game-scroll">
      <header>
        <p className="eyebrow">HexaStack</p>
        <h2 className="hx-select__title">Apila, junta y despeja</h2>
        <p className="hx-select__text">
          Junta {CLEAR_SIZE} fichas del mismo color para despejarlas.{' '}
          <button type="button" className="hx-link" onClick={onRules}>
            <BookOpen aria-hidden="true" /> Ver las reglas
          </button>
        </p>
      </header>
      <button type="button" className="hx-free" onClick={() => onPick(FREE_PLAY)}>
        <InfinityIcon aria-hidden="true" />
        <span>
          <strong>Partida libre</strong>
          <small>{Number.isFinite(best['score:libre']) ? `Récord: ${best['score:libre'].toLocaleString('es')} puntos` : 'Sin objetivo: hasta que se llene el tablero'}</small>
        </span>
      </button>
      <section aria-labelledby="hx-challenges">
        <h3 id="hx-challenges" className="hx-select__subtitle">
          Desafíos
        </h3>
        <ol className="hx-challenges">
          {CHALLENGES.map((c, i) => {
            const unlocked = i === 0 || completed[CHALLENGES[i - 1].id];
            return (
              <li key={c.id}>
                <button
                  type="button"
                  className={cx('hx-challenge', completed[c.id] && 'is-done', !unlocked && 'is-locked')}
                  disabled={!unlocked}
                  onClick={() => onPick(c)}
                  aria-label={`Desafío ${i + 1}: ${c.name}. Despejar ${c.target} fichas con ${c.colors} colores.${completed[c.id] ? ' Superado.' : ''}${unlocked ? '' : ' Bloqueado.'}`}
                >
                  <span className="hx-challenge__n">{i + 1}</span>
                  <span className="hx-challenge__name">{c.name}</span>
                  <span className="hx-challenge__meta">
                    {!unlocked ? <Lock aria-hidden="true" /> : completed[c.id] ? <Check aria-hidden="true" /> : null}
                    {c.target} fichas · {c.colors} colores
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

function Play({ mode, frame, record, onMenu, onRules }) {
  const session = useGameSession(GAME_ID);
  const audio = useGameAudio();
  const [round, setRound] = useState(0);
  const [state, setState] = useState(() => createGame(mode, Date.now()));
  const [selected, setSelected] = useState(0);
  const [preview, setPreview] = useState(null); // clave de celda
  const [fx, setFx] = useState({ flash: new Set(), merged: new Set(), key: 0 });
  const [result, setResult] = useState(null);
  const drag = useRef(null);
  const { start, finish } = session;

  useEffect(() => {
    start();
  }, [start, round]);
  useInProgress(!result && state.moves > 0);
  usePauseOnInterrupt(session.pause);

  useEffect(() => {
    if (!fx.flash.size && !fx.merged.size) return undefined;
    const timer = setTimeout(() => setFx((f) => ({ ...f, flash: new Set(), merged: new Set() })), 450);
    return () => clearTimeout(timer);
  }, [fx]);

  const end = useCallback(
    async (final) => {
      const key = `score:${mode.id}`;
      const won = final.status === 'won';
      setResult({ won, saving: true });
      const saved = await finish({
        completed: won || mode.target === null,
        marks: [{ key, value: final.score, better: 'higher' }],
        progress: (p) => ({
          ...p,
          groups: (p.groups ?? 0) + final.groups,
          maxStreak: Math.max(p.maxStreak ?? 0, final.bestStreak),
          completed: won ? { ...(p.completed ?? {}), [mode.id]: true } : (p.completed ?? {}),
        }),
      });
      setResult({ won, saving: false, mark: saved.marks[key] });
    },
    [finish, mode],
  );

  const playing = session.isPlaying && !result;
  const commit = useCallback(
    (key) => {
      if (!playing) return;
      const outcome = place(state, selected, key);
      if (!outcome) return;
      const { events } = outcome;
      const clears = events.filter((e) => e.type === 'clear');
      const merges = events.filter((e) => e.type === 'merge');
      audio.play(clears.length ? SFX.clear : merges.length ? SFX.merge : SFX.place);
      setFx({ flash: new Set(clears.map((e) => e.key)), merged: new Set(merges.map((e) => e.to)), key: Date.now() });
      setState(outcome.state);
      setPreview(null);
      setSelected(0);
      if (outcome.state.status !== 'playing') {
        if (outcome.state.status === 'over') audio.play(SFX.over);
        end(outcome.state);
      }
    },
    [playing, state, selected, audio, end],
  );

  /** Ratón: un clic coloca. Toque: el primer toque previsualiza, el segundo en la misma celda coloca. */
  const lastPointer = useRef('mouse');
  const onCell = (key) => {
    if (!playing || state.board[key]?.length) return;
    if (lastPointer.current === 'mouse' || preview === key) commit(key);
    else setPreview(key);
  };

  // Arrastrar una pila de la mano al tablero (el punto bajo el dedo marca la celda).
  const cellAt = (x, y) => document.elementFromPoint(x, y)?.closest?.('[data-cell]')?.dataset.cell ?? null;
  const onTrayDown = (event, index) => {
    if (!playing) return;
    lastPointer.current = event.pointerType;
    setSelected(index);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
  };
  const onTrayMove = (event) => {
    const d = drag.current;
    if (!d || d.id !== event.pointerId) return;
    if (Math.hypot(event.clientX - d.x, event.clientY - d.y) > 12) d.moved = true;
    if (!d.moved) return;
    const key = cellAt(event.clientX, event.clientY);
    setPreview(key && !state.board[key]?.length ? key : null);
  };
  const onTrayUp = (event) => {
    const d = drag.current;
    if (!d || d.id !== event.pointerId) return;
    drag.current = null;
    if (!d.moved) return;
    const key = cellAt(event.clientX, event.clientY);
    if (key && !state.board[key]?.length) commit(key);
    else setPreview(null);
  };

  useKeyboard({
    active: !result,
    onAction: (action) => {
      if (action === 'pause') session.togglePause();
    },
  });
  useEffect(() => {
    const onKey = (event) => {
      if (['1', '2', '3'].includes(event.key) && state.hand[Number(event.key) - 1]) setSelected(Number(event.key) - 1);
      else if ((event.key === 'r' || event.key === 'R') && !event.ctrlKey && !event.metaKey) restart();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const restart = () => {
    session.reset();
    setState(createGame(mode, Date.now()));
    setSelected(0);
    setPreview(null);
    setResult(null);
    setRound((r) => r + 1);
  };

  const best = record?.best?.[`score:${mode.id}`];
  return (
    <div className="hx-play game-scroll" onPointerDownCapture={(event) => (lastPointer.current = event.pointerType)}>
      <GameHUD
        onPause={session.togglePause}
        paused={session.isPaused}
        pauseDisabled={Boolean(result)}
        items={[
          { id: 'score', label: 'Puntos', value: state.score.toLocaleString('es') },
          mode.target !== null
            ? { id: 'target', label: 'Despejadas', value: `${Math.min(state.cleared, mode.target)}/${mode.target}`, tone: state.cleared >= mode.target ? 'good' : undefined }
            : { id: 'best', label: 'Récord', value: Number.isFinite(best) ? best.toLocaleString('es') : '—', tone: Number.isFinite(best) && state.score > best ? 'good' : undefined },
          { id: 'streak', label: 'Racha', value: state.streak ? `×${state.streak}` : '—', tone: state.streak >= 2 ? 'good' : undefined },
        ]}
      />
      <div className="hx-layout">
        <div className="hx-board-wrap" onPointerLeave={() => lastPointer.current === 'mouse' && setPreview(null)}>
          <HexBoard
            state={state}
            preview={preview ? { key: preview, stack: state.hand[selected] } : null}
            flash={fx.flash}
            merged={fx.merged}
            onCell={onCell}
            onCellHover={(key) => playing && !state.board[key].length && setPreview(key)}
          />
        </div>
        <div className="hx-side">
          <p className="hx-hint" role="status" aria-live="polite">
            {preview && lastPointer.current !== 'mouse' ? 'Toca otra vez la celda para colocar la pila.' : 'Elige una pila y colócala en una celda vacía.'}
          </p>
          <div className="hx-tray" role="group" aria-label="Pilas disponibles">
            {state.hand.map((stack, i) => (
              <button
                key={`${round}-${state.moves}-${i}`}
                type="button"
                className={cx('hx-piece', i === selected && 'is-selected')}
                aria-pressed={i === selected}
                aria-label={`Pila ${i + 1}: ${stack.length} fichas`}
                disabled={!playing}
                onClick={() => setSelected(i)}
                onPointerDown={(event) => onTrayDown(event, i)}
                onPointerMove={onTrayMove}
                onPointerUp={onTrayUp}
                onPointerCancel={() => (drag.current = null)}
              >
                <svg viewBox="-30 -50 60 66" aria-hidden="true">
                  <Stack stack={stack} cx={0} cy={0} scale={1} />
                </svg>
              </button>
            ))}
          </div>
          <div className="hx-actions">
            <Button variant="ghost" size="sm" icon={BookOpen} onClick={onRules}>
              Reglas
            </Button>
            <Button variant="ghost" size="sm" icon={RotateCcw} onClick={restart} disabled={Boolean(result)}>
              Reiniciar
            </Button>
            <Button variant="ghost" size="sm" icon={ListOrdered} onClick={onMenu}>
              Modos
            </Button>
          </div>
        </div>
      </div>
      {session.isPaused && !result && <PauseMenu onResume={session.resume} onRestart={restart} onExit={frame.exit} />}
      {result && (
        <GameResults
          outcome={result.won ? 'win' : 'end'}
          eyebrow={result.won ? '¡Desafío superado!' : 'Tablero lleno'}
          title={`${state.score.toLocaleString('es')} puntos`}
          message={
            mode.target !== null && !result.won
              ? `Despejaste ${state.cleared} de ${mode.target} fichas. Busca fusiones antes de llenar los huecos.`
              : `${state.groups} ${state.groups === 1 ? 'grupo despejado' : 'grupos despejados'}, racha máxima ×${state.bestStreak}.`
          }
          saving={result.saving}
          stats={[
            {
              label: 'Puntos',
              value: state.score.toLocaleString('es'),
              record: result.mark?.isRecord && result.mark.previous !== null,
              best: result.mark && !result.mark.isRecord ? result.mark.best.toLocaleString('es') : null,
            },
            { label: 'Fichas despejadas', value: String(state.cleared) },
            { label: 'Racha máxima', value: `×${state.bestStreak}` },
          ]}
          onReplay={restart}
          extraActions={
            <Button variant="secondary" icon={ListOrdered} onClick={onMenu}>
              Modos
            </Button>
          }
          onExit={frame.exit}
        />
      )}
    </div>
  );
}

/** HexaStack: modos (libre y desafíos), reglas y partida. */
export default function HexaStack() {
  const frame = useGameFrame();
  const record = useGameRecord(GAME_ID);
  const [mode, setMode] = useState(null);
  const [rules, setRules] = useState(false);
  const seenRules = record?.settings?.seenRules;

  const pick = (m) => {
    // Antes de la primera partida se muestran las reglas.
    if (!seenRules) setRules(true);
    setMode(m);
  };
  const closeRules = () => {
    setRules(false);
    if (!seenRules) updateGameSettings(GAME_ID, { seenRules: true }).catch(() => {});
  };

  return (
    <>
      {mode ? (
        <Play key={mode.id} mode={mode} frame={frame} record={record} onMenu={() => setMode(null)} onRules={() => setRules(true)} />
      ) : (
        <ModeSelect record={record} onPick={pick} onRules={() => setRules(true)} />
      )}
      <Dialog open={rules} title="Cómo se juega a HexaStack" onClose={closeRules}>
        <HexRules />
        <Button onClick={closeRules}>Entendido</Button>
      </Dialog>
    </>
  );
}
