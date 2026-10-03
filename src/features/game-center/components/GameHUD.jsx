import { Pause, Play } from 'lucide-react';
import { cx } from '../../../utils/cx.js';

/**
 * Marcador de la partida. Cada juego decide qué indicadores tienen sentido:
 *   items: [{ id, label, value, wide?, tone? }]
 * Sin `onPause` no hay botón de pausa (p. ej. juegos por turnos).
 */
export function GameHUD({ items, onPause, paused = false, pauseDisabled = false, className, children }) {
  return (
    <div className={cx('game-hud', className)} data-no-gesture>
      <dl className="game-hud__items">
        {items.map((item) => (
          <div key={item.id ?? item.label} className={cx('game-hud__item', item.wide && 'is-wide', item.tone && `is-${item.tone}`)}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
          </div>
        ))}
      </dl>
      {children}
      {onPause && (
        <button
          type="button"
          className="game-hud__pause"
          onClick={onPause}
          disabled={pauseDisabled}
          aria-label={paused ? 'Continuar' : 'Pausar (Esc)'}
          title={paused ? 'Continuar' : 'Pausar (Esc)'}
        >
          {paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
        </button>
      )}
    </div>
  );
}

/** Barra de progreso fina (recorrido del circuito, tiempo de supervivencia…). */
export function GameProgress({ value, label }) {
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div className="game-progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
      <span style={{ transform: `scaleX(${percent / 100})` }} />
    </div>
  );
}
