import { describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../app/App.jsx';
import { createDefaultPreferences } from '../services/preferences/defaults.js';
import { backupPreferences, PREFERENCES_KEY } from '../services/preferences/preferencesService.js';

function storePreferences(mutate = () => {}) {
  const prefs = createDefaultPreferences();
  prefs.presentation.completed = true;
  prefs.presentation.completedAt = new Date().toISOString();
  mutate(prefs);
  localStorage.setItem(PREFERENCES_KEY, JSON.stringify(prefs));
}

const stored = () => JSON.parse(localStorage.getItem(PREFERENCES_KEY));
const root = document.documentElement;

/**
 * jsdom no calcula el diseño: se simula la altura de cada capítulo (--len × alto
 * de pantalla) y el desplazamiento de la ventana para recorrer el viaje.
 */
const VIEWPORT = 800;
function simulateStoryLayout() {
  const original = Element.prototype.getBoundingClientRect;
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: VIEWPORT });
  Object.defineProperty(window, 'scrollY', { configurable: true, writable: true, value: 0 });
  const chapters = () => [...document.querySelectorAll('.chapter')];
  const heights = () => chapters().map((el) => Number(el.style.getPropertyValue('--len')) * VIEWPORT);
  Object.defineProperty(document.documentElement, 'scrollHeight', {
    configurable: true,
    get: () => heights().reduce((a, b) => a + b, 0),
  });
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function rect() {
    const index = chapters().indexOf(this);
    if (index === -1) return original.call(this);
    const h = heights();
    const top = h.slice(0, index).reduce((a, b) => a + b, 0) - window.scrollY;
    return { top, height: h[index], bottom: top + h[index], left: 0, right: 375, width: 375, x: 0, y: top };
  });

  /** Desplaza hasta el punto `pose` (0–1) del capítulo con ese id. */
  return async function scrollToChapter(id, pose = 0.5) {
    const index = chapters().findIndex((el) => el.classList.contains(`chapter--${id}`));
    const h = heights();
    const top = h.slice(0, index).reduce((a, b) => a + b, 0);
    const max = h.reduce((a, b) => a + b, 0) - VIEWPORT;
    const reach = Math.min(h[index], max - top);
    act(() => {
      window.scrollY = Math.round(top + reach * pose);
      window.dispatchEvent(new Event('scroll'));
    });
    await act(() => new Promise((resolve) => requestAnimationFrame(() => resolve())));
  };
}

