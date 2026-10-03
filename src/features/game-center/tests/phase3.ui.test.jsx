import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../app/App.jsx';
import { createDefaultPreferences } from '../../../services/preferences/defaults.js';
import { PREFERENCES_KEY } from '../../../services/preferences/preferencesService.js';
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
  hexastack: ['Abrir en CrazyGames', 'https://www.crazygames.com/game/hexa-stack'],
  'traffic-rider': ['Abrir en CrazyGames', 'https://www.crazygames.com/game/traffic-rider-vvq'],
  'frente-abierto': ['Abrir en OpenFront.io', 'https://openfront.io/'],
};

const FIRST_SCREEN = {
  hexastack: () => screen.findByRole('heading', { name: 'Apila, junta y despeja' }),
  'traffic-rider': () => screen.findByRole('heading', { name: 'A la carretera' }),
  'frente-abierto': () => screen.findByRole('heading', { name: 'Estrategia territorial por turnos' }),
  'saltos-de-lumi': () => screen.findByRole('heading', { name: 'Una chispa en busca de su vela' }),
};

describe('Fase 3 en la biblioteca', () => {
  it.each(GAMES.filter((g) => g.phase === 3).map((g) => [g.title, g.id]))('«%s» se abre y empieza en su versión local', async (_, id) => {
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

describe('Frente Abierto (interfaz)', () => {
  it('tutorial: refuerzos, ataque con el resultado visible antes de confirmar y turno de la IA', async () => {
    const user = await openGame('frente-abierto');
    await user.click(screen.getByRole('button', { name: 'Jugar', exact: true }));
    await user.click(await screen.findByRole('button', { name: /^Tutorial/ }));
    expect(screen.getByRole('status')).toHaveTextContent(/Refuerzos: te quedan \d+/);
    const mine = screen.getAllByRole('gridcell', { name: /^Tú/ });
    const before = mine.length;
    await user.click(mine[1]);
    await user.click(screen.getByRole('button', { name: /Todos aquí/ }));
    expect(screen.getByRole('status')).toHaveTextContent(/vecino marcado/);
    // Elegir un destino atacable: el panel muestra el resultado antes de confirmar.
    const target = screen.getAllByRole('gridcell').find((cell) => /Puedes atacar aquí/.test(cell.getAttribute('aria-label')));
    await user.click(target);
    expect(screen.getByText(/Conquistas el territorio|No basta/)).toBeInTheDocument();
    const preview = screen.getByText(/Conquistas el territorio|No basta/).textContent;
    await user.click(screen.getByRole('button', { name: /^(Atacar|Mover)$/ }));
    if (preview.startsWith('Conquistas')) expect(screen.getAllByRole('gridcell', { name: /^Tú/ })).toHaveLength(before + 1);
    // Terminar el turno: juega la IA y vuelve el turno a la persona (turno 2).
    await user.click(screen.getByRole('button', { name: 'Terminar turno' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/Refuerzos/), { timeout: 8000 });
    expect(screen.getByText('Turno', { selector: 'dt' }).nextElementSibling).toHaveTextContent('2');
  }, 15000);
});

describe('Saltos de Lumi (interfaz)', () => {
  it('solo el primer nivel está abierto y se juega en un lienzo con su presentación', async () => {
    const user = await openGame('saltos-de-lumi');
    await user.click(screen.getByRole('button', { name: 'Jugar', exact: true }));
    expect(await screen.findByRole('button', { name: /^Nivel 2:.*Bloqueado/ })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /^Nivel 1:/ }));
    expect(await screen.findByRole('img', { name: /Nivel 1: Primeros pasos/ })).toBeInTheDocument();
    expect(screen.getByText('Corre, salta los huecos y pisa a la sombra desde arriba.')).toBeInTheDocument();
    expect(document.querySelector('iframe')).toBeNull();
  });
});
