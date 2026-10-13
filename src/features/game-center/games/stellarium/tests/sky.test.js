import { describe, expect, it } from 'vitest';
import { CONSTELLATIONS, DEEP_SKY, STARS, starById } from '../data/catalog.js';
import { ASTERISM } from '../data/asterism.js';
import {
  DISCOVERABLE_TOTAL,
  FOV_MAX,
  FOV_MIN,
  FRAMES,
  SELECTABLE,
  angularDistance,
  basis,
  createView,
  galacticToVec,
  isIdentified,
  lerpView,
  moonPhase,
  pan,
  pickAt,
  project,
  scaleFor,
  sunOnDate,
  sunPosition,
  vecOf,
  zoom,
} from '../engine/sky.js';

const W = 800;
const H = 600;
const screenOf = (view, ra, dec) => project(basis(view), scaleFor(view, W, H), W, H, vecOf(ra, dec));

describe('catálogo', () => {
  it('ids únicos, coordenadas válidas y figuras que solo usan estrellas del catálogo', () => {
    expect(new Set(STARS.map((s) => s.id)).size).toBe(STARS.length);
    for (const s of STARS) {
      expect(s.ra).toBeGreaterThanOrEqual(0);
      expect(s.ra).toBeLessThan(24);
      expect(Math.abs(s.dec)).toBeLessThanOrEqual(90);
    }
    for (const con of CONSTELLATIONS) for (const [a, b] of con.lines) expect(starById.has(a) && starById.has(b)).toBe(true);
    expect(DISCOVERABLE_TOTAL).toBe(CONSTELLATIONS.length + DEEP_SKY.length + 1);
  });

  it('datos de referencia conocidos', () => {
    // Sirio es la más brillante; el cinturón de Orión mide unos 2,7°.
    expect(STARS.reduce((a, b) => (a.mag < b.mag ? a : b)).id).toBe('sirio');
    const mintaka = starById.get('mintaka');
    const alnitak = starById.get('alnitak');
    expect(angularDistance(mintaka.ra, mintaka.dec, alnitak.ra, alnitak.dec)).toBeCloseTo(2.7, 0);
    // Dubhe y Merak apuntan a la Polar.
    const polaris = starById.get('polaris');
    expect(angularDistance(polaris.ra, polaris.dec, 0, 90)).toBeLessThan(1);
  });

  it('el asterismo personal está fuera de catálogo y lejos de las estrellas brillantes', () => {
    for (const s of Object.values(ASTERISM.stars)) {
      const nearest = Math.min(...STARS.map((st) => angularDistance(s.ra, s.dec, st.ra, st.dec)));
      expect(nearest).toBeGreaterThan(4);
    }
    expect(ASTERISM.lines).toHaveLength(5);
  });
});

describe('cámara y proyección', () => {
  it('el centro de la vista cae en el centro de la pantalla; el norte arriba y el este a la izquierda', () => {
    const view = createView({ ra: 6, dec: 0, fov: 60 });
    const c = screenOf(view, 6, 0);
    expect(c.x).toBeCloseTo(W / 2);
    expect(c.y).toBeCloseTo(H / 2);
    expect(screenOf(view, 6, 10).y).toBeLessThan(H / 2);
    expect(screenOf(view, 6.5, 0).x).toBeLessThan(W / 2);
  });

  it('lo que está detrás no se dibuja', () => {
    expect(screenOf(createView({ ra: 6, dec: 0 }), 18, 0)).toBeNull();
  });

  it('arrastrar mueve el cielo con el dedo y el aumento tiene límites', () => {
    const view = createView({ ra: 6, dec: 0, fov: 60 });
    const right = pan(view, 100, 0, W, H);
    expect(right.ra).toBeGreaterThan(6); // el contenido va a la derecha: se ve lo que había al este
    const down = pan(view, 0, 100, W, H);
    expect(down.dec).toBeGreaterThan(0);
    expect(pan(createView({ dec: 89 }), 0, 9999, W, H).dec).toBeLessThanOrEqual(89.5);
    expect(zoom(view, 0.0001).fov).toBe(FOV_MIN);
    expect(zoom(view, 1000).fov).toBe(FOV_MAX);
  });

  it('el vuelo va por el camino corto en ascensión recta', () => {
    const mid = lerpView({ ra: 23, dec: 0, fov: 60 }, { ra: 1, dec: 0, fov: 60 }, 0.5);
    expect(mid.ra === 0 || mid.ra > 23.9 || mid.ra < 0.1).toBe(true);
  });
});

