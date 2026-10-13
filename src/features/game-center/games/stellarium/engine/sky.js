/**
 * Matemática del observatorio, sin DOM.
 *
 * El cielo es la esfera celeste vista desde dentro, con el norte celeste hacia
 * arriba (no depende del lugar ni de la hora: se explora entera). La cámara
 * mira a (ar, dec) con un campo de visión `fov` (grados) y se usa la proyección
 * estereográfica, la de los planetarios: conserva las formas de las
 * constelaciones incluso en los bordes.
 *
 * También calcula, para una fecha real, la posición del Sol (precisión de
 * centésimas de grado, fórmula del Astronomical Almanac) y la fase de la Luna.
 */
import { CONSTELLATIONS, DEEP_SKY, STARS, starById } from '../data/catalog.js';
import { createRng } from '../../../services/gameLifecycle.js';

export const DEG = Math.PI / 180;
export const FOV_MIN = 8;
export const FOV_MAX = 120;
export const EYEPIECE_FOV = 24; // por debajo, la vista es la del ocular del telescopio

export const vecOf = (raH, decDeg) => {
  const ra = raH * 15 * DEG;
  const dec = decDeg * DEG;
  return [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)];
};

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

export const wrapRa = (h) => ((h % 24) + 24) % 24;
export const clampDec = (d) => Math.max(-89.5, Math.min(89.5, d));

export function createView({ ra = 5.6, dec = 0, fov = 70 } = {}) {
  return { ra: wrapRa(ra), dec: clampDec(dec), fov: Math.max(FOV_MIN, Math.min(FOV_MAX, fov)) };
}

/** Base de la cámara: adelante, derecha (oeste, AR decreciente) y arriba (norte). */
export function basis(view) {
  const f = vecOf(view.ra, view.dec);
  const r = norm(cross(f, [0, 0, 1]));
  const u = cross(r, f);
  return { f, r, u };
}

/** Píxeles por unidad de proyección para que `fov` ocupe el lado menor del lienzo. */
export const scaleFor = (view, width, height) => Math.min(width, height) / 2 / (2 * Math.tan((view.fov * DEG) / 4));

/** Proyecta un vector a la pantalla. Devuelve null si queda detrás o muy fuera del campo. */
export function project(b, scale, width, height, v) {
  const z = dot(v, b.f);
  if (z <= -0.2) return null;
  const k = 2 / (1 + z);
  const x = width / 2 + dot(v, b.r) * k * scale;
  const y = height / 2 - dot(v, b.u) * k * scale;
  if (x < -80 || y < -80 || x > width + 80 || y > height + 80) return null;
  return { x, y, z };
}

/** Distancia angular en grados entre dos puntos (ar en horas, dec en grados). */
export function angularDistance(ra1, dec1, ra2, dec2) {
  return Math.acos(Math.max(-1, Math.min(1, dot(vecOf(ra1, dec1), vecOf(ra2, dec2))))) / DEG;
}

/** Arrastrar: el cielo sigue al dedo. dx, dy en píxeles. */
export function pan(view, dx, dy, width, height) {
  const degPerPx = view.fov / Math.min(width, height);
  const dec = clampDec(view.dec + dy * degPerPx);
  const cos = Math.max(0.15, Math.cos(view.dec * DEG));
  return { ...view, ra: wrapRa(view.ra + (dx * degPerPx) / 15 / cos), dec };
}

export function zoom(view, factor) {
  return { ...view, fov: Math.max(FOV_MIN, Math.min(FOV_MAX, view.fov * factor)) };
}

/** Interpolación de cámara (vuelo hacia un objeto) por el camino corto en AR. */
export function lerpView(a, b, t) {
  let dRa = b.ra - a.ra;
  if (dRa > 12) dRa -= 24;
  if (dRa < -12) dRa += 24;
  const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
  return { ra: wrapRa(a.ra + dRa * e), dec: a.dec + (b.dec - a.dec) * e, fov: a.fov + (b.fov - a.fov) * e };
}

