/**
 * Línea de tiempo del viaje astral.
 *
 * Modelo: un contenedor alto (`.astral__track`) con un escenario `sticky` del
 * alto de la pantalla. El desplazamiento dentro del contenedor da un progreso
 * global P ∈ [0, 1]; cada capítulo ocupa un tramo de P proporcional a su
 * `length` y tiene su propio progreso local t ∈ [0, 1].
 *
 * Cada capítulo se diseña en tres tiempos: entrada (la animación ocurre),
 * permanencia (la composición queda estable y el texto se lee) y salida
 * (transición hacia el siguiente). Así ninguna escena desaparece antes de
 * poder apreciarse y nunca compiten dos textos a la vez.
 *
 * `computeFrame` traduce los progresos al estado visual de todas las capas a
 * partir del rectángulo real de la zona visual (lo mide el layout), de modo que
 * la ilustración y el texto nunca se pisan, sea cual sea el tamaño de pantalla.
 *
 * Todo aquí es puro (sin DOM) para poder probarlo y razonarlo de forma aislada.
 */

/*
 * length: duración relativa (en alturas de pantalla de desplazamiento).
 * keyPose: composición que se muestra con movimiento reducido (sin cámara).
 */
export const SCENES = [
  { id: 'opening', numeral: '', title: 'Prólogo', length: 0.8 },
  // Los textos conservan sus claves de preferencias (starsText, galaxyText) aunque cambie la escena.
  { id: 'galaxy', numeral: 'I', title: 'La galaxia', length: 1.3, textKey: 'starsText', keyPose: 1 },
  { id: 'constellation', numeral: 'II', title: 'Las constelaciones', length: 1.6, textKey: 'constellationText' },
  { id: 'earth', numeral: 'III', title: 'La Tierra', length: 1.4, textKey: 'galaxyText', keyPose: 0.6 },
  { id: 'telescope', numeral: 'IV', title: 'El telescopio', length: 1.3, textKey: 'telescopeText' },
  { id: 'eyepiece', numeral: 'V', title: 'Asomarse', length: 1.3, textKey: 'eyepieceText' },
  { id: 'candle', numeral: 'VI', title: 'La vela', length: 1.6, textKey: 'candleText' },
  { id: 'final', numeral: 'VII', title: 'La sorpresa', length: 1 },
];

export const SCENE_IDS = SCENES.map((scene) => scene.id);

/** Recorrido total en alturas de pantalla (el contenedor mide esto + 1 pantalla). */
export const STORY_LENGTH = SCENES.reduce((sum, scene) => sum + scene.length, 0);

/** Tramo [inicio, fin] de cada capítulo dentro del progreso global. */
export const SCENE_BOUNDS = (() => {
  let start = 0;
  return SCENES.map((scene) => {
    const bounds = [start / STORY_LENGTH, (start + scene.length) / STORY_LENGTH];
    start += scene.length;
    return bounds;
  });
})();

/** Notas manuscritas de la bitácora (dirección de arte; no afirman hechos personales). */
export const LOG_NOTES = {
  galaxy: 'Registro 001 · cientos de miles de millones de estrellas en espiral.',
  earth: 'Tercer planeta desde el Sol. Brillo: en aumento.',
  telescope: 'Linterna roja encendida: así los ojos no pierden la noche.',
};

// --- Utilidades de interpolación --------------------------------------------

export const clamp01 = (value) => Math.min(1, Math.max(0, value));
/** Progreso de `t` dentro del tramo [a, b], acotado a 0–1. */
export const range = (t, a, b) => clamp01((t - a) / (b - a));
export const mix = (a, b, x) => a + (b - a) * x;
export const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
export const easeIn = (x) => x * x * x;
export const easeOut = (x) => 1 - (1 - x) ** 3;
/** Sube en [a, peak] y baja en [peak, b]: para destellos. */
export const bump = (t, a, peak, b) => (t < peak ? range(t, a, peak) : 1 - range(t, peak, b));

// --- Progreso -----------------------------------------------------------------

/**
 * Progreso global a partir del desplazamiento. `trackTop`/`trackHeight` son la
 * posición y altura del contenedor; `stageHeight` la del escenario sticky.
 * El escenario queda fijo mientras se recorren (trackHeight − stageHeight) px.
 */
