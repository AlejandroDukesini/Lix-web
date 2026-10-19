/**
 * Pixel art de «Reino de Ladrillos»: mapas de píxeles dibujados a mano (un
 * carácter = un píxel = una unidad del mundo) y su paleta. Se convierten en
 * sprites una sola vez y se copian sin suavizado: bordes nítidos a cualquier
 * escala, como en los plataformas clásicos, pero con contorno, luces y sombras.
 *
 * Todo es original: la exploradora de casco y bufanda rosa, el gorgojo, el
 * caracol y las losetas no copian ningún juego comercial.
 */

// ------------------------------------------------------------ exploradora

const HEAD = [
  '...oooooo...',
  '..oHHhhhhho.',
  '.oddhhhhhhho',
  '.ossssssesso',
  '.oSssssssrso',
  '..ooSssssoo.',
  '.oppppppppPo',
];

const SMALL_BODY = ['oppoCCCCCko.', '.PoCcccccko.', '..oCcgggcko.', '..okkkkkkko.'];
const SMALL_LEGS = {
  idle: ['...obo.obo..', '..obbo.obbo.', '..oBBo.oBBo.'],
  runA: ['..obo...obo.', '.obbo...obbo', '.oBBo...oBBo'],
  runB: ['....obbo....', '...obbbbo...', '...oBBBBo...'],
  jump: ['..obo..obo..', '.obbo..obbo.', '..oBo..oBo..'],
};

const BIG_BODY = [
  'oppoCCCCCko.',
  '.PoCcccccko.',
  '..oCcccccko.',
  '..oCccccckso',
  '..oCcccccko.',
  '..oCcgggcko.',
  '..oCcccccko.',
  '..oCcccccko.',
  '..oCcccccko.',
  '..okkkkkkko.',
  '...okkokko..',
];
const BIG_LEGS = {
  idle: ['...onnonno..', '...onnonno..', '...onNonNo..', '...onnonno..', '...obbobbo..', '..obbbobbbo.', '..obbbobbbo.', '..oBBBoBBBo.'],
  runA: ['..onno.onno.', '..onno.onno.', '.onno...onno', '.oNno...oNno', '.obbo...obbo', 'obbbo...obbo', 'obbbo...obbo', 'oBBBo...oBBo'],
  runB: ['...onnnno...', '...onnnno...', '...onNnno...', '...onnnno...', '...obbbbo...', '..obbbbbbo..', '..obbbbbbo..', '..oBBBBBBo..'],
  jump: ['..onno.onno.', '..onno.onno.', '.onno..onno.', '.oNno..oNno.', '.obbo..obbo.', '.obbo..obbo.', '.oBBo..oBBo.', '............'],
};

/** Variación de la bufanda al correr: la punta ondea arriba o abajo. */
const flutter = (rows, up) => (up ? rows : [rows[0].replace(/^opp/, '.pp'), rows[1].replace(/^\.P/, 'pP'), ...rows.slice(2)]);

export function playerFrame(big, pose) {
  const legs = (big ? BIG_LEGS : SMALL_LEGS)[pose] ?? (big ? BIG_LEGS : SMALL_LEGS).idle;
  const body = flutter(big ? BIG_BODY : SMALL_BODY, pose !== 'runB');
  return [...HEAD, ...body, ...legs];
}

export const PLAYER_PALETTE = {
  o: '#2a1a2a',
  h: '#f2b632',
  H: '#ffe08a',
  d: '#b47a14',
  s: '#ffd9b8',
  S: '#e9a782',
  e: '#2a1a2a',
  r: '#ff9a9a',
  p: '#ff6fa8',
  P: '#c94780',
  c: '#2f8f9d',
  C: '#5cc4d2',
  k: '#1d5f69',
  g: '#f4d9a0',
  n: '#3b4a7a',
  N: '#2b365c',
  b: '#5a3a60',
  B: '#2a1a2a',
};

// ------------------------------------------------------------ enemigos

