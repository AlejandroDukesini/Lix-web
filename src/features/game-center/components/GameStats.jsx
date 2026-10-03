import { useId } from 'react';
import { CheckCheck, Gamepad2, Hourglass, Volume2 } from 'lucide-react';
import { Switch } from '../../../components/common/Switch.jsx';
import { formatPlayTime } from '../services/gameLifecycle.js';

/** Estadísticas personales y progreso general (todo leído del almacenamiento local). */
export function GameStats({ summary, games, records }) {
  const percent = summary.milestonesTotal ? Math.round((summary.milestonesDone / summary.milestonesTotal) * 100) : 0;
  const tokens = [
    { icon: Gamepad2, label: 'Partidas', value: summary.plays.toLocaleString('es') },
    { icon: CheckCheck, label: 'Terminadas', value: summary.completions.toLocaleString('es') },
    { icon: Hourglass, label: 'Tiempo jugado', value: formatPlayTime(summary.totalTimeMs) },
  ];
  return (
    <div className="game-stats">
      <ul className="game-tokens">
        {tokens.map(({ icon: Icon, label, value }) => (
          <li key={label} className="game-token">
            <Icon aria-hidden="true" />
            <span className="game-token__value">{value}</span>
            <span className="game-token__label">{label}</span>
          </li>
        ))}
      </ul>
      <div className="game-progress-panel">
        <div className="game-progress-panel__head">
          <p className="game-progress-panel__title">Progreso general</p>
          <p className="game-progress-panel__value">
            {summary.milestonesDone}/{summary.milestonesTotal} hitos · {percent} %
          </p>
        </div>
        <div className="meter" role="progressbar" aria-label="Progreso general" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
          <span style={{ width: `${percent}%` }} />
        </div>
        <ul className="game-progress-panel__list">
          {games.map((game) => {
            const progress = game.progress(records[game.id]);
            return (
              <li key={game.id} style={{ '--game-a': game.palette.a, '--game-b': game.palette.b }}>
                <span className="game-progress-panel__game">{game.title}</span>
                <span className="game-progress-panel__detail">{progress.label}</span>
                <span className="mini-meter" aria-hidden="true">
                  <span style={{ width: `${(progress.done / progress.total) * 100}%` }} />
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/** Preferencias de sonido del Game Center. */
export function SoundSettings({ settings, onChange }) {
  const id = useId();
  return (
    <div className="game-sound">
      <Switch
        label="Efectos de sonido"
        description="Sonidos sintetizados en el propio dispositivo. Los juegos funcionan igual en silencio."
        checked={settings.sound}
        onChange={(sound) => onChange({ sound })}
      />
      <div className="game-sound__volume">
        <label htmlFor={`${id}-volume`}>
          <Volume2 aria-hidden="true" /> Volumen
        </label>
        <input
          id={`${id}-volume`}
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={settings.volume}
          disabled={!settings.sound}
          onChange={(event) => onChange({ volume: Number(event.target.value) })}
          aria-valuetext={`${Math.round(settings.volume * 100)} %`}
        />
        <output htmlFor={`${id}-volume`}>{Math.round(settings.volume * 100)} %</output>
      </div>
    </div>
  );
}
