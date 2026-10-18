import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Archive, ArchiveRestore, Copy, FolderInput, Pin, PinOff, Plus, RotateCcw, Star, StarOff, StickyNote, Trash2 } from 'lucide-react';
import { Button } from '../../../../components/common/Button.jsx';
import { ConfirmDialog } from '../../../../components/common/Dialog.jsx';
import { cx } from '../../../../utils/cx.js';
import { createRecord, deleteRecord, duplicateRecord, updateRecord } from '../../data/store.js';
import { useRunner } from '../../data/hooks.js';
import { tagCounts } from '../../data/tags.js';
import { SelectField } from '../../shared/Fields.jsx';
import { ActionMenu, DeleteDialog, EmptyState, FormDialog, SearchField } from '../../shared/ui.jsx';
import { relativeTime } from '../../shared/format.js';
import { excerpt, matchesQuery } from '../../shared/text.js';
import { taskProgress } from '../../shared/markdown.js';
import { emptyTrash, inView, moveToTrash, restoreFromTrash, setArchived } from '../../shared/lifecycle.js';
import { useNotes } from '../useNotes.js';

const VIEWS = [
  ['all', 'Todas'],
  ['favorites', 'Favoritas'],
  ['archived', 'Archivadas'],
  ['trash', 'Papelera'],
];
const SORTS = {
  updated: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
  created: (a, b) => b.createdAt.localeCompare(a.createdAt),
  title: (a, b) => (a.title || '~').localeCompare(b.title || '~', 'es'),
};

function MoveDialog({ note, onClose }) {
  const data = useNotes();
  const run = useRunner();
  const [folderId, setFolderId] = useState(note?.folderId ?? null);
  if (!note) return null;
  return (
    <FormDialog
      open
      onClose={onClose}
      title="Mover a una carpeta"
      size="sm"
      submitLabel="Mover"
      onSubmit={async () => (await run(() => updateRecord(note.id, { folderId }), { success: 'Nota movida' })).ok}
    >
      <SelectField label="Carpeta" value={folderId} onChange={setFolderId} options={data.folderOptions} placeholder="Sin carpeta" />
    </FormDialog>
  );
}

