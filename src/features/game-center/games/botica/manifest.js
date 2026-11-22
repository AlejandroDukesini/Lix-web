import { BoticaArt } from './BoticaArt.jsx';
import { LEVELS, TIERS } from './levels/levels.js';

export const boticaManifest = {
  id: 'botica',
  phase: 5,
  badge: 'new',
  title: 'Botica de colores',
  tagline: 'Vierte las tinturas hasta que cada frasco guarde un solo color.',
  description: `En el estante de una botica antigua las tinturas se han mezclado. Vierte de un frasco a otro —solo sobre el mismo color o en un frasco vacío, y sin pasarte de su capacidad— hasta que cada frasco quede de un único color. ${LEVELS.length} niveles en ${TIERS.length} dificultades, todos con solución comprobada. Inspirado en los rompecabezas de ordenar líquidos; frascos, niveles y gráficos propios.`,
  categories: ['logica'],
  Art: BoticaArt,
  palette: { a: '#e5484d', b: '#2f6fdf' },
  scene: 'day',
  facts: [`${LEVELS.length} niveles con solución`, 'Deshacer ilimitado y pistas', 'Colores con símbolo'],
  objective: 'Dejar cada frasco vacío o lleno de una sola tintura. Tres estrellas si lo logras en los movimientos justos y sin pistas.',
  howTo: [
    'Toca un frasco para tomarlo y otro para verter en él.',
    'Se vierten todas las capas seguidas del mismo color de arriba, tanto como quepa en el destino.',
    'Solo se puede verter sobre la misma tintura o en un frasco vacío.',
    'Un frasco lleno de un solo color se sella con su corcho: ya está terminado.',
    'Deshaz cuanto quieras. La pista sugiere el siguiente vertido (con pista, máximo dos estrellas).',
  ],
  controls: {
    keyboard: [
      ['1 – 9, 0', 'Tomar o verter en el frasco con ese número'],
      ['Tab e Intro', 'Recorrer y elegir frascos'],
      ['Z o Retroceso', 'Deshacer'],
      ['H', 'Pista'],
      ['R', 'Reiniciar'],
      ['Esc o P', 'Pausa'],
    ],
    touch: [
      ['Toca un frasco', 'Tomarlo'],
      ['Toca otro frasco', 'Verter en él'],
      ['Toca el mismo', 'Dejarlo en su sitio'],
    ],
  },
  difficulty: 'Fácil, Medio, Difícil y Avanzado: más tinturas y frascos, menos reservas vacías y frascos de cinco capas.',
  load: () => import('./Botica.jsx'),
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
