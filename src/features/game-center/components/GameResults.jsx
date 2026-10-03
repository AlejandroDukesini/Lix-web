import { DoorOpen, RotateCcw, Trophy } from 'lucide-react';
import { Button } from '../../../components/common/Button.jsx';
import { cx } from '../../../utils/cx.js';
import { GameOverlay } from './GameOverlay.jsx';

/**
 * Resultado de una partida.
 *   outcome: 'win' | 'lose' | 'end'
 *   stats:   [{ label, value, record?: boolean, best?: string }]
 *            `record` solo debe ser true si la marca superó lo guardado (ver recordGameResult).
 *   saving:  mientras se comparan las marcas con lo guardado, no se anuncia ningún récord.
 */
export function GameResults({ outcome = 'end', eyebrow, title, message, stats = [], saving = false, onReplay, replayLabel = 'Jugar de nuevo', onExit, extraActions }) {
  const hasRecord = !saving && stats.some((stat) => stat.record);
  return (
    <GameOverlay
      tone={outcome}
      eyebrow={eyebrow ?? (outcome === 'win' ? '¡Lo lograste!' : outcome === 'lose' ? 'Fin de la partida' : 'Partida terminada')}
      title={title}
      className="game-results"
      actions={
        <>
          {onReplay && (
            <Button icon={RotateCcw} onClick={onReplay} data-autofocus>
              {replayLabel}
            </Button>
          )}
          {extraActions}
          <Button variant="ghost" icon={DoorOpen} onClick={onExit}>
            Volver al Game Center
          </Button>
        </>
      }
    >
      {message && <p className="game-results__message">{message}</p>}
      {hasRecord && (
        <p className="game-results__record" role="status">
          <Trophy aria-hidden="true" /> ¡Nuevo récord personal!
        </p>
      )}
      {stats.length > 0 && (
        <dl className="game-results__stats">
          {stats.map((stat) => (
            <div key={stat.label} className={cx('game-results__stat', stat.record && !saving && 'is-record')}>
              <dt>{stat.label}</dt>
              <dd>
                {stat.value}
                {stat.best && <span className="game-results__best">Mejor: {stat.best}</span>}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </GameOverlay>
  );
}
