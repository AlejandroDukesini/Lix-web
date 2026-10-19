/**
 * Calidad gráfica adaptable.
 *
 * Se parte de una estimación del dispositivo (núcleos, memoria, ahorro de datos)
 * y se corrige con lo que se mide de verdad: si los fotogramas tardan de forma
 * sostenida más de lo que permite una animación fluida, se baja un escalón
 * (menos partículas y detalles secundarios). Nunca se toca la lógica del juego,
 * solo lo decorativo; la legibilidad y los controles no cambian.
 */

export function initialQuality() {
  if (typeof navigator === 'undefined') return 'high';
  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 4;
  if (navigator.connection?.saveData) return 'low';
  if (cores <= 4 || memory <= 2) return 'low';
  return 'high';
}

/** Densidad máxima del lienzo según la calidad (más allá apenas se nota y cuesta mucho). */
export const maxDprFor = (quality) => (quality === 'low' ? 1.5 : 2);

/**
 * Monitor de fluidez. `sample(dt)` con los segundos reales del fotograma;
 * devuelve la calidad vigente. Baja a 'low' si la media de ~2 s supera 1/40 s.
 */
export function createQualityMonitor(start = initialQuality()) {
  let quality = start;
  let acc = 0;
  let frames = 0;
  return {
    get quality() {
      return quality;
    },
    sample(dt) {
      if (quality === 'low' || !(dt > 0)) return quality;
      acc += dt;
      frames += 1;
      if (acc >= 2) {
        if (acc / frames > 1 / 40) quality = 'low';
        acc = 0;
        frames = 0;
      }
      return quality;
    },
  };
}
