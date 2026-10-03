import { useId } from 'react';
import { Search, X } from 'lucide-react';
import { cx } from '../../../utils/cx.js';

/**
 * Búsqueda local e inmediata + filtro por categoría. No hay ninguna petición:
 * se filtra el registro en memoria a cada pulsación.
 */
export function GameFilters({ query, onQuery, category, onCategory, categories, resultCount }) {
  const id = useId();
  return (
    <div className="game-filters">
      <div className="game-search">
        <label htmlFor={`${id}-search`} className="sr-only">
          Buscar juegos por nombre o categoría
        </label>
        <Search className="game-search__icon" aria-hidden="true" />
        <input
          id={`${id}-search`}
          type="search"
          className="game-search__input"
          placeholder="Buscar por nombre o categoría…"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
        />
        {query && (
          <button type="button" className="game-search__clear" onClick={() => onQuery('')} aria-label="Borrar búsqueda">
            <X aria-hidden="true" />
          </button>
        )}
      </div>
      <div className="game-chips" role="group" aria-label="Filtrar por categoría">
        {[{ id: 'all', label: 'Todos' }, ...categories].map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              className={cx('game-chip', category === item.id && 'is-active')}
              aria-pressed={category === item.id}
              onClick={() => onCategory(item.id)}
            >
              {Icon && <Icon aria-hidden="true" />}
              {item.label}
            </button>
          );
        })}
      </div>
      <p className="sr-only" aria-live="polite">
        {resultCount === 1 ? '1 juego encontrado' : `${resultCount} juegos encontrados`}
      </p>
    </div>
  );
}
