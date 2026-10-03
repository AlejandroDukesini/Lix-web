import { TunnelArt } from './TunnelArt.jsx';
import { MILESTONES } from './engine/tunnelEngine.js';

export const tunnelRunnerManifest = {
  id: 'tunnel-runner',
  title: 'Tunnel Runner',
  tagline: 'Velocidad, profundidad y reflejos.',
  description:
    'Una nave recorre un túnel de neón que acelera sin descanso. Gira alrededor de sus paredes para colarte por los huecos de cada anillo. Cada sector es más rápido, más estrecho y más traicionero.',
  categories: ['habilidad', 'arcade', 'carreras'],
  Art: TunnelArt,
  palette: { a: '#5ef2ff', b: '#ff4fd8' },
  facts: ['Infinito', 'Sectores de dificultad', 'Récord de distancia'],
  objective: 'Llegar lo más lejos posible sin chocar. Hitos en 500, 1 500 y 3 000 metros.',
  howTo: [
    'El túnel gira a tu alrededor: tú siempre estás abajo.',
    'Busca el hueco de cada anillo antes de llegar; siempre hay uno alcanzable.',
    'Desde el tercer sector algunos anillos giran mientras se acercan.',
    'No hay salto ni deslizamiento: todo se esquiva girando.',
  ],
  controls: {
    keyboard: [
      ['← → o A D', 'Girar alrededor del túnel'],
      ['Esc o P', 'Pausa'],
    ],
    touch: [
      ['Desliza el dedo ← →', 'Girar (cuanto más lejos, más rápido)'],
      ['Botones ← → de las esquinas', 'Alternativa: mantener pulsado'],
      ['Botón de pausa', 'Pausa'],
    ],
  },
  difficulty: 'Empieza tranquilo y acelera con la distancia.',
  load: () => import('./TunnelRunner.jsx'),
  progress(record) {
    const best = record?.best?.distance ?? 0;
    const done = MILESTONES.filter((m) => best >= m).length;
    return { done, total: MILESTONES.length, label: `${done}/${MILESTONES.length} hitos de distancia` };
  },
  highlight(record) {
    const best = record?.best?.distance;
    return Number.isFinite(best) ? `Récord: ${best.toLocaleString('es')} m` : null;
  },
};
