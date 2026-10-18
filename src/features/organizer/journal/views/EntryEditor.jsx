import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router';
import { ArrowLeft, BookOpenText, ChevronLeft, ChevronRight, Lightbulb, PenLine, RefreshCw, RotateCcw, Star, Trash2, X } from 'lucide-react';
import { Button, IconButton } from '../../../../components/common/Button.jsx';
import { commit, createRecord, deleteRecord, getRecord, updateRecord } from '../../data/store.js';
import { useRecord, useRunner } from '../../data/hooks.js';
import { tagCounts } from '../../data/tags.js';
import { InputField, SelectField, TagsField } from '../../shared/Fields.jsx';
import { AttachmentPreview, AttachmentsField } from '../../shared/Attachments.jsx';
import { MarkdownEditor } from '../../shared/MarkdownEditor.jsx';
import { SaveIndicator } from '../../shared/ui.jsx';
import { useAutosave } from '../../shared/useAutosave.js';
import { dateTimeLabel, fromLocalDateTimeInput, longDate, shortDate, toLocalDateTimeInput, todayISO } from '../../shared/format.js';
import { moveToTrash, restoreFromTrash } from '../../shared/lifecycle.js';
import { promptOfDay } from '../content.js';
import { neighbourDays } from '../journalStats.js';
import { useJournal } from '../useJournal.js';

const FIELDS = ['title', 'body', 'eventDate', 'writtenAt', 'category', 'tags', 'status', 'attachmentIds', 'relatedEventIds', 'relatedNoteIds', 'relatedTaskIds'];
const openEditors = new Map();

/** /diario/nueva?fecha=AAAA-MM-DD&plantilla=id: crea la entrada y abre el editor. */
export function NewEntry() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const journal = useJournal();
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const date = params.get('fecha');
    const template = journal.templates.find((t) => t.id === params.get('plantilla'));
    createRecord('journalEntry', {
      writtenAt: new Date().toISOString(),
      eventDate: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayISO(),
      body: template?.body ?? '',
    }).then((entry) => navigate(`/diario/${entry.id}?nueva=1`, { replace: true }));
  }, [params, navigate, journal.templates]);
  return <div className="org-loading" role="status" aria-label="Creando entrada" />;
}

export function EntryEditor() {
  const { entryId } = useParams();
  const [params] = useSearchParams();
  const entry = useRecord(entryId);
  if (!entry || entry.kind !== 'journalEntry') return <Navigate to="/diario" replace />;
  return <Editor key={entry.id} entry={entry} isNew={params.get('nueva') === '1'} />;
}

