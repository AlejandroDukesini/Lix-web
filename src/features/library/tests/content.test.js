/**
 * Control de calidad del contenido: cada documento de la biblioteca debe ser un
 * capítulo completo (extensión, estructura, glosario y fuentes), no un resumen.
 */
import { describe, expect, it } from 'vitest';
import { buildLibraryIndex } from '../../../../scripts/vite-plugin-library.js';
import { DIFFICULTIES, SHELVES } from '../registry/shelves.js';
import { DOCUMENTS, GLOSSARY, findDocument } from '../registry/catalog.js';

/** ~5 páginas reales de lectura (≈ 500 palabras por página impresa). */
export const MIN_WORDS = 2500;
const MIN_SECTIONS = 6;
const MIN_GLOSSARY = 4;
const MIN_SOURCES = 3;

const INDEX = buildLibraryIndex();

describe('contenido de la biblioteca', () => {
  it('cada archivo tiene metadatos válidos y llega al catálogo', () => {
    for (const doc of INDEX) {
      expect(doc.id, doc.file).toMatch(/^[a-z0-9][a-z0-9-]{0,63}$/);
      expect(doc.title, doc.file).toBeTruthy();
      expect(doc.description?.length, doc.file).toBeGreaterThan(60);
      const shelf = SHELVES.find((s) => s.id === doc.category);
      expect(shelf, `${doc.file}: estante «${doc.category}»`).toBeTruthy();
      expect(shelf.paths.map((p) => p.id), `${doc.file}: recorrido «${doc.path}»`).toContain(doc.path);
      expect(DIFFICULTIES.map((d) => d.id), doc.file).toContain(doc.difficulty);
      expect(Number.isInteger(doc.order), doc.file).toBe(true);
      expect(doc.file.startsWith(`${doc.category}/`), `${doc.file} debe estar en la carpeta de su estante`).toBe(true);
    }
    expect(DOCUMENTS).toHaveLength(INDEX.length);
  });

  it('los ids son únicos y el orden dentro de cada recorrido no se repite', () => {
    expect(new Set(INDEX.map((d) => d.id)).size).toBe(INDEX.length);
    const orders = INDEX.map((d) => `${d.category}/${d.path}/${d.order}`);
    expect(new Set(orders).size).toBe(orders.length);
  });

  it.each(INDEX.map((doc) => [doc.id, doc]))('«%s» es un capítulo completo', (_id, doc) => {
    expect(doc.words, 'extensión mínima').toBeGreaterThanOrEqual(MIN_WORDS);
    expect(doc.hasIntro, 'introducción narrativa antes de la primera sección').toBe(true);
    expect(doc.sections.length, 'secciones').toBeGreaterThanOrEqual(MIN_SECTIONS);
    expect(doc.sections.at(-2)?.title).toBe('Conceptos importantes');
    expect(doc.sections.at(-1)?.title).toBe('Fuentes y lecturas');
    expect(doc.glossary.length, 'conceptos importantes').toBeGreaterThanOrEqual(MIN_GLOSSARY);
    expect(doc.sourceCount, 'fuentes').toBeGreaterThanOrEqual(MIN_SOURCES);
    for (const id of doc.related ?? []) expect(findDocument(id), `relacionado «${id}»`).toBeTruthy();
  });

  it('el glosario reúne los conceptos de todos los documentos', () => {
    expect(GLOSSARY.length).toBe(INDEX.reduce((n, d) => n + d.glossary.length, 0));
  });
});
