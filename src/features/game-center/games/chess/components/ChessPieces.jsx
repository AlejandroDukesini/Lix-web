/**
 * Piezas de ajedrez originales, dibujadas para este proyecto en SVG.
 * Siluetas de estilo Staunton sobre una peana común; marfil y ébano con un
 * degradado lateral que les da volumen (los degradados se definen una sola vez
 * en <ChessPieceDefs />). Contorno propio por bando para que se lean bien
 * sobre casillas claras y oscuras.
 */
const BASE = 'M31 63 H69 Q72 63 72 66 V70 Q72 74 68 74 H32 Q28 74 28 70 V66 Q28 63 31 63Z';
const COLLAR = (y) => `M37 ${y} H63 Q65 ${y + 2.5} 62 ${y + 4.5} H38 Q35 ${y + 2.5} 37 ${y}Z`;

const SHAPES = {
  p: (
    <>
      <circle cx="50" cy="21" r="10" />
      <path d={COLLAR(31)} />
      <path d="M42 35.5 H58 Q57 48 66 63 H34 Q43 48 42 35.5Z" />
    </>
  ),
  r: (
    <>
      <path d="M33 9 H41 V15 H46.5 V9 H53.5 V15 H59 V9 H67 V24 Q67 27 63 28 H37 Q33 27 33 24Z" />
      <path d="M38 28 H62 V55 Q63 59 67 63 H33 Q37 59 38 55Z" />
      <path d="M38 52 H62" className="piece__cut" />
    </>
  ),
  n: (
    <>
      <path d="M35 63 C35 52 41 46 45.5 40 C40 42 33 44 29.5 40.5 C25.5 36.5 29 31 35 26.5 C39.5 23 41 16 47 12 L48.5 5 L54 11 C66 13 72.5 27 70.5 42 C69.5 51 67 57 67 63Z" />
      <path d="M53 13 C60 18 64 28 63 40" className="piece__cut" />
      <circle cx="45" cy="22" r="2.6" className="piece__eye" />
    </>
  ),
  b: (
    <>
      <circle cx="50" cy="8" r="4" />
      <path d="M50 12.5 C62 20 64.5 31 58.5 40 H41.5 C35.5 31 38 20 50 12.5Z" />
      <path d="M52.5 19 L46.5 29" className="piece__cut" />
      <path d={COLLAR(40)} />
      <path d="M43 44.5 H57 Q57.5 55 66 63 H34 Q42.5 55 43 44.5Z" />
    </>
  ),
  q: (
    <>
      <path d="M30 23 L38 45 L40 17 L47 41 L50 13 L53 41 L60 17 L62 45 L70 23 L64 52 H36Z" />
      <circle cx="30" cy="21" r="3.6" />
      <circle cx="40" cy="15" r="3.6" />
      <circle cx="50" cy="10.5" r="3.8" />
      <circle cx="60" cy="15" r="3.6" />
      <circle cx="70" cy="21" r="3.6" />
      <path d={COLLAR(51)} />
      <path d="M39.5 55.5 H60.5 Q61.5 60 67 63 H33 Q38.5 60 39.5 55.5Z" />
    </>
  ),
  k: (
    <>
      <path d="M47 3 H53 V8 H58 V13.5 H53 V19 H47 V13.5 H42 V8 H47Z" />
      <path d="M50 20 C64 20 70.5 30 66.5 42 L62.5 51 H37.5 L33.5 42 C29.5 30 36 20 50 20Z" />
      <path d="M39 30 Q50 25 61 30" className="piece__cut" />
      <path d={COLLAR(51)} />
      <path d="M39.5 55.5 H60.5 Q61.5 60 67 63 H33 Q38.5 60 39.5 55.5Z" />
    </>
  ),
};

// [nombre, femenino]: la dama y la torre concuerdan en femenino ("torre blanca").
const NAMES = { p: ['peón', false], r: ['torre', true], n: ['caballo', false], b: ['alfil', false], q: ['dama', true], k: ['rey', false] };

export function pieceLabel(piece) {
  const white = piece === piece.toUpperCase();
  const [name, feminine] = NAMES[piece.toLowerCase()];
  const color = white ? (feminine ? 'blanca' : 'blanco') : feminine ? 'negra' : 'negro';
  return `${name} ${color}`;
}

/** Degradados compartidos por todas las piezas (se monta una vez por partida). */
export function ChessPieceDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="chess-ivory" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#d8ccb2" />
          <stop offset="0.32" stopColor="#fffbf0" />
          <stop offset="0.62" stopColor="#f1e7d2" />
          <stop offset="1" stopColor="#b9a888" />
        </linearGradient>
        <linearGradient id="chess-ebony" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#15121a" />
          <stop offset="0.3" stopColor="#4a4252" />
          <stop offset="0.6" stopColor="#272230" />
          <stop offset="1" stopColor="#0c0a0f" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function ChessPiece({ piece, className, style }) {
  const type = piece.toLowerCase();
  const white = piece !== type;
  return (
    <svg
      viewBox="20 0 60 80"
      className={`piece ${white ? 'piece--white' : 'piece--black'} ${className ?? ''}`}
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      <ellipse cx="50" cy="75" rx="24" ry="4" className="piece__shadow" />
      <g className="piece__body">
        {SHAPES[type]}
        <path d={BASE} />
      </g>
    </svg>
  );
}
