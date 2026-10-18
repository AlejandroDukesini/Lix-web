/**
 * Motor de recordatorios. Vive dentro del marco de la app (AppShell) y comprueba
 * cada 30 s, y al volver a la pestaña, qué avisos tocan.
 *
 * Límites reales de una PWA sin servidor (documentados en la interfaz):
 *  - Solo avisa mientras la app está abierta (en primer plano o en una pestaña). Con la
 *    app cerrada no hay aviso: no existe un servicio de notificaciones push.
 *  - Al abrirla, muestra los avisos que se perdieron en las últimas 12 horas.
 *  - Las notificaciones del sistema necesitan permiso del navegador y, en iPhone,
 *    tener la app instalada (iOS 16.4+). Sin permiso se usan avisos dentro de la app.
 *  - Si se elige, las notificaciones no muestran detalles (útil en la pantalla bloqueada).
 */
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useToast } from '../../../components/feedback/ToastProvider.jsx';
import { readJSON, writeJSON } from '../../../services/storage/safeLocalStorage.js';
import { ensureLoaded, getSettings, listKind } from '../data/store.js';
import { remindersBetween } from './schedule.js';

const LAST_KEY = 'uamc:reminders:last';
const FIRED_KEY = 'uamc:reminders:fired';
const INTERVAL = 30_000;
const MAX_CATCH_UP = 12 * 3600_000;
const START_DELAY = 2500;

export function notificationsSupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export async function requestNotificationPermission() {
  if (!notificationsSupported()) return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

async function showSystemNotification(reminder, showDetails) {
  if (!notificationsSupported() || Notification.permission !== 'granted') return false;
  const title = showDetails ? reminder.title : 'Tienes un recordatorio';
  const options = { body: showDetails ? reminder.body : 'Abre la app para verlo.', tag: reminder.key, data: { url: reminder.url }, icon: './icons/icon-192.png' };
  try {
    const registration = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
    if (registration) await registration.showNotification(title, options);
    else new Notification(title, options);
    return true;
  } catch {
    return false;
  }
}

export function ReminderRunner() {
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
        await ensureLoaded();
        const settings = getSettings('reminderSettings');
        const now = new Date();
        const stored = Date.parse(readJSON(LAST_KEY).value ?? '');
        const from = new Date(Math.max(Number.isFinite(stored) ? stored : now.getTime() - INTERVAL, now.getTime() - MAX_CATCH_UP));
        writeJSON(LAST_KEY, now.toISOString());
        if (!settings.enabled) return;
        const fired = readJSON(FIRED_KEY).value;
        const firedMap = fired && typeof fired === 'object' && !Array.isArray(fired) ? fired : {};
        const due = remindersBetween(
          { events: listKind('event'), activities: listKind('activity'), tasks: listKind('task'), scheduled: listKind('scheduled'), transactions: listKind('transaction') },
          from,
          now,
        ).filter((r) => !firedMap[r.key]);
        for (const reminder of due.slice(-5)) {
          firedMap[reminder.key] = now.toISOString();
          const system = document.visibilityState === 'hidden' && settings.systemNotifications && (await showSystemNotification(reminder, settings.showDetails));
          if (!system) {
            toast({
              tone: 'info',
              message: `${reminder.title} · ${reminder.body}`,
              action: { label: 'Ver', onClick: () => navigate(reminder.url) },
              duration: 12_000,
            });
          }
        }
        for (const reminder of due.slice(0, -5)) firedMap[reminder.key] = now.toISOString();
        // Se olvidan los avisos de hace más de 40 días.
        const limit = now.getTime() - 40 * 86_400_000;
        for (const [key, value] of Object.entries(firedMap)) if (Date.parse(value) < limit) delete firedMap[key];
        writeJSON(FIRED_KEY, firedMap);
      } catch (error) {
        if (import.meta.env.DEV) console.warn('[reminders] Comprobación fallida', error);
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
