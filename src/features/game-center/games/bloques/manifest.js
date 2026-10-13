import { BlocksArt } from './BlocksArt.jsx';
import { MODES } from './engine/blocksEngine.js';
import { MILESTONES, milestonesFor } from './milestones.js';

export const bloquesManifest = {
  id: 'bloques',
  phase: 4,
  title: 'Bloques que caen',
  tagline: 'El clásico de encajar piezas, bajo un cielo de estrellas.',
  description: `Siete piezas que caen sobre un tablero de 10 × 20. Gíralas, muévelas y completa filas: cada fila completa se borra y cuatro a la vez valen más. Maratón de ${MODES.maraton.goalLines} líneas con 3 niveles de salida y contrarreloj de ${MODES.sprint.goalLines} líneas. Reglas habituales del género: rotación con patadas de pared, sombra, reserva y caída instantánea.`,
  categories: ['clasicos', 'logica', 'arcade'],
  Art: BlocksArt,
  palette: { a: '#5ee6ff', b: '#b48cff' },
  facts: ['Maratón y contrarreloj', 'Sombra, reserva y 3 siguientes', 'Más rápido cada 10 líneas'],
  objective: `Completar filas para que desaparezcan. En maratón ganas con ${MODES.maraton.goalLines} líneas; en contrarreloj, cuanto antes llegues a ${MODES.sprint.goalLines}. Pierdes si las piezas llegan arriba.`,
  howTo: [
    'Las piezas caen solas. Muévelas a los lados y gíralas antes de que toquen fondo.',
    'Al tocar fondo tienes medio segundo para ajustarlas; después se fijan.',
    'Una fila completa desaparece: 1, 2, 3 o 4 filas a la vez dan 100, 300, 500 u 800 puntos × nivel. Cuatro seguidas de cuatro valen ×1,5.',
    'La sombra muestra dónde caerá. Puedes guardar una pieza en la reserva (una vez por pieza).',
    'Cada 10 líneas sube el nivel y las piezas caen más deprisa.',
  ],
  controls: {
    keyboard: [
      ['← →', 'Mover (mantener: repetir)'],
      ['↑ o X · Z', 'Girar a la derecha · a la izquierda'],
      ['↓', 'Bajar más rápido (+1 punto por fila)'],
      ['Espacio', 'Caída instantánea (+2 por fila)'],
      ['C o Mayús', 'Guardar pieza'],
      ['Esc o P · R', 'Pausa · Reiniciar'],
    ],
    touch: [
      ['Toca el tablero', 'Girar'],
      ['Arrastra a los lados / abajo', 'Mover casilla a casilla / bajar'],
      ['Desliza rápido hacia abajo', 'Caída instantánea'],
      ['Botones de abajo', 'Mover, bajar, girar, soltar y guardar'],
    ],
  },
  difficulty: 'Nivel inicial 1, 5 o 10 en maratón; la velocidad crece con cada nivel hasta el 20.',
  load: () => import('./Bloques.jsx'),
  progress(record) {
    const done = Object.values(milestonesFor(record)).filter(Boolean).length;
    return { done, total: MILESTONES.length, label: `${done}/${MILESTONES.length} hitos` };
  },
  highlight(record) {
    const best = record?.best?.['score:maraton'];
    return Number.isFinite(best) ? `Récord: ${best.toLocaleString('es')} puntos` : null;
  },
};
