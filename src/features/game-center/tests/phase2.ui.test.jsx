import { describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../app/App.jsx';
import { createDefaultPreferences } from '../../../services/preferences/defaults.js';
import { PREFERENCES_KEY } from '../../../services/preferences/preferencesService.js';
import { readGameRecord } from '../services/gameStorage.js';
import { GAMES } from '../registry/gameRegistry.js';

async function openGame(id) {
  const prefs = createDefaultPreferences();
  prefs.presentation.completed = true;
  localStorage.setItem(PREFERENCES_KEY, JSON.stringify(prefs));
  window.location.hash = `#/juegos/${id}`;
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole('button', { name: 'Jugar', exact: true });
  return user;
}

const ONLINE = {
  'cruce-del-pollo': ['Abrir en CrazyGames', 'https://www.crazygames.com/game/go-chicken-go'],
  sudokus: ['Abrir en Sudoku.com', 'https://sudoku.com/'],
  aparcar: ['Abrir en Poki', 'https://poki.com/es/g/extreme-car-parking'],
  despejar: ['Abrir en Poki', 'https://poki.com/es/g/car-parking-jam'],
};

// Lo primero que se ve al pulsar «Jugar» en cada juego (siempre la versión local, sin iframe).
const FIRST_SCREEN = {
  'cruce-del-pollo': () => screen.findByRole('img', { name: /gallina/ }),
  'resolver-casos': () => screen.findByRole('heading', { name: 'Expedientes abiertos' }),
  sudokus: () => screen.findByRole('heading', { name: 'Elige la dificultad' }),
  aparcar: () => screen.findByRole('heading', { name: 'Elige un aparcamiento' }),
  despejar: () => screen.findByRole('heading', { name: 'Elige un aparcamiento' }),
};

describe('Fase 2 en la biblioteca', () => {
  it.each(GAMES.filter((g) => g.phase === 2).map((g) => [g.title, g.id]))('«%s» se abre y empieza en su versión local', async (_, id) => {
    const user = await openGame(id);
    if (ONLINE[id]) {
      const [label, url] = ONLINE[id];
      expect(screen.getByRole('link', { name: label })).toHaveAttribute('href', url);
    } else {
      expect(screen.queryByRole('group', { name: 'Modalidad de juego' })).toBeNull();
      expect(screen.getByText(/Versión online: no disponible/)).toBeInTheDocument();
    }
    await user.click(screen.getByRole('button', { name: 'Jugar', exact: true }));
    expect(await FIRST_SCREEN[id]()).toBeInTheDocument();
    expect(document.querySelector('iframe')).toBeNull();
  });
});

describe('Resolver casos (interfaz)', () => {
  it('se investiga, se falla sin perder nada y se resuelve el primer caso; se guarda el progreso', async () => {
    const user = await openGame('resolver-casos');
    await user.click(screen.getByRole('button', { name: 'Jugar', exact: true }));
    await user.click(await screen.findByRole('button', { name: /^Caso 1:/ }));
    // Sin investigar no se puede acusar.
    await user.click(screen.getByRole('tab', { name: 'Resolver' }));
    expect(screen.getByRole('button', { name: 'Presentar conclusión' })).toBeDisabled();
    // Examinar el escenario.
    await user.click(screen.getByRole('tab', { name: 'Escena' }));
    for (const name of ['Plato vacío', 'Suelo junto a la mesa', 'Puerta del jardín', 'Encimera']) {
      await user.click(screen.getByRole('button', { name: new RegExp(`^${name}`) }));
    }
    expect(screen.getByText(/Pista nueva: Ticket de la tienda/)).toBeInTheDocument();
    // Interrogar a todos.
    await user.click(screen.getByRole('tab', { name: 'Expediente' }));
    while (screen.queryAllByRole('button', { name: 'Interrogar' }).length) {
      await user.click(screen.getAllByRole('button', { name: 'Interrogar' })[0]);
    }
    expect(screen.getByText(/No pisé la cocina/)).toBeInTheDocument();
    // Conclusión equivocada: aviso, sin borrar el expediente.
    await user.click(screen.getByRole('tab', { name: 'Resolver' }));
    const solve = screen.getByRole('tabpanel', { name: 'Resolver' });
    await user.click(within(solve).getByRole('radio', { name: 'Bruno' }));
    await user.click(within(solve).getByRole('radio', { name: 'Huellas de barro' }));
    await user.click(within(solve).getByRole('button', { name: 'Presentar conclusión' }));
    expect(await within(solve).findByRole('alert')).toHaveTextContent('no coincide con las evidencias');
    // La correcta.
    await user.click(within(solve).getByRole('radio', { name: 'Tomás' }));
    await user.click(within(solve).getByRole('button', { name: 'Presentar conclusión' }));
    expect(await screen.findByText('Caso resuelto')).toBeInTheDocument();
    await waitFor(async () => expect((await readGameRecord('resolver-casos')).progress.solved.pastel).toBe(2));
  });
});

describe('Sudokus (interfaz)', () => {
  it('escribir en una casilla vacía y salir deja la partida guardada para continuar', async () => {
    const user = await openGame('sudokus');
    await user.click(screen.getByRole('button', { name: 'Jugar', exact: true }));
    await user.click(await screen.findByRole('button', { name: /^Fácil/ }));
    const empty = screen.getAllByRole('button', { name: /vacía$/ })[0];
    await user.click(empty);
    await user.click(screen.getByRole('button', { name: /^Escribir 5/ }));
    expect(screen.getAllByRole('button', { name: /: 5/ }).length).toBeGreaterThan(0);
    // Las casillas del enunciado no se pueden cambiar.
    await user.click(screen.getAllByRole('button', { name: /, fija$/ })[0]);
    await user.click(screen.getByRole('button', { name: /^Escribir 1/ }));
    expect(screen.getByText('Esa casilla es del enunciado: no se puede cambiar.')).toBeInTheDocument();
    await waitFor(async () => expect((await readGameRecord('sudokus')).settings.current?.difficulty).toBe('facil'), { timeout: 3000 });
  });
});
