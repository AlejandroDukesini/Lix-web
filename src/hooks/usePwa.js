import { useSyncExternalStore } from 'react';
import { applyUpdate, detectPlatform, promptInstall, pwaStore } from '../services/pwa/pwaStore.js';

export function usePwa() {
  const state = useSyncExternalStore(pwaStore.subscribe, pwaStore.getSnapshot, pwaStore.getSnapshot);
  const platform = detectPlatform();

  let installStatus = 'manual';
  if (state.installed) installStatus = 'installed';
  else if (state.installEvent) installStatus = 'available';
  else if (platform === 'ios') installStatus = 'ios';

  return {
    ...state,
    platform,
    installStatus,
    updateAvailable: Boolean(state.waitingWorker),
    applyUpdate,
    promptInstall,
  };
}
