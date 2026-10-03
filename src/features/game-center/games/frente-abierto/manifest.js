import { FrontArt } from './FrontArt.jsx';
import { SCENARIOS } from './scenarios.js';

export const frenteAbiertoManifest = {
  id: 'frente-abierto',
  phase: 3,
  title: 'Frente Abierto',
  tagline: 'Estrategia territorial por turnos contra una IA local. Inspirado en Open Front.',
  description: `Conquista una isla de territorios hexagonales: coloca refuerzos, mueve tropas y ataca. Sin dados: el resultado de cada ataque se ve antes de confirmarlo. Tutorial, partida rápida contra 1 a 3 rivales y ${SCENARIOS.length} escenarios. La IA juega en este dispositivo con las mismas reglas que tú.`,
  categories: ['estrategia'],
  Art: FrontArt,
  palette: { a: '#5fb4ff', b: '#ff6f6f' },
  facts: ['IA local en 3 niveles', `${SCENARIOS.length} escenarios + tutorial`, 'Por turnos, sin prisas'],
  objective: 'Eliminar a todos los bandos rivales conquistando sus territorios. Pierdes si te quedas sin territorios.',
  howTo: [
    'Al empezar tu turno recibes refuerzos: territorios ÷ 3 (mínimo 3) más 2 por cada ciudad. Colócalos en tus territorios.',
    'Elige un territorio tuyo con 2 o más tropas y un vecino: si es tuyo, mueves tropas; si no, atacas.',
    'Conquistas si envías más tropas que su defensa (las fortalezas defienden ×1,5). Siempre queda una tropa atrás.',
    'Cada territorio actúa una vez por turno. Cuando acabes, termina el turno y juegan los rivales.',
  ],
  controls: {
    keyboard: [
      ['Clic en un territorio', 'Reforzarlo, o elegirlo como origen'],
      ['Clic en un vecino marcado', 'Elegir destino (verde: mover, rojo: atacar)'],
      ['Tab y Enter', 'Recorrer y elegir territorios con el teclado'],
      ['− / + y botón', 'Cantidad de tropas y confirmar'],
    ],
    touch: [
      ['Toca un territorio', 'Reforzarlo, o elegirlo como origen'],
      ['Toca un vecino marcado', 'Elegir destino'],
      ['− / + y botón', 'Cantidad de tropas y confirmar'],
    ],
  },
  difficulty: 'Fácil (para aprender), Normal (busca tus puntos débiles) y Difícil (defiende y concentra fuerzas).',
  load: () => import('./FrenteAbierto.jsx'),
  progress(record) {
    const scenarios = record?.progress?.scenarios ?? {};
    const done = SCENARIOS.filter((s) => scenarios[s.id]).length;
    return { done, total: SCENARIOS.length, label: `${done}/${SCENARIOS.length} escenarios` };
  },
  highlight(record) {
    const wins = Object.values(record?.progress?.wins ?? {}).reduce((a, b) => a + b, 0);
    return wins ? `${wins} ${wins === 1 ? 'victoria' : 'victorias'}` : null;
  },
};
