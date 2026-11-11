/**
 * Puente con la app nativa de Android (android/ → LixBridge.kt).
 *
 * En la web (navegador o PWA) `window.LixAndroid` no existe y todas estas funciones
 * devuelven null/false sin hacer nada: la misma app funciona en ambos sitios.
 *
 * Dentro del APK:
 *  - no se registra el Service Worker (los archivos ya están dentro del APK);
 *  - las descargas se guardan en Descargas/Lix (el WebView no descarga blobs por sí solo);
 *  - la app publica una instantánea de datos para los widgets y los consejos (Snapshot.kt);
 *  - las notificaciones de consejos las programa Android, también con la app cerrada.
 */

const listeners = new Map();

function native() {
  return typeof window !== 'undefined' && window.LixAndroid && typeof window.LixAndroid.publishSnapshot === 'function' ? window.LixAndroid : null;
}

export function isAndroidShell() {
  return native() !== null;
}

// Eventos que envía Android con window.__lixNative(tipo, valor).
if (typeof window !== 'undefined') {
  window.__lixNative = (type, value) => {
    for (const listener of listeners.get(type) ?? []) {
      try {
        listener(value);
      } catch {
        // Un oyente con errores no debe impedir los demás.
      }
    }
  };
}

export function onNativeEvent(type, listener) {
  if (!listeners.has(type)) listeners.set(type, new Set());
  listeners.get(type).add(listener);
  return () => listeners.get(type).delete(listener);
}

export function nativeInfo() {
  try {
    return native() ? JSON.parse(native().info()) : null;
  } catch {
    return null;
  }
}

export function publishSnapshot(snapshot) {
  const bridge = native();
  if (!bridge) return false;
  try {
    return bridge.publishSnapshot(JSON.stringify(snapshot)) === true;
  } catch {
    return false;
  }
}

/** Consejos que Android mostró con la app cerrada: [{ key, tipId, shownAt }]. */
export function consumeDeliveredTips() {
  const bridge = native();
  if (!bridge) return [];
  try {
    const list = JSON.parse(bridge.consumeDeliveredTips());
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/** Pide al lanzador fijar un widget (Android 8+; el sistema muestra su propia confirmación). */
export function pinAndroidWidget(kind) {
  try {
    return native()?.pinWidget(kind) === true;
  } catch {
    return false;
  }
}

export function nativeNotificationPermission() {
  try {
    return native()?.notificationPermission() ?? null;
  } catch {
    return null;
  }
}

/** Pide el permiso de notificaciones (Android 13+). Resuelve 'granted' o 'denied'. */
export function requestNativeNotificationPermission() {
  const bridge = native();
  if (!bridge) return Promise.resolve(null);
  return new Promise((resolve) => {
    const off = onNativeEvent('notificationPermission', (value) => {
      off();
      resolve(value);
    });
    bridge.requestNotificationPermission();
  });
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Guarda un archivo en Descargas/Lix. Devuelve false si no hay puente o falla. */
export async function saveFileNative(blob, filename) {
  const bridge = native();
  if (!bridge) return false;
  try {
    return bridge.saveFile(await blobToBase64(blob), filename, blob.type || 'application/octet-stream') === true;
  } catch {
    return false;
  }
}
