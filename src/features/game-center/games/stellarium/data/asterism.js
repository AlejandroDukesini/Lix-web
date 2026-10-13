/**
 * El asterismo «Nosotros»: la misma figura que dibuja la presentación (la línea
 * del tiempo que forma una «A»), colocada en una zona del cielo sin estrellas
 * brillantes del catálogo, en Erídano. No es una constelación real ni figura en
 * ningún catálogo, y el observatorio lo dice así.
 */
import { CONSTELLATION } from '../../../../presentation/story/timeline.js';

const CENTER = { ra: 3.45, dec: -19 };
const SPAN = 15; // grados que ocupa el lienzo de 1000 × 1000 de la presentación

function toSky([x, y]) {
  const cos = Math.cos((CENTER.dec * Math.PI) / 180);
  return { ra: CENTER.ra - ((x - 500) / 1000) * (SPAN / 15 / cos), dec: CENTER.dec - ((y - 500) / 1000) * SPAN };
}

export const ASTERISM = Object.freeze({
  id: 'nosotros',
  name: 'Nosotros',
  kind: 'asterism',
  center: CENTER,
  radius: SPAN * 0.42,
  stars: Object.fromEntries(Object.entries(CONSTELLATION.stars).map(([key, p]) => [key, toSky(p)])),
  lines: [...CONSTELLATION.path, CONSTELLATION.crossbar],
});
