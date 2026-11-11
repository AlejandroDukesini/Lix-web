import { useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { BookOpen, CalendarDays, ClipboardList, Clock, LayoutDashboard, NotebookTabs, Plus } from 'lucide-react';
import { Button } from '../../components/common/Button.jsx';
import { ModuleLayout } from '../organizer/shared/ui.jsx';
import { PlannerActions } from '../organizer/planner/PlannerContext.js';
import { ActivityForm, SubjectForm } from '../organizer/planner/UniversityForms.jsx';
import { TaskForm } from '../organizer/planner/TaskForm.jsx';
import { Overview } from './views/Overview.jsx';
import { Subjects } from './views/Subjects.jsx';
import { Activities } from './views/Activities.jsx';
import { Schedule } from './views/Schedule.jsx';
import { AcademicCalendar } from './views/AcademicCalendar.jsx';
import { NotebookDetail, Notebooks } from './views/Notebooks.jsx';
import '../organizer/shared/organizer.css';
import '../organizer/planner/planner.css';
import './academic.css';

const TABS = [
  { to: '/academico', end: true, label: 'Resumen', icon: LayoutDashboard },
  { to: '/academico/asignaturas', label: 'Asignaturas', icon: BookOpen },
  { to: '/academico/actividades', label: 'Actividades', icon: ClipboardList },
  { to: '/academico/horario', label: 'Horario', icon: Clock },
  { to: '/academico/calendario', label: 'Calendario', icon: CalendarDays },
  { to: '/academico/cuadernos', label: 'Cuadernos', icon: NotebookTabs },
];

/**
 * Control académico: un organizador universitario sobre los mismos datos del Calendario
 * (materias y actividades), más festivos, eventos académicos y cuadernos por materia.
 * Lo que se crea aquí aparece también en el Calendario y en el panel del día, y al revés.
 */
export default function AcademicPage() {
  const [subject, setSubject] = useState(null);
  const [activity, setActivity] = useState(null);
  const [task, setTask] = useState(null);

  const actions = useMemo(
    () => ({
      openSubject: (initial) => setSubject({ initial }),
      openActivity: (initial) => setActivity({ initial }),
      openTask: (initial) => setTask({ initial }),
      openEvent: () => {},
      openItem: () => {},
    }),
    [],
  );

  useEffect(() => {
    document.title = 'Control académico · Un año más contigo';
  }, []);

  return (
    <PlannerActions.Provider value={actions}>
      <ModuleLayout
        eyebrow="Organización"
        title="Control académico"
        description="Asignaturas, entregas, parciales, horario, festivos y cuadernos. Lo mismo que ves en el Calendario, organizado para la universidad."
        tabs={TABS}
        actions={
          <Button icon={Plus} onClick={() => actions.openActivity(null)}>
            Nueva actividad
          </Button>
        }
      >
        <Routes>
          <Route index element={<Overview />} />
          <Route path="asignaturas" element={<Subjects />} />
          <Route path="actividades" element={<Activities />} />
          <Route path="horario" element={<Schedule />} />
          <Route path="calendario" element={<AcademicCalendar />} />
          <Route path="cuadernos" element={<Notebooks />} />
          <Route path="cuadernos/:notebookId" element={<NotebookDetail />} />
          <Route path="*" element={<Navigate to="/academico" replace />} />
        </Routes>
      </ModuleLayout>
      <SubjectForm open={Boolean(subject)} initial={subject?.initial} onClose={() => setSubject(null)} />
      <ActivityForm open={Boolean(activity)} initial={activity?.initial} onClose={() => setActivity(null)} />
      <TaskForm open={Boolean(task)} initial={task?.initial} onClose={() => setTask(null)} />
    </PlannerActions.Provider>
  );
}
