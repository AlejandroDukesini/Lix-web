/**
 * Estado del almacenamiento del navegador (Storage API).
 *
 * Por defecto el navegador puede borrar datos de un sitio cuando falta espacio
 * ("best-effort"). `persist()` pide que no lo haga; el navegador decide si lo
 * concede (Chrome suele concederlo a apps instaladas; Safari tiene reglas propias).
 */

export async function getStorageStatus() {
  const storage = typeof navigator !== 'undefined' ? navigator.storage : undefined;
  if (!storage) return { supported: false, persisted: false, usage: null, quota: null };

  const [persisted, estimate] = await Promise.all([
    storage.persisted ? storage.persisted().catch(() => false) : Promise.resolve(false),
    storage.estimate ? storage.estimate().catch(() => null) : Promise.resolve(null),
  ]);

  return {
    supported: Boolean(storage.persist),
    persisted,
    usage: estimate?.usage ?? null,
    quota: estimate?.quota ?? null,
  };
}

export async function requestPersistentStorage() {
  if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export function formatBytes(bytes) {
  if (bytes === null || bytes === undefined) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toLocaleString('es', { maximumFractionDigits: value < 10 && unit > 0 ? 1 : 0 })} ${units[unit]}`;
}
