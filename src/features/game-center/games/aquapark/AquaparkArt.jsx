/** Ilustración original de Aquapark: un tobogán en S que cae a una piscina, bajo el sol. */
export function AquaparkArt({ className }) {
  return (
    <svg className={className} viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="aq-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4cc9f0" />
          <stop offset="0.7" stopColor="#bdf1ff" />
        </linearGradient>
        <linearGradient id="aq-pool" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1fb6d9" />
          <stop offset="1" stopColor="#0a6c98" />
        </linearGradient>
        <linearGradient id="aq-rim" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff5d8f" />
          <stop offset="1" stopColor="#ffbe3d" />
        </linearGradient>
        <radialGradient id="aq-sun" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fffbe6" />
          <stop offset="0.55" stopColor="#ffe9a3" />
          <stop offset="1" stopColor="#ffe9a3" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="250" fill="url(#aq-sky)" />
      <circle cx="322" cy="56" r="52" fill="url(#aq-sun)" />
      <circle cx="322" cy="56" r="20" fill="#fffbe6" />
      {/* Colinas y palmeras lejanas */}
      <path d="M0 172 Q60 140 120 160 T250 150 T400 156 V250 H0Z" fill="#2a9d8f" opacity="0.55" />
      <g stroke="#1d6f66" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.7">
        <path d="M352 158 Q350 132 356 112" />
        <path d="M356 112 q-16 -4 -26 6 M356 112 q14 -8 26 -2 M356 112 q-6 -14 -20 -16 M356 112 q8 -14 22 -12" />
      </g>
      {/* Estructura del tobogán */}
      <g stroke="#f4f1ea" strokeWidth="5" opacity="0.85">
        <line x1="92" y1="70" x2="92" y2="200" />
        <line x1="170" y1="118" x2="170" y2="205" />
        <line x1="250" y1="104" x2="250" y2="200" />
      </g>
      <rect x="62" y="48" width="56" height="10" rx="3" fill="#f4f1ea" />
      {/* Piscina */}
      <path d="M0 196 Q200 178 400 196 V250 H0Z" fill="url(#aq-pool)" />
      <g fill="none" stroke="#bff3ff" strokeWidth="2" opacity="0.7">
        <ellipse cx="318" cy="214" rx="34" ry="6" />
        <ellipse cx="318" cy="214" rx="54" ry="11" opacity="0.5" />
        <path d="M30 222 q14 -5 28 0 t28 0" />
        <path d="M150 232 q14 -5 28 0 t28 0" />
      </g>
      {/* Tobogán: borde de color, agua dentro y corriente */}
      <path id="aq-slide" d="M70 54 C150 50 150 118 96 128 C40 140 70 196 170 176 C250 160 210 110 268 108 C330 106 330 170 318 206" fill="none" stroke="url(#aq-rim)" strokeWidth="30" strokeLinecap="round" />
      <path d="M70 54 C150 50 150 118 96 128 C40 140 70 196 170 176 C250 160 210 110 268 108 C330 106 330 170 318 206" fill="none" stroke="#3fd0f2" strokeWidth="18" strokeLinecap="round" />
      <path d="M70 54 C150 50 150 118 96 128 C40 140 70 196 170 176 C250 160 210 110 268 108 C330 106 330 170 318 206" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeDasharray="10 14" strokeLinecap="round" opacity="0.8" />
      {/* Deslizador en su flotador */}
      <g transform="translate(236 128) rotate(-18)">
        <ellipse cx="0" cy="6" rx="15" ry="7" fill="#ffd166" stroke="#e76f51" strokeWidth="3" />
        <circle cx="0" cy="-6" r="6.5" fill="#4a2c2a" />
        <path d="M-9 -1 L-16 -10 M9 -1 L16 -10" stroke="#4a2c2a" strokeWidth="3" strokeLinecap="round" />
      </g>
      {/* Salpicaduras */}
      <g fill="#ffffff">
        <circle cx="300" cy="196" r="4" />
        <circle cx="334" cy="190" r="3" />
        <circle cx="312" cy="184" r="2.5" />
        <circle cx="326" cy="200" r="2" />
      </g>
    </svg>
  );
}
