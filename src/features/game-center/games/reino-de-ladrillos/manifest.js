import { BrickArt } from './BrickArt.jsx';
import { LEVELS } from './levels/levels.js';

export const reinoDeLadrillosManifest = {
  id: 'reino-de-ladrillos',
  phase: 4,
  title: 'Reino de Ladrillos',
  tagline: 'Homenaje original al plataformas clásico de desplazamiento lateral.',
  description: `Una exploradora de bufanda rosa recorre ${LEVELS.length} niveles —pradera, subterráneo, copas de los árboles y un castillo de lava— hasta el último observatorio. Golpea bloques, rompe ladrillos, crece con el corazón, pisa gorgojos, patea caparazones de caracol y llega al mástil antes de que se acabe el tiempo. Homenaje a los plataformas de los 8 bits, con gráficos, personajes, sonidos y niveles propios.`,
  categories: ['clasicos', 'aventura', 'arcade'],
  Art: BrickArt,
  palette: { a: '#f2b632', b: '#c8643b' },
  facts: [`${LEVELS.length} niveles con cámara lateral`, 'Vidas, monedas y reloj', 'Banderas de control'],
  objective: 'Llegar al mástil de cada nivel y recorrer los cuatro sin quedarse sin vidas. Cuantas más monedas, enemigos y tiempo sobrante, más puntos.',
  howTo: [
    'Corre y salta; mantén el salto para llegar más alto. Golpea los bloques con estrella desde abajo: dan monedas o un corazón.',
    'El corazón te hace grande: aguantas un golpe más y rompes ladrillos con la cabeza.',
    'Cae encima de los gorgojos para eliminarlos. Pisa a un caracol y patea su caparazón: arrasa con lo que encuentre.',
    'Tocar a un enemigo de lado, caer al vacío o a la lava, o quedarse sin tiempo cuesta una vida. Las banderas de control guardan el avance.',
    'Cada 100 monedas, una vida más. La cámara solo avanza: no se puede volver atrás.',
  ],
  controls: {
    keyboard: [
      ['← → o A D', 'Moverse'],
      ['Espacio, ↑ o W', 'Saltar (mantener: más alto)'],
      ['Esc o P', 'Pausa'],
    ],
    touch: [
      ['Almohadilla izquierda', 'Moverse (desliza el pulgar de ‹ a ›)'],
      ['Botón redondo derecho', 'Saltar (mantener: más alto)'],
      ['Dos dedos', 'Correr y saltar a la vez'],
    ],
  },
  difficulty: 'Del primer tramo con columnas bajas a las copas sobre el vacío y el castillo de lava con menos tiempo.',
  load: () => import('./ReinoDeLadrillos.jsx'),
  progress(record) {
    const completed = record?.progress?.completed ?? {};
    const done = LEVELS.filter((l) => completed[l.id]).length;
    return { done, total: LEVELS.length, label: `${done}/${LEVELS.length} niveles` };
  },
  highlight(record) {
    const best = record?.best?.score;
    return Number.isFinite(best) ? `Récord: ${best.toLocaleString('es')} puntos` : null;
  },
};
