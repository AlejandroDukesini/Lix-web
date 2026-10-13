import { useId, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ChevronLeft, Search, SearchX, X } from 'lucide-react';
import { Button } from '../../components/common/Button.jsx';
import { normalizeText, slugify, GLOSSARY_HEADING } from './engine/markdown.js';
import { findShelf } from './registry/shelves.js';
import { GLOSSARY } from './registry/catalog.js';
import './styles/library.css';

const CONCEPTS_SECTION = slugify(GLOSSARY_HEADING);

/** Letra inicial para agrupar, sin tildes («Átomo» va con la A). */
const initial = (term) => normalizeText(term).charAt(0).toUpperCase();

/** Ruta /documentos/glosario — todos los conceptos importantes de la biblioteca. */
export default function GlossaryPage() {
  const id = useId();
  const [query, setQuery] = useState('');

  const groups = useMemo(() => {
    const terms = normalizeText(query).split(/\s+/).filter(Boolean);
    const matches = GLOSSARY.filter((entry) => {
      const text = normalizeText(`${entry.term} ${entry.definition}`);
      return terms.every((term) => text.includes(term));
    });
    const map = new Map();
    for (const entry of matches) {
      const letter = initial(entry.term);
      if (!map.has(letter)) map.set(letter, []);
      map.get(letter).push(entry);
    }
    return [...map.entries()];
  }, [query]);
  const count = groups.reduce((n, [, entries]) => n + entries.length, 0);

  return (
    <div className="page library glossary">
      <nav className="reader-crumbs" aria-label="Ruta">
        <ol>
          <li>
            <Link to="/documentos">Biblioteca</Link>
          </li>
          <li aria-current="page">Glosario</li>
        </ol>
      </nav>
      <header className="lib-hero lib-hero--compact">
        <p className="eyebrow">Glosario</p>
        <h1 className="lib-hero__title">Conceptos importantes</h1>
        <p className="lib-hero__lead">
          Las ideas clave de cada capítulo, reunidas en un solo lugar. Cada definición lleva al documento donde se explica con calma.
        </p>
      </header>

      <div className="lib-search">
        <label htmlFor={`${id}-search`} className="sr-only">
          Buscar en el glosario
        </label>
        <Search className="lib-search__icon" aria-hidden="true" />
        <input
          id={`${id}-search`}
          type="search"
          className="lib-search__input"
          placeholder="Buscar un concepto…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          autoComplete="off"
          enterKeyHint="search"
        />
        {query && (
          <button type="button" className="lib-search__clear" onClick={() => setQuery('')} aria-label="Borrar búsqueda">
            <X aria-hidden="true" />
          </button>
        )}
      </div>
      <p className="sr-only" aria-live="polite">
        {count === 1 ? '1 concepto' : `${count} conceptos`}
      </p>

      {count === 0 ? (
        <div className="lib-empty" role="status">
          <SearchX aria-hidden="true" />
          <p className="lib-empty__title">Ningún concepto coincide</p>
          <Button variant="secondary" size="sm" onClick={() => setQuery('')}>
            Ver todo el glosario
          </Button>
        </div>
      ) : (
        <div className="glossary__groups">
          {groups.map(([letter, entries]) => (
            <section key={letter} className="glossary__group" aria-labelledby={`${id}-${letter}`}>
              <h2 id={`${id}-${letter}`} className="glossary__letter">
                {letter}
              </h2>
              <dl className="glossary__list">
                {entries.map((entry) => (
                  <div key={`${entry.docId}-${entry.term}`} className="glossary__entry">
                    <dt className="glossary__term">{entry.term}</dt>
                    <dd className="glossary__definition">
                      {entry.definition}
                      <Link to={`/documentos/${entry.docId}?seccion=${CONCEPTS_SECTION}`} className="glossary__source">
                        {findShelf(entry.category)?.short} · {entry.docTitle}
                      </Link>
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      )}

      <Button to="/documentos" variant="ghost" size="sm" icon={ChevronLeft}>
        Volver a la biblioteca
      </Button>
    </div>
  );
}