/** Lista de vínculos con un selector para añadir más. */
function RelatedPicker({ label, options, values, onChange }) {
  const byId = new Map(options.map((o) => [o.value, o]));
  return (
    <div className="field">
      <span className="field__label">{label}</span>
      {values.length > 0 && (
        <ul className="org-tags">
          {values.map((id) => (
            <li key={id} className="org-tag">
              <span>{byId.get(id)?.label ?? 'Elemento eliminado'}</span>
              <button type="button" onClick={() => onChange(values.filter((x) => x !== id))} aria-label={`Quitar «${byId.get(id)?.label ?? id}»`}>
                <X aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <SelectField label={`Añadir a ${label.toLowerCase()}`} hideLabel value={null} placeholder="Añadir…" onChange={(id) => id && !values.includes(id) && onChange([...values, id])} options={options.filter((o) => !values.includes(o.value))} />
    </div>
  );
}

function Editor({ entry, isNew }) {
  const journal = useJournal();
  const run = useRunner();
  const navigate = useNavigate();
  const [mode, setMode] = useState(entry.body && !isNew ? 'read' : 'edit');
  const [promptOffset, setPromptOffset] = useState(0);
  const [showPrompt, setShowPrompt] = useState(journal.settings.showPrompts);
  const autosave = useAutosave({ record: entry, fields: FIELDS, save: (values) => commit((tx) => tx.update(entry.id, values)) });
  const { values, update } = autosave;
  const trashed = Boolean(entry.trashedAt);
  const valuesRef = useRef(values);
  valuesRef.current = values;

  useEffect(() => {
    openEditors.set(entry.id, (openEditors.get(entry.id) ?? 0) + 1);
    return () => {
      openEditors.set(entry.id, openEditors.get(entry.id) - 1);
      setTimeout(() => {
        if (openEditors.get(entry.id)) return;
        const current = getRecord(entry.id);
        const v = valuesRef.current;
        if (isNew && current && !v.title.trim() && !v.body.trim() && !v.attachmentIds.length) deleteRecord(entry.id).catch(() => {});
      }, 0);
    };
  }, [entry.id, isNew]);

  useEffect(() => {
    document.title = 'Diario · Un año más contigo';
  }, []);

  const neighbours = useMemo(() => neighbourDays(journal.entries, values.eventDate), [journal.entries, values.eventDate]);
  const goToDay = (day) => {
    const target = journal.entries.filter((e) => e.eventDate === day && !e.trashedAt).sort((a, b) => a.writtenAt.localeCompare(b.writtenAt))[0];
    if (target) navigate(`/diario/${target.id}`);
  };
  const prompt = promptOfDay(values.eventDate, promptOffset);
  const applyPrompt = () => {
    update({ body: `${values.body.trimEnd()}${values.body.trim() ? '\n\n' : ''}## ${prompt}\n\n` });
    setMode('edit');
  };

  const tags = tagCounts(journal.entries).map((t) => t.tag);
  const sameDay = journal.entries.filter((e) => e.eventDate === values.eventDate && !e.trashedAt && e.id !== entry.id);

  return (
    <article className="org-stack org-note-editor org-journal-editor" aria-label="Entrada del diario">
      <div className="org-toolbar org-toolbar--split">
        <Button to="/diario" variant="ghost" size="sm" icon={ArrowLeft}>
          Volver al diario
        </Button>
        <SaveIndicator state={autosave.state} savedAt={autosave.savedAt} />
        <div className="org-toolbar__end">
          {!trashed && (
            <div className="org-segment" role="group" aria-label="Modo">
              <button type="button" aria-pressed={mode === 'edit'} onClick={() => setMode('edit')}>
                <PenLine aria-hidden="true" width={16} height={16} /> Escribir
              </button>
              <button type="button" aria-pressed={mode === 'read'} onClick={() => setMode('read')}>
                <BookOpenText aria-hidden="true" width={16} height={16} /> Leer
              </button>
            </div>
          )}
          {!trashed && (
            <>
              <IconButton icon={Star} label={entry.favorite ? 'Quitar de favoritas' : 'Marcar como favorita'} aria-pressed={entry.favorite} className={entry.favorite ? 'is-on' : undefined} onClick={() => run(() => updateRecord(entry.id, { favorite: !entry.favorite }))} />
              <IconButton
                icon={Trash2}
                label="Mover a la papelera"
                onClick={async () => {
                  await autosave.flush();
                  const { ok } = await run(() => moveToTrash(entry.id), { success: 'Entrada en la papelera', undo: { label: 'Deshacer', onClick: () => restoreFromTrash(entry.id) } });
                  if (ok) navigate('/diario');
                }}
              />
            </>
          )}
        </div>
      </div>

      {trashed && (
        <div className="org-banner org-banner--warning" role="status">
          <span>
            Esta entrada está en la papelera. Restáurala para editarla.{' '}
            <Button size="sm" variant="secondary" icon={RotateCcw} onClick={() => run(() => restoreFromTrash(entry.id), { success: 'Entrada restaurada' })}>
              Restaurar
            </Button>
          </span>
        </div>
      )}
      {autosave.recoverable && (
        <div className="org-banner org-banner--warning" role="alert">
          <span>
            Hay un borrador sin guardar de {dateTimeLabel(autosave.recoverable.at)}.
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
            Esta entrada cambió en otra pestaña mientras escribías.
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

      <nav className="org-daynav" aria-label="Días con entradas">
        <Button variant="ghost" size="sm" icon={ChevronLeft} disabled={!neighbours.previous} onClick={() => goToDay(neighbours.previous)}>
          {neighbours.previous ? shortDate(neighbours.previous) : 'Día anterior'}
        </Button>
        <p className="org-daynav__current">{longDate(values.eventDate)}</p>
        <Button variant="ghost" size="sm" iconEnd={ChevronRight} disabled={!neighbours.next} onClick={() => goToDay(neighbours.next)}>
          {neighbours.next ? shortDate(neighbours.next) : 'Día siguiente'}
        </Button>
      </nav>

      <label htmlFor="entry-title" className="sr-only">
        Título (opcional)
      </label>
      <input id="entry-title" className="org-title-input" value={values.title} onChange={(e) => update({ title: e.target.value.slice(0, 160) })} placeholder="Título (opcional)" readOnly={trashed} />
      <p className="org-subtle">
        Escrita {dateTimeLabel(values.writtenAt)} · última edición {dateTimeLabel(entry.updatedAt)}
        {sameDay.length > 0 && ` · ${sameDay.length} ${sameDay.length === 1 ? 'entrada más' : 'entradas más'} este día`}
      </p>

      {!trashed && showPrompt && mode === 'edit' && (
        <aside className="org-prompt" aria-label="Pregunta para empezar">
          <Lightbulb aria-hidden="true" />
          <p>{prompt}</p>
          <div className="org-prompt__actions">
            <Button size="sm" variant="secondary" onClick={applyPrompt}>
              Usarla
            </Button>
            <IconButton icon={RefreshCw} size="sm" label="Otra pregunta" onClick={() => setPromptOffset((n) => n + 1)} />
            <IconButton icon={X} size="sm" label="Ocultar preguntas" onClick={() => setShowPrompt(false)} />
          </div>
        </aside>
      )}

      {!trashed && !values.body.trim() && mode === 'edit' && (
        <div className="org-templates" aria-label="Plantillas opcionales">
          <span className="org-subtle">¿Una plantilla? (opcional)</span>
          {journal.templates.map((t) => (
            <button key={t.id} type="button" className="org-chip org-chip--ghost" onClick={() => update({ body: t.body })} title={t.description}>
              {t.name}
            </button>
          ))}
        </div>
      )}

      <MarkdownEditor
        label="Texto de la entrada"
        value={values.body}
        onChange={(body) => update({ body })}
        mode={trashed ? 'read' : mode}
        placeholder="¿Qué pasó hoy? Escribe sin prisa; se guarda solo."
        onSaveShortcut={autosave.flush}
        minRows={16}
        autoFocus={isNew}
      />

      {values.attachmentIds.length > 0 && (
        <ul className="org-attachments" aria-label="Fotos y archivos de la entrada">
          {values.attachmentIds.map((id) => (
            <AttachmentPreview key={id} id={id} />
          ))}
        </ul>
      )}

      {!trashed && (
        <details className="org-more org-panel">
          <summary>Fechas, estado, etiquetas, fotos y vínculos</summary>
          <div className="org-more__body">
            <div className="org-form__row">
              <InputField label="Día del acontecimiento" type="date" value={values.eventDate} onChange={(eventDate) => eventDate && update({ eventDate })} hint="Si escribes sobre otro día, cámbialo aquí." />
              <InputField label="Escrita el" type="datetime-local" value={toLocalDateTimeInput(values.writtenAt)} onChange={(v) => fromLocalDateTimeInput(v) && update({ writtenAt: fromLocalDateTimeInput(v) })} />
            </div>
            <div className="org-form__row">
              <SelectField
                label="Estado"
                value={values.status}
                onChange={(status) => update({ status: status ?? 'published' })}
                options={[
                  { value: 'published', label: 'Publicada (terminada)' },
                  { value: 'draft', label: 'Borrador' },
                ]}
              />
              <InputField label="Categoría" value={values.category} onChange={(category) => update({ category: category.slice(0, 40) })} list="journal-categories" placeholder="Ej.: viajes, universidad, nosotros" />
              <datalist id="journal-categories">
                {journal.categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <TagsField value={values.tags} onChange={(t) => update({ tags: t })} suggestions={tags} />
            <AttachmentsField label="Fotos y archivos" value={values.attachmentIds} onChange={(attachmentIds) => update({ attachmentIds })} max={6} />
            <RelatedPicker label="Eventos relacionados" values={values.relatedEventIds} onChange={(relatedEventIds) => update({ relatedEventIds })} options={journal.events.map((e) => ({ value: e.id, label: `${e.title} · ${shortDate(e.startDate)}` }))} />
            <RelatedPicker label="Notas relacionadas" values={values.relatedNoteIds} onChange={(relatedNoteIds) => update({ relatedNoteIds })} options={journal.notes.map((n) => ({ value: n.id, label: n.title || 'Nota sin título' }))} />
            <RelatedPicker label="Tareas relacionadas" values={values.relatedTaskIds} onChange={(relatedTaskIds) => update({ relatedTaskIds })} options={journal.tasks.map((t) => ({ value: t.id, label: t.title }))} />
          </div>
        </details>
      )}
    </article>
  );
}
