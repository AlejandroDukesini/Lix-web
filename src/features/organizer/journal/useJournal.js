import { useMemo } from 'react';
import { useKind, useSettings } from '../data/hooks.js';
import { todayISO } from '../shared/format.js';
import { BUILTIN_TEMPLATES } from './content.js';

/** Entradas del diario, plantillas (propias e incluidas) y lo que se puede vincular. */
export function useJournal() {
  const entries = useKind('journalEntry');
  const customTemplates = useKind('journalTemplate');
  const settings = useSettings('journalSettings');
  const events = useKind('event');
  const notes = useKind('note');
  const tasks = useKind('task');
  return useMemo(
    () => ({
      entries,
      customTemplates,
      templates: [...BUILTIN_TEMPLATES.map((t) => ({ ...t, builtin: true })), ...customTemplates],
      settings,
      events,
      notes: notes.filter((n) => !n.trashedAt),
      tasks,
      today: todayISO(),
      categories: [...new Set(entries.map((e) => e.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')),
    }),
    [entries, customTemplates, settings, events, notes, tasks],
  );
}
