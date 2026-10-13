/** Ilustración original de Reino de Ladrillos: la exploradora salta hacia un bloque con estrella. */
const STAR = 'M0 -6 L1.8 -1.9 L6 -1.9 L2.6 0.8 L3.8 5.2 L0 2.6 L-3.8 5.2 L-2.6 0.8 L-6 -1.9 L-1.8 -1.9 Z';

export function BrickArt({ className }) {
  return (
    <svg className={className} viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false" shapeRendering="crispEdges">
      <defs>
        <linearGradient id="rl-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7ec8ff" />
          <stop offset="1" stopColor="#cdeeff" />
        </linearGradient>
      </defs>
      <rect width="400" height="250" fill="url(#rl-sky)" />
      <path d="M0 190 Q60 130 130 190 T260 180 T400 175 V250 H0 Z" fill="#a6dcae" />
      <ellipse cx="90" cy="50" rx="30" ry="11" fill="#fff" opacity="0.9" />
      <ellipse cx="300" cy="36" rx="26" ry="9" fill="#fff" opacity="0.9" />
      {/* Suelo */}
      {Array.from({ length: 13 }, (_, i) => (
        <g key={i}>
          <rect x={i * 32} y="206" width="32" height="44" fill="#b5713a" />
          <rect x={i * 32} y="206" width="32" height="8" fill="#5fcf5a" />
          <rect x={i * 32 + 8} y="226" width="4" height="4" fill="#7d4a22" />
        </g>
      ))}
      {/* Ladrillos y bloque con estrella */}
      {[150, 182, 246].map((x) => (
        <g key={x}>
          <rect x={x} y="100" width="32" height="32" fill="#c8643b" />
          <rect x={x} y="114" width="32" height="2" fill="#7a3a20" />
          <rect x={x + 14} y="100" width="2" height="14" fill="#7a3a20" />
        </g>
      ))}
      <rect x="214" y="100" width="32" height="32" fill="#7a4a12" />
      <rect x="216" y="102" width="28" height="28" fill="#e8a33d" />
      <path d={STAR} transform="translate(230 116) scale(1.6)" fill="#fff6d0" />
      {/* Columna de piedra */}
      <rect x="312" y="150" width="40" height="56" fill="#3f9c94" />
      <rect x="308" y="146" width="48" height="12" fill="#55c2b8" />
      {/* Exploradora saltando */}
      <g transform="translate(212 136)">
        <rect x="2" y="24" width="20" height="18" fill="#2f8f9d" />
        <rect x="0" y="20" width="24" height="6" fill="#ff6fa8" />
        <rect x="-8" y="22" width="9" height="4" fill="#ff6fa8" />
        <rect x="4" y="4" width="17" height="16" fill="#ffd9b8" />
        <rect x="2" y="0" width="22" height="7" fill="#f2b632" />
        <rect x="16" y="10" width="4" height="4" fill="#2a1a2a" />
        <rect x="2" y="42" width="8" height="6" fill="#3a2440" />
        <rect x="14" y="40" width="8" height="6" fill="#3a2440" />
      </g>
      {/* Moneda y gorgojo */}
      <ellipse cx="230" cy="80" rx="7" ry="10" fill="#ffd23f" />
      <ellipse cx="110" cy="194" rx="15" ry="12" fill="#6b3fa0" />
      <rect x="101" y="186" width="6" height="6" fill="#fff" />
      <rect x="114" y="186" width="6" height="6" fill="#fff" />
    </svg>
  );
}
