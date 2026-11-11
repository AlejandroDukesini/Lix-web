/**
 * Cliente del motor Python de Lix Flowers.
 *
 * Arranca el Web Worker solo cuando se necesita (la primera vez tarda unos segundos:
 * hay que compilar CPython en WebAssembly) y lo reutiliza después. Cada petición
 * espera su respuesta por id. Los archivos de Python se sirven desde la propia app
 * (`/pyodide/`), así que funciona sin Internet.
 */

export class PythonEngineError extends Error {
  constructor(message, { userError = false } = {}) {
    super(message);
    this.name = 'PythonEngineError';
    this.userError = userError;
  }
}

let worker = null;
let nextId = 1;
const pending = new Map();
const listeners = new Set();
let state = { stage: 'idle', version: null, catalog: null, error: null };
let initPromise = null;

function setState(patch) {
  state = { ...state, ...patch };
  for (const listener of listeners) listener(state);
}

export function getEngineState() {
  return state;
}

export function subscribeEngine(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function failAll(message) {
  for (const { reject } of pending.values()) reject(new PythonEngineError(message));
  pending.clear();
}

function ensureWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('./python.worker.js', import.meta.url), { type: 'module', name: 'lix-python' });
  worker.onmessage = (event) => {
    const data = event.data;
    if (data?.type === 'progress') {
      setState({ stage: data.stage, ...(data.version ? { version: data.version } : {}) });
      return;
    }
    const entry = pending.get(data?.id);
    if (!entry) return;
    pending.delete(data.id);
    if (data.ok) entry.resolve(data.result);
    else entry.reject(new PythonEngineError(data.error, { userError: data.userError }));
  };
  worker.onerror = (event) => {
    event.preventDefault?.();
    setState({ stage: 'error', error: 'No se pudo iniciar Python en este navegador.' });
    failAll('No se pudo iniciar Python en este navegador.');
    worker?.terminate();
    worker = null;
    initPromise = null;
  };
  return worker;
}

function request(type, payload = {}, transfer = []) {
  const target = ensureWorker();
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    target.postMessage({ id, type, ...payload }, transfer);
  });
}

/** Inicia Python (idempotente). */
export function startPython() {
  if (typeof Worker === 'undefined' || typeof WebAssembly === 'undefined') {
    setState({ stage: 'error', error: 'Este navegador no admite WebAssembly o Web Workers.' });
    return Promise.reject(new PythonEngineError(state.error));
  }
  if (!initPromise) {
    setState({ stage: 'runtime', error: null });
    const indexURL = new URL('pyodide/', document.baseURI).href;
    initPromise = request('init', { indexURL }).then(
      (result) => {
        setState({ stage: 'ready', version: result.version, catalog: result.catalog });
        return result;
      },
      (error) => {
        setState({ stage: 'error', error: error.message });
        initPromise = null;
        throw error;
      },
    );
  }
  return initPromise;
}

/** Genera la animación en Python. `image` es un ArrayBuffer (se transfiere, no se copia). */
export async function buildAnimation(spec, image = null) {
  await startPython();
  const copy = image ? image.slice(0) : null;
  return request('build', { spec, image: copy }, copy ? [copy] : []);
}

/** GIF de la última animación generada, como Blob. */
export async function exportGif(fps) {
  await startPython();
  const buffer = await request('gif', { fps });
  return new Blob([buffer], { type: 'image/gif' });
}