/** Centro y tamaño angular de una constelación (para volar a ella y reconocerla). */
export function constellationFrame(con) {
  const ids = [...new Set(con.lines.flat())];
  const vs = ids.map((id) => vecOf(starById.get(id).ra, starById.get(id).dec));
  const c = norm(vs.reduce((acc, v) => [acc[0] + v[0], acc[1] + v[1], acc[2] + v[2]], [0, 0, 0]));
  const ra = wrapRa(Math.atan2(c[1], c[0]) / DEG / 15);
  const dec = Math.asin(c[2]) / DEG;
  const radius = Math.max(...ids.map((id) => angularDistance(ra, dec, starById.get(id).ra, starById.get(id).dec)));
  return { ra, dec, radius };
}

export const FRAMES = new Map(CONSTELLATIONS.map((c) => [c.id, constellationFrame(c)]));

/**
 * ¿Se reconoce la constelación con esta vista? Hay que tenerla centrada (su
 * centro cerca del centro de la vista) y entera dentro del campo, con un zoom
 * que permita distinguirla: ni todo el cielo a la vez ni solo una estrella.
 */
export function isIdentified(view, frame) {
  const d = angularDistance(view.ra, view.dec, frame.ra, frame.dec);
  return view.fov <= 90 && view.fov >= frame.radius * 1.2 && d <= Math.max(6, view.fov * 0.18) && frame.radius + d <= view.fov * 0.62;
}

/** Objeto seleccionable más cercano a un punto de la pantalla (dentro de `radius` px). */
export function pickAt(view, width, height, px, py, objects, radius = 26) {
  const b = basis(view);
  const scale = scaleFor(view, width, height);
  let best = null;
  for (const o of objects) {
    const p = project(b, scale, width, height, vecOf(o.ra, o.dec));
    if (!p) continue;
    // Las brillantes «atraen» un poco más el toque.
    const d = Math.hypot(p.x - px, p.y - py) - (o.mag !== undefined ? Math.max(0, 2.5 - o.mag) * 3 : 0);
    if (d < radius && (!best || d < best.d)) best = { o, d };
  }
  return best?.o ?? null;
}

// --------------------------------------------------------------- fondo procedural

/** Estrellas tenues de fondo (decorativas, no seleccionables), con semilla fija. */
export function backgroundStars(count = 900, seed = 2025) {
  const rng = createRng(seed);
  return Array.from({ length: count }, () => {
    const z = rng() * 2 - 1;
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(1 - z * z);
    return { v: [r * Math.cos(a), r * Math.sin(a), z], mag: 4 + rng() * 2.4, tw: rng() * 6 };
  });
}

/** Galácticas (l, b en grados) → ecuatoriales J2000 (vector). */
export function galacticToVec(l, b) {
  const raNgp = 192.85948 * DEG;
  const decNgp = 27.12825 * DEG;
  const lNcp = 122.93192 * DEG;
  const L = l * DEG;
  const B = b * DEG;
  const sinDec = Math.sin(decNgp) * Math.sin(B) + Math.cos(decNgp) * Math.cos(B) * Math.cos(lNcp - L);
  const dec = Math.asin(sinDec);
  const y = Math.cos(B) * Math.sin(lNcp - L);
  const x = Math.cos(decNgp) * Math.sin(B) - Math.sin(decNgp) * Math.cos(B) * Math.cos(lNcp - L);
  const ra = raNgp + Math.atan2(y, x);
  return [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)];
}

/** Vía Láctea: nube de puntos a lo largo del plano galáctico, más densa hacia el centro (Sagitario). */
export function milkyWay(count = 5000, seed = 7) {
  const rng = createRng(seed);
  const gauss = () => (rng() + rng() + rng() - 1.5) / 1.5;
  return Array.from({ length: count }, () => {
    const l = rng() * 360;
    const toCenter = Math.cos((l * DEG) / 2) ** 2; // 1 en el centro galáctico, 0 en el anticentro
    const b = gauss() * (4 + 6 * toCenter);
    return { v: galacticToVec(l, b), a: 0.05 + 0.12 * toCenter + rng() * 0.05, r: 0.8 + rng() * 2.2 };
  });
}