export function progressFromScroll(scrollY, trackTop, trackHeight, stageHeight) {
  return clamp01((scrollY - trackTop) / Math.max(1, trackHeight - stageHeight));
}

/** Posición de desplazamiento que corresponde a un punto `pose` (0–1) de un capítulo. */
export function scrollForScene(index, pose, trackTop, trackHeight, stageHeight) {
  const [start, end] = SCENE_BOUNDS[index];
  return trackTop + (start + (end - start) * clamp01(pose)) * Math.max(1, trackHeight - stageHeight);
}

/** Progreso local de cada capítulo. Un salto brusco de P da directamente el estado correcto. */
export function sceneProgress(progress) {
  return SCENE_BOUNDS.map(([start, end]) => range(progress, start, end));
}

/** Capítulo activo: aquel en cuyo tramo está el progreso global. */
export function activeSceneIndex(progress) {
  let index = 0;
  SCENE_BOUNDS.forEach(([start], i) => {
    if (progress >= start) index = i;
  });
  return index;
}

/**
 * Con movimiento reducido no hay cámara ni acercamientos: los capítulos ya
 * recorridos quedan completos, el activo muestra su composición clave y los
 * siguientes aún no empiezan. Las capas solo cambian con fundidos.
 */
export function snapForReducedMotion(progress, activeIndex) {
  return progress.map((_, i) => {
    if (i < activeIndex) return 1;
    if (i === activeIndex) return SCENES[i].keyPose ?? 1;
    return 0;
  });
}

// --- Textos -------------------------------------------------------------------

/**
 * Ventana [entrada, salida] (en progreso local) en la que se lee el texto de
 * cada capítulo. Entre la salida de uno y la entrada del siguiente hay un
 * pequeño respiro: nunca se superponen dos textos.
 */
export const CAPTION_WINDOWS = {
  opening: [-1, 0.62],
  galaxy: [0.05, 0.97],
  constellation: [0.04, 0.97],
  // Sale antes del descenso: se baja a la Tierra sin texto encima.
  earth: [0.04, 0.8],
  telescope: [0.06, 0.97],
  eyepiece: [0.2, 0.97],
  candle: [0.05, 0.54],
};

// Rampa de entrada/salida: corta, para que cada texto permanezca casi todo su capítulo.
const CAPTION_RAMP = 0.07;

export function captionFade(id, t) {
  const window = CAPTION_WINDOWS[id];
  if (!window) return 0;
  const [enter, leave] = window;
  return clamp01(Math.min((t - enter) / CAPTION_RAMP, (leave - t) / CAPTION_RAMP));
}

/**
 * Revelaciones guiadas por el desplazamiento (no por temporizadores):
 * «Otro año juntos» llega tras el texto de la vela y cede paso al mensaje final.
 */
export function revealsFor(raw) {
  const candle = raw[SCENE_IDS.indexOf('candle')] ?? 0;
  const final = raw[SCENE_IDS.indexOf('final')] ?? 0;
  return {
    together: range(candle, 0.56, 0.68) * (1 - range(final, 0, 0.08)),
    // Entra mientras la vela termina de acomodarse en su sitio (ver `settle` en computeFrame).
    finale: range(final, 0.12, 0.3),
  };
}

// --- Distancia del viaje -----------------------------------------------------

const UNIVERSE_LY = 13.8e9;
const KM_PER_LY = 9.4607e12;

/**
 * Distancia «restante» poética: de 13.800 millones de años luz a cero, en escala
 * logarítmica para que cada tramo del recorrido se sienta como un salto enorme.
 */
export function distanceRemaining(journey) {
  const ly = 10 ** (Math.log10(UNIVERSE_LY + 1) * (1 - clamp01(journey)) ** 1.25) - 1;
  if (ly >= 1) return { value: ly, unit: ly < 2 ? 'año luz' : 'años luz' };
  const km = ly * KM_PER_LY;
  if (km >= 1) return { value: km, unit: 'km' };
  return { value: 0, unit: 'aquí' };
}

