import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { ArrowLeft, FilePlus2, NotebookTabs, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '../../../components/common/Button.jsx';
import { commit, deleteRecord } from '../../organizer/data/store.js';
import { useRecord, useRunner } from '../../organizer/data/hooks.js';
import { ColorPicker, InputField, SelectField, TextAreaField } from '../../organizer/shared/Fields.jsx';
import { ActionMenu, DeleteDialog, EmptyState, FormDialog, SearchField, Section } from '../../organizer/shared/ui.jsx';
import { shortDate } from '../../organizer/shared/format.js';
import { notebookNotes } from '../academicLogic.js';
import { useAcademic } from '../useAcademic.js';

function NotebookForm({ open, initial, onClose }) {
  const data = useAcademic();
  const run = useRunner();
  const isEdit = Boolean(initial?.id);
  const [draft, setDraft] = useState(null);
  const [errors, setErrors] = useState(null);
  if (open && !draft) setDraft({ name: initial?.name ?? '', subjectId: initial?.subjectId ?? null, color: initial?.color ?? '#8e5bd8', description: initial?.description ?? '' });
  if (!open && draft) setDraft(null);
  if (!draft) return null;
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const submit = async () => {
    const { ok, errors: e } = await run(() => commit((tx) => (isEdit ? tx.update(initial.id, draft) : tx.create('notebook', draft))), { success: isEdit ? 'Cuaderno actualizado' : 'Cuaderno creado' });
    setErrors(e);
    return ok;
  };
  return (
    <FormDialog open={open} onClose={onClose} title={isEdit ? 'Editar cuaderno' : 'Nuevo cuaderno'} onSubmit={submit} errors={errors}>
      <InputField label="Nombre" value={draft.name} onChange={(name) => set({ name })} error={errors?.name} maxLength={80} autoFocus />
      <SelectField
        label="Asignatura"
        value={draft.subjectId}
        onChange={(subjectId) => {
          const subject = data.subjectsById.get(subjectId);
          set({ subjectId, ...(subject && !draft.name ? { name: subject.name, color: subject.color } : {}) });
        }}
        placeholder="Sin asignatura"
        options={data.subjects.filter((s) => !s.archived || s.id === draft.subjectId).map((s) => ({ value: s.id, label: s.name }))}
      />
      <TextAreaField label="Descripción" value={draft.description} onChange={(description) => set({ description })} rows={2} maxLength={280} />
      <ColorPicker value={draft.color} onChange={(color) => set({ color })} />
    </FormDialog>
  );
}

export function Notebooks() {
  const data = useAcademic();
  const [form, setForm] = useState(null);
  const groups = [...data.activeSubjects, null]
    .map((subject) => ({ subject, notebooks: data.notebooks.filter((n) => (subject ? n.subjectId === subject.id : !data.subjectsById.get(n.subjectId) || data.subjectsById.get(n.subjectId)?.archived)) }))
    .filter((g) => g.notebooks.length);

  return (
    <div className="org-stack">
      <div className="org-toolbar">
        <Button icon={Plus} onClick={() => setForm({ initial: null })}>
          Nuevo cuaderno
        </Button>
      </div>
      {groups.length ? (
        groups.map(({ subject, notebooks }) => (
          <Section key={subject?.id ?? 'otros'} title={subject ? subject.name : 'Otros cuadernos'}>
            <ul className="acad-notebooks">
              {notebooks.map((n) => {
                const count = data.notes.filter((note) => note.notebookId === n.id && !note.trashedAt).length;
                return (
                  <li key={n.id}>
                    <Link to={`/academico/cuadernos/${n.id}`} className="acad-notebook" style={{ '--item-color': n.color ?? subject?.color }}>
                      <span className="acad-notebook__spine" aria-hidden="true" />
                      <span className="acad-notebook__name">{n.name}</span>
                      <span className="org-subtle">{count === 1 ? '1 nota' : `${count} notas`}</span>
                      {n.description && <span className="org-subtle acad-notebook__desc">{n.description}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Section>
        ))
      ) : (
        <EmptyState
          icon={NotebookTabs}
          title="Sin cuadernos todavía"
          action={
            <Button icon={Plus} onClick={() => setForm({ initial: null })}>
              Crear un cuaderno
            </Button>
          }
        >
          Un cuaderno por asignatura para tus apuntes de clase. Sus notas usan el mismo editor que Notas (Markdown, guardado automático, casillas).
        </EmptyState>
      )}
      <NotebookForm open={Boolean(form)} initial={form?.initial} onClose={() => setForm(null)} />
    </div>
  );
}

export function NotebookDetail() {
  const { notebookId } = useParams();
  const notebook = useRecord(notebookId);
  const data = useAcademic();
  const run = useRunner();
  const [query, setQuery] = useState('');
  const [edit, setEdit] = useState(false);
  const [remove, setRemove] = useState(false);
  if (!notebook || notebook.kind !== 'notebook') return <Navigate to="/academico/cuadernos" replace />;
  const subject = data.subjectsById.get(notebook.subjectId);
  const notes = notebookNotes(data.notes, notebook.id, query);
  const total = data.notes.filter((n) => n.notebookId === notebook.id && !n.trashedAt).length;

  return (
    <div className="org-stack">
      <div className="org-toolbar org-toolbar--split">
        <Button to="/academico/cuadernos" variant="ghost" size="sm" icon={ArrowLeft}>
          Cuadernos
        </Button>
        <div className="org-toolbar__end">
          <Button to={`/notas/nueva?cuaderno=${notebook.id}`} icon={FilePlus2}>
            Nueva nota
          </Button>
          <ActionMenu
            label="Acciones del cuaderno"
            items={[
              { label: 'Editar cuaderno', icon: Pencil, onClick: () => setEdit(true) },
              { label: 'Eliminar cuaderno', icon: Trash2, danger: true, onClick: () => setRemove(true) },
            ]}
          />
        </div>
      </div>
      <header className="acad-notebook-head" style={{ '--item-color': notebook.color ?? subject?.color }}>
        <h2>{notebook.name}</h2>
        <p className="org-subtle">
          {subject ? subject.name : 'Sin asignatura'} · {total === 1 ? '1 nota' : `${total} notas`}
        </p>
        {notebook.description && <p>{notebook.description}</p>}
      </header>
      {total > 0 && <SearchField label="Buscar en el cuaderno" value={query} onChange={setQuery} placeholder="Buscar en títulos y contenido…" />}
      {notes.length ? (
        <ul className="acad-pages">
          {notes.map((note) => (
            <li key={note.id}>
              <Link to={`/notas/${note.id}`} className="acad-page">
                <span className="acad-page__date">{shortDate(note.noteDate ?? note.updatedAt.slice(0, 10))}</span>
                <span className="acad-page__title">{note.title || 'Sin título'}</span>
                <span className="org-subtle acad-page__excerpt">{note.content.replace(/[#*_>`[\]-]/g, '').slice(0, 140) || 'Vacía'}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={NotebookTabs} title={total ? 'Ninguna nota coincide' : 'Cuaderno vacío'}>
          {total ? 'Prueba con otras palabras.' : 'Pulsa «Nueva nota» para escribir tus apuntes. Puedes ponerle la fecha de la clase.'}
        </EmptyState>
      )}
      <NotebookForm open={edit} initial={notebook} onClose={() => setEdit(false)} />
      <DeleteDialog
        open={remove}
        recordId={notebook.id}
        title={`¿Eliminar el cuaderno «${notebook.name}»?`}
        extraWarning={total ? <p>Sus {total} notas no se borran: siguen en Notas, sin cuaderno.</p> : null}
        onCancel={() => setRemove(false)}
        onConfirm={async () => {
          const { ok } = await run(() => deleteRecord(notebook.id), { success: 'Cuaderno eliminado' });
          if (ok) setRemove(false);
        }}
      />
    </div>
  );
}
