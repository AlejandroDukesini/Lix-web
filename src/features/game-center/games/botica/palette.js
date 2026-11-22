/**
 * Tinturas de la botica. Cada una lleva además un símbolo, para que los colores
 * se distingan también sin depender del tono (daltonismo, pantallas con poco brillo).
 */
export const TINCTURES = Object.freeze({
  a: { name: 'amapola', color: '#e5484d', glyph: '●' },
  b: { name: 'cobalto', color: '#2f6fdf', glyph: '▲' },
  c: { name: 'azafrán', color: '#f4c21b', glyph: '■' },
  d: { name: 'menta', color: '#2fa860', glyph: '◆' },
  e: { name: 'violeta', color: '#8e4ec6', glyph: '★' },
  f: { name: 'mandarina', color: '#f08a24', glyph: '✚' },
  g: { name: 'rosa', color: '#ec6aad', glyph: '♥' },
  h: { name: 'turquesa', color: '#17b3ad', glyph: '◗' },
  i: { name: 'canela', color: '#93603d', glyph: '✿' },
  j: { name: 'lima', color: '#9ed238', glyph: '☾' },
  k: { name: 'cielo', color: '#79c4ff', glyph: '✦' },
  l: { name: 'pizarra', color: '#59606e', glyph: '▬' },
});

export const tinctureName = (id) => TINCTURES[id]?.name ?? id;
