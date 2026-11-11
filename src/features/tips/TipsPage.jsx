import { useEffect, useMemo, useState } from 'react';
import { BellRing, Heart, History, Lightbulb, Pencil, Plus, Quote, Settings2, Share2, Shuffle, Trash2 } from 'lucide-react';
import { Button, IconButton } from '../../components/common/Button.jsx';
import { SegmentedControl } from '../../components/common/SegmentedControl.jsx';
import { Switch } from '../../components/common/Switch.jsx';
import { useToast } from '../../components/feedback/ToastProvider.jsx';
import { useNow } from '../../hooks/useNow.js';
import { cx } from '../../utils/cx.js';
import { commit, deleteRecord, saveSettings } from '../organizer/data/store.js';
import { useKind, useRunner, useSettings } from '../organizer/data/hooks.js';
import { InputField, SelectField, TextAreaField } from '../organizer/shared/Fields.jsx';
import { ActionMenu, DeleteDialog, EmptyState, FormDialog, ModuleLayout, Section } from '../organizer/shared/ui.jsx';
import { dateTimeLabel } from '../organizer/shared/format.js';
import { notificationsSupported, requestNotificationPermission } from '../organizer/reminders/ReminderRunner.jsx';
import { isAndroidShell, nativeNotificationPermission, requestNativeNotificationPermission } from '../../services/native/androidBridge.js';
import { TIP_CATEGORIES } from './content/tips.js';
import { appendHistory, CATEGORY_IDS, currentSlot, findTip, FREQUENCIES, nextSlotTime, pickTip, tipPool } from './tipsLogic.js';
import '../organizer/shared/organizer.css';
import './tips.css';

const WEEK = [
  { value: 1, label: 'L' },
  { value: 2, label: 'M' },
  { value: 3, label: 'X' },
  { value: 4, label: 'J' },
  { value: 5, label: 'V' },
  { value: 6, label: 'S' },
  { value: 0, label: 'D' },
];
const CHANNEL_LABELS = { app: 'En la app', system: 'Notificación', manual: 'Pedido por ti', android: 'Notificación de Android' };

async function shareTip(tip, toast) {
  const text = `«${tip.text}»`;
  try {
    if (navigator.share) {
      await navigator.share({ text });
      return;
    }
    await navigator.clipboard.writeText(text);
    toast({ message: 'Consejo copiado: pégalo donde quieras' });
  } catch (error) {
    if (error?.name !== 'AbortError') toast({ tone: 'error', message: 'No se pudo compartir en este navegador.' });
  }
}

function TipCard({ tip, shownAt, favorite, onFavorite, onShare, onAnother }) {
  return (
    <article className="tip-card" aria-live="polite">
      <Quote className="tip-card__mark" aria-hidden="true" />
      <p className="tip-card__category">{TIP_CATEGORIES[tip.category]}</p>
      <blockquote className="tip-card__text">{tip.text}</blockquote>
      <p className="tip-card__meta">
        {tip.source === 'dicho' ? 'Dicho popular' : tip.source === 'propio' ? 'Escrito por ti' : 'Lix'}
        {shownAt && ` · ${dateTimeLabel(shownAt)}`}
      </p>
      <div className="tip-card__actions">
        <Button variant={favorite ? 'primary' : 'secondary'} size="sm" icon={Heart} onClick={onFavorite} aria-pressed={favorite}>
          {favorite ? 'Favorito' : 'Guardar'}
        </Button>
        <Button variant="secondary" size="sm" icon={Share2} onClick={onShare}>
          Compartir
        </Button>
        <Button variant="ghost" size="sm" icon={Shuffle} onClick={onAnother}>
          Otro consejo
        </Button>
      </div>
    </article>
  );
}

