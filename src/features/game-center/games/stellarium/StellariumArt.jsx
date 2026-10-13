/** Ilustración original de Stellarium: Orión visto por el ocular, con su nebulosa y la retícula. */
const ORION = {
  betelgeuse: [150, 70, 4.5, '#ffb07a'],
  bellatrix: [235, 82, 3, '#aabfff'],
  mintaka: [222, 135, 2.6, '#9bb0ff'],
  alnilam: [200, 142, 2.8, '#aabfff'],
  alnitak: [178, 150, 2.7, '#9bb0ff'],
  saiph: [160, 215, 2.8, '#aabfff'],
  rigel: [250, 205, 4.2, '#aabfff'],
};
const LINES = [['betelgeuse', 'bellatrix'], ['betelgeuse', 'alnitak'], ['bellatrix', 'mintaka'], ['mintaka', 'alnilam'], ['alnilam', 'alnitak'], ['alnitak', 'saiph'], ['mintaka', 'rigel']];
const DUST = Array.from({ length: 60 }, (_, i) => [(i * 97) % 400, (i * 53) % 250, i % 5 ? 0.7 : 1.3]);

export function StellariumArt({ className }) {
  return (
    <svg className={className} viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="st-sky" cx="0.5" cy="0.4">
          <stop offset="0" stopColor="#1a2150" />
          <stop offset="1" stopColor="#05060f" />
        </radialGradient>
        <radialGradient id="st-neb">
          <stop offset="0" stopColor="#ff8ab8" stopOpacity="0.7" />
          <stop offset="1" stopColor="#7ab8ff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="st-mw" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#c8ceff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#c8ceff" stopOpacity="0.18" />
          <stop offset="1" stopColor="#c8ceff" stopOpacity="0" />
        </linearGradient>
        <mask id="st-eye">
          <rect width="400" height="250" fill="#fff" />
          <circle cx="200" cy="125" r="112" fill="#000" />
        </mask>
      </defs>
      <rect width="400" height="250" fill="url(#st-sky)" />
      <path d="M-20 240 L420 10 L420 70 L-20 300 Z" fill="url(#st-mw)" />
      {DUST.map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill="#e8ecff" opacity="0.6" />
      ))}
      <ellipse cx="190" cy="180" rx="22" ry="16" fill="url(#st-neb)" />
      {LINES.map(([a, b]) => (
        <line key={a + b} x1={ORION[a][0]} y1={ORION[a][1]} x2={ORION[b][0]} y2={ORION[b][1]} stroke="#ffd68c" strokeOpacity="0.55" strokeWidth="1.4" />
      ))}
      {Object.entries(ORION).map(([k, [x, y, r, c]]) => (
        <g key={k}>
          <circle cx={x} cy={y} r={r * 3} fill={c} opacity="0.18" />
          <circle cx={x} cy={y} r={r} fill={c} />
        </g>
      ))}
      <rect width="400" height="250" fill="#020308" opacity="0.88" mask="url(#st-eye)" />
      <circle cx="200" cy="125" r="112" fill="none" stroke="#a0aad2" strokeOpacity="0.5" strokeWidth="3" />
      <circle cx="200" cy="125" r="12" fill="none" stroke="#ff7878" strokeOpacity="0.6" />
      <path d="M200 99 V107 M200 143 V151 M174 125 H182 M218 125 H226" stroke="#ff7878" strokeOpacity="0.6" />
    </svg>
  );
}
