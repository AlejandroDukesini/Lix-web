import { useState } from 'react';
import { Archive, ArchiveRestore, Download, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '../../../../components/common/Button.jsx';
import { Badge } from '../../../../components/common/Card.jsx';
import { ConfirmDialog } from '../../../../components/common/Dialog.jsx';
import { Switch } from '../../../../components/common/Switch.jsx';
import { cx } from '../../../../utils/cx.js';
import { commit, deleteRecord, eraseKinds, saveSettings, updateRecord } from '../../data/store.js';
import { useRunner } from '../../data/hooks.js';
import { VALENCES } from '../../data/entities.js';
import { downloadFile, toCSV } from '../../data/csv.js';
import { ColorPicker, InputField, SelectField } from '../../shared/Fields.jsx';
import { ActionMenu, DeleteDialog, FormDialog, Section } from '../../shared/ui.jsx';
import { TagManager } from '../../shared/TagManager.jsx';
import { MOODS, REFLECTION_QUESTIONS, VALENCE_SINGULAR } from '../content.js';
import { useEmotions } from '../useEmotions.js';
import { toISODate } from '../../../../utils/dates.js';

function EmotionForm({ open, onClose, initial }) {
  const data = useEmotions();
  const run = useRunner();
  const isEdit = Boolean(initial?.id);
  const [draft, setDraft] = useState(null);
  const [errors, setErrors] = useState(null);
  if (open && !draft) setDraft({ name: initial?.name ?? '', valence: initial?.valence ?? 'mixed', color: initial?.color ?? '#a78bfa', description: initial?.description ?? '', order: initial?.order ?? data.emotions.length });
  if (!open && draft) setDraft(null);
  if (!draft) return null;
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const submit = async () => {
    const { ok, errors: e } = await run(() => commit((tx) => (isEdit ? tx.update(initial.id, draft) : tx.create('emotion', draft))), { success: isEdit ? 'Emoción actualizada' : 'Emoción creada' });
    setErrors(e);
    return ok;
  };
  return (
    <FormDialog open={open} onClose={onClose} title={isEdit ? 'Editar emoción' : 'Nueva emoción'} onSubmit={submit} errors={errors} size="sm">
      <InputField label="Nombre" value={draft.name} onChange={(name) => set({ name })} error={errors?.name} maxLength={30} autoFocus />
      <SelectField label="Tono" value={draft.valence} onChange={(valence) => set({ valence: valence ?? 'mixed' })} options={VALENCES.map((v) => ({ value: v, label: VALENCE_SINGULAR[v] }))} hint="Solo sirve para agrupar; ninguna emoción es buena o mala." />
      <InputField label="Descripción (opcional)" value={draft.description} onChange={(description) => set({ description })} maxLength={200} />
      <ColorPicker value={draft.color} onChange={(color) => set({ color })} />
    </FormDialog>
  );
}

const MOOD_TEXT = Object.fromEntries(MOODS.map((m) => [m.value, m.label]));

function exportLogs(data, format) {
  const name = (id) => data.emotionsById.get(id)?.name ?? '';
  const stamp = toISODate(new Date());
  if (format === 'json') {
    const payload = {
      format: 'un-ano-mas-contigo/diario-emocional',
      exportedAt: new Date().toISOString(),
      emotions: data.emotions,
      logs: data.logs,
    };
    downloadFile(`diario-emocional-${stamp}.json`, JSON.stringify(payload, null, 2), 'application/json');
    return;
  }
  const rows = [['fecha', 'emocion', 'otras', 'intensidad', 'escala', 'animo', 'descripcion', 'contexto', 'ambitos', 'factores', 'necesidades', 'estrategias', 'etiquetas', 'notas_privadas', ...REFLECTION_QUESTIONS.map((q) => q.id)]];
  for (const log of [...data.logs].reverse()) {
    rows.push([
      log.at,
      name(log.primaryId),
      log.secondaryIds.map(name).join('|'),
      log.intensity,
      log.scale,
      log.mood === null ? '' : MOOD_TEXT[log.mood],
      log.description,
      log.context,
      log.contextTags.join('|'),
      log.factors.join('|'),
      log.needs.join('|'),
      log.strategies.join('|'),
      log.tags.join('|'),
      log.privateNotes,
      ...REFLECTION_QUESTIONS.map((q) => log.reflection[q.id] ?? ''),
    ]);
  }
  downloadFile(`diario-emocional-${stamp}.csv`, toCSV(rows));
}

export function EmotionSettings() {
  const data = useEmotions();
  const run = useRunner();
  const [form, setForm] = useState(null);
  const [remove, setRemove] = useState(null);
  const [eraseAll, setEraseAll] = useState(false);
  const usage = (id) => data.logs.filter((l) => l.primaryId === id || l.secondaryIds.includes(id)).length;

  return (
    <div className="org-stack">
      <Section
        title="Emociones"
        description="Personaliza la lista: cambia nombres y colores, añade las tuyas o archiva las que no uses. Una emoción que aparece en registros no se borra: se archiva para conservar el historial."
        action={<Button size="sm" icon={Plus} onClick={() => setForm({ initial: null })}>Nueva emoción</Button>}
      >
        <ul className="org-list org-grid">
          {data.emotions.map((emotion) => (
            <li key={emotion.id} className={cx('org-row org-row--compact', emotion.archived && 'is-muted')}>
              <span className="org-dot" style={{ '--dot-color': emotion.color }} aria-hidden="true" />
              <button type="button" className="org-row__main" onClick={() => setForm({ initial: emotion })}>
                <span className="org-row__title">{emotion.name}</span>
                <span className="org-row__meta">
                  {VALENCE_SINGULAR[emotion.valence]} · {usage(emotion.id)} registros
                  {emotion.archived && <Badge>Archivada</Badge>}
                </span>
              </button>
              <ActionMenu
                label={`Acciones de ${emotion.name}`}
                items={[
                  { label: 'Editar', icon: Pencil, onClick: () => setForm({ initial: emotion }) },
                  { label: emotion.archived ? 'Restaurar' : 'Archivar', icon: emotion.archived ? ArchiveRestore : Archive, onClick: () => run(() => updateRecord(emotion.id, { archived: !emotion.archived }), { success: emotion.archived ? 'Emoción restaurada' : 'Emoción archivada' }) },
                  { label: 'Eliminar', icon: Trash2, danger: true, onClick: () => setRemove(emotion) },
                ]}
              />
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Al registrar">
        <div className="org-panel org-stack">
          <SelectField
            label="Escala de intensidad"
            value={String(data.settings.scale)}
            onChange={(v) => run(() => saveSettings('emotionSettings', { scale: Number(v) }), { success: 'Escala guardada' })}
            options={[
              { value: '5', label: 'De 1 a 5' },
              { value: '10', label: 'De 1 a 10' },
            ]}
            hint="Los registros anteriores conservan su escala; los gráficos los comparan en porcentaje."
          />
          <Switch label="Ofrecer la reflexión guiada" description="Preguntas opcionales al final del registro." checked={data.settings.showReflection} onChange={(showReflection) => run(() => saveSettings('emotionSettings', { showReflection }), { success: 'Preferencia guardada' })} />
        </div>
      </Section>

      <Section title="Etiquetas">
        <TagManager kinds={['emotionLog']} noun="registros" />
      </Section>

      <Section title="Tus datos" description="Los registros emocionales nunca salen de este dispositivo ni aparecen en notificaciones. Puedes llevártelos o borrarlos cuando quieras.">
        <div className="org-toolbar">
          <Button variant="secondary" icon={Download} onClick={() => exportLogs(data, 'csv')} disabled={!data.logs.length}>
            Exportar CSV
          </Button>
          <Button variant="secondary" icon={Download} onClick={() => exportLogs(data, 'json')} disabled={!data.logs.length}>
            Exportar JSON
          </Button>
          <Button variant="danger" icon={Trash2} onClick={() => setEraseAll(true)} disabled={!data.logs.length}>
            Borrar todos mis registros
          </Button>
        </div>
        <p className="org-subtle">El archivo exportado no está cifrado: guárdalo en un lugar privado.</p>
      </Section>

      <EmotionForm open={Boolean(form)} initial={form?.initial} onClose={() => setForm(null)} />
      <DeleteDialog
        open={Boolean(remove)}
        recordId={remove?.id}
        title={`¿Eliminar «${remove?.name ?? ''}»?`}
        onCancel={() => setRemove(null)}
        onConfirm={async () => {
          const { ok } = await run(() => deleteRecord(remove.id), { success: 'Emoción eliminada' });
          if (ok) setRemove(null);
        }}
        alternative={
          remove && !remove.archived
            ? {
                label: 'Archivar',
                hint: 'Archívala: deja de aparecer al registrar y el historial se conserva.',
                onClick: async () => {
                  await run(() => updateRecord(remove.id, { archived: true }), { success: 'Emoción archivada' });
                  setRemove(null);
                },
              }
            : undefined
        }
      />
      <ConfirmDialog
        open={eraseAll}
        title="¿Borrar todos los registros emocionales?"
        description={`Se eliminarán ${data.logs.length} registros de este dispositivo. Las emociones personalizadas y los ajustes se conservan. No se puede deshacer: si quieres, exporta antes una copia.`}
        confirmLabel="Borrar registros"
        requireText="BORRAR"
        onConfirm={async () => {
          await run(() => eraseKinds(['emotionLog']), { success: 'Registros emocionales borrados' });
          setEraseAll(false);
        }}
        onCancel={() => setEraseAll(false)}
      />
    </div>
  );
}
