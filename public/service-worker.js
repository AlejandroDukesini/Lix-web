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
  // La app avisa cuando cambia la instantánea de datos: el widget de Windows se repinta.
  if (event.data && event.data.type === 'WIDGETS_REFRESH') event.waitUntil(renderLixWidget().catch(() => {}));
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

// Recordatorios: al pulsar una notificación se enfoca la app (o se abre) en la pantalla del aviso.
// Las notificaciones las crea la propia app mientras está abierta; no hay servidor de avisos (push).
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const path = typeof event.notification.data?.url === 'string' && event.notification.data.url.startsWith('/') ? event.notification.data.url : '/';
  const target = `${SHELL_URL}#${path}`;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windows) {
        if (client.url.startsWith(SHELL_URL) && 'focus' in client) {
          await client.focus();
          if ('navigate' in client) await client.navigate(target).catch(() => {});
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});

/*
 * Widget de Windows 11 (Tablero de Widgets) para la PWA instalada, según la documentación de
 * Microsoft Edge: el manifiesto declara el widget (`widgets`) con una plantilla Adaptive Card y
 * este Service Worker lo pinta con self.widgets.updateByTag(tag, { template, data }).
 * Los datos salen de la instantánea que la app guarda en IndexedDB (meta/widgetSnapshot), la
 * misma proyección que usan los widgets de Android. Donde no existe self.widgets no se hace nada.
 */
const WIDGET_TAG = 'lix-dia';
try {
  importScripts('./widgets/widget-data.js');
} catch {
  // Sin el script, el widget simplemente no se actualiza.
}

function readWidgetSnapshot() {
  return new Promise((resolve) => {
    let request;
    try {
      request = indexedDB.open('un-ano-mas-contigo');
    } catch {
      resolve(null);
      return;
    }
    request.onerror = () => resolve(null);
    request.onupgradeneeded = () => {
      // La base aún no existe (la app nunca se abrió): no se crea desde aquí.
      request.transaction.abort();
      resolve(null);
    };
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('meta')) {
        db.close();
        resolve(null);
        return;
      }
      const get = db.transaction('meta', 'readonly').objectStore('meta').get('widgetSnapshot');
      get.onsuccess = () => {
        resolve(get.result ?? null);
        db.close();
      };
      get.onerror = () => {
        resolve(null);
        db.close();
      };
    };
  });
}

async function renderLixWidget() {
  if (!self.widgets || typeof self.lixWidgetData !== 'function') return;
  const widget = await self.widgets.getByTag(WIDGET_TAG);
  if (!widget) return;
  const template = await (await fetch(widget.definition.msAcTemplate)).text();
  const data = JSON.stringify(self.lixWidgetData(await readWidgetSnapshot(), new Date()));
  await self.widgets.updateByTag(WIDGET_TAG, { template, data });
}

self.addEventListener('widgetinstall', (event) => {
  event.waitUntil(
    (async () => {
      await renderLixWidget();
      // Actualización periódica (si el navegador lo permite); el intervalo viene del manifiesto.
      const minInterval = (event.widget?.definition?.update ?? 1800) * 1000;
      if (self.registration.periodicSync) await self.registration.periodicSync.register(WIDGET_TAG, { minInterval }).catch(() => {});
    })(),
  );
});
self.addEventListener('widgetresume', (event) => event.waitUntil(renderLixWidget()));
self.addEventListener('widgetuninstall', (event) => {
  event.waitUntil(self.registration.periodicSync ? self.registration.periodicSync.unregister(WIDGET_TAG).catch(() => {}) : Promise.resolve());
});
self.addEventListener('periodicsync', (event) => {
  if (event.tag === WIDGET_TAG) event.waitUntil(renderLixWidget());
});
self.addEventListener('widgetclick', (event) => {
  if (event.action !== 'open') return;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const existing = windows.find((c) => c.url.startsWith(SHELL_URL));
      if (existing) await existing.focus();
      else await self.clients.openWindow(`${SHELL_URL}#/consejos`);
    })(),
  );
});