// --------------------------------------------------------------- Sol y Luna de una fecha

const julianDay = (date) => date.getTime() / 86_400_000 + 2440587.5;

/** Posición aparente del Sol (precisión ~0,01°). */
export function sunPosition(date) {
  const n = julianDay(date) - 2451545.0;
  const L = (280.46 + 0.9856474 * n) % 360;
  const g = ((357.528 + 0.9856003 * n) % 360) * DEG;
  const lambda = (((L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) % 360) + 360) % 360;
  const eps = (23.439 - 0.0000004 * n) * DEG;
  const lr = lambda * DEG;
  const ra = wrapRa(Math.atan2(Math.cos(eps) * Math.sin(lr), Math.cos(lr)) / DEG / 15);
  const dec = Math.asin(Math.sin(eps) * Math.sin(lr)) / DEG;
  return { ra, dec, lambda };
}

/**
 * Constelación del zodiaco tras el Sol según su longitud eclíptica, con los
 * límites oficiales (IAU) aproximados al grado. Cerca de un límite se dice.
 */
const ZODIAC = [
  [0, 'Piscis'], [29, 'Aries'], [53.5, 'Tauro'], [90.4, 'Géminis'], [118.3, 'Cáncer'], [138.2, 'Leo'], [174.2, 'Virgo'],
  [218.0, 'Libra'], [241.1, 'Escorpio'], [247.7, 'Ofiuco'], [266.3, 'Sagitario'], [300.0, 'Capricornio'], [327.9, 'Acuario'], [351.6, 'Piscis'],
];
export function sunConstellation(lambda) {
  let idx = 0;
  for (let i = 0; i < ZODIAC.length; i += 1) if (lambda >= ZODIAC[i][0]) idx = i;
  const name = ZODIAC[idx][1];
  const startEdge = ZODIAC[idx][0];
  const next = ZODIAC[(idx + 1) % ZODIAC.length];
  const endEdge = idx + 1 < ZODIAC.length ? next[0] : 360;
  if (lambda - startEdge < 1 && idx > 0) return { name, borderWith: ZODIAC[idx - 1][1] };
  if (endEdge - lambda < 1) return { name, borderWith: next[1] };
  return { name, borderWith: null };
}

/**
 * El Sol en una fecha y la constelación del zodiaco que tenía detrás. Los
 * límites están en coordenadas J2000; la longitud «de la fecha» se corrige por
 * la precesión (≈ 0,014° al año).
 */
export function sunOnDate(date) {
  const sun = sunPosition(date);
  const years = (julianDay(date) - 2451545.0) / 365.25;
  return { ...sun, constellation: sunConstellation((((sun.lambda - 0.01397 * years) % 360) + 360) % 360) };
}

/** Fase de la Luna (no depende del lugar). */
export function moonPhase(date) {
  const synodic = 29.530588853;
  const age = (((julianDay(date) - 2451550.1) % synodic) + synodic) % synodic;
  const illumination = (1 - Math.cos((2 * Math.PI * age) / synodic)) / 2;
  const names = [
    [1.0, 'Luna nueva'],
    [6.4, 'Luna creciente'],
    [8.4, 'Cuarto creciente'],
    [13.8, 'Gibosa creciente'],
    [15.8, 'Luna llena'],
    [21.1, 'Gibosa menguante'],
    [23.1, 'Cuarto menguante'],
    [28.5, 'Luna menguante'],
    [synodic, 'Luna nueva'],
  ];
  const name = names.find(([limit]) => age < limit)[1];
  return { age, illumination, name, waxing: age < synodic / 2 };
}

// --------------------------------------------------------------- objetos seleccionables

export const SELECTABLE = Object.freeze([...STARS, ...DEEP_SKY]);
export const DISCOVERABLE_TOTAL = CONSTELLATIONS.length + DEEP_SKY.length + 1; // + el asterismo personal
