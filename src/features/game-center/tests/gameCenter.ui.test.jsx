import { describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../app/App.jsx';
import { createDefaultPreferences } from '../../../services/preferences/defaults.js';
import { PREFERENCES_KEY } from '../../../services/preferences/preferencesService.js';
import { readGameRecord } from '../services/gameStorage.js';
import { GAMES } from '../registry/gameRegistry.js';
import { ROADMAP } from '../registry/roadmap.js';

/** Arranca la app con la presentación ya vista, en la ruta indicada. */
async function openApp(hash = '#/juegos') {
  const prefs = createDefaultPreferences();
  prefs.presentation.completed = true;
  localStorage.setItem(PREFERENCES_KEY, JSON.stringify(prefs));
  window.location.hash = hash;
  const user = userEvent.setup();
  render(<App />);
  return user;
}

const libraryCards = () => within(screen.getByRole('region', { name: 'Todos los juegos' })).queryAllByRole('article');

describe('Game Center: biblioteca', () => {
  it('se entra desde la navegación principal', async () => {
    const user = await openApp('#/');
    await screen.findByRole('heading', { level: 1, name: /Mi niña/ });
    await user.click(screen.getAllByRole('link', { name: /^Juegos/ })[0]);
    expect(await screen.findByRole('heading', { level: 1, name: /Game Center/ })).toBeInTheDocument();
    expect(screen.getByText('Un universo de juegos, creado para disfrutar.')).toBeInTheDocument();
    // Saludo con el apodo real de la configuración.
    expect(screen.getByText('¿A qué jugamos hoy, mi niña?')).toBeInTheDocument();
  });

  it('muestra los cinco juegos disponibles y las fases futuras sin botón de jugar', async () => {
    await openApp();
    await screen.findByRole('heading', { level: 1, name: /Game Center/ });
    expect(libraryCards()).toHaveLength(GAMES.length);
    for (const { title } of GAMES) {
      expect(screen.getByRole('link', { name: `Jugar a ${title}` })).toHaveAttribute('href', expect.stringContaining('#/juegos/'));
    }
    const roadmap = screen.getByRole('region', { name: 'Lo que llegará a la sala' });
    expect(within(roadmap).getAllByText('Próxima incorporación')).toHaveLength(ROADMAP.flatMap((p) => p.games).length);
    expect(within(roadmap).queryAllByRole('link')).toHaveLength(0);
    expect(within(roadmap).queryAllByRole('button')).toHaveLength(0);
  });

  it('busca al instante y muestra un estado vacío', async () => {
    const user = await openApp();
    const search = await screen.findByRole('searchbox', { name: /Buscar juegos/ });
    await user.type(search, 'ajedrez');
    expect(libraryCards()).toHaveLength(1);
    await user.clear(search);
    await user.type(search, 'zzz');
    expect(libraryCards()).toHaveLength(0);
    expect(screen.getByText('No hay juegos que coincidan')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Ver todos los juegos' }));
    expect(libraryCards()).toHaveLength(GAMES.length);
  });

  it('filtra por categoría', async () => {
    const user = await openApp();
    await screen.findByRole('heading', { level: 1, name: /Game Center/ });
    await user.click(screen.getByRole('button', { name: 'Carreras' }));
    expect(screen.getByRole('button', { name: 'Carreras' })).toHaveAttribute('aria-pressed', 'true');
    expect(libraryCards().map((card) => within(card).getByRole('heading').textContent)).toEqual(['Aquapark', 'Tunnel Runner', 'Aparcar el carro', 'Traffic Rider']);
    await user.click(screen.getByRole('button', { name: 'Todos' }));
    expect(libraryCards()).toHaveLength(GAMES.length);
  });

  it('una ruta de juego inexistente vuelve a la biblioteca', async () => {
    await openApp('#/juegos/no-existe');
    expect(await screen.findByRole('heading', { level: 1, name: /Game Center/ })).toBeInTheDocument();
  });
});

describe('Game Center: partida', () => {
  it('presentación previa con objetivo, controles y botón de inicio; se vuelve a la biblioteca', async () => {
    const user = await openApp();
    await user.click(await screen.findByRole('link', { name: 'Jugar a Ajedrez' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Ajedrez' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Objetivo' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Controles' })).toBeInTheDocument();
    expect(screen.getByText('Teclado y ratón')).toBeInTheDocument();
    expect(screen.getByText('Pantalla táctil')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Game Center' }));
    expect(await screen.findByRole('heading', { level: 1, name: /Game Center/ })).toBeInTheDocument();
  });

  it('ajedrez a dos jugadores: mueve, valida turnos, pide confirmar al abandonar y guarda la partida', async () => {
    const user = await openApp('#/juegos/chess');
    await user.click(await screen.findByRole('button', { name: 'Jugar' }));
    await screen.findByRole('heading', { name: 'Nueva partida' });
    await user.click(screen.getByRole('radio', { name: /Dos jugadores/ }));
    await user.click(screen.getByRole('button', { name: 'Empezar partida' }));

    const board = await screen.findByRole('grid', { name: 'Tablero de ajedrez' });
    expect(within(board).getAllByRole('gridcell')).toHaveLength(64);
    // Una pieza negra no se puede mover en el turno de las blancas.
    await user.click(within(board).getByRole('button', { name: /^e7, peón negro/ }));
    expect(within(board).queryByRole('button', { name: /movimiento posible/ })).toBeNull();

    await user.click(within(board).getByRole('button', { name: /^e2, peón blanco/ }));
    expect(within(board).getByRole('button', { name: /^e4, vacía, movimiento posible/ })).toBeInTheDocument();
    await user.click(within(board).getByRole('button', { name: /^e4, vacía/ }));
    expect(screen.getByText('Turno de las negras')).toBeInTheDocument();
    expect(within(screen.getByRole('complementary', { name: 'Estado de la partida' })).getByText('e4')).toBeInTheDocument();

    // Salir con la partida empezada pide confirmación.
    await user.click(screen.getByRole('button', { name: 'Game Center' }));
    const exitDialog = screen.getByRole('dialog', { name: '¿Salir de la partida?' });
    await user.click(within(exitDialog).getByRole('button', { name: 'Seguir jugando' }));

    await user.click(screen.getByRole('button', { name: 'Abandonar' }));
    const resignDialog = screen.getByRole('dialog', { name: '¿Abandonar la partida?' });
    await user.click(within(resignDialog).getByRole('button', { name: 'Abandonar' }));
    expect(await screen.findByRole('heading', { name: /Abandono · ganan las blancas/ })).toBeInTheDocument();

    await waitFor(async () => expect((await readGameRecord('chess')).plays).toBe(1));
    const record = await readGameRecord('chess');
    expect(record.completions).toBe(0);
    expect(record.settings.mode).toBe('2p');

    await user.click(screen.getByRole('button', { name: 'Volver al Game Center' }));
    expect(await screen.findByRole('heading', { level: 1, name: /Game Center/ })).toBeInTheDocument();
  });

  it('lógica: resuelve el primer nivel con el teclado, pausa, y guarda el progreso', async () => {
    const user = await openApp('#/juegos/logic-grid');
    await user.click(await screen.findByRole('button', { name: 'Jugar' }));
    await screen.findByRole('heading', { name: 'Elige un nivel' });
    expect(screen.getByRole('button', { name: /^Nivel 2: Escalón/ })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /^Nivel 1: Primer trazo/ }));

    // Pausa real: el tablero no acepta movimientos.
    await user.click(screen.getByRole('button', { name: 'Pausar (Esc)' }));
    const pause = screen.getByRole('dialog', { name: 'Pausa' });
    await user.click(within(pause).getByRole('button', { name: 'Continuar' }));

    // «Primer trazo»: izquierda, abajo, derecha (sin repetir ninguna casilla).
    for (const key of ['{ArrowLeft}', '{ArrowDown}', '{ArrowRight}']) {
      await user.keyboard(key);
      await act(() => new Promise((resolve) => setTimeout(resolve, 400)));
    }
    expect(await screen.findByRole('heading', { name: '¡Tablero cubierto!' })).toBeInTheDocument();
    await waitFor(async () => expect((await readGameRecord('logic-grid')).progress.completed?.['deslizar-01']).toBe(true));
    expect(Number.isFinite((await readGameRecord('logic-grid')).best['time:deslizar-01'])).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Siguiente nivel' }));
    expect(await screen.findByText('Escalón')).toBeInTheDocument();
  });

  it('Tunnel Runner: cuenta atrás, partida, pausa y salida sin dejar bucles activos', async () => {
    const raf = vi.spyOn(window, 'requestAnimationFrame');
    const user = await openApp('#/juegos/tunnel-runner');
    await user.click(await screen.findByRole('button', { name: 'Jugar' }));
    expect(await screen.findByText('Distancia')).toBeInTheDocument();
    // Termina la cuenta atrás (3 × 0,7 s) y empieza la partida.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Pausar (Esc)' })).toBeInTheDocument(), { timeout: 4000 });
    await user.keyboard('{Escape}');
    expect(screen.getByRole('heading', { name: 'Pausa' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Salir al Game Center' }));
    expect(await screen.findByRole('heading', { level: 1, name: /Game Center/ })).toBeInTheDocument();

    const calls = raf.mock.calls.length;
    await act(() => new Promise((resolve) => setTimeout(resolve, 300)));
    expect(raf.mock.calls.length).toBe(calls);
    await waitFor(async () => expect((await readGameRecord('tunnel-runner')).plays).toBe(1));
  });
});
