import { afterEach, describe, expect, it, vi } from 'vitest';
import { interpretPrompt, normalizeText, paintScene, seededRandom } from '../ai/proceduralPainter.js';
import { generateImage, GenerationError, probeServer, validateServerUrl } from '../ai/providers.js';

// PNG mínimo de 1×1 en base64 (firma 89 50 4E 47).
const PNG_1X1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function mockFetch(handler) {
  const calls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, init) => {
      calls.push({ url, init, body: init?.body ? JSON.parse(init.body) : null });
      const { status = 200, json } = await handler(url, init);
      return { ok: status < 400, status, json: async () => json, text: async () => JSON.stringify(json ?? '') };
    }),
  );
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe('Pintor procedural (no es IA)', () => {
  it('reconoce cielo, elementos y colores en español sin depender de tildes', () => {
    const plan = interpretPrompt('Un jardín de ROSAS rojas al atardecer, junto al mar');
    expect(plan.sky).toBe('sunset');
    expect(plan.elements).toEqual(expect.arrayContaining(['flowers', 'sea', 'field']));
    expect(plan.recognized).toEqual(expect.arrayContaining(['atardecer', 'flores', 'mar', 'rojas']));
    expect(plan.hues).toContain(355);
    expect(normalizeText('Montañas ¡nevadas!')).toBe('montanas nevadas');
  });

  it('la noche añade estrellas y el día un sol; siempre hay un suelo', () => {
    expect(interpretPrompt('una noche tranquila').elements).toEqual(expect.arrayContaining(['stars', 'field']));
    expect(interpretPrompt('un día en la ciudad').elements).toEqual(expect.arrayContaining(['sun', 'city']));
  });

  it('dice la verdad cuando no reconoce nada', () => {
    const plan = interpretPrompt('xyzzy quux');
    expect(plan.recognized).toEqual([]);
    expect(plan.elements).toContain('field');
  });

  it('es determinista y cada variación cambia la semilla', () => {
    expect(interpretPrompt('mar y luna').seed).toBe(interpretPrompt('mar y luna').seed);
    expect(interpretPrompt('mar y luna', 1).seed).not.toBe(interpretPrompt('mar y luna', 0).seed);
    const a = seededRandom(42);
    const b = seededRandom(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('pinta todas las combinaciones sin errores (contexto 2D simulado)', () => {
    const noop = () => {};
    const gradient = { addColorStop: noop };
    const ctx = new Proxy({}, { get: (_t, key) => (key === 'createLinearGradient' || key === 'createRadialGradient' ? () => gradient : noop), set: () => true });
    for (const text of ['noche estrellada con luna sobre montañas nevadas', 'ciudad con lluvia y tormenta', 'playa al amanecer con aves y corazones rosa', 'bosque con río y flores']) {
      expect(() => paintScene(ctx, interpretPrompt(text), 768, 512)).not.toThrow();
    }
  });
});

describe('Servidor de IA propio', () => {
  it('solo acepta este computador o puertos conocidos de la red local, sin credenciales', () => {
    expect(validateServerUrl('http://localhost:7860')).toMatchObject({ ok: true, url: 'http://localhost:7860', local: true });
    expect(validateServerUrl('http://127.0.0.1:9999/')).toMatchObject({ ok: true, url: 'http://127.0.0.1:9999' });
    expect(validateServerUrl('http://192.168.1.20:7860')).toMatchObject({ ok: true, local: false });
    expect(validateServerUrl('http://192.168.1.20:8080')).toMatchObject({ ok: true });
    expect(validateServerUrl('https://api.ejemplo.com').ok).toBe(false);
    expect(validateServerUrl('http://user:pass@localhost:7860').ok).toBe(false);
    expect(validateServerUrl('ftp://localhost:7860').ok).toBe(false);
    expect(validateServerUrl('no es una url').ok).toBe(false);
  });

  it('Stable Diffusion WebUI: envía la descripción a /sdapi/v1/txt2img y devuelve la imagen como IA', async () => {
    const calls = mockFetch(async () => ({ json: { images: [PNG_1X1] } }));
    const out = await generateImage({ prompt: 'un girasol', provider: 'server', server: { url: 'http://localhost:7860', protocol: 'a1111' }, size: 'square' });
    expect(calls[0].url).toBe('http://localhost:7860/sdapi/v1/txt2img');
    expect(calls[0].init.credentials).toBe('omit');
    expect(calls[0].body).toMatchObject({ prompt: 'un girasol', width: 512, height: 512 });
    expect(out).toMatchObject({ origin: 'ai', width: 512, height: 512 });
    expect(out.blob.type).toBe('image/png');
  });

  it('compatible con OpenAI: usa /v1/images/generations con b64_json', async () => {
    const calls = mockFetch(async () => ({ json: { data: [{ b64_json: PNG_1X1 }] } }));
    const out = await generateImage({ prompt: 'un jardín', provider: 'server', server: { url: 'http://localhost:8080', protocol: 'openai', model: 'sd-mini' } });
    expect(calls[0].url).toBe('http://localhost:8080/v1/images/generations');
    expect(calls[0].body).toMatchObject({ prompt: 'un jardín', response_format: 'b64_json', model: 'sd-mini', size: '768x512' });
    expect(out).toMatchObject({ origin: 'ai', provider: 'sd-mini' });
  });

  it('explica los errores: sin conexión, error HTTP, respuesta sin imagen o que no es imagen', async () => {
    const server = { url: 'http://localhost:7860', protocol: 'a1111' };
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));
    await expect(generateImage({ prompt: 'x', provider: 'server', server })).rejects.toThrow(/No se pudo conectar/);
    mockFetch(async () => ({ status: 500, json: { error: 'OOM' } }));
    await expect(generateImage({ prompt: 'x', provider: 'server', server })).rejects.toThrow(/error 500/);
    mockFetch(async () => ({ json: { images: [] } }));
    await expect(generateImage({ prompt: 'x', provider: 'server', server })).rejects.toThrow(/ninguna imagen/);
    mockFetch(async () => ({ json: { images: [btoa('<html>hola</html>')] } }));
    await expect(generateImage({ prompt: 'x', provider: 'server', server })).rejects.toThrow(GenerationError);
  });

  it('valida la descripción antes de llamar a nadie', async () => {
    const calls = mockFetch(async () => ({ json: {} }));
    await expect(generateImage({ prompt: '   ', provider: 'server', server: { url: 'http://localhost:7860', protocol: 'a1111' } })).rejects.toThrow(/Describe/);
    await expect(generateImage({ prompt: 'a'.repeat(501), provider: 'server', server: { url: 'http://localhost:7860', protocol: 'a1111' } })).rejects.toThrow(/500 caracteres/);
    await expect(generateImage({ prompt: 'hola', provider: 'server', server: { url: 'https://nube.ejemplo.com', protocol: 'a1111' } })).rejects.toThrow(/Por seguridad/);
    expect(calls).toHaveLength(0);
  });

  it('«Probar conexión» lista los modelos sin generar nada', async () => {
    const calls = mockFetch(async () => ({ json: [{ model_name: 'sd15' }, { model_name: 'sdxl' }] }));
    await expect(probeServer({ url: 'http://localhost:7860', protocol: 'a1111' })).resolves.toEqual({ models: ['sd15', 'sdxl'] });
    expect(calls[0]).toMatchObject({ url: 'http://localhost:7860/sdapi/v1/sd-models', init: { method: 'GET' } });
  });
});
