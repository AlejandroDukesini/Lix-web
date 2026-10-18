import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { useToast } from '../../../components/feedback/ToastProvider.jsx';
import { ensureLoaded, getRecord, getSettings, getStatus, IntegrityError, listKind, subscribe, ValidationError } from './store.js';

/** Estado de carga del almacén. La primera pantalla que lo usa dispara la carga. */
export function useOrganizerStatus() {
  useEffect(() => {
    ensureLoaded();
  }, []);
  return useSyncExternalStore(subscribe, getStatus, getStatus);
}

/** Todos los registros de un tipo. La referencia solo cambia cuando cambia ese tipo. */
export function useKind(kind) {
  const read = useCallback(() => listKind(kind), [kind]);
  return useSyncExternalStore(subscribe, read, read);
}

export function useRecord(id) {
  const read = useCallback(() => getRecord(id), [id]);
  return useSyncExternalStore(subscribe, read, read);
}

export function useSettings(kind) {
  const records = useKind(kind);
  return useMemo(() => records[0] ?? getSettings(kind), [records, kind]);
}

/** Mapa id → registro de un tipo (para resolver relaciones al pintar listas). */
export function useIndex(kind) {
  const records = useKind(kind);
  return useMemo(() => new Map(records.map((r) => [r.id, r])), [records]);
}

/**
 * Ejecuta una operación de escritura con avisos uniformes.
 * Devuelve `{ ok, result, errors }`: los errores de validación por campo se
 * devuelven al formulario; el resto se muestran en un aviso.
 */
export function useRunner() {
  const { toast } = useToast();
  return useCallback(
    async (operation, { success, undo } = {}) => {
      try {
        const result = await operation();
        if (success) toast({ id: 'organizer', message: success, action: undo, duration: undo ? 6000 : 2600 });
        return { ok: true, result, errors: null };
      } catch (error) {
        if (error instanceof ValidationError) {
          toast({ id: 'organizer', tone: 'error', message: error.message });
          return { ok: false, result: null, errors: error.errors };
        }
        toast({ id: 'organizer', tone: 'error', message: error instanceof IntegrityError ? error.message : error.message || 'No se pudo completar la operación.' });
        return { ok: false, result: null, errors: null, error };
      }
    },
    [toast],
  );
}
