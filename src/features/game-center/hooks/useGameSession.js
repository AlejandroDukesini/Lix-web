import { useCallback, useEffect, useRef, useState } from 'react';
import { GAME_STATUS, isFinished, transition } from '../services/gameLifecycle.js';
import { recordGameResult, recordGameStart } from '../services/gameStorage.js';
import { useGameAudio } from './useGameAudio.js';

const { READY, PLAYING, PAUSED } = GAME_STATUS;

/**
 * Sesión de juego: ciclo de vida + registro local de la partida.
 *
 *  - start()      empieza (o vuelve a empezar) y cuenta una partida jugada.
 *  - pause() / resume() / togglePause()
 *  - finish({ completed, marks, progress }) cierra la partida, guarda las marcas y
 *    resuelve con { marks: { [key]: { isRecord, best, previous } } } comparadas con
 *    lo persistido (un récord solo se declara si supera lo guardado).
 *  - reset()      vuelve a READY sin guardar nada.
 *
 * Mide el tiempo de juego activo (sin pausas). Si se sale con la partida en
 * curso, se guarda ese tiempo como partida no terminada. Al ocultar la pestaña
 * o bloquear el teléfono, la partida se pausa sola (si `autoPause`).
 */
export function useGameSession(gameId, { autoPause = true } = {}) {
  const [status, setStatus] = useState(READY);
  const statusRef = useRef(READY);
  const audio = useGameAudio();
  const activeMs = useRef(0);
  const since = useRef(null);
  const open = useRef(false);

  const go = useCallback((action) => {
    const next = transition(statusRef.current, action);
    if (next === statusRef.current) return false;
    const now = performance.now();
    if (statusRef.current === PLAYING && since.current !== null) {
      activeMs.current += now - since.current;
      since.current = null;
    }
    if (next === PLAYING) since.current = now;
    statusRef.current = next;
    setStatus(next);
    return true;
  }, []);

  const elapsedMs = useCallback(
    () => activeMs.current + (since.current !== null ? performance.now() - since.current : 0),
    [],
  );

  const start = useCallback(() => {
    if (statusRef.current === PLAYING || statusRef.current === PAUSED) return;
    activeMs.current = 0;
    since.current = null;
    if (go('start')) {
      open.current = true;
      recordGameStart(gameId).catch(() => {});
    }
  }, [gameId, go]);

  const finish = useCallback(
    async ({ completed = false, marks = [], progress } = {}) => {
      const durationMs = elapsedMs();
      if (!go(completed ? 'complete' : 'gameOver')) return { marks: {} };
      open.current = false;
      try {
        return await recordGameResult(gameId, { completed, durationMs, marks, progress });
      } catch {
        return { marks: {} };
      }
    },
    [gameId, go, elapsedMs],
  );

  /** Guarda progreso sin terminar la sesión (p. ej. un nivel superado dentro de una serie). */
  const saveProgress = useCallback(
    (payload) => recordGameResult(gameId, { ...payload, durationMs: 0 }).catch(() => ({ marks: {} })),
    [gameId],
  );

  const pause = useCallback(() => go('pause'), [go]);
  const resume = useCallback(() => go('resume'), [go]);
  const togglePause = useCallback(() => (statusRef.current === PAUSED ? go('resume') : go('pause')), [go]);

  /** Abandonar la partida en curso: se guarda el tiempo jugado y se vuelve a READY. */
  const reset = useCallback(() => {
    if (open.current) {
      recordGameResult(gameId, { completed: false, durationMs: elapsedMs() }).catch(() => {});
      open.current = false;
    }
    activeMs.current = 0;
    since.current = null;
    go('reset');
  }, [gameId, go, elapsedMs]);

  // El audio acompaña al estado: en pausa se silencia.
  useEffect(() => {
    if (status === PAUSED || isFinished(status)) audio.suspend();
    else if (status === PLAYING) audio.resume();
  }, [status, audio]);

  useEffect(() => {
    if (!autoPause) return undefined;
    const onHidden = () => {
      if (document.visibilityState === 'hidden' && statusRef.current === PLAYING) go('pause');
    };
    document.addEventListener('visibilitychange', onHidden);
    return () => document.removeEventListener('visibilitychange', onHidden);
  }, [autoPause, go]);

  // Salir con la partida abierta: se registra el tiempo jugado.
  useEffect(
    () => () => {
      if (open.current) {
        recordGameResult(gameId, { completed: false, durationMs: elapsedMs() }).catch(() => {});
        open.current = false;
      }
    },
    [gameId, elapsedMs],
  );

  return {
    status,
    statusRef,
    isPlaying: status === PLAYING,
    isPaused: status === PAUSED,
    isFinished: isFinished(status),
    start,
    pause,
    resume,
    togglePause,
    finish,
    saveProgress,
    reset,
    elapsedMs,
  };
}
