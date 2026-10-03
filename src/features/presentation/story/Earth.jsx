/**
 * El planeta Tierra del capítulo III, en SVG.
 *
 * El globo es un círculo de radio 96 (viewBox 200×200). Los continentes salen de
 * coordenadas reales (longitud, latitud) simplificadas, proyectadas en una franja
 * equirectangular de 384 de ancho (360° de longitud = dos diámetros: así la mitad
 * visible ocupa el disco) y suavizadas con Catmull-Rom para que tengan contornos
 * redondeados. La rotación desplaza la franja (dos copias para que nunca se acabe);
 * el sombreado del limbo y del terminador da el volumen. La línea de tiempo escribe
 * la posición, el tamaño y el giro en el DOM (data-earth*).
 */

export const EARTH_STRIP = 384;
const R = 96;
const TOP = 100 - R;

const CONTINENTS = {
  northAmerica: [
    [-166, 66], [-150, 71], [-125, 70], [-95, 73], [-80, 64], [-62, 58], [-56, 50], [-66, 44], [-76, 38],
    [-81, 31], [-82, 25], [-90, 29], [-97, 26], [-97, 19], [-88, 16], [-83, 9], [-79, 8], [-92, 15],
    [-105, 20], [-112, 29], [-117, 33], [-124, 41], [-125, 49], [-135, 57], [-150, 60], [-163, 58],
  ],
  greenland: [[-55, 60], [-43, 60], [-22, 70], [-18, 80], [-35, 83], [-60, 80], [-58, 70]],
  southAmerica: [
    [-80, 9], [-72, 12], [-62, 10], [-51, 4], [-35, -6], [-39, -15], [-41, -23], [-48, -26], [-54, -34],
    [-63, -40], [-66, -50], [-70, -55], [-74, -50], [-73, -38], [-71, -24], [-76, -14], [-81, -5],
  ],
  europe: [
    [-9, 37], [-9, 43], [-2, 44], [-4, 48], [2, 51], [5, 54], [8, 57], [5, 62], [12, 66], [20, 70],
    [30, 71], [40, 67], [44, 56], [40, 47], [30, 45], [26, 40], [22, 37], [15, 38], [12, 44], [4, 43], [-2, 37],
  ],
  africa: [
    [-17, 21], [-13, 28], [-6, 36], [10, 37], [20, 32], [32, 31], [35, 27], [43, 12], [51, 11], [44, 2],
    [40, -10], [36, -20], [32, -29], [25, -34], [19, -34], [14, -22], [12, -6], [9, 3], [-4, 5], [-11, 7], [-17, 14],
  ],
  asia: [
    [40, 67], [60, 70], [80, 73], [100, 77], [125, 73], [150, 71], [178, 68], [170, 62], [158, 55], [142, 53],
    [140, 46], [131, 42], [122, 39], [122, 31], [118, 24], [109, 20], [106, 11], [100, 13], [99, 7], [93, 18],
    [88, 22], [80, 15], [77, 8], [72, 20], [66, 25], [57, 25], [52, 28], [48, 30], [36, 36], [36, 41], [44, 45], [44, 56],
  ],
  arabia: [[36, 30], [43, 13], [52, 16], [58, 22], [56, 26], [50, 28], [44, 30]],
  australia: [
    [114, -22], [122, -18], [130, -12], [137, -12], [142, -10], [146, -18], [153, -26], [151, -34], [147, -39],
    [140, -38], [135, -34], [129, -32], [118, -35], [114, -30],
  ],
  japan: [[130, 32], [136, 35], [141, 38], [142, 45], [139, 41], [133, 34]],
  madagascar: [[44, -16], [50, -14], [48, -24], [44, -24]],
  britain: [[-6, 50], [2, 51], [-1, 56], [-5, 58], [-6, 54]],
  indonesia: [[95, 5], [105, -6], [115, -8], [124, -9], [118, -3], [109, 1], [100, 3]],
};

// Bancos de nubes: [x, y, ancho]; cada uno es un racimo de elipses solapadas.
const CLOUDS = [
  [30, 58, 34], [112, 44, 46], [200, 70, 38], [282, 52, 30], [330, 92, 40],
  [60, 122, 44], [160, 134, 36], [250, 114, 48], [352, 142, 30], [10, 150, 36],
];

