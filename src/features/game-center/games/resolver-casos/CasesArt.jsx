/** Ilustración original de «Resolver casos»: un tablero de investigación con fotos, notas e hilo rojo. */
export function CasesArt({ className }) {
  const pins = [
    [92, 64],
    [214, 52],
    [318, 88],
    [140, 168],
    [268, 176],
  ];
  return (
    <svg className={className} viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <rect width="400" height="250" fill="#3a2a22" />
      <rect x="18" y="16" width="364" height="218" rx="10" fill="#c8a272" />
      {Array.from({ length: 40 }, (_, i) => (
        <circle key={i} cx={30 + ((i * 53) % 340)} cy={26 + ((i * 37) % 200)} r="1.4" fill="#a8824f" />
      ))}
      {/* Fotos y notas */}
      <g transform="rotate(-6 92 80)">
        <rect x="58" y="56" width="70" height="56" fill="#fff" />
        <rect x="64" y="62" width="58" height="38" fill="#7aa6c2" />
        <circle cx="93" cy="78" r="9" fill="#f2d3b3" />
      </g>
      <g transform="rotate(4 214 70)">
        <rect x="182" y="40" width="66" height="54" fill="#fff" />
        <rect x="188" y="46" width="54" height="36" fill="#c27a7a" />
        <circle cx="215" cy="62" r="8" fill="#f2d3b3" />
      </g>
      <rect x="290" y="70" width="62" height="50" fill="#fff59d" transform="rotate(-3 320 95)" />
      <rect x="110" y="150" width="62" height="46" fill="#fff59d" transform="rotate(5 140 170)" />
      <g transform="rotate(-4 268 180)">
        <rect x="236" y="154" width="66" height="54" fill="#fff" />
        <rect x="242" y="160" width="54" height="36" fill="#86b98a" />
        <text x="269" y="185" textAnchor="middle" fontSize="20" fontWeight="800" fill="#2b2522">?</text>
      </g>
      {/* Hilo rojo entre las pistas */}
      <polyline points={pins.map((p) => p.join(',')).join(' ')} fill="none" stroke="#d63c4b" strokeWidth="2.5" />
      {pins.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="5" fill="#d63c4b" stroke="#fff" strokeWidth="1.5" />
      ))}
      {/* Lupa */}
      <g transform="translate(322 178) rotate(-30)">
        <circle r="26" fill="rgba(200,230,255,0.35)" stroke="#2b2522" strokeWidth="7" />
        <rect x="-5" y="26" width="10" height="34" rx="4" fill="#2b2522" />
      </g>
    </svg>
  );
}
