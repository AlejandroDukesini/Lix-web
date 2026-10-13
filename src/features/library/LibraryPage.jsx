import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { BookMarked, BookOpenText, Bookmark, Search, SearchX, ShieldCheck, Star, X } from 'lucide-react';
import { usePreferences } from '../../app/providers/PreferencesProvider.jsx';
import { Button } from '../../components/common/Button.jsx';
import { SectionHeader } from '../../components/common/Card.jsx';
import { HorizontalScroller } from '../../components/common/HorizontalScroller.jsx';
import { SegmentedControl } from '../../components/common/SegmentedControl.jsx';
import { cx } from '../../utils/cx.js';
import { DIFFICULTIES, SHELVES } from './registry/shelves.js';
import { DOCUMENTS, GLOSSARY, documentsOf, findDocument, searchDocuments, totalMinutes } from './registry/catalog.js';
import { lastOpened, useLibraryState } from './hooks/useLibraryState.js';
import { DocumentList } from './components/DocumentList.jsx';
import { useReadingSurface } from './hooks/useReadingSurface.js';
import './styles/library.css';

function hoursLabel(minutes) {
  const hours = Math.round(minutes / 60);
  return hours <= 1 ? `${minutes} minutos de lectura` : `unas ${hours} horas de lectura`;
}

/**
 * Cabecera: la portada de un libro con su ex libris, el sello que marca a quién
 * pertenece. Lleva el primer apodo configurado (dato real), no un nombre inventado.
 */
function LibraryHero({ nickname, finished }) {
  return (
    <header className="lib-hero" aria-labelledby="lib-title">
      <p className="eyebrow">Nuestra biblioteca</p>
      <h1 id="lib-title" className="lib-hero__title">
        Historias que enseñan
      </h1>
      <p className="lib-hero__lead">
        Estrellas, crímenes, idiomas y creencias contados como relatos: con personajes reales, escenas, preguntas y la ciencia o la
        historia que hay detrás. Todo se lee sin conexión.
      </p>
      <p className="lib-hero__stats">
        <span>{DOCUMENTS.length} capítulos</span>
        <span aria-hidden="true">·</span>
        <span>{SHELVES.length} estantes</span>
        <span aria-hidden="true">·</span>
        <span>{hoursLabel(totalMinutes())}</span>
        {finished > 0 && (
          <>
            <span aria-hidden="true">·</span>
            <span>{finished === 1 ? '1 leído' : `${finished} leídos`}</span>
          </>
        )}
      </p>
      {nickname && (
        <p className="lib-exlibris">
          <span className="lib-exlibris__label">Ex libris</span>
          <span className="lib-exlibris__name">{nickname}</span>
        </p>
      )}
    </header>
  );
}

function ContinueReading({ entry }) {
  const { doc, progress } = entry;
  const section = doc.sections.find((s) => s.id === progress.section);
  return (
    <section className="lib-continue" aria-labelledby="lib-continue-title">
      <p className="eyebrow">Seguir leyendo</p>
      <h2 id="lib-continue-title" className="lib-continue__title">
        {doc.title}
      </h2>
      <p className="lib-continue__where">
        {section ? `Lo dejaste en «${section.title}»` : 'Lo empezaste hace poco'} · {Math.round(progress.percent * 100)} %
      </p>
      <span className="lib-doc__progress lib-continue__bar" aria-hidden="true">
        <span style={{ inlineSize: `${Math.round(progress.percent * 100)}%` }} />
      </span>
      <Button to={`/documentos/${doc.id}${section ? `?seccion=${section.id}` : ''}`} icon={BookOpenText}>
        Continuar
      </Button>
    </section>
  );
}

function LibraryFilters({ query, onQuery, shelf, onShelf, difficulty, onDifficulty, resultCount }) {
  const id = useId();
  const scroller = useRef(null);
  const activeChip = useRef(null);
  useEffect(() => {
    scroller.current?.scrollToItem(activeChip.current);
  }, [shelf]);

  return (
    <div className="lib-filters">
      <div className="lib-search">
        <label htmlFor={`${id}-search`} className="sr-only">
          Buscar en la biblioteca
        </label>
        <Search className="lib-search__icon" aria-hidden="true" />
        <input
          id={`${id}-search`}
          type="search"
          className="lib-search__input"
          placeholder="Buscar un tema, un personaje o un concepto…"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          autoComplete="off"
          enterKeyHint="search"
        />
        {query && (
          <button type="button" className="lib-search__clear" onClick={() => onQuery('')} aria-label="Borrar búsqueda">
            <X aria-hidden="true" />
          </button>
        )}
      </div>
      <HorizontalScroller ref={scroller} className="lib-chips-scroller" trackClassName="lib-chips" role="group" label="Filtrar por estante">
        {[{ id: 'all', short: 'Todos' }, ...SHELVES].map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              ref={shelf === item.id ? activeChip : undefined}
              type="button"
              className={cx('lib-chip', shelf === item.id && 'is-active')}
              aria-pressed={shelf === item.id}
              onClick={() => onShelf(item.id)}
            >
              {Icon && <Icon aria-hidden="true" />}
              {item.short}
            </button>
          );
        })}
      </HorizontalScroller>
      <SegmentedControl
        label="Dificultad"
        name="lib-difficulty"
        value={difficulty}
        onChange={onDifficulty}
        options={[{ value: 'all', label: 'Todas' }, ...DIFFICULTIES.map((d) => ({ value: d.id, label: d.label }))]}
      />
      <p className="sr-only" aria-live="polite">
        {resultCount === 1 ? '1 documento encontrado' : `${resultCount} documentos encontrados`}
      </p>
    </div>
  );
}