export function formatDistance({ value, unit }) {
  if (unit === 'aquí') return 'Has llegado';
  const rounded = value >= 1e6 ? Math.round(value / 1e6) * 1e6 : Math.round(value);
  return `${rounded.toLocaleString('es')} ${unit}`;
}

// --- Constelación ---------------------------------------------------------

/**
 * Estrellas en un lienzo de 1000×1000. Los cinco puntos principales, unidos en
 * orden (pie izquierdo → cima → pie derecho) y cerrados con el travesaño,
 * dibujan una «A» que no se anuncia: solo se reconoce al completarse.
 */
export const CONSTELLATION = {
  stars: {
    start: [300, 820],
    leftMid: [392, 560],
    apex: [500, 190],
    rightMid: [608, 560],
    today: [700, 820],
  },
  decoys: [
    [170, 330, 1.6],
    [840, 300, 2.2],
    [790, 640, 1.4],
    [215, 650, 1.9],
    [525, 395, 1.1],
    [118, 862, 1.3],
    [902, 880, 1.7],
    [660, 120, 1.2],
    [330, 140, 1],
  ],
  // El recorrido de la «línea del tiempo»: del comienzo hasta hoy.
  path: [
    ['start', 'leftMid'],
    ['leftMid', 'apex'],
    ['apex', 'rightMid'],
    ['rightMid', 'today'],
  ],
  crossbar: ['leftMid', 'rightMid'],
};

// Entrada 0–0.6 (la línea del tiempo), cierre de la «A» 0.62–0.74, permanencia hasta el final.
const PATH_WINDOW = [0.06, 0.6];
const CROSSBAR_WINDOW = [0.62, 0.74];

/** Progreso de cada segmento y del travesaño para el progreso local `c`. */
export function constellationProgress(c) {
  const segments = CONSTELLATION.path.length;
  const timeline = range(c, ...PATH_WINDOW);
  const perSegment = Array.from({ length: segments }, (_, i) => clamp01(timeline * segments - i));
  return { timeline, segments: perSegment, crossbar: range(c, ...CROSSBAR_WINDOW), complete: range(c, 0.74, 0.84) };
}

/** Punta de la línea que se está dibujando (donde viaja el contador de días). */
export function constellationTip(timeline) {
  const { path, stars } = CONSTELLATION;
  const exact = clamp01(timeline) * path.length;
  const index = Math.min(path.length - 1, Math.floor(exact));
  const local = exact - index;
  const [from, to] = path[index].map((key) => stars[key]);
  return [mix(from[0], to[0], local), mix(from[1], to[1], local)];
}

// --- Fotograma completo -----------------------------------------------------

/**
 * Estado visual de todas las capas.
 * @param {Record<string, number>} t   progreso local por id de escena
 * @param {{ stage: {width:number,height:number}, area: Rect, finalArea?: Rect, portrait: boolean }} layout
 *   `area` es la zona visual libre de texto dentro del escenario (medida del layout).
 *   `finalArea` es el hueco que deja libre el mensaje final (en vertical, la tarjeta
 *   final es más alta que los textos de capítulo y sube sobre la zona visual).
 */
