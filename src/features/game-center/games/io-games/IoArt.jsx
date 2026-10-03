/** Ilustración original de los juegos .io: arena arcade con células, territorio y drones. */
export function IoArt({ className }) {
  return (
    <svg className={className} viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <pattern id="io-grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M20 0H0V20" fill="none" stroke="#3a3478" strokeWidth="1" />
        </pattern>
        <radialGradient id="io-glow" cx="0.5" cy="0.45" r="0.6">
          <stop offset="0" stopColor="#2b2463" />
          <stop offset="1" stopColor="#100d2a" />
        </radialGradient>
        <radialGradient id="io-player" cx="0.35" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#7df9ff" />
        </radialGradient>
        <radialGradient id="io-big" cx="0.35" cy="0.35" r="0.75">
          <stop offset="0" stopColor="#ff9a9a" />
          <stop offset="1" stopColor="#e63946" />
        </radialGradient>
      </defs>
      <rect width="400" height="250" fill="url(#io-glow)" />
      <rect width="400" height="250" fill="url(#io-grid)" />
      {/* Territorio conquistado y rastro */}
      <path d="M0 160 H60 V140 H100 V180 H140 V250 H0Z" fill="#ffb703" opacity="0.85" />
      <path d="M140 200 H200 V150 H170" fill="none" stroke="#ffb703" strokeWidth="8" strokeDasharray="1 0" opacity="0.45" />
      <rect x="164" y="143" width="14" height="14" rx="3" fill="#ffd166" />
      {/* Partículas */}
      <g>
        {[
          [40, 40, '#ff6bd6'],
          [80, 90, '#7df9ff'],
          [130, 30, '#ffe66d'],
          [220, 60, '#9dff8a'],
          [250, 210, '#ff6bd6'],
          [300, 120, '#ffe66d'],
          [360, 200, '#7df9ff'],
          [190, 110, '#9dff8a'],
          [110, 120, '#ff9f68'],
          [340, 40, '#9dff8a'],
        ].map(([x, y, c]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="4" fill={c} />
        ))}
      </g>
      {/* Células */}
      <circle cx="262" cy="150" r="48" fill="url(#io-big)" />
      <circle cx="262" cy="150" r="48" fill="none" stroke="#ffd6d6" strokeWidth="3" opacity="0.6" />
      <circle cx="96" cy="66" r="22" fill="#4d96ff" />
      <circle cx="96" cy="66" r="22" fill="none" stroke="#cfe2ff" strokeWidth="2" opacity="0.6" />
      <circle cx="176" cy="84" r="17" fill="url(#io-player)" />
      <circle cx="176" cy="84" r="24" fill="none" stroke="#7df9ff" strokeWidth="2" strokeDasharray="4 5" />
      {/* Drones con estela */}
      <g fill="#ff4fd8">
        <path d="M352 76 l16 8 -16 8 4 -8z" />
        <path d="M330 30 l14 10 -17 4 5 -6z" />
      </g>
      <g stroke="#ff4fd8" strokeWidth="2" strokeLinecap="round" opacity="0.5">
        <line x1="322" y1="84" x2="348" y2="84" />
        <line x1="304" y1="30" x2="328" y2="38" />
      </g>
    </svg>
  );
}
