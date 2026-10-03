/** Ilustración original de Traffic Rider: una moto entre el tráfico al atardecer. */
export function RiderArt({ className }) {
  return (
    <svg className={className} viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="tr-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff8a65" />
          <stop offset="1" stopColor="#ffd59a" />
        </linearGradient>
      </defs>
      <rect width="400" height="250" fill="url(#tr-sky)" />
      <circle cx="300" cy="62" r="22" fill="#ffe08a" />
      <rect y="92" width="400" height="158" fill="#e7c98f" />
      <path d="M182 92 L218 92 L370 250 L30 250 Z" fill="#5b5560" />
      <path d="M176 92 L182 92 L30 250 L14 250 Z" fill="#fff" />
      <path d="M218 92 L224 92 L386 250 L370 250 Z" fill="#fff" />
      {[0, 1, 2].map((k) => (
        <g key={k} fill="#fff6e2">
          <path d={`M${191 + k * 9} 100 L${193 + k * 9} 100 L${152 + k * 48} 140 L${148 + k * 48} 140 Z`} />
          <path d={`M${183 + k * 17} 170 L${188 + k * 17} 170 L${118 + k * 82} 230 L${110 + k * 82} 230 Z`} opacity="0.9" />
        </g>
      ))}
      <rect x="168" y="112" width="26" height="18" rx="5" fill="#5fb4ff" />
      <rect x="171" y="115" width="20" height="6" rx="2" fill="#2b3a67" opacity="0.6" />
      <rect x="212" y="102" width="18" height="13" rx="4" fill="#ffc65c" />
      <rect x="236" y="128" width="40" height="34" rx="6" fill="#eef0f5" />
      <rect x="240" y="152" width="8" height="4" rx="1" fill="#e5484d" />
      <rect x="264" y="152" width="8" height="4" rx="1" fill="#e5484d" />
      <g transform="translate(176 232) rotate(-8)">
        <ellipse cx="0" cy="0" rx="26" ry="5" fill="#000" opacity="0.25" />
        <rect x="-6" y="-30" width="12" height="30" rx="6" fill="#1f1d27" />
        <rect x="-14" y="-50" width="28" height="24" rx="9" fill="#ff5a6e" />
        <rect x="-12" y="-80" width="24" height="32" rx="10" fill="#2b3a67" />
        <circle cx="0" cy="-88" r="11" fill="#fff" />
        <rect x="-11" y="-91" width="22" height="4" fill="#5fb4ff" />
      </g>
    </svg>
  );
}
