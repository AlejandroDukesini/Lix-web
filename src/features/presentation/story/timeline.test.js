import { describe, expect, it } from 'vitest';
import {
  activeSceneIndex,
  CAPTION_WINDOWS,
  captionFade,
  computeFrame,
  constellationProgress,
  constellationTip,
  CONSTELLATION,
  distanceRemaining,
  formatDistance,
  progressFromScroll,
  revealsFor,
  SCENE_BOUNDS,
  SCENE_IDS,
  SCENES,
  sceneProgress,
  scrollForScene,
  snapForReducedMotion,
  STORY_LENGTH,
} from './timeline.js';

// Contenedor alto con escenario sticky: (STORY_LENGTH + 1) pantallas de alto.
const VH = 800;
const TRACK_TOP = 0;
const TRACK_HEIGHT = (STORY_LENGTH + 1) * VH;
const progressAt = (y) => progressFromScroll(y, TRACK_TOP, TRACK_HEIGHT, VH);
const scrollFor = (id, pose) => scrollForScene(SCENE_IDS.indexOf(id), pose, TRACK_TOP, TRACK_HEIGHT, VH);
const tAt = (overrides) => Object.fromEntries(SCENE_IDS.map((id) => [id, overrides[id] ?? 0]));

// Zona visual (celda libre de texto) medida por el layout: escritorio con texto a la izquierda, móvil con texto debajo.
const desktop = { stage: { width: 1440, height: 900 }, area: { x: 640, y: 96, width: 760, height: 690 }, portrait: false };
const portrait = { stage: { width: 375, height: 812 }, area: { x: 16, y: 72, width: 343, height: 420 }, portrait: true };

describe('progreso del viaje', () => {
  it('el progreso global va de 0 a 1 mientras el escenario permanece fijo', () => {
    expect(progressAt(-200)).toBe(0);
    expect(progressAt(0)).toBe(0);
    expect(progressAt(TRACK_HEIGHT - VH)).toBe(1);
    expect(progressAt(TRACK_HEIGHT + 500)).toBe(1);
  });

  it('los tramos de capítulos cubren todo el recorrido sin huecos', () => {
    expect(SCENE_BOUNDS[0][0]).toBe(0);
    expect(SCENE_BOUNDS.at(-1)[1]).toBeCloseTo(1);
    for (let i = 1; i < SCENE_BOUNDS.length; i += 1) expect(SCENE_BOUNDS[i][0]).toBeCloseTo(SCENE_BOUNDS[i - 1][1]);
  });

  it('cada capítulo recorre de 0 a 1 y el último llega a 1 al final del scroll', () => {
    expect(sceneProgress(0).every((t) => t === 0)).toBe(true);
    const atStarsMiddle = sceneProgress(progressAt(scrollFor('galaxy', 0.5)));
    expect(atStarsMiddle[0]).toBe(1);
    expect(atStarsMiddle[1]).toBeCloseTo(0.5);
    expect(atStarsMiddle[2]).toBe(0);
    expect(sceneProgress(1).at(-1)).toBe(1);
  });

  it('scrollForScene y progressFromScroll son inversos (los puntos del índice llevan al capítulo)', () => {
    SCENE_IDS.forEach((id, index) => {
      const progress = progressAt(scrollFor(id, 0.5));
      expect(activeSceneIndex(progress)).toBe(index);
      expect(sceneProgress(progress)[index]).toBeCloseTo(0.5);
    });
  });

  it('el capítulo activo depende solo de la posición (también al retroceder o con saltos bruscos)', () => {
    expect(activeSceneIndex(0)).toBe(0);
    expect(activeSceneIndex(progressAt(scrollFor('telescope', 0.1)))).toBe(SCENE_IDS.indexOf('telescope'));
    expect(activeSceneIndex(progressAt(scrollFor('constellation', 0.1)))).toBe(SCENE_IDS.indexOf('constellation'));
    expect(activeSceneIndex(1)).toBe(SCENES.length - 1);
    // Un salto directo deja los capítulos anteriores completos y los siguientes sin empezar.
    const jump = sceneProgress(progressAt(scrollFor('eyepiece', 0.6)));
    const eyepiece = SCENE_IDS.indexOf('eyepiece');
    expect(jump.slice(0, eyepiece).every((t) => t === 1)).toBe(true);
    expect(jump.slice(eyepiece + 1).every((t) => t === 0)).toBe(true);
  });

  it('con movimiento reducido cada escena salta a su composición clave', () => {
    const galaxy = SCENE_IDS.indexOf('earth');
    const snapped = snapForReducedMotion(sceneProgress(progressAt(scrollFor('earth', 0.05))), galaxy);
    expect(snapped.slice(0, galaxy).every((t) => t === 1)).toBe(true);
    expect(snapped[galaxy]).toBe(SCENES[galaxy].keyPose);
    expect(snapped.slice(galaxy + 1).every((t) => t === 0)).toBe(true);
  });
});

