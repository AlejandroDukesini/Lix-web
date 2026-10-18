import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router';
import { Archive, ArchiveRestore, ArrowLeft, BookOpenText, Copy, PenLine, Pin, PinOff, RotateCcw, Star, Trash2 } from 'lucide-react';
import { Button, IconButton } from '../../../../components/common/Button.jsx';
import { commit, createRecord, deleteRecord, duplicateRecord, getRecord, updateRecord } from '../../data/store.js';
import { useRecord, useRunner } from '../../data/hooks.js';
import { ChipGroup, ColorPicker, SelectField, TagsField } from '../../shared/Fields.jsx';
import { MarkdownEditor } from '../../shared/MarkdownEditor.jsx';
import { ActionMenu, SaveIndicator } from '../../shared/ui.jsx';
import { useAutosave } from '../../shared/useAutosave.js';
import { dateTimeLabel, shortDate } from '../../shared/format.js';
import { tagCounts } from '../../data/tags.js';
import { moveToTrash, restoreFromTrash, setArchived } from '../../shared/lifecycle.js';
import { useNotes } from '../useNotes.js';

const openEditors = new Map();
const FIELDS = ['title', 'content', 'folderId', 'categoryId', 'collectionIds', 'tags', 'color', 'eventId'];

/** /notas/nueva: crea la nota (con carpeta o evento de origen) y abre el editor. */
export function NewNote() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const folderId = params.get('carpeta');
    const eventId = params.get('evento');
    createRecord('note', {
      title: eventId ? `Notas: ${getRecord(eventId)?.title ?? ''}`.slice(0, 160) : '',
      folderId: getRecord(folderId) ? folderId : null,
      eventId: getRecord(eventId) ? eventId : null,
    }).then((note) => navigate(`/notas/${note.id}?nueva=1`, { replace: true }));
  }, [params, navigate]);
  return <div className="org-loading" role="status" aria-label="Creando nota" />;
}

export function NoteEditor() {
  const { noteId } = useParams();
  const [params] = useSearchParams();
  const note = useRecord(noteId);
  if (!note || note.kind !== 'note') return <Navigate to="/notas" replace />;
  return <Editor key={note.id} note={note} isNew={params.get('nueva') === '1'} />;
}

