/**
 * Proveedores de imágenes de Lix AI Studio.
 *
 *  - procedural: pintor local (proceduralPainter.js). Sin conexión. NO es IA.
 *  - server:     un modelo de IA real que la persona ejecuta en su computador o en su red
 *                (no hay ninguno incluido ni ningún servicio en la nube preconfigurado).
 *                Protocolos admitidos:
 *                  · a1111  → Stable Diffusion WebUI (AUTOMATIC1111), Forge o SD.Next:
 *                             POST {url}/sdapi/v1/txt2img → { images: [base64 PNG] }
 *                  · openai → servidores compatibles con la API de imágenes de OpenAI que
 *                             se ejecutan en local (p. ej. LocalAI):
 *                             POST {url}/v1/images/generations → { data: [{ b64_json }] }
 *                La app no guarda ni envía claves: estos servidores locales no las necesitan.
 *                Solo se hace una petición cuando la persona pulsa «Generar» o «Probar».
 */
import { interpretPrompt, paintToBlob } from './proceduralPainter.js';

export const PROTOCOLS = {
  a1111: { label: 'Stable Diffusion WebUI / Forge / SD.Next', defaultUrl: 'http://localhost:7860', probe: '/sdapi/v1/sd-models' },
  openai: { label: 'Compatible con OpenAI (LocalAI…)', defaultUrl: 'http://localhost:8080', probe: '/v1/models' },
};

export const SIZES = {
  square: { width: 512, height: 512, label: 'Cuadrada' },
  landscape: { width: 768, height: 512, label: 'Horizontal' },
  portrait: { width: 512, height: 768, label: 'Vertical' },
};

export const MAX_PROMPT = 500;
const TIMEOUT_MS = 180_000;

export class GenerationError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'GenerationError';
    this.cause = cause;
  }
}

/**
 * Valida la dirección del servidor. Solo http(s), sin credenciales en la URL, y avisa si
 * la CSP del build no permitiría conectarse (ver CONTENT_SECURITY_POLICY).
 */
export function validateServerUrl(raw) {
  let url;
  try {
    url = new URL(String(raw ?? '').trim());
  } catch {
    return { ok: false, error: 'Escribe una dirección completa, por ejemplo http://localhost:7860' };
  }
  if (!['http:', 'https:'].includes(url.protocol)) return { ok: false, error: 'La dirección debe empezar por http:// o https://' };
  if (url.username || url.password) return { ok: false, error: 'No pongas usuarios ni contraseñas en la dirección.' };
  const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  const port = url.port || (url.protocol === 'https:' ? '443' : '80');
  if (!local && !['7860', '8080'].includes(port)) {
    return { ok: false, error: 'Por seguridad, la app solo se conecta a este computador (localhost, cualquier puerto) o a equipos de tu red en los puertos 7860 u 8080.' };
  }
  return { ok: true, url: url.origin + url.pathname.replace(/\/+$/, ''), local };
}

async function fetchJson(url, init, signal) {
  const timeout = AbortSignal.timeout ? AbortSignal.timeout(TIMEOUT_MS) : null;
  const combined = signal && timeout && AbortSignal.any ? AbortSignal.any([signal, timeout]) : (signal ?? timeout ?? undefined);
  let response;
  try {
    response = await fetch(url, { ...init, signal: combined, credentials: 'omit', referrerPolicy: 'no-referrer' });
  } catch (error) {
    if (error?.name === 'AbortError') throw new GenerationError('Generación cancelada.', error);
    if (error?.name === 'TimeoutError') throw new GenerationError('El servidor tardó demasiado (más de 3 minutos).', error);
    throw new GenerationError('No se pudo conectar con el servidor. ¿Está encendido, en la misma red y con CORS permitido para esta app?', error);
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new GenerationError(`El servidor respondió con un error ${response.status}.${detail ? ` ${detail.slice(0, 160)}` : ''}`);
  }
  try {
    return await response.json();
  } catch (error) {
    throw new GenerationError('El servidor no devolvió una respuesta válida.', error);
  }
}

function base64ToBlob(base64, type = 'image/png') {
  const clean = String(base64).replace(/^data:[^;]+;base64,/, '');
  let binary;
  try {
    binary = atob(clean);
  } catch (error) {
    throw new GenerationError('La imagen recibida está dañada.', error);
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  // Se detecta el formato real por su firma (PNG, JPEG o WebP).
  if (bytes[0] === 0xff && bytes[1] === 0xd8) type = 'image/jpeg';
  else if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[8] === 0x57) type = 'image/webp';
  else if (!(bytes[0] === 0x89 && bytes[1] === 0x50)) throw new GenerationError('El servidor no devolvió una imagen PNG, JPEG o WebP.');
  return new Blob([bytes], { type });
}

/** Comprueba que el servidor responde (sin generar nada). */
export async function probeServer({ url, protocol }, signal) {
  const valid = validateServerUrl(url);
  if (!valid.ok) throw new GenerationError(valid.error);
  const data = await fetchJson(`${valid.url}${PROTOCOLS[protocol].probe}`, { method: 'GET' }, signal);
  const models = protocol === 'a1111' ? (Array.isArray(data) ? data.map((m) => m.model_name ?? m.title) : []) : Array.isArray(data?.data) ? data.data.map((m) => m.id) : [];
  return { models: models.filter(Boolean).slice(0, 20) };
}

/**
 * Genera una imagen. Devuelve { blob, width, height, origin, provider, recognized? }.
 * `origin` es 'procedural' o 'ai': la interfaz y la galería lo muestran tal cual.
 */
export async function generateImage({ prompt, provider, server, size = 'landscape', variation = 0, signal }) {
  const text = String(prompt ?? '').trim();
  if (!text) throw new GenerationError('Describe la imagen que quieres.');
  if (text.length > MAX_PROMPT) throw new GenerationError(`La descripción admite hasta ${MAX_PROMPT} caracteres.`);
  const { width, height } = SIZES[size] ?? SIZES.landscape;

  if (provider === 'procedural') {
    const plan = interpretPrompt(text, variation);
    const blob = await paintToBlob(plan, width, height);
    return { blob, width, height, origin: 'procedural', provider: 'Pintor procedural', recognized: plan.recognized };
  }

  if (provider !== 'server') throw new GenerationError('Proveedor desconocido.');
  const valid = validateServerUrl(server?.url);
  if (!valid.ok) throw new GenerationError(valid.error);
  const seed = variation ? (variation * 7919) % 2147483647 : -1;
  if (server.protocol === 'openai') {
    const data = await fetchJson(
      `${valid.url}/v1/images/generations`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: text, n: 1, size: `${width}x${height}`, response_format: 'b64_json', ...(server.model ? { model: server.model } : {}) }),
      },
      signal,
    );
    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) throw new GenerationError('El servidor no devolvió ninguna imagen.');
    return { blob: base64ToBlob(b64), width, height, origin: 'ai', provider: server.model || 'Servidor compatible con OpenAI' };
  }
  const data = await fetchJson(
    `${valid.url}/sdapi/v1/txt2img`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: text, negative_prompt: 'texto, marca de agua, borroso', steps: server.steps ?? 20, width, height, cfg_scale: 7, seed, batch_size: 1, n_iter: 1 }),
    },
    signal,
  );
  const b64 = Array.isArray(data?.images) ? data.images[0] : null;
  if (!b64) throw new GenerationError('El servidor no devolvió ninguna imagen.');
  return { blob: base64ToBlob(b64), width, height, origin: 'ai', provider: 'Stable Diffusion (servidor propio)' };
}
