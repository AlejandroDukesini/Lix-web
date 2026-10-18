import { beforeAll, describe, expect, it } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { MarkdownView } from '../shared/MarkdownView.jsx';
import { isSafeUrl, parseMarkdown, taskProgress, toggleTaskLine } from '../shared/markdown.js';
import { removeTag, renameTag, tagCounts } from '../data/tags.js';
import { createRecord, ensureLoaded, getRecord, listKind, __resetOrganizerForTests, updateRecord } from '../data/store.js';
import { emptyTrash, moveToTrash } from '../shared/lifecycle.js';
import { openApp, preloadOrganizerPages } from './helpers.jsx';

beforeAll(() => preloadOrganizerPages(), 120_000);

describe('Markdown seguro', () => {
  it('nunca interpreta HTML ni enlaces peligrosos', () => {
    const { container } = render(
      <MarkdownView
        source={'<script>alert(1)</script>\n<img src=x onerror=alert(1)>\n[clic](javascript:alert(1)) [bien](https://example.org) **<b>negrita</b>**'}
      />,
    );
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('b')).toBeNull();
    expect(container.textContent).toContain('<script>alert(1)</script>');
    const links = container.querySelectorAll('a');
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute('href')).toBe('https://example.org');
    expect(links[0].getAttribute('rel')).toBe('noopener noreferrer');
    expect(isSafeUrl('JAVASCRIPT:alert(1)')).toBe(false);
    expect(isSafeUrl('data:text/html,hola')).toBe(false);
  });

  it('títulos, listas, casillas, citas y código', () => {
    const blocks = parseMarkdown('# Hola\n\n- uno\n- dos\n\n- [ ] leer\n- [x] escribir\n\n> cita\n\n```\ncódigo *sin* formato\n```');
    expect(blocks.map((b) => b.type)).toEqual(['heading', 'list', 'list', 'quote', 'code']);
    expect(blocks[2].items.map((i) => i.checked)).toEqual([false, true]);
    expect(blocks[4].text).toBe('código *sin* formato');
    const source = '- [ ] leer\n- [x] escribir';
    expect(toggleTaskLine(source, 0)).toBe('- [x] leer\n- [x] escribir');
    expect(taskProgress(source)).toEqual({ done: 1, total: 2 });
  });
});

describe('etiquetas', () => {
  it('cuenta, renombra (fusionando) y quita sin borrar registros', async () => {
    await ensureLoaded();
    const a = await createRecord('note', { title: 'a', tags: ['Uni', 'ideas'] });
    const b = await createRecord('note', { title: 'b', tags: ['uni'] });
    expect(tagCounts(listKind('note'))).toEqual([
      { tag: 'Uni', count: 2 },
      { tag: 'ideas', count: 1 },
    ]);
    await renameTag(['note'], 'ideas', 'uni');
    expect(getRecord(a.id).tags).toEqual(['Uni']);
    await removeTag(['note'], 'UNI');
    expect(getRecord(b.id)).toMatchObject({ title: 'b', tags: [] });
  });
});

describe('papelera', () => {
  it('vaciar la papelera elimina solo lo que está en ella y desvincula el diario', async () => {
    await ensureLoaded();
    const keep = await createRecord('note', { title: 'queda' });
    const gone = await createRecord('note', { title: 'se va' });
    const entry = await createRecord('journalEntry', { body: 'hoy', writtenAt: new Date().toISOString(), eventDate: '2026-03-01', relatedNoteIds: [gone.id] });
    await moveToTrash(gone.id);
    expect(await emptyTrash('note')).toBe(1);
    expect(getRecord(keep.id)).not.toBeNull();
    expect(getRecord(gone.id)).toBeNull();
    expect(getRecord(entry.id).relatedNoteIds).toEqual([]);
  });
});

describe('Notas: interfaz', () => {
  it('crea una nota, la guarda sola y sigue ahí tras recargar; papelera y restaurar', async () => {
    const { user, unmount } = await openApp('#/notas/nueva');
    const title = await screen.findByLabelText('Título');
    await user.type(title, 'Lista del mercado');
    await user.type(screen.getByLabelText('Contenido'), '- [[ ] pan');
    await waitFor(() => expect(listKind('note')[0]).toMatchObject({ title: 'Lista del mercado', content: '- [ ] pan' }), { timeout: 4000 });
    expect(await screen.findByText('Guardado')).toBeInTheDocument();
    const id = listKind('note')[0].id;

    unmount();
    __resetOrganizerForTests();
    const second = await openApp('#/notas');
    expect(await screen.findByText('Lista del mercado')).toBeInTheDocument();
    await second.user.click(screen.getByRole('button', { name: 'Acciones de «Lista del mercado»' }));
    await second.user.click(screen.getByRole('button', { name: 'Mover a la papelera' }));
    await waitFor(() => expect(getRecord(id).trashedAt).not.toBeNull());
    expect(screen.queryByText('Lista del mercado')).toBeNull();
    await second.user.click(screen.getByRole('button', { name: /Papelera/ }));
    await second.user.click(await screen.findByRole('button', { name: 'Acciones de «Lista del mercado»' }));
    await second.user.click(screen.getByRole('button', { name: 'Restaurar' }));
    await waitFor(() => expect(getRecord(id).trashedAt).toBeNull());
  });

  it('una nota nueva abandonada vacía no se queda guardada', async () => {
    const { user } = await openApp('#/notas/nueva');
    await screen.findByLabelText('Título');
    expect(listKind('note')).toHaveLength(1);
    await user.click(screen.getByRole('link', { name: 'Todas las notas' }));
    await waitFor(() => expect(listKind('note')).toHaveLength(0));
  });

  it('ofrece recuperar un borrador que no llegó a guardarse', async () => {
    await ensureLoaded();
    const note = await createRecord('note', { title: 'Ideas', content: 'versión guardada' });
    localStorage.setItem(`uamc:draft:${note.id}`, JSON.stringify({ fields: { ...note, content: 'versión sin guardar' }, at: new Date(Date.now() + 1000).toISOString() }));
    const { user } = await openApp(`#/notas/${note.id}`);
    await user.click(await screen.findByRole('button', { name: 'Recuperar borrador' }));
    await waitFor(() => expect(getRecord(note.id).content).toBe('versión sin guardar'), { timeout: 4000 });
    expect(localStorage.getItem(`uamc:draft:${note.id}`)).toBeNull();
  });

  it('adopta cambios externos cuando no hay nada pendiente', async () => {
    await ensureLoaded();
    const note = await createRecord('note', { title: 'Sincronía', content: 'uno' });
    await openApp(`#/notas/${note.id}`);
    await screen.findByDisplayValue('Sincronía');
    await act(() => updateRecord(note.id, { title: 'Sincronía 2' }));
    expect(await screen.findByDisplayValue('Sincronía 2')).toBeInTheDocument();
  });
});
