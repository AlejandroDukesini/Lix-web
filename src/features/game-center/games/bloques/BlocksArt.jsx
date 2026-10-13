/** Ilustración original de Bloques que caen: teselas de vidrio que encajan bajo un cielo estrellado. */
const S = 24;
const OX = 140;
const OY = 34;
// Pila del fondo con un hueco; la fila 3 acaba de completarse (estela).
const STACK = ['.....', '...##', '#..##', '##.##', '####.'];
const COLORS = ['#6c8cff', '#ff6f91', '#6ee7a8', '#ffa45c', '#b48cff'];
const STARS = [[30, 30], [70, 80], [40, 160], [90, 210], [350, 40], [320, 150], [370, 190], [300, 220], [110, 40], [380, 100]];

function Tile({ x, y, color }) {
  return (
    <g>
      <rect x={x + 1.5} y={y + 1.5} width="21" height="21" rx="5" fill={color} />
      <rect x={x + 5} y={y + 4} width="10" height="3.5" rx="1.7" fill="#fff" opacity="0.35" />
    </g>
  );
}

export function BlocksArt({ className }) {
  return (
    <svg className={className} viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="bq-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b1030" />
          <stop offset="1" stopColor="#2a1d5c" />
        </linearGradient>
        <linearGradient id="bq-trail" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff6d0" stopOpacity="0" />
          <stop offset="1" stopColor="#fff6d0" stopOpacity="0.95" />
        </linearGradient>
      </defs>
      <rect width="400" height="250" fill="url(#bq-sky)" />
      {STARS.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={i % 3 ? 1.2 : 2} fill="#e8ecff" opacity="0.7" />
      ))}
      <rect x={OX - 6} y={OY - 30} width={S * 5 + 12} height="250" rx="10" fill="#080a20" opacity="0.8" stroke="#a0afff" strokeOpacity="0.35" strokeWidth="2" />
      <rect x={OX - 70} y={OY + S * 3 + 6} width={S * 5 + 70} height="12" rx="6" fill="url(#bq-trail)" />
      <circle cx={OX + S * 5 - 2} cy={OY + S * 3 + 12} r="5" fill="#fffbe6" />
      {[1, 2, 3].map((c) => (
        <Tile key={c} x={OX + S * c} y={OY - 10} color="#b48cff" />
      ))}
      <Tile x={OX + S * 2} y={OY + S - 10} color="#b48cff" />
      {STACK.map((row, r) => [...row].map((ch, c) => (ch === '#' ? <Tile key={`${r}-${c}`} x={OX + c * S} y={OY + S * (r + 4)} color={COLORS[(r + c) % COLORS.length]} /> : null)))}
      <rect x="290" y="60" width="74" height="74" rx="12" fill="#ffffff" opacity="0.07" stroke="#bec8ff" strokeOpacity="0.25" />
      <Tile x={303} y={88} color="#5ee6ff" />
      <Tile x={327} y={88} color="#5ee6ff" />
      <Tile x={303} y={64 + 48} color="#5ee6ff" />
    </svg>
  );
}
