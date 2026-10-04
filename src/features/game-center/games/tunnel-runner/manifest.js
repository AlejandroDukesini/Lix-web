import { TunnelArt } from './TunnelArt.jsx';
import { MILESTONES } from './engine/tunnelEngine.js';

export const tunnelRunnerManifest = {
  id: 'tunnel-runner',
  title: 'Tunnel Runner',
  tagline: 'Velocidad, profundidad y reflejos.',
  description:
    'Una nave recorre un túnel que acelera poco a poco. Gira alrededor de sus paredes para esquivar bloques pequeños, medianos y grandes —algunos se lanzan hacia ti— y colarte por los huecos de los anillos. Cada 1000 m el túnel cambia de aspecto.',
  categories: ['habilidad', 'arcade', 'carreras'],
  Art: TunnelArt,
  palette: { a: '#5ef2ff', b: '#ff4fd8' },
  facts: ['Infinito', '6 tipos de obstáculo', 'Un tramo nuevo cada 1000 m'],
  objective: 'Llegar lo más lejos posible sin chocar. Hitos en 500, 1 500 y 3 000 metros.',
  howTo: [
    'El túnel gira a tu alrededor: tú siempre estás abajo.',
    'Busca el hueco de cada obstáculo antes de llegar; siempre hay uno alcanzable.',
    'Los obstáculos con borde amarillo y estela vienen hacia ti: aparecen con más margen, pero se acercan rápido.',
    'Más adelante algunos anillos y bloques giran mientras se acercan.',
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
