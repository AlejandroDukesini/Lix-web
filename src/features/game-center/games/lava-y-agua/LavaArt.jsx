/** Ilustración original de Lava y Agua: un río de lava frenado por agua que se vuelve piedra. */
const C = 34;
const MAP = [
  '##########',
  '#LLL.....#',
  '#LLSS.P..#',
  '#L.SWW...#',
  '#..SWW..E#',
  '##########',
];
const FILL = { '#': '#2a2026', '.': '#3a2f35', L: 'url(#lv-lava)', S: '#7c808b', W: 'url(#lv-water)', P: '#3a2f35', E: '#3a2f35' };

export function LavaArt({ className }) {
  return (
    <svg className={className} viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="lv-lava" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffb347" />
          <stop offset="1" stopColor="#d6301a" />
        </linearGradient>
        <linearGradient id="lv-water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7fd0ff" />
          <stop offset="1" stopColor="#1f6fd1" />
        </linearGradient>
        <radialGradient id="lv-exit">
          <stop offset="0" stopColor="#fffbe0" />
          <stop offset="0.5" stopColor="#9be7ff" />
          <stop offset="1" stopColor="#9be7ff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="250" fill="#170f13" />
      <g transform="translate(30 23)">
        {MAP.map((row, y) =>
          [...row].map((ch, x) => <rect key={`${x}-${y}`} x={x * C + 1} y={y * C + 1} width={C - 2} height={C - 2} rx="6" fill={FILL[ch]} />),
        )}
        <path d="M108 80 l10 12 l-6 10 M112 116 l8 8" stroke="#3e4049" strokeWidth="2" fill="none" />
        <circle cx={8 * C + C / 2} cy={4 * C + C / 2} r="16" fill="url(#lv-exit)" />
        <circle cx={6 * C + C / 2} cy={2 * C + C / 2} r="11" fill="#ffe7a6" stroke="#1a0f16" strokeWidth="3" />
        <circle cx={6 * C + C / 2} cy={2 * C + C / 2} r="20" fill="#ffd9a0" opacity="0.18" />
      </g>
    </svg>
  );
}
