import { beforeAll, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { createRecord, ensureLoaded, listKind } from '../../organizer/data/store.js';
import { openApp, preloadOrganizerPages } from '../../organizer/tests/helpers.jsx';

beforeAll(() => Promise.all([preloadOrganizerPages(), import('../AcademicPage.jsx')]), 120_000);

const dialog = () => screen.getAllByRole('dialog').at(-1);

describe('Control académico: interfaz', () => {
  it('crea una asignatura con aula, edificio y horario, y avisa del choque con otra', async () => {
    await ensureLoaded();
    await createRecord('subject', { name: 'Cálculo', schedule: [{ weekday: 1, start: '08:00', end: '10:00' }] });
    const { user } = await openApp('#/academico/asignaturas');
    expect(await screen.findByRole('heading', { level: 1, name: 'Control académico' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Nueva asignatura' }));
    const form = dialog();
    await user.type(within(form).getByLabelText('Nombre'), 'Física');
    await user.type(within(form).getByLabelText('Docente'), 'Marie Curie');
    await user.type(within(form).getByLabelText('Edificio'), 'Bloque B');
    await user.type(within(form).getByLabelText('Descripción'), 'Mecánica clásica');
    await user.click(within(form).getByRole('button', { name: 'Añadir clase' }));
    // La clase por defecto (lunes 07:00–09:00) choca con Cálculo.
    expect(await within(form).findByText(/Choque de horario: Lunes con Cálculo/)).toBeInTheDocument();
    await user.click(within(form).getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(listKind('subject')).toHaveLength(2));
    expect(listKind('subject').find((s) => s.name === 'Física')).toMatchObject({ building: 'Bloque B', description: 'Mecánica clásica', teacher: 'Marie Curie' });
    expect(await screen.findByText(/Hay un choque de horario/)).toBeInTheDocument();
  });

  it('registra un proyecto y una investigación (categorías nuevas) y los filtra por categoría', async () => {
    await ensureLoaded();
    const subject = await createRecord('subject', { name: 'Biología' });
    await createRecord('activity', { type: 'project', title: 'Huerto escolar', dueDate: '2099-01-10', subjectId: subject.id });
    await createRecord('activity', { type: 'research', title: 'Fotosíntesis', dueDate: '2099-01-11', subjectId: subject.id });
    const { user } = await openApp('#/academico/actividades');
    expect(await screen.findByText(/Huerto escolar/)).toBeInTheDocument();
    await user.click(within(screen.getByRole('group', { name: 'Categoría' })).getByRole('button', { name: /^Investigación/ }));
    expect(screen.queryByText(/Huerto escolar/)).not.toBeInTheDocument();
    expect(screen.getByText(/Fotosíntesis/)).toBeInTheDocument();
  });

  it('añade un festivo manual que se repite cada año', async () => {
    const { user } = await openApp('#/academico/calendario');
    await user.click(await screen.findByRole('button', { name: 'Festivo o evento' }));
    const form = dialog();
    await user.type(within(form).getByLabelText('Nombre'), 'Día de la Independencia');
    await user.clear(within(form).getByLabelText('Fecha'));
    await user.type(within(form).getByLabelText('Fecha'), '2026-07-20');
    await user.click(within(form).getByLabelText(/Se repite cada año/));
    await user.click(within(form).getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(listKind('academicDate')).toHaveLength(1));
    expect(listKind('academicDate')[0]).toMatchObject({ type: 'holiday', yearly: true, date: '2026-07-20' });
    expect(await screen.findByText('Día de la Independencia')).toBeInTheDocument();
  });

  it('cuaderno por asignatura: crea la nota en el cuaderno con el editor de Notas y la encuentra al buscar', async () => {
    await ensureLoaded();
    const subject = await createRecord('subject', { name: 'Historia' });
    const notebook = await createRecord('notebook', { name: 'Historia', subjectId: subject.id });
    await createRecord('note', { title: 'Revolución francesa', content: 'Toma de la Bastilla, 1789', notebookId: notebook.id, noteDate: '2026-11-02' });
    await createRecord('note', { title: 'Imperio romano', content: 'Augusto', notebookId: notebook.id, noteDate: '2026-11-09' });
    const { user } = await openApp(`#/academico/cuadernos/${notebook.id}`);
    expect(await screen.findByRole('heading', { level: 2, name: 'Historia' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Buscar en el cuaderno'), 'bastilla');
    expect(screen.getByText('Revolución francesa')).toBeInTheDocument();
    expect(screen.queryByText('Imperio romano')).not.toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Nueva nota' }));
    await waitFor(() => expect(listKind('note')).toHaveLength(3));
    const created = listKind('note').find((n) => n.title === '');
    expect(created).toMatchObject({ notebookId: notebook.id });
    expect(created.noteDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(await screen.findByRole('link', { name: /Cuaderno: Historia/ })).toBeInTheDocument();
  });
});