function TipRow({ tip, at, channel, favorite, onFavorite }) {
  return (
    <li className="tip-row">
      <div className="tip-row__main">
        <p className="tip-row__text">{tip.text}</p>
        <p className="org-subtle">
          {TIP_CATEGORIES[tip.category]}
          {at && ` · ${dateTimeLabel(at)}`}
          {channel && ` · ${CHANNEL_LABELS[channel]}`}
        </p>
      </div>
      <IconButton icon={Heart} label={favorite ? 'Quitar de favoritos' : 'Añadir a favoritos'} aria-pressed={favorite} className={favorite ? 'is-favorite' : undefined} onClick={onFavorite} />
    </li>
  );
}

function CustomTipForm({ open, initial, onClose }) {
  const run = useRunner();
  const isEdit = Boolean(initial?.id);
  const [draft, setDraft] = useState(null);
  const [errors, setErrors] = useState(null);
  if (open && !draft) setDraft({ text: initial?.text ?? '', category: initial?.category ?? 'reflexion' });
  if (!open && draft) setDraft(null);
  if (!draft) return null;
  const submit = async () => {
    const { ok, errors: e } = await run(() => commit((tx) => (isEdit ? tx.update(initial.id, draft) : tx.create('tip', draft))), { success: isEdit ? 'Consejo actualizado' : 'Consejo añadido a la colección' });
    setErrors(e);
    return ok;
  };
  return (
    <FormDialog open={open} onClose={onClose} title={isEdit ? 'Editar consejo' : 'Nuevo consejo propio'} onSubmit={submit} errors={errors}>
      <TextAreaField label="Consejo" value={draft.text} onChange={(text) => setDraft((d) => ({ ...d, text }))} error={errors?.text} rows={3} maxLength={280} hint={`${280 - draft.text.length} caracteres disponibles`} autoFocus />
      <SelectField label="Categoría" value={draft.category} onChange={(category) => setDraft((d) => ({ ...d, category }))} options={CATEGORY_IDS.map((value) => ({ value, label: TIP_CATEGORIES[value] }))} />
    </FormDialog>
  );
}

function TipSettings({ settings, onChange }) {
  const now = useNow(60_000);
  const android = isAndroidShell();
  const [permission, setPermission] = useState(() => (android ? nativeNotificationPermission() : notificationsSupported() ? Notification.permission : 'unsupported'));
  const next = nextSlotTime(now, settings);
  const toggle = (list, value) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  return (
    <div className="org-stack">
      <Switch label="Consejos activados" description="Un consejo nuevo en cada franja del horario elegido." checked={settings.enabled} onChange={(enabled) => onChange({ enabled })} />
      <div className="org-form__row">
        <SelectField label="Frecuencia" value={String(settings.frequencyMinutes)} onChange={(v) => onChange({ frequencyMinutes: Number(v) })} options={FREQUENCIES.map((f) => ({ value: String(f.value), label: f.label }))} />
        <InputField label="Desde" type="time" value={settings.startTime} onChange={(startTime) => startTime && onChange({ startTime })} />
        <InputField label="Hasta" type="time" value={settings.endTime} onChange={(endTime) => endTime && onChange({ endTime })} />
      </div>
      <fieldset className="tip-chips">
        <legend>Días activos</legend>
        {WEEK.map((d) => (
          <button key={d.value} type="button" className={cx('org-chip', settings.days.includes(d.value) && 'is-active')} aria-pressed={settings.days.includes(d.value)} onClick={() => onChange({ days: toggle(settings.days, d.value) })}>
            {d.label}
          </button>
        ))}
      </fieldset>
      <fieldset className="tip-chips">
        <legend>Categorías preferidas</legend>
        {CATEGORY_IDS.map((c) => (
          <button key={c} type="button" className={cx('org-chip', settings.categories.includes(c) && 'is-active')} aria-pressed={settings.categories.includes(c)} onClick={() => onChange({ categories: toggle(settings.categories, c) })}>
            {TIP_CATEGORIES[c]}
          </button>
        ))}
        <p className="org-subtle">Si desmarcas todas, se usan todas.</p>
      </fieldset>
      <p className="org-subtle">{settings.enabled ? (next ? `Próximo consejo: ${dateTimeLabel(next.toISOString())}.` : 'Con este horario no hay ninguna franja próxima.') : 'Los consejos están desactivados.'}</p>

      <Section title="Dónde aparecen" className="tip-where">
        <Switch label="Dentro de la app" description="Una tarjeta aparece mientras usas la app." checked={settings.inApp} onChange={(inApp) => onChange({ inApp })} />
        <Switch
          label="Notificaciones del sistema"
          description={
            permission === 'unsupported'
              ? 'Este navegador no admite notificaciones.'
              : permission === 'denied'
                ? 'El navegador las tiene bloqueadas para esta app. Actívalas en los ajustes del navegador.'
                : android
                  ? 'Android las muestra en cada franja, también con la app cerrada.'
                  : 'Cuando la app está en segundo plano.'
          }
          checked={settings.notifications && permission === 'granted'}
          onChange={async (value) => {
            if (!value) return onChange({ notifications: false });
            const result = permission === 'granted' ? 'granted' : android ? await requestNativeNotificationPermission() : await requestNotificationPermission();
            setPermission(result);
            return onChange({ notifications: result === 'granted' });
          }}
        />
        <div className="org-banner">
          <BellRing aria-hidden="true" />
          <span>
            <strong>Límites reales.</strong> En la web (y en el iPhone) los consejos solo llegan con la app abierta o en segundo plano reciente: no hay servidor de notificaciones.
            En la app de Android las notificaciones las programa el sistema aunque la app esté cerrada, pero Android puede retrasarlas unos minutos por el ahorro de
            batería. Nunca se envía más de un consejo por franja.
          </span>
        </div>
      </Section>
    </div>
  );
}

