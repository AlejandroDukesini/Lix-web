import { CONSTELLATION } from './timeline.js';

/**
 * La constelación «Nosotros».
 *
 * Las líneas recorren la historia como una línea de tiempo: nacen en la estrella
 * del comienzo (fecha de inicio configurada) y avanzan hasta la de hoy, mientras
 * un contador acompaña la punta del trazo contando los días. El travesaño final
 * cierra la figura y revela, sin decirlo, una «A».
 *
 * El dibujo progresivo lo controla la línea de tiempo escribiendo
 * `stroke-dashoffset` y la posición del contador directamente en el DOM
 * (elementos marcados con data-*), sin renderizar React en cada fotograma.
 * Si no hay fecha configurada, no se muestran etiquetas ni contador: nunca se inventan datos.
 */
export function Constellation({ startLabel, todayLabel }) {
  const { stars, decoys, path, crossbar } = CONSTELLATION;
  const segment = ([from, to], key, extra) => (
    <line
      key={key}
      x1={stars[from][0]}
      y1={stars[from][1]}
      x2={stars[to][0]}
      y2={stars[to][1]}
      pathLength="1"
      className="constellation__line"
      {...extra}
    />
  );

  return (
    <svg className="constellation" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <defs>
        <radialGradient id="constellation-glow">
          <stop offset="0" className="constellation__glow-core" />
          <stop offset="1" className="constellation__glow-edge" />
        </radialGradient>
      </defs>

      <g className="constellation__decoys">
        {decoys.map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r * 2.2} className="constellation__decoy" style={{ '--i': i }} />
        ))}
      </g>

      <g className="constellation__lines">
        {path.map((pair, i) => segment(pair, `p${i}`, { 'data-segment': i }))}
        {segment(crossbar, 'crossbar', { 'data-crossbar': '' })}
      </g>

      <g className="constellation__stars">
        {Object.entries(stars).map(([key, [x, y]]) => (
          <g key={key} className={`constellation__star constellation__star--${key}`}>
            <circle cx={x} cy={y} r="34" fill="url(#constellation-glow)" />
            <circle cx={x} cy={y} r="6.5" className="constellation__star-core" />
          </g>
        ))}
      </g>

      {startLabel && (
        <g className="constellation__labels" data-constellation-labels="">
          <text x={stars.start[0] - 20} y={stars.start[1] + 58} textAnchor="end" className="constellation__label">
            {startLabel}
          </text>
          <text x={stars.start[0] - 20} y={stars.start[1] + 88} textAnchor="end" className="constellation__label-note">
            el comienzo
          </text>
          <text x={stars.today[0] + 20} y={stars.today[1] + 58} className="constellation__label" data-today-label="">
            {todayLabel}
          </text>
          <text data-counter="" className="constellation__counter" x={stars.start[0]} y={stars.start[1] - 26} textAnchor="middle">
            0 días
          </text>
        </g>
      )}
    </svg>
  );
}
