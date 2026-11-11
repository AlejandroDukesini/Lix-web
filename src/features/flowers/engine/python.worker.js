/**
 * Web Worker de Python: carga Pyodide (CPython 3.14 en WebAssembly), instala Pillow
 * desde los archivos de la propia app y ejecuta lix_flowers.py. Así la interfaz no se
 * congela mientras Python trabaja.
 *
 * Mensajes de entrada:  { id, type: 'init', indexURL } | { id, type: 'build', spec, image? } | { id, type: 'gif', fps }
 * Mensajes de salida:   { type: 'progress', stage } | { id, ok: true, result } | { id, ok: false, error, userError }
 */
import source from '../python/lix_flowers.py?raw';

let pyodidePromise = null;
let engine = null;

function post(message, transfer) {
  self.postMessage(message, transfer ?? []);
}

async function boot(indexURL) {
  post({ type: 'progress', stage: 'runtime' });
  const { loadPyodide } = await import(/* @vite-ignore */ `${indexURL}pyodide.mjs`);
  const pyodide = await loadPyodide({ indexURL, packageBaseUrl: indexURL });
  post({ type: 'progress', stage: 'packages' });
  await pyodide.loadPackage('pillow', { messageCallback: () => {}, errorCallback: () => {} });
  pyodide.FS.writeFile('/home/pyodide/lix_flowers.py', source);
  engine = pyodide.pyimport('lix_flowers');
  post({ type: 'progress', stage: 'ready', version: pyodide.version });
  return pyodide;
}

/** Los errores de Python llegan con el traceback completo; FlowerError se muestra tal cual a la persona. */
function describe(error) {
  const lines = String(error?.message ?? error).trim().split('\n');
  const last = lines[lines.length - 1] ?? '';
  const match = /FlowerError: (.*)$/.exec(last);
  return match ? { error: match[1], userError: true } : { error: last || 'Error desconocido en Python.', userError: false };
}

self.onmessage = async (event) => {
  const { id, type } = event.data ?? {};
  try {
    if (type === 'init') {
      pyodidePromise ??= boot(event.data.indexURL);
      const pyodide = await pyodidePromise;
      post({ id, ok: true, result: { version: pyodide.version, catalog: JSON.parse(engine.catalog()) } });
      return;
    }
    const pyodide = await pyodidePromise;
    if (!pyodide) throw new Error('Python no está iniciado.');
    if (type === 'build') {
      // undefined (y no null) para que Python reciba None: null llega como JsNull.
      const image = event.data.image ? new Uint8Array(event.data.image) : undefined;
      pyodide.globals.set('lix_image', image);
      pyodide.globals.set('lix_spec', JSON.stringify(event.data.spec));
      const json = pyodide.runPython('import lix_flowers\nlix_flowers.build(lix_spec, lix_image.to_bytes() if lix_image is not None else None)');
      pyodide.globals.delete('lix_image');
      post({ id, ok: true, result: JSON.parse(json) });
      return;
    }
    if (type === 'gif') {
      const proxy = engine.render_gif(event.data.fps ?? 10, 2);
      const view = proxy.getBuffer('u8');
      const bytes = view.data.slice();
      view.release();
      proxy.destroy();
      post({ id, ok: true, result: bytes.buffer }, [bytes.buffer]);
      return;
    }
    throw new Error(`Mensaje desconocido: ${type}`);
  } catch (error) {
    if (type === 'init') pyodidePromise = null;
    post({ id, ok: false, ...describe(error) });
  }
};
