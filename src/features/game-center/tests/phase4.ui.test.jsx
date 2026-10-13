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
  await user.click(screen.getByRole('button', { name: 'Jugar', exact: true }));
  return user;
}

const FIRST_SCREEN = {
  'reino-de-ladrillos': () => screen.findByRole('heading', { name: 'Cuatro tramos hasta el último observatorio' }),
  bloques: () => screen.findByRole('heading', { name: 'Encaja el cielo, línea a línea' }),
  'lava-y-agua': () => screen.findByRole('heading', { name: 'Encuentra la ruta segura' }),
  stellarium: () => screen.findByRole('img', { name: /Cielo nocturno/ }),
  heladeria: () => screen.findByRole('heading', { name: 'Helados a la carta' }),
  pizzeria: () => screen.findByRole('heading', { name: 'Pizzas por encargo' }),
  pasteleria: () => screen.findByRole('heading', { name: 'Pasteles por encargo' }),
};

describe('Fase 4 en la biblioteca', () => {
  it.each(GAMES.filter((g) => g.phase === 4).map((g) => [g.title, g.id]))('«%s» se abre en su versión local', async (_, id) => {
    await openGame(id);
    expect(await FIRST_SCREEN[id]()).toBeInTheDocument();
    expect(document.querySelector('iframe')).toBeNull();
  });
});

describe('Lava y Agua (interfaz)', () => {
  it('se mueve con el teclado, deshace y gana el primer nivel con 3 estrellas', async () => {
    const user = await openGame('lava-y-agua');
    expect(await screen.findByRole('button', { name: /^Nivel 2:.*Bloqueado/ })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /^Nivel 1:/ }));
    expect(screen.getByText(/La lava avanza una casilla por cada paso/)).toHaveClass('lv-status');
    await user.keyboard('{ArrowRight}');
    expect(screen.getByText('Turnos', { selector: 'dt' }).nextElementSibling).toHaveTextContent('1');
    await user.click(screen.getByRole('button', { name: 'Deshacer' }));
    expect(screen.getByText('Turnos', { selector: 'dt' }).nextElementSibling).toHaveTextContent('0');
    for (let i = 0; i < 6; i += 1) await user.keyboard('{ArrowRight}');
    expect(await screen.findByRole('heading', { name: 'Nivel 1 superado' })).toBeInTheDocument();
    expect(screen.getByText(/★★★/)).toBeInTheDocument();
    await waitFor(async () => expect((await readGameRecord('lava-y-agua')).progress.completed['primer-paso']).toBe(true));
  });
});

describe('Cocina (interfaz)', () => {
  it('Heladería: comanda legible, preparación por pasos y evaluación con estados en texto', async () => {
    const user = await openGame('heladeria');
    expect(screen.getByRole('button', { name: /^Nivel 2, Cocinero.*Bloqueado/ })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /^Nivel 1, Aprendiz/ }));
    const ticket = await screen.findByRole('region', { name: /^Para / });
    expect(within(ticket).getByText('Recipiente')).toBeInTheDocument();
    // Entregar sin preparar nada: todo falta y se dice con palabras, no solo con color.
    await user.click(screen.getByRole('button', { name: 'Entregar' }));
    expect(await screen.findByText(/Precisión/)).toHaveTextContent('0 %');
    expect(screen.getAllByText('Falta').length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Siguiente pedido' }));
    // Preparar el siguiente pedido exactamente como pide la comanda.
    const next = screen.getByRole('region', { name: /^Para / });
    const container = within(next).getByText('Recipiente').nextElementSibling.textContent;
    await user.click(screen.getByRole('button', { name: container }));
    await user.click(screen.getByRole('tab', { name: /Bolas/ }));
    const scoops = [...within(next).getByText('Bolas').nextElementSibling.querySelectorAll('li')].map((li) => li.textContent.replace(/^\d+\. /, ''));
    for (const flavor of scoops) await user.click(screen.getByRole('button', { name: new RegExp(`^${flavor}`) }));
    await user.click(screen.getByRole('button', { name: 'Entregar' }));
    expect(await screen.findByText(/Precisión/)).toHaveTextContent('100 %');
    expect(screen.getByRole('heading', { name: '¡Perfecto!' })).toBeInTheDocument();
  });
});

describe('Bloques que caen (interfaz)', () => {
  it('muestra modos y empieza la partida con cuenta atrás en un lienzo', async () => {
    const user = await openGame('bloques');
    await user.click(await screen.findByRole('button', { name: 'Jugar maratón' }));
    expect(await screen.findByRole('img', { name: /Tablero de bloques: 0 líneas, nivel 1/ })).toBeInTheDocument();
  });
});

describe('Reino de Ladrillos (interfaz)', () => {
  it('solo el primer nivel está abierto y se juega en un lienzo con su presentación', async () => {
    const user = await openGame('reino-de-ladrillos');
    expect(await screen.findByRole('button', { name: /^Nivel 1-2:.*Bloqueado/ })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /^Nivel 1-1:/ }));
    expect(await screen.findByRole('img', { name: /Nivel 1-1: Pradera de ladrillo/ })).toBeInTheDocument();
    expect(screen.getByText('Golpea los bloques desde abajo. El corazón te hace grande.')).toBeInTheDocument();
  });
});

describe('Stellarium (interfaz)', () => {
  it('bitácora con pistas y el cielo del día de inicio configurado', async () => {
    const user = await openGame('stellarium');
    await screen.findByRole('img', { name: /Cielo nocturno/ });
    await user.click(screen.getByRole('button', { name: 'Bitácora' }));
    const dialog = await screen.findByRole('dialog', { name: 'Bitácora de observación' });
    expect(within(dialog).getAllByText('Sin identificar').length).toBeGreaterThan(10);
    expect(within(dialog).getByText(/Pista: Busca tres estrellas en fila/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: /Cerrar/ }));
    await user.click(screen.getByRole('button', { name: 'El cielo de nuestro día' }));
    // Fecha real de la configuración (21 de julio de 2025): Sol frente a Cáncer, Luna menguante.
    expect(await screen.findByText('21 de julio de 2025')).toBeInTheDocument();
    expect(screen.getByText('Cáncer')).toBeInTheDocument();
    expect(screen.getByText(/muy cerca del límite con Géminis/)).toBeInTheDocument();
    expect(screen.getByText('luna menguante')).toBeInTheDocument();
  });
});
