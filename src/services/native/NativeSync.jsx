/**
 * Publica la instantánea para los widgets cada vez que cambian los datos, al volver a la app y
 * cada 10 minutos (para que «el consejo de ahora» y «la próxima clase» avancen solos):
 *  - en el APK de Android, por el puente (widgets Glance y notificaciones de consejos);
 *  - en la web/PWA, en IndexedDB (meta/widgetSnapshot), de donde la lee el Service Worker para
 *    el widget del Tablero de Widgets de Windows 11. Se avisa al SW para que lo repinte.
 */
import { useEffect } from 'react';
import { readJSON } from '../storage/safeLocalStorage.js';
import { dbPut, isIndexedDBAvailable, STORES } from '../storage/database.js';
import { ensureLoaded, getSettings, listKind, subscribe } from '../../features/organizer/data/store.js';
import { mergeDeliveredTips } from '../../features/tips/nativeTips.js';
import { isAndroidShell, onNativeEvent, publishSnapshot } from './androidBridge.js';
import { buildSnapshot } from './snapshot.js';

export const FLOWERS_WIDGET_KEY = 'lix:flowers:widget';
const DEBOUNCE = 1500;
const REFRESH = 10 * 60_000;

export async function publishNow() {
  await ensureLoaded();
  const flowers = readJSON(FLOWERS_WIDGET_KEY).value;
  const snapshot = buildSnapshot({
      subjects: listKind('subject'),
      activities: listKind('activity'),
      academicDates: listKind('academicDate'),
      tipSettings: getSettings('tipSettings'),
      tipState: getSettings('tipState'),
      customTips: listKind('tip'),
      flowers: flowers && typeof flowers === 'object' && typeof flowers.chars === 'string' ? flowers : null,
  });
  if (isAndroidShell()) return publishSnapshot(snapshot);
  if (!isIndexedDBAvailable()) return false;
  await dbPut(STORES.meta, 'widgetSnapshot', snapshot);
  navigator.serviceWorker?.controller?.postMessage({ type: 'WIDGETS_REFRESH' });
  return true;
}

export function NativeSync() {
  useEffect(() => {
    let timer = null;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => publishNow().catch(() => {}), DEBOUNCE);
    };
    const resume = () => {
      mergeDeliveredTips().catch(() => {});
      schedule();
    };
    resume();
    const unsubscribe = subscribe(schedule);
    const offResume = onNativeEvent('resume', resume);
    const interval = setInterval(schedule, REFRESH);
    window.addEventListener('storage', schedule);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      unsubscribe();
      offResume();
      window.removeEventListener('storage', schedule);
    };
  }, []);
  return null;
}