export function computeFrame(t, layout) {
  const { stage, area, portrait } = layout;
  const s = t.galaxy ?? 0;
  const c = t.constellation ?? 0;
  const g = t.earth ?? 0;
  const te = t.telescope ?? 0;
  const e = t.eyepiece ?? 0;
  const k = t.candle ?? 0;
  const f = t.final ?? 0;

  // Centro y tamaño de la composición: siempre dentro de la zona visual.
  const cx = area.x + area.width / 2;
  const cy = area.y + area.height / 2;
  const areaMin = Math.min(area.width, area.height);
  const targetRadius = areaMin * (portrait ? 0.43 : 0.45);
  // Radio que cubre todo el escenario desde un centro dado (iris totalmente abierto).
  const coverRadius = (x, y) =>
    Math.max(Math.hypot(x, y), Math.hypot(stage.width - x, y), Math.hypot(x, stage.height - y), Math.hypot(stage.width - x, stage.height - y)) + 24;
  const inArea = (fx, fy) => [area.x + area.width * fx, area.y + area.height * fy];

  // Viaje total hasta llegar a la vela (para el contador de distancia).
  const journeyWeights = [
    [s, 1.3],
    [c, 1.6],
    [g, 1.4],
    [te, 1.3],
    [e, 1.3],
    [range(k, 0, 0.4), 0.6],
  ];
  const journey = journeyWeights.reduce((sum, [p, w]) => sum + p * w, 0) / journeyWeights.reduce((sum, [, w]) => sum + w, 0);

  // Cámara del campo de estrellas: un leve avance y, hacia la Tierra, un vuelo hacia delante.
  const afterEarth = te > 0;
  const warp = afterEarth ? 0 : easeIn(range(g, 0, 0.85)) * 0.6;
  const starZoom = afterEarth ? 1.04 : 1 + s * 0.1 + c * 0.08 + warp;

  // Galaxia (I): puntos dispersos por el cielo se reúnen en los brazos de una espiral
  // (`form`), que gira en el centro; con las constelaciones se aleja a una esquina.
  let galaxy;
  if (f > 0) {
    const [x, y] = inArea(0.86, 0.12);
    galaxy = { x, y, radius: 0.2 * areaMin * 0.5, opacity: 0.55 * range(f, 0.15, 0.7), form: 1 };
  } else if (te > 0 || e > 0 || k > 0) {
    const [x, y] = inArea(0.2, 0.14);
    galaxy = { x, y, radius: 0.2 * areaMin * 0.5, opacity: 0.9 * range(te, 0.1, 0.45) * (1 - range(e, 0.1, 0.45)), form: 1 };
  } else {
    const leave = easeInOut(range(c, 0, 0.3));
    const [x1, y1] = inArea(0.84, 0.16);
    galaxy = {
      x: mix(cx, x1, leave),
      y: mix(cy, y1, leave),
      radius: mix(areaMin * 0.48, areaMin * 0.09, leave),
      opacity: mix(mix(0.4, 1, range(s, 0, 0.25)), 0.7, leave) * (1 - range(g, 0, 0.25)),
      form: easeInOut(range(s, 0.02, 0.62)),
    };
  }

  // La Tierra (III): un punto azul lejano que se acerca y gira (0–0.55), queda en
  // primer plano mientras se lee (0.55–0.78) y la cámara desciende hasta que su
  // borde es el horizonte (0.78–1); con el telescopio se funde con su planeta.
  const earthHold = areaMin * 0.4;
  const approach = easeInOut(range(g, 0, 0.55));
  const travel = easeOut(range(g, 0, 0.45));
  const [ex0, ey0] = inArea(0.78, 0.2);
  const descent = easeIn(range(g, 0.78, 1));
  const holdRadius = earthHold * mix(1, 1.08, range(g, 0.55, 0.78));
  const finalRadius = Math.max(stage.width, stage.height) * 1.6;
  const earthRadius = descent > 0 ? holdRadius * (finalRadius / holdRadius) ** descent : areaMin * 0.03 * (earthHold / (areaMin * 0.03)) ** approach;
  const earthTop = mix(cy - holdRadius, stage.height * 0.74, descent);
  const earth = {
    x: descent > 0 ? mix(cx, stage.width / 2, descent) : mix(ex0, cx, travel),
    y: descent > 0 ? earthTop + earthRadius : mix(ey0, cy, travel),
    radius: earthRadius,
    opacity: range(g, 0, 0.06) * (1 - range(te, 0.05, 0.4)),
    // Fracción de vuelta: de África hacia las Américas mientras dura el capítulo.
    spin: g * 0.25 + te * 0.03,
    // Al descender, el globo se inclina hacia el ecuador: el horizonte es tierra, no hielo polar.
    tilt: easeInOut(range(g, 0.74, 0.96)),
  };

  const constellation = constellationProgress(c);
  const candleEcho = range(k, 0.3, 0.6);
  const constellationOpacity = Math.max(
    range(c, 0.02, 0.1) * (1 - range(g, 0, 0.3)) * (1 - range(te, 0, 0.35)),
    candleEcho * 0.42 * (1 - range(f, 0.05, 0.5)),
  );

  // Telescopio: sube en la entrada (0–0.45), luego permanece estable para reconocerlo.
  const rise = easeOut(range(te, 0, 0.45));
  // Ocular: acercamiento 0–0.7, el iris se cierra 0.2–0.65, enfoque 0.55–1.
  const zoom = easeIn(range(e, 0, 0.7));
  const irisClose = easeInOut(range(e, 0.2, 0.65));
  const irisOpen = easeInOut(range(f, 0.02, 0.5));

  // Final: la cámara sube la vela al hueco libre sobre el mensaje y la ajusta a ese
  // espacio (la vela mide ~1,45 radios de alto), para que la tarjeta nunca la tape.
  const settle = easeInOut(range(f, 0, 0.3));
  const finalArea = layout.finalArea ?? area;
  const restX = finalArea.x + finalArea.width / 2;
  const restY = finalArea.y + finalArea.height / 2;
  const fit = Math.min(0.88, Math.min(finalArea.width, finalArea.height) / (1.45 * targetRadius));
  const ox = mix(cx, restX, settle);
  const oy = mix(cy, restY, settle);
  const radius = mix(mix(coverRadius(cx, cy), targetRadius, irisClose), coverRadius(ox, oy), irisOpen);
  const focus = clamp01(range(e, 0.55, 1) * 0.65 + range(k, 0, 0.22) * 0.35);

  return {
    portrait,
    journey,
    center: { x: cx, y: cy },
    sky: {
      // El universo «despierta» en el final: más luz y color.
      dawn: range(f, 0.05, 0.6),
    },
    stars: { zoom: starZoom, drift: s + c + g * 1.5 + te * 0.4, brightness: 1 + range(f, 0.1, 0.7) * 0.6 },
    nebula: {
      opacity: clamp01(0.55 + s * 0.2 + g * 0.2 - range(e, 0.2, 0.6) * 0.5 + range(f, 0.05, 0.6) * 0.5),
      shift: -(s * 50 + c * 80 + g * 110 + te * 40),
      scale: 1 + s * 0.06 + c * 0.04 + (afterEarth ? 0 : g * 0.2),
    },
    // Los planetas lejanos ceden protagonismo a la galaxia y desaparecen ante la Tierra.
    planets: { opacity: (1 - 0.7 * galaxy.form * (1 - range(c, 0, 0.3))) * (1 - range(g, 0, 0.3)), shift: -(s * 90 + c * 160 + g * 240) },
    galaxy,
    earth,
    // Luz suave al entrar en la atmósfera.
    flash: bump(g, 0.86, 0.95, 1) * 0.45,
    constellation: {
      ...constellation,
      opacity: constellationOpacity,
      // Las fechas solo acompañan a la constelación; no al eco del capítulo VI.
      labels: 1 - range(g, 0, 0.25),
      // En el capítulo VI la «A» crece hasta enmarcar el ocular (el travesaño queda tras el círculo).
      scale: 0.92 + c * 0.08 + candleEcho * 1.3,
    },
    telescope: {
      opacity: range(te, 0, 0.25) * (1 - range(e, 0.62, 0.82)),
      rise,
      notes: range(te, 0.4, 0.6) * (1 - range(e, 0, 0.15)),
      zoom,
      eyepieceGlow: range(te, 0.45, 0.75),
    },
    iris: { x: ox, y: oy, radius, targetRadius, active: e > 0.01 && f < 0.99 },
    // La pantalla queda mayoritariamente oscura (se mira por el ocular) en cualquier tema.
    dark: e > 0.35 && f < 0.35,
    eyepiece: {
      opacity: range(e, 0.42, 0.72),
      lens: 1 - range(f, 0.1, 0.55),
      reticle: range(e, 0.55, 0.85) * (1 - range(f, 0, 0.3)),
      focus,
      blur: (1 - focus) * 16,
      // Se retira antes de que entre el mensaje final (revealsFor → finale desde 0.12).
      catalog: range(k, 0.35, 0.55) * (1 - range(f, 0, 0.1)),
    },
    candle: {
      glow: range(k, 0.08, 0.35),
      letter: range(k, 0.12, 0.4),
      // En el final la vela queda centrada sobre el mensaje, algo más pequeña.
      scale: mix(1, fit, settle),
    },
  };
}
