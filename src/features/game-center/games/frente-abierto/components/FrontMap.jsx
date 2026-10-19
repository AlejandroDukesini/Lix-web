import { useId } from 'react';
import { FACTIONS, parseKey } from '../engine/frontEngine.js';
import { cx } from '../../../../../utils/cx.js';

const R = 26; // radio de cada hexágono (unidades del SVG)

/** Centro de un hexágono «pointy-top» en coordenadas axiales. */
export function hexCenter(key) {
  const [q, r] = parseKey(key);
  return [R * Math.sqrt(3) * (q + r / 2), R * 1.5 * r];
}

const corners = (cx, cy, radius) =>
  Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 30);
    return `${(cx + radius * Math.cos(a)).toFixed(1)},${(cy + radius * Math.sin(a)).toFixed(1)}`;
  }).join(' ');

/** Icono de ciudad (casas con tejado) o fortaleza (torre almenada), pequeño, arriba del número. */
function KindIcon({ kind, x, y }) {
  if (kind === 'city')
    return (
      <g className="fa-icon">
        <path d={`M${x - 8} ${y + 4} v-5 l4 -4 l4 4 v5 z`} />
        <path d={`M${x} ${y + 4} v-7 l4.5 -4.5 l4.5 4.5 v7 z`} />
        <path d={`M${x - 5.5} ${y + 4} v-2.5 h2.5 v2.5 M${x + 3} ${y + 4} v-3 h3 v3`} className="fa-icon__cut" />
      </g>
    );
  if (kind === 'fort')
    return (
      <path
        d={`M${x - 7} ${y + 4} v-9 h3 v2 h2.5 v-2 h3 v2 h2.5 v-2 h3 v9 z M${x - 1.5} ${y + 4} v-3.5 a1.5 1.5 0 0 1 3 0 v3.5`}
        className="fa-icon"
        fillRule="evenodd"
      />
    );
  return null;
}

/** Capital: banderín ondeando sobre un mástil. */
const Capital = ({ x, y }) => (
  <g className="fa-capital">
    <path d={`M${x} ${y + 6} V${y - 6}`} className="fa-capital__pole" />
    <path d={`M${x} ${y - 6} q4 -2 8 0 q-2 2.5 0 5 q-4 -2 -8 0 z`} className="fa-capital__flag" />
  </g>
);

/**
 * Mapa de territorios. No depende solo del color: cada bando lleva su símbolo
 * (★ ▲ ■ ◆), los neutrales van rayados y las ciudades y fortalezas tienen icono.
 * `targets` marca los destinos posibles (mover / atacar) del territorio elegido.
 */
export function FrontMap({ state, selected, targets, highlight, onTerritory }) {
  const hatch = useId();
  const keys = Object.keys(state.map);
  const pts = keys.map(hexCenter);
  const xs = pts.map(([x]) => x);
  const ys = pts.map(([, y]) => y);
  const pad = R * 1.2;
  const box = [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) - Math.min(...xs) + pad * 2, Math.max(...ys) - Math.min(...ys) + pad * 2];
  const targetKind = new Map(targets.map((t) => [t.key, t.kind]));

  return (
    <svg
      className="fa-map"
      viewBox={box.join(' ')}
      role="grid"
      aria-label="Mapa de territorios"
      // Columnas y proporción: el CSS fija un tamaño mínimo de casilla para poder tocarla.
      style={{ '--fa-cols': (box[2] / (R * Math.sqrt(3))).toFixed(2), '--fa-ratio': (box[3] / box[2]).toFixed(3) }}
    >
      <defs>
        <pattern id={hatch} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="7" height="7" className="fa-neutral-bg" />
          <line x1="0" y1="0" x2="0" y2="7" className="fa-neutral-line" />
        </pattern>
        <linearGradient id={`${hatch}-sheen`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.38" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.16" />
        </linearGradient>
      </defs>
      {/* Mar y costa: cada casilla proyecta un bajío y una franja de arena; juntos dibujan la isla. */}
      <g className="fa-coast" aria-hidden="true">
        {pts.map(([x, y], i) => (
          <polygon key={`s${i}`} points={corners(x, y + 3, R * 1.28)} className="fa-coast__shallow" />
        ))}
        {pts.map(([x, y], i) => (
          <polygon key={`b${i}`} points={corners(x, y + 3, R * 1.1)} className="fa-coast__sand" />
        ))}
      </g>
      {keys.map((key) => {
        const t = state.map[key];
        const [x, y] = hexCenter(key);
        const faction = t.owner ? FACTIONS[t.owner] : null;
        const kind = targetKind.get(key);
        const ownerName = faction ? faction.name : 'neutral';
        const kindName = t.kind === 'city' ? ', ciudad' : t.kind === 'fort' ? ', fortaleza' : '';
        const top = corners(x, y, R * 0.94);
        return (
          <g
            key={key}
            role="gridcell"
            tabIndex={0}
            aria-label={`${ownerName}${kindName}${t.capital ? ', capital' : ''}: ${t.troops} tropas${kind ? (kind === 'move' ? '. Puedes mover aquí' : '. Puedes atacar aquí') : ''}`}
            className={cx('fa-hex', faction && 'is-owned', key === selected && 'is-selected', kind && `is-${kind}`, highlight?.has(key) && 'is-flash', state.acted.includes(key) && 'is-acted')}
            onClick={() => onTerritory(key)}
            onKeyDown={(event) => (event.key === 'Enter' || event.key === ' ') && (event.preventDefault(), onTerritory(key))}
          >
            {/* Losa con canto: la cara inferior oscura da sensación de relieve. */}
            <polygon points={corners(x, y + 4, R * 0.94)} className="fa-hex__edge" fill={faction ? faction.color : undefined} />
            <polygon points={top} fill={faction ? faction.color : `url(#${hatch})`} className="fa-hex__shape" />
            <polygon points={top} fill={`url(#${hatch}-sheen)`} className="fa-hex__sheen" />
            {faction && (
              <text x={x - R * 0.42} y={y - R * 0.3} className="fa-glyph" textAnchor="middle">
                {faction.glyph}
              </text>
            )}
            {t.capital && <Capital x={x + R * 0.36} y={y - R * 0.38} />}
            <KindIcon kind={t.kind} x={x} y={y - 9} />
            {/* Ficha de tropas: disco oscuro con el número en blanco, legible sobre cualquier color. */}
            <circle cx={x} cy={y + (t.kind === 'plain' ? 2 : 8)} r="8.5" className="fa-token" />
            <text x={x} y={y + (t.kind === 'plain' ? 6.5 : 12.5)} className="fa-troops" textAnchor="middle">
              {t.troops}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
