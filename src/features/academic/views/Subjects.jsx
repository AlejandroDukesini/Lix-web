import { useState } from 'react';
import { Archive, ArchiveRestore, BookOpen, ClipboardList, GraduationCap, MapPin, NotebookPen, Pencil, Plus, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Button } from '../../../components/common/Button.jsx';
import { createRecord, deleteRecord, updateRecord } from '../../organizer/data/store.js';
import { useRunner } from '../../organizer/data/hooks.js';
import { ActionMenu, DeleteDialog, EmptyState } from '../../organizer/shared/ui.jsx';
import { daysFromToday, formatClock } from '../../organizer/shared/format.js';
import { WEEKDAY_NAMES } from '../../organizer/planner/UniversityForms.jsx';
import { usePlannerActions } from '../../organizer/planner/PlannerContext.js';
import { PENDING } from '../academicLogic.js';
import { useAcademic } from '../useAcademic.js';
import { ConflictBanner } from './ConflictBanner.jsx';

export function Subjects() {
  const data = useAcademic();
  const run = useRunner();
  const navigate = useNavigate();
  const { openSubject, openActivity } = usePlannerActions();
  const [showArchived, setShowArchived] = useState(false);
  const [remove, setRemove] = useState(null);
  const subjects = data.subjects.filter((s) => Boolean(s.archived) === showArchived).sort((a, b) => a.name.localeCompare(b.name, 'es'));

  const openNotebook = async (subject) => {
    const existing = data.notebooks.find((n) => n.subjectId === subject.id);
    if (existing) return navigate(`/academico/cuadernos/${existing.id}`);
    const { ok, result } = await run(() => createRecord('notebook', { name: subject.name, subjectId: subject.id, color: subject.color }), { success: 'Cuaderno creado' });
    if (ok) navigate(`/academico/cuadernos/${result.id}`);
    return undefined;
  };

  return (
    <div className="org-stack">
      <div className="org-toolbar">
        <Button icon={Plus} onClick={() => openSubject(null)}>
          Nueva asignatura
        </Button>
        {data.subjects.some((s) => s.archived) && (
          <Button variant="ghost" onClick={() => setShowArchived((v) => !v)} aria-pressed={showArchived}>
            {showArchived ? 'Ver actuales' : 'Ver archivadas'}
          </Button>
        )}
      </div>
      {!showArchived && <ConflictBanner conflicts={data.conflicts} hourCycle={data.hourCycle} />}
      {subjects.length ? (
        <ul className="org-grid org-list">
          {subjects.map((s) => {
            const pending = data.activities.filter((a) => a.subjectId === s.id && PENDING.has(a.status)).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
            return (
              <li key={s.id} className="org-panel acad-subject" style={{ '--item-color': s.color }}>
                <div className="acad-subject__head">
                  <span className="acad-subject__swatch" aria-hidden="true">
                    <BookOpen />
                  </span>
                  <div className="acad-subject__titles">
                    <h3 className="org-row__title">{s.name}</h3>
                    <p className="org-subtle">{[s.code, s.semester].filter(Boolean).join(' · ') || 'Sin código'}</p>
                  </div>
                  <ActionMenu
                    label={`Acciones de ${s.name}`}
                    items={[
                      { label: 'Editar', icon: Pencil, onClick: () => openSubject(s) },
                      { label: 'Nueva actividad', icon: ClipboardList, onClick: () => openActivity({ subjectId: s.id }) },
                      { label: 'Abrir su cuaderno', icon: NotebookPen, onClick: () => openNotebook(s) },
                      {
                        label: s.archived ? 'Restaurar' : 'Archivar (terminó el semestre)',
                        icon: s.archived ? ArchiveRestore : Archive,
                        onClick: () => run(() => updateRecord(s.id, { archived: !s.archived }), { success: s.archived ? 'Asignatura restaurada' : 'Asignatura archivada: sus clases dejan de aparecer' }),
                      },
                      { label: 'Eliminar', icon: Trash2, danger: true, onClick: () => setRemove(s) },
                    ]}
                  />
                </div>
                {s.description && <p className="acad-subject__desc">{s.description}</p>}
                <dl className="acad-facts">
                  {s.teacher && (
                    <>
                      <dt>Profesor/a</dt>
                      <dd>
                        {s.teacher}
                        {s.teacherContact && <span className="org-subtle"> · {s.teacherContact}</span>}
                      </dd>
                    </>
                  )}
                  {(s.room || s.building) && (
                    <>
                      <dt>Aula</dt>
                      <dd className="acad-place">
                        <MapPin aria-hidden="true" /> {[s.room, s.building].filter(Boolean).join(' · ')}
                      </dd>
                    </>
                  )}
                  {s.schedule.length > 0 && (
                    <>
                      <dt>Horario</dt>
                      <dd>
                        {s.schedule
                          .map((slot) => `${WEEKDAY_NAMES[slot.weekday].slice(0, 3)} ${formatClock(slot.start, data.hourCycle)}–${formatClock(slot.end, data.hourCycle)}${slot.room ? ` (${slot.room})` : ''}`)
                          .join(' · ')}
                      </dd>
                    </>
                  )}
                </dl>
                <p className="org-subtle">{pending.length ? `${pending.length} pendientes · próxima: ${pending[0].title} (${daysFromToday(pending[0].dueDate, data.today)})` : 'Nada pendiente'}</p>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          icon={GraduationCap}
          title={showArchived ? 'No hay asignaturas archivadas' : 'Sin asignaturas todavía'}
          action={
            !showArchived && (
              <Button icon={Plus} onClick={() => openSubject(null)}>
                Añadir una asignatura
              </Button>
            )
          }
        >
          Registra nombre, color, profesor, aula, edificio y horario. Sus clases y entregas aparecerán también en el Calendario.
        </EmptyState>
      )}
      <DeleteDialog
        open={Boolean(remove)}
        recordId={remove?.id}
        title={`¿Eliminar «${remove?.name}»?`}
        alternative={remove && !remove.archived ? { label: 'Archivar en su lugar', onClick: () => run(() => updateRecord(remove.id, { archived: true }), { success: 'Asignatura archivada' }).then(() => setRemove(null)) } : undefined}
        onCancel={() => setRemove(null)}
        onConfirm={async () => {
          const { ok } = await run(() => deleteRecord(remove.id), { success: 'Asignatura eliminada' });
          if (ok) setRemove(null);
        }}
      />
    </div>
  );
}
