/**
 * Estado de la PWA (Service Worker e instalación), fuera de React para poder
 * capturar eventos que ocurren antes de montar la interfaz, como
 * `beforeinstallprompt`. React lo lee con useSyncExternalStore (ver usePwa).
 *
 * Ciclo de actualización:
 *   1. El navegador detecta un service-worker.js distinto (nuevo build).
 *   2. El SW nuevo se instala y precachea en segundo plano, y queda "waiting".
 *   3. La app muestra "Hay una versión nueva" → applyUpdate() envía SKIP_WAITING.
 *   4. El SW nuevo toma el control (controllerchange) y la página se recarga una vez.
 */

let state = {
  supported: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
  offlineReady: false,
  waitingWorker: null,
  installEvent: null,
  installed: false,
};
const listeners = new Set();

function setState(patch) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

export const pwaStore = {
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot() {
    return state;
  },
};

export function isStandalone() {
  if (typeof window === 'undefined') return false;
  return Boolean(window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone);
}

export function detectPlatform() {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent;
  const iPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  if (/iPhone|iPad|iPod/.test(ua) || iPadOS) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}

function trackInstallation(registration) {
  const watch = (worker) => {
    worker.addEventListener('statechange', () => {
      if (worker.state !== 'installed') return;
      // Con un controlador previo es una actualización; sin él, es la primera instalación.
      if (navigator.serviceWorker.controller) setState({ waitingWorker: worker });
      else setState({ offlineReady: true });
    });
  };
  if (registration.waiting && navigator.serviceWorker.controller) setState({ waitingWorker: registration.waiting });
  if (registration.installing) watch(registration.installing);
  registration.addEventListener('updatefound', () => registration.installing && watch(registration.installing));
}

export function initPwa() {
  if (typeof window === 'undefined') return;

  setState({ installed: isStandalone() });
  window.addEventListener('beforeinstallprompt', (event) => {
    // Se guarda el evento para mostrar el botón de instalar dentro de Configuración.
    event.preventDefault();
    setState({ installEvent: event });
  });
  window.addEventListener('appinstalled', () => setState({ installed: true, installEvent: null }));

  // En desarrollo no se registra: Vite sirve archivos que cambian a cada guardado.
  if (!import.meta.env.PROD || !state.supported || window.location.protocol === 'file:') return;

  const register = async () => {
    try {
      const registration = await navigator.serviceWorker.register('./service-worker.js', { scope: './' });
      trackInstallation(registration);
      // `ready` se resuelve cuando hay un SW activo, es decir, cuando la caché offline está completa.
      navigator.serviceWorker.ready.then(() => setState({ offlineReady: true }));
      // Busca actualizaciones al volver a la app (útil en la versión instalada, que rara vez se recarga).
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return;
        registration.update().catch((error) => {
          // Sin servidor (uso offline normal) la comprobación falla; no afecta a la app.
          if (import.meta.env.DEV) console.info('[pwa] Comprobación de actualización omitida:', error);
        });
      });
    } catch (error) {
      console.error('[pwa] No se pudo registrar el Service Worker:', error);
    }
  };

  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}

export function applyUpdate() {
  const worker = state.waitingWorker;
  if (!worker) return;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return;
    reloaded = true;
    window.location.reload();
  });
  worker.postMessage({ type: 'SKIP_WAITING' });
}

export async function promptInstall() {
  const event = state.installEvent;
  if (!event) return 'unavailable';
  event.prompt();
  const { outcome } = await event.userChoice;
  setState({ installEvent: null, installed: outcome === 'accepted' || state.installed });
  return outcome;
}
