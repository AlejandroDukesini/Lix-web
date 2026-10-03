import { IoArt } from './IoArt.jsx';
import { IO_MODES } from './modes.js';

export const ioGamesManifest = {
  id: 'io-games',
  title: 'Arena .io',
  tagline: 'Tres minijuegos rápidos: crecer, conquistar y sobrevivir.',
  description:
    'Una colección de minijuegos de estilo .io para partidas cortas. Los rivales son bots controlados por el juego, siempre identificados como tales: aquí no hay jugadores conectados ni servidores.',
  categories: ['arcade', 'habilidad', 'estrategia'],
  Art: IoArt,
  palette: { a: '#7df9ff', b: '#ff4fd8' },
  facts: [`${IO_MODES.length} minijuegos`, 'Partidas de 1–3 min', 'Bots locales'],
  objective: 'Cada minijuego tiene su propia meta: crecer hasta una masa, dominar parte del mapa o sobrevivir a los drones.',
  howTo: IO_MODES.map((mode) => `${mode.name}: ${mode.goal}`),
  controls: {
    keyboard: [
      ['Flechas o WASD', 'Moverse'],
      ['Ratón (Órbita y Señuelo)', 'El personaje sigue al puntero'],
      ['Esc o P', 'Pausa'],
    ],
    touch: [
      ['Arrastra en la pantalla', 'Joystick (Órbita y Señuelo)'],
      ['Desliza o usa la cruceta', 'Cambiar de dirección (Territorio)'],
    ],
  },
  difficulty: 'Partidas cortas con dificultad creciente durante la partida.',
  load: () => import('./IoGames.jsx'),
  progress(record) {
    const wins = record?.progress?.wins ?? {};
    const done = IO_MODES.filter((m) => wins[m.id]).length;
    return { done, total: IO_MODES.length, label: `${done}/${IO_MODES.length} minijuegos ganados` };
  },
  highlight(record) {
    const scores = IO_MODES.map((m) => [m, record?.best?.[`${m.id}:score`]]).filter(([, v]) => Number.isFinite(v));
    if (!scores.length) return null;
    return scores.map(([m, v]) => `${m.name} ${m.formatScore(v)}`).join(' · ');
  },
};
