import { Link } from 'react-router';
import { Clock, Play } from 'lucide-react';
import { Badge } from '../../../components/common/Card.jsx';
import { categoryById, categoryLabel } from '../registry/categories.js';
import { formatLastPlayed } from '../services/gameLifecycle.js';
import { cx } from '../../../utils/cx.js';

/**
 * Tarjeta de un juego disponible. Toda la tarjeta responde al puntero (el
 * enlace "Jugar" se extiende sobre ella), pero solo hay un elemento enfocable.
 */
export function GameCard({ game, record, headingLevel = 3 }) {
  const { Art } = game;
  const Heading = `h${headingLevel}`;
  const last = formatLastPlayed(record?.lastPlayedAt);
  const highlight = record ? game.highlight(record) : null;
  const progress = game.progress(record);
  return (
    <article className="game-card" style={{ '--game-a': game.palette.a, '--game-b': game.palette.b }} aria-labelledby={`card-${game.id}`}>
      <div className="game-card__art">
        <Art className="game-art" />
        <Badge tone="success" className="game-card__status">
          Disponible
        </Badge>
      </div>
      <div className="game-card__body">
        <p className="game-card__categories">{game.categories.map(categoryLabel).join(' · ')}</p>
        <Heading id={`card-${game.id}`} className="game-card__title">
          {game.title}
        </Heading>
        <p className="game-card__tagline">{game.tagline}</p>
        <ul className="game-card__facts" aria-label="Características">
          {game.facts.map((fact) => (
            <li key={fact}>{fact}</li>
          ))}
        </ul>
        <div className="game-card__footer">
          <p className="game-card__last">
            <Clock aria-hidden="true" />
            {last ? `Último acceso: ${last}` : 'Aún sin jugar'}
          </p>
          {highlight && <p className="game-card__highlight">{highlight}</p>}
          <div className="game-card__meter" aria-hidden="true">
            <span style={{ width: `${(progress.done / progress.total) * 100}%` }} />
          </div>
          <Link to={`/juegos/${game.id}`} className="btn btn--primary btn--md game-card__play" aria-label={`Jugar a ${game.title}`}>
            <Play className="btn__icon" aria-hidden="true" />
            <span className="btn__label">Jugar</span>
          </Link>
        </div>
      </div>
    </article>
  );
}

/** Tarjeta de un juego de una fase futura: sin ilustración final ni botón de jugar. */
export function PlannedGameCard({ game, phase }) {
  const Icon = categoryById(game.categories[0])?.icon;
  return (
    <article className={cx('game-card', 'game-card--planned')} aria-disabled="true" aria-labelledby={`planned-${game.id}`}>
      <div className="game-card__blueprint" aria-hidden="true">
        {Icon && <Icon />}
        <span>Fase {phase}</span>
      </div>
      <div className="game-card__body">
        <p className="game-card__categories">{game.categories.map(categoryLabel).join(' · ')}</p>
        <h4 id={`planned-${game.id}`} className="game-card__title">
          {game.title}
        </h4>
        <p className="game-card__tagline">{game.note}</p>
        <Badge tone="soon">Próxima incorporación</Badge>
      </div>
    </article>
  );
}
