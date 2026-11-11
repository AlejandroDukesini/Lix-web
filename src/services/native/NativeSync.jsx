/**
 * Sincronización con Android (solo dentro del APK): publica la instantánea para los widgets y
 * las notificaciones de consejos cada vez que cambian los datos, al volver a la app y cada
 * 10 minutos (para que «el consejo de ahora» y «la próxima clase» avancen solos).
 */
import { useEffect } from 'react';
import { readJSON } from '../storage/safeLocalStorage.js';
import { ensureLoaded, getSettings, listKind, subscribe } from '../../features/organizer/data/store.js';
import { mergeDeliveredTips } from '../../features/tips/nativeTips.js';
import { onNativeEvent, publishSnapshot } from './androidBridge.js';
import { buildSnapshot } from './snapshot.js';

export const FLOWERS_WIDGET_KEY = 'lix:flowers:widget';
const DEBOUNCE = 1500;
const REFRESH = 10 * 60_000;

export async function publishNow() {
  await ensureLoaded();
  const flowers = readJSON(FLOWERS_WIDGET_KEY).value;
  return publishSnapshot(
    buildSnapshot({
      subjects: listKind('subject'),
      activities: listKind('activity'),
      academicDates: listKind('academicDate'),
      tipSettings: getSettings('tipSettings'),
      tipState: getSettings('tipState'),
      customTips: listKind('tip'),
      flowers: flowers && typeof flowers === 'object' && typeof flowers.chars === 'string' ? flowers : null,
    }),
  );
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