function Editor({ note, isNew }) {
  const data = useNotes();
  const run = useRunner();
  const navigate = useNavigate();
  const [mode, setMode] = useState(note.content ? 'read' : 'edit');
  const autosave = useAutosave({
    record: note,
    fields: FIELDS,
    save: (values) => commit((tx) => tx.update(note.id, values)),
  });
  const { values, update } = autosave;
  const trashed = Boolean(note.trashedAt);
  const valuesRef = useRef(values);
  valuesRef.current = values;

  // Una nota nueva que se abandona sin escribir nada no se queda como nota vacía.
  // Se comprueba tras desmontar (y solo si no se volvió a montar, p. ej. en StrictMode).
  useEffect(() => {
    openEditors.set(note.id, (openEditors.get(note.id) ?? 0) + 1);
    return () => {
      openEditors.set(note.id, openEditors.get(note.id) - 1);
      setTimeout(() => {
        if (openEditors.get(note.id)) return;
        const current = getRecord(note.id);
        const v = valuesRef.current;
        if (isNew && current && !v.title.trim() && !v.content.trim() && !current.tags.length) deleteRecord(note.id).catch(() => {});
      }, 0);
    };
  }, [note.id, isNew]);

  useEffect(() => {
    document.title = `${values.title || 'Nota'} · Notas`;
  }, [values.title]);

  const tags = tagCounts(data.notes).map((t) => t.tag);
  return (
    <article className="org-stack org-note-editor" aria-label="Editor de nota">
      <div className="org-toolbar org-toolbar--split">
        <Button to="/notas" variant="ghost" size="sm" icon={ArrowLeft}>
          Todas las notas
        </Button>
        <SaveIndicator state={autosave.state} savedAt={autosave.savedAt} />
        <div className="org-toolbar__end">
          {!trashed && (
            <div className="org-segment" role="group" aria-label="Modo">
              <button type="button" aria-pressed={mode === 'edit'} onClick={() => setMode('edit')}>
                <PenLine aria-hidden="true" width={16} height={16} /> Editar
              </button>
              <button type="button" aria-pressed={mode === 'read'} onClick={() => setMode('read')}>
                <BookOpenText aria-hidden="true" width={16} height={16} /> Leer
              </button>
            </div>
          )}
          {!trashed && (
            <>
              <IconButton icon={note.pinned ? PinOff : Pin} label={note.pinned ? 'Desfijar' : 'Fijar arriba'} onClick={() => run(() => updateRecord(note.id, { pinned: !note.pinned }))} aria-pressed={note.pinned} />
              <IconButton icon={Star} label={note.favorite ? 'Quitar de favoritas' : 'Marcar como favorita'} onClick={() => run(() => updateRecord(note.id, { favorite: !note.favorite }))} aria-pressed={note.favorite} className={note.favorite ? 'is-on' : undefined} />
              <ActionMenu
                label="Más acciones de la nota"
                items={[
                  {
                    label: 'Duplicar',
                    icon: Copy,
                    onClick: async () => {
                      await autosave.flush();
                      const { ok, result } = await run(() => duplicateRecord(note.id, { pinned: false }), { success: 'Nota duplicada' });
                      if (ok) navigate(`/notas/${result.id}`);
                    },
                  },
                  { label: note.archived ? 'Desarchivar' : 'Archivar', icon: note.archived ? ArchiveRestore : Archive, onClick: () => run(() => setArchived(note.id, !note.archived), { success: note.archived ? 'Nota desarchivada' : 'Nota archivada' }) },
                  {
                    label: 'Mover a la papelera',
                    icon: Trash2,
                    danger: true,
                    onClick: async () => {
                      await autosave.flush();
                      const { ok } = await run(() => moveToTrash(note.id), { success: 'Nota en la papelera', undo: { label: 'Deshacer', onClick: () => restoreFromTrash(note.id) } });
                      if (ok) navigate('/notas');
                    },
                  },
                ]}
              />
            </>
          )}
        </div>
      </div>

      {trashed && (
        <div className="org-banner org-banner--warning" role="status">
          <span>
            Esta nota está en la papelera desde el {shortDate(note.trashedAt)}. Restáurala para editarla.{' '}
            <Button size="sm" variant="secondary" icon={RotateCcw} onClick={() => run(() => restoreFromTrash(note.id), { success: 'Nota restaurada' })}>
              Restaurar
            </Button>
          </span>
        </div>
      )}
      {note.archived && !trashed && <p className="org-banner">Nota archivada: no aparece en la lista principal.</p>}
      {autosave.recoverable && (
        <div className="org-banner org-banner--warning" role="alert">
          <span>
            Hay un borrador sin guardar de {dateTimeLabel(autosave.recoverable.at)} (la app se cerró antes de guardarlo).
            <span className="org-banner__actions">
              <Button size="sm" onClick={autosave.recover}>
                Recuperar borrador
              </Button>
              <Button size="sm" variant="ghost" onClick={autosave.discardRecovery}>
                Descartarlo
              </Button>
            </span>
          </span>
        </div>
      )}
      {autosave.conflict && (
        <div className="org-banner org-banner--warning" role="alert">
          <span>
            Esta nota cambió en otra pestaña mientras escribías.
            <span className="org-banner__actions">
              <Button size="sm" onClick={autosave.keepMine}>
                Conservar lo que ves aquí
              </Button>
              <Button size="sm" variant="ghost" onClick={autosave.takeTheirs}>
                Cargar la otra versión
              </Button>
            </span>
          </span>
        </div>
      )}

      <label htmlFor="note-title" className="sr-only">
        Título
      </label>
      <input
        id="note-title"
        className="org-title-input"
        value={values.title}
        onChange={(e) => update({ title: e.target.value.slice(0, 160) })}
        placeholder="Título"
        readOnly={trashed}
        autoFocus={isNew && !values.title}
      />
      <p className="org-subtle">
        Creada {dateTimeLabel(note.createdAt)} · modificada {dateTimeLabel(note.updatedAt)}
      </p>

      {trashed ? (
        <MarkdownEditor label="Contenido" value={values.content} onChange={() => {}} mode="read" />
      ) : (
        <MarkdownEditor
          label="Contenido"
          value={values.content}
          onChange={(content) => update({ content })}
          mode={mode}
          placeholder="Escribe con libertad. Usa # para títulos, - para listas, - [ ] para casillas, **negrita** y *cursiva*."
          onSaveShortcut={autosave.flush}
          autoFocus={isNew && Boolean(values.title)}
        />
      )}

      {!trashed && (
        <details className="org-more org-panel" open={isNew ? false : undefined}>
          <summary>Organizar: carpeta, categoría, colecciones, etiquetas, color y evento</summary>
          <div className="org-more__body">
            <div className="org-form__row">
              <SelectField label="Carpeta" value={values.folderId} onChange={(folderId) => update({ folderId })} placeholder="Sin carpeta" options={data.folderOptions} />
              <SelectField label="Categoría" value={values.categoryId} onChange={(categoryId) => update({ categoryId })} placeholder="Sin categoría" options={data.categories.map((c) => ({ value: c.id, label: c.name }))} />
            </div>
            {data.collections.length > 0 ? (
              <ChipGroup
                label="Colecciones"
                options={data.collections.map((c) => ({ value: c.id, label: c.name, color: c.color }))}
                values={values.collectionIds}
                onChange={(collectionIds) => update({ collectionIds })}
              />
            ) : (
              <p className="org-subtle">
                Las colecciones agrupan notas de carpetas distintas. <Link to="/notas/organizar">Crear una colección</Link>
              </p>
            )}
            <TagsField value={values.tags} onChange={(t) => update({ tags: t })} suggestions={tags} />
            <SelectField
              label="Evento relacionado"
              value={values.eventId}
              onChange={(eventId) => update({ eventId })}
              placeholder="Ninguno"
              options={data.events.map((e) => ({ value: e.id, label: `${e.title} · ${shortDate(e.startDate)}` }))}
            />
            <ColorPicker value={values.color} onChange={(color) => update({ color })} allowNone />
          </div>
        </details>
      )}
    </article>
  );
}
