import { beforeAll, describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { openApp, preloadOrganizerPages } from './helpers.jsx';
import { __resetOrganizerForTests, createRecord, ensureLoaded, listKind } from '../data/store.js';

beforeAll(() => preloadOrganizerPages(), 120_000);

const dialog = () => screen.getByRole('dialog');

describe('Finanzas: interfaz', () => {
  it('guía a crear una cuenta, registra un gasto rápido y lo refleja en el resumen tras recargar', async () => {
    const { user, unmount } = await openApp('#/finanzas');
    expect(await screen.findByRole('heading', { level: 1, name: 'Finanzas' })).toBeInTheDocument();
    await user.click(await screen.findByRole('link', { name: 'Crear mi primera cuenta' }));

    await user.click(await screen.findByRole('button', { name: 'Nueva cuenta' }));
    await user.type(within(dialog()).getByLabelText('Nombre'), 'Billetera');
    await user.selectOptions(within(dialog()).getByLabelText('Tipo'), 'cash');
    await user.type(within(dialog()).getByLabelText('Saldo inicial'), '100.000');
    await user.click(within(dialog()).getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByRole('heading', { level: 3, name: 'Billetera' })).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: 'Gasto rápido' })[0]);
    await user.type(within(dialog()).getByLabelText('Valor'), '12.500');
    await user.selectOptions(within(dialog()).getByLabelText('Categoría'), 'seed-cat-mercado');
    await user.click(within(dialog()).getByRole('button', { name: 'Registrar' }));
    await waitFor(() => expect(listKind('transaction')).toHaveLength(1));
    expect(listKind('transaction')[0]).toMatchObject({ type: 'expense', amount: 1250000, categoryId: 'seed-cat-mercado', status: 'completed' });

    // «Recarga»: memoria vacía y nueva lectura de IndexedDB.
    unmount();
    __resetOrganizerForTests();
    await openApp('#/finanzas');
    const figures = await screen.findByRole('region', { name: 'Situación actual' });
    expect(within(figures).getByText('Balance actual').nextSibling).toHaveTextContent('87.500');
    expect(screen.getByText('Alimentación')).toBeInTheDocument();
  });

  it('valida el formulario y no guarda un importe inválido', async () => {
    await ensureLoaded();
    await createRecord('account', { name: 'Banco', openingDate: '2026-01-01' });
    const { user } = await openApp('#/finanzas/movimientos');
    await user.click((await screen.findAllByRole('button', { name: 'Movimiento' }))[0]);
    await user.type(within(dialog()).getByLabelText('Valor'), 'abc');
    await user.click(within(dialog()).getByRole('button', { name: 'Registrar' }));
    expect(await within(dialog()).findByText('El valor no es un importe válido.')).toBeInTheDocument();
    expect(listKind('transaction')).toHaveLength(0);
  });

  it('no permite borrar una cuenta con movimientos y ofrece archivarla', async () => {
    await ensureLoaded();
    const bank = await createRecord('account', { name: 'Banco', openingDate: '2026-01-01' });
    await createRecord('transaction', { type: 'expense', amount: 100, date: '2026-01-02', accountId: bank.id });
    const { user } = await openApp('#/finanzas/cuentas');
    await user.click(await screen.findByRole('button', { name: 'Acciones de Banco' }));
    await user.click(screen.getByRole('button', { name: 'Eliminar' }));
    expect(await screen.findByText(/No se puede eliminar porque 1 elemento depende/)).toBeInTheDocument();
    await user.click(within(dialog()).getByRole('button', { name: 'Archivar' }));
    await waitFor(() => expect(listKind('account')[0].archived).toBe(true));
  });
});
