/**
 * Piezas de interfaz compartidas por los cinco módulos de organización.
 * Mantienen el lenguaje visual de la app (Card, Button, Dialog) y añaden lo que
 * un CRUD necesita: pestañas de módulo, estados vacíos, formularios en diálogo,
 * borrado con integridad, búsqueda y navegación por períodos.
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { NavLink } from 'react-router';
import { ChevronLeft, ChevronRight, CircleAlert, Search, X } from 'lucide-react';
import { Button, IconButton } from '../../../components/common/Button.jsx';
import { Dialog } from '../../../components/common/Dialog.jsx';
import { HorizontalScroller } from '../../../components/common/HorizontalScroller.jsx';
import { cx } from '../../../utils/cx.js';
import { useOrganizerStatus } from '../data/hooks.js';
import { ENTITIES } from '../data/entities.js';
import { planDelete } from '../data/store.js';

/** Cabecera de módulo + pestañas (enlaces reales: cada vista tiene su URL). */
export function ModuleLayout({ eyebrow, title, description, actions, tabs, children, className }) {
  const status = useOrganizerStatus();
  return (
    <div className={cx('page org-page', className)}>
      <header className="org-header">
        <div className="org-header__text">
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h1 className="org-header__title">{title}</h1>
          {description && <p className="org-header__description">{description}</p>}
        </div>
        {actions && <div className="org-header__actions">{actions}</div>}
      </header>
      {tabs && (
        <nav className="org-tabs" aria-label={`Secciones de ${title}`}>
          <HorizontalScroller as="ul" trackClassName="org-tabs__list">
            {tabs.map((tab) => (
              <li key={tab.to}>
                <NavLink to={tab.to} end={tab.end} className={({ isActive }) => cx('org-tab', isActive && 'is-active')}>
                  {tab.icon && <tab.icon aria-hidden="true" />}
                  {tab.label}
                </NavLink>
              </li>
            ))}
          </HorizontalScroller>
        </nav>
      )}
      {!status.persistent && (
        <p className="org-banner org-banner--warning" role="status">
          <CircleAlert aria-hidden="true" />
          Este navegador no permite guardar datos (¿modo privado?). Puedes usar la app, pero lo que escribas se perderá al cerrarla.
        </p>
      )}
      {status.ready ? (
        children
      ) : (
        <div className="org-loading" role="status">
          <span className="sr-only">Cargando tus datos…</span>
        </div>
      )}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="org-empty">
      {Icon && <Icon className="org-empty__icon" aria-hidden="true" />}
      <p className="org-empty__title">{title}</p>
      {children && <p className="org-empty__text">{children}</p>}
      {action && <div className="org-empty__action">{action}</div>}
    </div>
  );
}

/**
 * Formulario en diálogo. `onSubmit` devuelve true si se guardó (entonces se cierra).
 * Enter en un campo de una línea envía; Escape cancela.
 */
export function FormDialog({ open, title, description, onClose, onSubmit, submitLabel = 'Guardar', children, size = 'md', extraActions, errors }) {
  const formId = useId();
  const [busy, setBusy] = useState(false);
  const errorCount = errors ? Object.keys(errors).length : 0;
  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const ok = await onSubmit();
      if (ok) onClose();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size={size}
      className="org-dialog"
      footer={
        <>
          {extraActions}
          <span className="org-dialog__spacer" />
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form={formId} disabled={busy}>
            {busy ? 'Guardando…' : submitLabel}
          </Button>
        </>
      }
    >
      <form id={formId} className="org-form" onSubmit={submit} noValidate>
        {errorCount > 1 && (
          <p className="org-banner org-banner--danger" role="alert">
            <CircleAlert aria-hidden="true" />
            Revisa {errorCount} campos marcados antes de guardar.
          </p>
        )}
        {children}
      </form>
    </Dialog>
  );
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function groupCount(entries) {
  const counts = new Map();
  for (const { record } of entries) counts.set(record.kind, (counts.get(record.kind) ?? 0) + 1);
  return [...counts].map(([kind, n]) => plural(n, ENTITIES[kind]?.label ?? 'elemento', ENTITIES[kind]?.plural ?? 'elementos'));
}

/**
 * Confirmación de borrado que muestra las consecuencias reales (planDelete):
 * qué lo impide, qué se desvincula, qué se mueve y qué se borra con él.
 * Si algo lo impide, ofrece `alternative` (archivar, reasignar…).
 */
