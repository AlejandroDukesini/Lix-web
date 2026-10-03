import { useEffect, useLayoutEffect, useRef } from 'react';

/** Densidad máxima: más allá de 2× el coste crece mucho y la diferencia apenas se ve. */
const MAX_DPR = 2;

/**
 * Lienzo que se adapta a su contenedor y a la densidad de la pantalla.
 * Devuelve el ref del <canvas>, el contexto 2D y el tamaño en píxeles CSS.
 * `onResize` se llama tras cada cambio de tamaño (sirve para redibujar en pausa).
 * En entornos sin canvas (pruebas) el contexto es null y los juegos no dibujan.
 */
export function useCanvas(onResize) {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const sizeRef = useRef({ width: 0, height: 0, dpr: 1 });
  const resizeHandler = useRef(onResize);
  useLayoutEffect(() => {
    resizeHandler.current = onResize;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    ctxRef.current = canvas.getContext('2d', { alpha: false }) ?? null;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctxRef.current?.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { width, height, dpr };
      resizeHandler.current?.(sizeRef.current);
    };

    resize();
    if (typeof ResizeObserver === 'function') {
      const observer = new ResizeObserver(resize);
      observer.observe(canvas);
      return () => observer.disconnect();
    }
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  return { canvasRef, ctxRef, sizeRef };
}
