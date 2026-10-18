import { useMemo, useState } from 'react';
import { CalendarPlus, CalendarSearch } from 'lucide-react';
import { Button } from '../../../../components/common/Button.jsx';
import { cx } from '../../../../utils/cx.js';
import { addDays, addMonthsClamped, weekdayOf } from '../../data/recurrence.js';
import { SelectField } from '../../shared/Fields.jsx';
import { EmptyState, PeriodNav, SearchField } from '../../shared/ui.jsx';
import { dayHeading, formatClock, monthLabel, PRIORITY_LABELS, shortDate } from '../../shared/format.js';
import { matchesQuery } from '../../shared/text.js';
import { coversDay, ITEM_TYPES, monthGrid } from '../agenda.js';
import { usePlannerActions } from '../PlannerContext.js';
import { usePlanner } from '../usePlanner.js';

const VIEWS = [
  ['month', 'Mes'],
  ['week', 'Semana'],
  ['day', 'Día'],
  ['agenda', 'Agenda'],
  ['past', 'Pasados'],
];
const WEEKDAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

/** Un elemento de la agenda como botón: hora, color de su categoría, título y detalles. */
export function AgendaItem({ item, compact = false, showDate = false }) {
  const planner = usePlanner();
  const { openItem } = usePlannerActions();
  const done = item.status === 'completed' || item.status === 'done' || item.status === 'paid';
  const time = item.allDay ? 'Todo el día' : formatClock(item.startTime, planner.hourCycle);
  return (
    <button
      type="button"
      className={cx('org-agenda-item', `org-agenda-item--${item.type}`, compact && 'is-compact', done && 'is-done', item.status === 'cancelled' && 'is-cancelled', item.status === 'overdue' && 'is-overdue')}
      style={{ '--item-color': planner.colorOf(item) }}
      onClick={() => openItem(item)}
    >
      <span className="org-agenda-item__time">{showDate ? `${shortDate(item.date)} · ${time}` : time}</span>
      <span className="org-agenda-item__title">
        {item.title}
        {item.priority === 'high' && !compact && <span className="sr-only"> (prioridad alta)</span>}
      </span>
      {!compact && (
        <span className="org-agenda-item__meta">
          {ITEM_TYPES[item.type]}
          {item.subtitle && ` · ${item.subtitle}`}
          {item.location && ` · ${item.location}`}
          {item.endTime && !item.allDay && ` · hasta ${formatClock(item.endTime, planner.hourCycle)}`}
          {item.status === 'overdue' && ' · vencido'}
          {item.status === 'cancelled' && ' · cancelado'}
          {item.priority === 'high' && ` · prioridad ${PRIORITY_LABELS.high.toLowerCase()}`}
        </span>
      )}
    </button>
  );
}

function DayList({ date, items, emptyText = 'Nada programado.' }) {
  const list = items.filter((i) => coversDay(i, date));
  return list.length ? (
    <ul className="org-list">
      {list.map((item) => (
        <li key={item.key}>
          <AgendaItem item={item} />
        </li>
      ))}
    </ul>
  ) : (
    <p className="org-subtle">{emptyText}</p>
  );
}

