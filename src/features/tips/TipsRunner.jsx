/**
 * Motor de los Consejos diarios en la versión web. Vive en el marco de la app (AppShell)
 * y comprueba cada 30 s, y al volver a la pestaña, si empezó una franja nueva.
 *
 * Qué hace en cada franja (una sola vez, aunque haya varias pestañas abiertas):
 *   - app visible + «en la app» activado        → tarjeta flotante dentro de la app.
 *   - app oculta + notificaciones con permiso   → notificación del sistema (etiqueta única:
 *                                                 una nueva sustituye a la anterior).
 *   - si no se puede mostrar ahora, no se marca: se mostrará al volver, si sigue en la franja.
 *
 * Límites (también en la interfaz): en la web solo funciona con la app abierta o en segundo
 * plano reciente; no hay servidor push. En la app Android las notificaciones las programa
 * Android con alarmas (ver android/), con la precisión que permita el ahorro de batería.
 */
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useToast } from '../../components/feedback/ToastProvider.jsx';
import { readJSON, writeJSON } from '../../services/storage/safeLocalStorage.js';
import { ensureLoaded, getSettings, listKind, saveSettings } from '../organizer/data/store.js';
import { notificationsSupported } from '../organizer/reminders/ReminderRunner.jsx';
import { TIP_CATEGORIES } from './content/tips.js';
import { appendHistory, currentSlot, pickTip, tipPool } from './tipsLogic.js';
import { mergeDeliveredTips } from './nativeTips.js';

const LOCK_KEY = 'lix:tips:slot';
const INTERVAL = 30_000;
const START_DELAY = 4000;

export async function showTipNotification(tip) {
  if (!notificationsSupported() || Notification.permission !== 'granted') return false;
  const options = { body: tip.text, tag: 'lix-tip', renotify: false, data: { url: '/consejos' }, icon: './icons/icon-192.png' };
  try {
    const registration = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
    if (registration) await registration.showNotification(`Consejo · ${TIP_CATEGORIES[tip.category]}`, options);
    else new Notification(`Consejo · ${TIP_CATEGORIES[tip.category]}`, options);
    return true;
  } catch {
    return false;
  }
}

/** Decide y muestra el consejo de la franja actual. Devuelve lo que hizo (para pruebas). */
export async function runTipCheck({ now = new Date(), visible = document.visibilityState !== 'hidden', showInApp, showSystem = showTipNotification } = {}) {
  await ensureLoaded();
  // En Android, primero se incorporan los consejos que el sistema ya mostró (evita repetirlos dentro).
  await mergeDeliveredTips();
  const settings = getSettings('tipSettings');
  const slot = currentSlot(now, settings);
  if (!slot) return { action: 'none' };
  const state = getSettings('tipState');
  if (state.lastSlot === slot.key || readJSON(LOCK_KEY).value === slot.key) return { action: 'already' };
  const tip = pickTip(tipPool(listKind('tip'), settings.categories), state.history, slot.key);
  if (!tip) return { action: 'none' };
  let channel = null;
  if (visible && settings.inApp) {
    showInApp(tip);
    channel = 'app';
  } else if (settings.notifications && (await showSystem(tip))) {
    channel = 'system';
  }
  if (!channel) return { action: 'deferred' };
  writeJSON(LOCK_KEY, slot.key);
  await saveSettings('tipState', { lastSlot: slot.key, history: appendHistory(state.history, { tipId: tip.id, shownAt: now.toISOString(), channel }) });
  return { action: channel, tip };
}

export function TipsRunner() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const busy = useRef(false);

  useEffect(() => {
    let timer = null;
    let cancelled = false;
    const check = async () => {
      if (busy.current || cancelled) return;
      busy.current = true;
      try {
        await runTipCheck({
          showInApp: (tip) =>
            toast({
              id: 'lix-tip',
              tone: 'info',
              message: `${TIP_CATEGORIES[tip.category]} · ${tip.text}`,
              action: { label: 'Ver', onClick: () => navigate('/consejos') },
              duration: 15_000,
            }),
        });
      } catch (error) {
        if (import.meta.env.DEV) console.warn('[consejos] Comprobación fallida', error);
      } finally {
        busy.current = false;
      }
    };
    const start = setTimeout(() => {
      check();
      timer = setInterval(check, INTERVAL);
    }, START_DELAY);
    const onVisible = () => document.visibilityState === 'visible' && check();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      clearTimeout(start);
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [toast, navigate]);

  return null;
}
