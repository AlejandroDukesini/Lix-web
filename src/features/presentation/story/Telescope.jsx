/**
 * Escena del telescopio: un planeta diminuto con su atmósfera, un pequeño
 * observatorio con la rendija abierta y un refractor sobre montura ecuatorial.
 *
 * Todo es SVG vectorial (sin imágenes) y sus colores salen de variables CSS,
 * de modo que el estilo (Glass/Maximal) y el tema (claro/oscuro) lo redibujan.
 *
 * Encuadre: el SVG ocupa exactamente la zona visual del escenario (libre de
 * texto) y encaja el instrumento completo (`meet`), apoyado abajo. El planeta
 * se dibuja más allá del encuadre (overflow visible) para cubrir el horizonte.
 *
 * El ocular es el punto hacia el que viaja la cámara en el capítulo V: sus
 * coordenadas (EYEPIECE) se proyectan a píxeles con `projectToArea`.
 */

/** Encuadre del observatorio y el telescopio, con algo de cielo por encima. */
export const RIG_VIEWBOX = [420, 60, 650, 740];

export const EYEPIECE = [937.5, 498];

/** Proyección de un punto del SVG a píxeles del escenario con preserveAspectRatio="xMidYMax meet". */
export function projectToArea([x, y], area, viewBox = RIG_VIEWBOX) {
  const [vx, vy, vw, vh] = viewBox;
  const scale = Math.min(area.width / vw, area.height / vh);
  const offsetX = area.x + (area.width - vw * scale) / 2 - vx * scale;
  const offsetY = area.y + area.height - vh * scale - vy * scale;
  return [offsetX + x * scale, offsetY + y * scale];
}

// Tubo dibujado sobre el eje X local (frente hacia +X) y orientado hacia arriba a la izquierda.
const TUBE_TRANSFORM = 'translate(780 505) rotate(35) scale(-1 1)';

