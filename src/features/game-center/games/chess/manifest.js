import { ChessArt } from './ChessArt.jsx';
import { AI_LEVELS, normalizeLevelId } from './engine/aiLevels.js';

export const chessManifest = {
  id: 'chess',
  title: 'Ajedrez',
  tagline: 'El clásico de siempre, con todas sus reglas.',
  description:
    'Ajedrez completo para dos personas en el mismo dispositivo o contra una IA local de cinco niveles, desde Bebé hasta Adulto, que piensa sin bloquear la pantalla. Enroque, captura al paso, promoción, jaque mate y tablas incluidos.',
  categories: ['estrategia', 'logica', 'clasicos'],
  Art: ChessArt,
  palette: { a: '#4f7a5e', b: '#c9a86a' },
  facts: ['2 jugadores o IA', `${AI_LEVELS.length} niveles de IA`, 'Reglas completas'],
  objective: 'Dar jaque mate al rey rival. También puede terminar en tablas (ahogado, repetición, 50 movimientos o material insuficiente).',
  howTo: [
    'Toca una pieza para ver sus movimientos legales; toca el destino para moverla.',
    'Para enrocar, mueve el rey dos casillas hacia la torre.',
    'Al coronar un peón eliges la pieza.',
    'Puedes abandonar en cualquier momento (se pide confirmación).',
  ],
  controls: {
    keyboard: [
      ['Tab y flechas', 'Recorrer el tablero'],
      ['Enter o Espacio', 'Elegir pieza y destino'],
      ['Clic', 'Elegir pieza y destino'],
    ],
    touch: [['Toca pieza y luego destino', 'Mover']],
  },
  difficulty: 'IA en cinco niveles: Bebé, Niño, Adolescente, Joven y Adulto.',
  load: () => import('./Chess.jsx'),
  progress(record) {
    // Las victorias guardadas con los identificadores antiguos cuentan para su nivel equivalente.
    const wins = new Set(Object.keys(record?.progress?.aiWins ?? {}).map(normalizeLevelId));
    const done = AI_LEVELS.filter((level) => wins.has(level.id)).length;
    return { done, total: AI_LEVELS.length, label: `IA vencida en ${done}/${AI_LEVELS.length} niveles` };
  },
  highlight(record) {
    const results = record?.progress?.results;
    if (!results) return null;
    return `${results.wins ?? 0} victorias · ${results.draws ?? 0} tablas · ${results.losses ?? 0} derrotas ante la IA`;
  },
};