describe('textos de capítulo', () => {
  it('aparecen y desaparecen dentro de su ventana', () => {
    expect(captionFade('galaxy', 0)).toBe(0);
    expect(captionFade('galaxy', 0.5)).toBe(1);
    expect(captionFade('galaxy', 1)).toBe(0);
    expect(captionFade('opening', 0)).toBe(1);
  });

  it('cada texto permanece legible la mayor parte de su capítulo', () => {
    for (const [id, [enter, leave]] of Object.entries(CAPTION_WINDOWS)) {
      if (id === 'opening') continue;
      expect(leave - enter, id).toBeGreaterThan(0.45);
    }
  });

  it('nunca compiten dos textos a la vez en ningún punto del recorrido', () => {
    const captionIds = Object.keys(CAPTION_WINDOWS);
    for (let p = 0; p <= 1; p += 0.0005) {
      const raw = sceneProgress(p);
      const captions = captionIds.filter((id) => captionFade(id, raw[SCENE_IDS.indexOf(id)]) > 0);
      expect(captions.length, `P=${p.toFixed(4)}: ${captions.join(', ')}`).toBeLessThanOrEqual(1);
      // «Otro año juntos» y el final solo se funden entre sí, nunca con un capítulo.
      const { together, finale } = revealsFor(raw);
      const visible = [...captions, together > 0.5 && 'together', finale > 0.5 && 'finale'].filter(Boolean);
      expect(visible.length, `P=${p.toFixed(4)}: ${visible.join(', ')}`).toBeLessThanOrEqual(1);
    }
  });

  it('«Otro año juntos» llega tras el texto de la vela y deja paso al final', () => {
    const raw = (candle, final) => SCENE_IDS.map((id) => (id === 'candle' ? candle : id === 'final' ? final : 1));
    expect(revealsFor(raw(0.4, 0)).together).toBe(0);
    expect(revealsFor(raw(0.75, 0)).together).toBe(1);
    expect(revealsFor(raw(1, 0.5))).toEqual({ together: 0, finale: 1 });
  });

  it('el mensaje final queda estable hasta el final del recorrido', () => {
    expect(revealsFor(sceneProgress(1)).finale).toBe(1);
  });
});

