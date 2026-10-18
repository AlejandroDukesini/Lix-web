/**
 * Campos de formulario de la organización. Reutilizan las clases `.field*` de los
 * componentes comunes para verse igual que Configuración en los cuatro estilos.
 * Todos reciben `value` y `onChange(valor)` (no el evento) y muestran su `error`.
 */
import { useId, useState } from 'react';
import { X } from 'lucide-react';
import { cx } from '../../../utils/cx.js';
import { cleanTag, MAX_TAGS } from '../data/fields.js';
import { FREQUENCIES, describeRule } from '../data/recurrence.js';
import { minutesLabel, shortDate } from './format.js';
import { formatMoney, parseAmount } from '../finance/money.js';

function FieldShell({ id, label, hint, error, children, className, hideLabel, as: Tag = 'div' }) {
  return (
    <Tag className={cx('field', error && 'field--invalid', className)}>
      {Tag === 'fieldset' ? (
        <legend className={cx('field__label', hideLabel && 'sr-only')}>{label}</legend>
      ) : (
        <div className="field__top">
          <label htmlFor={id} className={cx('field__label', hideLabel && 'sr-only')}>
            {label}
          </label>
        </div>
      )}
      {children}
      {hint && (
        <p id={`${id}-hint`} className="field__hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="field__error" role="alert">
          {error}
        </p>
      )}
    </Tag>
  );
}

const describedBy = (id, hint, error) => [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;

/** options: [{ value, label, group? }]. `value` null se representa como ''. */
export function SelectField({ label, value, onChange, options, error, hint, placeholder, className, hideLabel, required, disabled }) {
  const id = useId();
  const groups = new Map();
  for (const option of options) {
    const key = option.group ?? '';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(option);
  }
  const render = (list) =>
    list.map((o) => (
      <option key={String(o.value)} value={o.value ?? ''} disabled={o.disabled}>
        {o.label}
      </option>
    ));
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} className={className} hideLabel={hideLabel}>
      <select
        id={id}
        className="field__control field__select"
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value === '' ? null : event.target.value)}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy(id, hint, error)}
        required={required}
        disabled={disabled}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {[...groups].map(([group, list]) =>
          group ? (
            <optgroup key={group} label={group}>
              {render(list)}
            </optgroup>
          ) : (
            render(list)
          ),
        )}
      </select>
    </FieldShell>
  );
}

export function InputField({ label, value, onChange, error, hint, type = 'text', className, hideLabel, ...rest }) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} className={className} hideLabel={hideLabel}>
      <input
        id={id}
        type={type}
        className="field__control"
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy(id, hint, error)}
        {...rest}
      />
    </FieldShell>
  );
}

export function TextAreaField({ label, value, onChange, error, hint, rows = 4, className, ...rest }) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} className={className}>
      <textarea
        id={id}
        className="field__control"
        rows={rows}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy(id, hint, error)}
        {...rest}
      />
    </FieldShell>
  );
}

/**
 * Importe: se escribe como texto («12.500», «12500,50»…) y se muestra cómo se
 * entendió. `value` es el texto; el formulario lo convierte con parseAmount al guardar.
 */
export function AmountField({ label = 'Valor', value, onChange, currency = 'COP', error, allowNegative = false, ...rest }) {
  const parsed = parseAmount(value ?? '');
  const hint =
    value && parsed !== null && (allowNegative || parsed > 0)
      ? `Se guardará como ${formatMoney(parsed, currency)}`
      : value
        ? 'Escribe solo números, por ejemplo 12.500 o 12500,50'
        : undefined;
  return (
    <InputField
      label={label}
      value={value}
      onChange={onChange}
      error={error}
      hint={hint}
      inputMode="decimal"
      autoComplete="off"
      placeholder="0"
      {...rest}
    />
  );
}

export function CheckboxField({ label, checked, onChange, description }) {
  const id = useId();
  return (
    <div className="org-check">
      <input id={id} type="checkbox" checked={Boolean(checked)} onChange={(event) => onChange(event.target.checked)} aria-describedby={description ? `${id}-d` : undefined} />
      <label htmlFor={id}>
        <span className="org-check__label">{label}</span>
        {description && (
          <span id={`${id}-d`} className="org-check__description">
            {description}
          </span>
        )}
      </label>
    </div>
  );
}

