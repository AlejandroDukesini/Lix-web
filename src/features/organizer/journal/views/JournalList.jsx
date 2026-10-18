import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Archive, ArchiveRestore, Copy, Feather, History, Paperclip, RotateCcw, Star, StarOff, Trash2 } from 'lucide-react';
import { Button } from '../../../../components/common/Button.jsx';
import { Badge } from '../../../../components/common/Card.jsx';
import { ConfirmDialog } from '../../../../components/common/Dialog.jsx';
import { cx } from '../../../../utils/cx.js';
import { deleteRecord, duplicateRecord, updateRecord } from '../../data/store.js';
import { useRunner } from '../../data/hooks.js';
import { tagCounts } from '../../data/tags.js';
import { InputField, SelectField } from '../../shared/Fields.jsx';
import { ActionMenu, DeleteDialog, EmptyState, SearchField } from '../../shared/ui.jsx';
import { dayHeading, longDate, monthLabel } from '../../shared/format.js';
import { countWords, excerpt, matchesQuery } from '../../shared/text.js';
import { emptyTrash, inView, moveToTrash, restoreFromTrash, setArchived } from '../../shared/lifecycle.js';
import { memoriesFor } from '../journalStats.js';
import { useJournal } from '../useJournal.js';

const VIEWS = [
  ['all', 'Todas'],
  ['favorites', 'Favoritas'],
  ['drafts', 'Borradores'],
  ['archived', 'Archivadas'],
  ['trash', 'Papelera'],
];