describe('constelación', () => {
  it('dibuja la línea del tiempo segmento a segmento y cierra la «A» al final', () => {
    expect(constellationProgress(0).segments.every((s) => s === 0)).toBe(true);
    const middle = constellationProgress(0.24);
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
  it('la composición se centra en la zona visual libre de texto', () => {
    for (const layout of [desktop, portrait]) {
      const { center, iris } = computeFrame(tAt({ eyepiece: 1 }), layout);
      const { area } = layout;
      expect(center.x).toBeCloseTo(area.x + area.width / 2);
      expect(center.y).toBeCloseTo(area.y + area.height / 2);
      // El círculo del ocular cabe entero en la zona visual: no tapa los textos.
      expect(iris.targetRadius * 2).toBeLessThanOrEqual(Math.min(area.width, area.height));
    }
  });

  it('I: los puntos dispersos se reúnen en una galaxia espiral en el centro de la zona visual', () => {
    const scattered = computeFrame(tAt({}), desktop).galaxy;
    const formed = computeFrame(tAt({ galaxy: 0.7 }), desktop).galaxy;
    expect(scattered.form).toBe(0);
    expect(formed.form).toBe(1);
    expect(formed.opacity).toBe(1);
    expect(formed.x).toBeCloseTo(desktop.area.x + desktop.area.width / 2);
    expect(formed.radius).toBeGreaterThan(Math.min(desktop.area.width, desktop.area.height) * 0.4);
    // Con las constelaciones se aleja y empequeñece para dejarles el protagonismo.
    const away = computeFrame(tAt({ galaxy: 1, constellation: 0.5 }), desktop).galaxy;
    expect(away.radius).toBeLessThan(formed.radius / 3);
  });

  it('III: la Tierra se acerca, gira, queda centrada y la cámara desciende hasta su horizonte', () => {
    const before = computeFrame(tAt({ galaxy: 1, constellation: 1 }), portrait).earth;
    const far = computeFrame(tAt({ galaxy: 1, constellation: 1, earth: 0.1 }), portrait).earth;
    const held = computeFrame(tAt({ galaxy: 1, constellation: 1, earth: 0.65 }), portrait).earth;
    const landed = computeFrame(tAt({ galaxy: 1, constellation: 1, earth: 1 }), portrait).earth;
    expect(before.opacity).toBe(0);
    expect(far.radius).toBeLessThan(held.radius / 3);
    expect(held.opacity).toBe(1);
    expect(held.x).toBeCloseTo(portrait.area.x + portrait.area.width / 2);
    // Toda la Tierra cabe en la zona visual mientras se lee el capítulo.
    expect(held.radius * 2).toBeLessThanOrEqual(Math.min(portrait.area.width, portrait.area.height));
    expect(held.spin).toBeGreaterThan(far.spin);
    // Al aterrizar su borde superior queda como horizonte en la parte baja del escenario.
    expect(landed.y - landed.radius).toBeCloseTo(portrait.stage.height * 0.74);
    // Y se funde con el planeta del telescopio.
    expect(computeFrame(tAt({ galaxy: 1, constellation: 1, earth: 1, telescope: 0.6 }), portrait).earth.opacity).toBe(0);
  });

  it('el telescopio aparece en el capítulo IV y desaparece al entrar en el ocular', () => {
    expect(computeFrame(tAt({ galaxy: 1, constellation: 1, earth: 1, telescope: 0.8 }), desktop).telescope.opacity).toBe(1);
    const inside = computeFrame(tAt({ galaxy: 1, constellation: 1, earth: 1, telescope: 1, eyepiece: 1 }), desktop);
    expect(inside.telescope.opacity).toBe(0);
    expect(inside.eyepiece.opacity).toBe(1);
  });

  it('el telescopio queda estable antes del acercamiento al ocular', () => {
    const settled = computeFrame(tAt({ telescope: 0.5 }), desktop).telescope;
    const later = computeFrame(tAt({ telescope: 1 }), desktop).telescope;
    expect(settled.rise).toBe(1);
    expect(later.rise).toBe(1);
    expect(later.zoom).toBe(0);
  });

  it('el iris se cierra hacia el ocular y vuelve a abrirse en el final', () => {
    const before = computeFrame(tAt({ telescope: 1 }), portrait).iris.radius;
    const closed = computeFrame(tAt({ telescope: 1, eyepiece: 1 }), portrait);
    const reopened = computeFrame(tAt({ telescope: 1, eyepiece: 1, candle: 1, final: 1 }), portrait).iris.radius;
    expect(closed.iris.radius).toBeLessThan(before);
    expect(closed.iris.radius).toBeCloseTo(closed.iris.targetRadius);
    expect(reopened).toBeGreaterThan(closed.iris.radius);
  });

  it('la vela se enfoca al llegar y la letra se ilumina', () => {
    const blurry = computeFrame(tAt({ eyepiece: 0.7 }), desktop);
    const sharp = computeFrame(tAt({ eyepiece: 1, candle: 0.6 }), desktop);
    expect(blurry.eyepiece.blur).toBeGreaterThan(sharp.eyepiece.blur);
    expect(sharp.eyepiece.blur).toBe(0);
    expect(sharp.candle.letter).toBe(1);
  });

  it('en el final la vela sube al hueco libre sobre el mensaje y cabe en él', () => {
    const finalArea = { ...portrait.area, height: 180 };
    const layout = { ...portrait, finalArea };
    const all = { galaxy: 1, constellation: 1, earth: 1, telescope: 1, eyepiece: 1, candle: 1 };
    const before = computeFrame(tAt(all), layout);
    const after = computeFrame(tAt({ ...all, final: 1 }), layout);
    // Durante los capítulos la vela sigue centrada en la zona visual completa.
    expect(before.iris.y).toBeCloseTo(portrait.area.y + portrait.area.height / 2);
    expect(after.iris.y).toBeCloseTo(finalArea.y + finalArea.height / 2);
    expect(after.candle.scale * 1.45 * after.iris.targetRadius).toBeLessThanOrEqual(finalArea.height + 0.5);
    // La ficha del ocular se retira antes de que aparezca el mensaje final: nunca se pisan.
    for (let final = 0; final <= 1; final += 0.01) {
      const catalog = computeFrame(tAt({ ...all, final }), layout).eyepiece.catalog;
      const finale = revealsFor(SCENE_IDS.map((id) => (id === 'final' ? final : 1))).finale;
      expect(Math.min(catalog, finale), `final=${final.toFixed(2)}`).toBe(0);
    }
    // Sin restricción (escritorio) la vela solo se reduce ligeramente.
    expect(computeFrame(tAt({ ...all, final: 1 }), desktop).candle.scale).toBeCloseTo(0.88);
  });

  it('la «A» de la constelación reaparece como eco alrededor del ocular', () => {
    const echo = computeFrame(tAt({ galaxy: 1, constellation: 1, earth: 1, telescope: 1, eyepiece: 1, candle: 0.8 }), portrait);
    expect(echo.constellation.opacity).toBeGreaterThan(0.3);
    expect(echo.constellation.scale).toBeGreaterThan(2);
    expect(echo.constellation.labels).toBe(0);
  });
});
