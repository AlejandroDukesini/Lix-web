/** Ilustración original de HexaStack: un panal con torres de fichas de colores. */
const CELLS = [
  [200, 125, ['#5fd6a0', '#5fd6a0', '#5fd6a0', '#5fd6a0']],
  [148, 95, ['#ff7a7a', '#ff7a7a']],
  [252, 95, ['#5fb4ff', '#ffc65c', '#ffc65c', '#ffc65c']],
  [148, 155, ['#b28cff']],
  [252, 155, ['#5fd6a0', '#5fd6a0']],
  [200, 65, ['#ffc65c', '#5fb4ff', '#5fb4ff']],
  [200, 185, []],
  [96, 125, ['#ff8fd0', '#ff8fd0', '#ff8fd0']],
  [304, 125, []],
];
const SIDE = { '#ff7a7a': '#c4525a', '#ffc65c': '#c4903a', '#5fd6a0': '#3c9c73', '#5fb4ff': '#3b7fc0', '#b28cff': '#7d5cc2', '#ff8fd0': '#c25d98' };
const hex = (cx, cy, r) =>
  Array.from({ length: 6 }, (_, i) => `${(cx + r * Math.cos((Math.PI / 3) * i)).toFixed(1)},${(cy + r * Math.sin((Math.PI / 3) * i)).toFixed(1)}`).join(' ');

export function HexArt({ className }) {
  return (
    <svg className={className} viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <rect width="400" height="250" fill="#2a2440" />
      <circle cx="60" cy="40" r="80" fill="#3a3260" />
      <circle cx="350" cy="220" r="90" fill="#3a3260" />
      {CELLS.map(([cx, cy, stack]) => (
        <g key={`${cx}-${cy}`}>
          <polygon points={hex(cx, cy, 30)} fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" />
          {stack.map((color, i) => (
            <g key={i}>
              <polygon points={hex(cx, cy - i * 5 + 4, 26)} fill={SIDE[color]} />
              <polygon points={hex(cx, cy - i * 5, 26)} fill={color} stroke="rgba(0,0,0,0.15)" />
            </g>
          ))}
        </g>
      ))}
    </svg>
  );
}
