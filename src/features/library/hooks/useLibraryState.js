import { useEffect, useState } from 'react';
import { createEmptyLibraryState, readLibraryState, subscribeLibrary } from '../services/libraryStorage.js';

/**
 * Estado de lectura compartido por el catálogo y el lector. `ready` es false
 * hasta leer IndexedDB (unos milisegundos), para no mostrar «sin empezar» por error.
 */
export function useLibraryState() {
  const [state, setState] = useState(createEmptyLibraryState);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    const unsubscribe = subscribeLibrary((next) => active && setState(next));
    readLibraryState().then((value) => {
      if (!active) return;
      setState(value);
      setReady(true);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return { state, ready };
}

/** Último documento empezado y no terminado (para «Seguir leyendo»). */
export function lastOpened(state, findDocument) {
  return (
    Object.entries(state.progress)
      .filter(([id, p]) => p.updatedAt && !p.finishedAt && p.percent > 0.02 && findDocument(id))
      .sort((a, b) => b[1].updatedAt.localeCompare(a[1].updatedAt))
      .map(([id, p]) => ({ doc: findDocument(id), progress: p }))[0] ?? null
  );
}
