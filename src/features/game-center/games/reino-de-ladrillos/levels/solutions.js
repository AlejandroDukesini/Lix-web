/**
 * Soluciones comprobadas de cada nivel (generadas con scripts/plan-ladrillos.mjs).
 * Entradas por fotograma, comprimidas: «máscara x fotogramas» (1 izquierda, 2 derecha, 4 salto).
 * Las pruebas las reproducen en el motor y exigen llegar al mástil sin perder vidas.
 */
export const SOLUTIONS = Object.freeze({
  pradera: '6x96,2x8,6x80,2x8,6x64,2x8,6x96,2x8,6x112,0x8,6x64,2x8,6x64,2x8,6x80,2x8,6x64,2x8,6x160,2x8,6x48,2x8,6x64,2x8,6x19,2x5,6x48,0x8,6x112,2x8,6x32,2x8,6x32,2x8,6x16,2x8,6x64,2x8,6x32,2x8',
  subsuelo: '6x64,2x8,6x80,2x16,6x48,2x8,6x64,2x8,6x48,2x8,6x32,2x8,6x144,0x8,6x128,2x8,6x64,2x8,6x48,2x8,6x48,2x8,6x96,2x8,6x48,0x8,6x80,2x8,6x80,2x8,6x48,2x8,6x64,2x8,6x19,2x5,6x64,2x8,6x32,2x8',
  copas: '6x80,2x8,6x48,2x8,6x64,2x8,6x32,2x8,6x128,2x8,6x112,2x8,6x19,2x5,6x160,2x8,6x19,2x5,6x32,2x8,6x80,2x8,6x32,2x8,6x80,2x8,6x32,2x8,6x32,1x8,6x80,2x8,6x112,2x8,6x48,2x8,6x48,2x8,6x16',
  castillo: '6x32,2x8,6x32,2x8,6x32,2x8,6x32,2x8,6x80,2x8,6x48,2x8,6x32,2x8,6x64,2x8,6x80,2x8,4x8,6x64,2x8,6x48,2x8,6x96,2x8,6x32,2x8,6x80,1x8,6x51,2x5,6x32,2x8,6x64,2x8,6x32,2x8,6x48,2x8,6x96,2x8,6x16,2x8,6x80,2x8,6x32,2x8',
});
