import { useState } from 'react';
import { Folder, FolderPlus, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '../../../../components/common/Button.jsx';
import { commit, deleteRecord } from '../../data/store.js';
import { useRunner } from '../../data/hooks.js';
import { ColorPicker, InputField, SelectField, TextAreaField } from '../../shared/Fields.jsx';
import { ActionMenu, DeleteDialog, FormDialog, Section } from '../../shared/ui.jsx';
import { TagManager } from '../../shared/TagManager.jsx';
import { useNotes } from '../useNotes.js';

const LABELS = { folder: 'carpeta', noteCategory: 'categoría', collection: 'colección' };

/** Formulario común de carpeta, categoría y colección (nombre, color y lo propio de cada una). */
function StructureForm({ kind, open, onClose, initial }) {
  const data = useNotes();
  const run = useRunner();
  const isEdit = Boolean(initial?.id);
  const [draft, setDraft] = useState(null);
  const [errors, setErrors] = useState(null);
  if (open && !draft) setDraft({ name: initial?.name ?? '', color: initial?.color ?? (kind === 'folder' ? null : '#8e5bd8'), parentId: initial?.parentId ?? null, description: initial?.description ?? '' });
  if (!open && draft) setDraft(null);
  if (!draft) return null;
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const submit = async () => {
    const fields = kind === 'folder' ? { name: draft.name, color: draft.color, parentId: draft.parentId } : kind === 'collection' ? { name: draft.name, color: draft.color, description: draft.description } : { name: draft.name, color: draft.color };
    const { ok, errors: e } = await run(() => commit((tx) => (isEdit ? tx.update(initial.id, fields) : tx.create(kind, fields))), { success: isEdit ? 'Cambios guardados' : `${LABELS[kind][0].toUpperCase()}${LABELS[kind].slice(1)} creada` });
    setErrors(e);
    return ok;
  };
  const blocked = kind === 'folder' && isEdit ? data.descendants(initial.id) : new Set();
  return (
    <FormDialog open={open} onClose={onClose} title={`${isEdit ? 'Editar' : 'Nueva'} ${LABELS[kind]}`} onSubmit={submit} errors={errors} size="sm">
      <InputField label="Nombre" value={draft.name} onChange={(name) => set({ name })} error={errors?.name} maxLength={60} autoFocus />
      {kind === 'folder' && (
        <SelectField
          label="Dentro de"
          value={draft.parentId}
          onChange={(parentId) => set({ parentId })}
          placeholder="Ninguna (nivel principal)"
          options={data.folderOptions.filter((o) => !blocked.has(o.value))}
          error={errors?.parentId}
          hint="Hasta tres niveles de carpetas."
        />
      )}
      {kind === 'collection' && <TextAreaField label="Descripción" value={draft.description} onChange={(description) => set({ description })} rows={2} maxLength={280} />}
      <ColorPicker value={draft.color} onChange={(color) => set({ color })} allowNone={kind === 'folder'} />
    </FormDialog>
  );
}

function StructureList({ kind, items, counts, onEdit, onDelete, depthOf }) {
  if (!items.length) return <p className="org-muted">Todavía no hay ninguna.</p>;
  return (
    <ul className="org-list">
      {items.map((item) => (
        <li key={item.id} className="org-row org-row--compact" style={{ marginLeft: depthOf ? `${depthOf(item) * 1.5}rem` : undefined }}>
          {kind === 'folder' ? <Folder aria-hidden="true" width={20} height={20} color={item.color ?? undefined} /> : <span className="org-dot" style={{ '--dot-color': item.color }} aria-hidden="true" />}
          <button type="button" className="org-row__main" onClick={() => onEdit(item)}>
            <span className="org-row__title">{item.name}</span>
            <span className="org-row__meta">
              {counts(item)} {counts(item) === 1 ? 'nota' : 'notas'}
              {item.description && ` · ${item.description}`}
            </span>
          </button>
          <ActionMenu
            label={`Acciones de ${item.name}`}
            items={[
              { label: 'Editar', icon: Pencil, onClick: () => onEdit(item) },
              { label: 'Eliminar', icon: Trash2, danger: true, onClick: () => onDelete(item) },
            ]}
          />
        </li>
      ))}
    </ul>
  );
}

export function NotesOrganize() {
  const data = useNotes();
  const run = useRunner();
  const [form, setForm] = useState(null); // { kind, initial }
  const [remove, setRemove] = useState(null);
  const live = data.notes.filter((n) => !n.trashedAt);
  const depth = new Map(data.tree.map((t) => [t.folder.id, t.depth]));

  return (
    <div className="org-stack">
      <Section
        title="Carpetas"
        description="Al eliminar una carpeta, sus notas y subcarpetas pasan a la carpeta superior: no se pierde ninguna nota."
        action={<Button size="sm" icon={FolderPlus} onClick={() => setForm({ kind: 'folder', initial: null })}>Nueva carpeta</Button>}
      >
        <StructureList
          kind="folder"
          items={data.tree.map((t) => t.folder)}
          depthOf={(f) => depth.get(f.id) ?? 0}
          counts={(f) => live.filter((n) => n.folderId === f.id).length}
          onEdit={(initial) => setForm({ kind: 'folder', initial })}
          onDelete={setRemove}
        />
      </Section>
      <Section
        title="Colecciones"
        description="Agrupan notas de cualquier carpeta (una nota puede estar en varias)."
        action={<Button size="sm" icon={Plus} onClick={() => setForm({ kind: 'collection', initial: null })}>Nueva colección</Button>}
      >
        <StructureList kind="collection" items={data.collections} counts={(c) => live.filter((n) => n.collectionIds.includes(c.id)).length} onEdit={(initial) => setForm({ kind: 'collection', initial })} onDelete={setRemove} />
      </Section>
      <Section
        title="Categorías"
        description="Al eliminar una categoría, sus notas se conservan sin categoría."
        action={<Button size="sm" icon={Plus} onClick={() => setForm({ kind: 'noteCategory', initial: null })}>Nueva categoría</Button>}
      >
        <StructureList kind="noteCategory" items={data.categories} counts={(c) => live.filter((n) => n.categoryId === c.id).length} onEdit={(initial) => setForm({ kind: 'noteCategory', initial })} onDelete={setRemove} />
      </Section>
      <Section title="Etiquetas">
        <TagManager kinds={['note']} noun="notas" />
      </Section>

      <StructureForm kind={form?.kind ?? 'folder'} open={Boolean(form)} initial={form?.initial} onClose={() => setForm(null)} />
      <DeleteDialog
        open={Boolean(remove)}
        recordId={remove?.id}
        title={`¿Eliminar «${remove?.name ?? ''}»?`}
        onCancel={() => setRemove(null)}
        onConfirm={async () => {
          const { ok } = await run(() => deleteRecord(remove.id), { success: 'Eliminado; las notas se conservaron' });
          if (ok) setRemove(null);
        }}
      />
    </div>
  );
}
