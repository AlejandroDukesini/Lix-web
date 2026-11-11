import { useEffect, useRef } from 'react';
import { rowRuns } from './flowersOptions.js';

const FONT_STACK = "ui-monospace, 'Cascadia Mono', Consolas, 'Courier New', monospace";
/** Proporción de la celda del GIF (6 × 11 px): la vista previa usa la misma. */
const CELL_RATIO = 11 / 6;

/**
 * Pinta una animación ASCII en un <canvas>.
 * Python entrega los fotogramas (caracteres + índices de color); aquí solo se dibujan.
 * Cada fila se dibuja en tramos del mismo color, con la fuente monoespaciada del sistema
 * estirada al ancho exacto de la celda, para que la rejilla coincida con la del GIF.
 */
export function AsciiPlayer({ animation, fps, playing, restartKey = 0, frameRef, label }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const indexRef = useRef(0);
  const sourceRef = useRef({ animation: null, restartKey });

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap || !animation) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    // Animación nueva o «Reiniciar»: vuelve al primer fotograma.
    if (sourceRef.current.animation !== animation || sourceRef.current.restartKey !== restartKey) {
      indexRef.current = 0;
      sourceRef.current = { animation, restartKey };
    }
    let raf = 0;
    let last = 0;
    let metrics = null;

    const measure = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(120, wrap.clientWidth);
      const cellW = width / animation.cols;
      const cellH = cellW * CELL_RATIO;
      const height = Math.round(cellH * animation.rows);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.height = `${height}px`;
      const fontSize = cellH * 0.92;
      ctx.font = `${fontSize}px ${FONT_STACK}`;
      const advance = ctx.measureText('M').width || fontSize * 0.6;
      metrics = { dpr, cellW, cellH, fontSize, advance, width, height };
    };

    const draw = () => {
      if (!metrics) return;
      const frame = animation.frames[indexRef.current % animation.frames.length];
      const { dpr, cellW, cellH, fontSize, advance, width, height } = metrics;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = animation.background;
      ctx.fillRect(0, 0, width, height);
      ctx.font = `${fontSize}px ${FONT_STACK}`;
      ctx.textBaseline = 'top';
      const scaleX = cellW / advance;
      ctx.setTransform(dpr * scaleX, 0, 0, dpr, 0, 0);
      for (let r = 0; r < animation.rows; r += 1) {
        for (const run of rowRuns(frame, animation.cols, r)) {
          ctx.fillStyle = animation.palette[run.color] ?? '#ffffff';
          ctx.fillText(run.text, run.start * advance, r * cellH + cellH * 0.04);
        }
      }
      if (frameRef) frameRef.current = indexRef.current % animation.frames.length;
    };

    const tick = (now) => {
      raf = requestAnimationFrame(tick);
      if (now - last < 1000 / fps) return;
      last = now;
      indexRef.current = (indexRef.current + 1) % animation.frames.length;
      draw();
    };

    measure();
    draw();
    if (playing) raf = requestAnimationFrame(tick);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => {
      measure();
      draw();
    });
    observer?.observe(wrap);
    return () => {
      cancelAnimationFrame(raf);
      observer?.disconnect();
    };
  }, [animation, fps, playing, restartKey, frameRef]);

  return (
    <div ref={wrapRef} className="flowers-player" style={{ background: animation?.background }}>
      <canvas ref={canvasRef} role="img" aria-label={label} />
    </div>
  );
}
