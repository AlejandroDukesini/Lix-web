/** Ilustración original de Saltos de Lumi: la chispa saltando hacia la vela al atardecer. */
export function LumiArt({ className }) {
  return (
    <svg className={className} viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="lumi-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2b2350" />
          <stop offset="0.6" stopColor="#7a4a78" />
          <stop offset="1" stopColor="#f0a27a" />
        </linearGradient>
        <radialGradient id="lumi-glow">
          <stop offset="0" stopColor="#ffd678" stopOpacity="0.8" />
          <stop offset="1" stopColor="#ffb450" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="lumi-body" cx="0.38" cy="0.35">
          <stop offset="0" stopColor="#fff8d6" />
          <stop offset="0.6" stopColor="#ffd36b" />
          <stop offset="1" stopColor="#ff9f43" />
        </radialGradient>
      </defs>
      <rect width="400" height="250" fill="url(#lumi-sky)" />
      <path d="M0 175 Q60 140 120 165 T240 155 T400 150 V250 H0 Z" fill="#5a3d6b" />
      <path d="M0 200 Q80 180 160 196 T320 188 T400 192 V250 H0 Z" fill="#3e2f57" />
      <rect x="0" y="206" width="150" height="44" fill="#4a3552" />
      <rect x="0" y="204" width="150" height="8" rx="4" fill="#7fd39a" />
      <rect x="215" y="206" width="185" height="44" fill="#4a3552" />
      <rect x="215" y="204" width="185" height="8" rx="4" fill="#7fd39a" />
      <rect x="150" y="150" width="60" height="9" rx="4" fill="#c8875a" />
      <path d="M120 120 Q160 60 205 110" fill="none" stroke="#ffe7a8" strokeWidth="2.5" strokeDasharray="3 7" strokeLinecap="round" />
      {[[95, 170], [230, 140], [262, 130]].map(([x, y]) => (
        <path key={x} d={`M${x} ${y - 7} L${x + 2} ${y - 2} L${x + 7} ${y} L${x + 2} ${y + 2} L${x} ${y + 7} L${x - 2} ${y + 2} L${x - 7} ${y} L${x - 2} ${y - 2} Z`} fill="#fff3b0" />
      ))}
      <circle cx="160" cy="88" r="40" fill="url(#lumi-glow)" />
      <path d="M154 74 Q150 56 163 52 Q160 64 168 74 Z" fill="#ffb347" />
      <ellipse cx="160" cy="88" rx="16" ry="17" fill="url(#lumi-body)" />
      <rect x="160" y="83" width="3.5" height="7" rx="1.5" fill="#3a2440" />
      <rect x="168" y="83" width="3.5" height="7" rx="1.5" fill="#3a2440" />
      <circle cx="345" cy="160" r="46" fill="url(#lumi-glow)" />
      <rect x="333" y="150" width="24" height="56" rx="4" fill="#f6ecd9" />
      <rect x="350" y="150" width="7" height="56" fill="#000" opacity="0.1" />
      <ellipse cx="345" cy="138" rx="6" ry="11" fill="#ffcf5a" />
      <path d="M40 206 q-6 -16 6 -22 q12 6 6 22 z" fill="#3b2453" />
    </svg>
  );
}
