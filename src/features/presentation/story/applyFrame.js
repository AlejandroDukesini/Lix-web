import { captionFade, constellationTip, distanceRemaining, formatDistance, revealsFor, SCENE_IDS } from './timeline.js';
import { EYEPIECE, projectToArea } from './Telescope.jsx';
import { EARTH_STRIP } from './Earth.jsx';

/**
 * Busca una sola vez los nodos que se animan (marcados con data-*).
 * Se usan referencias directas para escribir estilos en cada fotograma.
 */
export function collectNodes(stage, root) {
  const one = (selector) => stage.querySelector(selector);
  return {
    stage,
    root,
    dawn: one('[data-dawn]'),
    nebula: one('[data-nebula]'),
    planets: one('[data-planets]'),
    constellation: one('[data-constellation]'),
    segments: [...stage.querySelectorAll('[data-segment]')],
    crossbar: one('[data-crossbar]'),
    counter: one('[data-counter]'),
    todayLabel: one('[data-today-label]'),
    labels: one('[data-constellation-labels]'),
    flash: one('[data-flash]'),
    earth: one('[data-earth]'),
    earthLand: one('[data-earth-land]'),
    earthClouds: one('[data-earth-clouds]'),
    telescope: one('[data-telescope]'),
    telescopeZoom: one('[data-telescope-zoom]'),
    rig: one('[data-telescope-rig]'),
    notes: one('[data-telescope-notes]'),
    eyepieceGlow: one('[data-eyepiece-glow]'),
    iris: one('[data-iris]'),
    eyepiece: one('[data-eyepiece]'),
    lens: one('[data-eyepiece-lens]'),
    reticle: one('[data-eyepiece-reticle]'),
    candle: one('[data-eyepiece-candle]'),
    focus: one('[data-eyepiece-focus]'),
    focusValue: one('[data-focus-value]'),
    catalog: one('[data-eyepiece-catalog]'),
    distance: one('[data-distance]'),
    opening: one('[data-opening]'),
    captions: [...stage.querySelectorAll('[data-caption]')].map((node) => ({ node, index: SCENE_IDS.indexOf(node.dataset.caption) })),
    together: one('[data-together]'),
    finale: one('[data-finale]'),
    progressFill: one('[data-progress-fill]'),
    cache: {},
  };
}

/** Escribe solo si el valor cambió: evita trabajo de estilo innecesario. */
function write(nodes, key, node, prop, value) {
  if (!node) return;
  const id = `${key}.${prop}`;
  if (nodes.cache[id] === value) return;
  nodes.cache[id] = value;
  if (prop.startsWith('--')) node.style.setProperty(prop, value);
  else node.style[prop] = value;
}

const n3 = (value) => Math.round(value * 1000) / 1000;
const px = (value) => `${Math.round(value * 10) / 10}px`;

/** Entrada/salida de un texto: solo opacidad y desplazamiento (propiedades aceleradas). */
function fadeText(nodes, key, node, fade) {
  write(nodes, key, node, 'opacity', n3(fade));
  write(nodes, key, node, 'transform', `translate3d(0, ${n3((1 - fade) * 14)}px, 0)`);
  write(nodes, key, node, 'pointerEvents', fade > 0.5 ? 'auto' : 'none');
}