export default function TipsPage() {
  const settings = useSettings('tipSettings');
  const state = useSettings('tipState');
  const customTips = useKind('tip');
  const run = useRunner();
  const { toast } = useToast();
  const now = useNow(60_000);
  const [tab, setTab] = useState('history');
  const [form, setForm] = useState(null);
  const [remove, setRemove] = useState(null);

  useEffect(() => {
    document.title = 'Consejos diarios · Un año más contigo';
  }, []);

  // El consejo «de ahora»: el último mostrado si es de esta franja; si no, el que tocaría (sin registrarlo).
  const current = useMemo(() => {
    const last = state.history.at(-1);
    const lastTip = last && findTip(last.tipId, customTips);
    const slot = currentSlot(now, settings);
    if (lastTip && (!slot || state.lastSlot === slot.key || last.channel === 'manual')) return { tip: lastTip, shownAt: last.shownAt };
    const tip = pickTip(tipPool(customTips, settings.categories), state.history, slot?.key ?? `hoy-${now.toDateString()}`);
    return tip ? { tip, shownAt: null } : null;
  }, [state, customTips, settings, now]);

  const favorites = new Set(state.favorites);
  const toggleFavorite = (id) => run(() => saveSettings('tipState', { favorites: favorites.has(id) ? state.favorites.filter((f) => f !== id) : [...state.favorites, id] }), { success: favorites.has(id) ? 'Quitado de favoritos' : 'Guardado en favoritos' });
  const another = () => {
    const tip = pickTip(tipPool(customTips, settings.categories), state.history, `manual-${Date.now()}`);
    if (tip) run(() => saveSettings('tipState', { history: appendHistory(state.history, { tipId: tip.id, shownAt: new Date().toISOString(), channel: 'manual' }) }));
  };
  const history = [...state.history]
    .reverse()
    .map((h) => ({ ...h, tip: findTip(h.tipId, customTips) }))
    .filter((h) => h.tip);
  const favoriteTips = state.favorites.map((id) => findTip(id, customTips)).filter(Boolean);

  return (
    <ModuleLayout className="tips-page" eyebrow="Para el día" title="Consejos diarios" description="Mensajes breves para pensar, animarte o respirar un momento. Todos se guardan en este dispositivo.">
      {current ? (
        <TipCard
          tip={current.tip}
          shownAt={current.shownAt}
          favorite={favorites.has(current.tip.id)}
          onFavorite={() => toggleFavorite(current.tip.id)}
          onShare={() => shareTip(current.tip, toast)}
          onAnother={another}
        />
      ) : (
        <EmptyState icon={Lightbulb} title="No hay consejos en las categorías elegidas" />
      )}

      <SegmentedControl
        label="Sección"
        hideLabel
        value={tab}
        onChange={setTab}
        options={[
          { value: 'history', label: 'Historial', icon: History },
          { value: 'favorites', label: 'Favoritos', icon: Heart },
          { value: 'mine', label: 'Mis consejos', icon: Pencil },
          { value: 'settings', label: 'Ajustes', icon: Settings2 },
        ]}
      />

      {tab === 'history' &&
        (history.length ? (
          <ul className="tip-list">
            {history.map((h) => (
              <TipRow key={`${h.tipId}-${h.shownAt}`} tip={h.tip} at={h.shownAt} channel={h.channel} favorite={favorites.has(h.tipId)} onFavorite={() => toggleFavorite(h.tipId)} />
            ))}
          </ul>
        ) : (
          <EmptyState icon={History} title="Aún no hay historial">
            Aquí quedarán los consejos que vayas recibiendo (los últimos 200).
          </EmptyState>
        ))}

      {tab === 'favorites' &&
        (favoriteTips.length ? (
          <ul className="tip-list">
            {favoriteTips.map((tip) => (
              <TipRow key={tip.id} tip={tip} favorite onFavorite={() => toggleFavorite(tip.id)} />
            ))}
          </ul>
        ) : (
          <EmptyState icon={Heart} title="Sin favoritos todavía">
            Pulsa «Guardar» en un consejo que quieras volver a leer.
          </EmptyState>
        ))}

      {tab === 'mine' && (
        <div className="org-stack">
          <div className="org-toolbar">
            <Button icon={Plus} onClick={() => setForm({ initial: null })}>
              Nuevo consejo
            </Button>
          </div>
          {customTips.length ? (
            <ul className="tip-list">
              {customTips.map((tip) => (
                <li key={tip.id} className="tip-row">
                  <div className="tip-row__main">
                    <p className="tip-row__text">{tip.text}</p>
                    <p className="org-subtle">{TIP_CATEGORIES[tip.category]}</p>
                  </div>
                  <ActionMenu
                    label="Acciones del consejo"
                    items={[
                      { label: 'Editar', icon: Pencil, onClick: () => setForm({ initial: tip }) },
                      { label: 'Eliminar', icon: Trash2, danger: true, onClick: () => setRemove(tip) },
                    ]}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={Pencil} title="Escribe tus propios consejos">
              Se mezclan con los de la colección en la categoría que elijas.
            </EmptyState>
          )}
        </div>
      )}

      {tab === 'settings' && <TipSettings settings={settings} onChange={(patch) => run(() => saveSettings('tipSettings', patch))} />}

      <CustomTipForm open={Boolean(form)} initial={form?.initial} onClose={() => setForm(null)} />
      <DeleteDialog
        open={Boolean(remove)}
        recordId={remove?.id}
        title="¿Eliminar este consejo?"
        onCancel={() => setRemove(null)}
        onConfirm={async () => {
          const { ok } = await run(() => deleteRecord(remove.id), { success: 'Consejo eliminado' });
          if (ok) {
            if (favorites.has(remove.id)) await saveSettings('tipState', { favorites: state.favorites.filter((f) => f !== remove.id) });
            setRemove(null);
          }
        }}
      />
    </ModuleLayout>
  );
}
