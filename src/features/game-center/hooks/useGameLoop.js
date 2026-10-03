import { useEffect, useLayoutEffect, useRef } from 'react';

/** Paso máximo por fotograma: tras una pestaña en segundo plano no se "teletransporta" la simulación. */
export const MAX_FRAME_DT = 1 / 20;

/**
 * Bucle de animación con requestAnimationFrame.
 * `onFrame(dt, now)` recibe los segundos transcurridos (acotados a MAX_FRAME_DT).
 * Solo corre mientras `active` es true; al desactivarse o desmontarse se cancela
 * el fotograma pendiente, así que un juego cerrado o en pausa no consume CPU.
 */
export function useGameLoop(onFrame, active) {
  const callback = useRef(onFrame);
  useLayoutEffect(() => {
    callback.current = onFrame;
  });

  useEffect(() => {
    if (!active) return undefined;
    let frame = 0;
    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min(MAX_FRAME_DT, Math.max(0, (now - last) / 1000));
      last = now;
      callback.current(dt, now);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active]);
}
