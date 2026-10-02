/*
 * Service Worker — Un año más contigo
 *
 * Ciclo de vida:
 *  - install:  descarga y guarda en caché TODOS los archivos del build (lista
 *              inyectada en `vite build` por scripts/vite-plugin-offline.js).
 *              Si un archivo falla, la instalación falla y se conserva la
 *              versión anterior: nunca queda una caché a medias.
 *  - waiting:  una versión nueva espera hasta que la app le envía SKIP_WAITING
 *              (la persona pulsa "Actualizar"), para no cambiar archivos en
 *              mitad de una sesión.
 *  - activate: borra cachés de versiones anteriores y toma control de las
 *              pestañas abiertas.
 *  - fetch:    cache-first para todo recurso del propio origen. Las
 *              navegaciones reciben siempre el shell (index.html) cacheado.
 *              No se intercepta ningún origen externo (la app no usa ninguno).
 */

const VERSION = '__BUILD_VERSION__';
const CACHE_PREFIX = 'uamc-';
const CACHE_NAME = `${CACHE_PREFIX}${VERSION}`;
const PRECACHE_URLS = self.__PRECACHE_MANIFEST__;
const SHELL_URL = new URL('./', self.registration.scope).href;
const OFFLINE_URL = new URL('./offline.html', self.registration.scope).href;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(PRECACHE_URLS.map((url) => new Request(new URL(url, self.registration.scope), { cache: 'reload' }))),
    ),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data && event.data.type === 'GET_VERSION' && event.ports[0]) event.ports[0].postMessage(VERSION);
});

async function handleNavigation(request) {
  const cache = await caches.open(CACHE_NAME);
  const shell = await cache.match(SHELL_URL, { ignoreVary: true });
  if (shell) return shell;
  try {
    return await fetch(request);
  } catch {
    return (await cache.match(OFFLINE_URL, { ignoreVary: true })) || Response.error();
  }
}

async function handleAsset(request) {
  const cache = await caches.open(CACHE_NAME);
  // ignoreVary: las fuentes se piden en modo CORS (con cabecera Origin) y algunos
  // servidores responden con "Vary: Origin"; sin esto, no coincidirían con la copia
  // precacheada (pedida sin Origin) y fallarían sin conexión.
  const cached = await cache.match(request, { ignoreSearch: true, ignoreVary: true });
  if (cached) return cached;
  // Recurso no precacheado (no debería ocurrir): se pide a la red local y se guarda.
  const response = await fetch(request);
  if (response.ok && response.type === 'basic') cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(request.mode === 'navigate' ? handleNavigation(request) : handleAsset(request));
});
