import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronRight, CornerLeftUp, CornerRightUp, ListOrdered, Lock, RotateCcw, Undo2 } from 'lucide-react';
import { Button } from '../../../../components/common/Button.jsx';
import { GameHUD } from '../../components/GameHUD.jsx';
import { GameOverlay, PauseMenu } from '../../components/GameOverlay.jsx';
import { GameResults } from '../../components/GameResults.jsx';
import { useGameSession } from '../../hooks/useGameSession.js';
import { useGameAudio } from '../../hooks/useGameAudio.js';
import { useInProgress, usePauseOnInterrupt } from '../../hooks/useGameFrame.js';
import { cx } from '../../../../utils/cx.js';
import { HEROES, HERO_IDS, act, cellAt, createDuoState, isWon, openDoors, parseDuo } from './engine/duoEngine.js';
import { DUO_LEVELS } from './levels/duoLevels.js';
import './styles/duo.css';

const SFX = {
  step: { wave: 'triangle', from: 420, to: 520, dur: 0.06, gain: 0.05 },
  jump: { wave: 'sine', from: 300, to: 760, dur: 0.16, gain: 0.07 },
  bump: { wave: 'square', from: 160, to: 120, dur: 0.08, gain: 0.04 },
  door: { wave: 'triangle', from: 220, to: 330, dur: 0.18, gain: 0.06 },
  hiss: { noise: true, from: 2400, to: 600, dur: 0.5, gain: 0.07 },
  win: [
    { wave: 'triangle', from: 523, dur: 0.14, gain: 0.12 },
    { wave: 'triangle', from: 784, dur: 0.14, gain: 0.12, delay: 0.12 },
    { wave: 'triangle', from: 1047, dur: 0.3, gain: 0.12, delay: 0.24 },
  ],
};
const KEYMAP = {
  // Brasa: A D W · Gota: flechas
  a: ['brasa', 'left'],
  d: ['brasa', 'right'],
  w: ['brasa', 'jump'],
  q: ['brasa', 'jumpLeft'],
  e: ['brasa', 'jumpRight'],
  ArrowLeft: ['gota', 'left'],
  ArrowRight: ['gota', 'right'],
  ArrowUp: ['gota', 'jump'],
};
const TILE = { '#': 'rock', '.': 'air', L: 'lava', W: 'water', G: 'acid', a: 'plate', b: 'plate', A: 'door', B: 'door', E: 'exit-brasa', F: 'exit-gota' };
const starsFor = (moves, par) => (moves <= par ? 3 : moves <= Math.ceil(par * 1.4) ? 2 : 1);
const starsText = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);
export const duoUnlocked = (index, done) => index === 0 || Boolean(done[DUO_LEVELS[index - 1].id]);

