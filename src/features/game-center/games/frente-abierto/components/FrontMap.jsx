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

/** Icono de ciudad (casas) o fortaleza (escudo), pequeño, arriba del número. */
function KindIcon({ kind, x, y }) {
  if (kind === 'city') return <path d={`M${x - 6} ${y + 3} v-5 l3 -3 l3 3 v-2 l3 -3 l3 3 v7 z`} className="fa-icon" />;
  if (kind === 'fort') return <path d={`M${x} ${y - 6} l6 2 v3 c0 4 -3 6 -6 7 c-3 -1 -6 -3 -6 -7 v-3 z`} className="fa-icon" />;
  return null;
}

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
        <pattern id={hatch} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="6" className="fa-neutral-bg" />
          <line x1="0" y1="0" x2="0" y2="6" className="fa-neutral-line" />
        </pattern>
      </defs>
      {keys.map((key) => {
        const t = state.map[key];
        const [x, y] = hexCenter(key);
        const faction = t.owner ? FACTIONS[t.owner] : null;
        const kind = targetKind.get(key);
        const ownerName = faction ? faction.name : 'neutral';
        const kindName = t.kind === 'city' ? ', ciudad' : t.kind === 'fort' ? ', fortaleza' : '';
        return (
          <g
            key={key}
            role="gridcell"
            tabIndex={0}
            aria-label={`${ownerName}${kindName}${t.capital ? ', capital' : ''}: ${t.troops} tropas${kind ? (kind === 'move' ? '. Puedes mover aquí' : '. Puedes atacar aquí') : ''}`}
            className={cx('fa-hex', key === selected && 'is-selected', kind && `is-${kind}`, highlight?.has(key) && 'is-flash', state.acted.includes(key) && 'is-acted')}
            onClick={() => onTerritory(key)}
            onKeyDown={(event) => (event.key === 'Enter' || event.key === ' ') && (event.preventDefault(), onTerritory(key))}
          >
            <polygon points={corners(x, y, R * 0.97)} fill={faction ? faction.color : `url(#${hatch})`} className="fa-hex__shape" />
            {faction && (
              <text x={x - R * 0.42} y={y - R * 0.3} className="fa-glyph" textAnchor="middle">
                {faction.glyph}
              </text>
            )}
            {t.capital && <circle cx={x + R * 0.45} cy={y - R * 0.38} r="4" className="fa-capital" />}
            <KindIcon kind={t.kind} x={x} y={y - 8} />
            <text x={x} y={y + (t.kind === 'plain' ? 6 : 12)} className="fa-troops" textAnchor="middle">
              {t.troops}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
