import { Clock, Plus } from 'lucide-react';
import { Button } from '../../../components/common/Button.jsx';
import { cx } from '../../../utils/cx.js';
import { useNow } from '../../../hooks/useNow.js';
import { EmptyState, Section } from '../../organizer/shared/ui.jsx';
import { formatClock } from '../../organizer/shared/format.js';
import { WEEKDAY_NAMES } from '../../organizer/planner/UniversityForms.jsx';
import { usePlannerActions } from '../../organizer/planner/PlannerContext.js';
import { minutes, weekGrid } from '../academicLogic.js';
import { useAcademic } from '../useAcademic.js';
import { ConflictBanner } from './ConflictBanner.jsx';

const HOUR_PX = 56;

/** Horario semanal: columnas por día, una fila por hora y cada clase a su altura real. */
export function Schedule() {
  const data = useAcademic();
  const now = useNow(60_000);
  const { openSubject } = usePlannerActions();
  const grid = weekGrid(data.subjects);
  const hasSlots = grid.columns.some((c) => c.slots.length);
  const hours = [];
  for (let m = grid.from; m < grid.to; m += 60) hours.push(m);
  const conflictKeys = new Set(data.conflicts.flatMap((c) => [c.a.key, c.b.key]));
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  if (!hasSlots) {
    return (
      <EmptyState
        icon={Clock}
        title="Tu horario está vacío"
        action={
          <Button icon={Plus} onClick={() => openSubject(null)}>
            Añadir una asignatura con horario
          </Button>
        }
      >
        Al crear o editar una asignatura, añade sus clases (día, hora de inicio y fin, aula y edificio).
      </EmptyState>
    );
  }

  return (
    <div className="org-stack">
      <ConflictBanner conflicts={data.conflicts} hourCycle={data.hourCycle} />
      <Section title="Semana de clases" description="Las clases que se cruzan aparecen lado a lado y marcadas.">
        <div className="acad-week" style={{ '--days': grid.days.length, '--rows': hours.length, '--hour': `${HOUR_PX}px` }}>
          <div className="acad-week__corner" aria-hidden="true" />
          {grid.columns.map((col) => (
            <div key={col.weekday} className={cx('acad-week__dayname', now.getDay() === col.weekday && 'is-today')}>
              {WEEKDAY_NAMES[col.weekday]}
            </div>
          ))}
          <div className="acad-week__hours" aria-hidden="true">
            {hours.map((m) => (
              <span key={m} style={{ top: (m - grid.from) * (HOUR_PX / 60) }}>
                {formatClock(`${String(m / 60).padStart(2, '0')}:00`, data.hourCycle)}
              </span>
            ))}
          </div>
          {grid.columns.map((col) => (
            <ul key={col.weekday} className={cx('acad-week__col', now.getDay() === col.weekday && 'is-today')} aria-label={WEEKDAY_NAMES[col.weekday]}>
              {now.getDay() === col.weekday && nowMinutes >= grid.from && nowMinutes <= grid.to && <li className="acad-week__now" aria-hidden="true" style={{ top: (nowMinutes - grid.from) * (HOUR_PX / 60) }} />}
              {col.slots.map((slot) => (
                <li
                  key={slot.key}
                  className={cx('acad-week__slot', conflictKeys.has(slot.key) && 'is-conflict')}
                  style={{
                    '--item-color': slot.subject.color,
                    top: (minutes(slot.start) - grid.from) * (HOUR_PX / 60),
                    height: Math.max(22, (minutes(slot.end) - minutes(slot.start)) * (HOUR_PX / 60) - 2),
                    left: `${(slot.lane / slot.lanes) * 100}%`,
                    width: `${100 / slot.lanes}%`,
                  }}
                >
                  <button type="button" onClick={() => openSubject(slot.subject)} aria-label={`${slot.subject.name}, ${formatClock(slot.start, data.hourCycle)} a ${formatClock(slot.end, data.hourCycle)}${slot.room ? `, aula ${slot.room}` : ''}${conflictKeys.has(slot.key) ? ', choca con otra clase' : ''}`}>
                    <span className="acad-week__name">{slot.subject.name}</span>
                    <span className="acad-week__meta">
                      {formatClock(slot.start, data.hourCycle)}–{formatClock(slot.end, data.hourCycle)}
                    </span>
                    {(slot.room || slot.building) && <span className="acad-week__meta">{[slot.room, slot.building].filter(Boolean).join(' · ')}</span>}
                  </button>
                </li>
              ))}
            </ul>
          ))}
        </div>
      </Section>
    </div>
  );
}
