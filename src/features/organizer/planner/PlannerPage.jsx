import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router';
import { CalendarDays, CalendarPlus, GraduationCap, ListTodo, Settings2 } from 'lucide-react';
import { Button } from '../../../components/common/Button.jsx';
import { ModuleLayout } from '../shared/ui.jsx';
import { PlannerActions } from './PlannerContext.js';
import { EventForm } from './EventForm.jsx';
import { TaskForm } from './TaskForm.jsx';
import { ActivityForm, SubjectForm } from './UniversityForms.jsx';
import { ItemDialog } from './ItemDialog.jsx';
import { CalendarView } from './views/CalendarView.jsx';
import { Tasks } from './views/Tasks.jsx';
import { University } from './views/University.jsx';
import { PlannerSettings } from './views/PlannerSettings.jsx';
import { usePlanner } from './usePlanner.js';
import '../shared/organizer.css';
import './planner.css';

const TABS = [
  { to: '/calendario', end: true, label: 'Calendario', icon: CalendarDays },
  { to: '/calendario/tareas', label: 'Tareas', icon: ListTodo },
  { to: '/calendario/universidad', label: 'Universidad', icon: GraduationCap },
  { to: '/calendario/ajustes', label: 'Ajustes', icon: Settings2 },
];

export default function PlannerPage() {
  const planner = usePlanner();
  const location = useLocation();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null); // { initial, occurrence }
  const [task, setTask] = useState(null);
  const [activity, setActivity] = useState(null);
  const [subject, setSubject] = useState(null);
  const [item, setItem] = useState(null);

  const actions = useMemo(
    () => ({
      openEvent: (initial, occurrence = null) => setEvent({ initial, occurrence }),
      openTask: (initial) => setTask({ initial }),
      openActivity: (initial) => setActivity({ initial }),
      openSubject: (initial) => setSubject({ initial }),
      openItem: (selected) => setItem(selected),
    }),
    [],
  );

  // El detalle se recalcula con los datos actuales (tras completar, editar o borrar).
  const freshItem = useMemo(() => {
    if (!item) return null;
    return planner.agenda(item.date, item.date, { class: true, task: true, activity: true, payment: true }).find((i) => i.key === item.key) ?? null;
  }, [item, planner]);
  const closeItem = useCallback(() => setItem(null), []);

  // Accesos directos: #/calendario?nuevo=evento|tarea
  useEffect(() => {
    const what = new URLSearchParams(location.search).get('nuevo');
    if (!what) return;
    if (what === 'tarea') actions.openTask(null);
    else actions.openEvent({ startDate: planner.today });
    navigate(location.pathname, { replace: true });
  }, [location.search, location.pathname, navigate, actions, planner.today]);

  useEffect(() => {
    document.title = 'Calendario · Un año más contigo';
  }, []);

  return (
    <PlannerActions.Provider value={actions}>
      <ModuleLayout
        eyebrow="Organización"
        title="Calendario"
        description="Clases, entregas, tareas, citas y pagos en un mismo lugar."
        tabs={TABS}
        actions={
          <Button icon={CalendarPlus} onClick={() => actions.openEvent({ startDate: planner.today })}>
            Nuevo evento
          </Button>
        }
      >
        <Routes>
          <Route index element={<CalendarView />} />
          <Route path="tareas" element={<Tasks />} />
          <Route path="universidad" element={<University />} />
          <Route path="ajustes" element={<PlannerSettings />} />
          <Route path="*" element={<Navigate to="/calendario" replace />} />
        </Routes>
        <EventForm open={Boolean(event)} initial={event?.initial} occurrence={event?.occurrence} onClose={() => setEvent(null)} />
        <TaskForm open={Boolean(task)} initial={task?.initial} onClose={() => setTask(null)} />
        <ActivityForm open={Boolean(activity)} initial={activity?.initial} onClose={() => setActivity(null)} />
        <SubjectForm open={Boolean(subject)} initial={subject?.initial} onClose={() => setSubject(null)} />
        {freshItem && <ItemDialog item={freshItem} onClose={closeItem} />}
      </ModuleLayout>
    </PlannerActions.Provider>
  );
}
