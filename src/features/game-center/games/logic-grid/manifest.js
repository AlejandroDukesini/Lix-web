import { LogicGridArt } from './LogicGridArt.jsx';
import { LEVELS, SERIES } from './levels/levels.js';

export const logicGridManifest = {
  id: 'logic-grid',
  title: 'Cubrir el espacio',
  tagline: 'Pinta todo el tablero con los movimientos justos.',
  description:
    'Un juego de lógica sobre cuadrículas: recorre el tablero hasta cubrir todas las casillas sin repetir ninguna y sin pasarte del número de movimientos. Dos series con reglas de movimiento distintas, todos los niveles con solución comprobada.',
  categories: ['logica', 'estrategia'],
  Art: LogicGridArt,
  palette: { a: '#7c5cff', b: '#ff7ab6' },
  facts: [`${LEVELS.length} niveles`, `${SERIES.length} reglas`, 'Sin tiempo límite'],
  objective: 'Cubrir todas las casillas del tablero sin repetir ninguna y sin superar el número de movimientos del nivel.',
  howTo: [
    'Regla de oro: ninguna casilla se puede pisar dos veces.',
    'Deslizar: la ficha avanza en línea recta hasta un muro o una casilla ya pintada.',
    'Trazo único: avanzas de una en una, siempre hacia una casilla libre.',
    'Las celdas marcadas muestran a dónde llegarías con cada movimiento.',
    'Si ya no queda solución con los movimientos restantes, el juego te lo dice: deshaz o reinicia.',
  ],
  controls: {
    keyboard: [
      ['Flechas o WASD', 'Mover'],
      ['Clic en una celda marcada', 'Mover hasta ella'],
      ['Z o Retroceso', 'Deshacer'],
      ['R', 'Reiniciar nivel'],
    ],
    touch: [
      ['Desliza sobre el tablero', 'Mover en esa dirección'],
      ['Toca una celda marcada', 'Mover hasta ella'],
    ],
  },
  difficulty: 'De 3 a 31 movimientos, en orden creciente.',
  load: () => import('./LogicGrid.jsx'),
  progress(record) {
    const completed = record?.progress?.completed ?? {};
    const done = LEVELS.filter((level) => completed[level.id]).length;
    return { done, total: LEVELS.length, label: `${done}/${LEVELS.length} niveles` };
  },
  highlight(record) {
    const completed = record?.progress?.completed ?? {};
    const done = LEVELS.filter((level) => completed[level.id]).length;
    return done ? `${done} de ${LEVELS.length} niveles superados` : null;
  },
};
