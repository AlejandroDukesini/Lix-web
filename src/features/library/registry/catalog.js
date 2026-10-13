/**
 * Catálogo de la biblioteca: une la estructura de estantes (shelves.js) con el
 * índice que genera el plugin de Vite a partir de los .md (virtual:library-index).
 *
 * Todo aquí trabaja en memoria y sin el texto de los documentos; el texto se
 * carga con `loadDocumentSource(id)` solo al abrir uno.
 */
import INDEX from 'virtual:library-index';
import { normalizeText } from '../engine/markdown.js';
import { DIFFICULTIES, SHELVES, findShelf } from './shelves.js';

// Un import dinámico por archivo: cada documento es un recurso aparte, precacheado para leerlo sin conexión.
const SOURCES = import.meta.glob('../content/**/*.md', { query: '?raw', import: 'default' });

const shelfRank = (id) => SHELVES.findIndex((s) => s.id === id);
const pathRank = (shelfId, pathId) => findShelf(shelfId)?.paths.findIndex((p) => p.id === pathId) ?? -1;

/** Documentos válidos (con estante y recorrido conocidos), en orden de lectura recomendado. */
export const DOCUMENTS = INDEX.filter((doc) => doc.id && doc.title && pathRank(doc.category, doc.path) >= 0)
  .map((doc) => ({
    ...doc,
    keywords: doc.keywords ?? [],
    related: doc.related ?? [],
    difficulty: DIFFICULTIES.some((d) => d.id === doc.difficulty) ? doc.difficulty : 'inicial',
  }))
  .sort(
    (a, b) =>
      shelfRank(a.category) - shelfRank(b.category) ||
      pathRank(a.category, a.path) - pathRank(b.category, b.path) ||
      (a.order ?? 0) - (b.order ?? 0) ||
      a.title.localeCompare(b.title, 'es'),
  );

const BY_ID = new Map(DOCUMENTS.map((doc) => [doc.id, doc]));

export const findDocument = (id) => BY_ID.get(id) ?? null;

export function documentsOf(shelfId, pathId) {
  return DOCUMENTS.filter((doc) => doc.category === shelfId && (pathId === undefined || doc.path === pathId));
}

/** Posición dentro del estante completo: «capítulo 3 de 11». */
export function shelfPosition(doc) {
  const list = documentsOf(doc.category);
  return { index: list.indexOf(doc) + 1, total: list.length };
}

/** Anterior y siguiente en el orden de lectura del estante (cruza recorridos). */
export function neighbours(doc) {
  const list = documentsOf(doc.category);
  const i = list.indexOf(doc);
  return { previous: list[i - 1] ?? null, next: list[i + 1] ?? null };
}

/** Lecturas relacionadas: las indicadas en la cabecera; si no hay, las del mismo recorrido. */
export function relatedDocuments(doc, limit = 3) {
  const explicit = doc.related.map(findDocument).filter(Boolean);
  const fallback = documentsOf(doc.category, doc.path).filter((d) => d !== doc && !explicit.includes(d));
  return [...explicit, ...fallback].slice(0, limit);
}

const searchable = new Map(
  DOCUMENTS.map((doc) => [
    doc.id,
    normalizeText(
      [
        doc.title,
        doc.description,
        doc.keywords.join(' '),
        doc.sections.map((s) => s.title).join(' '),
        doc.glossary.map((g) => g.term).join(' '),
        findShelf(doc.category)?.label,
      ].join(' '),
    ),
  ]),
);

/**
 * Filtra el catálogo. La búsqueda ignora tildes y mayúsculas y exige que todas
 * las palabras aparezcan (en el título, la descripción, las secciones, las
 * palabras clave o los conceptos del glosario).
 */
export function searchDocuments({ query = '', shelf = 'all', difficulty = 'all' } = {}) {
  const terms = normalizeText(query).split(/\s+/).filter(Boolean);
  return DOCUMENTS.filter(
    (doc) =>
      (shelf === 'all' || doc.category === shelf) &&
      (difficulty === 'all' || doc.difficulty === difficulty) &&
      terms.every((term) => searchable.get(doc.id).includes(term)),
  );
}

/** Glosario de toda la biblioteca, ordenado alfabéticamente (sin tildes para ordenar). */
export const GLOSSARY = DOCUMENTS.flatMap((doc) =>
  doc.glossary.map((entry) => ({ ...entry, docId: doc.id, docTitle: doc.title, category: doc.category })),
).sort((a, b) => a.term.localeCompare(b.term, 'es', { sensitivity: 'base' }));

export function totalMinutes(docs = DOCUMENTS) {
  return docs.reduce((sum, doc) => sum + doc.minutes, 0);
}

/** Texto completo (Markdown) de un documento. */
export async function loadDocumentSource(id) {
  const doc = findDocument(id);
  const loader = doc && SOURCES[`../content/${doc.file}`];
  if (!loader) throw new Error(`No existe el documento «${id}».`);
  return loader();
}
