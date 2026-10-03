import { useCallback, useEffect, useRef, useState } from 'react';
import {
  activeSceneIndex,
  progressFromScroll,
  SCENE_IDS,
  sceneProgress,
  scrollForScene,
  snapForReducedMotion,
} from './timeline.js';

/** Debe coincidir con la media query del layout apaisado en astral.css. */
export const LANDSCAPE_QUERY = '(orientation: landscape) and (min-width: 600px)';

// Respiro entre la vela y la tarjeta final.
const FINALE_GAP = 12;

/**
 * En vertical la tarjeta final se ancla abajo y sube sobre la zona visual
 * (ver .finale en astral.css): devuelve el hueco que queda libre encima.
 * Se usa offsetTop (no getBoundingClientRect) porque ignora el desplazamiento
 * de la animación de entrada del texto.
 */
function spaceAboveFinale(stage, area) {
  const finale = stage.querySelector('[data-finale]');
  if (!finale?.offsetParent) return area;
  let top = 0;
  for (let node = finale; node && node !== stage; node = node.offsetParent) top += node.offsetTop;
  const height = Math.min(area.height, Math.max(0, top - FINALE_GAP - area.y));
  return { ...area, height };
}

/**
 * Controla la historia a partir del desplazamiento de la ventana.
 *
 *  - `trackRef`: contenedor alto que define la duración del viaje.
 *  - `stageRef`: escenario sticky (alto de pantalla) que permanece visible.
 *  - `areaRef`: celda del layout libre de texto donde se compone la ilustración.
 *
 * Un solo listener de scroll (pasivo) agrupado en requestAnimationFrame calcula
 * el progreso global desde la posición real, así que un desplazamiento brusco
 * o un salto da directamente el estado correcto (no hay estados intermedios que
 * puedan quedarse bloqueados). `onFrame` aplica los estilos al DOM; React solo
 * se actualiza cuando cambia el capítulo activo. Nunca se bloquea el scroll.
 */
export function useScrollStory({ trackRef, stageRef, areaRef, reduced, onFrame }) {
  const [active, setActive] = useState(0);
  const measuresRef = useRef(null);
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;

  useEffect(() => {
    let raf = 0;
    let lastActive = -1;

    const measure = () => {
      const track = trackRef.current;
      const stage = stageRef.current;
      const area = areaRef.current;
      if (!track || !stage || !area) return;
      const trackRect = track.getBoundingClientRect();
      const stageRect = stage.getBoundingClientRect();
      const areaRect = area.getBoundingClientRect();
      const portrait = !window.matchMedia?.(LANDSCAPE_QUERY).matches;
      const areaBox = {
        x: areaRect.left - stageRect.left,
        y: areaRect.top - stageRect.top,
        width: areaRect.width,
        height: areaRect.height,
      };
      measuresRef.current = {
        trackTop: trackRect.top + window.scrollY,
        trackHeight: trackRect.height,
        stageHeight: stageRect.height,
        layout: {
          stage: { width: stageRect.width, height: stageRect.height },
          area: areaBox,
          finalArea: portrait ? spaceAboveFinale(stage, areaBox) : areaBox,
          portrait,
        },
      };
    };

    const update = () => {
      raf = 0;
      const m = measuresRef.current;
      if (!m) return;
      const progress = progressFromScroll(window.scrollY, m.trackTop, m.trackHeight, m.stageHeight);
      const raw = sceneProgress(progress);
      const index = activeSceneIndex(progress);
      const visual = reduced ? snapForReducedMotion(raw, index) : raw;
      const t = Object.fromEntries(SCENE_IDS.map((id, i) => [id, visual[i]]));
      onFrameRef.current({ t, raw, progress, index, layout: m.layout });
      if (index !== lastActive) {
        lastActive = index;
        setActive(index);
      }
    };

    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    const remeasure = () => {
      measure();
      schedule();
    };

    measure();
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', remeasure);
    // Cambios de tamaño del escenario o de la zona visual (barras del navegador móvil, fuentes, textos).
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(remeasure) : null;
    const finale = stageRef.current?.querySelector('[data-finale]');
    [trackRef.current, stageRef.current, areaRef.current, finale].forEach((element) => element && observer?.observe(element));

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', remeasure);
      observer?.disconnect();
    };
  }, [trackRef, stageRef, areaRef, reduced]);

  /** Lleva a un capítulo (acción explícita de la persona); `pose` es el punto 0–1 donde detenerse. */
  const scrollToScene = useCallback(
    (index, pose = 0.5) => {
      const m = measuresRef.current;
      if (!m) return;
      const top = scrollForScene(index, pose, m.trackTop, m.trackHeight, m.stageHeight);
      window.scrollTo({ top: Math.round(top), behavior: reduced ? 'auto' : 'smooth' });
    },
    [reduced],
  );

  return { active, scrollToScene };
}
