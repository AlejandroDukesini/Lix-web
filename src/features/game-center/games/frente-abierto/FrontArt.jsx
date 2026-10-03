/** Ilustración original de Frente Abierto: una isla de territorios con bandos y frentes. */
const R = 24;
const CELLS = [];
for (let q = -3; q <= 3; q += 1) {
  for (let r = Math.max(-3, -q - 3); r <= Math.min(3, -q + 3); r += 1) CELLS.push([q, r]);
}
const ownerColor = ([q, r]) => {
  if (q + r / 2 < -1.2) return '#5fb4ff';
  if (q + r / 2 > 1.2) return '#ff6f6f';
  if (r < -1) return '#ffc65c';
  return null;
};
const hex = (cx, cy, rad) =>
  Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 30);
    return `${(cx + rad * Math.cos(a)).toFixed(1)},${(cy + rad * Math.sin(a)).toFixed(1)}`;
  }).join(' ');

export function FrontArt({ className }) {
  return (
    <svg className={className} viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <rect width="400" height="250" fill="#1d3550" />
      <path d="M0 200 Q100 180 200 210 T400 195 V250 H0 Z" fill="#234263" />
      {CELLS.map(([q, r]) => {
        const x = 200 + R * Math.sqrt(3) * (q + r / 2);
        const y = 125 + R * 1.5 * r;
        const color = ownerColor([q, r]);
        return <polygon key={`${q},${r}`} points={hex(x, y, R * 0.95)} fill={color ?? '#8a9aa8'} opacity={color ? 1 : 0.45} stroke="#1d3550" strokeWidth="2" />;
      })}
      <path d="M128 112 h24 m-8 -8 l8 8 l-8 8" stroke="#fff" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M272 140 h-24 m8 -8 l-8 8 l8 8" stroke="#fff" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="117" cy="162" r="6" fill="#fff" stroke="#14141e" strokeWidth="2" />
      <circle cx="283" cy="88" r="6" fill="#fff" stroke="#14141e" strokeWidth="2" />
    </svg>
  );
}
