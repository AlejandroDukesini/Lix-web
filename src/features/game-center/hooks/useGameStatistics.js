import { useCallback, useEffect, useState } from 'react';
import {
  CENTER_KEY,
  DEFAULT_CENTER_SETTINGS,
  readAllGameRecords,
  readCenterSettings,
  readGameRecord,
  subscribeGameStorage,
  updateCenterSettings,
} from '../services/gameStorage.js';

/** Registros de todos los juegos ({ [id]: record }), actualizados al terminar cada partida. */
export function useGameRecords() {
  const [records, setRecords] = useState(null);

  useEffect(() => {
    let cancelled = false;
    readAllGameRecords().then((all) => {
      if (!cancelled) setRecords((current) => ({ ...all, ...current }));
    });
    const unsubscribe = subscribeGameStorage((key, value) => {
      if (key !== CENTER_KEY) setRecords((current) => ({ ...current, [key]: value }));
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return { records: records ?? {}, loading: records === null };
}

/** Registro de un juego concreto. */
export function useGameRecord(gameId) {
  const [record, setRecord] = useState(null);
  useEffect(() => {
    let cancelled = false;
    readGameRecord(gameId).then((value) => {
      if (!cancelled) setRecord((current) => current ?? value);
    });
    const unsubscribe = subscribeGameStorage((key, value) => {
      if (key === gameId) setRecord(value);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [gameId]);
  return record;
}

/** Preferencias del Game Center (sonido y volumen). */
export function useCenterSettings() {
  const [settings, setSettings] = useState(DEFAULT_CENTER_SETTINGS);
  useEffect(() => {
    let cancelled = false;
    readCenterSettings().then((value) => {
      if (!cancelled) setSettings(value);
    });
    const unsubscribe = subscribeGameStorage((key, value) => {
      if (key === CENTER_KEY) setSettings(value);
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);
  const update = useCallback((patch) => {
    setSettings((current) => ({ ...current, ...patch }));
    return updateCenterSettings(patch);
  }, []);
  return [settings, update];
}

/** Totales para el panel de estadísticas del Game Center. */
export function summarizeRecords(records, games) {
  let plays = 0;
  let completions = 0;
  let totalTimeMs = 0;
  let milestonesDone = 0;
  let milestonesTotal = 0;
  let lastPlayed = null;
  for (const game of games) {
    const record = records[game.id];
    const progress = game.progress?.(record ?? null);
    if (progress) {
      milestonesDone += Math.min(progress.done, progress.total);
      milestonesTotal += progress.total;
    }
    if (!record) continue;
    plays += record.plays;
    completions += record.completions;
    totalTimeMs += record.totalTimeMs;
    if (record.lastPlayedAt && (!lastPlayed || record.lastPlayedAt > lastPlayed.at)) {
      lastPlayed = { id: game.id, at: record.lastPlayedAt };
    }
  }
  return { plays, completions, totalTimeMs, milestonesDone, milestonesTotal, lastPlayed };
}