describe('selección y descubrimiento', () => {
  it('tocar cerca de una estrella la selecciona; tocar el vacío, nada', () => {
    const view = createView({ ra: 6.752, dec: -16.72, fov: 40 });
    expect(pickAt(view, W, H, W / 2 + 3, H / 2 - 2, SELECTABLE)?.id).toBe('sirio');
    expect(pickAt(createView({ ra: 3.45, dec: -19, fov: 30 }), W, H, W / 2, H / 2, SELECTABLE)).toBeNull();
  });

  it('una constelación se identifica centrada y entera, no de lejos ni cortada', () => {
    const f = FRAMES.get('ori');
    expect(isIdentified(createView({ ra: f.ra, dec: f.dec, fov: 50 }), f)).toBe(true);
    expect(isIdentified(createView({ ra: f.ra, dec: f.dec, fov: 120 }), f)).toBe(false); // todo el cielo a la vez
    expect(isIdentified(createView({ ra: f.ra, dec: f.dec, fov: 10 }), f)).toBe(false); // no cabe
    expect(isIdentified(createView({ ra: f.ra + 1.5, dec: f.dec, fov: 50 }), f)).toBe(false); // descentrada
  });

  it('cada constelación (y el asterismo) se puede identificar con algún aumento', () => {
    for (const con of CONSTELLATIONS) {
      const f = FRAMES.get(con.id);
      const ok = [20, 30, 40, 50, 60, 75, 90].some((fov) => isIdentified(createView({ ra: f.ra, dec: f.dec, fov }), f));
      expect(ok, con.name).toBe(true);
    }
    const a = { ...ASTERISM.center, radius: ASTERISM.radius };
    expect(isIdentified(createView({ ...ASTERISM.center, fov: 25 }), a)).toBe(true);
  });
});

describe('Sol, Luna y Vía Láctea', () => {
  it('posición del Sol en equinoccio y solsticio de 2025', () => {
    expect(sunPosition(new Date('2025-03-20T09:01:00Z')).lambda).toBeCloseTo(0, 0);
    const solstice = sunPosition(new Date('2025-06-21T02:42:00Z'));
    expect(solstice.lambda).toBeCloseTo(90, 0);
    expect(solstice.dec).toBeCloseTo(23.44, 1);
  });

  it('el 21 de julio de 2025 el Sol estaba frente a Cáncer, junto al límite con Géminis', () => {
    const sun = sunOnDate(new Date(2025, 6, 21, 12));
    expect(sun.constellation).toEqual({ name: 'Cáncer', borderWith: 'Géminis' });
  });

  it('fases de la Luna de 2025 (luna nueva del 24 de julio y llena del 9 de agosto)', () => {
    expect(moonPhase(new Date('2025-07-24T19:11:00Z')).illumination).toBeLessThan(0.01);
    expect(moonPhase(new Date('2025-08-09T07:55:00Z')).illumination).toBeGreaterThan(0.99);
    const day = moonPhase(new Date('2025-07-21T17:00:00Z'));
    expect(day.name).toBe('Luna menguante');
    expect(day.waxing).toBe(false);
  });

  it('el plano galáctico pasa por Sagitario (centro) y por el Cisne', () => {
    const center = galacticToVec(0, 0);
    const ra = ((Math.atan2(center[1], center[0]) * 180) / Math.PI / 15 + 24) % 24;
    const dec = (Math.asin(center[2]) * 180) / Math.PI;
    expect(ra).toBeCloseTo(17.76, 1);
    expect(dec).toBeCloseTo(-28.94, 0);
  });
});
