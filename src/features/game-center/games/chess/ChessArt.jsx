/** Ilustración original del ajedrez: esquina de tablero en perspectiva con caballo y rey propios. */
const TILE = 46;

function tile(col, row) {
  // Proyección oblicua sencilla: las filas se encogen y desplazan hacia el fondo.
  const depth = (r) => 1 - r * 0.11;
  const y = (r) => 250 - r * TILE * 0.62 - (r * (r - 1) * 2);
  const x = (c, r) => 200 + (c - 3.5) * TILE * depth(r);
  const p = [
    [x(col, row), y(row)],
    [x(col + 1, row), y(row)],
    [x(col + 1, row + 1), y(row + 1)],
    [x(col, row + 1), y(row + 1)],
  ];
  return p.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(' ');
}

export function ChessArt({ className }) {
  return (
    <svg className={className} viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="ch-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1f2a24" />
          <stop offset="1" stopColor="#0f1612" />
        </linearGradient>
      </defs>
      <rect width="400" height="250" fill="url(#ch-bg)" />
      {Array.from({ length: 5 }, (_, row) =>
        Array.from({ length: 8 }, (_, col) => (
          <polygon key={`${row}-${col}`} points={tile(col, row)} fill={(row + col) % 2 ? '#e9dcc0' : '#4f7a5e'} />
        )),
      )}
      {/* Rey negro al fondo, con sombra */}
      <g transform="translate(236 40) scale(1.25)">
        <ellipse cx="50" cy="74" rx="22" ry="4" fill="#000" opacity="0.3" />
        <g fill="#1d1a24" stroke="#c9a86a" strokeWidth="2.5" strokeLinejoin="round">
          <path d="M47 10 H53 V16 H59 V22 H53 V28 H47 V22 H41 V16 H47Z" />
          <path d="M50 30 C66 30 70 40 64 54 H36 C30 40 34 30 50 30Z" />
          <path d="M36 58 H64 L66 70 H34Z" />
          <rect x="32" y="68" width="36" height="6" rx="2" />
        </g>
      </g>
      {/* Caballo blanco en primer plano */}
      <g transform="translate(64 78) scale(1.9)">
        <ellipse cx="50" cy="74" rx="22" ry="4" fill="#000" opacity="0.35" />
        <g fill="#fbf6ea" stroke="#2b2522" strokeWidth="2.5" strokeLinejoin="round">
          <path d="M36 70 C36 56 44 50 48 44 L36 46 C30 46 28 40 32 36 L48 22 C52 18 56 16 60 16 L62 22 C70 28 72 40 68 52 L66 70Z" />
          <rect x="32" y="68" width="36" height="6" rx="2" />
        </g>
        <circle cx="52" cy="30" r="2.6" fill="#2b2522" />
      </g>
      {/* Marca de jugada posible */}
      <circle cx="304" cy="208" r="9" fill="#c9a86a" opacity="0.85" />
    </svg>
  );
}
