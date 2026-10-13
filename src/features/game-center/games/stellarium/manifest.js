import { StellariumArt } from './StellariumArt.jsx';
import { CONSTELLATIONS, DEEP_SKY, STARS } from './data/catalog.js';

const TOTAL = CONSTELLATIONS.length + DEEP_SKY.length + 1;

export const stellariumManifest = {
  id: 'stellarium',
  phase: 4,
  title: 'Stellarium',
  tagline: 'Un pequeño observatorio para explorar el cielo nocturno.',
  description: `Recorre la esfera celeste con un telescopio: ${STARS.length} estrellas reales con su color, distancia y posición, ${CONSTELLATIONS.length} constelaciones por identificar, la Vía Láctea en su lugar y ${DEEP_SKY.length} objetos de cielo profundo. Centra cada figura en la retícula para anotarla en la bitácora. Con la fecha de inicio configurada, muestra además dónde estaba el Sol y cómo era la Luna aquel día. Inspirado en el planetario libre Stellarium.`,
  categories: ['exploracion'],
  Art: StellariumArt,
  palette: { a: '#ffd68c', b: '#7a8cff' },
  facts: [`${STARS.length} estrellas reales`, `${CONSTELLATIONS.length} constelaciones`, 'Sin prisa: solo explorar'],
  objective: `Completar la bitácora: identificar las ${CONSTELLATIONS.length} constelaciones, observar los ${DEEP_SKY.length} objetos de cielo profundo… y encontrar un asterismo que no está en ningún catálogo.`,
  howTo: [
    'Arrastra el cielo para moverte y acerca o aleja con la rueda, los botones o pellizcando. Con mucho aumento se ve por el ocular.',
    'Toca una estrella o un objeto para ver su ficha: magnitud, distancia, color y posición.',
    'Una constelación se identifica al centrarla en la retícula roja y verla entera. La bitácora tiene pistas para cada una.',
    'Los botones de abajo muestran las figuras, los nombres, la cuadrícula con la eclíptica y la Vía Láctea.',
    'El botón del Sol enseña el cielo del día de inicio configurado (Sol y fase de la Luna, calculados).',
  ],
  controls: {
    keyboard: [
      ['Arrastrar o flechas', 'Mover el cielo'],
      ['Rueda o + / −', 'Aumento'],
      ['Clic', 'Seleccionar un objeto'],
      ['Esc', 'Cerrar la ficha'],
    ],
    touch: [
      ['Arrastrar', 'Mover el cielo'],
      ['Pellizcar', 'Aumento'],
      ['Tocar', 'Seleccionar un objeto'],
    ],
  },
  difficulty: 'Sin derrota ni reloj: de las figuras evidentes (Orión, el Carro) a las del cielo austral.',
  load: () => import('./Stellarium.jsx'),
  progress(record) {
    const found = record?.progress?.found ?? {};
    const done = Object.keys(found).length;
    return { done: Math.min(done, TOTAL), total: TOTAL, label: `${Math.min(done, TOTAL)}/${TOTAL} descubrimientos` };
  },
  highlight(record) {
    const found = record?.progress?.found ?? {};
    const n = CONSTELLATIONS.filter((c) => found[c.id]).length;
    return n ? `${n} constelaciones identificadas` : null;
  },
};
