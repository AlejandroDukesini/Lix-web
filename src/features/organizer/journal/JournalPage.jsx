import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import { BookHeart, CalendarDays, ChartColumn, Feather, LayoutTemplate } from 'lucide-react';
import { Button } from '../../../components/common/Button.jsx';
import { ModuleLayout } from '../shared/ui.jsx';
import { LockButton, PrivacyGate } from '../shared/PrivacyGate.jsx';
import { JournalList } from './views/JournalList.jsx';
import { EntryEditor, NewEntry } from './views/EntryEditor.jsx';
import { JournalCalendar } from './views/JournalCalendar.jsx';
import { JournalSummary } from './views/JournalSummary.jsx';
import { JournalTemplates } from './views/JournalTemplates.jsx';
import '../shared/organizer.css';
import '../planner/planner.css';
import '../notes/notes.css';
import './journal.css';

const TABS = [
  { to: '/diario', end: true, label: 'Entradas', icon: BookHeart },
  { to: '/diario/calendario', label: 'Calendario', icon: CalendarDays },
  { to: '/diario/resumen', label: 'Resumen', icon: ChartColumn },
  { to: '/diario/plantillas', label: 'Plantillas y ajustes', icon: LayoutTemplate },
];
const SECTIONS = new Set(['calendario', 'resumen', 'plantillas', 'nueva']);

export default function JournalPage() {
  const location = useLocation();
  const segment = location.pathname.split('/')[2];
  const editing = Boolean(segment) && !SECTIONS.has(segment);
  useEffect(() => {
    if (!editing) document.title = 'Diario · Un año más contigo';
  }, [editing]);
  return (
    <ModuleLayout
      eyebrow="Organización"
      title="Diario"
      description={editing ? undefined : 'Lo que vives y lo que piensas, a tu ritmo. Privado y solo en este dispositivo.'}
      tabs={editing ? undefined : TABS}
      className={editing ? 'org-page--editing' : undefined}
      actions={
        !editing && (
          <>
            <LockButton module="journal" />
            <Button to="/diario/nueva" icon={Feather}>
              Escribir
            </Button>
          </>
        )
      }
    >
      <PrivacyGate module="journal" title="El diario">
        <Routes>
          <Route index element={<JournalList />} />
          <Route path="calendario" element={<JournalCalendar />} />
          <Route path="resumen" element={<JournalSummary />} />
          <Route path="plantillas" element={<JournalTemplates />} />
          <Route path="nueva" element={<NewEntry />} />
          <Route path=":entryId" element={<EntryEditor />} />
          <Route path="*" element={<Navigate to="/diario" replace />} />
        </Routes>
      </PrivacyGate>
    </ModuleLayout>
  );
}
