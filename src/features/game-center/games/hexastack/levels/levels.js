/**
 * Desafíos de HexaStack: cada uno cambia el tablero (radio y celdas bloqueadas),
 * los colores en juego y el objetivo de fichas que hay que despejar antes de
 * llenar el tablero. Las pruebas comprueban con un piloto automático que cada
 * objetivo se alcanza en la mayoría de las partidas (no dependen solo de la suerte).
 */
export const CHALLENGES = Object.freeze([
  { id: 'c1', name: 'Primer panal', radius: 2, colors: 3, target: 30, prefill: 2, blocked: [] },
  { id: 'c2', name: 'Tres colores', radius: 2, colors: 3, target: 60, prefill: 3, blocked: [] },
  { id: 'c3', name: 'Cuatro sabores', radius: 3, colors: 4, target: 80, prefill: 4, blocked: [] },
  { id: 'c4', name: 'El hueco', radius: 3, colors: 4, target: 100, prefill: 4, blocked: ['0,0'] },
  { id: 'c5', name: 'Columnas', radius: 3, colors: 4, target: 130, prefill: 5, blocked: ['0,-2', '0,2', '-2,1', '2,-1'] },
  { id: 'c6', name: 'Cinco colores', radius: 3, colors: 5, target: 120, prefill: 5, blocked: [] },
  { id: 'c7', name: 'Anillo', radius: 3, colors: 5, target: 150, prefill: 6, blocked: ['0,0', '1,0', '-1,0', '0,1', '0,-1', '1,-1', '-1,1'] },
  { id: 'c8', name: 'Maestro del panal', radius: 3, colors: 6, target: 180, prefill: 6, blocked: ['3,0', '-3,0', '0,3', '0,-3'] },
]);

/** Partida libre: tablero grande, cuatro colores, sin objetivo (récord de puntos). */
export const FREE_PLAY = Object.freeze({ id: 'libre', name: 'Partida libre', radius: 3, colors: 4, target: null, prefill: 4, blocked: [] });
