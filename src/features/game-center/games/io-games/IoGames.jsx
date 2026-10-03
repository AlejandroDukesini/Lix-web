import { useState } from 'react';
import { Bot, Play, Trophy } from 'lucide-react';
import { Button } from '../../../../components/common/Button.jsx';
import { useGameRecord } from '../../hooks/useGameStatistics.js';
import { IO_MODES } from './modes.js';
import { IoArena } from './components/IoArena.jsx';
import { orbitMode } from './modes/orbitMode.js';
import { territoryMode } from './modes/territoryMode.js';
import { decoyMode } from './modes/decoyMode.js';
import './styles/io-games.css';

const CONFIGS = { orbit: orbitMode, territory: territoryMode, decoy: decoyMode };

/** Miniatura propia de cada modo (no se repite la misma imagen). */
function ModeGlyph({ id }) {
  if (id === 'orbit') {
    return (
      <svg viewBox="0 0 120 80" aria-hidden="true">
        <circle cx="70" cy="42" r="24" fill="#ff6b6b" />
        <circle cx="34" cy="30" r="12" fill="#7df9ff" />
        <circle cx="34" cy="30" r="17" fill="none" stroke="#7df9ff" strokeDasharray="4 4" />
        {[
          [14, 60],
          [100, 16],
          [104, 64],
          [52, 70],
          [22, 12],
        ].map(([x, y]) => (
          <circle key={`${x}${y}`} cx={x} cy={y} r="3" fill="#ffe66d" />
        ))}
      </svg>
    );
  }
  if (id === 'territory') {
    return (
      <svg viewBox="0 0 120 80" aria-hidden="true">
        <path d="M8 44 H40 V28 H64 V60 H8Z" fill="#7df9ff" opacity="0.8" />
        <path d="M76 10 H112 V40 H90 V26 H76Z" fill="#ffb703" opacity="0.8" />
        <path d="M64 44 H86 V64" fill="none" stroke="#7df9ff" strokeWidth="6" opacity="0.5" />
        <rect x="80" y="60" width="12" height="12" rx="3" fill="#7df9ff" stroke="#fff" strokeWidth="2" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 120 80" aria-hidden="true">
      <circle cx="60" cy="40" r="34" fill="none" stroke="rgb(255 255 255 / 0.2)" />
      <circle cx="60" cy="44" r="8" fill="#7df9ff" />
      <path d="M30 22 l12 6 -12 6 3 -6z" fill="#ff4fd8" />
      <path d="M92 58 l-12 -4 10 -8 -2 6z" fill="#ff4fd8" />
      <path d="M86 18 l-6 12 -6 -12 6 3z" fill="#ff4fd8" />
      <path d="M40 60 l3 5 5 -1 -3 5 3 4 -5 -1 -3 5 -1 -5 -5 -2 5 -2z" fill="#ffe66d" />
    </svg>
  );
}

function Menu({ record, onPick }) {
  return (
    <div className="io-menu">
      <header className="io-menu__head">
        <p className="eyebrow">Arena .io</p>
        <h2 className="io-menu__title">Elige un minijuego</h2>
        <p className="io-menu__text">
          <Bot aria-hidden="true" /> Los rivales son bots controlados por el juego en este dispositivo. No hay jugadores conectados.
        </p>
      </header>
      <ul className="io-modes">
        {IO_MODES.map((mode) => {
          const best = record?.best?.[`${mode.id}:score`];
          const won = record?.progress?.wins?.[mode.id];
          return (
            <li key={mode.id}>
              <article className="io-mode" style={{ '--mode': mode.color }} aria-labelledby={`io-${mode.id}`}>
                <div className="io-mode__glyph">
                  <ModeGlyph id={mode.id} />
                </div>
                <div className="io-mode__body">
                  <p className="io-mode__kind">{mode.kind}</p>
                  <h3 id={`io-${mode.id}`} className="io-mode__name">
                    {mode.name}
                  </h3>
                  <p className="io-mode__goal">Objetivo: {mode.goal}</p>
                  <ul className="io-mode__rules">
                    {mode.rules.map((rule) => (
                      <li key={rule}>{rule}</li>
                    ))}
                  </ul>
                  <p className="io-mode__best">
                    <Trophy aria-hidden="true" />
                    {Number.isFinite(best) ? `Mejor: ${mode.formatScore(best)}${won ? ' · superado' : ''}` : 'Sin récord todavía'}
                  </p>
                  <Button icon={Play} onClick={() => onPick(mode)} aria-label={`Jugar a ${mode.name}`}>
                    Jugar
                  </Button>
                </div>
              </article>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Colección de minijuegos .io. */
export default function IoGames() {
  const record = useGameRecord('io-games');
  const [mode, setMode] = useState(null);
  if (!mode) return <Menu record={record} onPick={setMode} />;
  return <IoArena key={mode.id} mode={mode} config={CONFIGS[mode.id]} onMenu={() => setMode(null)} />;
}
