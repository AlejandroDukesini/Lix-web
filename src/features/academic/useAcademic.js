import { useMemo } from 'react';
import { useKind, useSettings } from '../organizer/data/hooks.js';
import { usePlanner } from '../organizer/planner/usePlanner.js';
import { scheduleConflicts } from './academicLogic.js';

/** Datos del Control académico: los del calendario + fechas académicas, cuadernos y notas. */
export function useAcademic() {
  const planner = usePlanner();
  const academicDates = useKind('academicDate');
  const notebooks = useKind('notebook');
  const notes = useKind('note');
  const settings = useSettings('academicSettings');
  return useMemo(() => {
    const activeSubjects = planner.subjects.filter((s) => !s.archived).sort((a, b) => a.name.localeCompare(b.name, 'es'));
    return {
      ...planner,
      activeSubjects,
      academicDates,
      notebooks,
      notes,
      academicSettings: settings,
      conflicts: scheduleConflicts(planner.subjects),
    };
  }, [planner, academicDates, notebooks, notes, settings]);
}