/** Varias opciones a la vez como chips pulsables (accesibles con aria-pressed). */
export function ChipGroup({ label, options, values, onChange, hideLabel = false, error }) {
  const id = useId();
  const toggle = (value) => onChange(values.includes(value) ? values.filter((v) => v !== value) : [...values, value]);
  return (
    <div className={cx('field', error && 'field--invalid')} role="group" aria-labelledby={`${id}-l`}>
      <span id={`${id}-l`} className={cx('field__label', hideLabel && 'sr-only')}>
        {label}
      </span>
      <div className="org-chips">
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            className={cx('org-chip', values.includes(o.value) && 'is-active')}
            aria-pressed={values.includes(o.value)}
            onClick={() => toggle(o.value)}
            style={o.color ? { '--chip-color': o.color } : undefined}
          >
            {o.color && <span className="org-dot" aria-hidden="true" />}
            {o.label}
          </button>
        ))}
      </div>
      {error && (
        <p className="field__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** Etiquetas libres: Enter o coma añaden; cada chip se quita con su botón. */
export function TagsField({ label = 'Etiquetas', value, onChange, suggestions = [], hint, max = MAX_TAGS, placeholder = 'Escribe y pulsa Enter' }) {
  const id = useId();
  const [draft, setDraft] = useState('');
  const add = (raw) => {
    const tag = cleanTag(raw);
    setDraft('');
    if (!tag || value.length >= max || value.some((t) => t.toLocaleLowerCase('es') === tag.toLocaleLowerCase('es'))) return;
    onChange([...value, tag]);
  };
  const free = suggestions.filter((s) => !value.some((t) => t.toLocaleLowerCase('es') === s.toLocaleLowerCase('es'))).slice(0, 8);
  return (
    <div className="field">
      <label htmlFor={id} className="field__label">
        {label}
      </label>
      {value.length > 0 && (
        <ul className="org-tags" aria-label={label}>
          {value.map((tag) => (
            <li key={tag} className="org-tag">
              <span>{tag}</span>
              <button type="button" onClick={() => onChange(value.filter((t) => t !== tag))} aria-label={`Quitar «${tag}»`}>
                <X aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        id={id}
        className="field__control"
        value={draft}
        placeholder={value.length >= max ? `Máximo ${max}` : placeholder}
        disabled={value.length >= max}
        onChange={(event) => {
          const text = event.target.value;
          if (text.endsWith(',')) add(text.slice(0, -1));
          else setDraft(text);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            add(draft);
          } else if (event.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={() => draft && add(draft)}
        autoComplete="off"
        aria-describedby={hint ? `${id}-hint` : undefined}
      />
      {free.length > 0 && (
        <div className="org-suggestions" aria-label="Sugerencias">
          {free.map((s) => (
            <button key={s} type="button" className="org-chip org-chip--ghost" onClick={() => add(s)}>
              + {s}
            </button>
          ))}
        </div>
      )}
      {hint && (
        <p id={`${id}-hint`} className="field__hint">
          {hint}
        </p>
      )}
    </div>
  );
}

export const SWATCHES = ['#ef6f8c', '#e07a5f', '#f5b961', '#6fa58b', '#2bb3a3', '#3d8bd9', '#8e5bd8', '#a78bfa', '#d6336c', '#8a8a9a'];

export function ColorPicker({ label = 'Color', value, onChange, allowNone = false }) {
  const id = useId();
  return (
    <fieldset className="field org-colors">
      <legend className="field__label">{label}</legend>
      <div className="org-colors__list">
        {allowNone && (
          <label className={cx('org-swatch org-swatch--none', !value && 'is-active')} title="Sin color">
            <input type="radio" name={id} className="sr-only" checked={!value} onChange={() => onChange(null)} />
            <span className="sr-only">Sin color</span>
          </label>
        )}
        {SWATCHES.map((color) => (
          <label key={color} className={cx('org-swatch', value === color && 'is-active')} style={{ '--swatch': color }} title={color}>
            <input type="radio" name={id} className="sr-only" checked={value === color} onChange={() => onChange(color)} />
            <span className="sr-only">Color {color}</span>
          </label>
        ))}
        <label className={cx('org-swatch org-swatch--custom', value && !SWATCHES.includes(value) && 'is-active')} style={value ? { '--swatch': value } : undefined}>
          <input type="color" value={value ?? '#8e5bd8'} onChange={(event) => onChange(event.target.value)} aria-label="Elegir otro color" />
        </label>
      </div>
    </fieldset>
  );
}

const WEEKDAYS = [
  [1, 'L', 'lunes'],
  [2, 'M', 'martes'],
  [3, 'X', 'miércoles'],
  [4, 'J', 'jueves'],
  [5, 'V', 'viernes'],
  [6, 'S', 'sábado'],
  [0, 'D', 'domingo'],
];
const FREQ_LABELS = { daily: 'Cada día', weekly: 'Cada semana', monthly: 'Cada mes', yearly: 'Cada año' };
const UNIT_LABELS = { daily: 'días', weekly: 'semanas', monthly: 'meses', yearly: 'años' };

/** Repetición: frecuencia, intervalo, días de la semana y final (nunca, fecha o número de veces). */
export function RecurrenceField({ value, onChange, startDate, error, allowNone = true, label = 'Repetición' }) {
  const id = useId();
  const rule = value;
  const set = (patch) => onChange({ freq: 'weekly', interval: 1, until: null, count: null, weekdays: [], ...rule, ...patch });
  const endMode = rule?.until ? 'until' : rule?.count ? 'count' : 'never';
  return (
    <fieldset className={cx('field org-recurrence', error && 'field--invalid')}>
      <legend className="field__label">{label}</legend>
      <select
        className="field__control field__select"
        aria-label="Frecuencia"
        value={rule?.freq ?? ''}
        onChange={(event) => (event.target.value ? set({ freq: event.target.value, weekdays: [] }) : onChange(null))}
      >
        {allowNone && <option value="">No se repite</option>}
        {FREQUENCIES.map((f) => (
          <option key={f} value={f}>
            {FREQ_LABELS[f]}
          </option>
        ))}
      </select>
      {rule && (
        <div className="org-recurrence__details">
          <label className="org-inline">
            <span>Cada</span>
            <input
              type="number"
              min="1"
              max="99"
              className="field__control org-inline__number"
              value={rule.interval}
              onChange={(event) => set({ interval: Math.min(99, Math.max(1, Number(event.target.value) || 1)) })}
              aria-label="Intervalo"
            />
            <span>{UNIT_LABELS[rule.freq]}</span>
          </label>
          {rule.freq === 'weekly' && (
            <div className="org-weekdays" role="group" aria-label="Días de la semana">
              {WEEKDAYS.map(([day, short, name]) => (
                <button
                  key={day}
                  type="button"
                  className={cx('org-weekday', rule.weekdays?.includes(day) && 'is-active')}
                  aria-pressed={rule.weekdays?.includes(day) ?? false}
                  aria-label={name}
                  onClick={() => set({ weekdays: rule.weekdays?.includes(day) ? rule.weekdays.filter((d) => d !== day) : [...(rule.weekdays ?? []), day] })}
                >
                  {short}
                </button>
              ))}
            </div>
          )}
          <div className="org-recurrence__end">
            <select
              className="field__control field__select"
              aria-label="Termina"
              value={endMode}
              onChange={(event) => {
                const mode = event.target.value;
                if (mode === 'never') set({ until: null, count: null });
                else if (mode === 'until') set({ count: null, until: startDate ?? null });
                else set({ until: null, count: 10 });
              }}
            >
              <option value="never">Sin fecha final</option>
              <option value="until">Hasta una fecha</option>
              <option value="count">Un número de veces</option>
            </select>
            {endMode === 'until' && (
              <input id={`${id}-until`} type="date" className="field__control" aria-label="Fecha final" value={rule.until ?? ''} min={startDate ?? undefined} onChange={(event) => set({ until: event.target.value || null })} />
            )}
            {endMode === 'count' && (
              <input
                type="number"
                min="1"
                max="1000"
                className="field__control org-inline__number"
                aria-label="Número de veces"
                value={rule.count ?? 1}
                onChange={(event) => set({ count: Math.min(1000, Math.max(1, Number(event.target.value) || 1)) })}
              />
            )}
          </div>
          <p className="field__hint">{describeRule(rule, (iso) => shortDate(iso))}</p>
        </div>
      )}
      {error && (
        <p className="field__error" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}

export const REMINDER_PRESETS = [0, 10, 30, 60, 120, 1440, 2880, 10080];

export function RemindersField({ value, onChange, label = 'Recordatorios', hint }) {
  return (
    <div>
      <ChipGroup label={label} options={REMINDER_PRESETS.map((m) => ({ value: m, label: minutesLabel(m) }))} values={value} onChange={(list) => onChange(list.slice(-5))} />
      {hint && <p className="field__hint">{hint}</p>}
    </div>
  );
}
