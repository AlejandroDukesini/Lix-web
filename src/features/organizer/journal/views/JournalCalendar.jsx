import { useMemo, useState } from 'react';
import { Feather } from 'lucide-react';
import { usePreferences } from '../../../../app/providers/PreferencesProvider.jsx';
import { Button } from '../../../../components/common/Button.jsx';
import { cx } from '../../../../utils/cx.js';
import { addMonthsClamped } from '../../data/recurrence.js';
import { PeriodNav } from '../../shared/ui.jsx';
import { dayHeading, monthLabel } from '../../shared/format.js';
import { monthGrid } from '../../planner/agenda.js';
import { useJournal } from '../useJournal.js';
import { EntryCard } from './JournalList.jsx';

const WEEKDAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

/** Calendario de entradas: cada día muestra cuántas hay; al elegirlo, se listan. */
export function JournalCalendar() {
  const journal = useJournal();
  const { preferences } = usePreferences();
  const weekStartsOn = preferences.calendar.weekStartsOn;
  const [month, setMonth] = useState(journal.today.slice(0, 7));
  const [selected, setSelected] = useState(journal.today);
  const byDay = useMemo(() => {
    const map = new Map();
    for (const e of journal.entries) {
      if (e.trashedAt) continue;
      if (!map.has(e.eventDate)) map.set(e.eventDate, []);
      map.get(e.eventDate).push(e);
    }
    return map;
  }, [journal.entries]);
  const [y, m] = month.split('-').map(Number);
  const weeks = monthGrid(y, m, weekStartsOn);
  const dayEntries = (byDay.get(selected) ?? []).sort((a, b) => a.writtenAt.localeCompare(b.writtenAt));
  const written = [...byDay.keys()].filter((d) => d.startsWith(month)).length;

  return (
    <div className="org-stack">
      <PeriodNav
        label={`${monthLabel(month)} · ${written} ${written === 1 ? 'día escrito' : 'días escritos'}`}
        onPrev={() => setMonth(addMonthsClamped(`${month}-01`, -1).slice(0, 7))}
        onNext={() => setMonth(addMonthsClamped(`${month}-01`, 1).slice(0, 7))}
        onToday={() => {
          setMonth(journal.today.slice(0, 7));
          setSelected(journal.today);
        }}
      />
      <div className="org-month org-month--journal" role="group" aria-label={monthLabel(month)}>
        <div className="org-month__head" aria-hidden="true">
          {Array.from({ length: 7 }, (_, i) => (
            <span key={i} className="org-month__weekday">
              {WEEKDAY_SHORT[(i + weekStartsOn) % 7]}
            </span>
          ))}
        </div>
        {weeks.map((week) => (
          <div key={week[0]} className="org-month__week">
            {week.map((day) => {
              const count = byDay.get(day)?.length ?? 0;
              return (
                <button
                  key={day}
                  type="button"
                  className={cx('org-month__day', day.slice(0, 7) !== month && 'is-outside', day === journal.today && 'is-today', day === selected && 'is-selected', count > 0 && 'has-entries')}
                  aria-pressed={day === selected}
                  aria-label={`${dayHeading(day)}${count ? `, ${count} ${count === 1 ? 'entrada' : 'entradas'}` : ''}`}
                  onClick={() => setSelected(day)}
                >
                  <span className="org-month__number">{Number(day.slice(8))}</span>
                  {count > 0 && (
                    <span className="org-journal-dots" aria-hidden="true">
                      {Array.from({ length: Math.min(count, 3) }, (_, i) => (
                        <span key={i} />
                      ))}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <section className="org-panel org-dayboard" aria-labelledby="journal-day">
        <div className="org-section__header">
          <h2 id="journal-day" className="org-section__title">
            {dayHeading(selected)}
          </h2>
          {selected <= journal.today && (
            <Button size="sm" variant="secondary" icon={Feather} to={`/diario/nueva?fecha=${selected}`}>
              Escribir sobre este día
            </Button>
          )}
        </div>
        {dayEntries.length ? (
          <ul className="org-entries">
            {dayEntries.map((e) => (
              <EntryCard key={e.id} entry={e} />
            ))}
          </ul>
        ) : (
          <p className="org-subtle">No hay entradas de este día.</p>
        )}
      </section>
    </div>
  );
}