const WEEVIL_BODY = [
  '....oooooo....',
  '..ooVVVvvvoo..',
  '.oVVVvvvvvvvo.',
  '.oVvvvvuvvvvuo',
  'ovvvvvvuvvvvuo',
  'owwwvvvuvvwwwo',
  'owewvvvuvvwewo',
  'owwwvvvuvvwwwo',
  'ovvvvvvuvvvvuo',
  '.ouvvvvuvvvuo.',
  '..ouuuuuuuuo..',
  '...oooooooo...',
];
export const WEEVIL = [
  [...WEEVIL_BODY, '..ll......ll..', '.ll........ll.'],
  [...WEEVIL_BODY, '...ll....ll...', '...ll....ll...'],
];
export const WEEVIL_FLAT = ['..oooooooooo..', '.ovvvvvvvvvvo.', 'owwevvvvvvweuo', 'oooooooooooooo'];
export const WEEVIL_PALETTE = { o: '#2a1a2a', v: '#7b4fc0', V: '#b48cf0', u: '#4a2a74', w: '#ffffff', e: '#1a0f1a', l: '#2a1a2a' };

export const SNAIL = [
  [
    'o.o...........',
    'g.g...oooooo..',
    'gg.g.oSSsssso.',
    '.ggg.oSsrrrsso',
    '.gegoSsrsssrso',
    '.gggosrsrrsrso',
    '.gggosrsrsrsso',
    '.gggosrssrrsso',
    '.gggosrrrrssso',
    '.gggoSsssssso.',
    '.gggGoooooooo.',
    '.GGGGGGGGGGGGo',
    'oGGGGGGGGGGGGo',
    '.oooooooooooo.',
  ],
  [
    '.o.o..........',
    '.g.g..oooooo..',
    '.gg.g.SSsssso.',
    '..ggooSsrrrsso',
    '..gegoSrsssrso',
    '..ggosrsrrsrso',
    '..ggosrsrsrsso',
    '..ggosrssrrsso',
    '..ggosrrrrssso',
    '..ggoSsssssso.',
    '.gggGoooooooo.',
    '.GGGGGGGGGGGGo',
    'oGGGGGGGGGGGGo',
    '.oooooooooooo.',
  ],
];
export const SHELL = [
  '..............',
  '....oooooo....',
  '...oSSsssso...',
  '..oSsrrrssso..',
  '.oSsrsssrsso..',
  '.osrsrrsrsso..',
  '.osrsrsrssso..',
  '.osrssrrssso..',
  '.osrrrrsssso..',
  '.oSssssssso...',
  '..oooooooo....',
  '..............',
  '..............',
  '..............',
];
export const SNAIL_PALETTE = { o: '#2a1a2a', s: '#ff9f43', S: '#ffd08a', r: '#a3561c', g: '#9be37a', G: '#5fae4a', e: '#1a0f1a' };

// ------------------------------------------------------------ losetas

export const BLOCK = [
  '.oooooooooooooo.',
  'oYYYYYYYYYYYYYYo',
  'oYqyyyyyyyyyyqzo',
  'oYyyyyyySyyyyyzo',
  'oYyyyyySSSyyyyzo',
  'oYySSSSSSSSSyyzo',
  'oYyySSSSSSSyyyzo',
  'oYyyySSSSSyyyyzo',
  'oYyySSSySSSyyyzo',
  'oYySSyyyyySSyyzo',
  'oYyyyyyyyyyyyyzo',
  'oYyyyyyyyyyyyyzo',
  'oYyyyyyyyyyyyyzo',
  'oYqyyyyyyyyyyqzo',
  'ozzzzzzzzzzzzzzo',
  '.oooooooooooooo.',
];

export const BRICK = [
  'LLLLLLLmLLLLLLLm',
  'RRRRRRrmRRRRRRrm',
  'RRRRRRrmRRRRRRrm',
  'RRRRRRrmRRRRRRrm',
  'RRRRRRrmRRRRRRrm',
  'RRRRRRrmRRRRRRrm',
  'rrrrrrrmrrrrrrrm',
  'mmmmmmmmmmmmmmmm',
  'LLLmLLLLLLLmLLLL',
  'RRrmRRRRRRrmRRRR',
  'RRrmRRRRRRrmRRRR',
  'RRrmRRRRRRrmRRRR',
  'RRrmRRRRRRrmRRRR',
  'RRrmRRRRRRrmRRRR',
  'rrrmrrrrrrrmrrrr',
  'mmmmmmmmmmmmmmmm',
];

