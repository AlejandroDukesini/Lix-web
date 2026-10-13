import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router';
import {
  AArrowDown,
  AArrowUp,
  ArrowUp,
  BookmarkCheck,
  BookmarkPlus,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Clock,
  ListTree,
  Star,
} from 'lucide-react';
import { Button, IconButton } from '../../components/common/Button.jsx';
import { useMediaQuery } from '../../hooks/useMediaQuery.js';
import { cx } from '../../utils/cx.js';
import { parseFrontmatter, parseMarkdown } from './engine/markdown.js';
import { difficultyLabel, findShelf } from './registry/shelves.js';
import { findDocument, loadDocumentSource, neighbours, relatedDocuments, shelfPosition } from './registry/catalog.js';
import { useLibraryState } from './hooks/useLibraryState.js';
import { FONT_SCALES, saveProgress, setFontScale, toggleBookmark, toggleFavorite } from './services/libraryStorage.js';
import { Blocks, Inline } from './components/MarkdownView.jsx';
import { DocumentList } from './components/DocumentList.jsx';
import './styles/library.css';

const SAVE_DELAY = 1200;

/** Lee la posición de lectura: fracción del artículo ya recorrida y sección visible. */
function measure(article) {
  const rect = article.getBoundingClientRect();
  const viewport = window.innerHeight || 1;
  const percent = rect.height > 0 ? Math.min(1, Math.max(0, (viewport - rect.top) / rect.height)) : 0;
  let section = null;
  for (const heading of article.querySelectorAll('h2[id]')) {
    if (heading.getBoundingClientRect().top < viewport * 0.3) section = heading.id;
    else break;
  }
  return { percent, section };
}

function useDocumentSource(id) {
  const [result, setResult] = useState({ id: null, blocks: null, error: null });
  useEffect(() => {
    let active = true;
    loadDocumentSource(id)
      .then((source) => active && setResult({ id, blocks: parseMarkdown(parseFrontmatter(source).body), error: null }))
      .catch((error) => active && setResult({ id, blocks: null, error }));
    return () => {
      active = false;
    };
  }, [id]);
  return result.id === id ? result : { id, blocks: null, error: null };
}

/**
 * Guarda el progreso mientras se lee: tras una pausa en el desplazamiento y al
 * salir del documento (cambio de ruta o cierre de la pestaña).
 */
function useReadingProgress(docId, articleRef, enabled) {
  const [live, setLive] = useState({ percent: 0, section: null });
  const pending = useRef(null);

  useEffect(() => {
    if (!enabled) return undefined;
    let frame = 0;
    let timer = 0;
    const flush = () => {
      window.clearTimeout(timer);
      if (pending.current) saveProgress(docId, pending.current);
      pending.current = null;
    };
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        if (!articleRef.current) return;
        const next = measure(articleRef.current);
        setLive(next);
        pending.current = next;
        window.clearTimeout(timer);
        timer = window.setTimeout(flush, SAVE_DELAY);
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pagehide', flush);
      window.cancelAnimationFrame(frame);
      flush();
    };
  }, [docId, articleRef, enabled]);

  return live;
}

function TableOfContents({ doc, current, bookmarks, onJump, wide }) {
  return (
    <details className="reader-toc" open={wide || undefined}>
      <summary className="reader-toc__summary">
        <ListTree aria-hidden="true" />
        Índice <span className="reader-toc__count">· {doc.sections.length} secciones</span>
      </summary>
      <nav aria-label="Índice del documento">
        <ol className="reader-toc__list">
          {doc.sections.map((section) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                className={cx('reader-toc__link', current === section.id && 'is-current')}
                aria-current={current === section.id ? 'location' : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  onJump(section.id);
                }}
              >
                {section.title}
                {bookmarks.has(section.id) && (
                  <>
                    <BookmarkCheck className="reader-toc__mark" aria-hidden="true" />
                    <span className="sr-only"> (con marcador)</span>
                  </>
                )}
              </a>
            </li>
          ))}
        </ol>
      </nav>
    </details>
  );
}

