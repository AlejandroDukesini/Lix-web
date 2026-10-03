import { createContext, useContext } from 'react';

/** Audio silencioso: lo que recibe un juego si se monta fuera de una partida (p. ej. en pruebas). */
const SILENT = Object.freeze({
  play() {},
  setVolume() {},
  setMuted() {},
  suspend() {},
  resume() {},
  close() {},
});

export const GameAudioContext = createContext(SILENT);

/** Efectos de sonido de la partida actual (ver services/gameAudio.js). */
export function useGameAudio() {
  return useContext(GameAudioContext);
}
