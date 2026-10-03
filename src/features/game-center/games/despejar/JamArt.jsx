/** Ilustración original de «Despejar el estacionamiento»: coches apretados, cada uno con su flecha. */
const CARS = [
  { x: 108, y: 30, w: 92, h: 40, hue: 350, dir: 0 },
  { x: 208, y: 30, w: 40, h: 92, hue: 205, dir: 90 },
  { x: 256, y: 30, w: 92, h: 40, hue: 45, dir: 180 },
  { x: 108, y: 78, w: 40, h: 140, hue: 140, dir: 270 },
  { x: 156, y: 130, w: 140, h: 40, hue: 280, dir: 0 },
  { x: 304, y: 78, w: 40, h: 92, hue: 20, dir: 90 },
  { x: 156, y: 178, w: 92, h: 40, hue: 180, dir: 180 },
];

export function JamArt({ className }) {
  return (
    <svg className={className} viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <rect width="400" height="250" fill="#2b2d36" />
      <rect x="92" y="14" width="272" height="222" rx="14" fill="#9da3ad" />
      <rect x="104" y="26" width="248" height="198" rx="6" fill="#4a4e5c" />
      <rect x="352" y="130" width="14" height="40" fill="#4a4e5c" />
      <path d="M356 150 l6 -6 v12 z" fill="#5ce39a" />
      {CARS.map((car) => {
        const cx = car.x + car.w / 2;
        const cy = car.y + car.h / 2;
        return (
          <g key={`${car.x}-${car.y}`}>
            <rect x={car.x + 3} y={car.y + 3} width={car.w - 6} height={car.h - 6} rx="9" fill={`hsl(${car.hue} 70% 58%)`} />
            <circle cx={cx} cy={cy} r="10" fill="rgba(255,255,255,0.9)" />
            <path d={`M${cx - 4} ${cy - 5} L${cx + 5} ${cy} L${cx - 4} ${cy + 5}`} fill="none" stroke="#23202b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" transform={`rotate(${car.dir} ${cx} ${cy})`} />
          </g>
        );
      })}
    </svg>
  );
}
