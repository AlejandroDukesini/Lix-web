import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import { FolderTree, Plus, StickyNote } from 'lucide-react';
import { Button } from '../../../components/common/Button.jsx';
import { ModuleLayout } from '../shared/ui.jsx';
import { NotesList } from './views/NotesList.jsx';
import { NewNote, NoteEditor } from './views/NoteEditor.jsx';
import { NotesOrganize } from './views/NotesOrganize.jsx';
import '../shared/organizer.css';
import './notes.css';

const TABS = [
  { to: '/notas', end: true, label: 'Notas', icon: StickyNote },
  { to: '/notas/organizar', label: 'Carpetas y etiquetas', icon: FolderTree },
];

export default function NotesPage() {
  const location = useLocation();
  const editing = /^\/notas\/(?!organizar$)[^/]+$/.test(location.pathname);
  useEffect(() => {
    if (!editing) document.title = 'Notas · Un año más contigo';
  }, [editing]);
  return (
    <ModuleLayout
      eyebrow="Organización"
      title="Notas"
      description={editing ? undefined : 'Un espacio para escribir lo que sea: listas, apuntes, ideas. Se guarda solo, mientras escribes.'}
      tabs={editing ? undefined : TABS}
      className={editing ? 'org-page--editing' : undefined}
      actions={
        !editing && (
          <Button to="/notas/nueva" icon={Plus}>
            Nueva nota
          </Button>
        )
      }
    >
      <Routes>
        <Route index element={<NotesList />} />
        <Route path="organizar" element={<NotesOrganize />} />
        <Route path="nueva" element={<NewNote />} />
        <Route path=":noteId" element={<NoteEditor />} />
        <Route path="*" element={<Navigate to="/notas" replace />} />
      </Routes>
    </ModuleLayout>
  );
}
