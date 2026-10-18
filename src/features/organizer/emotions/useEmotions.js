import { useMemo } from 'react';
import { useKind, useSettings } from '../data/hooks.js';
import { todayISO } from '../shared/format.js';

export function useEmotions() {
  const emotions = useKind('emotion');
  const logs = useKind('emotionLog');
  const settings = useSettings('emotionSettings');
  const events = useKind('event');
  const entries = useKind('journalEntry');
  return useMemo(() => {
    const sorted = [...emotions].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'es'));
    return {
      emotions: sorted,
      active: sorted.filter((e) => !e.archived),
      emotionsById: new Map(emotions.map((e) => [e.id, e])),
      logs: [...logs].sort((a, b) => b.at.localeCompare(a.at)),
      settings,
      events,
      entries: entries.filter((e) => !e.trashedAt),
      today: todayISO(),
    };
  }, [emotions, logs, settings, events, entries]);
}
