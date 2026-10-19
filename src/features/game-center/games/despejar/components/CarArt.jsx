/**
 * Coche visto desde arriba para «Despejar el estacionamiento». Ocupa toda la
 * caja del botón (su casilla del tablero) y mira hacia su dirección de salida:
 * parabrisas y faros delante, luna y pilotos detrás. El color sale de la
 * variable CSS `--hue` del botón, así cada coche conserva su tono.
 *
 * Se dibuja en horizontal mirando a la derecha (largo L × ancho 100) y se gira
 * con una transformación según `dir`; no deforma la carrocería.
 */
const TRANSFORM = {
  right: () => undefined,
  left: (L) => `translate(${L} 100) rotate(180)`,
  up: (L) => `translate(0 ${L}) rotate(-90)`,
  down: () => 'translate(100 0) rotate(90)',
};

export function CarArt({ length, dir, uid }) {
  const L = length * 100;
  const horizontal = dir === 'left' || dir === 'right';
  const viewBox = horizontal ? `0 0 ${L} 100` : `0 0 100 ${L}`;
  const id = `jm${uid}`;
  // Habitáculo más largo en los coches de tres casillas (furgonetas).
  const cabinStart = length > 2 ? L * 0.18 : L * 0.28;
  const cabinEnd = L * 0.74;
  return (
    <svg className="jm-car__art" viewBox={viewBox} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}b`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" style={{ stopColor: 'hsl(var(--hue) 60% 38%)' }} />
          <stop offset="0.2" style={{ stopColor: 'hsl(var(--hue) 75% 62%)' }} />
          <stop offset="0.55" style={{ stopColor: 'hsl(var(--hue) 78% 58%)' }} />
          <stop offset="0.85" style={{ stopColor: 'hsl(var(--hue) 70% 50%)' }} />
          <stop offset="1" style={{ stopColor: 'hsl(var(--hue) 60% 34%)' }} />
        </linearGradient>
        <linearGradient id={`${id}g`} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#d6efff" />
          <stop offset="0.5" stopColor="#6f9cc2" />
          <stop offset="1" stopColor="#2d4865" />
        </linearGradient>
      </defs>
      <g transform={TRANSFORM[dir]?.(L)}>
        {/* Ruedas que asoman */}
        {[L * 0.16, L - L * 0.16 - 22].map((x) => (
          <g key={x}>
            <rect x={x} y="4" width="22" height="14" rx="5" fill="#16151c" />
            <rect x={x} y="82" width="22" height="14" rx="5" fill="#16151c" />
          </g>
        ))}
        {/* Carrocería */}
        <rect x="5" y="10" width={L - 10} height="80" rx="26" fill={`url(#${id}b)`} stroke="rgb(20 15 30 / 0.55)" strokeWidth="3" />
        {/* Capó y maletero */}
        <path d={`M${L * 0.84} 22 Q${L * 0.8} 50 ${L * 0.84} 78`} stroke="rgb(0 0 0 / 0.18)" strokeWidth="2.5" fill="none" />
        <path d={`M${L * 0.12} 22 Q${L * 0.15} 50 ${L * 0.12} 78`} stroke="rgb(0 0 0 / 0.18)" strokeWidth="2.5" fill="none" />
        {/* Habitáculo: lunas y techo */}
        <rect x={cabinStart} y="18" width={cabinEnd - cabinStart} height="64" rx="16" fill="#1d2433" />
        <path d={`M${cabinEnd - 16} 24 L${cabinEnd + 6} 18 L${cabinEnd + 6} 82 L${cabinEnd - 16} 76 Z`} fill={`url(#${id}g)`} />
        <path d={`M${cabinStart + 14} 26 L${cabinStart - 2} 20 L${cabinStart - 2} 80 L${cabinStart + 14} 74 Z`} fill={`url(#${id}g)`} opacity="0.85" />
        <rect x={cabinStart + 16} y="26" width={cabinEnd - cabinStart - 34} height="48" rx="10" style={{ fill: 'hsl(var(--hue) 70% 52%)' }} />
        <rect x={cabinStart + 22} y="30" width={(cabinEnd - cabinStart - 34) * 0.7} height="7" rx="3.5" fill="#fff" opacity="0.3" />
        <path d={`M${cabinEnd - 10} 30 L${cabinEnd - 4} 28 L${cabinEnd - 4} 52 L${cabinEnd - 10} 56 Z`} fill="#fff" opacity="0.55" />
        {/* Retrovisores */}
        <ellipse cx={cabinEnd - 8} cy="9" rx="7" ry="5" style={{ fill: 'hsl(var(--hue) 60% 38%)' }} />
        <ellipse cx={cabinEnd - 8} cy="91" rx="7" ry="5" style={{ fill: 'hsl(var(--hue) 60% 38%)' }} />
        {/* Faros delante, pilotos detrás */}
        <rect x={L - 16} y="18" width="8" height="16" rx="4" fill="#fff6c9" />
        <rect x={L - 16} y="66" width="8" height="16" rx="4" fill="#fff6c9" />
        <rect x="8" y="18" width="7" height="16" rx="3" fill="#e8364f" />
        <rect x="8" y="66" width="7" height="16" rx="3" fill="#e8364f" />
      </g>
    </svg>
  );
}
