/**
 * Cliente de la IA. Usa un Web Worker cuando existe; si no (navegadores muy
 * antiguos, pruebas en jsdom), calcula en el hilo principal tras ceder un
 * instante para que la interfaz alcance a pintarse.
 *
 * `cancel()` descarta un cálculo en curso (reinicio, abandono) terminando el
 * Worker; `dispose()` lo cierra al salir del ajedrez: no queda nada calculando.
 */
import { findBestMove } from './chessAI.js';
import { findLevel } from './aiLevels.js';

const computeHere = (state, levelId) => findBestMove(state, findLevel(levelId)).move;

export function createAIClient() {
  let worker = null;
  let nextId = 1;
  const pending = new Map();

  const settle = (id, move) => {
    pending.get(id)?.resolve(move);
    pending.delete(id);
  };

  const spawn = () => {
    if (typeof Worker !== 'function') return null;
    try {
      const instance = new Worker(new URL('./ai.worker.js', import.meta.url), { type: 'module' });
      instance.onmessage = (event) => settle(event.data.id, event.data.move);
      instance.onerror = () => {
        // Si el Worker falla, lo pendiente se resuelve en el hilo principal.
        instance.terminate();
        worker = null;
        for (const [id, request] of pending) settle(id, computeHere(request.state, request.levelId));
      };
      return instance;
    } catch {
      return null;
    }
  };

  const dropPending = () => {
    for (const request of pending.values()) request.resolve(null);
    pending.clear();
  };

  worker = spawn();

  return {
    /** Resuelve con el movimiento elegido, o null si no hay jugadas o se canceló. */
    think(state, levelId) {
      const id = nextId;
      nextId += 1;
      return new Promise((resolve) => {
        pending.set(id, { resolve, state, levelId });
        if (worker) worker.postMessage({ id, state, levelId });
        else setTimeout(() => pending.has(id) && settle(id, computeHere(state, levelId)), 30);
      });
    },
    cancel() {
      dropPending();
      if (worker) {
        worker.terminate();
        worker = spawn();
      }
    },
    dispose() {
      dropPending();
      worker?.terminate();
      worker = null;
    },
  };
}
