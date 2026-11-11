/**
 * Plugin de Vite: empaqueta Python (Pyodide) dentro de la app, sin CDN.
 *
 * Pyodide es CPython compilado a WebAssembly. Lix Flowers lo usa para ejecutar
 * `src/features/flowers/python/lix_flowers.py` en el propio dispositivo.
 *
 * - Desarrollo: sirve `/pyodide/<archivo>` desde node_modules/pyodide y vendor/pyodide.
 * - Build: copia esos archivos a `dist/pyodide/`; el plugin offline los precachea
 *   como cualquier otro recurso, así que Python también funciona sin conexión.
 *
 * La rueda de Pillow (vendor/pyodide) se comprueba contra el sha256 del
 * `pyodide-lock.json` oficial; si no coincide, el build falla. Pyodide vuelve a
 * comprobarlo al instalarla en el navegador.
 */
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUNTIME_DIR = path.join(root, 'node_modules', 'pyodide');
const VENDOR_DIR = path.join(root, 'vendor', 'pyodide');
const RUNTIME_FILES = ['pyodide.mjs', 'pyodide.asm.mjs', 'pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json'];
/** Paquetes de Python que necesita la app (además de la biblioteca estándar). */
export const PYTHON_PACKAGES = ['pillow'];

const TYPES = { '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.zip': 'application/zip', '.json': 'application/json', '.whl': 'application/zip' };

/** Lista { nombre → ruta } de todo lo que se publica en /pyodide/. Valida los checksums. */
export function pyodideFiles() {
  const files = new Map();
  for (const name of RUNTIME_FILES) {
    const file = path.join(RUNTIME_DIR, name);
    if (!existsSync(file)) throw new Error(`[pyodide] Falta ${name}. Ejecuta npm install.`);
    files.set(name, file);
  }
  const lock = JSON.parse(readFileSync(files.get('pyodide-lock.json'), 'utf8'));
  for (const pkg of PYTHON_PACKAGES) {
    const entry = lock.packages[pkg];
    if (!entry) throw new Error(`[pyodide] El lock no contiene ${pkg}.`);
    const file = path.join(VENDOR_DIR, entry.file_name);
    if (!existsSync(file)) throw new Error(`[pyodide] Falta vendor/pyodide/${entry.file_name}.`);
    const digest = createHash('sha256').update(readFileSync(file)).digest('hex');
    if (digest !== entry.sha256) throw new Error(`[pyodide] El sha256 de ${entry.file_name} no coincide con el lock oficial.`);
    files.set(entry.file_name, file);
  }
  return files;
}

export function pyodideRuntime() {
  let files;
  return {
    name: 'lix-pyodide-runtime',
    enforce: 'post',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const match = /^\/pyodide\/([^/?#]+)/.exec(req.url ?? '');
        if (!match) return next();
        files ??= pyodideFiles();
        const file = files.get(decodeURIComponent(match[1]));
        if (!file) return next();
        res.setHeader('Content-Type', TYPES[path.extname(file)] ?? 'application/octet-stream');
        res.end(readFileSync(file));
      });
    },
    generateBundle(_options, bundle) {
      // Solo en el build principal (el que produce index.html), no en el de los Web Workers.
      if (!('index.html' in bundle)) return;
      for (const [name, file] of pyodideFiles()) this.emitFile({ type: 'asset', fileName: `pyodide/${name}`, source: readFileSync(file) });
    },
  };
}
