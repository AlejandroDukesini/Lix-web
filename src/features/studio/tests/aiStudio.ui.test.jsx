import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { listKind } from '../../organizer/data/store.js';
import { openApp } from '../../organizer/tests/helpers.jsx';

const PNG_1X1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

beforeAll(() => import('../ai/AiStudioPage.jsx'), 120_000);

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:lix-test');
  URL.revokeObjectURL = vi.fn();
});

describe('Lix AI Studio: interfaz', () => {
  it('pintor procedural: genera, dice que no es IA y qué palabras reconoció, y lo guarda en el historial', async () => {
    const noop = () => {};
    const ctx = new Proxy({}, { get: (_t, key) => (String(key).startsWith('create') ? () => ({ addColorStop: noop }) : noop), set: () => true });
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ctx);
    HTMLCanvasElement.prototype.toBlob = function toBlob(callback) {
      callback(new Blob(['png'], { type: 'image/png' }));
    };
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const { user } = await openApp('#/estudio');
    expect(await screen.findByRole('heading', { level: 1, name: 'Lix AI Studio' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Describe la imagen'), 'Un jardín de rosas al atardecer');
    await user.click(screen.getByRole('button', { name: 'Generar' }));
    expect(await screen.findByText('Procedural · no es IA')).toBeInTheDocument();
    expect(screen.getByText(/Palabras reconocidas: atardecer, pradera, flores/)).toBeInTheDocument();
    await waitFor(() => expect(listKind('creation')).toHaveLength(1));
    expect(listKind('creation')[0]).toMatchObject({ origin: 'procedural', provider: 'Pintor procedural', favorite: false });
    // Ninguna petición de red con el pintor procedural.
    expect(fetchSpy).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(listKind('creation')[0].favorite).toBe(true));
    vi.unstubAllGlobals();
  });

  it('servidor de IA propio: guarda la configuración, genera con IA real y lo etiqueta así', async () => {
    const calls = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url, init) => {
        calls.push({ url, body: JSON.parse(init.body) });
        return { ok: true, status: 200, json: async () => ({ images: [PNG_1X1] }), text: async () => '' };
      }),
    );
    const { user } = await openApp('#/estudio');
    await user.click(await screen.findByText('Servidor de IA'));
    const urlField = await screen.findByLabelText('Dirección del servidor');
    await user.clear(urlField);
    await user.type(urlField, 'http://192.168.1.20:7860');
    await user.tab();
    await waitFor(() => expect(listKind('studioSettings')[0]).toMatchObject({ provider: 'server', serverUrl: 'http://192.168.1.20:7860' }));

    await user.type(screen.getByLabelText('Describe la imagen'), 'un girasol');
    await user.click(screen.getByRole('button', { name: 'Generar' }));
    expect(await screen.findByText('IA · Stable Diffusion (servidor propio)')).toBeInTheDocument();
    expect(calls[0]).toMatchObject({ url: 'http://192.168.1.20:7860/sdapi/v1/txt2img', body: { prompt: 'un girasol' } });
    await waitFor(() => expect(listKind('creation').some((c) => c.origin === 'ai')).toBe(true));
    vi.unstubAllGlobals();
  });

  it('rechaza servidores en Internet y explica por qué', async () => {
    const { user } = await openApp('#/estudio');
    await user.click(await screen.findByText('Servidor de IA'));
    const urlField = await screen.findByLabelText('Dirección del servidor');
    await user.clear(urlField);
    await user.type(urlField, 'https://api.ejemplo.com');
    expect(await screen.findByText(/solo se conecta a este computador/)).toBeInTheDocument();
    expect(within(urlField.closest('.ai-server')).getByRole('button', { name: 'Probar conexión' })).toBeDisabled();
  });
});
