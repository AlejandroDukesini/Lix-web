import { useSyncExternalStore } from 'react';

/**
 * ¿Hay conexión? Sigue los eventos `online`/`offline` del navegador.
 * `navigator.onLine === false` es fiable (no hay red); `true` solo indica que
 * hay alguna red, no que Internet responda: quien cargue contenido externo
 * debe seguir contemplando que falle.
 */
export function useOnlineStatus() {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener('online', onChange);
      window.addEventListener('offline', onChange);
      return () => {
        window.removeEventListener('online', onChange);
        window.removeEventListener('offline', onChange);
      };
    },
    () => navigator.onLine !== false,
    () => true,
  );
}
