import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../app/App.jsx';
import { createDefaultPreferences } from '../../../services/preferences/defaults.js';
import { PREFERENCES_KEY } from '../../../services/preferences/preferencesService.js';
import { embedOrigins, iframeAllow, isTrustedSource, ONLINE_SOURCES, onlineSourceFor, PROVIDERS } from '../online/onlineSources.js';
import { OnlineGameFrame } from '../components/OnlineGameFrame.jsx';
import { CONTENT_SECURITY_POLICY } from '../../../../scripts/vite-plugin-offline.js';

const setOnline = (value) => Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => value });
afterEach(() => setOnline(true));

describe('fuentes online (configuración)', () => {
  it('Aquapark apunta a la página oficial verificada de CrazyGames y se abre fuera (no se inserta)', () => {
    const source = onlineSourceFor('aquapark');
    expect(source).toMatchObject({
      method: 'external',
      provider: 'crazygames',
      providerName: 'CrazyGames',
      url: 'https://www.crazygames.com/game/aquapark-io-yky',
      title: 'Aquapark.io',
      developer: 'Voodoo',
    });
  });

  it('los juegos sin versión online verificada no tienen fuente', () => {
    for (const id of ['chess', 'tunnel-runner', 'logic-grid', 'io-games', 'no-existe']) expect(onlineSourceFor(id)).toBeNull();
  });

  it('rechaza cualquier URL fuera de la lista permitida del proveedor y del método', () => {
    const base = { provider: 'crazygames', method: 'external' };
    expect(isTrustedSource({ ...base, url: 'https://www.crazygames.com/game/x' })).toBe(true);
    expect(isTrustedSource({ ...base, url: 'http://www.crazygames.com/game/x' })).toBe(false);
    expect(isTrustedSource({ ...base, url: 'https://www.crazygames.com.evil.example/game/x' })).toBe(false);
    expect(isTrustedSource({ ...base, url: 'https://user:pass@www.crazygames.com/game/x' })).toBe(false);
    expect(isTrustedSource({ ...base, url: 'javascript:alert(1)' })).toBe(false);
    expect(isTrustedSource({ ...base, provider: 'otro', url: 'https://www.crazygames.com/game/x' })).toBe(false);
    // CrazyGames no autoriza la inserción: ninguna URL suya vale como iframe.
    expect(isTrustedSource({ ...base, method: 'embed', url: 'https://www.crazygames.com/embed/x' })).toBe(false);
  });

  it('la CSP no abre frame-src a ningún dominio mientras no haya inserciones verificadas', () => {
    expect(embedOrigins()).toEqual([]);
    expect(CONTENT_SECURITY_POLICY).not.toMatch(/frame-src/);
    expect(CONTENT_SECURITY_POLICY).toMatch(/default-src 'self'/);
  });

  it('frame-src solo incluiría los orígenes de inserción verificados', () => {
    const providers = { ...PROVIDERS, demo: { id: 'demo', name: 'Demo', linkOrigins: [], embedOrigins: ['https://games.demo.example'] } };
    const sources = {
      ...ONLINE_SOURCES,
      ok: { provider: 'demo', method: 'embed', url: 'https://games.demo.example/play/1' },
      bad: { provider: 'demo', method: 'embed', url: 'https://otro.example/play/1' },
    };
    expect(embedOrigins(sources, providers)).toEqual(['https://games.demo.example']);
  });

  it('el iframe solo recibe permisos de la lista permitida', () => {
    expect(iframeAllow(['fullscreen', 'camera', 'microphone', 'gamepad'])).toBe('fullscreen; gamepad');
  });
});

/** Proveedor ficticio SOLO para probar el componente: no se usa en la app. */
const TEST_PROVIDERS = { demo: { id: 'demo', name: 'Proveedor de prueba', linkOrigins: ['https://www.demo.example'], embedOrigins: ['https://games.demo.example'] } };
const TEST_SOURCE = {
  provider: 'demo',
  providerName: 'Proveedor de prueba',
  method: 'embed',
  title: 'Juego de prueba',
  url: 'https://games.demo.example/play/1',
  permissions: ['fullscreen', 'camera'],
};

