import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Delete, Lightbulb, ListChecks, Pencil, Play as PlayIcon, RotateCcw, Undo2 } from 'lucide-react';
import { Button } from '../../../../components/common/Button.jsx';
import { ConfirmDialog } from '../../../../components/common/Dialog.jsx';
import { GameHUD } from '../../components/GameHUD.jsx';
import { PauseMenu } from '../../components/GameOverlay.jsx';
import { GameResults } from '../../components/GameResults.jsx';
import { useGameSession } from '../../hooks/useGameSession.js';
import { useGameRecord } from '../../hooks/useGameStatistics.js';
import { useGameAudio } from '../../hooks/useGameAudio.js';
import { useGameFrame, useInProgress, usePauseOnInterrupt } from '../../hooks/useGameFrame.js';
import { useKeyboard } from '../../hooks/useKeyboard.js';
import { formatTime } from '../../services/gameLifecycle.js';
import { updateGameSettings } from '../../services/gameStorage.js';
import { cx } from '../../../../utils/cx.js';
import { DIFFICULTIES, boxOf, colOf, conflicts, hasNote, rowOf } from './engine/sudokuEngine.js';
import { MAX_HINTS, applyHint, check, counts, createGame, erase, fromSaved, isGiven, isWon, newPuzzle, setValue, toSaved, toggleNoteAt, undo } from './engine/sudokuGame.js';
import './styles/sudokus.css';

const GAME_ID = 'sudokus';
const SFX = {
  place: { wave: 'triangle', from: 620, to: 700, dur: 0.06, gain: 0.07 },
  note: { wave: 'sine', from: 900, dur: 0.04, gain: 0.04 },
  conflict: { wave: 'square', from: 200, to: 160, dur: 0.12, gain: 0.06 },
  win: [
    { wave: 'triangle', from: 523, dur: 0.14, gain: 0.14 },
    { wave: 'triangle', from: 659, dur: 0.14, gain: 0.14, delay: 0.12 },
    { wave: 'triangle', from: 784, dur: 0.3, gain: 0.14, delay: 0.24 },
  ],
};
const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const nameOf = (id) => DIFFICULTIES.find((d) => d.id === id)?.name ?? id;

