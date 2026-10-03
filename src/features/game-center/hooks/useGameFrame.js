import { createContext, useContext, useEffect } from 'react';

/**
 * Comunicación entre la pantalla de juego (GamePage) y el juego montado.
 *   exit()               volver a la biblioteca
 *   showInstructions()   volver a la pantalla de presentación del juego
 *   setInProgress(bool)  hay una partida en curso: salir pedirá confirmación
 *   interrupted          true mientras un diálogo del marco (salir, ayuda) tapa el juego
 */
export const GameFrameContext = createContext({
  exit() {},
  showInstructions() {},
  setInProgress() {},
  interrupted: false,
});

export function useGameFrame() {
  return useContext(GameFrameContext);
}

/** Marca la partida como "en curso" mientras `active` sea true. */
export function useInProgress(active) {
  const { setInProgress } = useGameFrame();
  useEffect(() => {
    setInProgress(Boolean(active));
    return () => setInProgress(false);
  }, [active, setInProgress]);
}

/** Pausa el juego cuando el marco lo interrumpe (diálogo de salida o de ayuda). */
export function usePauseOnInterrupt(pause) {
  const { interrupted } = useGameFrame();
  useEffect(() => {
    if (interrupted) pause();
  }, [interrupted, pause]);
}