/** Un estante completo: sus recorridos en orden, como el índice de un libro. */
function Shelf({ shelf, state }) {
  const Icon = shelf.icon;
  const docs = documentsOf(shelf.id);
  let counter = 0;
  return (
    <section className="lib-shelf" aria-labelledby={`shelf-${shelf.id}`}>
      <header className="lib-shelf__header">
        <span className="lib-shelf__icon" aria-hidden="true">
          <Icon />
        </span>
        <div>
          <h2 id={`shelf-${shelf.id}`} className="lib-shelf__title">
            {shelf.label}
          </h2>
          <p className="lib-shelf__description">{shelf.description}</p>
          <p className="lib-shelf__count">
            {docs.length} capítulos · {totalMinutes(docs)} min
          </p>
        </div>
      </header>
      {shelf.paths.map((path) => {
        const pathDocs = documentsOf(shelf.id, path.id);
        if (!pathDocs.length) return null;
        const startAt = counter + 1;
        counter += pathDocs.length;
        return (
          <div key={path.id} className="lib-path">
            <h3 className="lib-path__title">{path.title}</h3>
            <DocumentList docs={pathDocs} state={state} startAt={startAt} />
          </div>
        );
      })}
      {shelf.planned.length > 0 && (
        <div className="lib-planned">
          <h3 className="lib-planned__title">En preparación</h3>
          <ul>
            {shelf.planned.map((title) => (
              <li key={title}>{title}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function SavedForLater({ state }) {
  const favorites = state.favorites.map(findDocument).filter(Boolean);
  const bookmarks = state.bookmarks.filter((mark) => findDocument(mark.docId)).slice(0, 12);
  if (!favorites.length && !bookmarks.length) return null;
  return (
    <section className="lib-saved" aria-labelledby="lib-saved-title">
      <SectionHeader id="lib-saved-title" eyebrow="Guardado" title="Favoritos y marcadores" />
      <div className="lib-saved__grid">
        {favorites.length > 0 && (
          <div>
            <h3 className="lib-path__title">
              <Star aria-hidden="true" /> Favoritos
            </h3>
            <DocumentList docs={favorites} state={state} numbered={false} showShelf />
          </div>
        )}
        {bookmarks.length > 0 && (
          <div>
            <h3 className="lib-path__title">
              <Bookmark aria-hidden="true" /> Marcadores
            </h3>
            <ul className="lib-bookmarks">
              {bookmarks.map((mark) => (
                <li key={`${mark.docId}#${mark.sectionId}`}>
                  <Link to={`/documentos/${mark.docId}?seccion=${mark.sectionId}`} className="lib-bookmark">
                    <span className="lib-bookmark__section">{mark.sectionTitle}</span>
                    <span className="lib-bookmark__doc">{findDocument(mark.docId).title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

/** Ruta /documentos — catálogo de la biblioteca. */
export default function LibraryPage() {
  const { preferences } = usePreferences();
  useReadingSurface();
  const { state } = useLibraryState();
  const [query, setQuery] = useState('');
  const [shelf, setShelf] = useState('all');
  const [difficulty, setDifficulty] = useState('all');

  const searching = query.trim() !== '' || difficulty !== 'all';
  const results = useMemo(() => searchDocuments({ query, shelf, difficulty }), [query, shelf, difficulty]);
  const continueEntry = lastOpened(state, findDocument);
  const finished = Object.values(state.progress).filter((p) => p.finishedAt).length;
  const visibleShelves = shelf === 'all' ? SHELVES : SHELVES.filter((s) => s.id === shelf);
  const reset = () => {
    setQuery('');
    setShelf('all');
    setDifficulty('all');
  };

  return (
    <div className="page library">
      <LibraryHero nickname={preferences.profile.nicknames[0]} finished={finished} />
      {continueEntry && <ContinueReading entry={continueEntry} />}

      <section className="lib-catalog" aria-labelledby="lib-catalog-title">
        <SectionHeader
          id="lib-catalog-title"
          eyebrow="Catálogo"
          title="Estantes"
          description="Cada capítulo se lee por separado, pero en orden forman un recorrido. Busca por tema, personaje o concepto."
          action={
            <Button to="/documentos/glosario" variant="secondary" size="sm" icon={BookMarked}>
              Glosario ({GLOSSARY.length})
            </Button>
          }
        />
        <LibraryFilters
          query={query}
          onQuery={setQuery}
          shelf={shelf}
          onShelf={setShelf}
          difficulty={difficulty}
          onDifficulty={setDifficulty}
          resultCount={results.length}
        />
        {searching ? (
          results.length ? (
            <DocumentList docs={results} state={state} numbered={false} showShelf />
          ) : (
            <div className="lib-empty" role="status">
              <SearchX aria-hidden="true" />
              <p className="lib-empty__title">No hay capítulos que coincidan</p>
              <p>Prueba con otra palabra o quita los filtros.</p>
              <Button variant="secondary" size="sm" onClick={reset}>
                Ver toda la biblioteca
              </Button>
            </div>
          )
        ) : (
          visibleShelves.map((item) => <Shelf key={item.id} shelf={item} state={state} />)
        )}
      </section>

      <SavedForLater state={state} />

      <p className="home__privacy">
        <ShieldCheck aria-hidden="true" />
        Los textos viven dentro de la app y se leen sin conexión. Tu progreso, favoritos y marcadores se guardan solo en este dispositivo.
      </p>
    </div>
  );
}
