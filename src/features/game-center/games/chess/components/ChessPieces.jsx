/**
 * Piezas de ajedrez originales, dibujadas para este proyecto en SVG.
 * Siluetas geométricas sobre una base común; cada bando con su propio relleno
 * y contorno para que se lean bien sobre casillas claras y oscuras.
 */
const SHAPES = {
  p: (
    <>
      <circle cx="50" cy="34" r="12" />
      <path d="M38 50 Q50 42 62 50 L66 70 H34Z" />
    </>
  ),
  r: (
    <>
      <path d="M30 22 H38 V30 H46 V22 H54 V30 H62 V22 H70 V40 L64 46 V70 H36 V46 L30 40Z" />
    </>
  ),
  n: (
    <>
      <path d="M36 70 C36 56 44 50 48 44 L36 46 C30 46 28 40 32 36 L48 22 C52 18 56 16 60 16 L62 22 C70 28 72 40 68 52 L66 70Z" />
      <circle cx="52" cy="30" r="3" className="piece__eye" />
    </>
  ),
  b: (
    <>
      <circle cx="50" cy="18" r="5" />
      <path d="M50 24 C62 32 64 44 58 54 H42 C36 44 38 32 50 24Z" />
      <path d="M50 30 L56 40" className="piece__cut" />
      <path d="M40 58 H60 L64 70 H36Z" />
    </>
  ),
  q: (
    <>
      <circle cx="30" cy="26" r="5" />
      <circle cx="43" cy="20" r="5" />
      <circle cx="57" cy="20" r="5" />
      <circle cx="70" cy="26" r="5" />
      <path d="M30 32 L38 56 H62 L70 32 L58 44 L50 26 L42 44Z" />
      <path d="M36 58 H64 L66 70 H34Z" />
    </>
  ),
  k: (
    <>
      <path d="M47 10 H53 V16 H59 V22 H53 V28 H47 V22 H41 V16 H47Z" />
      <path d="M50 30 C66 30 70 40 64 54 H36 C30 40 34 30 50 30Z" />
      <path d="M36 58 H64 L66 70 H34Z" />
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

export function ChessPiece({ piece, className }) {
  const type = piece.toLowerCase();
  const white = piece !== type;
  return (
    <svg
      viewBox="0 0 100 80"
      className={`piece ${white ? 'piece--white' : 'piece--black'} ${className ?? ''}`}
      aria-hidden="true"
      focusable="false"
    >
      <ellipse cx="50" cy="74" rx="22" ry="4" className="piece__shadow" />
      <g className="piece__body">
        {SHAPES[type]}
        <rect x="32" y="68" width="36" height="6" rx="2" />
      </g>
    </svg>
  );
}
