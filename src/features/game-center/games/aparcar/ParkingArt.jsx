/** Ilustración original de «Aparcar el carro»: un coche rojo entrando en su plaza. */
function Car({ x, y, color, angle = 0 }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle})`}>
      <rect x="-34" y="-16" width="68" height="32" rx="11" fill={color} />
      <rect x="-12" y="-12" width="30" height="24" rx="7" fill="rgba(255,255,255,0.2)" />
      <rect x="14" y="-12" width="8" height="24" rx="3" fill="#bfe6ff" />
    </g>
  );
}

export function ParkingArt({ className }) {
  return (
    <svg className={className} viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <rect width="400" height="250" fill="#4a4e5c" />
      {[60, 140, 220, 300, 380].map((x) => (
        <rect key={x} x={x - 2} y="10" width="4" height="96" fill="#d9dbe2" opacity="0.7" />
      ))}
      <Car x={100} y={58} color="#6f8fd6" angle={90} />
      <Car x={260} y={58} color="#e0a526" angle={90} />
      <Car x={340} y={58} color="#58b38a" angle={90} />
      <rect x="146" y="12" width="68" height="92" rx="4" fill="rgba(92,227,154,0.2)" stroke="#5ce39a" strokeWidth="4" strokeDasharray="12 8" />
      <path d="M180 34 L196 56 L188 56 L188 82 L172 82 L172 56 L164 56 Z" fill="rgba(255,255,255,0.85)" />
      <rect y="120" width="400" height="10" fill="#d9dbe2" opacity="0.25" />
      {[20, 90, 160, 230, 300, 370].map((x) => (
        <rect key={x} x={x} y="176" width="40" height="5" rx="2" fill="#fff" opacity="0.6" />
      ))}
      <Car x={178} y={168} color="#ff5a6e" angle={-60} />
      {[44, 356].map((x) => (
        <g key={x}>
          <circle cx={x} cy="214" r="10" fill="#ff7a1a" />
          <circle cx={x} cy="214" r="5" fill="#fff" />
        </g>
      ))}
    </svg>
  );
}