describe('reproductor online (OnlineGameFrame)', () => {
  it('carga la URL configurada en un iframe aislado, con estado de carga y salida propia', () => {
    const onExit = vi.fn();
    render(<OnlineGameFrame source={TEST_SOURCE} providers={TEST_PROVIDERS} onExit={onExit} />);
    const frame = screen.getByTitle('Juego de prueba (juego externo de Proveedor de prueba)');
    expect(frame).toHaveAttribute('src', 'https://games.demo.example/play/1');
    expect(frame).toHaveAttribute('allow', 'fullscreen');
    expect(frame).toHaveAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    expect(screen.getByRole('status')).toHaveTextContent('Cargando el juego desde Proveedor de prueba');
    // `load` no garantiza que el juego esté listo: solo se retira el aviso de carga.
    fireEvent.load(frame);
    expect(screen.queryByRole('status')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Salir del modo online' }));
    expect(onExit).toHaveBeenCalledOnce();
  });

  it('si tarda no declara un error: ofrece reintentar', () => {
    vi.useFakeTimers();
    try {
      render(<OnlineGameFrame source={TEST_SOURCE} providers={TEST_PROVIDERS} onExit={() => {}} />);
      act(() => vi.advanceTimersByTime(21000));
      expect(screen.getByRole('status')).toHaveTextContent('Está tardando más de lo normal');
      expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
      expect(screen.queryByRole('alert')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('sin conexión no crea el iframe y permite volver al modo offline', () => {
    setOnline(false);
    const onExit = vi.fn();
    render(<OnlineGameFrame source={TEST_SOURCE} providers={TEST_PROVIDERS} onExit={onExit} />);
    expect(document.querySelector('iframe')).toBeNull();
    expect(screen.getByRole('alert')).toHaveTextContent('Sin conexión');
    fireEvent.click(screen.getByRole('button', { name: 'Volver y jugar offline' }));
    expect(onExit).toHaveBeenCalledOnce();
  });

  it('una fuente no verificada nunca llega al atributo src', () => {
    render(<OnlineGameFrame source={{ ...TEST_SOURCE, url: 'https://otro.example/x' }} providers={TEST_PROVIDERS} onExit={() => {}} />);
    expect(document.querySelector('iframe')).toBeNull();
    expect(screen.getByRole('alert')).toHaveTextContent('Integración no disponible');
  });
});

async function openGame(id) {
  const prefs = createDefaultPreferences();
  prefs.presentation.completed = true;
  localStorage.setItem(PREFERENCES_KEY, JSON.stringify(prefs));
  window.location.hash = `#/juegos/${id}`;
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole('heading', { level: 1, name: /.+/ });
  return user;
}

describe('modalidad offline / online en la pantalla del juego', () => {
  it('Aquapark ofrece las dos: offline en la app y la original en CrazyGames, en otra pestaña', async () => {
    await openGame('aquapark');
    await screen.findByRole('group', { name: 'Modalidad de juego' });
    expect(screen.getByRole('button', { name: 'Jugar' })).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'Abrir en CrazyGames' });
    expect(link).toHaveAttribute('href', 'https://www.crazygames.com/game/aquapark-io-yky');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.getAttribute('rel')).toMatch(/noopener/);
    expect(link.getAttribute('rel')).toMatch(/noreferrer/);
    expect(screen.getByText(/Es contenido externo: no suma a tus\s+estadísticas/)).toBeInTheDocument();
    // Ver la pantalla no carga nada externo.
    expect(document.querySelector('iframe')).toBeNull();
  });

  it('jugar offline sigue siendo el juego local, sin iframe', async () => {
    const user = await openGame('aquapark');
    await user.click(await screen.findByRole('button', { name: 'Jugar' }));
    expect(await screen.findByRole('heading', { name: 'Elige tu tobogán' })).toBeInTheDocument();
    expect(document.querySelector('iframe')).toBeNull();
  });

  it('sin conexión la opción online lo dice y no ofrece el enlace', async () => {
    setOnline(false);
    await openGame('aquapark');
    await screen.findByRole('group', { name: 'Modalidad de juego' });
    expect(screen.queryByRole('link', { name: 'Abrir en CrazyGames' })).toBeNull();
    expect(screen.getByText(/Sin conexión\. Disponible cuando vuelvas a conectarte/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Jugar' })).toBeEnabled();
  });

  it('los juegos sin versión online no muestran una opción que no existe', async () => {
    await openGame('chess');
    await screen.findByRole('button', { name: 'Jugar' });
    expect(screen.queryByRole('group', { name: 'Modalidad de juego' })).toBeNull();
    expect(screen.queryByText(/Online/)).toBeNull();
  });
});
