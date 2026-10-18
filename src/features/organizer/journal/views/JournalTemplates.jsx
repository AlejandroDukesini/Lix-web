import { useState } from 'react';
import { Feather, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '../../../../components/common/Button.jsx';
import { Switch } from '../../../../components/common/Switch.jsx';
import { commit, deleteRecord, saveSettings } from '../../data/store.js';
import { useRunner } from '../../data/hooks.js';
import { InputField, TextAreaField } from '../../shared/Fields.jsx';
import { ActionMenu, DeleteDialog, FormDialog, Section } from '../../shared/ui.jsx';
import { TagManager } from '../../shared/TagManager.jsx';
import { useJournal } from '../useJournal.js';

function TemplateForm({ open, onClose, initial }) {
  const run = useRunner();
  const isEdit = Boolean(initial?.id);
  const [draft, setDraft] = useState(null);
  const [errors, setErrors] = useState(null);
  if (open && !draft) setDraft({ name: initial?.name ?? '', description: initial?.description ?? '', body: initial?.body ?? '' });
  if (!open && draft) setDraft(null);
  if (!draft) return null;
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const submit = async () => {
    const { ok, errors: e } = await run(() => commit((tx) => (isEdit ? tx.update(initial.id, draft) : tx.create('journalTemplate', draft))), { success: isEdit ? 'Plantilla actualizada' : 'Plantilla creada' });
    setErrors(e);
    return ok;
  };
  return (
    <FormDialog open={open} onClose={onClose} title={isEdit ? 'Editar plantilla' : 'Nueva plantilla'} onSubmit={submit} errors={errors} size="lg">
      <InputField label="Nombre" value={draft.name} onChange={(name) => set({ name })} error={errors?.name} maxLength={60} autoFocus />
      <InputField label="Descripción (opcional)" value={draft.description} onChange={(description) => set({ description })} maxLength={200} />
      <TextAreaField label="Texto inicial" value={draft.body} onChange={(body) => set({ body })} error={errors?.body} rows={10} maxLength={8000} hint="Usa ## para los apartados. Al usar la plantilla, todo se puede borrar o cambiar." />
    </FormDialog>
  );
}

export function JournalTemplates() {
  const journal = useJournal();
  const run = useRunner();
  const [form, setForm] = useState(null);
  const [remove, setRemove] = useState(null);
  const save = (patch) => run(() => saveSettings('journalSettings', patch), { success: 'Preferencia guardada' });
  return (
    <div className="org-stack">
      <Section title="Plantillas" description="Siempre opcionales: un punto de partida para cuando no sabes por dónde empezar." action={<Button size="sm" icon={Plus} onClick={() => setForm({ initial: null })}>Nueva plantilla</Button>}>
        <ul className="org-list">
          {journal.templates.map((t) => (
            <li key={t.id} className="org-row org-row--compact">
              <Feather aria-hidden="true" width={20} height={20} />
              <div className="org-row__main">
                <span className="org-row__title">{t.name}</span>
                <span className="org-row__meta">{t.builtin ? 'Incluida' : 'Tuya'}{t.description && ` · ${t.description}`}</span>
              </div>
              <div className="org-row__end">
                <Button size="sm" variant="secondary" to={`/diario/nueva?plantilla=${t.id}`}>
                  Usar
                </Button>
                {!t.builtin && (
                  <ActionMenu
                    label={`Acciones de ${t.name}`}
                    items={[
                      { label: 'Editar', icon: Pencil, onClick: () => setForm({ initial: t }) },
                      { label: 'Eliminar', icon: Trash2, danger: true, onClick: () => setRemove(t) },
                    ]}
                  />
                )}
              </div>
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Al escribir">
        <div className="org-panel org-stack">
          <Switch label="Mostrar una pregunta para empezar" description="Una sugerencia que puedes usar, cambiar u ocultar. Nunca es obligatoria." checked={journal.settings.showPrompts} onChange={(showPrompts) => save({ showPrompts })} />
          <Switch label="Mostrar «En un día como hoy»" description="Entradas del mismo día en años anteriores, calculadas en este dispositivo." checked={journal.settings.showMemories} onChange={(showMemories) => save({ showMemories })} />
        </div>
      </Section>
      <Section title="Etiquetas del diario">
        <TagManager kinds={['journalEntry']} noun="entradas" />
      </Section>
      <TemplateForm open={Boolean(form)} initial={form?.initial} onClose={() => setForm(null)} />
      <DeleteDialog
        open={Boolean(remove)}
        recordId={remove?.id}
        title={`¿Eliminar la plantilla «${remove?.name ?? ''}»?`}
        onCancel={() => setRemove(null)}
        onConfirm={async () => {
          const { ok } = await run(() => deleteRecord(remove.id), { success: 'Plantilla eliminada' });
          if (ok) setRemove(null);
        }}
        extraWarning={<p>Las entradas que la usaron no cambian.</p>}
      />
    </div>
  );
}
