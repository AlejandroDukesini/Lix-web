import { VehicleArt } from './components/VehicleArt.jsx';

/** Ilustración original de «Salida de la cochera»: el microbús dorado encara la salida entre autobuses. */
const PIECES = [
  { x: 96, y: 26, w: 2, h: 1, color: '#2f7be0' },
  { x: 230, y: 26, w: 1, h: 3, color: '#2fa36b', len: 3 },
  { x: 96, y: 120, w: 2, h: 1, golden: true },
  { x: 274, y: 70, w: 1, h: 2, color: '#e5533d' },
  { x: 140, y: 168, w: 3, h: 1, color: '#8e5bd6', len: 3 },
  { x: 96, y: 168, w: 1, h: 2, color: '#f08c2a' },
];
const CELL = 44;

export function CocheraArt({ className }) {
  return (
    <svg className={className} viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <rect width="400" height="250" fill="#dfe8d6" />
      <rect x="84" y="14" width="288" height="224" rx="14" fill="#8e959e" />
      <rect x="92" y="22" width="272" height="208" rx="6" fill="#a4abb4" />
      <rect x="360" y="116" width="16" height="48" fill="#a4abb4" />
      <path d="M100 141 H360" stroke="#f2b417" strokeWidth="4" strokeDasharray="14 10" opacity="0.7" />
      <circle cx="388" cy="128" r="6" fill="#e86a5a" />
      <circle cx="388" cy="146" r="6" fill="#3f7fd8" />
      {PIECES.map((p, i) => {
        const len = p.len ?? Math.max(p.w, p.h);
        const vertical = p.h > p.w;
        const w = (vertical ? len : len) * CELL - 6;
        return (
          <g key={i} transform={vertical ? `translate(${p.x + CELL - 3} ${p.y + 3}) rotate(90)` : `translate(${p.x + 3} ${p.y + 3})`}>
            <foreignObject width={w} height={CELL - 6}>
              <div style={{ width: '100%', height: '100%' }}>
                <VehicleArt len={len} color={p.color} golden={p.golden} uid={`art-${i}`} />
              </div>
            </foreignObject>
          </g>
        );
      })}
    </svg>
  );
}
