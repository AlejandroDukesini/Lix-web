import { describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../app/App.jsx';
import { createDefaultPreferences } from '../../../services/preferences/defaults.js';
import { PREFERENCES_KEY } from '../../../services/preferences/preferencesService.js';
import { DOCUMENTS, GLOSSARY, documentsOf } from '../registry/catalog.js';
import { SHELVES } from '../registry/shelves.js';
import { readLibraryState, saveProgress } from '../services/libraryStorage.js';

async function openApp(hash = '#/documentos') {
  const prefs = createDefaultPreferences();
  prefs.presentation.completed = true;
  localStorage.setItem(PREFERENCES_KEY, JSON.stringify(prefs));
  window.location.hash = hash;
  const user = userEvent.setup();
  render(<App />);
  return user;
}

const catalog = () => screen.getByRole('region', { name: 'Estantes' });
const docLinks = () => within(catalog()).queryAllByRole('link').filter((a) => !a.getAttribute('href').endsWith('/glosario'));
const first = DOCUMENTS[0];

describe('Biblioteca: catálogo', () => {
  it('se abre desde el inicio y muestra los cuatro estantes con su ex libris', async () => {
    const user = await openApp('#/');
    await screen.findByRole('heading', { level: 1, name: /Mi niña/ });
    await user.click(screen.getByRole('link', { name: 'Abrir la biblioteca' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Historias que enseñan' })).toBeInTheDocument();
    expect(screen.getByText('Ex libris')).toBeInTheDocument();
    for (const shelf of SHELVES) {
      if (documentsOf(shelf.id).length) expect(screen.getByRole('heading', { level: 2, name: shelf.label })).toBeInTheDocument();
    }
    expect(docLinks()).toHaveLength(DOCUMENTS.length);
  });

  it('busca sin tildes, filtra por estante y por dificultad', async () => {
    const user = await openApp();
    const search = await screen.findByRole('searchbox', { name: 'Buscar en la biblioteca' });
    await user.type(search, 'locard');
    expect(docLinks().length).toBeGreaterThan(0);
    expect(docLinks().length).toBeLessThan(DOCUMENTS.length + 1);
    await user.clear(search);
    await user.type(search, 'zzzz');
    expect(screen.getByText('No hay capítulos que coincidan')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Ver toda la biblioteca' }));

    await user.click(screen.getByRole('button', { name: 'Criminalística' }));
    expect(docLinks()).toHaveLength(documentsOf('criminalistica').length);

    await user.click(screen.getByRole('radio', { name: 'Avanzado' }));
    expect(docLinks()).toHaveLength(documentsOf('criminalistica').filter((d) => d.difficulty === 'avanzado').length);
  });

  it('muestra «Seguir leyendo» con el último documento empezado', async () => {
    await saveProgress(first.id, { percent: 0.4, section: first.sections[1].id });
    await openApp();
    const section = await screen.findByRole('region', { name: first.title });
    expect(within(section).getByText(/40 %/)).toBeInTheDocument();
    expect(within(section).getByRole('link', { name: 'Continuar' })).toHaveAttribute(
      'href',
      `#/documentos/${first.id}?seccion=${first.sections[1].id}`,
    );
  });
});

describe('Biblioteca: lector', () => {
  it('abre un documento completo con índice, favoritos, marcadores y tamaño de texto', async () => {
    const user = await openApp(`#/documentos/${first.id}`);
    expect(await screen.findByRole('heading', { level: 1, name: first.title })).toBeInTheDocument();
    // El texto llega por carga diferida.
    expect(await screen.findByRole('heading', { level: 2, name: first.sections[0].title })).toBeInTheDocument();
    const toc = screen.getByRole('navigation', { name: 'Índice del documento' });
    expect(within(toc).getAllByRole('link')).toHaveLength(first.sections.length);
    expect(screen.getByRole('heading', { level: 2, name: 'Conceptos importantes' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Añadir a favoritos' }));
    expect(await screen.findByRole('button', { name: 'En favoritos' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: `Poner un marcador en «${first.sections[0].title}»` }));
    expect(await screen.findByRole('button', { name: `Quitar el marcador de «${first.sections[0].title}»` })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Texto más grande' }));
    await waitFor(async () => expect((await readLibraryState()).settings.fontScale).toBe(1.1));

    const state = await readLibraryState();
    expect(state.favorites).toEqual([first.id]);
    expect(state.bookmarks[0]).toMatchObject({ docId: first.id, sectionId: first.sections[0].id });
  });

  it('las recreaciones literarias se distinguen de los hechos', async () => {
    await openApp(`#/documentos/${first.id}`);
    await screen.findByRole('heading', { level: 2, name: first.sections[0].title });
    expect(screen.getAllByText('Recreación literaria').length).toBeGreaterThan(0);
  });

  it('un documento inexistente vuelve a la biblioteca', async () => {
    await openApp('#/documentos/no-existe');
    expect(await screen.findByRole('heading', { level: 1, name: 'Historias que enseñan' })).toBeInTheDocument();
  });
});

describe('Biblioteca: glosario', () => {
  it('reúne los conceptos, busca y enlaza con su documento', async () => {
    const user = await openApp('#/documentos/glosario');
    expect(await screen.findByRole('heading', { level: 1, name: 'Conceptos importantes' })).toBeInTheDocument();
    const entry = GLOSSARY[0];
    await user.type(screen.getByRole('searchbox', { name: 'Buscar en el glosario' }), entry.term);
    const term = screen.getAllByText(entry.term, { selector: 'dt' })[0];
    const link = within(term.parentElement).getByRole('link');
    expect(link).toHaveAttribute('href', `#/documentos/${entry.docId}?seccion=conceptos-importantes`);
  });
});
