import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createDefaultPreferences } from '../../services/preferences/defaults.js';
import {
  backupPreferences,
  deleteAllLocalData,
  ensureInstallMetadata,
  loadPreferences,
  readPreferencesBackup,
  savePreferences,
} from '../../services/preferences/preferencesService.js';
import { isPersistent } from '../../services/storage/safeLocalStorage.js';

const PreferencesContext = createContext(null);
const BACKUP_DELAY_MS = 600;
const BACKUP_READ_TIMEOUT_MS = 1500;

/**
 * Estado global de preferencias. Cada cambio se valida y se guarda de forma
 * síncrona en localStorage; la copia en IndexedDB se actualiza con un pequeño
 * retraso para agrupar cambios rápidos (p. ej. arrastrar un selector de color).
 */
export function PreferencesProvider({ children }) {
  const [initial] = useState(() => loadPreferences());
  const [preferences, setPreferences] = useState(initial.preferences);
  const [storage, setStorage] = useState({ persistent: isPersistent(), saveFailed: false, lastSavedAt: null });
  const [notice, setNotice] = useState(initial.status === 'repaired' ? 'repaired' : null);
  // Sin datos en localStorage hay que consultar antes la copia de IndexedDB:
  // hasta entonces no se sabe, por ejemplo, si la presentación ya se vio.
  const [ready, setReady] = useState(initial.status !== 'defaults');

  const currentRef = useRef(initial.preferences);
  const touchedRef = useRef(false);
  const backupTimer = useRef(null);

  const scheduleBackup = useCallback((value) => {
    clearTimeout(backupTimer.current);
    backupTimer.current = setTimeout(() => backupPreferences(value), BACKUP_DELAY_MS);
  }, []);

  const commit = useCallback(
    (next) => {
      const result = savePreferences(next);
      currentRef.current = result.preferences;
      setPreferences(result.preferences);
      setStorage({ persistent: result.persistent, saveFailed: !result.ok, lastSavedAt: Date.now() });
      scheduleBackup(result.preferences);
      return result;
    },
    [scheduleBackup],
  );

  // Arranque: si no había preferencias en localStorage, se intenta recuperar la copia de IndexedDB.
  useEffect(() => {
    let cancelled = false;
    ensureInstallMetadata();

    if (initial.status === 'stored') {
      scheduleBackup(initial.preferences);
    } else if (initial.status === 'repaired') {
      commit(initial.preferences);
    } else {
      // Si IndexedDB no responde (bloqueado por otra pestaña, por ejemplo), se arranca igualmente.
      const timeout = new Promise((resolve) => setTimeout(() => resolve(null), BACKUP_READ_TIMEOUT_MS));
      Promise.race([readPreferencesBackup(), timeout]).then((backup) => {
        if (cancelled) return;
        if (!touchedRef.current) {
          if (backup) {
            commit(backup);
            setNotice('recovered');
          } else {
            commit(initial.preferences);
          }
        }
        setReady(true);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [initial, commit, scheduleBackup]);

  useEffect(() => () => clearTimeout(backupTimer.current), []);

  const update = useCallback(
    (section, patch) => {
      touchedRef.current = true;
      const current = currentRef.current;
      const nextSection = typeof patch === 'function' ? patch(current[section]) : { ...current[section], ...patch };
      return commit({ ...current, [section]: nextSection });
    },
    [commit],
  );

  const replace = useCallback(
    (next) => {
      touchedRef.current = true;
      return commit(next);
    },
    [commit],
  );

  /** Restablece la configuración, conservando si la presentación ya se vio. */
  const reset = useCallback(() => {
    touchedRef.current = true;
    const defaults = createDefaultPreferences();
    const { completed, completedAt } = currentRef.current.presentation;
    return commit({ ...defaults, presentation: { ...defaults.presentation, completed, completedAt } });
  }, [commit]);

  const eraseEverything = useCallback(async () => {
    touchedRef.current = true;
    clearTimeout(backupTimer.current);
    await deleteAllLocalData();
    const defaults = createDefaultPreferences();
    currentRef.current = defaults;
    setPreferences(defaults);
    setStorage((s) => ({ ...s, lastSavedAt: null }));
  }, []);

  const value = useMemo(
    () => ({
      preferences,
      ready,
      storage,
      notice,
      dismissNotice: () => setNotice(null),
      update,
      replace,
      reset,
      eraseEverything,
    }),
    [preferences, ready, storage, notice, update, replace, reset, eraseEverything],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error('usePreferences debe usarse dentro de <PreferencesProvider>.');
  return context;
}
