import { LavaArt } from './LavaArt.jsx';
import { LEVELS } from './levels/levels.js';

export const lavaYAguaManifest = {
  id: 'lava-y-agua',
  phase: 4,
  title: 'Lava y Agua',
  tagline: 'Rompecabezas por turnos: encuentra la ruta segura entre la lava.',
  description: `Por cada paso que das, la lava avanza una casilla. El agua también se extiende y, donde se encuentra con la lava, las dos se vuelven piedra que se puede pisar. Espera, deshaz, abre compuertas y llega a la salida. ${LEVELS.length} niveles con solución demostrada. Inspirado en el rompecabezas Lava and Aqua; niveles y gráficos propios.`,
  categories: ['logica', 'aventura'],
  Art: LavaArt,
  palette: { a: '#ff7a1a', b: '#3fa7ff' },
  facts: [`${LEVELS.length} niveles demostrados`, 'Deshacer ilimitado', '3 estrellas por nivel'],
  objective: 'Llegar a la salida luminosa sin que la lava te alcance ni la cubra. Tres estrellas si lo haces en el mínimo de turnos posible.',
  howTo: [
    'Cada turno te mueves una casilla (o esperas) y después la lava y el agua avanzan una casilla en las cuatro direcciones.',
    'La lava te elimina si te alcanza, y si cubre la salida ya no se puede escapar.',
    'El agua no hace daño. Donde toca la lava, las dos se vuelven piedra: frena a los líquidos y se puede pisar.',
    'Pisar una palanca abre su compuerta (misma letra) para siempre. La lava espesa solo avanza un turno de cada dos.',
    'Puedes deshacer todos los pasos que quieras, también después de perder.',
  ],
  controls: {
    keyboard: [
      ['Flechas o WASD', 'Moverse una casilla'],
      ['Espacio', 'Esperar un turno'],
      ['Z o Retroceso', 'Deshacer'],
      ['R', 'Reiniciar el nivel'],
    ],
    touch: [
      ['Desliza sobre el tablero', 'Moverse'],
      ['Toca una casilla vecina', 'Moverse a ella'],
      ['Cruceta y reloj', 'Moverse y esperar'],
      ['Deshacer / Reiniciar', 'Botones sobre el tablero'],
    ],
  },
  difficulty: 'Cuatro grupos: lava, agua y piedra, compuertas y lava espesa. Cada nivel se desbloquea al superar el anterior.',
  load: () => import('./LavaYAgua.jsx'),
  progress(record) {
    const completed = record?.progress?.completed ?? {};
    const done = LEVELS.filter((l) => completed[l.id]).length;
    return { done, total: LEVELS.length, label: `${done}/${LEVELS.length} niveles` };
  },
  highlight(record) {
    const stars = Object.values(record?.progress?.stars ?? {}).reduce((a, b) => a + b, 0);
    return stars ? `${stars} de ${LEVELS.length * 3} estrellas` : null;
  },
};
