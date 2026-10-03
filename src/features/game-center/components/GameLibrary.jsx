import { SearchX } from 'lucide-react';
import { Button } from '../../../components/common/Button.jsx';
import { GameCard } from './GameCard.jsx';

/** Rejilla de juegos disponibles, con estado vacío cuando el filtro no encuentra nada. */
export function GameLibrary({ games, records, onReset }) {
  if (!games.length) {
    return (
      <div className="game-empty" role="status">
        <SearchX aria-hidden="true" />
        <p className="game-empty__title">No hay juegos que coincidan</p>
        <p>Prueba con otra palabra o quita el filtro de categoría.</p>
        <Button variant="secondary" size="sm" onClick={onReset}>
          Ver todos los juegos
        </Button>
      </div>
    );
  }
  return (
    <ul className="game-grid">
      {games.map((game) => (
        <li key={game.id}>
          <GameCard game={game} record={records[game.id]} />
        </li>
      ))}
    </ul>
  );
}
