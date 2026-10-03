/** Ilustración original de «Pollo pasando la calle»: una gallina a punto de cruzar entre coches. */
export function ChickenArt({ className }) {
  return (
    <svg className={className} viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <rect width="400" height="250" fill="#74c560" />
      {/* Carretera de dos carriles */}
      <rect y="62" width="400" height="104" fill="#4a4e5c" />
      <rect y="62" width="400" height="4" fill="#c7c9d1" />
      <rect y="162" width="400" height="4" fill="#c7c9d1" />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <rect key={i} x={i * 56 + 10} y="112" width="32" height="4" rx="2" fill="#ffffff" opacity="0.75" />
      ))}
      {/* Río arriba */}
      <rect y="0" width="400" height="44" fill="#3aa7e3" />
      <rect x="40" y="10" width="120" height="26" rx="13" fill="#9a5b2e" />
      <rect x="240" y="10" width="96" height="26" rx="13" fill="#9a5b2e" />
      <rect y="44" width="400" height="18" fill="#7fcf6a" />
      {/* Coches */}
      <g>
        <rect x="40" y="72" width="78" height="34" rx="12" fill="#ff6f91" />
        <rect x="84" y="78" width="16" height="22" rx="4" fill="#bfe6ff" />
        <circle cx="114" cy="78" r="3" fill="#fff3b0" />
        <circle cx="114" cy="100" r="3" fill="#fff3b0" />
      </g>
      <g>
        <rect x="262" y="124" width="112" height="36" rx="8" fill="#eef0f5" />
        <rect x="222" y="126" width="44" height="32" rx="10" fill="#ffb347" />
        <rect x="228" y="132" width="14" height="20" rx="4" fill="#bfe6ff" />
        <circle cx="226" cy="130" r="3" fill="#fff3b0" />
        <circle cx="226" cy="154" r="3" fill="#fff3b0" />
      </g>
      {/* Flores */}
      {[[40, 205], [330, 220], [370, 190], [90, 232]].map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="5" fill="#ffd166" />
      ))}
      {/* La gallina */}
      <g transform="translate(200 206)">
        <ellipse cx="0" cy="22" rx="24" ry="7" fill="#000" opacity="0.15" />
        <path d="M-8 14 v10 M8 14 v10" stroke="#f08a24" strokeWidth="4" strokeLinecap="round" />
        <ellipse cx="0" cy="0" rx="25" ry="23" fill="#ffffff" />
        <ellipse cx="-6" cy="4" rx="12" ry="8" fill="#efe7da" transform="rotate(-18)" />
        <circle cx="-4" cy="-24" r="6" fill="#ef3e4a" />
        <circle cx="5" cy="-25" r="5.5" fill="#ef3e4a" />
        <circle cx="-12" cy="-21" r="5" fill="#ef3e4a" />
        <path d="M20 -8 q12 3 0 9 z" fill="#f7a325" />
        <circle cx="11" cy="-8" r="3.2" fill="#2b2522" />
      </g>
    </svg>
  );
}
