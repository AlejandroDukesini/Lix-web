import { useState } from 'react';
import { Archive, ArchiveRestore, BellRing, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '../../../../components/common/Button.jsx';
import { Badge } from '../../../../components/common/Card.jsx';
import { Switch } from '../../../../components/common/Switch.jsx';
import { cx } from '../../../../utils/cx.js';
import { commit, deleteRecord, saveSettings, updateRecord } from '../../data/store.js';
import { useRunner, useSettings } from '../../data/hooks.js';
import { ColorPicker, InputField, SelectField } from '../../shared/Fields.jsx';
import { ActionMenu, DeleteDialog, FormDialog, Section } from '../../shared/ui.jsx';
import { minutesLabel } from '../../shared/format.js';
import { notificationsSupported, requestNotificationPermission } from '../../reminders/ReminderRunner.jsx';
import { usePlanner } from '../usePlanner.js';

function CategoryForm({ open, onClose, initial }) {
  const run = useRunner();
  const isEdit = Boolean(initial?.id);
  const [draft, setDraft] = useState(null);
  const [errors, setErrors] = useState(null);
  if (open && !draft) setDraft({ name: initial?.name ?? '', color: initial?.color ?? '#8e5bd8' });
  if (!open && draft) setDraft(null);
  if (!draft) return null;
  const submit = async () => {
    const { ok, errors: e } = await run(() => commit((tx) => (isEdit ? tx.update(initial.id, draft) : tx.create('eventCategory', draft))), { success: isEdit ? 'Categoría actualizada' : 'Categoría creada' });
    setErrors(e);
    return ok;
  };
  return (
    <FormDialog open={open} onClose={onClose} title={isEdit ? 'Editar categoría' : 'Nueva categoría'} onSubmit={submit} errors={errors} size="sm">
      <InputField label="Nombre" value={draft.name} onChange={(name) => setDraft((d) => ({ ...d, name }))} error={errors?.name} maxLength={40} autoFocus />
      <ColorPicker value={draft.color} onChange={(color) => setDraft((d) => ({ ...d, color }))} />
    </FormDialog>
  );
}

function RemindersSection() {
  const settings = useSettings('reminderSettings');
  const run = useRunner();
  const [permission, setPermission] = useState(() => (notificationsSupported() ? Notification.permission : 'unsupported'));
  const save = (patch, message) => run(() => saveSettings('reminderSettings', patch), { success: message });
  const enableSystem = async (on) => {
    if (!on) return save({ systemNotifications: false }, 'Notificaciones del sistema desactivadas');
    const result = await requestNotificationPermission();
    setPermission(result);
    if (result === 'granted') return save({ systemNotifications: true }, 'Notificaciones del sistema activadas');
    return save({ systemNotifications: false });
  };
  return (
    <Section title="Recordatorios" description="Avisos de eventos, entregas, tareas y pagos programados.">
      <div className="org-panel org-stack">
        <Switch label="Recordatorios activados" description="Avisos dentro de la app a la hora indicada en cada evento, tarea o pago." checked={settings.enabled} onChange={(enabled) => save({ enabled }, enabled ? 'Recordatorios activados' : 'Recordatorios desactivados')} />
        <Switch
          label="Notificaciones del sistema"
          description={
            permission === 'unsupported'
              ? 'Este navegador no admite notificaciones.'
              : permission === 'denied'
                ? 'El navegador las tiene bloqueadas para esta app: actívalas en los permisos del sitio.'
                : 'Si la app está abierta en segundo plano, el aviso llega como notificación del sistema.'
          }
          checked={settings.systemNotifications && permission === 'granted'}
          onChange={enableSystem}
        />
        <Switch label="Mostrar detalles en las notificaciones" description="Desactívalo si no quieres que el título se vea con el teléfono bloqueado." checked={settings.showDetails} onChange={(showDetails) => save({ showDetails }, 'Preferencia guardada')} />
        <p className="org-banner">
          <BellRing aria-hidden="true" />
          <span>
            Importante: los recordatorios funcionan mientras la app está abierta (aunque sea en otra pestaña o en segundo plano). Con la app cerrada no llegan, porque
            no hay un servidor que los envíe; al abrirla verás los de las últimas 12 horas. En iPhone, las notificaciones solo funcionan con la app instalada en la
            pantalla de inicio. El diario emocional nunca genera notificaciones.
          </span>
        </p>
      </div>
    </Section>
  );
}

export function PlannerSettings() {
  const planner = usePlanner();
  const run = useRunner();
  const [form, setForm] = useState(null);
  const [remove, setRemove] = useState(null);
  const save = (patch) => run(() => saveSettings('plannerSettings', patch), { success: 'Preferencia guardada' });
  const s = planner.settings;
  return (
    <div className="org-stack">
      <Section title="Categorías" description="Dan color a los eventos y tareas. Archivar una la oculta de los formularios sin cambiar los eventos que ya la usan." action={<Button size="sm" icon={Plus} onClick={() => setForm({ initial: null })}>Nueva categoría</Button>}>
        <ul className="org-list">
          {planner.categories.map((c) => (
            <li key={c.id} className={cx('org-row org-row--compact', c.archived && 'is-muted')}>
              <span className="org-dot" style={{ '--dot-color': c.color }} aria-hidden="true" />
              <button type="button" className="org-row__main" onClick={() => setForm({ initial: c })}>
                <span className="org-row__title">{c.name}</span>
                <span className="org-row__meta">
                  {planner.events.filter((e) => e.categoryId === c.id).length} eventos · {planner.tasks.filter((t) => t.categoryId === c.id).length} tareas
                  {c.archived && <Badge>Archivada</Badge>}
                </span>
              </button>
              <ActionMenu
                label={`Acciones de ${c.name}`}
                items={[
                  { label: 'Editar', icon: Pencil, onClick: () => setForm({ initial: c }) },
                  { label: c.archived ? 'Restaurar' : 'Archivar', icon: c.archived ? ArchiveRestore : Archive, onClick: () => run(() => updateRecord(c.id, { archived: !c.archived }), { success: c.archived ? 'Categoría restaurada' : 'Categoría archivada' }) },
                  { label: 'Eliminar', icon: Trash2, danger: true, onClick: () => setRemove(c) },
                ]}
              />
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Qué mostrar en el calendario">
        <div className="org-panel org-stack">
          <Switch label="Clases (desde el horario de cada materia)" checked={s.showClasses} onChange={(showClasses) => save({ showClasses })} />
          <Switch label="Entregas, exámenes y lecturas" checked={s.showActivities} onChange={(showActivities) => save({ showActivities })} />
          <Switch label="Tareas con fecha límite" checked={s.showTasks} onChange={(showTasks) => save({ showTasks })} />
          <Switch label="Pagos programados de Finanzas" checked={s.showPayments} onChange={(showPayments) => save({ showPayments })} />
          <div className="org-form__row">
            <SelectField
              label="Vista al abrir"
              value={s.defaultView}
              onChange={(defaultView) => save({ defaultView: defaultView ?? 'month' })}
              options={[
                { value: 'month', label: 'Mes' },
                { value: 'week', label: 'Semana' },
                { value: 'day', label: 'Día' },
                { value: 'agenda', label: 'Agenda' },
              ]}
            />
            <SelectField
              label="Recordatorio predeterminado de un evento nuevo"
              value={String(s.defaultReminder)}
              onChange={(v) => save({ defaultReminder: Number(v) })}
              options={[0, 10, 30, 60, 1440].map((m) => ({ value: String(m), label: minutesLabel(m) }))}
            />
          </div>
        </div>
      </Section>

      <RemindersSection />

      <CategoryForm open={Boolean(form)} initial={form?.initial} onClose={() => setForm(null)} />
      <DeleteDialog
        open={Boolean(remove)}
        recordId={remove?.id}
        title={`¿Eliminar la categoría «${remove?.name ?? ''}»?`}
        onCancel={() => setRemove(null)}
        onConfirm={async () => {
          const { ok } = await run(() => deleteRecord(remove.id), { success: 'Categoría eliminada' });
          if (ok) setRemove(null);
        }}
      />
    </div>
  );
}
