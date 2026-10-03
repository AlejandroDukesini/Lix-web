/**
 * Web Worker de la IA: calcula fuera del hilo principal para que la interfaz
 * siga respondiendo (animaciones, botón de abandonar) mientras la IA piensa.
 * Vite lo empaqueta como un archivo propio del build: se precachea y funciona offline.
 */
import { findBestMove } from './chessAI.js';
import { findLevel } from './aiLevels.js';

self.onmessage = (event) => {
  const { id, state, levelId } = event.data;
  const level = findLevel(levelId);
  const { move } = findBestMove(state, level);
  self.postMessage({ id, move });
};
