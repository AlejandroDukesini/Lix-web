import { AquaparkArt } from './AquaparkArt.jsx';
import { CIRCUITS } from './engine/circuits.js';
import { formatTime } from '../../services/gameLifecycle.js';

export const aquaparkManifest = {
  id: 'aquapark',
  title: 'Aquapark',
  tagline: 'Toboganes, curvas cerradas y salpicaduras.',
  description:
    'Deslízate por toboganes gigantes de un parque acuático, compite contra tres bots y llega a la piscina antes que nadie. Toma bien las curvas: en los tramos sin paredes, salirte es caer al agua.',
  categories: ['carreras', 'habilidad', 'arcade'],
  Art: AquaparkArt,
  palette: { a: '#1fb6d9', b: '#ff6f91' },
  facts: [`${CIRCUITS.length} circuitos`, 'Contrarreloj', '3 bots rivales'],
  objective: 'Llegar a la meta del tobogán con el mejor tiempo posible. Cada circuito superado desbloquea el siguiente.',
  howTo: [
    'En las curvas, la fuerza te empuja hacia fuera: gira hacia dentro para mantener la línea.',
    'Los flotadores te frenan en seco. Las flechas doradas te impulsan.',
    'Las rampas te hacen saltar por encima de todo.',
    'En los tramos sin paredes, si te sales caes a la piscina y vuelves al último punto de control.',
  ],
  controls: {
    keyboard: [
      ['← → o A D', 'Moverte de lado a lado'],
      ['Esc o P', 'Pausa'],
    ],
    touch: [
      ['Desliza el dedo ← →', 'Moverte (cuanto más lejos, más giras)'],
      ['Botones ← → de las esquinas', 'Alternativa: mantener pulsado'],
      ['Botón de pausa', 'Pausa'],
    ],
  },
  difficulty: 'Progresiva: fácil, media y difícil.',
  load: () => import('./Aquapark.jsx'),
  progress(record) {
    const circuits = record?.progress?.circuits ?? {};
    const done = CIRCUITS.filter((c) => circuits[c.id]?.finished).length;
    return { done, total: CIRCUITS.length, label: `${done}/${CIRCUITS.length} circuitos` };
  },
  highlight(record) {
    const best = CIRCUITS.map((c) => [c, record?.best?.[`time:${c.id}`]]).filter(([, t]) => Number.isFinite(t));
    if (!best.length) return null;
    const [circuit, time] = best[best.length - 1];
    return `Récord en ${circuit.name}: ${formatTime(time)}`;
  },
};