describe('primer inicio: el viaje astral', () => {
  it('recorre todos los capítulos, permite volver atrás y termina en el inicio', async () => {
    const user = userEvent.setup();
    const scrollToChapter = simulateStoryLayout();
    render(<App />);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Hay millones de estrellas en el universo...' }),
    ).toBeInTheDocument();
    expect(screen.getByText('...pero hoy quiero llevarte a descubrir algo que es especial para mí.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Comenzar el viaje' })).toBeInTheDocument();

    // Los capítulos existen como texto real y en orden de lectura.
    for (const text of [
      'En un universo tan inmenso, existen encuentros que hacen que todo se sienta diferente.',
      'Algunas luces parecen estar destinadas a encontrarse.',
      'Y entre tantas galaxias, hay pequeñas cosas que hacen que un universo entero tenga sentido.',
      'De todos los lugares que podríamos encontrar en el universo, quería mostrarte uno que lleva una letra muy especial.',
    ]) {
      expect(screen.getByRole('heading', { level: 2, name: text })).toBeInTheDocument();
    }

    // La vela del centro lleva la letra A.
    expect(document.querySelector('.candle__monogram-letter')).toHaveTextContent('A');
    expect(screen.getByText(/vela encendida con la letra A grabada en oro/)).toBeInTheDocument();

    // Avanzar: el capítulo activo cambia en el índice.
    await scrollToChapter('constellation');
    expect(screen.getByRole('button', { name: 'Capítulo II: Las constelaciones' })).toHaveAttribute('aria-current', 'step');
    await scrollToChapter('telescope');
    expect(screen.getByRole('button', { name: 'Capítulo IV: El telescopio' })).toHaveAttribute('aria-current', 'step');

    // Retroceder también funciona.
    await scrollToChapter('constellation');
    expect(screen.getByRole('button', { name: 'Capítulo II: Las constelaciones' })).toHaveAttribute('aria-current', 'step');

    // La revelación y el final dependen del recorrido.
    await scrollToChapter('candle', 0.8);
    expect(document.querySelector('.together')).toHaveClass('is-revealed');
    await scrollToChapter('final', 1);
    expect(document.querySelector('.finale')).toHaveClass('is-visible');

    await user.click(screen.getByRole('button', { name: 'Entrar a nuestro universo' }));
    expect(await screen.findByRole('heading', { level: 1, name: /Mi niña/ })).toBeInTheDocument();
    expect(stored().presentation.completed).toBe(true);
  });

  it('no pide permisos de micrófono ni de cámara', async () => {
    const getUserMedia = vi.fn();
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
    render(<App />);
    await screen.findByRole('heading', { level: 1, name: 'Hay millones de estrellas en el universo...' });
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('se puede saltar y no vuelve a aparecer al reabrir la app', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Saltar presentación' }));
    await screen.findByRole('heading', { level: 1, name: /Mi niña/ });
    unmount();

    render(<App />);
    expect(await screen.findByRole('heading', { level: 1, name: /Mi niña/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Comenzar el viaje' })).toBeNull();
  });

  it('si la copia en IndexedDB dice que ya se vio, no la repite tras perder localStorage', async () => {
    const prefs = createDefaultPreferences();
    prefs.presentation.completed = true;
    await backupPreferences(prefs);
    render(<App />);
    expect(await screen.findByRole('heading', { level: 1, name: /Mi niña/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Comenzar el viaje' })).toBeNull();
  });
});

describe('inicio y navegación', () => {
  it('muestra el saludo, los contadores y los módulos futuros sin enlaces', async () => {
    storePreferences();
    render(<App />);
    expect(await screen.findByText(/Buenos días|Buenas tardes|Buenas noches/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Rumbo a|Feliz/ })).toBeInTheDocument();

    const soon = screen.getAllByText('Próximamente');
    expect(soon).toHaveLength(5);
    for (const label of ['Juegos', 'Finanzas', 'Calendario']) {
      expect(screen.queryByRole('link', { name: new RegExp(label) })).toBeNull();
    }
  });

  it('sin fecha configurada no muestra contador de días', async () => {
    storePreferences((p) => {
      p.dates.relationshipStart = null;
    });
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Nuestro tiempo juntos' })).toBeInTheDocument();
    expect(screen.queryByText(/Juntos desde/)).toBeNull();
  });

  it('una ruta inexistente vuelve al inicio', async () => {
    storePreferences();
    window.location.hash = '#/finanzas';
    render(<App />);
    expect(await screen.findByRole('heading', { level: 1, name: /Mi niña/ })).toBeInTheDocument();
  });

  it('reproduce la presentación desde el inicio sin cambiar preferencias', async () => {
    storePreferences();
    const before = stored();
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('link', { name: 'Ver la presentación' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Hay millones de estrellas en el universo...' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cerrar' }));
    await screen.findByRole('heading', { level: 1, name: /Mi niña/ });
    expect(stored().presentation).toEqual(before.presentation);
  });
});

describe('configuración', () => {
  async function openSettings() {
    storePreferences();
    window.location.hash = '#/ajustes';
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { level: 1, name: 'Configuración' });
    return user;
  }

  it('cambia el estilo, el tema y el inicio de semana, y los guarda', async () => {
    const user = await openSettings();
    await user.click(screen.getByRole('radio', { name: /Maximalismo/ }));
    expect(root.dataset.style).toBe('maximal');
    await user.click(screen.getByRole('radio', { name: 'Claro' }));
    expect(root.dataset.theme).toBe('light');
    expect(root.dataset.style).toBe('maximal');
    await user.click(screen.getByRole('radio', { name: 'Domingo' }));

    expect(stored().appearance).toMatchObject({ style: 'maximal', theme: 'light' });
    expect(stored().calendar.weekStartsOn).toBe(0);
  });

  it('aplica una paleta y un color personalizado a las variables CSS', async () => {
    const user = await openSettings();
    await user.click(screen.getByRole('radio', { name: /Noche lavanda/ }));
    expect(root.style.getPropertyValue('--c-primary')).toBe('#a78bfa');

    const hex = screen.getByLabelText('Primario, valor hexadecimal');
    await user.clear(hex);
    await user.type(hex, '#123456{Enter}');
    expect(root.style.getPropertyValue('--c-primary')).toBe('#123456');
    expect(stored().appearance.paletteId).toBe('custom');
  });

  it('valida y guarda los apodos', async () => {
    const user = await openSettings();
    const input = screen.getByLabelText('Nuevo apodo');
    await user.type(input, 'mi amor');
    await user.click(screen.getByRole('button', { name: 'Añadir' }));
    expect(screen.getByText('Ese apodo ya está en la lista.')).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, '  Mi   cielo ');
    await user.click(screen.getByRole('button', { name: 'Añadir' }));
    await user.click(screen.getByRole('button', { name: 'Guardar apodos' }));
    expect(stored().profile.nicknames.at(-1)).toBe('Mi cielo');
  });

  it('rechaza una fecha de inicio futura', async () => {
    const user = await openSettings();
    const field = screen.getByLabelText('Fecha de inicio de la relación');
    await user.clear(field);
    await user.type(field, '2099-01-01');
    await user.click(screen.getByRole('button', { name: 'Guardar fecha' }));
    expect(screen.getByText('La fecha de inicio no puede estar en el futuro.')).toBeInTheDocument();
    expect(stored().dates.relationshipStart).toBe('2025-07-21');
  });

  it('restablecer la presentación pide confirmación y no la muestra hasta el próximo inicio', async () => {
    const user = await openSettings();
    await user.click(screen.getByRole('button', { name: 'Restablecer estado' }));
    const dialog = screen.getByRole('dialog', { name: '¿Restablecer la presentación?' });
    await user.click(within(dialog).getByRole('button', { name: 'Restablecer' }));

    expect(stored().presentation.completed).toBe(false);
    expect(screen.getByRole('heading', { level: 1, name: 'Configuración' })).toBeInTheDocument();
  });

  it('restablecer la configuración conserva el estado de la presentación', async () => {
    storePreferences((p) => {
      p.appearance.style = 'maximal';
    });
    window.location.hash = '#/ajustes';
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { level: 1, name: 'Configuración' });
    await user.click(screen.getByRole('button', { name: 'Restablecer' }));
    const dialog = screen.getByRole('dialog', { name: '¿Restablecer la configuración?' });
    await user.click(within(dialog).getByRole('button', { name: 'Restablecer' }));

    expect(stored().appearance.style).toBe('glass');
    expect(stored().presentation.completed).toBe(true);
  });
});

describe('presentación en configuración', () => {
  it('cambia la letra de la vela, la valida y la guarda en mayúscula', async () => {
    storePreferences();
    window.location.hash = '#/ajustes';
    const user = userEvent.setup();
    render(<App />);
    const field = await screen.findByLabelText('Letra de la vela');
    await user.clear(field);
    await user.type(field, 'ab');
    await user.click(screen.getByRole('button', { name: 'Guardar presentación' }));
    expect(screen.getByText('Debe ser una sola letra, por ejemplo A.')).toBeInTheDocument();

    await user.clear(field);
    await user.type(field, 'm');
    await user.click(screen.getByRole('button', { name: 'Guardar presentación' }));
    expect(stored().presentation.candleLetter).toBe('M');
  });
});

describe('robustez', () => {
  it('arranca con preferencias corruptas y las repara', async () => {
    localStorage.setItem(PREFERENCES_KEY, '{"appearance":{"style":"???"},"presentation":{"completed":"sí"}}');
    render(<App />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Hay millones de estrellas en el universo...' })).toBeInTheDocument();
    await waitFor(() => expect(stored().appearance.style).toBe('glass'));
  });
});
