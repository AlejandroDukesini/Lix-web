import { CasesArt } from './CasesArt.jsx';
import { CASES } from './cases/cases.js';
import { MAX_STARS } from './engine/caseEngine.js';

export const resolverCasosManifest = {
  id: 'resolver-casos',
  phase: 2,
  title: 'Resolver casos',
  tagline: 'Pistas, declaraciones y una sola verdad.',
  description:
    'Casos cortos de investigación: examina el escenario, interroga a los implicados y descubre quién miente. Para cerrar el caso hay que señalar al culpable y la prueba que desmiente su versión.',
  categories: ['logica', 'aventura'],
  Art: CasesArt,
  palette: { a: '#d63c4b', b: '#c8a272' },
  facts: [`${CASES.length} casos`, 'Sin tiempo límite', `Hasta ${MAX_STARS} estrellas por caso`],
  objective: 'Resolver cada caso señalando al culpable y la prueba que desmiente su declaración. Cada caso resuelto abre el siguiente.',
  howTo: [
    'Toca los objetos del escenario para examinarlos: las pistas van al expediente.',
    'Interroga a cada persona. A veces lo que cuentan trae una pista nueva.',
    'Busca la declaración que no encaja con una prueba, y las coartadas que descartan al resto.',
    'Para acusar necesitas las pistas importantes: no se resuelve adivinando.',
    'Fallar o pedir ayuda cuesta una estrella, pero nunca borra lo investigado.',
  ],
  controls: {
    keyboard: [
      ['Tab y Enter', 'Examinar objetos, interrogar y elegir'],
      ['Clic', 'Lo mismo con el ratón'],
    ],
    touch: [
      ['Toca un objeto', 'Examinarlo'],
      ['Pestañas Escena · Expediente · Resolver', 'Cambiar de vista en el móvil'],
    ],
  },
  difficulty: 'De un caso de cocina a un misterio en el faro, en orden creciente.',
  load: () => import('./ResolverCasos.jsx'),
  progress(record) {
    const solved = record?.progress?.solved ?? {};
    const done = CASES.filter((c) => solved[c.id]).length;
    return { done, total: CASES.length, label: `${done}/${CASES.length} casos` };
  },
  highlight(record) {
    const solved = record?.progress?.solved ?? {};
    const stars = CASES.reduce((sum, c) => sum + (solved[c.id] ?? 0), 0);
    return stars ? `${stars} de ${CASES.length * MAX_STARS} estrellas` : null;
  },
};
