/**
 * Vehículos vistos desde arriba, siempre dibujados en horizontal (morro a la
 * derecha); los verticales se giran con CSS. Medidas en unidades de casilla
 * (100 por casilla) para que el dibujo escale con el tablero.
 */
export const VEHICLE_COLORS = ['#e5533d', '#2f7be0', '#2fa36b', '#8e5bd6', '#f08c2a', '#1fb3b0', '#e05a9a', '#5c6b7a', '#c9a227', '#3b4fb8', '#a8503a', '#6aa84f'];

function Car({ color, w }) {
  return (
    <>
      <rect x="6" y="10" width={w - 12} height="80" rx="22" fill={color} />
      <rect x="6" y="10" width={w - 12} height="80" rx="22" fill="url(#ch-sheen)" />
      <rect x={w * 0.56} y="20" width={w * 0.2} height="60" rx="10" fill="#bfe3f5" opacity="0.95" />
      <rect x={w * 0.2} y="22" width={w * 0.16} height="56" rx="9" fill="#9fcde4" opacity="0.9" />
      <rect x={w * 0.36} y="20" width={w * 0.2} height="60" rx="6" fill="rgb(0 0 0 / 0.12)" />
      <rect x={w - 14} y="16" width="6" height="16" rx="3" fill="#fff6c8" />
      <rect x={w - 14} y="68" width="6" height="16" rx="3" fill="#fff6c8" />
      <rect x="8" y="18" width="5" height="14" rx="2" fill="#ff8a7a" />
      <rect x="8" y="68" width="5" height="14" rx="2" fill="#ff8a7a" />
    </>
  );
}

function Bus({ color, w, golden }) {
  const windows = Math.round((w - 70) / 46);
  return (
    <>
      <rect x="5" y="8" width={w - 10} height="84" rx="16" fill={color} />
      <rect x="5" y="8" width={w - 10} height="84" rx="16" fill="url(#ch-sheen)" />
      {/* Techo: rejillas de ventilación y franja */}
      <rect x="20" y="40" width={w - 52} height="20" rx="6" fill="rgb(255 255 255 / 0.22)" />
      {Array.from({ length: windows }, (_, i) => (
        <rect key={i} x={26 + i * 46} y="16" width="34" height="10" rx="4" fill="#bfe3f5" opacity="0.85" />
      ))}
      {Array.from({ length: windows }, (_, i) => (
        <rect key={`b${i}`} x={26 + i * 46} y="74" width="34" height="10" rx="4" fill="#bfe3f5" opacity="0.85" />
      ))}
      <rect x={w - 26} y="14" width="16" height="72" rx="7" fill="#9fcde4" />
      <rect x={w - 9} y="16" width="4" height="14" rx="2" fill="#fff6c8" />
      <rect x={w - 9} y="70" width="4" height="14" rx="2" fill="#fff6c8" />
      {golden && (
        <path
          d={`M${w / 2 - 6} 38 l6 -12 l6 12 l13 2 l-9 9 l2 13 l-12 -6 l-12 6 l2 -13 l-9 -9 z`}
          transform={`translate(0 2)`}
          fill="#fff7d1"
          stroke="#a8740d"
          strokeWidth="2"
        />
      )}
    </>
  );
}

export function VehicleArt({ len, color, golden, uid }) {
  const w = len * 100;
  return (
    <svg viewBox={`0 0 ${w} 100`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="ch-sheen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.18" />
        </linearGradient>
      </defs>
      <g data-uid={uid}>{len >= 3 || golden ? <Bus color={color} w={w} golden={golden} /> : <Car color={color} w={w} />}</g>
    </svg>
  );
}
