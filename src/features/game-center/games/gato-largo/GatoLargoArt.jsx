/** Ilustración original de «Gato largo»: un gato naranja estirado en zigzag por el salón. */
export function GatoLargoArt({ className }) {
  const body = 'M70 205 H170 V95 H250 V45 H340 V160';
  return (
    <svg className={className} viewBox="0 0 400 250" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <defs>
        <pattern id="lc-art-planks" width="120" height="30" patternUnits="userSpaceOnUse">
          <rect width="120" height="30" fill="#e9c999" />
          <path d="M0 29 H120 M70 0 V30" stroke="#d3ad78" strokeWidth="2" />
        </pattern>
      </defs>
      <rect width="400" height="250" fill="url(#lc-art-planks)" />
      <rect x="40" y="40" width="90" height="70" rx="18" fill="#d98fa6" />
      <rect x="196" y="160" width="70" height="60" rx="6" fill="#c8a06a" />
      <ellipse cx="300" cy="215" rx="34" ry="22" fill="#5fae5a" />
      <path d={body} fill="none" stroke="#f6a04d" strokeWidth="40" strokeLinecap="round" strokeLinejoin="round" />
      <path d={body} fill="none" stroke="#e07a2a" strokeWidth="32" strokeDasharray="6 22" strokeLinejoin="round" opacity="0.7" />
      <path d="M70 205 q-30 -4 -32 -26 q0 -10 8 -12" fill="none" stroke="#f0913a" strokeWidth="12" strokeLinecap="round" />
      <g transform="translate(340 168)">
        <path d="M-24 -6 L-22 -34 L-6 -18 Z M24 -6 L22 -34 L6 -18 Z" fill="#f0913a" />
        <ellipse rx="28" ry="25" fill="#f6a04d" />
        <ellipse cy="9" rx="13" ry="9" fill="#fff3e0" />
        <ellipse cx="-10" cy="-2" rx="4" ry="6" fill="#3a2a20" />
        <ellipse cx="10" cy="-2" rx="4" ry="6" fill="#3a2a20" />
        <path d="M-3 6 L3 6 L0 10 Z" fill="#e8737f" />
      </g>
    </svg>
  );
}
