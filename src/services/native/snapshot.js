/**
 * Instantánea para widgets y notificaciones nativas (Android hoy; la misma estructura sirve
 * para un futuro widget de iOS o Windows). Es una PROYECCIÓN de los datos de la app,
 * recalculada y publicada cada vez que cambian: los widgets no guardan datos propios.
 *
 * Formato (versión 1), documentado también en android/app/.../Snapshot.kt:
 * {
 *   version, generatedAt,
 *   tips:     { notifications, timeline: [{ key, at, id, text, category }] },
 *   academic: { classes: [{ subject, color, start, end, room, building }],
 *               activities: [{ title, type, typeLabel, subject, color, due, hasTime, evaluation }],
 *               overdue, dates: [{ name, type, date }] },
 *   flowers:  { cols, rows, chars, colors, palette, background, title } | null
 * }
 * Las fechas van en ISO con zona (la hora local del dispositivo).
 */
import { ACTIVITY_LABELS } from '../../features/organizer/planner/agenda.js';
import { academicDatesBetween, addDays, classSlots, EVALUATION_TYPES, holidaySet, isoDay, parseDay, PENDING, subjectActiveOn } from '../../features/academic/academicLogic.js';
import { appendHistory, currentSlot, findTip, pickTip, tipPool, upcomingSlots } from '../../features/tips/tipsLogic.js';

export const SNAPSHOT_VERSION = 1;
const CLASS_DAYS = 14;
const ACTIVITY_DAYS = 60;
const TIP_DAYS = 7;
const MAX_TIPS = 200;

function localIso(day, hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const date = parseDay(day);
  date.setHours(h, m, 0, 0);
  return date.toISOString();
}

function tipEntry(tip, key, at) {
  return { key, at: at.toISOString(), id: tip.id, text: tip.text, category: tip.category };
}

/** Consejos de la franja actual y de las próximas (elegidos con la misma lógica que la web). */
export function tipTimeline({ settings, state, customTips, now }) {
  const pool = tipPool(customTips, settings.categories);
  if (!pool.length) return [];
  let history = state.history;
  const out = [];
  const slot = currentSlot(now, settings);
  if (slot) {
    const shown = state.lastSlot === slot.key ? findTip(state.history.at(-1)?.tipId, customTips) : null;
    const tip = shown ?? pickTip(pool, history, slot.key);
    out.push(tipEntry(tip, slot.key, slot.startsAt));
    if (!shown) history = appendHistory(history, { tipId: tip.id });
  }
  if (settings.enabled) {
    for (const next of upcomingSlots(now, settings, TIP_DAYS)) {
      if (out.length >= MAX_TIPS) break;
      const tip = pickTip(pool, history, next.key);
      history = appendHistory(history, { tipId: tip.id });
      out.push(tipEntry(tip, next.key, next.at));
    }
  } else {
    // Desactivados: el widget sigue mostrando un consejo, uno por día (sin notificaciones).
    for (let i = 0; i < TIP_DAYS; i += 1) {
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      const key = `dia-${isoDay(day)}`;
      const tip = pickTip(pool, history, key);
      history = appendHistory(history, { tipId: tip.id });
      out.push(tipEntry(tip, key, day));
    }
  }
  return out;
}

export function academicProjection({ subjects, activities, academicDates }, now) {
  const today = isoDay(now);
  const holidays = holidaySet(academicDates, today, addDays(today, CLASS_DAYS));
  const slots = classSlots(subjects);
  const classes = [];
  for (let i = 0; i < CLASS_DAYS; i += 1) {
    const day = addDays(today, i);
    if (holidays.has(day)) continue;
    const weekday = parseDay(day).getDay();
    for (const slot of slots) {
      if (slot.weekday !== weekday || !subjectActiveOn(slot.subject, day)) continue;
      classes.push({ subject: slot.subject.name, color: slot.subject.color, start: localIso(day, slot.start), end: localIso(day, slot.end), room: slot.room, building: slot.building });
    }
  }
  classes.sort((a, b) => a.start.localeCompare(b.start));
  const subjectsById = new Map(subjects.map((s) => [s.id, s]));
  const limit = addDays(today, ACTIVITY_DAYS);
  const pending = activities.filter((a) => PENDING.has(a.status));
  const upcoming = pending
    .filter((a) => a.dueDate >= today && a.dueDate <= limit)
    .map((a) => {
      const subject = subjectsById.get(a.subjectId);
      return {
        title: a.title,
        type: a.type,
        typeLabel: ACTIVITY_LABELS[a.type] ?? 'Actividad',
        subject: subject?.name ?? '',
        color: subject?.color ?? '#8e5bd8',
        due: localIso(a.dueDate, a.dueTime ?? '23:59'),
        hasTime: Boolean(a.dueTime),
        evaluation: EVALUATION_TYPES.has(a.type),
      };
    })
    .sort((a, b) => a.due.localeCompare(b.due));
  return {
    classes,
    activities: upcoming,
    overdue: pending.filter((a) => a.dueDate < today).length,
    dates: academicDatesBetween(academicDates, today, addDays(today, 30)).map(({ day, record }) => ({ name: record.name, type: record.type, date: day })),
  };
}

export function buildSnapshot({ subjects, activities, academicDates, tipSettings, tipState, customTips, flowers, now = new Date() }) {
  return {
    version: SNAPSHOT_VERSION,
    generatedAt: now.toISOString(),
    tips: { notifications: Boolean(tipSettings.enabled && tipSettings.notifications), timeline: tipTimeline({ settings: tipSettings, state: tipState, customTips, now }) },
    academic: academicProjection({ subjects, activities, academicDates }, now),
    flowers: flowers ?? null,
  };
}
