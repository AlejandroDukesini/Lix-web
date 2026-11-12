import { useMemo, useState } from 'react';
import { ClipboardList, Plus } from 'lucide-react';
import { Button } from '../../../components/common/Button.jsx';
import { cx } from '../../../utils/cx.js';
import { ACTIVITY_TYPES } from '../../organizer/data/entities.js';
import { SelectField } from '../../organizer/shared/Fields.jsx';
import { EmptyState, SearchField } from '../../organizer/shared/ui.jsx';
import { ACTIVITY_LABELS } from '../../organizer/planner/agenda.js';
import { ActivityRow } from './ActivityRow.jsx';
import { usePlannerActions } from '../../organizer/planner/PlannerContext.js';
import { PENDING } from '../academicLogic.js';
import { useAcademic } from '../useAcademic.js';

const STATUS_FILTERS = [
  { value: 'pending', label: 'Pendientes' },
  { value: 'done', label: 'Hechas' },
  { value: 'cancelled', label: 'Canceladas' },
  { value: 'all', label: 'Todas' },
];

export function Activities() {
  const data = useAcademic();
  const { openActivity } = usePlannerActions();
  const [type, setType] = useState(null);
  const [status, setStatus] = useState('pending');
  const [subjectId, setSubjectId] = useState(null);
  const [query, setQuery] = useState('');

  const counts = useMemo(() => {
    const out = {};
    for (const a of data.activities) if (PENDING.has(a.status)) out[a.type] = (out[a.type] ?? 0) + 1;
    return out;
  }, [data.activities]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.activities
      .filter((a) => (!type || a.type === type) && (!subjectId || a.subjectId === subjectId))
      .filter((a) => (status === 'pending' ? PENDING.has(a.status) : status === 'all' ? true : a.status === status))
      .filter((a) => !q || `${a.title} ${a.description} ${a.notes}`.toLowerCase().includes(q))
      .sort((a, b) => (status === 'done' ? b.dueDate.localeCompare(a.dueDate) : `${a.dueDate}${a.dueTime ?? ''}`.localeCompare(`${b.dueDate}${b.dueTime ?? ''}`)));
  }, [data.activities, type, status, subjectId, query]);

  return (
    <div className="org-stack">
      <div className="acad-types" role="group" aria-label="Categoría">
        <button type="button" className={cx('org-chip', !type && 'is-active')} aria-pressed={!type} onClick={() => setType(null)}>
          Todas
        </button>
        {ACTIVITY_TYPES.map((t) => (
          <button key={t} type="button" className={cx('org-chip', type === t && 'is-active')} aria-pressed={type === t} onClick={() => setType(type === t ? null : t)}>
            {ACTIVITY_LABELS[t]}
            {counts[t] ? <span className="acad-count">{counts[t]}</span> : null}
          </button>
        ))}
      </div>
      <div className="org-toolbar acad-filters">
        <SearchField label="Buscar actividades" value={query} onChange={setQuery} />
        <SelectField label="Estado" value={status} onChange={setStatus} options={STATUS_FILTERS} />
        <SelectField label="Asignatura" value={subjectId} onChange={setSubjectId} placeholder="Todas" options={data.subjects.map((s) => ({ value: s.id, label: s.name }))} />
      </div>
      {list.length ? (
        <ul className="org-list">
          {list.map((a) => (
            <ActivityRow key={a.id} activity={a} />
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={ClipboardList}
          title={data.activities.length ? 'Nada con estos filtros' : 'Sin actividades todavía'}
          action={
            <Button icon={Plus} onClick={() => openActivity(type ? { type, subjectId } : subjectId ? { subjectId } : null)}>
              Nueva actividad
            </Button>
          }
        >
          Tareas, parciales, exámenes, exposiciones, proyectos, entregas, lecturas e investigaciones, con fecha, hora, prioridad y estado.
        </EmptyState>
      )}
    </div>
  );
}