export function CalendarView() {
  const planner = usePlanner();
  const { openEvent } = usePlannerActions();
  const { today, weekStartsOn } = planner;
  const [view, setView] = useState(planner.settings.defaultView === 'agenda' ? 'agenda' : planner.settings.defaultView);
  const [anchor, setAnchor] = useState(today);
  const [selected, setSelected] = useState(today);
  const [horizon, setHorizon] = useState(60);
  const [query, setQuery] = useState('');
  const [types, setTypes] = useState(() => Object.keys(ITEM_TYPES));
  const [categoryId, setCategoryId] = useState(null);
  const [priority, setPriority] = useState(null);

  const range = useMemo(() => {
    if (view === 'month') {
      const [y, m] = anchor.split('-').map(Number);
      const weeks = monthGrid(y, m, weekStartsOn);
      return { from: weeks[0][0], to: weeks.at(-1)[6], weeks, label: monthLabel(anchor.slice(0, 7)) };
    }
    if (view === 'week') {
      const from = addDays(anchor, -((weekdayOf(anchor) - weekStartsOn + 7) % 7));
      const to = addDays(from, 6);
      return { from, to, label: `${shortDate(from)} – ${shortDate(to)}` };
    }
    if (view === 'day') return { from: anchor, to: anchor, label: dayHeading(anchor) };
    if (view === 'past') return { from: addDays(today, -horizon), to: addDays(today, -1), label: `Últimos ${horizon} días` };
    return { from: today, to: addDays(today, horizon), label: `Próximos ${horizon} días` };
  }, [view, anchor, weekStartsOn, today, horizon]);

  const items = useMemo(() => {
    const all = planner.agenda(range.from, range.to);
    return all.filter(
      (item) =>
        types.includes(item.type) &&
        (!categoryId || item.categoryId === categoryId) &&
        (!priority || item.priority === priority) &&
        matchesQuery(query, item.title, item.subtitle, item.location, item.notes, item.tags),
    );
  }, [planner, range.from, range.to, types, categoryId, priority, query]);

  const move = (step) => {
    if (view === 'month') setAnchor(addMonthsClamped(`${anchor.slice(0, 7)}-01`, step));
    else if (view === 'week') setAnchor(addDays(anchor, 7 * step));
    else if (view === 'day') setAnchor(addDays(anchor, step));
  };

  const grouped = useMemo(() => {
    if (view !== 'agenda' && view !== 'past') return [];
    const map = new Map();
    const list = view === 'past' ? [...items].reverse() : items;
    for (const item of list) {
      if (!map.has(item.date)) map.set(item.date, []);
      map.get(item.date).push(item);
    }
    return [...map];
  }, [items, view]);

  const filtersActive = query || categoryId || priority || types.length !== Object.keys(ITEM_TYPES).length;

  return (
    <div className="org-stack">
      <div className="org-toolbar org-toolbar--split">
        <div className="org-segment" role="group" aria-label="Vista del calendario">
          {VIEWS.map(([value, label]) => (
            <button key={value} type="button" aria-pressed={view === value} onClick={() => setView(value)}>
              {label}
            </button>
          ))}
        </div>
        {['month', 'week', 'day'].includes(view) ? (
          <PeriodNav
            label={range.label}
            onPrev={() => move(-1)}
            onNext={() => move(1)}
            onToday={() => {
              setAnchor(today);
              setSelected(today);
            }}
          />
        ) : (
          <p className="org-period__label">{range.label}</p>
        )}
      </div>

      <details className="org-more org-calendar-filters" open={Boolean(filtersActive)}>
        <summary>Buscar y filtrar</summary>
        <div className="org-more__body">
          <SearchField label="Buscar en el calendario" value={query} onChange={setQuery} placeholder="Título, lugar, notas o etiqueta…" />
          <div className="org-chips" role="group" aria-label="Qué mostrar">
            {Object.entries(ITEM_TYPES).map(([type, label]) => (
              <button
                key={type}
                type="button"
                className={cx('org-chip', types.includes(type) && 'is-active')}
                aria-pressed={types.includes(type)}
                onClick={() => setTypes((list) => (list.includes(type) ? list.filter((t) => t !== type) : [...list, type]))}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="org-filters">
            <SelectField label="Categoría" value={categoryId} onChange={setCategoryId} placeholder="Todas" options={planner.categories.map((c) => ({ value: c.id, label: c.name }))} />
            <SelectField label="Prioridad" value={priority} onChange={setPriority} placeholder="Todas" options={Object.entries(PRIORITY_LABELS).map(([value, label]) => ({ value, label }))} />
          </div>
        </div>
      </details>

      {view === 'month' && (
        <>
          <div className="org-month" role="group" aria-label={range.label}>
            <div className="org-month__head" aria-hidden="true">
              {Array.from({ length: 7 }, (_, i) => (
                <span key={i} className="org-month__weekday">
                  {WEEKDAY_SHORT[(i + weekStartsOn) % 7]}
                </span>
              ))}
            </div>
            {range.weeks.map((week) => (
              <div key={week[0]} className="org-month__week">
                {week.map((day) => {
                  const dayItems = items.filter((i) => coversDay(i, day));
                  const outside = day.slice(0, 7) !== anchor.slice(0, 7);
                  return (
                    <button
                      key={day}
                      type="button"
                      className={cx('org-month__day', outside && 'is-outside', day === today && 'is-today', day === selected && 'is-selected')}
                      aria-pressed={day === selected}
                      aria-label={`${dayHeading(day)}${dayItems.length ? `, ${dayItems.length} ${dayItems.length === 1 ? 'elemento' : 'elementos'}` : ''}`}
                      onClick={() => setSelected(day)}
                      onDoubleClick={() => openEvent({ startDate: day })}
                    >
                      <span className="org-month__number">{Number(day.slice(8))}</span>
                      <span className="org-month__items" aria-hidden="true">
                        {dayItems.slice(0, 3).map((item) => (
                          <span key={item.key} className={cx('org-month__item', (item.status === 'completed' || item.status === 'done') && 'is-done')} style={{ '--item-color': planner.colorOf(item) }}>
                            {item.title}
                          </span>
                        ))}
                        {dayItems.length > 3 && <span className="org-month__more">+{dayItems.length - 3}</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <section className="org-panel org-dayboard" aria-labelledby="day-selected">
            <div className="org-section__header">
              <h2 id="day-selected" className="org-section__title">
                {dayHeading(selected)}
              </h2>
              <Button size="sm" variant="secondary" icon={CalendarPlus} onClick={() => openEvent({ startDate: selected })}>
                Evento este día
              </Button>
            </div>
            <DayList date={selected} items={items} emptyText="Nada programado para este día." />
          </section>
        </>
      )}

      {view === 'week' && (
        <div className="org-week">
          {Array.from({ length: 7 }, (_, i) => addDays(range.from, i)).map((day) => (
            <section key={day} className={cx('org-week__day', day === today && 'is-today')} aria-label={dayHeading(day)}>
              <h3 className="org-week__title">
                <span>{WEEKDAY_SHORT[weekdayOf(day)]}</span> {Number(day.slice(8))}
              </h3>
              <DayList date={day} items={items} emptyText="Libre" />
            </section>
          ))}
        </div>
      )}

      {view === 'day' && (
        <section className="org-panel" aria-label={dayHeading(anchor)}>
          <DayList date={anchor} items={items} emptyText="Nada programado para este día." />
        </section>
      )}

      {(view === 'agenda' || view === 'past') && (
        <>
          {grouped.length ? (
            grouped.map(([date, list]) => (
              <section key={date} aria-label={dayHeading(date)}>
                <h3 className={cx('org-group-title', date === today && 'is-today')}>{date === today ? `Hoy · ${dayHeading(date)}` : dayHeading(date)}</h3>
                <ul className="org-list">
                  {list.map((item) => (
                    <li key={item.key}>
                      <AgendaItem item={item} />
                    </li>
                  ))}
                </ul>
              </section>
            ))
          ) : (
            <EmptyState icon={CalendarSearch} title={view === 'past' ? 'Nada en este período' : 'Nada en los próximos días'}>
              {filtersActive ? 'Prueba quitando algún filtro.' : view === 'past' ? 'Los eventos que ya pasaron aparecerán aquí.' : 'Crea un evento, una tarea con fecha o una materia con horario.'}
            </EmptyState>
          )}
          {horizon < 730 && (
            <Button variant="ghost" onClick={() => setHorizon((h) => h + 60)}>
              {view === 'past' ? 'Ver más atrás' : 'Ver más adelante'}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