/** Ruta /documentos/:docId — lector de un documento. */
export default function ReaderPage() {
  const { docId } = useParams();
  const doc = findDocument(docId);
  if (!doc) return <Navigate to="/documentos" replace />;
  return <Reader key={doc.id} doc={doc} />;
}

function Reader({ doc }) {
  const [params] = useSearchParams();
  const target = params.get('seccion');
  const { blocks, error } = useDocumentSource(doc.id);
  const { state, ready } = useLibraryState();
  const articleRef = useRef(null);
  const wide = useMediaQuery('(min-width: 1240px)');
  const live = useReadingProgress(doc.id, articleRef, Boolean(blocks));

  const shelf = findShelf(doc.category);
  const path = shelf.paths.find((p) => p.id === doc.path);
  const position = shelfPosition(doc);
  const { previous, next } = neighbours(doc);
  const related = useMemo(() => relatedDocuments(doc), [doc]);
  const saved = state.progress[doc.id];
  const favorite = state.favorites.includes(doc.id);
  const bookmarks = useMemo(
    () => new Set(state.bookmarks.filter((m) => m.docId === doc.id).map((m) => m.sectionId)),
    [state.bookmarks, doc.id],
  );
  const scale = state.settings.fontScale;
  const current = live.section ?? doc.sections[0]?.id;

  useEffect(() => {
    document.title = `${doc.title} · Biblioteca`;
    return () => {
      document.title = 'Un año más contigo';
    };
  }, [doc.title]);

  const jump = useCallback((id) => {
    document.getElementById(id)?.scrollIntoView({ block: 'start' });
  }, []);

  // Enlaces del glosario y de los marcadores: llevan a una sección concreta.
  useEffect(() => {
    if (blocks && target) jump(target);
  }, [blocks, target, jump]);

  const resumeSection = !target && saved && !saved.finishedAt && saved.percent > 0.03 ? doc.sections.find((s) => s.id === saved.section) : null;
  const [resumeDismissed, setResumeDismissed] = useState(false);
  const showResume = ready && resumeSection && !resumeDismissed && live.percent < 0.1;

  const changeScale = (delta) => {
    const index = FONT_SCALES.indexOf(scale) + delta;
    if (index >= 0 && index < FONT_SCALES.length) setFontScale(FONT_SCALES[index]);
  };

  const renderHeading = (block) => {
    if (block.level !== 2) {
      const Tag = `h${block.level}`;
      return (
        <Tag id={block.id} className={`md-h md-h--${block.level}`}>
          <Inline nodes={block.children} />
        </Tag>
      );
    }
    const marked = bookmarks.has(block.id);
    const title = doc.sections.find((s) => s.id === block.id)?.title ?? block.id;
    return (
      <div className="md-section-head">
        <h2 id={block.id} className="md-h md-h--2">
          <Inline nodes={block.children} />
        </h2>
        <IconButton
          icon={marked ? BookmarkCheck : BookmarkPlus}
          label={marked ? `Quitar el marcador de «${title}»` : `Poner un marcador en «${title}»`}
          size="sm"
          className={cx('md-bookmark', marked && 'is-marked')}
          aria-pressed={marked}
          onClick={() => toggleBookmark(doc.id, block.id, title)}
        />
      </div>
    );
  };

  return (
    <div className="page reader" style={{ '--reader-scale': scale }}>
      <div
        className="reader-progress"
        role="progressbar"
        aria-label="Progreso de lectura"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(live.percent * 100)}
      >
        <span style={{ transform: `scaleX(${live.percent})` }} />
      </div>

      <nav className="reader-crumbs" aria-label="Ruta">
        <ol>
          <li>
            <Link to="/documentos">Biblioteca</Link>
          </li>
          <li>{shelf.short}</li>
          <li aria-current="page">{path.title}</li>
        </ol>
      </nav>

      <header className="reader-header">
        <p className="eyebrow">
          Capítulo {position.index} de {position.total} · {shelf.short}
        </p>
        <h1 className="reader-header__title">{doc.title}</h1>
        <p className="reader-header__lead">{doc.description}</p>
        <p className="reader-header__meta">
          <span>
            <Clock aria-hidden="true" /> {doc.minutes} min de lectura
          </span>
          <span>{difficultyLabel(doc.difficulty)}</span>
          <span>{doc.words.toLocaleString('es')} palabras</span>
          {saved?.finishedAt && (
            <span className="lib-doc__status is-done">
              <CircleCheck aria-hidden="true" /> Leído
            </span>
          )}
        </p>
        <div className="reader-actions">
          <Button variant={favorite ? 'primary' : 'secondary'} size="sm" icon={Star} aria-pressed={favorite} onClick={() => toggleFavorite(doc.id)}>
            {favorite ? 'En favoritos' : 'Añadir a favoritos'}
          </Button>
          <span className="reader-actions__scale" role="group" aria-label="Tamaño del texto">
            <IconButton icon={AArrowDown} label="Texto más pequeño" size="sm" variant="secondary" disabled={scale === FONT_SCALES[0]} onClick={() => changeScale(-1)} />
            <IconButton
              icon={AArrowUp}
              label="Texto más grande"
              size="sm"
              variant="secondary"
              disabled={scale === FONT_SCALES[FONT_SCALES.length - 1]}
              onClick={() => changeScale(1)}
            />
          </span>
        </div>
      </header>

      {showResume && (
        <div className="reader-resume" role="status">
          <p>
            Lo dejaste en <strong>«{resumeSection.title}»</strong> ({Math.round(saved.percent * 100)} %).
          </p>
          <div className="reader-resume__actions">
            <Button
              size="sm"
              onClick={() => {
                jump(resumeSection.id);
                setResumeDismissed(true);
              }}
            >
              Seguir donde lo dejé
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setResumeDismissed(true)}>
              Empezar desde arriba
            </Button>
          </div>
        </div>
      )}

      <div className="reader-layout">
        <TableOfContents doc={doc} current={current} bookmarks={bookmarks} onJump={jump} wide={wide} />

        <article ref={articleRef} className="reader-body" aria-label={doc.title} lang="es">
          {error && (
            <p className="reader-error" role="alert">
              No se pudo abrir este documento. Vuelve a intentarlo; si la app se acaba de actualizar, recárgala.
            </p>
          )}
          {!blocks && !error && (
            <p className="reader-loading" role="status">
              Abriendo el libro…
            </p>
          )}
          {blocks && <Blocks blocks={blocks} renderHeading={renderHeading} />}
        </article>
      </div>

      {blocks && (
        <footer className="reader-footer">
          <nav className="reader-pager" aria-label="Capítulos">
            {previous ? (
              <Link to={`/documentos/${previous.id}`} className="reader-pager__link">
                <ChevronLeft aria-hidden="true" />
                <span>
                  <span className="reader-pager__label">Anterior</span>
                  <span className="reader-pager__title">{previous.title}</span>
                </span>
              </Link>
            ) : (
              <span />
            )}
            {next && (
              <Link to={`/documentos/${next.id}`} className="reader-pager__link reader-pager__link--next">
                <span>
                  <span className="reader-pager__label">Siguiente</span>
                  <span className="reader-pager__title">{next.title}</span>
                </span>
                <ChevronRight aria-hidden="true" />
              </Link>
            )}
          </nav>
          {related.length > 0 && (
            <section className="reader-related" aria-labelledby="reader-related-title">
              <h2 id="reader-related-title" className="lib-path__title">
                Lecturas relacionadas
              </h2>
              <DocumentList docs={related} state={state} numbered={false} showShelf />
            </section>
          )}
          <div className="reader-footer__actions">
            <Button variant="ghost" size="sm" icon={ArrowUp} onClick={() => window.scrollTo({ top: 0 })}>
              Volver arriba
            </Button>
            <Button to="/documentos" variant="secondary" size="sm">
              Volver a la biblioteca
            </Button>
          </div>
        </footer>
      )}
    </div>
  );
}
