import { beforeAll, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { createRecord, ensureLoaded, getRecord, listKind } from '../data/store.js';
import { todayISO } from '../shared/format.js';
import { addDays, weekdayOf } from '../data/recurrence.js';
import { openApp, preloadOrganizerPages } from './helpers.jsx';

beforeAll(() => preloadOrganizerPages(), 120_000);

const dialog = () => screen.getAllByRole('dialog').at(-1);

describe('Calendario: interfaz', () => {
  it('crea un evento con aviso de solape y lo muestra en el día, y lo completa desde el detalle', async () => {
    const today = todayISO();
    await ensureLoaded();
    await createRecord('subject', { name: 'Cálculo', schedule: [{ weekday: weekdayOf(today), start: '08:00', end: '10:00' }] });
    const { user } = await openApp('#/calendario');
    expect(await screen.findByRole('heading', { level: 1, name: 'Calendario' })).toBeInTheDocument();
    // La clase de hoy aparece sin haber creado ningún evento.
    const board = await screen.findByRole('region', { name: /^[A-Z]/ });
    expect(within(board).getByRole('button', { name: /Cálculo/ })).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: 'Nuevo evento' })[0]);
    await user.type(within(dialog()).getByLabelText('Título'), 'Monitoría');
    await user.type(within(dialog()).getByLabelText('Hora de inicio'), '09:00');
    await user.type(within(dialog()).getByLabelText('Hora de fin'), '09:30');
    expect(await within(dialog()).findByText(/Se cruza con: Cálculo/)).toBeInTheDocument();
    await user.click(within(dialog()).getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(listKind('event')).toHaveLength(1));

    await user.click(within(board).getByRole('button', { name: /Monitoría/ }));
    await user.click(within(dialog()).getByRole('button', { name: 'Completar' }));
    await waitFor(() => expect(listKind('event')[0].status).toBe('completed'));
  });

  it('tareas: alta rápida, subtareas desde el formulario y completar', async () => {
    const { user } = await openApp('#/calendario/tareas');
    await user.type(await screen.findByLabelText('Tarea rápida'), 'Comprar el libro{Enter}');
    await waitFor(() => expect(listKind('task')).toHaveLength(1));
    const task = listKind('task')[0];
    await user.click(screen.getByRole('checkbox', { name: 'Completar «Comprar el libro»' }));
    await waitFor(() => expect(getRecord(task.id).status).toBe('done'));
    expect(getRecord(task.id).completedAt).toBeTruthy();
  });

  it('universidad: una entrega aparece en la agenda y una materia con actividades se puede eliminar sin perderlas', async () => {
    await ensureLoaded();
    const subject = await createRecord('subject', { name: 'Física' });
    await createRecord('activity', { subjectId: subject.id, type: 'exam', title: 'Parcial 1', dueDate: addDays(todayISO(), 3) });
    const { user } = await openApp('#/calendario/universidad');
    expect(await screen.findByRole('button', { name: /Examen: Parcial 1/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Acciones de Física' }));
    await user.click(screen.getAllByRole('button', { name: 'Eliminar' })[0]);
    expect(await within(dialog()).findByText(/Se conservarán y solo perderán el vínculo: 1 actividad académica/)).toBeInTheDocument();
    await user.click(within(dialog()).getByRole('button', { name: 'Eliminar' }));
    await waitFor(() => expect(listKind('subject')).toHaveLength(0));
    expect(listKind('activity')[0]).toMatchObject({ title: 'Parcial 1', subjectId: null });
  });
});