export function EntryCard({ entry, showYear = false }) {
  const run = useRunner();
  const [remove, setRemove] = useState(false);
  const title = entry.title || excerpt(entry.body, 70) || 'Entrada sin texto';
  const trashed = Boolean(entry.trashedAt);
  return (
    <li className={cx('org-entry', entry.status === 'draft' && 'is-draft')}>
      <Link to={`/diario/${entry.id}`} className="org-entry__link">
        <span className="org-entry__date">{showYear ? longDate(entry.eventDate) : dayHeading(entry.eventDate)}</span>
        <span className="org-entry__title">
          {entry.favorite && <Star aria-label="Favorita" width={14} height={14} />}
          {title}
        </span>
        {entry.title && entry.body && <span className="org-entry__excerpt">{excerpt(entry.body, 220)}</span>}
        <span className="org-note__meta">
          <span>{countWords(entry.body).toLocaleString('es')} palabras</span>
          {entry.category && <span>{entry.category}</span>}
          {entry.attachmentIds.length > 0 && (
            <span>
              <Paperclip aria-hidden="true" width={12} height={12} /> {entry.attachmentIds.length}
            </span>
          )}
          {entry.status === 'draft' && <Badge tone="warning">Borrador</Badge>}
        </span>
        {entry.tags.length > 0 && (
          <span className="org-taglist">
            {entry.tags.map((t) => (
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
                { label: 'Restaurar', icon: RotateCcw, onClick: () => run(() => restoreFromTrash(entry.id), { success: 'Entrada restaurada' }) },
                { label: 'Eliminar definitivamente', icon: Trash2, danger: true, onClick: () => setRemove(true) },
              ]
            : [
                { label: entry.favorite ? 'Quitar de favoritas' : 'Marcar como favorita', icon: entry.favorite ? StarOff : Star, onClick: () => run(() => updateRecord(entry.id, { favorite: !entry.favorite })) },
                { label: 'Duplicar', icon: Copy, onClick: () => run(() => duplicateRecord(entry.id, { favorite: false, writtenAt: new Date().toISOString() }), { success: 'Entrada duplicada' }) },
                { label: entry.archived ? 'Desarchivar' : 'Archivar', icon: entry.archived ? ArchiveRestore : Archive, onClick: () => run(() => setArchived(entry.id, !entry.archived), { success: entry.archived ? 'Entrada desarchivada' : 'Entrada archivada' }) },
                { label: 'Mover a la papelera', icon: Trash2, danger: true, onClick: () => run(() => moveToTrash(entry.id), { success: 'Entrada en la papelera', undo: { label: 'Deshacer', onClick: () => restoreFromTrash(entry.id) } }) },
              ]
        }
      />
      <DeleteDialog
        open={remove}
        recordId={entry.id}
        title="¿Eliminar la entrada definitivamente?"
        onCancel={() => setRemove(false)}
        onConfirm={async () => {
          const { ok } = await run(() => deleteRecord(entry.id), { success: 'Entrada eliminada' });
          if (ok) setRemove(false);
        }}
      />
    </li>
  );
}

export function JournalList() {
  const journal = useJournal();
  const run = useRunner();
  const [view, setView] = useState('all');
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState(null);
  const [category, setCategory] = useState(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [confirmEmpty, setConfirmEmpty] = useState(false);

  const memories = useMemo(() => (journal.settings.showMemories ? memoriesFor(journal.entries, journal.today) : []), [journal]);
  const tags = useMemo(() => tagCounts(journal.entries.filter((e) => !e.trashedAt)), [journal.entries]);
  const list = useMemo(
    () =>
      journal.entries
        .filter((e) => (view === 'drafts' ? inView(e, 'all') && e.status === 'draft' : inView(e, view)))
        .filter((e) => (!from || e.eventDate >= from) && (!to || e.eventDate <= to))
        .filter((e) => !category || e.category === category)
        .filter((e) => !tag || e.tags.some((t) => t.toLocaleLowerCase('es') === tag.toLocaleLowerCase('es')))
        .filter((e) => matchesQuery(query, e.title, e.body, e.tags, e.category))
        .sort((a, b) => b.eventDate.localeCompare(a.eventDate) || b.writtenAt.localeCompare(a.writtenAt)),
    [journal.entries, view, from, to, category, tag, query],
  );
  const months = useMemo(() => {
    const map = new Map();
    for (const e of list) {
      const key = e.eventDate.slice(0, 7);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(e);
    }
    return [...map];
  }, [list]);
  const trashCount = journal.entries.filter((e) => e.trashedAt).length;
  const filtered = query || tag || category || from || to;

  return (
    <div className="org-stack">
      {memories.length > 0 && view === 'all' && !filtered && (
        <section className="org-panel org-memories" aria-labelledby="memories-title">
          <h2 id="memories-title" className="org-section__title">
            <History aria-hidden="true" /> En un día como hoy
          </h2>
          <ul className="org-entries">
            {memories.slice(0, 4).map((e) => (
              <EntryCard key={e.id} entry={e} showYear />
            ))}
          </ul>
        </section>
      )}

      <div className="org-toolbar org-toolbar--split">
        <div className="org-segment" role="group" aria-label="Mostrar entradas">
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
      <SearchField label="Buscar en el diario" value={query} onChange={setQuery} placeholder="Buscar palabras, personas, lugares…" />
      <details className="org-more" open={Boolean(tag || category || from || to)}>
        <summary>Filtrar por fecha, etiqueta o categoría</summary>
        <div className="org-filters">
          <InputField label="Desde" type="date" value={from} onChange={setFrom} max={to || undefined} />
          <InputField label="Hasta" type="date" value={to} onChange={setTo} min={from || undefined} />
          <SelectField label="Etiqueta" value={tag} onChange={setTag} placeholder="Todas" options={tags.map((t) => ({ value: t.tag, label: `#${t.tag} (${t.count})` }))} />
          <SelectField label="Categoría" value={category} onChange={setCategory} placeholder="Todas" options={journal.categories.map((c) => ({ value: c, label: c }))} />
        </div>
      </details>

      {months.length ? (
        months.map(([month, entries]) => (
          <section key={month} aria-label={monthLabel(month)}>
            <h2 className="org-group-title">
              {monthLabel(month)} · {entries.length} {entries.length === 1 ? 'entrada' : 'entradas'}
            </h2>
            <ul className="org-entries">
              {entries.map((e) => (
                <EntryCard key={e.id} entry={e} />
              ))}
            </ul>
          </section>
        ))
      ) : (
        <EmptyState
          icon={Feather}
          title={journal.entries.length ? (view === 'trash' ? 'La papelera está vacía' : 'Nada coincide') : 'Tu diario empieza aquí'}
          action={!journal.entries.length && <Button to="/diario/nueva">Escribir la primera entrada</Button>}
        >
          {journal.entries.length ? 'Prueba con otra búsqueda u otro filtro.' : 'Lo que vives, lo que piensas, lo que no quieres olvidar. Puedes escribir varias entradas en un mismo día.'}
        </EmptyState>
      )}
      <ConfirmDialog
        open={confirmEmpty}
        title="¿Vaciar la papelera del diario?"
        description={`Se eliminarán definitivamente ${trashCount} ${trashCount === 1 ? 'entrada' : 'entradas'}. No se puede deshacer.`}
        confirmLabel="Vaciar"
        onConfirm={async () => {
          await run(() => emptyTrash('journalEntry'), { success: 'Papelera vacía' });
          setConfirmEmpty(false);
        }}
        onCancel={() => setConfirmEmpty(false)}
      />
    </div>
  );
}
