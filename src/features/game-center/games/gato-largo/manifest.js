import { GatoLargoArt } from './GatoLargoArt.jsx';
import { LEVELS, TIERS } from './levels/levels.js';

export const gatoLargoManifest = {
  id: 'gato-largo',
  phase: 5,
  badge: 'new',
  title: 'Gato largo',
  tagline: 'Un gato que se estira hasta llenar la habitación.',
  description: `El gato se despierta y se estira en línea recta hasta chocar con un mueble, la pared o su propio cuerpo. Elige bien hacia dónde: hay que llenar la habitación entera sin quedarse encerrado. ${LEVELS.length} habitaciones en ${TIERS.length} dificultades, todas con solución comprobada. Inspirado en el concepto de Longcat; habitaciones, gato y gráficos propios. Sustituye a «Cubrir el espacio».`,
  categories: ['logica', 'clasicos'],
  Art: GatoLargoArt,
  palette: { a: '#f0913a', b: '#d98fa6' },
  scene: 'day',
  facts: [`${LEVELS.length} habitaciones con solución`, 'Encoger ilimitado', 'Pistas'],
  objective: 'Que el cuerpo del gato ocupe todas las casillas libres de la habitación. Tres estrellas si lo logras sin encoger ni pedir pistas.',
  howTo: [
    'Elige una dirección: la cabeza avanza en línea recta y no se detiene hasta chocar.',
    'Las casillas que recorre quedan ocupadas por el cuerpo; el gato no puede cruzarse a sí mismo.',
    'Si ninguna dirección queda libre, el gato está atrapado: encoge el último estirón (deshacer).',
    'Los puntos del suelo marcan lo que falta por cubrir.',
    'La pista calcula hacia dónde estirarse (con pista, máximo dos estrellas).',
  ],
  controls: {
    keyboard: [
      ['Flechas o WASD', 'Estirarse'],
      ['Clic en una casilla', 'Estirarse hacia ella (en línea con la cabeza)'],
      ['Z o Retroceso', 'Encoger'],
      ['H · R', 'Pista · Reiniciar'],
      ['Esc o P', 'Pausa'],
    ],
    touch: [
      ['Desliza sobre la habitación', 'Estirarse en esa dirección'],
      ['Toca una casilla en línea', 'Estirarse hacia ella'],
      ['Cruceta', 'Estirarse con botones'],
    ],
  },
  difficulty: 'De habitaciones de 4 × 4 a salones de 7 × 8 con muebles que engañan.',
  load: () => import('./GatoLargo.jsx'),
  progress(record) {
    const completed = record?.progress?.completed ?? {};
    const done = LEVELS.filter((l) => completed[l.id]).length;
    return { done, total: LEVELS.length, label: `${done}/${LEVELS.length} habitaciones` };
  },
  highlight(record) {
    const completed = record?.progress?.completed ?? {};
    const stars = LEVELS.reduce((sum, l) => sum + (completed[l.id] ?? 0), 0);
    return stars ? `${stars} de ${LEVELS.length * 3} estrellas` : null;
  },
};
