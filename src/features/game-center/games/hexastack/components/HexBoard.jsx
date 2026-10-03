import { COLORS, neighborsOf, parseKey, topColor, topRun } from '../engine/hexEngine.js';
import { cx } from '../../../../../utils/cx.js';

export const SIZE = 30; // radio del hexágono en unidades del SVG
const LAYER = 2.6; // altura visual de cada ficha: una torre de 10 no invade la celda de arriba
const MAX_LAYERS = 10;

/** Centro de una celda (hexágonos con un lado arriba: «flat-top»). */
export function center(key) {
  const [q, r] = parseKey(key);
  return [SIZE * 1.5 * q, SIZE * Math.sqrt(3) * (r + q / 2)];
}

/** Puntos de un hexágono redondeado (las esquinas se suavizan recortando un poco). */
export function hexPoints(cx, cy, radius) {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i;
    return `${(cx + radius * Math.cos(a)).toFixed(1)},${(cy + radius * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
}

/** Torre de fichas: cada capa es un hexágono algo más arriba; la de arriba lleva el símbolo y la cuenta. */
export function Stack({ stack, cx, cy, ghost = false, scale = 1 }) {
  if (!stack?.length) return null;
  const shown = stack.slice(-MAX_LAYERS);
  const r = SIZE * 0.86 * scale;
  const layer = LAYER * scale;
  const top = topColor(stack);
  const run = topRun(stack);
  return (
    <g className={cx_(ghost)} aria-hidden="true">
      {shown.map((color, i) => {
        const y = cy - i * layer;
        return (
          <g key={i}>
            <polygon points={hexPoints(cx, y + layer * 0.8, r)} fill={COLORS[color].side} className="hx-side" />
            <polygon points={hexPoints(cx, y, r)} fill={COLORS[color].hex} className="hx-tile" />
          </g>
        );
      })}
      <text x={cx} y={cy - (shown.length - 1) * layer + r * 0.18} textAnchor="middle" className="hx-label" style={{ fontSize: r * 0.62 }}>
        {COLORS[top].glyph}
        {run > 1 ? run : ''}
      </text>
    </g>
  );
}
const cx_ = (ghost) => cx('hx-stack', ghost && 'is-ghost');

/**
 * Tablero en SVG. `preview` = { key, stack } muestra dónde caería la pila y
 * qué vecinas se fusionarían; `flash` marca celdas que acaban de despejarse.
 */
export function HexBoard({ state, preview, flash, merged, onCell, onCellHover }) {
  const keys = Object.keys(state.board);
  const points = keys.map(center);
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const pad = SIZE * 1.4;
  const box = [Math.min(...xs) - pad, Math.min(...ys) - pad - LAYER * 8, Math.max(...xs) - Math.min(...xs) + pad * 2, Math.max(...ys) - Math.min(...ys) + pad * 2 + LAYER * 8];
  const previewColor = preview ? topColor(preview.stack) : null;
  const attract = new Set(preview ? neighborsOf(state, preview.key).filter((n) => topColor(state.board[n]) === previewColor) : []);

  return (
    <svg className="hx-board" viewBox={box.join(' ')} role="grid" aria-label="Tablero hexagonal">
      {keys.map((key) => {
        const [x, y] = center(key);
        const stack = state.board[key];
        const empty = !stack.length;
        const label = empty ? 'vacía' : `pila de ${stack.length}, arriba ${COLORS[topColor(stack)].name} ×${topRun(stack)}`;
        return (
          <g
            key={key}
            role="gridcell"
            tabIndex={empty ? 0 : -1}
            aria-label={`Celda ${key}: ${label}`}
            data-cell={key}
            className={cx('hx-cell', empty && 'is-empty', preview?.key === key && 'is-target', attract.has(key) && 'is-attract', flash?.has(key) && 'is-flash', merged?.has(key) && 'is-merged')}
            onClick={() => onCell(key)}
            onPointerEnter={(event) => event.pointerType === 'mouse' && onCellHover?.(key)}
            onKeyDown={(event) => (event.key === 'Enter' || event.key === ' ') && (event.preventDefault(), onCell(key))}
          >
            <polygon points={hexPoints(x, y, SIZE * 0.95)} className="hx-slot" />
            <Stack stack={stack} cx={x} cy={y} />
          </g>
        );
      })}
      {preview && (() => {
        const [x, y] = center(preview.key);
        return <Stack stack={preview.stack} cx={x} cy={y} ghost />;
      })()}
    </svg>
  );
}
