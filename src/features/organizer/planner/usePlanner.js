import { useMemo } from 'react';
import { usePreferences } from '../../../app/providers/PreferencesProvider.jsx';
import { useKind, useSettings } from '../data/hooks.js';
import { todayISO } from '../shared/format.js';
import { collectAgenda } from './agenda.js';

/** Registros del calendario (y los pagos de finanzas que aparecen en él). */
export function usePlanner() {
  const events = useKind('event');
  const subjects = useKind('subject');
  const activities = useKind('activity');
  const tasks = useKind('task');
  const categories = useKind('eventCategory');
  const scheduled = useKind('scheduled');
  const transactions = useKind('transaction');
  const settings = useSettings('plannerSettings');
  const { preferences } = usePreferences();
  const today = todayISO();

  return useMemo(() => {
    const categoriesById = new Map(categories.map((c) => [c.id, c]));
    const subjectsById = new Map(subjects.map((s) => [s.id, s]));
    const records = { events, subjects, activities, tasks, scheduled, transactions };
    const show = {
      class: settings.showClasses,
      task: settings.showTasks,
      activity: settings.showActivities,
      payment: settings.showPayments,
    };
    return {
      ...records,
      categories,
      categoriesById,
      subjectsById,
      settings,
      today,
      weekStartsOn: preferences.calendar.weekStartsOn,
      hourCycle: preferences.dates.hourCycle,
      agenda: (from, to, overrides = {}) => collectAgenda(records, from, to, { today, show: { ...show, ...overrides } }),
      colorOf: (item) => item.color ?? categoriesById.get(item.categoryId)?.color ?? (item.type === 'payment' ? 'var(--c-accent)' : item.type === 'task' ? 'var(--c-secondary)' : 'var(--c-primary)'),
    };
  }, [events, subjects, activities, tasks, categories, scheduled, transactions, settings, today, preferences.calendar.weekStartsOn, preferences.dates.hourCycle]);
}