export function Telescope() {
  return (
    <svg
      className="telescope"
      viewBox={RIG_VIEWBOX.join(' ')}
      preserveAspectRatio="xMidYMax meet"
      overflow="visible"
      aria-hidden="true"
      data-telescope-rig=""
    >
      <defs>
        <radialGradient id="ts-planet" cx="50%" cy="0%" r="62%">
          <stop offset="0" className="ts-planet-light" />
          <stop offset="0.45" className="ts-planet-mid" />
          <stop offset="1" className="ts-planet-dark" />
        </radialGradient>
        <linearGradient id="ts-atmosphere" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="ts-atmo-edge" />
          <stop offset="1" className="ts-atmo-fade" />
        </linearGradient>
        <linearGradient id="ts-enamel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="ts-enamel-dark" />
          <stop offset="0.28" className="ts-enamel-light" />
          <stop offset="0.36" className="ts-enamel-shine" />
          <stop offset="0.5" className="ts-enamel" />
          <stop offset="1" className="ts-enamel-dark" />
        </linearGradient>
        <linearGradient id="ts-brass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className="ts-brass-dark" />
          <stop offset="0.3" className="ts-brass-light" />
          <stop offset="0.55" className="ts-brass" />
          <stop offset="1" className="ts-brass-dark" />
        </linearGradient>
        <linearGradient id="ts-steel" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" className="ts-steel-dark" />
          <stop offset="0.45" className="ts-steel-light" />
          <stop offset="1" className="ts-steel-dark" />
        </linearGradient>
        <radialGradient id="ts-lens" cx="40%" cy="35%" r="70%">
          <stop offset="0" className="ts-lens-glint" />
          <stop offset="0.35" className="ts-lens-violet" />
          <stop offset="1" className="ts-lens-deep" />
        </radialGradient>
        <radialGradient id="ts-warm">
          <stop offset="0" className="ts-warm-core" />
          <stop offset="1" className="ts-warm-edge" />
        </radialGradient>
        <radialGradient id="ts-red">
          <stop offset="0" className="ts-red-core" />
          <stop offset="1" className="ts-red-edge" />
        </radialGradient>
        <radialGradient id="ts-slit">
          <stop offset="0" className="ts-warm-core" />
          <stop offset="1" className="ts-warm-edge" />
        </radialGradient>
      </defs>

      {/* Planeta: superficie, cráteres y borde de atmósfera iluminado */}
      <g className="ts-planet">
        <circle cx="800" cy="2620" r="1930" className="ts-atmosphere" fill="url(#ts-atmosphere)" />
        <circle cx="800" cy="2620" r="1900" fill="url(#ts-planet)" />
        <ellipse cx="420" cy="800" rx="90" ry="14" className="ts-crater" />
        <ellipse cx="1180" cy="790" rx="120" ry="16" className="ts-crater" />
        <ellipse cx="960" cy="880" rx="70" ry="10" className="ts-crater" />
        <ellipse cx="640" cy="905" rx="150" ry="18" className="ts-crater" />
        <path d="M-1100 720 A1900 1900 0 0 1 2700 720" className="ts-rim" fill="none" />
      </g>

      {/* Observatorio */}
      <g className="ts-observatory">
        <rect x="440" y="650" width="160" height="78" rx="6" className="ts-building" />
        <path d="M440 652 a80 80 0 0 1 160 0 z" className="ts-dome" />
        <path d="M512 576 L528 576 L532 652 L508 652 Z" fill="url(#ts-slit)" className="ts-slit" />
        <rect x="506" y="688" width="28" height="40" rx="3" className="ts-door" />
        <circle cx="520" cy="700" r="46" fill="url(#ts-warm)" className="ts-door-glow" />
        <line x1="440" y1="652" x2="600" y2="652" className="ts-dome-ring" />
      </g>

      {/* Trípode y bandeja de accesorios */}
      <g className="ts-tripod">
        <path d="M782 566 L792 778" className="ts-leg ts-leg--back" />
        <path d="M768 562 L682 748" className="ts-leg" />
        <path d="M796 562 L890 748" className="ts-leg" />
        <path d="M722 662 L850 662 L790 690 Z" className="ts-tray" />
        <circle cx="752" cy="668" r="7" className="ts-eyepiece-spare" />
        <circle cx="772" cy="672" r="6" className="ts-eyepiece-spare" />
        <ellipse cx="780" cy="560" rx="34" ry="10" fill="url(#ts-steel)" className="ts-head" />
      </g>

      {/* Linterna roja (los astrónomos la usan para no perder la adaptación a la oscuridad) */}
      <g className="ts-lamp">
        <circle cx="822" cy="664" r="60" fill="url(#ts-red)" className="ts-lamp-glow" />
        <rect x="806" y="656" width="26" height="12" rx="5" className="ts-lamp-body" />
        <circle cx="832" cy="662" r="4" className="ts-lamp-light" />
      </g>

      {/* Montura ecuatorial y contrapeso */}
      <g className="ts-mount">
        <path d="M780 505 L858 610" className="ts-shaft" />
        <rect x="838" y="596" width="40" height="34" rx="6" transform="rotate(-37 858 613)" fill="url(#ts-steel)" className="ts-weight" />
        <rect x="758" y="500" width="44" height="58" rx="8" fill="url(#ts-steel)" className="ts-mount-body" />
        <ellipse cx="780" cy="528" rx="17" ry="17" className="ts-setting-circle" />
      </g>

      {/* Tubo óptico */}
      <g transform={TUBE_TRANSFORM} className="ts-tube">
        <rect x="-60" y="30" width="44" height="18" rx="4" className="ts-saddle" />
        <rect x="-150" y="-34" width="330" height="68" rx="10" fill="url(#ts-enamel)" className="ts-body" />
        <rect x="170" y="-41" width="78" height="82" rx="8" fill="url(#ts-enamel)" className="ts-dewshield" />
        <rect x="-70" y="-37" width="12" height="74" rx="3" fill="url(#ts-brass)" className="ts-ring" />
        <rect x="112" y="-37" width="12" height="74" rx="3" fill="url(#ts-brass)" className="ts-ring" />
        <rect x="166" y="-42" width="8" height="84" rx="2" fill="url(#ts-brass)" className="ts-ring" />
        <ellipse cx="248" cy="0" rx="15" ry="40" fill="url(#ts-lens)" className="ts-lens" />
        <path d="M244 -26 Q252 -6 246 18" className="ts-lens-reflection" fill="none" />
        <circle cx="250" cy="-22" r="3.2" className="ts-lens-spark" />
        {/* Buscador */}
        <rect x="-20" y="-52" width="10" height="20" rx="2" className="ts-bracket" />
        <rect x="60" y="-52" width="10" height="20" rx="2" className="ts-bracket" />
        <rect x="-45" y="-66" width="140" height="18" rx="6" fill="url(#ts-enamel)" className="ts-finder" />
        <ellipse cx="96" cy="-57" rx="4" ry="9" fill="url(#ts-lens)" />
        {/* Enfocador y ocular */}
        <rect x="-188" y="-15" width="40" height="30" rx="5" fill="url(#ts-steel)" className="ts-focuser" />
        <rect x="-170" y="-18" width="10" height="36" rx="2" fill="url(#ts-brass)" />
        <rect x="-140" y="-62" width="30" height="30" rx="4" fill="url(#ts-steel)" className="ts-diagonal" />
        <rect x="-136" y="-92" width="22" height="34" rx="4" fill="url(#ts-brass)" className="ts-eyepiece" />
        <ellipse cx="-125" cy="-94" rx="13" ry="4" className="ts-eyecup" />
      </g>

      {/* Luz cálida que escapa del ocular: algo hay dentro */}
      <circle cx={EYEPIECE[0]} cy={EYEPIECE[1]} r="40" fill="url(#ts-warm)" className="ts-eyepiece-glow" data-eyepiece-glow="" />

      {/* Anotaciones de la bitácora */}
      <g className="ts-notes" data-telescope-notes="">
        <path d="M945 468 Q962 432 972 412" className="ts-note-line" />
        <text x="975" y="400" textAnchor="middle" className="ts-note">ocular</text>
        <path d="M808 672 Q786 702 760 718" className="ts-note-line" />
        <text x="754" y="730" textAnchor="end" className="ts-note">linterna roja</text>
        <path d="M590 336 Q600 300 628 270" className="ts-note-line" />
        <text x="604" y="258" className="ts-note">apuntando a algo especial</text>
      </g>
    </svg>
  );
}
