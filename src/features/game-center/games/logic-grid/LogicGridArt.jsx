/** Ilustración original del juego de lógica: un tablero a medio pintar y la ficha deslizándose. */
const COLS = 7;
const ROWS = 4;
// Mismo lenguaje que el juego: '#' muro, 'p' pintada, '.' por pintar.
const MAP = ['p p p p p # .', '# # # # p # .', '. . . # p p p', '. . . . . . p'].map((row) => row.split(' '));

export function LogicGridArt({ className }) {
  const size = 40;
  const gap = 6;
  const left = (400 - (COLS * size + (COLS - 1) * gap)) / 2;
  const top = (250 - (ROWS * size + (ROWS - 1) * gap)) / 2;
  const at = (c, r) => ({ x: left + c * (size + gap), y: top + r * (size + gap) });
  const ball = at(6, 3);
  return (
    <svg className={className} viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="lg-paint" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7c5cff" />
          <stop offset="1" stopColor="#ff7ab6" />
        </linearGradient>
        <pattern id="lg-dots" width="14" height="14" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.3" fill="#d8d1c2" />
        </pattern>
      </defs>
      <rect width="400" height="250" fill="#f6f2ea" />
      <rect width="400" height="250" fill="url(#lg-dots)" />
      {MAP.map((row, r) =>
        row.map((cell, c) => {
          const { x, y } = at(c, r);
          if (cell === '#') return <rect key={`${r}-${c}`} x={x} y={y} width={size} height={size} rx="8" fill="#2d2a3e" />;
          return (
            <rect
              key={`${r}-${c}`}
              x={x}
              y={y}
              width={size}
              height={size}
              rx="8"
              fill={cell === 'p' ? 'url(#lg-paint)' : '#ffffff'}
              stroke={cell === 'p' ? 'none' : '#d9d2c3'}
              strokeWidth="2"
            />
          );
        }),
      )}
      {/* Estela del último deslizamiento */}
      <path
        d={`M${at(4, 2).x + 20} ${at(4, 2).y + 20} H${at(6, 2).x + 20} V${ball.y + 8}`}
        fill="none"
        stroke="#ffffff"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray="2 8"
      />
      <circle cx={ball.x + 22} cy={ball.y + 24} r="13" fill="#2d2a3e" opacity="0.18" />
      <circle cx={ball.x + 20} cy={ball.y + 20} r="13" fill="#ffffff" stroke="#2d2a3e" strokeWidth="3" />
      <circle cx={ball.x + 16} cy={ball.y + 16} r="3.5" fill="#2d2a3e" opacity="0.2" />
    </svg>
  );
}