export const GROUND_TOP = [
  'GGGGGGGGGGGGGGGG',
  'GHGGGGGHGGGGGGHG',
  'GGGGHGGGGGGHGGGG',
  'gGgGGgGGGgGGgGGg',
  'dgdDdgDDdgDDdgDd',
  'DdDDDDDDDdDDDDDD',
  'DDDlDDDDDDDDDlDD',
  'DDDDDDdDDDDDDDDD',
  'DDDDDDDDDDDDdDDD',
  'DlDDDDDDDlDDDDDD',
  'DDDDdDDDDDDDDDDD',
  'DDDDDDDDDDDdDDlD',
  'DDDDDDDlDDDDDDDD',
  'DDdDDDDDDDDDDDDD',
  'DDDDDDDDDDDDDDDD',
  'DDDDDDDDDdDDDDDD',
];

export const GROUND = [
  'DDDDDDDDDDDDDDDD',
  'DDDDdDDDDDDDDlDD',
  'DlDDDDDDDdDDDDDD',
  'DDDDDDDDDDDDDDDD',
  'DDDDDDlDDDDDdDDD',
  'DDdDDDDDDDDDDDDD',
  'DDDDDDDDDlDDDDDD',
  'DDDDDDDDDDDDDDdD',
  'DDDlDDDDDDDDDDDD',
  'DDDDDDDdDDDDDDDD',
  'DDDDDDDDDDDDlDDD',
  'DdDDDDDDDDDDDDDD',
  'DDDDDDDDDdDDDDDD',
  'DDDDlDDDDDDDDDDD',
  'DDDDDDDDDDDDDdDD',
  'DDDDDDDDDDDDDDDD',
];

export const HARD = [
  'LLLLLLLLLLLLLLLd',
  'LllllllllllllldD',
  'LllllllllllllldD',
  'LlllDDlllllllldD',
  'LllllllllllllldD',
  'LllllllllllDllDd',
  'LllllllllllllldD',
  'LlllllllllllllDD',
  'LllllllDDllllldD',
  'LllllllllllllldD',
  'LllllllllllllldD',
  'LlDlllllllllllDD',
  'LllllllllllllldD',
  'LllllllllllllldD',
  'LdddddddddddddDD',
  'dDDDDDDDDDDDDDDD',
];

export const COIN = [
  ['...oooo...', '..oYYYYo..', '.oYyyyyzo.', 'oYyYyyyyzo', 'oYyYyyyyzo', 'oYyYyyyyzo', 'oYyYyyyyzo', 'oYyYyyyyzo', 'oYyyyyyyzo', '.oyyyyyzo.', '..ozzzzo..', '...oooo...'],
  ['....oo....', '...oYYo...', '..oYyyzo..', '..oYyYzo..', '..oYyYzo..', '..oYyYzo..', '..oYyYzo..', '..oYyYzo..', '..oYyyzo..', '..oyyyzo..', '...ozzo...', '....oo....'],
  ['....oo....', '....oo....', '....Yo....', '....Yo....', '....Yo....', '....Yo....', '....Yo....', '....Yo....', '....Yo....', '....Yo....', '....oo....', '....oo....'],
];
export const COIN_PALETTE = { o: '#7a4a12', Y: '#fff6c0', y: '#ffd23f', z: '#e0951c' };

export const HEART = [
  '.ooo..ooo...',
  'oppPoopppo..',
  'opWpppppppo.',
  'oppppppppPo.',
  'oppppppppPo.',
  '.opppppppo..',
  '..opppppo...',
  '...opppo....',
  '....opo.....',
  '.....o......',
];
export const HEART_PALETTE = { o: '#7a1235', p: '#ff4f8b', P: '#d12f6b', W: '#ffffff' };

// ------------------------------------------------------------ utilidades

/** Pinta un mapa de píxeles (filas de caracteres) en `ctx` con la paleta dada. */
export function paintPixels(ctx, rows, palette, flip = false) {
  const w = rows[0].length;
  for (let y = 0; y < rows.length; y += 1) {
    const row = rows[y];
    for (let x = 0; x < row.length; x += 1) {
      const color = palette[row[x]];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(flip ? w - 1 - x : x, y, 1, 1);
    }
  }
}

/** Sprite de un mapa de píxeles, en caché (1 px de sprite = 1 unidad del mundo). */
export function pixelSprite(cache, key, rows, palette, flip = false) {
  return cache.get(key, rows[0].length, rows.length, (ctx) => paintPixels(ctx, rows, palette, flip), 1);
}
