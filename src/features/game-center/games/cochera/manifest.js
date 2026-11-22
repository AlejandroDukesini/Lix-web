import { CocheraArt } from './CocheraArt.jsx';
import { LEVELS, TIERS } from './levels/levels.js';

export const cocheraManifest = {
  id: 'cochera',
  phase: 5,
  badge: 'new',
  title: 'Salida de la cochera',
  tagline: 'Abre paso al microbús dorado: los pasajeros esperan.',
  description: `Una cochera de autobuses llena a la hora de salida. Coches y autobuses solo se deslizan por su carril; muévelos para despejar la fila del microbús dorado y que llegue a la parada. ${LEVELS.length} niveles en ${TIERS.length} dificultades, cada uno con su mínimo de movimientos calculado. Inspirado en los rompecabezas de tráfico y de sacar el autobús; tablero, niveles y gráficos propios.`,
  categories: ['logica', 'estrategia'],
  Art: CocheraArt,
  palette: { a: '#f2b417', b: '#2f7be0' },
  scene: 'day',
  facts: [`${LEVELS.length} niveles con solución`, 'Mínimo de movimientos calculado', 'Deshacer ilimitado y pistas'],
  objective: 'Llevar el microbús dorado hasta la salida de la derecha. Tres estrellas si lo logras en el mínimo de movimientos y sin pistas.',
  howTo: [
    'Cada vehículo solo se desliza por su eje: los horizontales a izquierda y derecha, los verticales arriba y abajo.',
    'Nadie atraviesa a otro vehículo ni a los bolardos.',
    'Arrastrar un vehículo varias casillas de una vez cuenta como un solo movimiento.',
    'Cuando la fila del microbús queda libre, llévalo hasta la salida.',
    'La pista calcula el mejor siguiente paso (con pista, máximo dos estrellas).',
  ],
  controls: {
    keyboard: [
      ['Tab', 'Elegir vehículo'],
      ['Flechas', 'Moverlo una casilla por su carril'],
      ['Z o Retroceso', 'Deshacer'],
      ['H · R', 'Pista · Reiniciar'],
      ['Esc o P', 'Pausa'],
    ],
    touch: [
      ['Arrastra un vehículo', 'Deslizarlo por su carril'],
      ['Suelta', 'Encaja en la casilla más cercana'],
    ],
  },
  difficulty: 'Fácil (3–7 movimientos), Medio (8–14), Difícil (15–24) y Avanzado (de 25 a casi 50).',
  load: () => import('./Cochera.jsx'),
  progress(record) {
    const completed = record?.progress?.completed ?? {};
    const done = LEVELS.filter((l) => completed[l.id]).length;
    return { done, total: LEVELS.length, label: `${done}/${LEVELS.length} niveles` };
  },
  highlight(record) {
    const completed = record?.progress?.completed ?? {};
    const stars = LEVELS.reduce((sum, l) => sum + (completed[l.id] ?? 0), 0);
    return stars ? `${stars} de ${LEVELS.length * 3} estrellas` : null;
  },
};
