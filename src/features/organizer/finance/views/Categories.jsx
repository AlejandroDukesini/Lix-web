import { useMemo, useState } from 'react';
import { Archive, ArchiveRestore, FolderTree, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '../../../../components/common/Button.jsx';
import { Badge } from '../../../../components/common/Card.jsx';
import { Dialog } from '../../../../components/common/Dialog.jsx';
import { cx } from '../../../../utils/cx.js';
import { commit, deleteRecord, planDelete, updateRecord } from '../../data/store.js';
import { useRunner } from '../../data/hooks.js';
import { CATEGORY_ICONS } from '../../data/entities.js';
import { ColorPicker, InputField, SelectField, TextAreaField } from '../../shared/Fields.jsx';
import { ActionMenu, DeleteDialog, FormDialog } from '../../shared/ui.jsx';
import { CATEGORY_ICON_COMPONENTS, CategoryBadge } from '../CategoryIcon.jsx';
import { reassignCategory } from '../actions.js';
import { categoryOptions, useFinance } from '../useFinance.js';

function CategoryForm({ open, onClose, initial }) {
  const finance = useFinance();
  const run = useRunner();
  const isEdit = Boolean(initial?.id);
  const [draft, setDraft] = useState(null);
  const [errors, setErrors] = useState(null);
  if (open && !draft) {
    setDraft({
      name: initial?.name ?? '',
      type: initial?.type ?? 'expense',
      parentId: initial?.parentId ?? null,
      icon: initial?.icon ?? 'tag',
      color: initial?.color ?? '#8e5bd8',
      description: initial?.description ?? '',
    });
  }
  if (!open && draft) setDraft(null);
  if (!draft) return null;
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const hasChildren = isEdit && finance.categories.some((c) => c.parentId === initial.id);
  const used = isEdit && finance.transactions.some((t) => t.categoryId === initial.id);
  const submit = async () => {
    const { ok, errors: e } = await run(() => commit((tx) => (isEdit ? tx.update(initial.id, draft) : tx.create('category', draft))), { success: isEdit ? 'Categoría actualizada' : 'Categoría creada' });
    setErrors(e);
    return ok;
  };
  const parents = finance.categories.filter((c) => c.type === draft.type && !c.parentId && c.id !== initial?.id && !c.archived);
  return (
    <FormDialog open={open} onClose={onClose} title={isEdit ? 'Editar categoría' : 'Nueva categoría'} onSubmit={submit} errors={errors}>
      <InputField label="Nombre" value={draft.name} onChange={(name) => set({ name })} error={errors?.name} maxLength={40} autoFocus />
      <div className="org-form__row">
        <SelectField
          label="Tipo"
          value={draft.type}
          onChange={(type) => set({ type, parentId: null })}
          options={[
            { value: 'expense', label: 'Gasto' },
            { value: 'income', label: 'Ingreso' },
          ]}
          disabled={used}
          hint={used ? 'Tiene movimientos: no puede cambiar de tipo.' : undefined}
        />
        <SelectField
          label="Dentro de"
          value={draft.parentId}
          onChange={(parentId) => set({ parentId })}
          placeholder="Ninguna (categoría principal)"
          options={parents.map((c) => ({ value: c.id, label: c.name }))}
          error={errors?.parentId}
          disabled={hasChildren}
          hint={hasChildren ? 'Tiene subcategorías: solo puede ser principal.' : undefined}
        />
      </div>
      <fieldset className="field org-colors">
        <legend className="field__label">Icono</legend>
        <div className="org-colors__list">
          {CATEGORY_ICONS.map((key) => {
            const Icon = CATEGORY_ICON_COMPONENTS[key];
            return (
              <label key={key} className={cx('org-icon-choice', draft.icon === key && 'is-active')} title={key}>
                <input type="radio" name="category-icon" className="sr-only" checked={draft.icon === key} onChange={() => set({ icon: key })} />
                <Icon aria-hidden="true" />
                <span className="sr-only">{key}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <ColorPicker value={draft.color} onChange={(color) => set({ color })} />
      <TextAreaField label="Descripción (opcional)" value={draft.description} onChange={(description) => set({ description })} rows={2} maxLength={200} />
    </FormDialog>
  );
}

/** Reasignar antes de borrar: los movimientos pasan a otra categoría (o quedan sin categoría). */
function ReassignDialog({ category, onClose }) {
  const finance = useFinance();
  const run = useRunner();
  const [target, setTarget] = useState(null);
  if (!category) return null;
  const count = finance.transactions.filter((t) => t.categoryId === category.id).length;
  const children = finance.categories.filter((c) => c.parentId === category.id).length;
  const options = categoryOptions(finance.categories, category.type, null).filter((o) => o.value !== category.id && finance.categoriesById.get(o.value)?.parentId !== category.id);
  const confirm = async () => {
    const { ok } = await run(async () => {
      await reassignCategory(category.id, target);
      const plan = planDelete(category.id);
      if (!plan.blocked.length) await deleteRecord(category.id);
      return plan.blocked.length;
    }, { success: 'Categoría eliminada; sus movimientos se conservaron' });
    if (ok) onClose();
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title={`Eliminar «${category.name}»`}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={confirm}>
            Mover y eliminar
          </Button>
        </>
      }
    >
      <p>
        Tiene {count} {count === 1 ? 'movimiento' : 'movimientos'}
        {children ? ` y ${children} subcategorías` : ''}. Elige a dónde pasan para no perder nada:
      </p>
      <SelectField label="Mover a" value={target} onChange={setTarget} options={options} placeholder="Dejarlos sin categoría" />
      <p className="org-subtle">Si solo quieres ocultarla de los formularios, archívala en su lugar.</p>
    </Dialog>
  );
}

export function Categories() {
  const finance = useFinance();
  const run = useRunner();
  const [type, setType] = useState('expense');
  const [form, setForm] = useState(null);
  const [reassign, setReassign] = useState(null);
  const [remove, setRemove] = useState(null);
  const usage = useMemo(() => {
    const counts = new Map();
    for (const t of finance.transactions) counts.set(t.categoryId, (counts.get(t.categoryId) ?? 0) + 1);
    return counts;
  }, [finance.transactions]);
  const roots = finance.categories.filter((c) => c.type === type && !c.parentId).sort((a, b) => Number(a.archived) - Number(b.archived) || a.name.localeCompare(b.name, 'es'));

  const askDelete = (category) => {
    const plan = planDelete(category.id);
    if (plan.blocked.length) setReassign(category);
    else setRemove(category);
  };

  const row = (category, child = false) => (
    <li key={category.id} className={cx('org-row org-row--compact', child && 'org-row--child', category.archived && 'is-muted')}>
      <CategoryBadge category={category} />
      <button type="button" className="org-row__main" onClick={() => setForm({ initial: category })}>
        <span className="org-row__title">{category.name}</span>
        <span className="org-row__meta">
          {usage.get(category.id) ? `${usage.get(category.id)} movimientos` : 'Sin movimientos'}
          {category.archived && <Badge>Archivada</Badge>}
        </span>
      </button>
      <ActionMenu
        label={`Acciones de ${category.name}`}
        items={[
          { label: 'Editar', icon: Pencil, onClick: () => setForm({ initial: category }) },
          !child && { label: 'Añadir subcategoría', icon: FolderTree, onClick: () => setForm({ initial: { type, parentId: category.id, icon: category.icon, color: category.color } }) },
          {
            label: category.archived ? 'Restaurar' : 'Archivar',
            icon: category.archived ? ArchiveRestore : Archive,
            onClick: () => run(() => updateRecord(category.id, { archived: !category.archived }), { success: category.archived ? 'Categoría restaurada' : 'Categoría archivada: ya no aparece en los formularios' }),
          },
          { label: 'Eliminar', icon: Trash2, danger: true, onClick: () => askDelete(category) },
        ]}
      />
    </li>
  );

  return (
    <div className="org-stack">
      <div className="org-toolbar">
        <div className="org-segment" role="group" aria-label="Tipo de categoría">
          <button type="button" aria-pressed={type === 'expense'} onClick={() => setType('expense')}>
            Gastos
          </button>
          <button type="button" aria-pressed={type === 'income'} onClick={() => setType('income')}>
            Ingresos
          </button>
        </div>
        <Button icon={Plus} onClick={() => setForm({ initial: { type } })}>
          Nueva categoría
        </Button>
      </div>
      <p className="org-muted">Archivar oculta una categoría de los formularios sin tocar sus movimientos. Para eliminar una que se usa, primero se reasignan sus movimientos.</p>
      <ul className="org-list">
        {roots.map((root) => (
          <li key={root.id} className="org-tree">
            <ul className="org-list">
              {row(root)}
              {finance.categories
                .filter((c) => c.parentId === root.id)
                .sort((a, b) => a.name.localeCompare(b.name, 'es'))
                .map((child) => row(child, true))}
            </ul>
          </li>
        ))}
      </ul>
      <CategoryForm open={Boolean(form)} initial={form?.initial} onClose={() => setForm(null)} />
      {reassign && <ReassignDialog category={reassign} onClose={() => setReassign(null)} />}
      <DeleteDialog
        open={Boolean(remove)}
        recordId={remove?.id}
        title={`¿Eliminar «${remove?.name ?? ''}»?`}
        onCancel={() => setRemove(null)}
        onConfirm={async () => {
          const { ok } = await run(() => deleteRecord(remove.id), { success: 'Categoría eliminada' });
          if (ok) setRemove(null);
        }}
      />
    </div>
  );
}
