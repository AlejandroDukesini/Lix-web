import { HexArt } from './HexArt.jsx';
import { CHALLENGES } from './levels/levels.js';
import { CLEAR_SIZE } from './engine/hexEngine.js';

export const hexastackManifest = {
  id: 'hexastack',
  phase: 3,
  title: 'HexaStack',
  tagline: 'Apila, junta colores y despeja el panal.',
  description: `Coloca pilas de fichas hexagonales en un panal. Las vecinas con el mismo color arriba se juntan, y al reunir ${CLEAR_SIZE} fichas de un color desaparecen. Las cadenas multiplican los puntos. Partida libre y ${CHALLENGES.length} desafíos.`,
  categories: ['logica', 'habilidad'],
  Art: HexArt,
  palette: { a: '#5fd6a0', b: '#b28cff' },
  facts: [`${CHALLENGES.length} desafíos + partida libre`, 'Cadenas y rachas', 'Récord de puntos'],
  objective: `Despejar fichas reuniendo ${CLEAR_SIZE} del mismo color sin que se llene el tablero. En los desafíos, alcanzar el objetivo de fichas despejadas.`,
  howTo: [
    'Elige una de las tres pilas y colócala en una celda vacía.',
    'Las pilas vecinas con el mismo color arriba le pasan esas fichas; las de debajo se quedan.',
    `Con ${CLEAR_SIZE} fichas del mismo color arriba, se despejan. Una fusión puede provocar otra: la cadena multiplica los puntos.`,
    'Jugadas seguidas que despejan forman una racha con puntos extra. Si el tablero se llena, se acaba.',
  ],
  controls: {
    keyboard: [
      ['Clic en una pila', 'Elegirla (o teclas 1, 2, 3)'],
      ['Pasar el ratón por el tablero', 'Ver dónde caería y qué se juntaría'],
      ['Clic en una celda vacía', 'Colocar'],
      ['Arrastrar una pila', 'Colocar al soltar'],
      ['R · Esc o P', 'Reiniciar · Pausa'],
    ],
    touch: [
      ['Toca una pila', 'Elegirla'],
      ['Toca una celda vacía', 'Ver la previsualización'],
      ['Toca de nuevo la misma celda', 'Colocar'],
      ['Arrastra una pila al tablero', 'Colocar al soltar'],
    ],
  },
  difficulty: 'De un panal pequeño con tres colores a seis colores y celdas bloqueadas.',
  load: () => import('./HexaStack.jsx'),
  progress(record) {
    const completed = record?.progress?.completed ?? {};
    const done = CHALLENGES.filter((c) => completed[c.id]).length;
    return { done, total: CHALLENGES.length, label: `${done}/${CHALLENGES.length} desafíos` };
  },
  highlight(record) {
    const best = record?.best?.['score:libre'];
    return Number.isFinite(best) ? `Récord libre: ${best.toLocaleString('es')} puntos` : null;
  },
};
