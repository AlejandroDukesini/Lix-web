/** Ilustración original de «Sudokus»: un tablero con números a tinta y a lápiz. */
const GIVENS = '5..7.3...9...1..8.2.6...4.....8..1.7';

export function SudokuArt({ className }) {
  const size = 22;
  const x0 = 102;
  const y0 = 26;
  return (
    <svg className={className} viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <rect width="400" height="250" fill="#eceaff" />
      <circle cx="340" cy="40" r="70" fill="#d9dcff" />
      <circle cx="40" cy="220" r="60" fill="#ffe3c2" />
      <rect x={x0 - 6} y={y0 - 6} width={size * 9 + 12} height={size * 9 + 12} rx="10" fill="#2d2a3a" />
      <rect x={x0} y={y0} width={size * 9} height={size * 9} fill="#fffdf7" />
      {[3, 4, 5].map((r) =>
        [0, 1, 2, 3, 4, 5, 6, 7, 8].map((c) => <rect key={`h${r}-${c}`} x={x0 + c * size} y={y0 + r * size} width={size} height={size} fill="#eef0ff" />),
      )}
      <rect x={x0 + 4 * size} y={y0 + 4 * size} width={size} height={size} fill="#b9beff" />
      {Array.from({ length: 10 }, (_, k) => (
        <g key={k} stroke="#2d2a3a" strokeWidth={k % 3 === 0 ? 2.5 : 0.6}>
          <line x1={x0} y1={y0 + k * size} x2={x0 + 9 * size} y2={y0 + k * size} />
          <line x1={x0 + k * size} y1={y0} x2={x0 + k * size} y2={y0 + 9 * size} />
        </g>
      ))}
      {[...GIVENS].map((ch, i) =>
        ch === '.' ? null : (
          <text key={i} x={x0 + ((i * 2) % 9) * size + size / 2} y={y0 + Math.floor(i / 4.5) * size + size * 0.72} textAnchor="middle" fontSize="15" fontWeight={i % 3 ? 800 : 600} fill={i % 3 ? '#23202b' : '#4b46d1'} fontFamily="sans-serif">
            {ch}
          </text>
        ),
      )}
      <g transform="translate(330 168) rotate(35)">
        <rect x="-6" y="-60" width="12" height="90" rx="3" fill="#f2b417" />
        <path d="M-6 30 L0 46 L6 30 Z" fill="#f2d3b3" />
        <rect x="-6" y="-66" width="12" height="10" rx="3" fill="#ff7ab6" />
      </g>
    </svg>
  );
}
