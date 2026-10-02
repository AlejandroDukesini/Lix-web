import { describe, expect, it } from 'vitest';
import {
  activeSceneIndex,
  captionFade,
  computeFrame,
  constellationProgress,
  constellationTip,
  CONSTELLATION,
  distanceRemaining,
  formatDistance,
  revealsFor,
  SCENE_IDS,
  SCENES,
  sceneProgress,
  snapForReducedMotion,
} from './timeline.js';

const VH = 800;
const sections = (() => {
  let top = 0;
  return SCENES.map((scene) => {
    const section = { top, height: scene.length * VH };
    top += section.height;
    return section;
  });
})();
const total = sections.at(-1).top + sections.at(-1).height;
const maxScroll = total - VH;
const progressAt = (y) => sceneProgress(y, sections, maxScroll);
const tAt = (overrides) => Object.fromEntries(SCENE_IDS.map((id) => [id, overrides[id] ?? 0]));
const portrait = { width: 375, height: 812 };
const desktop = { width: 1440, height: 900 };

describe('progreso por escena', () => {
  it('cada escena recorre de 0 a 1 y la última llega a 1 al final del scroll', () => {
    expect(progressAt(0).every((t) => t === 0)).toBe(true);
    const atStarsMiddle = progressAt(sections[1].top + sections[1].height / 2);
    expect(atStarsMiddle[0]).toBe(1);
    expect(atStarsMiddle[1]).toBeCloseTo(0.5);
    expect(atStarsMiddle[2]).toBe(0);
    expect(progressAt(maxScroll).at(-1)).toBe(1);
  });

  it('la escena activa es la que contiene el borde superior de la pantalla (también al retroceder)', () => {
    expect(activeSceneIndex(0, sections)).toBe(0);
    expect(activeSceneIndex(sections[3].top + 10, sections)).toBe(3);
    expect(activeSceneIndex(sections[2].top + 10, sections)).toBe(2);
    expect(activeSceneIndex(maxScroll, sections)).toBe(SCENES.length - 1);
  });

  it('con movimiento reducido cada escena salta a su composición clave', () => {
    const galaxy = SCENE_IDS.indexOf('galaxy');
    const snapped = snapForReducedMotion(progressAt(sections[galaxy].top + 5), galaxy);
    expect(snapped.slice(0, galaxy).every((t) => t === 1)).toBe(true);
    expect(snapped[galaxy]).toBe(0.55);
    expect(snapped.slice(galaxy + 1).every((t) => t === 0)).toBe(true);
  });
});

describe('textos de capítulo', () => {
  it('aparecen y desaparecen dentro de su ventana', () => {
    expect(captionFade('stars', 0)).toBe(0);
    expect(captionFade('stars', 0.5)).toBe(1);
    expect(captionFade('stars', 1)).toBe(0);
    expect(captionFade('opening', 0)).toBe(1);
  });

  it('«Otro año juntos» llega tras una pausa y deja paso al final', () => {
    const raw = (candle, final) => SCENE_IDS.map((id) => (id === 'candle' ? candle : id === 'final' ? final : 1));
    expect(revealsFor(raw(0.4, 0)).together).toBe(false);
    expect(revealsFor(raw(0.7, 0)).together).toBe(true);
    expect(revealsFor(raw(1, 0.5))).toEqual({ together: false, finale: true });
  });
});

describe('constelación', () => {
  it('dibuja la línea del tiempo segmento a segmento y cierra la «A» al final', () => {
    expect(constellationProgress(0).segments.every((s) => s === 0)).toBe(true);
    const middle = constellationProgress(0.42);
    expect(middle.segments[0]).toBe(1);
    expect(middle.segments.at(-1)).toBe(0);
    expect(middle.crossbar).toBe(0);
    const done = constellationProgress(1);
    expect(done.segments.every((s) => s === 1)).toBe(true);
    expect(done.crossbar).toBe(1);
  });

  it('la punta del trazo empieza en el comienzo y termina en hoy', () => {
    expect(constellationTip(0)).toEqual(CONSTELLATION.stars.start);
    expect(constellationTip(1)).toEqual(CONSTELLATION.stars.today);
  });
});

describe('distancia al destino', () => {
  it('desciende desde 13.800 millones de años luz hasta la llegada', () => {
    const values = [0, 0.25, 0.5, 0.75, 0.95].map((j) => {
      const { value, unit } = distanceRemaining(j);
      return unit === 'km' ? value / 9.46e12 : value;
    });
    for (let i = 1; i < values.length; i += 1) expect(values[i]).toBeLessThan(values[i - 1]);
    expect(formatDistance(distanceRemaining(0))).toMatch(/13\.800\.000\.000 años luz/);
    expect(formatDistance(distanceRemaining(1))).toBe('Has llegado');
  });
});

describe('fotograma', () => {
  it('el telescopio aparece en el capítulo IV y desaparece al entrar en el ocular', () => {
    expect(computeFrame(tAt({ stars: 1, constellation: 1, galaxy: 1, telescope: 0.8 }), desktop).telescope.opacity).toBe(1);
    const inside = computeFrame(tAt({ stars: 1, constellation: 1, galaxy: 1, telescope: 1, eyepiece: 1 }), desktop);
    expect(inside.telescope.opacity).toBe(0);
    expect(inside.eyepiece.opacity).toBe(1);
  });

  it('el iris se cierra hacia el ocular y vuelve a abrirse en el final', () => {
    const before = computeFrame(tAt({ telescope: 1 }), portrait).iris.radius;
    const closed = computeFrame(tAt({ telescope: 1, eyepiece: 1 }), portrait).iris.radius;
    const reopened = computeFrame(tAt({ telescope: 1, eyepiece: 1, candle: 1, final: 1 }), portrait).iris.radius;
    expect(closed).toBeLessThan(before);
    expect(closed).toBeCloseTo(375 * 0.4);
    expect(reopened).toBeGreaterThan(closed);
  });

  it('la vela se enfoca al llegar y la letra se ilumina', () => {
    const blurry = computeFrame(tAt({ eyepiece: 0.7 }), desktop);
    const sharp = computeFrame(tAt({ eyepiece: 1, candle: 0.6 }), desktop);
    expect(blurry.eyepiece.blur).toBeGreaterThan(sharp.eyepiece.blur);
    expect(sharp.eyepiece.blur).toBe(0);
    expect(sharp.candle.letter).toBe(1);
  });

  it('la «A» de la constelación reaparece como eco alrededor del ocular', () => {
    const echo = computeFrame(tAt({ stars: 1, constellation: 1, galaxy: 1, telescope: 1, eyepiece: 1, candle: 0.8 }), portrait);
    expect(echo.constellation.opacity).toBeGreaterThan(0.3);
    expect(echo.constellation.scale).toBeGreaterThan(2);
    expect(echo.constellation.labels).toBe(0);
  });
});
