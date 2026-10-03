import { ChickenArt } from './ChickenArt.jsx';
import { ROUNDS } from './engine/chickenEngine.js';

export const chickenCrossingManifest = {
  id: 'cruce-del-pollo',
  phase: 2,
  title: 'Pollo pasando la calle sangriento',
  tagline: 'Carreteras, ríos y una gallina muy valiente.',
  description:
    'Lleva a la gallina hasta su nido saltando entre coches, camiones y troncos que flotan. Cada ronda tiene más carriles y más prisa. Si algo sale mal, vuelan plumas (y poco más): es una gallina de dibujos animados.',
  categories: ['arcade', 'habilidad'],
  Art: ChickenArt,
  palette: { a: '#ffb347', b: '#ef3e4a' },
  facts: [`${ROUNDS} rondas`, 'Partidas rápidas', 'Récord de puntos'],
  objective: `Cruzar las ${ROUNDS} rondas hasta el nido sin que te atropellen ni caer al río. Cada fila nueva suma un punto y cada ronda, diez.`,
  howTo: [
    'Avanzas a saltos de una casilla. Mira el tráfico y salta en el hueco.',
    'En la carretera no te quedes quieta: espera tu momento en la hierba.',
    'En el río solo puedes pisar los troncos. Te arrastran: no dejes que te saquen de la pantalla.',
    'Nunca hay más de tres carriles seguidos sin una franja de hierba donde esperar.',
  ],
  controls: {
    keyboard: [
      ['Flechas o WASD', 'Saltar en esa dirección'],
      ['Esc o P', 'Pausa'],
    ],
    touch: [
      ['Toque corto', 'Saltar hacia delante'],
      ['Desliza ↑ ↓ ← →', 'Saltar en esa dirección'],
      ['Cruceta de la esquina', 'Alternativa con botones'],
      ['Botón de pausa', 'Pausa'],
    ],
  },
  difficulty: 'Progresiva: más carriles y más velocidad en cada ronda; río desde la ronda 3.',
  load: () => import('./ChickenCrossing.jsx'),
  progress(record) {
    const done = Math.min(ROUNDS, record?.progress?.bestRound ?? 0);
    return { done, total: ROUNDS, label: `${done}/${ROUNDS} rondas` };
  },
  highlight(record) {
    const best = record?.best?.score;
    return Number.isFinite(best) ? `Récord: ${best} puntos` : null;
  },
};
