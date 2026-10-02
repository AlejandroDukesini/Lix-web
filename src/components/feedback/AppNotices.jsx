import { useEffect, useRef } from 'react';
import { usePreferences } from '../../app/providers/PreferencesProvider.jsx';
import { usePwa } from '../../hooks/usePwa.js';
import { useToast } from './ToastProvider.jsx';
import { readJSON, writeJSON } from '../../services/storage/safeLocalStorage.js';

const OFFLINE_FLAG = 'uamc:offline-announced';

/** Traduce eventos del sistema (reparaciones, almacenamiento, Service Worker) en avisos visibles. */
export function AppNotices() {
  const { notice, dismissNotice, storage } = usePreferences();
  const { updateAvailable, applyUpdate, offlineReady } = usePwa();
  const { toast } = useToast();
  const offlineAnnounced = useRef(false);

  useEffect(() => {
    if (notice === 'recovered') {
      toast({ id: 'notice', tone: 'info', duration: 6000, message: 'Recuperé tus preferencias desde la copia guardada en este dispositivo.' });
    } else if (notice === 'repaired') {
      toast({ id: 'notice', tone: 'info', duration: 6000, message: 'Algunas preferencias estaban dañadas y se restablecieron a sus valores iniciales.' });
    }
    if (notice) dismissNotice();
  }, [notice, dismissNotice, toast]);

  useEffect(() => {
    if (storage.saveFailed) {
      toast({ id: 'save-failed', tone: 'error', duration: 8000, message: 'No pude guardar en este navegador. Los cambios se perderán al cerrar.' });
    }
  }, [storage.saveFailed, storage.lastSavedAt, toast]);

  useEffect(() => {
    if (!updateAvailable) return;
    toast({
      id: 'update',
      tone: 'info',
      duration: Infinity,
      message: 'Hay una versión nueva de la app lista.',
      action: { label: 'Actualizar', onClick: applyUpdate },
    });
  }, [updateAvailable, applyUpdate, toast]);

  useEffect(() => {
    // Se anuncia una sola vez por dispositivo: la primera vez que la caché offline queda completa.
    if (!offlineReady || offlineAnnounced.current) return;
    offlineAnnounced.current = true;
    if (readJSON(OFFLINE_FLAG).value) return;
    writeJSON(OFFLINE_FLAG, true);
    toast({ id: 'offline', tone: 'success', duration: 5000, message: 'Lista para usarse sin Internet en este dispositivo.' });
  }, [offlineReady, toast]);

  return null;
}