const project = ([lon, lat]) => [((lon + 180) / 360) * EARTH_STRIP, TOP + ((90 - lat) / 180) * (2 * R)];

/** Contorno cerrado y suave (Catmull-Rom → Bézier cúbicas) a partir de puntos. */
function smoothPath(points) {
  const p = points.map(project);
  const n = p.length;
  const f = (v) => Math.round(v * 10) / 10;
  let d = `M${f(p[0][0])} ${f(p[0][1])}`;
  for (let i = 0; i < n; i += 1) {
    const p0 = p[(i - 1 + n) % n];
    const p1 = p[i];
    const p2 = p[(i + 1) % n];
    const p3 = p[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return `${d}Z`;
}

const LAND = Object.entries(CONTINENTS).map(([id, points]) => ({ id, d: smoothPath(points) }));

function Land() {
  return (
    <>
      {LAND.map(({ id, d }) => (
        <path key={id} d={d} className={`earth__land earth__land--${id}`} />
      ))}
      <rect x="0" y={TOP} width={EARTH_STRIP} height="9" rx="4.5" className="earth__ice" />
      <rect x="0" y={200 - TOP - 12} width={EARTH_STRIP} height="12" rx="6" className="earth__ice" />
    </>
  );
}

function Clouds() {
  return CLOUDS.map(([x, y, w], i) => (
    <g key={i} className="earth__cloud">
      <ellipse cx={x + w * 0.3} cy={y} rx={w * 0.3} ry={3.2} />
      <ellipse cx={x + w * 0.55} cy={y - 1.8} rx={w * 0.26} ry={3.6} />
      <ellipse cx={x + w * 0.78} cy={y + 0.6} rx={w * 0.22} ry={2.6} />
      <ellipse cx={x + w * 0.5} cy={y + 2.4} rx={w * 0.4} ry={1.8} />
    </g>
  ));
}

export function Earth() {
  return (
    <div className="astral__earth" data-earth="">
      <svg className="earth" viewBox="0 0 200 200" aria-hidden="true">
        <defs>
          <clipPath id="earth-disc">
            <circle cx="100" cy="100" r={R} />
          </clipPath>
          <radialGradient id="earth-atmosphere" cx="50%" cy="50%" r="50%">
            <stop offset="0.86" className="earth-atmo-in" />
            <stop offset="0.91" className="earth-atmo-mid" />
            <stop offset="1" className="earth-atmo-out" />
          </radialGradient>
          <radialGradient id="earth-ocean" cx="38%" cy="34%" r="70%">
            <stop offset="0" className="earth-ocean-light" />
            <stop offset="0.6" className="earth-ocean-mid" />
            <stop offset="1" className="earth-ocean-deep" />
          </radialGradient>
          {/* Luz del Sol desde arriba a la izquierda: limbo oscuro y lado nocturno. */}
          <radialGradient id="earth-shade" cx="34%" cy="30%" r="82%">
            <stop offset="0.35" className="earth-shade-day" />
            <stop offset="0.78" className="earth-shade-dusk" />
            <stop offset="1" className="earth-shade-night" />
          </radialGradient>
          <radialGradient id="earth-gloss" cx="32%" cy="26%" r="30%">
            <stop offset="0" className="earth-gloss-in" />
            <stop offset="1" className="earth-gloss-out" />
          </radialGradient>
        </defs>
        <circle cx="100" cy="100" r="104" fill="url(#earth-atmosphere)" />
        <g clipPath="url(#earth-disc)">
          <circle cx="100" cy="100" r={R} fill="url(#earth-ocean)" />
          <g className="earth__spin" data-earth-land="">
            <g transform={`translate(${-EARTH_STRIP} 0)`}>
              <Land />
            </g>
            <Land />
          </g>
          <g className="earth__spin" data-earth-clouds="">
            <g transform={`translate(${-EARTH_STRIP} 0)`}>
              <Clouds />
            </g>
            <Clouds />
          </g>
          <circle cx="100" cy="100" r={R} fill="url(#earth-shade)" />
          <circle cx="100" cy="100" r={R} fill="url(#earth-gloss)" />
        </g>
        <circle cx="100" cy="100" r={R} className="earth__rim" />
      </svg>
    </div>
  );
}
