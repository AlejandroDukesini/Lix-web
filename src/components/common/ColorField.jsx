import { useEffect, useId, useState } from 'react';
import { normalizeHex } from '../../utils/color.js';

/**
 * Selector de color: muestra el selector nativo del sistema (rueda en móvil,
 * cuadro en escritorio) y un campo hexadecimal para escribir el valor exacto.
 */
export function ColorField({ label, description, value, onChange }) {
  const id = useId();
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState(null);

  useEffect(() => {
    setDraft(value);
    setError(null);
  }, [value]);

  const commitDraft = () => {
    const hex = normalizeHex(draft);
    if (!hex) {
      setError('Usa un color hexadecimal, por ejemplo #ef6f8c.');
      return;
    }
    setError(null);
    if (hex !== value) onChange(hex);
    else setDraft(hex);
  };

  return (
    <div className="color-field">
      <label className="color-field__swatch" htmlFor={`${id}-picker`}>
        <input
          id={`${id}-picker`}
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-describedby={description ? `${id}-desc` : undefined}
        />
        <span className="sr-only">{label}: selector de color</span>
      </label>
      <div className="color-field__text">
        <label htmlFor={`${id}-hex`} className="color-field__label">
          {label}
        </label>
        {description && (
          <span id={`${id}-desc`} className="color-field__description">
            {description}
          </span>
        )}
        <input
          id={`${id}-hex`}
          className="color-field__hex"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commitDraft}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commitDraft();
          }}
          spellCheck={false}
          autoComplete="off"
          inputMode="text"
          maxLength={7}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          aria-label={`${label}, valor hexadecimal`}
        />
        {error && (
          <span id={`${id}-error`} className="field__error" role="alert">
            {error}
          </span>
        )}
      </div>
    </div>
  );
}
