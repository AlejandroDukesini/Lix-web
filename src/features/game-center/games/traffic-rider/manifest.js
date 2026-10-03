import { RiderArt } from './RiderArt.jsx';
import { MISSIONS, SCENES } from './engine/riderEngine.js';

export const trafficRiderManifest = {
  id: 'traffic-rider',
  phase: 3,
  title: 'Traffic Rider',
  tagline: 'Moto, tráfico y carretera abierta.',
  description:
    'Conduce una moto por una autovía de cuatro carriles: acelera, frena, cambia de carril y adelanta. El tráfico aumenta con la distancia y el paisaje cambia cada 2,5 km. Carrera libre y misiones. Versión original de la app.',
  categories: ['carreras', 'habilidad'],
  Art: RiderArt,
  palette: { a: '#ff8a65', b: '#5fb4ff' },
  facts: [`${MISSIONS.length} misiones + carrera libre`, `${SCENES.length} escenarios`, 'Récord de distancia y puntos'],
  objective: 'Llegar lo más lejos posible sin chocar. En las misiones: distancia, contrarreloj, adelantamientos o velocidad.',
  howTo: [
    'Acelera y frena: por encima de 100 km/h la distancia suma más puntos.',
    'Cambia de carril para esquivar: el movimiento lateral es progresivo, anticípate.',
    'Adelantar suma puntos; si lo haces por el carril de al lado y rápido, es un adelantamiento ajustado.',
    'El tráfico nunca bloquea los cuatro carriles: siempre hay un hueco. Ningún vehículo te embiste por detrás.',
  ],
  controls: {
    keyboard: [
      ['↑ o W', 'Acelerar'],
      ['↓ o S', 'Frenar'],
      ['← → o A D', 'Cambiar de carril'],
      ['R · Esc o P', 'Reiniciar · Pausa'],
    ],
    touch: [
      ['Pedal verde ↑ (derecha)', 'Acelerar mientras lo mantienes'],
      ['Pedal rojo ↓ (derecha)', 'Frenar mientras lo mantienes'],
      ['Botones ← → (izquierda)', 'Desplazarte mientras los mantienes'],
    ],
  },
  difficulty: 'El tráfico se hace más denso y variado con la distancia.',
  load: () => import('./TrafficRider.jsx'),
  progress(record) {
    const done = MISSIONS.filter((m) => record?.progress?.missions?.[m.id]).length;
    return { done, total: MISSIONS.length, label: `${done}/${MISSIONS.length} misiones` };
  },
  highlight(record) {
    const best = record?.best?.distance;
    return Number.isFinite(best) ? `Récord: ${(best / 1000).toLocaleString('es', { maximumFractionDigits: 2 })} km` : null;
  },
};