export function DuoSelect({ done, onPick }) {
  return (
    <>
      <p className="lv-select__text">
        Brasa (de lava) y Gota (de agua) cruzan juntos una cueva: cada uno resiste su elemento y se apaga en el del otro. Pisad placas, subíos el uno encima del otro y llegad
        cada cual a su puerta.
      </p>
      <ol className="lv-levels">
        {DUO_LEVELS.map((level, i) => {
          const unlocked = duoUnlocked(i, done);
          const s = done[level.id] ?? 0;
          return (
            <li key={level.id}>
              <button
                type="button"
                className={cx('lv-level', 'is-duo', s && 'is-done')}
                disabled={!unlocked}
                onClick={() => onPick(i)}
                aria-label={`Dúo ${i + 1}: ${level.name}.${s ? ` Superado con ${s} de 3 estrellas.` : ''}${unlocked ? '' : ' Bloqueado: supera el anterior.'}`}
              >
                <span className="lv-level__n">{i + 1}</span>
                <span className="lv-level__body">
                  <strong>{level.name}</strong>
                  <small>{s ? starsText(s) : level.tutorial ? 'Tutorial' : 'Cooperación'}</small>
                </span>
                {!unlocked ? <Lock aria-hidden="true" /> : s ? <Check aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
              </button>
            </li>
          );
        })}
      </ol>
    </>
  );
}

function Hero({ id, pos, trail, active, dead, won }) {
  const ms = Math.min(520, 90 + trail * 60);
  return (
    <i
      className={cx('duo-hero', `is-${id}`, active && 'is-active', dead && 'is-dead', won && 'is-won')}
      style={{ '--px': pos[1], '--py': pos[0], '--move-ms': `${ms}ms` }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 100 100">
        {id === 'brasa' ? (
          <path d="M50 6 C60 26 82 34 80 62 C78 84 64 94 50 94 C36 94 22 84 20 62 C19 46 30 40 34 26 C40 36 44 38 46 30 C48 22 46 14 50 6 Z" fill="#ff7a1a" stroke="#c2410c" strokeWidth="4" />
        ) : (
          <path d="M50 6 C62 26 82 44 82 64 C82 82 68 94 50 94 C32 94 18 82 18 64 C18 44 38 26 50 6 Z" fill="#3fa7ff" stroke="#1d5fae" strokeWidth="4" />
        )}
        <ellipse cx="38" cy="60" rx="7" ry="9" fill="#fff" />
        <ellipse cx="62" cy="60" rx="7" ry="9" fill="#fff" />
        <circle cx="39" cy="62" r="4" fill="#1d1d24" />
        <circle cx="63" cy="62" r="4" fill="#1d1d24" />
        <path d={won ? 'M38 76 Q50 88 62 76' : 'M42 78 Q50 83 58 78'} fill="none" stroke="#1d1d24" strokeWidth="4" strokeLinecap="round" />
      </svg>
    </i>
  );
}

export function DuoPlay({ index, gameId, onMenu, onNext, frame }) {
  const level = DUO_LEVELS[index];
  const board = useMemo(() => parseDuo(level), [level]);
  const session = useGameSession(gameId);
  const audio = useGameAudio();
  const [state, setState] = useState(() => createDuoState(board));
  const [history, setHistory] = useState([]);
  const [active, setActive] = useState('brasa');
  const [facing, setFacing] = useState({ brasa: 'right', gota: 'right' });
  const [trail, setTrail] = useState({ brasa: 0, gota: 0 });
  const [notice, setNotice] = useState(null);
  const [result, setResult] = useState(null);
  const { start, finish } = session;
  const won = isWon(board, state);
  const open = openDoors(board, state.heroes);

  useEffect(() => {
    start();
  }, [start]);
  useInProgress(!result && history.length > 0);
  usePauseOnInterrupt(session.pause);

  const playing = session.isPlaying && !result && !state.dead;

  const move = useCallback(
    (hero, kind) => {
      if (!playing || won) return;
      setActive(hero);
      const explicit = kind === 'jumpLeft' || kind === 'jumpRight';
      const jumping = kind === 'jump' || explicit;
      const action = explicit ? kind : kind === 'jump' ? (facing[hero] === 'left' ? 'jumpLeft' : 'jumpRight') : kind;
      const nextFacing = action === 'left' || action === 'jumpLeft' ? 'left' : 'right';
      setFacing((f) => ({ ...f, [hero]: nextFacing }));
      const out = act(board, state, hero, action);
      if (!out) {
        audio.play(SFX.bump);
        setNotice({ key: Date.now(), text: jumping ? `${HEROES[hero].name} no puede saltar desde ahí (hace falta pisar algo firme y tener hueco).` : `${HEROES[hero].name} no puede pasar por ahí.` });
        return;
      }
      const before = openDoors(board, state.heroes);
      const after = openDoors(board, out.state.heroes);
      audio.play(jumping ? SFX.jump : SFX.step);
      if (before.size !== after.size) audio.play({ ...SFX.door, delay: 0.1 });
      setHistory((h) => [...h, state]);
      setState(out.state);
      setTrail({ brasa: out.trail.brasa.length, gota: out.trail.gota.length });
      setNotice(null);
      if (out.state.dead) {
        audio.play({ ...SFX.hiss, delay: 0.2 });
        return;
      }
      if (isWon(board, out.state)) {
        const moves = history.length + 1;
        const stars = starsFor(moves, level.par);
        audio.play({ ...SFX.win, delay: 0.3 });
        setResult({ moves, stars, saving: true });
        finish({
          completed: true,
          marks: [{ key: `duo:${level.id}`, value: moves, better: 'lower' }],
          progress: (p) => ({ ...p, duo: { ...(p.duo ?? {}), [level.id]: Math.max(p.duo?.[level.id] ?? 0, stars) } }),
        }).then((saved) => setResult({ moves, stars, saving: false, mark: saved.marks?.[`duo:${level.id}`] }));
      }
    },
    [playing, won, facing, board, state, audio, history.length, level, finish],
  );

  const undo = useCallback(() => {
    if (!history.length || result) return;
    setState(history.at(-1));
    setHistory((h) => h.slice(0, -1));
    setTrail({ brasa: 1, gota: 1 });
    setNotice(null);
  }, [history, result]);
  const restart = useCallback(() => {
    setState(createDuoState(board));
    setHistory([]);
    setNotice(null);
    setTrail({ brasa: 0, gota: 0 });
  }, [board]);

  // Teclado propio: A/D/W y las flechas mueven a personajes distintos (useKeyboard no los distingue).
  useEffect(() => {
    if (result) return undefined;
    const onKey = (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return;
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      if (key === 'Escape' || key === 'p') {
        session.togglePause();
        return;
      }
      if (session.isPaused) return;
      if (key === 'z' || key === 'Backspace') return undo();
      if (key === 'r') return restart();
      const map = KEYMAP[key];
      if (map) {
        event.preventDefault();
        if (!event.repeat) move(map[0], map[1]);
      }
      return undefined;
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [move, undo, restart, result, session]);

  const cells = [];
  for (let r = 0; r < board.height; r += 1) {
    for (let c = 0; c < board.width; c += 1) {
      const ch = cellAt(board, r, c);
      const kind = TILE[ch] ?? 'air';
      const pressed = (ch === 'a' || ch === 'b') && open.has(ch.toUpperCase());
      cells.push(
        <span
          key={`${r}-${c}`}
          className={cx('duo-cell', `is-${kind}`, kind === 'door' && open.has(ch) && 'is-open', pressed && 'is-pressed', kind === 'rock' && cellAt(board, r - 1, c) !== '#' && 'has-top')}
          data-letter={kind === 'door' || kind === 'plate' ? ch.toUpperCase() : undefined}
        />,
      );
    }
  }

  return (
    <div className="lv-play duo-play game-scroll">
      <GameHUD
        onPause={session.togglePause}
        paused={session.isPaused}
        pauseDisabled={Boolean(result)}
        items={[
          { id: 'level', label: `Dúo ${index + 1}`, value: level.name, wide: true },
          { id: 'moves', label: 'Movimientos', value: String(history.length), tone: history.length > level.par ? 'warn' : undefined },
          { id: 'par', label: 'Mínimo', value: String(level.par) },
        ]}
      />
      <div className="duo-wrap">
        <div
          className="duo-board"
          role="img"
          style={{ '--cols': board.width, '--rows': board.height }}
          aria-label={`Cueva de ${board.width} por ${board.height}. Brasa en la columna ${state.heroes.brasa[1] + 1}, fila ${state.heroes.brasa[0] + 1}; Gota en la columna ${state.heroes.gota[1] + 1}, fila ${state.heroes.gota[0] + 1}.`}
        >
          {cells}
          {HERO_IDS.map((id) => (
            <Hero key={id} id={id} pos={state.heroes[id]} trail={trail[id]} active={active === id} dead={state.dead === id} won={won} />
          ))}
        </div>
      </div>
      <p className="lv-hint duo-notice" role="status" aria-live="polite">
        {notice ? <span key={notice.key}>{notice.text}</span> : level.hint}
      </p>
      <div className="duo-controls" data-no-gesture>
        <div className="duo-switch" role="radiogroup" aria-label="Personaje que mueven los botones">
          {HERO_IDS.map((id) => (
            <button key={id} type="button" role="radio" aria-checked={active === id} className={cx('duo-switch__btn', `is-${id}`, active === id && 'is-on')} onClick={() => setActive(id)}>
              {HEROES[id].name}
              <kbd>{id === 'brasa' ? 'A D W' : '← → ↑'}</kbd>
            </button>
          ))}
        </div>
        <div className="duo-pad" role="group" aria-label={`Mover a ${HEROES[active].name}`}>
          <button type="button" className="duo-pad__btn" onClick={() => move(active, 'left')} disabled={!playing} aria-label="Andar a la izquierda">
            <ArrowLeft aria-hidden="true" />
          </button>
          <button type="button" className="duo-pad__btn" onClick={() => move(active, 'jumpLeft')} disabled={!playing} aria-label="Saltar hacia la izquierda">
            <CornerLeftUp aria-hidden="true" />
          </button>
          <button type="button" className="duo-pad__btn" onClick={() => move(active, 'jumpRight')} disabled={!playing} aria-label="Saltar hacia la derecha">
            <CornerRightUp aria-hidden="true" />
          </button>
          <button type="button" className="duo-pad__btn" onClick={() => move(active, 'right')} disabled={!playing} aria-label="Andar a la derecha">
            <ArrowRight aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="lv-actions">
        <Button variant="secondary" size="sm" icon={Undo2} onClick={undo} disabled={!history.length || Boolean(result)}>
          Deshacer
        </Button>
        <Button variant="secondary" size="sm" icon={RotateCcw} onClick={restart} disabled={Boolean(result)}>
          Reiniciar
        </Button>
        <Button variant="ghost" size="sm" icon={ListOrdered} onClick={onMenu}>
          Niveles
        </Button>
      </div>

      {session.isPaused && !result && <PauseMenu onResume={session.resume} onRestart={restart} onExit={frame.exit} />}
      {state.dead && !result && (
        <GameOverlay
          tone="lose"
          eyebrow={state.dead === 'brasa' ? 'Brasa se ha apagado' : 'Gota se ha evaporado'}
          title="¡Cuidado con ese charco!"
          actions={
            <>
              <Button icon={Undo2} onClick={undo} data-autofocus>
                Deshacer
              </Button>
              <Button variant="secondary" icon={RotateCcw} onClick={restart}>
                Reiniciar
              </Button>
            </>
          }
        >
          <p>{state.dead === 'brasa' ? 'Brasa no resiste el agua ni el ácido.' : 'Gota no resiste la lava ni el ácido.'} Deshaz el último movimiento.</p>
        </GameOverlay>
      )}
      {result && (
        <GameResults
          outcome="win"
          eyebrow="¡Los dos a salvo!"
          title={`${level.name}: ${starsText(result.stars)}`}
          message={result.stars === 3 ? `En el mínimo: ${level.par} movimientos.` : `El mínimo posible son ${level.par} movimientos.`}
          saving={result.saving}
          stats={[
            { label: 'Movimientos', value: String(result.moves), record: result.mark?.isRecord && result.mark.previous !== null },
            { label: 'Estrellas', value: `${result.stars} de 3` },
          ]}
          onReplay={restart}
          replayLabel="Repetir"
          extraActions={
            <>
              {index + 1 < DUO_LEVELS.length && (
                <Button icon={ChevronRight} onClick={() => onNext(index + 1)}>
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