function DifficultyPick({ record, saved, onNew, onResume }) {
  const solved = record?.progress?.solved ?? {};
  const best = record?.best ?? {};
  return (
    <div className="sd-pick game-scroll">
      <header>
        <p className="eyebrow">Sudokus</p>
        <h2 className="sd-pick__title">Elige la dificultad</h2>
        <p className="sd-pick__text">Todos los tableros tienen solución única. La dificultad la marca la técnica que hace falta para resolverlo.</p>
      </header>
      {saved && (
        <div className="sd-resume">
          <p>
            Tienes un Sudoku <strong>{nameOf(saved.game.difficulty)}</strong> a medias ({formatTime(saved.elapsedMs, { decimals: 0 })}).
          </p>
          <Button icon={PlayIcon} onClick={onResume}>
            Continuar partida
          </Button>
        </div>
      )}
      <ul className="sd-levels">
        {DIFFICULTIES.map((level) => (
          <li key={level.id}>
            <button type="button" className={cx('sd-level', `sd-level--${level.id}`)} onClick={() => onNew(level.id)}>
              <span className="sd-level__name">{level.name}</span>
              <span className="sd-level__technique">{level.technique}</span>
              <span className="sd-level__stats">
                {solved[level.id] ? `${solved[level.id]} resueltos · mejor ${formatTime(best[`time:${level.id}`], { decimals: 0 })}` : 'Sin resolver todavía'}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Board({ game, selected, wrong, paused, onSelect }) {
  const clash = useMemo(() => conflicts(game.board), [game.board]);
  const sel = selected >= 0 ? { r: rowOf(selected), c: colOf(selected), b: boxOf(selected), v: game.board[selected] } : null;
  return (
    <div className={cx('sd-board', paused && 'is-paused')} role="grid" aria-label="Tablero de Sudoku">
      {Array.from({ length: 9 }, (_, r) => (
        <div key={r} role="row" className="sd-row">
          {Array.from({ length: 9 }, (_, c) => {
            const i = r * 9 + c;
            const v = game.board[i];
            const given = isGiven(game, i);
            const related = sel && (sel.r === r || sel.c === c || sel.b === boxOf(i));
            return (
              <div key={c} role="gridcell" className="sd-cell-wrap">
                <button
                  type="button"
                  className={cx(
                    'sd-cell',
                    given && 'is-given',
                    i === selected && 'is-selected',
                    related && 'is-related',
                    sel?.v && v === sel.v && 'is-same',
                    clash.has(i) && 'is-conflict',
                    wrong.has(i) && 'is-wrong',
                  )}
                  tabIndex={i === Math.max(0, selected) ? 0 : -1}
                  aria-label={`Fila ${r + 1}, columna ${c + 1}: ${v ? `${v}${given ? ', fija' : ''}` : 'vacía'}${clash.has(i) ? ', se repite' : ''}`}
                  onClick={() => onSelect(i)}
                >
                  {v ? (
                    <span className="sd-cell__value">{v}</span>
                  ) : game.notes[i] ? (
                    <span className="sd-notes" aria-hidden="true">
                      {DIGITS.map((d) => (
                        <span key={d}>{hasNote(game.notes[i], d) ? d : ''}</span>
                      ))}
                    </span>
                  ) : null}
                </button>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function Play({ initial, frame, record, onMenu }) {
  const session = useGameSession(GAME_ID);
  const audio = useGameAudio();
  const [game, setGame] = useState(initial.game);
  const [selected, setSelected] = useState(() => initial.game.board.findIndex((v) => !v));
  const [notesMode, setNotesMode] = useState(false);
  const [wrong, setWrong] = useState(new Set());
  const [notice, setNotice] = useState(null);
  const [clock, setClock] = useState(initial.elapsedMs);
  const [result, setResult] = useState(null);
  const [confirm, setConfirm] = useState(null); // 'restart' | 'new'
  const offset = useRef(initial.elapsedMs);
  const { start, finish, elapsedMs } = session;
  // Estable (no depende del objeto de sesión, que cambia en cada render): el reloj no se reinicia con cada toque.
  const elapsed = useCallback(() => offset.current + elapsedMs(), [elapsedMs]);

  useEffect(() => {
    start();
  }, [start]);
  useInProgress(!result);
  usePauseOnInterrupt(session.pause);

  // Reloj: un tic por segundo solo mientras se juega.
  useEffect(() => {
    if (!session.isPlaying) return undefined;
    const timer = setInterval(() => setClock(elapsed()), 500);
    return () => clearInterval(timer);
  }, [session.isPlaying, elapsed]);

  // Guardado de la partida en curso (se puede seguir otro día), agrupado.
  useEffect(() => {
    if (result) return undefined;
    const timer = setTimeout(() => updateGameSettings(GAME_ID, { current: toSaved(game, elapsed()) }).catch(() => {}), 600);
    return () => clearTimeout(timer);
  }, [game, result, elapsed]);
  const latest = useRef({ game, result, elapsed });
  latest.current = { game, result, elapsed };
  useEffect(
    () => () => {
      const { game: g, result: r, elapsed: e } = latest.current;
      if (!r) updateGameSettings(GAME_ID, { current: toSaved(g, e()) }).catch(() => {});
    },
    [],
  );

  const win = useCallback(
    async (next) => {
      audio.play(SFX.win);
      const timeMs = Math.round(elapsed());
      setResult({ timeMs, saving: true });
      updateGameSettings(GAME_ID, { current: null, difficulty: next.difficulty }).catch(() => {});
      const saved = await finish({
        completed: true,
        marks: [{ key: `time:${next.difficulty}`, value: timeMs, better: 'lower' }],
        progress: (p) => ({ ...p, solved: { ...(p.solved ?? {}), [next.difficulty]: (p.solved?.[next.difficulty] ?? 0) + 1 } }),
      });
      setResult({ timeMs, saving: false, mark: saved.marks[`time:${next.difficulty}`] });
    },
    [audio, elapsed, finish],
  );

  const commit = useCallback(
    (next, sound) => {
      if (next === game) return;
      setGame(next);
      setWrong(new Set());
      if (isWon(next)) win(next);
      else if (sound) audio.play(sound);
    },
    [game, win, audio],
  );

  const playing = session.isPlaying && !result;
  const input = useCallback(
    (value) => {
      if (!playing || selected < 0) return;
      if (isGiven(game, selected)) {
        setNotice('Esa casilla es del enunciado: no se puede cambiar.');
        return;
      }
      setNotice(null);
      if (notesMode) return commit(toggleNoteAt(game, selected, value), SFX.note);
      const next = setValue(game, selected, value);
      commit(next, conflicts(next.board).has(selected) ? SFX.conflict : SFX.place);
    },
    [playing, selected, game, notesMode, commit],
  );

  const clear = () => playing && selected >= 0 && commit(erase(game, selected));
  const back = () => playing && commit(undo(game));
  const hint = () => {
    if (!playing) return;
    const outcome = applyHint(game, selected);
    if (outcome.cell === -1) return setNotice(game.hints >= MAX_HINTS ? 'Ya no quedan pistas en esta partida.' : 'No hay casillas que necesiten pista.');
    setSelected(outcome.cell);
    setNotice(`Pista: fila ${rowOf(outcome.cell) + 1}, columna ${colOf(outcome.cell) + 1}.`);
    commit(outcome.game, SFX.place);
  };
  const verify = () => {
    if (!playing) return;
    const outcome = check(game);
    setGame(outcome.game);
    setWrong(new Set(outcome.wrong));
    setNotice(outcome.wrong.length ? `${outcome.wrong.length} ${outcome.wrong.length === 1 ? 'respuesta no encaja' : 'respuestas no encajan'} con la solución (marcadas).` : 'Todo lo que has escrito es correcto.');
  };

  // Teclado: flechas mueven la selección; números escriben; N alterna notas.
  useKeyboard({
    active: !result,
    onAction: (action) => {
      if (action === 'pause') session.togglePause();
      const delta = { up: -9, down: 9, left: -1, right: 1 }[action];
      if (delta === undefined) return;
      setSelected((s) => {
        const from = Math.max(0, s);
        if ((action === 'left' && colOf(from) === 0) || (action === 'right' && colOf(from) === 8)) return from;
        const to = from + delta;
        return to < 0 || to > 80 ? from : to;
      });
    },
  });
  useEffect(() => {
    const onKey = (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.target instanceof HTMLElement && ['INPUT', 'TEXTAREA'].includes(event.target.tagName)) return;
      if (/^[1-9]$/.test(event.key)) {
        event.preventDefault();
        input(Number(event.key));
      } else if (['Backspace', 'Delete', '0'].includes(event.key)) {
        event.preventDefault();
        clear();
      } else if (event.key === 'n' || event.key === 'N') setNotesMode((m) => !m);
      else if (event.key === 'z' || event.key === 'Z') back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const placed = counts(game);
  const restart = () => {
    setGame(createGame(game.difficulty, game.puzzle));
    setWrong(new Set());
    setNotice(null);
    setConfirm(null);
  };

  return (
    <div className="sd-play game-scroll">
      <GameHUD
        onPause={session.togglePause}
        paused={session.isPaused}
        pauseDisabled={Boolean(result)}
        items={[
          { id: 'level', label: 'Dificultad', value: nameOf(game.difficulty) },
          { id: 'time', label: 'Tiempo', value: formatTime(clock, { decimals: 0 }) },
          { id: 'hints', label: 'Pistas', value: `${MAX_HINTS - game.hints}/${MAX_HINTS}` },
        ]}
      />
      <div className="sd-layout">
        <Board game={game} selected={selected} wrong={wrong} paused={session.isPaused} onSelect={(i) => setSelected(i)} />
        <div className="sd-controls">
          <div className="sd-pad" role="group" aria-label="Números">
            {DIGITS.map((d) => (
              <button
                key={d}
                type="button"
                className={cx('sd-key', notesMode && 'is-note')}
                disabled={!playing || (placed[d] >= 9 && !notesMode)}
                onClick={() => input(d)}
                aria-label={`${notesMode ? 'Nota' : 'Escribir'} ${d}${placed[d] >= 9 ? ', completo' : ''}`}
              >
                <span>{d}</span>
                <small aria-hidden="true">{Math.max(0, 9 - placed[d]) || ''}</small>
              </button>
            ))}
          </div>
          <div className="sd-tools">
            <button type="button" className={cx('sd-tool', notesMode && 'is-on')} aria-pressed={notesMode} onClick={() => setNotesMode((m) => !m)} disabled={!playing}>
              <Pencil aria-hidden="true" /> Notas
            </button>
            <button type="button" className="sd-tool" onClick={clear} disabled={!playing}>
              <Delete aria-hidden="true" /> Borrar
            </button>
            <button type="button" className="sd-tool" onClick={back} disabled={!playing || !game.history.length}>
              <Undo2 aria-hidden="true" /> Deshacer
            </button>
            <button type="button" className="sd-tool" onClick={hint} disabled={!playing || game.hints >= MAX_HINTS}>
              <Lightbulb aria-hidden="true" /> Pista
            </button>
            <button type="button" className="sd-tool" onClick={verify} disabled={!playing}>
              <ListChecks aria-hidden="true" /> Comprobar
            </button>
          </div>
          <p className="sd-notice" role="status" aria-live="polite">
            {notice ?? (notesMode ? 'Modo notas: los números se apuntan a lápiz.' : '')}
          </p>
          <div className="sd-actions">
            <Button variant="ghost" size="sm" icon={RotateCcw} onClick={() => setConfirm('restart')} disabled={Boolean(result)}>
              Reiniciar
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirm('new')} disabled={Boolean(result)}>
              Otro Sudoku
            </Button>
          </div>
        </div>
      </div>

      {session.isPaused && !result && <PauseMenu onResume={session.resume} onRestart={() => setConfirm('restart')} onExit={frame.exit} />}
      <ConfirmDialog
        open={confirm !== null}
        title={confirm === 'new' ? '¿Empezar otro Sudoku?' : '¿Reiniciar este Sudoku?'}
        description={confirm === 'new' ? 'Se abandonará este tablero.' : 'Se borrarán tus respuestas y notas; el tiempo sigue contando.'}
        confirmLabel={confirm === 'new' ? 'Otro Sudoku' : 'Reiniciar'}
        cancelLabel="Seguir"
        onConfirm={() => {
          if (confirm === 'new') {
            updateGameSettings(GAME_ID, { current: null }).catch(() => {});
            latest.current.result = true;
            onMenu();
          } else restart();
        }}
        onCancel={() => setConfirm(null)}
      />
      {result && (
        <GameResults
          outcome="win"
          eyebrow={`Sudoku ${nameOf(game.difficulty).toLowerCase()} resuelto`}
          title={formatTime(result.timeMs, { decimals: 0 })}
          message={game.hints ? `Con ${game.hints} ${game.hints === 1 ? 'pista' : 'pistas'}.` : 'Sin pistas.'}
          saving={result.saving}
          stats={[
            {
              label: 'Tiempo',
              value: formatTime(result.timeMs, { decimals: 0 }),
              record: result.mark?.isRecord && result.mark.previous !== null,
              best: result.mark && !result.mark.isRecord ? formatTime(result.mark.best, { decimals: 0 }) : null,
            },
            { label: 'Resueltos', value: String((record?.progress?.solved?.[game.difficulty] ?? 0) + (result.saving ? 1 : 0)) },
          ]}
          onReplay={onMenu}
          replayLabel="Otro Sudoku"
          onExit={frame.exit}
        />
      )}
    </div>
  );
}

/** Sudokus: elección de dificultad (o reanudar) y partida. */
export default function Sudokus() {
  const frame = useGameFrame();
  const record = useGameRecord(GAME_ID);
  const [current, setCurrent] = useState(null);
  const [round, setRound] = useState(0);
  const saved = useMemo(() => (record?.settings?.current ? fromSaved(record.settings.current) : null), [record?.settings?.current]);

  if (!current) {
    return (
      <DifficultyPick
        record={record}
        saved={saved}
        onResume={() => {
          setCurrent(saved);
          setRound((r) => r + 1);
        }}
        onNew={(difficulty) => {
          setCurrent({ game: createGame(difficulty, newPuzzle(difficulty)), elapsedMs: 0 });
          setRound((r) => r + 1);
        }}
      />
    );
  }
  return <Play key={round} initial={current} record={record} frame={frame} onMenu={() => setCurrent(null)} />;
}
