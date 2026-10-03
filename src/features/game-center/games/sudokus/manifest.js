import { SudokuArt } from './SudokuArt.jsx';
import { DIFFICULTIES } from './engine/sudokuEngine.js';
import { PUZZLES } from './levels/puzzles.js';

const bankSize = Object.values(PUZZLES).reduce((sum, list) => sum + list.length, 0);

export const sudokusManifest = {
  id: 'sudokus',
  phase: 2,
  title: 'Sudokus',
  tagline: 'Del 1 al 9, sin repetir. Cuatro dificultades.',
  description:
    'Sudokus clásicos de 9×9 con solución única. La dificultad no es una etiqueta: la marca la técnica que hace falta para resolver cada tablero. Notas a lápiz, resaltado de conflictos, pistas limitadas y partida guardada para seguir otro día.',
  categories: ['logica', 'clasicos'],
  Art: SudokuArt,
  palette: { a: '#4b46d1', b: '#f2b417' },
  facts: [`${DIFFICULTIES.length} dificultades`, `${bankSize} tableros base y miles de variaciones`, 'Partida guardada'],
  objective: 'Completar el tablero para que cada fila, cada columna y cada bloque 3×3 tenga los números del 1 al 9 sin repetir.',
  howTo: [
    'Elige una casilla vacía y escribe un número. Las casillas del enunciado no se pueden cambiar.',
    'Usa las notas a lápiz para apuntar candidatos; al escribir un número, esa nota se borra de sus vecinas.',
    'Si un número se repite en su fila, columna o bloque, se marca en rojo (sin taparlo).',
    '«Comprobar» señala las respuestas que no encajan sin decirte cuál es la buena. Hay 3 pistas por partida.',
    'Puedes salir cuando quieras: la partida se guarda y la retomas desde la elección de dificultad.',
  ],
  controls: {
    keyboard: [
      ['Flechas', 'Moverse por el tablero'],
      ['1–9', 'Escribir (o apuntar, con notas)'],
      ['Retroceso, Supr o 0', 'Borrar'],
      ['N', 'Activar o desactivar las notas'],
      ['Z', 'Deshacer'],
      ['Esc o P', 'Pausa'],
    ],
    touch: [
      ['Toca una casilla', 'Seleccionarla'],
      ['Teclado numérico de la pantalla', 'Escribir el número'],
      ['Notas · Borrar · Deshacer · Pista · Comprobar', 'Herramientas bajo el teclado'],
    ],
  },
  difficulty: DIFFICULTIES.map((d) => `${d.name}: ${d.technique}`).join(' · '),
  load: () => import('./Sudokus.jsx'),
  progress(record) {
    const solved = record?.progress?.solved ?? {};
    const done = DIFFICULTIES.filter((d) => solved[d.id]).length;
    return { done, total: DIFFICULTIES.length, label: `${done}/${DIFFICULTIES.length} dificultades superadas` };
  },
  highlight(record) {
    const solved = record?.progress?.solved ?? {};
    const total = Object.values(solved).reduce((sum, n) => sum + n, 0);
    return total ? `${total} ${total === 1 ? 'Sudoku resuelto' : 'Sudokus resueltos'}` : null;
  },
};
