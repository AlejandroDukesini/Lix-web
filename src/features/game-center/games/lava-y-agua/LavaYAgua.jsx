import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, ChevronRight, Hourglass, ListOrdered, Lock, RotateCcw, Undo2 } from 'lucide-react';
import { Button } from '../../../../components/common/Button.jsx';
import { GameHUD } from '../../components/GameHUD.jsx';
import { GameOverlay } from '../../components/GameOverlay.jsx';
import { GameResults } from '../../components/GameResults.jsx';
import { ControlsHint, TapButton, useSwipe, useTouchUI } from '../../components/TouchControls.jsx';
import { useGameSession } from '../../hooks/useGameSession.js';
import { useGameRecord } from '../../hooks/useGameStatistics.js';
import { useGameAudio } from '../../hooks/useGameAudio.js';
import { useGameFrame, useInProgress } from '../../hooks/useGameFrame.js';
import { useKeyboard } from '../../hooks/useKeyboard.js';
import { cx } from '../../../../utils/cx.js';
import { act, cellAt, createGame, starsFor, undo } from './engine/lavaEngine.js';
import { LEVELS, TIER_LABELS } from './levels/levels.js';
import './styles/lava-y-agua.css';

const GAME_ID = 'lava-y-agua';
const SFX = {
  step: { wave: 'triangle', from: 260, dur: 0.05, gain: 0.05 },
  wait: { wave: 'sine', from: 330, to: 300, dur: 0.12, gain: 0.05 },
  blocked: { wave: 'square', from: 120, dur: 0.06, gain: 0.04 },
  stone: { noise: true, from: 900, to: 300, dur: 0.18, gain: 0.12 },
  switch: [
    { wave: 'square', from: 300, dur: 0.06, gain: 0.06 },
    { wave: 'sine', from: 500, to: 200, dur: 0.3, gain: 0.08, delay: 0.05 },
  ],
  lose: { wave: 'sawtooth', from: 300, to: 70, dur: 0.6, gain: 0.08 },
  win: [
    { wave: 'triangle', from: 523, dur: 0.12, gain: 0.12 },
    { wave: 'triangle', from: 659, dur: 0.12, gain: 0.12, delay: 0.1 },
    { wave: 'triangle', from: 988, dur: 0.3, gain: 0.12, delay: 0.2 },
  ],
};
const CELL_NAMES = { '#': 'muro', '.': 'suelo', L: 'lava', W: 'agua', S: 'piedra', A: 'compuerta cerrada', B: 'compuerta cerrada', C: 'compuerta cerrada' };
const DIR_KEYS = { up: 'up', down: 'down', left: 'left', right: 'right' };

const stars = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);

