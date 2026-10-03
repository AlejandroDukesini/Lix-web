import { ParkingArt } from './ParkingArt.jsx';
import { LEVELS } from './levels/levels.js';
import { MAX_HITS } from './engine/parkingEngine.js';

export const aparcarManifest = {
  id: 'aparcar',
  phase: 2,
  title: 'Aparcar el carro',
  tagline: 'Precisión, marcha atrás y ni un rasguño.',
  description:
    'Conduce un coche visto desde arriba hasta la plaza marcada: entre conos, en batería, marcha atrás y en línea. Aparcar bien es quedar dentro de la plaza, mirando hacia donde indica la flecha y parado.',
  categories: ['habilidad', 'carreras'],
  Art: ParkingArt,
  palette: { a: '#ff5a6e', b: '#5ce39a' },
  facts: [`${LEVELS.length} aparcamientos`, 'Hasta 3 estrellas', 'Controles de conducción táctiles'],
  objective: `Dejar el coche dentro de la plaza verde, orientado como marca la flecha y detenido un momento. Con ${MAX_HITS} golpes, se acaba el intento.`,
  howTo: [
    'Acelera para avanzar y frena para parar; con el coche parado, el freno da marcha atrás.',
    'El coche solo gira mientras se mueve, como uno de verdad. Marcha atrás, el volante gira al revés.',
    'Entra despacio: cuando estés bien colocado, un anillo verde se completa mientras esperas quieto.',
    'Tres estrellas: sin golpes y dentro del tiempo del nivel.',
  ],
  controls: {
    keyboard: [
      ['↑ o W', 'Acelerar'],
      ['↓ o S', 'Frenar / marcha atrás'],
      ['← → o A D', 'Girar el volante'],
      ['R', 'Repetir el nivel'],
      ['Esc o P', 'Pausa'],
    ],
    touch: [
      ['Botones ← → (izquierda)', 'Girar mientras los mantienes'],
      ['Pedal verde ↑ (derecha)', 'Acelerar mientras lo mantienes'],
      ['Pedal rojo ↓ (derecha)', 'Frenar y, parado, marcha atrás'],
    ],
  },
  difficulty: 'De una plaza amplia a aparcar en línea y marcha atrás en una plaza ajustada.',
  load: () => import('./Aparcar.jsx'),
  progress(record) {
    const completed = record?.progress?.completed ?? {};
    const done = LEVELS.filter((l) => completed[l.id]).length;
    return { done, total: LEVELS.length, label: `${done}/${LEVELS.length} aparcamientos` };
  },
  highlight(record) {
    const completed = record?.progress?.completed ?? {};
    const stars = LEVELS.reduce((sum, l) => sum + (completed[l.id] ?? 0), 0);
    return stars ? `${stars} de ${LEVELS.length * 3} estrellas` : null;
  },
};
