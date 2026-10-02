import { useId } from 'react';
import { cx } from '../../utils/cx.js';

/**
 * Campo de texto con etiqueta, ayuda, contador y error accesibles.
 * `onChange` recibe directamente el valor (no el evento).
 */
export function TextField({
  label,
  value,
  onChange,
  hint,
  error,
  maxLength,
  multiline = false,
  rows = 3,
  className,
  inputClassName,
  hideLabel = false,
  ...rest
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const Control = multiline ? 'textarea' : 'input';
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined;
  const length = typeof value === 'string' ? value.length : 0;

  return (
    <div className={cx('field', error && 'field--invalid', className)}>
      <div className="field__top">
        <label htmlFor={id} className={cx('field__label', hideLabel && 'sr-only')}>
          {label}
        </label>
        {maxLength && (
          <span className={cx('field__counter', length > maxLength && 'field__counter--over')} aria-hidden="true">
            {length}/{maxLength}
          </span>
        )}
      </div>
      <Control
        id={id}
        className={cx('field__control', inputClassName)}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy}
        rows={multiline ? rows : undefined}
        {...rest}
      />
      {hint && (
        <p id={hintId} className="field__hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="field__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
