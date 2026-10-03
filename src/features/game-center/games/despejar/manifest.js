import { JamArt } from './JamArt.jsx';
import { LEVELS } from './levels/levels.js';

export const despejarManifest = {
  id: 'despejar',
  phase: 2,
  title: 'Despejar el estacionamiento',
  tagline: 'Cada coche, a su salida. ¿En qué orden?',
  description:
    'Un aparcamiento abarrotado: cada coche solo puede avanzar hacia donde marca su flecha, y solo sale por una salida de su fila o columna. Sácalos todos sin cerrar el paso a los demás.',
  categories: ['logica', 'estrategia'],
  Art: JamArt,
  palette: { a: '#5ce39a', b: '#ffb347' },
  facts: [`${LEVELS.length} niveles`, 'Todos con solución comprobada', 'Deshacer ilimitado'],
  objective: 'Vaciar el aparcamiento: sacar todos los coches por las salidas marcadas en el borde.',
  howTo: [
    'Cada coche avanza solo en su eje y hacia su flecha; nunca hacia atrás.',
    'Sale únicamente por una salida (hueco con flecha verde) de su fila o columna, con el camino libre.',
    'Arrastra para elegir cuánto avanza, o toca para que avance todo lo que pueda (o salga).',
    'Si un coche se queda cerrando el paso para siempre, el juego te avisa: deshaz y prueba otro orden.',
  ],
  controls: {
    keyboard: [
      ['Tab', 'Elegir coche'],
      ['Intro o Espacio', 'Avanzar todo lo posible o salir'],
      ['Flecha en su dirección', 'Avanzar una casilla'],
      ['Z o Retroceso', 'Deshacer'],
      ['R', 'Reiniciar nivel'],
    ],
    touch: [
      ['Arrastra un coche', 'Moverlo en su eje, hacia su flecha'],
      ['Toca un coche', 'Avanzar todo lo posible o salir'],
    ],
  },
  difficulty: 'De 5×5 con pocos coches a 7×7 con pilares y muchos coches que dependen unos de otros.',
  load: () => import('./Despejar.jsx'),
  progress(record) {
    const completed = record?.progress?.completed ?? {};
    const done = LEVELS.filter((l) => completed[l.id]).length;
    return { done, total: LEVELS.length, label: `${done}/${LEVELS.length} niveles` };
  },
  highlight(record) {
    const completed = record?.progress?.completed ?? {};
    const done = LEVELS.filter((l) => completed[l.id]).length;
    return done ? `${done} de ${LEVELS.length} aparcamientos despejados` : null;
  },
};