function LevelSelect({ record, onPick }) {
  const completed = record?.progress?.completed ?? {};
  const best = record?.progress?.stars ?? {};
  return (
    <div className="lv-select game-scroll">
      <header>
        <p className="eyebrow">Lava y Agua</p>
        <h2 className="lv-select__title">Encuentra la ruta segura</h2>
        <p className="lv-select__text">
          Por cada paso que das, la lava avanza uno. El agua la enfría y la vuelve piedra. Piensa antes de moverte: puedes
          esperar, deshacer y volver a empezar.
        </p>
      </header>
      <ol className="lv-levels">
        {LEVELS.map((level, i) => {
          const unlocked = i === 0 || completed[LEVELS[i - 1].id];
          const s = best[level.id] ?? 0;
          return (
            <li key={level.id}>
              <button
                type="button"
                className={cx('lv-level', `is-${level.tier}`, completed[level.id] && 'is-done')}
                disabled={!unlocked}
                onClick={() => onPick(i)}
                aria-label={`Nivel ${i + 1}: ${level.name}. ${TIER_LABELS[level.tier]}.${completed[level.id] ? ` Superado con ${s} de 3 estrellas.` : ''}${unlocked ? '' : ' Bloqueado: supera el anterior.'}`}
              >
                <span className="lv-level__n">{i + 1}</span>
                <span className="lv-level__body">
                  <strong>{level.name}</strong>
                  <small>{completed[level.id] ? stars(s) : TIER_LABELS[level.tier]}</small>
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

/** Distancia (en casillas, sin diagonales) de la lava más cercana: feedback textual además del visual. */
function nearestLava(game) {
  const { width, height } = game.level;
  let best = Infinity;
  for (let y = 0; y < height; y += 1)
    for (let x = 0; x < width; x += 1)
      if (game.grid[y * width + x] === 'L') best = Math.min(best, Math.abs(x - game.player.x) + Math.abs(y - game.player.y));
  return best;
}

/** Personaje: un espíritu de ceniza con ojos grandes; chamuscado si la lava lo alcanza. */
function Sprite({ lost }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <ellipse cx="20" cy="36" rx="11" ry="3" fill="rgb(0 0 0 / 0.45)" />
      <path d="M20 4c3 4 1 6 4 8 6 2 10 8 10 14a14 11 0 0 1-28 0c0-6 4-12 10-14 3-2 1-4 4-8z" fill={lost ? '#5b5458' : 'url(#lv-body)'} />
      <ellipse cx="14" cy="18" rx="4" ry="3" fill="#fff" opacity={lost ? 0.15 : 0.55} />
      {lost ? (
        <path d="M12 22l4 4m0-4l-4 4M24 22l4 4m0-4l-4 4" stroke="#1d1418" strokeWidth="2.2" strokeLinecap="round" />
      ) : (
        <>
          <ellipse cx="14.5" cy="24" rx="2.6" ry="3.4" fill="#2a1420" />
          <ellipse cx="25.5" cy="24" rx="2.6" ry="3.4" fill="#2a1420" />
          <circle cx="15.3" cy="22.8" r="1" fill="#fff" />
          <circle cx="26.3" cy="22.8" r="1" fill="#fff" />
          <ellipse cx="11" cy="29" rx="2.4" ry="1.4" fill="#ff8fb3" opacity="0.7" />
          <ellipse cx="29" cy="29" rx="2.4" ry="1.4" fill="#ff8fb3" opacity="0.7" />
        </>
      )}
      <defs>
        <radialGradient id="lv-body" cx="0.38" cy="0.35" r="0.75">
          <stop offset="0" stopColor="#fffdf4" />
          <stop offset="0.55" stopColor="#ffe3b0" />
          <stop offset="1" stopColor="#f59c7a" />
        </radialGradient>
      </defs>
    </svg>
  );
}

function Board({ game, onCell, swipe }) {
  const { width, height, exit, switches, lavaEvery } = game.level;
  // Casillas que cambiaron en el último turno (o al deshacer): solo esas se animan.
  const prevGrid = useRef(game.grid.slice());
  useEffect(() => {
    prevGrid.current = game.grid.slice();
  });
  // Lava espesa: brilla con más fuerza el turno en que va a avanzar.
  const surging = lavaEvery > 1 && (game.turn + 1) % lavaEvery === 0;
  const cells = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = y * width + x;
      const c = game.grid[i];
      const isExit = exit.x === x && exit.y === y;
      const sw = switches.findIndex((s) => s.x === x && s.y === y);
      const adjacent = Math.abs(game.player.x - x) + Math.abs(game.player.y - y) === 1;
      cells.push(
        <span
          key={`${x}-${y}`}
          className={cx(
            'lv-cell',
            `is-${{ '#': 'wall', '.': 'floor', L: 'lava', W: 'water', S: 'stone' }[c] ?? 'gate'}`,
            prevGrid.current[i] !== c && 'is-new',
            c === '#' && cellAt(game, x, y + 1) !== '#' && 'has-face',
            isExit && 'is-exit',
            sw >= 0 && (game.pressed[sw] ? 'is-switch-on' : 'is-switch'),
            adjacent && game.status === 'playing' && 'is-adjacent',
          )}
          onClick={adjacent ? () => onCell(x - game.player.x, y - game.player.y) : undefined}
          aria-hidden="true"
        >
          {/[A-C]/.test(c) && <i className="lv-gate">{c}</i>}
          {sw >= 0 && <i className="lv-lever">{switches[sw].id.toLowerCase()}</i>}
        </span>,
      );
    }
  }
  const describe = () => {
    const near = nearestLava(game);
    const here = CELL_NAMES[game.grid[game.player.y * width + game.player.x]];
    return `Tablero de ${width} por ${height}. Estás sobre ${here}, en la columna ${game.player.x}, fila ${game.player.y}. La salida está en la columna ${exit.x}, fila ${exit.y}. ${Number.isFinite(near) ? `Lava más cercana a ${near} ${near === 1 ? 'casilla' : 'casillas'}.` : 'No queda lava.'}`;
  };
  return (
    <div className="lv-board-wrap" {...swipe}>
      <div
        className={cx('lv-board', lavaEvery > 1 && 'is-thick', surging && 'is-surging')}
        role="img"
        aria-label={describe()}
        style={{ '--cols': width, '--rows': height }}
      >
        {cells}
        {/* Capa propia: se desliza de casilla en casilla en vez de saltar. */}
        <i className={cx('lv-player', game.status === 'lost' && 'is-lost', game.status === 'won' && 'is-won')} style={{ '--px': game.player.x, '--py': game.player.y }}>
          <span key={game.turn} className="lv-player__hop">
            <Sprite lost={game.status === 'lost'} />
          </span>
        </i>
      </div>
    </div>
  );
}

function Play({ index, frame, onMenu, onNext }) {
  const def = LEVELS[index];
  const session = useGameSession(GAME_ID);
  const audio = useGameAudio();
  const touchUI = useTouchUI();
  const [game, setGame] = useState(() => createGame(def));
  const [, force] = useState(0);
  const [result, setResult] = useState(null);
  const { start, finish, reset } = session;

  useEffect(() => {
    start();
  }, [start]);
  useInProgress(game.status === 'playing' && game.turn > 0);

  const rerender = () => force((n) => n + 1);

  const step = useCallback(
    async (move) => {
      if (game.status !== 'playing') return;
      const { ok, events } = act(game, move);
      for (const e of events) if (SFX[e.type]) audio.play(SFX[e.type]);
      if (!ok) return;
      if (events.some((e) => e.type === 'step')) audio.play(SFX.step);
      rerender();
      if (game.status === 'lost') {
        audio.play(SFX.lose);
        navigator.vibrate?.(60);
      } else if (game.status === 'won') {
        audio.play(SFX.win);
        const turns = game.turn;
        const earned = starsFor(turns, def.par);
        setResult({ turns, stars: earned, saving: true });
        const saved = await finish({
          completed: true,
          marks: [{ key: `turns:${def.id}`, value: turns, better: 'lower' }],
          progress: (p) => ({
            ...p,
            completed: { ...(p.completed ?? {}), [def.id]: true },
            stars: { ...(p.stars ?? {}), [def.id]: Math.max(p.stars?.[def.id] ?? 0, earned) },
            stones: (p.stones ?? 0) + game.grid.filter((c) => c === 'S').length,
          }),
        });
        setResult((r) => r && { ...r, saving: false, mark: saved.marks[`turns:${def.id}`] });
      }
    },
    [game, audio, finish, def],
  );

  const doUndo = useCallback(() => {
    if (game.status === 'won') return;
    if (undo(game)) rerender();
  }, [game]);

  const restart = useCallback(() => {
    reset();
    setResult(null);
    setGame(createGame(def));
    start();
  }, [reset, start, def]);

  useKeyboard({
    active: !result,
    onAction: (action) => {
      if (DIR_KEYS[action]) step(DIR_KEYS[action]);
      else if (action === 'action') step('wait');
    },
  });

  useEffect(() => {
    if (result) return undefined;
    const onKey = (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === 'z' || event.key === 'Z' || event.key === 'Backspace') {
        event.preventDefault();
        doUndo();
      } else if (event.key === 'r' || event.key === 'R') restart();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [doUndo, restart, result]);

  const swipe = useSwipe((dir) => step(dir), { threshold: 22 });
  const near = nearestLava(game);
  const next = index + 1 < LEVELS.length ? index + 1 : null;
  const statusText =
    game.status === 'lost'
      ? game.cause === 'exit'
        ? 'La lava cubrió la salida.'
        : 'La lava te alcanzó.'
      : game.turn === 0
        ? def.hint
        : Number.isFinite(near)
          ? near <= 2
            ? `¡Cuidado! Lava a ${near} ${near === 1 ? 'casilla' : 'casillas'}.`
            : `Lava más cercana a ${near} casillas.`
          : 'La lava se ha enfriado del todo.';

  return (
    <div className={cx('lv-play', 'game-scroll', touchUI && 'has-touch')}>
      <GameHUD
        items={[
          { id: 'level', label: 'Nivel', value: `${index + 1}/${LEVELS.length}` },
          { id: 'turn', label: 'Turnos', value: String(game.turn) },
          { id: 'par', label: 'Mejor posible', value: String(def.par) },
        ]}
      />
      <p className={cx('lv-status', near <= 2 && game.status === 'playing' && 'is-warn')} role="status">
        {statusText}
      </p>
      <div className="lv-actions">
        <Button variant="secondary" size="sm" icon={Undo2} onClick={doUndo} disabled={!game.history.length || game.status === 'won'}>
          Deshacer
        </Button>
        <Button variant="ghost" size="sm" icon={RotateCcw} onClick={restart}>
          Reiniciar
        </Button>
      </div>
      <Board game={game} onCell={(dx, dy) => step(dx === 1 ? 'right' : dx === -1 ? 'left' : dy === 1 ? 'down' : 'up')} swipe={swipe} />
      {touchUI && (
        <div className="lv-pad" data-no-gesture role="group" aria-label="Movimiento">
          <TapButton label="Esperar un turno" icon={Hourglass} onPress={() => step('wait')} className="lv-btn lv-btn--wait" />
          <TapButton label="Arriba" icon={ArrowUp} onPress={() => step('up')} className="lv-btn lv-btn--up" />
          <TapButton label="Izquierda" icon={ArrowLeft} onPress={() => step('left')} className="lv-btn lv-btn--left" />
          <TapButton label="Abajo" icon={ArrowDown} onPress={() => step('down')} className="lv-btn lv-btn--down" />
          <TapButton label="Derecha" icon={ArrowRight} onPress={() => step('right')} className="lv-btn lv-btn--right" />
        </div>
      )}
      {game.turn === 0 && (
        <ControlsHint
          touch="Desliza, toca una casilla vecina o usa la cruceta · reloj: esperar"
          desktop="Flechas o WASD: moverse · Espacio: esperar · Z: deshacer · R: reiniciar"
        />
      )}
      {game.status === 'lost' && (
        <GameOverlay
          tone="lose"
          eyebrow={game.cause === 'exit' ? 'Salida perdida' : 'Demasiado cerca'}
          title={game.cause === 'exit' ? 'La lava cubrió la salida' : 'La lava te alcanzó'}
          actions={
            <>
              <Button icon={Undo2} onClick={doUndo} data-autofocus>
                Deshacer el último paso
              </Button>
              <Button variant="secondary" icon={RotateCcw} onClick={restart}>
                Reintentar
              </Button>
              <Button variant="ghost" icon={ListOrdered} onClick={onMenu}>
                Niveles
              </Button>
            </>
          }
        >
          <p>Turno {game.turn}. Deshaz y prueba otra ruta, o espera a que el agua trabaje.</p>
        </GameOverlay>
      )}
      {result && (
        <GameResults
          outcome="win"
          eyebrow="¡A salvo!"
          title={`Nivel ${index + 1} superado`}
          message={`${stars(result.stars)} — ${result.turns} turnos (lo mejor posible: ${def.par}).${next === null ? ' Has superado todos los niveles.' : ''}`}
          saving={result.saving}
          stats={[
            { label: 'Turnos', value: String(result.turns), record: result.mark?.isRecord && result.mark.previous !== null, best: result.mark && !result.mark.isRecord ? String(result.mark.best) : null },
            { label: 'Estrellas', value: `${result.stars} de 3` },
          ]}
          onReplay={restart}
          replayLabel="Repetir"
          extraActions={
            <>
              {next !== null && (
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

/** Lava y Agua: rompecabezas por turnos con 12 niveles demostrados. */
export default function LavaYAgua() {
  const frame = useGameFrame();
  const record = useGameRecord(GAME_ID);
  const [level, setLevel] = useState(null);
  if (level === null) return <LevelSelect record={record} onPick={setLevel} />;
  return <Play key={level} index={level} frame={frame} onMenu={() => setLevel(null)} onNext={setLevel} />;
}