export function NoteCard({ note }) {
  const data = useNotes();
  const run = useRunner();
  const [move, setMove] = useState(false);
  const [remove, setRemove] = useState(false);
  const progress = taskProgress(note.content);
  const category = data.categoriesById.get(note.categoryId);
  const title = note.title || excerpt(note.content, 60) || 'Nota sin título';
  const trashed = Boolean(note.trashedAt);
  return (
    <li className={cx('org-note', note.pinned && 'is-pinned')} style={note.color ? { '--note-color': note.color } : undefined}>
      <Link to={`/notas/${note.id}`} className="org-note__link">
        <span className="org-note__title">
          {note.pinned && <Pin aria-label="Fijada" width={14} height={14} />}
          {note.favorite && <Star aria-label="Favorita" width={14} height={14} />}
          {title}
        </span>
        {note.content && note.title && <span className="org-note__excerpt">{excerpt(note.content, 180)}</span>}
        <span className="org-note__meta">
          {note.folderId && data.foldersById.has(note.folderId) && <span>{data.path(note.folderId)}</span>}
          {category && <span>{category.name}</span>}
          {progress.total > 0 && (
            <span>
              {progress.done}/{progress.total} hechas
            </span>
          )}
          <span>{relativeTime(note.updatedAt)}</span>
        </span>
        {note.tags.length > 0 && (
          <span className="org-taglist">
            {note.tags.map((t) => (
              <span key={t}>#{t}</span>
            ))}
          </span>
        )}
      </Link>
      <ActionMenu
        label={`Acciones de «${title}»`}
        items={
          trashed
            ? [
                { label: 'Restaurar', icon: RotateCcw, onClick: () => run(() => restoreFromTrash(note.id), { success: 'Nota restaurada' }) },
                { label: 'Eliminar definitivamente', icon: Trash2, danger: true, onClick: () => setRemove(true) },
              ]
            : [
                { label: note.pinned ? 'Desfijar' : 'Fijar arriba', icon: note.pinned ? PinOff : Pin, onClick: () => run(() => updateRecord(note.id, { pinned: !note.pinned })) },
                { label: note.favorite ? 'Quitar de favoritas' : 'Marcar como favorita', icon: note.favorite ? StarOff : Star, onClick: () => run(() => updateRecord(note.id, { favorite: !note.favorite })) },
                { label: 'Mover a carpeta', icon: FolderInput, onClick: () => setMove(true) },
                { label: 'Duplicar', icon: Copy, onClick: () => run(() => duplicateRecord(note.id, { pinned: false }), { success: 'Nota duplicada' }) },
                { label: note.archived ? 'Desarchivar' : 'Archivar', icon: note.archived ? ArchiveRestore : Archive, onClick: () => run(() => setArchived(note.id, !note.archived), { success: note.archived ? 'Nota desarchivada' : 'Nota archivada' }) },
                {
                  label: 'Mover a la papelera',
                  icon: Trash2,
                  danger: true,
                  onClick: () => run(() => moveToTrash(note.id), { success: 'Nota en la papelera', undo: { label: 'Deshacer', onClick: () => restoreFromTrash(note.id) } }),
                },
              ]
        }
      />
      {move && <MoveDialog note={note} onClose={() => setMove(false)} />}
      <DeleteDialog
        open={remove}
        recordId={note.id}
        title="¿Eliminar la nota definitivamente?"
        onCancel={() => setRemove(false)}
        onConfirm={async () => {
          const { ok } = await run(() => deleteRecord(note.id), { success: 'Nota eliminada' });
          if (ok) setRemove(false);
        }}
      />
    </li>
  );
}

