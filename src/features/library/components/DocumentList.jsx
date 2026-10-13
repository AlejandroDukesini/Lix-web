import { Link } from 'react-router';
import { CircleCheck, Clock, Star } from 'lucide-react';
import { difficultyLabel, findShelf } from '../registry/shelves.js';
import { cx } from '../../../utils/cx.js';

/** Estado de lectura en palabras: «Leído», «Vas por el 40 %» o nada si no se ha empezado. */
export function readingStatus(progress) {
  if (!progress) return null;
  if (progress.finishedAt) return { done: true, label: 'Leído' };
  if (progress.percent >= 0.02) return { done: false, label: `Vas por el ${Math.round(progress.percent * 100)} %` };
  return null;
}

/**
 * Un documento como entrada de un índice de libro (no como tarjeta): número,
 * título, descripción y una línea de datos. `showShelf` añade el estante en los resultados de búsqueda.
 */
export function DocumentRow({ doc, number, progress, favorite, showShelf = false }) {
  const status = readingStatus(progress);
  return (
    <Link to={`/documentos/${doc.id}`} className={cx('lib-doc', status?.done && 'is-read')}>
      {number !== undefined && (
        <span className="lib-doc__number" aria-hidden="true">
          {String(number).padStart(2, '0')}
        </span>
      )}
      <span className="lib-doc__body">
        <span className="lib-doc__title">
          {doc.title}
          {favorite && (
            <>
              <Star className="lib-doc__fav" aria-hidden="true" />
              <span className="sr-only"> (favorito)</span>
            </>
          )}
        </span>
        <span className="lib-doc__description">{doc.description}</span>
        <span className="lib-doc__meta">
          {showShelf && <span>{findShelf(doc.category)?.short}</span>}
          <span>
            <Clock aria-hidden="true" /> {doc.minutes} min
          </span>
          <span>{difficultyLabel(doc.difficulty)}</span>
          {status && (
            <span className={cx('lib-doc__status', status.done && 'is-done')}>
              {status.done && <CircleCheck aria-hidden="true" />}
              {status.label}
            </span>
          )}
        </span>
      </span>
      {status && !status.done && (
        <span className="lib-doc__progress" aria-hidden="true">
          <span style={{ inlineSize: `${Math.round(progress.percent * 100)}%` }} />
        </span>
      )}
    </Link>
  );
}

export function DocumentList({ docs, state, numbered = true, showShelf = false, startAt = 1 }) {
  return (
    <ol className="lib-list">
      {docs.map((doc, i) => (
        <li key={doc.id}>
          <DocumentRow
            doc={doc}
            number={numbered ? startAt + i : undefined}
            progress={state.progress[doc.id]}
            favorite={state.favorites.includes(doc.id)}
            showShelf={showShelf}
          />
        </li>
      ))}
    </ol>
  );
}