export function applyFrame(nodes, frame, { layout, raw, progress, reduced, totalDays }) {
  const { area } = layout;

  // ---- Encaje de las capas que se componen dentro de la zona visual ----
  const areaKey = `${area.x},${area.y},${area.width},${area.height}`;
  if (nodes.cache.area !== areaKey) {
    nodes.cache.area = areaKey;
    for (const node of [nodes.constellation, nodes.rig]) {
      if (!node) continue;
      Object.assign(node.style, { left: px(area.x), top: px(area.y), width: px(area.width), height: px(area.height) });
    }
    nodes.eyepiece?.style.setProperty('--candle-em', px(frame.iris.targetRadius / 14.5));
    // La ficha del objeto va donde quepa: a la izquierda del círculo, encima o, si no hay sitio, dentro de la lente.
    const r = frame.iris.targetRadius;
    const spaceLeft = frame.center.x - r;
    const spaceAbove = frame.center.y - r - area.y;
    const placement = spaceLeft >= 190 ? 'outside' : spaceAbove >= 34 ? 'above' : 'inside';
    if (nodes.catalog) nodes.catalog.dataset.place = placement;
  }

  // ---- Cielo ----
  write(nodes, 'dawn', nodes.dawn, 'opacity', n3(frame.sky.dawn));
  write(nodes, 'nebula', nodes.nebula, 'opacity', n3(frame.nebula.opacity));
  write(nodes, 'nebula', nodes.nebula, 'transform', `translate3d(0, ${n3(frame.nebula.shift)}px, 0) scale(${n3(frame.nebula.scale)})`);
  write(nodes, 'planets', nodes.planets, 'opacity', n3(frame.planets.opacity));
  write(nodes, 'planets', nodes.planets, 'transform', `translate3d(0, ${n3(frame.planets.shift)}px, 0)`);

  // ---- Constelación: trazo progresivo + contador de días en la punta de la línea ----
  const c = frame.constellation;
  write(nodes, 'constellation', nodes.constellation, 'opacity', n3(c.opacity));
  write(nodes, 'constellation', nodes.constellation, 'transform', `scale(${n3(c.scale)})`);
  write(nodes, 'constellation', nodes.constellation, '--complete', n3(c.complete));
  nodes.segments.forEach((line, i) => write(nodes, `segment${i}`, line, 'strokeDashoffset', n3(1 - c.segments[i])));
  write(nodes, 'crossbar', nodes.crossbar, 'strokeDashoffset', n3(1 - c.crossbar));
  write(nodes, 'labels', nodes.labels, 'opacity', n3(c.labels));
  write(nodes, 'todayLabel', nodes.todayLabel, 'opacity', c.segments[c.segments.length - 1] >= 1 ? 1 : 0);
  if (nodes.counter && totalDays !== null) {
    const drawing = c.timeline > 0.001 && c.timeline < 0.999;
    write(nodes, 'counter', nodes.counter, 'opacity', drawing ? 1 : 0);
    if (drawing) {
      const [x, y] = constellationTip(c.timeline);
      const days = Math.round(totalDays * c.timeline);
      const label = `${days.toLocaleString('es')} ${days === 1 ? 'día' : 'días'}`;
      if (nodes.cache.counterText !== label) {
        nodes.cache.counterText = label;
        nodes.counter.textContent = label;
      }
      const position = `${Math.round(x)},${Math.round(y - 30)}`;
      if (nodes.cache.counterPosition !== position) {
        nodes.cache.counterPosition = position;
        nodes.counter.setAttribute('x', Math.round(x));
        nodes.counter.setAttribute('y', Math.round(y - 30));
      }
    }
  }

  write(nodes, 'flash', nodes.flash, 'opacity', n3(frame.flash));

  // ---- La Tierra: caja base de 200 px (radio 96) llevada a su posición y tamaño ----
  const earth = frame.earth;
  write(nodes, 'earth', nodes.earth, 'opacity', n3(earth.opacity));
  if (earth.opacity > 0.001) {
    write(nodes, 'earth', nodes.earth, 'transform', `translate3d(${n3(earth.x - 100)}px, ${n3(earth.y - 100)}px, 0) scale(${n3(earth.radius / 96)})`);
    // Arranca mostrando África (≈15° E) y gira hasta las Américas (≈75° O): los continentes van a la derecha.
    const shift = (spin) => n3((((276 + spin * EARTH_STRIP) % EARTH_STRIP) + EARTH_STRIP) % EARTH_STRIP);
    // Inclinación: el mapa sube hasta que la latitud ≈ 5° N queda en el borde superior del disco.
    const tilt = n3(earth.tilt * -88);
    write(nodes, 'earthLand', nodes.earthLand, 'transform', `translate(${shift(earth.spin)}px, ${tilt}px)`);
    write(nodes, 'earthClouds', nodes.earthClouds, 'transform', `translate(${shift(earth.spin * 1.35 + 0.1)}px, ${tilt}px)`);
    write(nodes, 'earth', nodes.earth, '--ice', n3(1 - Math.min(1, earth.tilt * 3)));
  }

  // ---- Telescopio: entra desde el horizonte y la cámara viaja hasta el ocular ----
  const tel = frame.telescope;
  write(nodes, 'telescope', nodes.telescope, 'opacity', n3(tel.opacity));
  write(nodes, 'telescope', nodes.telescope, 'transform', `translate3d(0, ${n3((1 - tel.rise) * 32)}%, 0)`);
  write(nodes, 'notes', nodes.notes, 'opacity', n3(tel.notes));
  write(nodes, 'eyepieceGlow', nodes.eyepieceGlow, 'opacity', n3(tel.eyepieceGlow));

  const [ex, ey] = projectToArea(EYEPIECE, area);
  const z = reduced ? 0 : tel.zoom;
  write(nodes, 'zoom', nodes.telescopeZoom, 'transformOrigin', `${n3(ex)}px ${n3(ey)}px`);
  write(nodes, 'zoom', nodes.telescopeZoom, 'transform', `translate3d(${n3((frame.iris.x - ex) * z)}px, ${n3((frame.iris.y - ey) * z)}px, 0) scale(${n3(1 + z * 11)})`);

  // ---- Iris y ocular: comparten centro (el de la zona visual) y radio ----
  for (const [key, node] of [['iris', nodes.iris], ['eyepiece', nodes.eyepiece]]) {
    write(nodes, key, node, '--iris-x', px(frame.iris.x));
    write(nodes, key, node, '--iris-y', px(frame.iris.y));
    write(nodes, key, node, '--iris-r', px(frame.iris.radius));
  }
  write(nodes, 'iris', nodes.iris, 'opacity', frame.iris.active ? 1 : 0);
  if (nodes.cache.dark !== frame.dark) {
    nodes.cache.dark = frame.dark;
    nodes.root.toggleAttribute('data-dark', frame.dark);
  }

  const eye = frame.eyepiece;
  write(nodes, 'eyepiece', nodes.eyepiece, 'opacity', n3(eye.opacity));
  write(nodes, 'lens', nodes.lens, 'opacity', n3(eye.lens));
  write(nodes, 'reticle', nodes.reticle, 'opacity', n3(eye.reticle));
  write(nodes, 'catalog', nodes.catalog, 'opacity', n3(eye.catalog));
  write(nodes, 'focus', nodes.focus, 'opacity', n3(eye.reticle * (1 - frame.candle.letter)));
  const focusLabel = String(Math.round(eye.focus * 100));
  if (nodes.focusValue && nodes.cache.focusLabel !== focusLabel) {
    nodes.cache.focusLabel = focusLabel;
    nodes.focusValue.textContent = focusLabel;
  }
  write(nodes, 'candle', nodes.candle, 'filter', eye.blur > 0.2 ? `blur(${n3(eye.blur)}px)` : 'none');
  write(nodes, 'candle', nodes.candle, 'transform', `scale(${n3(frame.candle.scale)})`);
  write(nodes, 'candle', nodes.candle, '--letter-glow', n3(frame.candle.letter));
  write(nodes, 'candle', nodes.candle, '--warmth', n3(frame.candle.glow));

  // ---- Textos: cada uno con entrada, permanencia y salida guiadas por el scroll ----
  fadeText(nodes, 'opening', nodes.opening, captionFade('opening', raw[0]));
  for (const { node, index } of nodes.captions) fadeText(nodes, `caption${index}`, node, captionFade(SCENE_IDS[index], raw[index]));

  const reveals = revealsFor(raw);
  fadeText(nodes, 'together', nodes.together, reveals.together);
  fadeText(nodes, 'finale', nodes.finale, reveals.finale);
  const finaleReady = reveals.finale > 0.5;
  if (nodes.finale && nodes.cache.finaleReady !== finaleReady) {
    nodes.cache.finaleReady = finaleReady;
    nodes.finale.inert = !finaleReady;
  }

  // ---- Progreso y distancia ----
  write(nodes, 'progress', nodes.progressFill, 'transform', `scaleX(${n3(progress)})`);
  if (nodes.distance) {
    const text = formatDistance(distanceRemaining(frame.journey));
    if (nodes.cache.distance !== text) {
      nodes.cache.distance = text;
      nodes.distance.textContent = text;
    }
  }
}
