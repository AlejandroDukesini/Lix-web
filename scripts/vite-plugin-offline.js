/**
 * Plugin de Vite que prepara la aplicación para funcionar sin conexión.
 *
 * 1. Inyecta una Content-Security-Policy que solo permite recursos del propio
 *    origen: cualquier intento de cargar algo externo queda bloqueado. La única
 *    excepción posible son los iframes de juegos online cuyo proveedor autoriza
 *    la inserción (`frame-src`, generado de onlineSources.js; hoy ninguno).
 * 2. Tras escribir el build principal, recorre `dist/`, genera la lista de archivos a
 *    precachear y la inyecta en `service-worker.js` junto con un hash de versión.
 *    Si cualquier archivo cambia, cambia el hash y el navegador detecta un
 *    Service Worker nuevo (actualización controlada desde la app).
 *
 * Solo actúa en `vite build`; el servidor de desarrollo no registra Service Worker.
 */
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { embedOrigins } from '../src/features/game-center/online/onlineSources.js';

const SW_FILE = 'service-worker.js';
const MANIFEST_PLACEHOLDER = 'self.__PRECACHE_MANIFEST__';
const VERSION_PLACEHOLDER = '__BUILD_VERSION__';
const EXCLUDED = [/\.map$/, /^service-worker\.js$/, /(^|\/)\./];

export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "media-src 'self' blob:",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
  // Solo orígenes de inserción verificados; sin ninguno, frame-src cae en default-src ('self').
  ...(embedOrigins().length ? [`frame-src 'self' ${embedOrigins().join(' ')}`] : []),
].join('; ');

async function listFiles(dir, base = dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const full = path.join(dir, entry.name);
      return entry.isDirectory() ? listFiles(full, base) : [path.relative(base, full).split(path.sep).join('/')];
    }),
  );
  return nested.flat();
}

export function offlinePrecache() {
  let outDir;

  return {
    name: 'uamc-offline-precache',
    apply: 'build',

    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },

    transformIndexHtml() {
      return [
        {
          tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: CONTENT_SECURITY_POLICY },
          injectTo: 'head-prepend',
        },
      ];
    },

    // writeBundle (y no closeBundle): Vite también construye los Web Workers con un
    // sub-build que comparte los plugins; solo el build principal emite index.html,
    // y solo entonces están en disco todos los archivos que hay que precachear.
    async writeBundle(_options, bundle) {
      if (!('index.html' in bundle)) return;
      const files = (await listFiles(outDir)).filter((file) => !EXCLUDED.some((re) => re.test(file))).sort();

      const swPath = path.join(outDir, SW_FILE);
      const source = await readFile(swPath, 'utf8');

      // La versión depende de todos los archivos y del propio Service Worker.
      const hash = createHash('sha256');
      hash.update(source);
      for (const file of files) {
        hash.update(file);
        hash.update(await readFile(path.join(outDir, file)));
      }
      const version = hash.digest('hex').slice(0, 12);

      if (!source.includes(MANIFEST_PLACEHOLDER) || !source.includes(VERSION_PLACEHOLDER)) {
        throw new Error(`[offline] ${SW_FILE} no contiene los marcadores de precache.`);
      }

      const urls = files.map((file) => (file === 'index.html' ? './' : `./${file}`));
      const output = source
        .replace(MANIFEST_PLACEHOLDER, JSON.stringify(urls, null, 2))
        .replace(VERSION_PLACEHOLDER, version);
      await writeFile(swPath, output);

      console.log(`\n[offline] Service Worker v${version}: ${urls.length} recursos precacheados.`);
    },
  };
}
