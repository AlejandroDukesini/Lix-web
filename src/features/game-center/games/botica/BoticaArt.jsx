/** Ilustración original de la Botica de colores: frascos en una balda, uno vertiendo en otro. */
const FLASKS = [
  { x: 70, layers: ['#e5484d', '#2f6fdf', '#e5484d', '#f4c21b'] },
  { x: 132, layers: ['#2fa860', '#2fa860', '#2fa860', '#2fa860'], sealed: true },
  { x: 194, layers: ['#2f6fdf', '#f4c21b', '#8e4ec6'] },
  { x: 318, layers: ['#8e4ec6', '#e5484d'] },
];

const shape = (x, top, w, h) => `M${x} ${top} h${w} v${h - w / 2} a${w / 2} ${w / 2} 0 0 1 -${w} 0 z`;

function Flask({ x, layers, sealed, tilt = 0 }) {
  const w = 40;
  const h = 128;
  const top = 92;
  const slot = (h - 10) / 4;
  return (
    <g transform={tilt ? `rotate(${tilt} ${x + w / 2} ${top})` : undefined}>
      <defs>
        <clipPath id={`bt-art-clip-${x}`}>
          <path d={shape(x, top, w, h)} />
        </clipPath>
      </defs>
      <g clipPath={`url(#bt-art-clip-${x})`}>
        <rect x={x} y={top} width={w} height={h} fill="rgba(255,255,255,0.35)" />
        {layers.map((color, i) => (
          <rect key={i} x={x} y={top + h - (i + 1) * slot} width={w} height={slot + 1} fill={color} />
        ))}
      </g>
      <path d={shape(x, top, w, h)} fill="none" stroke="#fff" strokeWidth="3" />
      <rect x={x + 8} y={top + 12} width="5" height={h - 40} rx="2.5" fill="rgba(255,255,255,0.6)" />
      {sealed && <rect x={x + 10} y={top - 12} width={w - 20} height="13" rx="3" fill="#c9996a" />}
    </g>
  );
}

export function BoticaArt({ className }) {
  return (
    <svg className={className} viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="bt-art-wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fbf1e2" />
          <stop offset="1" stopColor="#ead6ba" />
        </linearGradient>
      </defs>
      <rect width="400" height="250" fill="url(#bt-art-wall)" />
      <circle cx="335" cy="56" r="72" fill="#fff2c8" opacity="0.35" />
      <rect x="296" y="16" width="78" height="80" rx="8" fill="#d6efff" />
      <rect x="296" y="16" width="78" height="80" rx="8" fill="none" stroke="#c59a6a" strokeWidth="6" />
      <path d="M335 16 v80 M296 56 h78" stroke="#c59a6a" strokeWidth="4" />
      {FLASKS.slice(0, 3).map((f) => (
        <Flask key={f.x} {...f} />
      ))}
      <path d="M262 118 q3 44 2 96" stroke="#8e4ec6" strokeWidth="6" fill="none" strokeLinecap="round" opacity="0.9" />
      <Flask x={256} layers={['#f4c21b', '#8e4ec6']} tilt={-58} />
      <Flask {...FLASKS[3]} />
      <rect x="40" y="222" width="330" height="14" rx="3" fill="#a06d40" />
      <rect x="40" y="234" width="330" height="6" rx="2" fill="#7a4d29" />
    </svg>
  );
}
