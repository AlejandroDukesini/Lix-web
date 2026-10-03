/** Ilustración original de Tunnel Runner: anillos de neón que se pierden en el fondo. */
const SIDES = 12;

function ring(cx, cy, r, rotation = 0) {
  return Array.from({ length: SIDES }, (_, i) => {
    const a = rotation + (i / SIDES) * Math.PI * 2;
    return `${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`;
  }).join(' ');
}

function segment(cx, cy, r1, r2, side, rotation = 0) {
  const a1 = rotation + (side / SIDES) * Math.PI * 2;
  const a2 = rotation + ((side + 1) / SIDES) * Math.PI * 2;
  const p = (r, a) => `${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`;
  return `${p(r1, a1)} ${p(r1, a2)} ${p(r2, a2)} ${p(r2, a1)}`;
}

export function TunnelArt({ className }) {
  const cx = 200;
  const cy = 112;
  const radii = [210, 150, 106, 74, 51, 35, 24, 16];
  return (
    <svg className={className} viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="tn-depth" cx="0.5" cy="0.45" r="0.6">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.08" stopColor="#ff9de6" />
          <stop offset="0.35" stopColor="#3b0f5c" />
          <stop offset="1" stopColor="#07030f" />
        </radialGradient>
      </defs>
      <rect width="400" height="250" fill="url(#tn-depth)" />
      {/* Estelas de velocidad */}
      <g stroke="#7df9ff" strokeWidth="2" strokeLinecap="round" opacity="0.35">
        {Array.from({ length: 14 }, (_, i) => {
          const a = (i / 14) * Math.PI * 2 + 0.2;
          return <line key={i} x1={cx + Math.cos(a) * 60} y1={cy + Math.sin(a) * 60} x2={cx + Math.cos(a) * 190} y2={cy + Math.sin(a) * 190} />;
        })}
      </g>
      {radii.map((r, i) => (
        <polygon
          key={r}
          points={ring(cx, cy, r, i * 0.06)}
          fill="none"
          stroke={i % 2 ? '#ff4fd8' : '#5ef2ff'}
          strokeWidth={Math.max(1, 4 - i * 0.45)}
          opacity={1 - i * 0.1}
        />
      ))}
      {/* Obstáculos en dos anillos */}
      <g fill="#ff4fd8" opacity="0.9">
        {[0, 1, 2, 6, 7].map((side) => (
          <polygon key={`a${side}`} points={segment(cx, cy, 74, 52, side, 0.18)} />
        ))}
      </g>
      <g fill="#ffd166" opacity="0.85">
        {[3, 4, 9, 10].map((side) => (
          <polygon key={`b${side}`} points={segment(cx, cy, 35, 25, side, 0.3)} />
        ))}
      </g>
      {/* Nave */}
      <g transform="translate(200 212)">
        <ellipse cx="0" cy="10" rx="30" ry="6" fill="#5ef2ff" opacity="0.35" />
        <path d="M0 -16 L22 10 L0 4 L-22 10Z" fill="#ffffff" stroke="#5ef2ff" strokeWidth="3" strokeLinejoin="round" />
      </g>
    </svg>
  );
}