export function DeleteDialog({ open, recordId, title, onCancel, onConfirm, alternative, extraWarning }) {
  const plan = useMemo(() => (open && recordId ? planDelete(recordId) : null), [open, recordId]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) setBusy(false);
  }, [open]);
  const blocked = plan?.blocked.length > 0;
  const attachments = plan?.target?.attachmentIds?.length ?? 0;
  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} autoFocus>
            {blocked ? 'Entendido' : 'Cancelar'}
          </Button>
          {blocked
            ? alternative && (
                <Button variant="secondary" onClick={alternative.onClick}>
                  {alternative.label}
                </Button>
              )
            : (
                <Button variant="danger" onClick={confirm} disabled={busy}>
                  {busy ? 'Un momento…' : 'Eliminar'}
                </Button>
              )}
        </>
      }
    >
      {plan && (
        <div className="org-delete">
          {blocked ? (
            <p>
              No se puede eliminar porque {plural(plan.blocked.length, 'elemento depende', 'elementos dependen')} de esto (
              {groupCount(plan.blocked).join(', ')}). {alternative?.hint ?? 'Puedes archivarlo para ocultarlo sin perder el historial.'}
            </p>
          ) : (
            <>
              <p>Esta acción no se puede deshacer.</p>
              {plan.cascade.length > 0 && <p className="org-delete__warn">También se eliminarán: {groupCount(plan.cascade).join(', ')}.</p>}
              {plan.unlink.length > 0 && <p>Se conservarán y solo perderán el vínculo: {groupCount(plan.unlink).join(', ')}.</p>}
              {plan.reparent.length > 0 && <p>Su contenido pasará a la carpeta superior: {groupCount(plan.reparent).join(', ')}.</p>}
              {attachments > 0 && <p className="org-delete__warn">Se eliminarán {plural(attachments, 'archivo adjunto', 'archivos adjuntos')}.</p>}
              {extraWarning}
            </>
          )}
        </div>
      )}
    </Dialog>
  );
}

export function SearchField({ label, value, onChange, placeholder = 'Buscar…' }) {
  const id = useId();
  return (
    <div className="org-search">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Search className="org-search__icon" aria-hidden="true" />
      <input id={id} type="search" className="org-search__input" value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} autoComplete="off" enterKeyHint="search" />
      {value && (
        <button type="button" className="org-search__clear" onClick={() => onChange('')} aria-label="Borrar búsqueda">
          <X aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

/** «‹ Marzo de 2026 ›» con botón para volver a hoy. */
export function PeriodNav({ label, onPrev, onNext, onToday, prevLabel = 'Período anterior', nextLabel = 'Período siguiente', todayLabel = 'Hoy' }) {
  return (
    <div className="org-period">
      <IconButton icon={ChevronLeft} label={prevLabel} onClick={onPrev} size="sm" variant="secondary" />
      <p className="org-period__label" aria-live="polite">
        {label}
      </p>
      <IconButton icon={ChevronRight} label={nextLabel} onClick={onNext} size="sm" variant="secondary" />
      {onToday && (
        <Button variant="ghost" size="sm" onClick={onToday}>
          {todayLabel}
        </Button>
      )}
    </div>
  );
}

/** Barra de progreso accesible. `tone`: ok | warning | over. */
export function Progress({ value, max = 100, label, tone = 'ok', showValue = false }) {
  const percent = max ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className={cx('org-progress', `org-progress--${tone}`)}>
      <div className="org-progress__track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)}>
        <span style={{ inlineSize: `${percent}%` }} />
      </div>
      {showValue && <span className="org-progress__value">{Math.round((value / (max || 1)) * 100)} %</span>}
    </div>
  );
}

/** Cifra con etiqueta (resúmenes). */
export function Figure({ label, value, detail, tone }) {
  return (
    <div className={cx('org-figure', tone && `org-figure--${tone}`)}>
      <dt className="org-figure__label">{label}</dt>
      <dd className="org-figure__value">{value}</dd>
      {detail && <dd className="org-figure__detail">{detail}</dd>}
    </div>
  );
}

export function Section({ title, description, action, children, className, id }) {
  const generated = useId();
  const headingId = id ?? generated;
  return (
    <section className={cx('org-section', className)} aria-labelledby={headingId}>
      <header className="org-section__header">
        <div>
          <h2 id={headingId} className="org-section__title">
            {title}
          </h2>
          {description && <p className="org-section__description">{description}</p>}
        </div>
        {action && <div className="org-section__action">{action}</div>}
      </header>
      {children}
    </section>
  );
}

/** Menú de acciones secundarias (⋯) con <details>: sin JavaScript de foco propio y cerrable con Escape. */
export function ActionMenu({ label = 'Más acciones', items, icon: Icon }) {
  const ref = useRef(null);
  const close = () => ref.current?.removeAttribute('open');
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape' && el.open) {
        close();
        el.querySelector('summary')?.focus();
      }
    };
    const onDoc = (event) => {
      if (el.open && !el.contains(event.target)) close();
    };
    el.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDoc);
    return () => {
      el.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDoc);
    };
  }, []);
  const [open, setOpen] = useState(false);
  return (
    <details ref={ref} className="org-menu" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className="icon-btn icon-btn--sm" role="button" aria-expanded={open} aria-label={label} title={label}>
        {Icon ? <Icon aria-hidden="true" /> : <span aria-hidden="true">⋯</span>}
      </summary>
      <ul className="org-menu__list">
        {items.filter(Boolean).map((item) => (
          <li key={item.label}>
            <button
              type="button"
              className={cx('org-menu__item', item.danger && 'is-danger')}
              onClick={() => {
                close();
                item.onClick();
              }}
            >
              {item.icon && <item.icon aria-hidden="true" />}
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}

/** Indicador de guardado automático. */
export function SaveIndicator({ state, savedAt }) {
  const text =
    state === 'saving' ? 'Guardando…' : state === 'dirty' ? 'Cambios sin guardar' : state === 'error' ? 'No se pudo guardar' : savedAt ? `Guardado` : '';
  return (
    <p className={cx('org-save', `org-save--${state}`)} role="status" aria-live="polite">
      {text}
    </p>
  );
}