export function NotesList() {
  const data = useNotes();
  const run = useRunner();
  const navigate = useNavigate();
  const [view, setView] = useState('all');
  const [query, setQuery] = useState('');
  const [folderId, setFolderId] = useState(null);
  const [categoryId, setCategoryId] = useState(null);
  const [collectionId, setCollectionId] = useState(null);
  const [tag, setTag] = useState(null);
  const [sort, setSort] = useState('updated');
  const [quick, setQuick] = useState('');
  const [confirmEmpty, setConfirmEmpty] = useState(false);

  const tags = useMemo(() => tagCounts(data.notes.filter((n) => !n.trashedAt)), [data.notes]);
  const visible = useMemo(() => {
    const folders = folderId ? data.descendants(folderId) : null;
    return data.notes
      .filter((n) => inView(n, view))
      .filter((n) => !folders || folders.has(n.folderId))
      .filter((n) => !categoryId || n.categoryId === categoryId)
      .filter((n) => !collectionId || n.collectionIds.includes(collectionId))
      .filter((n) => !tag || n.tags.some((t) => t.toLocaleLowerCase('es') === tag.toLocaleLowerCase('es')))
      .filter((n) => matchesQuery(query, n.title, n.content, n.tags))
      .sort((a, b) => (view === 'all' ? Number(b.pinned) - Number(a.pinned) : 0) || SORTS[sort](a, b));
  }, [data, view, folderId, categoryId, collectionId, tag, query, sort]);
  const trashCount = data.notes.filter((n) => n.trashedAt).length;

  const addQuick = async (event) => {
    event.preventDefault();
    const text = quick.trim();
    if (!text) return;
    // Primera línea como título si es corta; el resto como contenido.
    const [first, ...rest] = text.split('\n');
    const short = first.length <= 80;
    const { ok } = await run(
      () => createRecord('note', { title: short ? first : '', content: short ? rest.join('\n') : text, folderId, categoryId, collectionIds: collectionId ? [collectionId] : [] }),
      { success: 'Nota guardada' },
    );
    if (ok) setQuick('');
  };

  return (
    <div className="org-stack">
      <form className="org-quicknote" onSubmit={addQuick}>
        <label htmlFor="quick-note" className="sr-only">
          Nota rápida
        </label>
        <textarea
          id="quick-note"
          className="field__control"
          rows={2}
          value={quick}
          onChange={(e) => setQuick(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) addQuick(e);
          }}
          placeholder="Nota rápida: escribe y pulsa Guardar (o Ctrl+Enter)…"
          maxLength={20000}
        />
        <div className="org-toolbar">
          <Button type="submit" size="sm" disabled={!quick.trim()}>
            Guardar
          </Button>
          <Button variant="secondary" size="sm" icon={Plus} onClick={() => navigate(`/notas/nueva${folderId ? `?carpeta=${folderId}` : ''}`)}>
            Nota completa
          </Button>
        </div>
      </form>

      <div className="org-toolbar org-toolbar--split">
        <div className="org-segment" role="group" aria-label="Mostrar notas">
          {VIEWS.map(([value, label]) => (
            <button key={value} type="button" aria-pressed={view === value} onClick={() => setView(value)}>
              {label}
              {value === 'trash' && trashCount > 0 && <span className="org-count">{trashCount}</span>}
            </button>
          ))}
        </div>
        {view === 'trash' && trashCount > 0 && (
          <Button variant="danger" size="sm" icon={Trash2} onClick={() => setConfirmEmpty(true)}>
            Vaciar papelera
          </Button>
        )}
      </div>
      <SearchField label="Buscar notas" value={query} onChange={setQuery} placeholder="Buscar en títulos y contenido…" />
      <div className="org-filters">
        <SelectField label="Carpeta" value={folderId} onChange={setFolderId} placeholder="Todas" options={data.folderOptions} />
        <SelectField label="Categoría" value={categoryId} onChange={setCategoryId} placeholder="Todas" options={data.categories.map((c) => ({ value: c.id, label: c.name }))} />
        <SelectField label="Colección" value={collectionId} onChange={setCollectionId} placeholder="Todas" options={data.collections.map((c) => ({ value: c.id, label: c.name }))} />
        <SelectField label="Etiqueta" value={tag} onChange={setTag} placeholder="Todas" options={tags.map((t) => ({ value: t.tag, label: `#${t.tag} (${t.count})` }))} />
        <SelectField
          label="Ordenar por"
          value={sort}
          onChange={(v) => setSort(v ?? 'updated')}
          options={[
            { value: 'updated', label: 'Última modificación' },
            { value: 'created', label: 'Fecha de creación' },
            { value: 'title', label: 'Título' },
          ]}
        />
      </div>
      {view === 'trash' && <p className="org-subtle">Las notas de la papelera no se borran solas: restáuralas o elimínalas cuando quieras.</p>}
      {visible.length ? (
        <ul className="org-notes">
          {visible.map((note) => (
            <NoteCard key={note.id} note={note} />
          ))}
        </ul>
      ) : (
        <EmptyState icon={StickyNote} title={view === 'trash' ? 'La papelera está vacía' : data.notes.length ? 'Nada coincide' : 'Tu bloc está en blanco'}>
          {view === 'trash' ? 'Lo que envíes a la papelera esperará aquí hasta que decidas.' : data.notes.length ? 'Prueba con otra búsqueda o quita algún filtro.' : 'Escribe una nota rápida arriba o crea una nota completa con formato.'}
        </EmptyState>
      )}
      <ConfirmDialog
        open={confirmEmpty}
        title="¿Vaciar la papelera?"
        description={`Se eliminarán definitivamente ${trashCount} ${trashCount === 1 ? 'nota' : 'notas'}. No se puede deshacer.`}
        confirmLabel="Vaciar"
        onConfirm={async () => {
          await run(() => emptyTrash('note'), { success: 'Papelera vacía' });
          setConfirmEmpty(false);
        }}
        onCancel={() => setConfirmEmpty(false)}
      />
    </div>
  );
}
