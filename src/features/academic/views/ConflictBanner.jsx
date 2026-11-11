import { CircleAlert } from 'lucide-react';
import { WEEKDAY_NAMES } from '../../organizer/planner/UniversityForms.jsx';
import { formatClock } from '../../organizer/shared/format.js';

/** Aviso de choques de horario (no bloquea: a veces se cruzan clases a propósito). */
export function ConflictBanner({ conflicts, hourCycle }) {
  if (!conflicts.length) return null;
  return (
    <div className="org-banner org-banner--warning" role="status">
      <CircleAlert aria-hidden="true" />
      <div>
        <strong>{conflicts.length === 1 ? 'Hay un choque de horario' : `Hay ${conflicts.length} choques de horario`}</strong>
        <ul className="acad-conflicts">
          {conflicts.map((c) => (
            <li key={`${c.a.key}-${c.b.key}`}>
              {WEEKDAY_NAMES[c.weekday]}: {c.a.subject.name} y {c.b.subject.name} coinciden de {formatClock(c.from, hourCycle)} a {formatClock(c.to, hourCycle)}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
