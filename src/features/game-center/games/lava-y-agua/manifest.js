import { LavaArt } from './LavaArt.jsx';
import { LEVELS } from './levels/levels.js';
import { DUO_LEVELS } from './levels/duoLevels.js';

export const lavaYAguaManifest = {
  id: 'lava-y-agua',
  phase: 4,
  badge: 'updated',
  title: 'Lava y Agua',
  tagline: 'En solitario entre la lava, o en dúo: Brasa y Gota cooperan.',
  description: `Por cada paso que das, la lava avanza una casilla. El agua también se extiende y, donde se encuentra con la lava, las dos se vuelven piedra que se puede pisar. Espera, deshaz, abre compuertas y llega a la salida. ${LEVELS.length} niveles con solución demostrada. Nuevo modo Dúo: Brasa (de lava) y Gota (de agua) cruzan juntos una cueva con gravedad, placas y compuertas; cada uno resiste su elemento y se apaga en el del otro, y solo cooperando llegan a sus puertas (${DUO_LEVELS.length} niveles). Inspirado en el rompecabezas Lava and Aqua; niveles y gráficos propios.`,
  categories: ['logica', 'aventura'],
  Art: LavaArt,
  palette: { a: '#ff7a1a', b: '#3fa7ff' },
  scene: 'day',
  facts: [`${LEVELS.length} niveles en solitario`, `${DUO_LEVELS.length} niveles en dúo cooperativo`, 'Deshacer ilimitado'],
  objective: 'Llegar a la salida luminosa sin que la lava te alcance ni la cubra. Tres estrellas si lo haces en el mínimo de turnos posible.',
  howTo: [
    'Cada turno te mueves una casilla (o esperas) y después la lava y el agua avanzan una casilla en las cuatro direcciones.',
    'La lava te elimina si te alcanza, y si cubre la salida ya no se puede escapar.',
    'El agua no hace daño. Donde toca la lava, las dos se vuelven piedra: frena a los líquidos y se puede pisar.',
    'Pisar una palanca abre su compuerta (misma letra) para siempre. La lava espesa solo avanza un turno de cada dos.',
    'Puedes deshacer todos los pasos que quieras, también después de perder.',
    'Dúo: cada pulsación mueve a uno. Brasa cruza la lava; Gota, el agua; el ácido verde mata a los dos. Las placas abren su compuerta mientras alguien las pisa y podéis subiros el uno encima del otro. Ganáis cuando cada cual está en su puerta.',
  ],
  controls: {
    keyboard: [
      ['Flechas o WASD', 'Moverse una casilla'],
      ['Espacio', 'Esperar un turno'],
      ['Z o Retroceso', 'Deshacer'],
      ['R', 'Reiniciar el nivel'],
      ['Dúo · A D / W (Q E)', 'Brasa: andar / saltar (a izquierda o derecha)'],
      ['Dúo · ← → / ↑', 'Gota: andar / saltar'],
    ],
    touch: [
      ['Desliza sobre el tablero', 'Moverse'],
      ['Toca una casilla vecina', 'Moverse a ella'],
      ['Cruceta y reloj', 'Moverse y esperar'],
      ['Deshacer / Reiniciar', 'Botones sobre el tablero'],
      ['Dúo: Brasa / Gota', 'Elegir a quién mueven los botones'],
    ],
  },
  difficulty: 'En solitario, cuatro grupos (lava, agua y piedra, compuertas y lava espesa); en dúo, de un tutorial a relevos con dos compuertas. Cada nivel se desbloquea al superar el anterior.',
  load: () => import('./LavaYAgua.jsx'),
  progress(record) {
    const completed = record?.progress?.completed ?? {};
    const duo = record?.progress?.duo ?? {};
    const done = LEVELS.filter((l) => completed[l.id]).length + DUO_LEVELS.filter((l) => duo[l.id]).length;
    const total = LEVELS.length + DUO_LEVELS.length;
    return { done, total, label: `${done}/${total} niveles` };
  },
  highlight(record) {
    const stars = [...Object.values(record?.progress?.stars ?? {}), ...Object.values(record?.progress?.duo ?? {})].reduce((a, b) => a + b, 0);
    return stars ? `${stars} de ${(LEVELS.length + DUO_LEVELS.length) * 3} estrellas` : null;
  },
};
