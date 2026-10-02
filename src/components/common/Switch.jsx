import { useId } from 'react';

/** Interruptor accesible (role="switch") con etiqueta y descripción opcional. */
export function Switch({ label, description, checked, onChange }) {
  const id = useId();
  return (
    <div className="switch-row">
      <div className="switch-row__text">
        <span id={`${id}-label`} className="switch-row__label">
          {label}
        </span>
        {description && (
          <span id={`${id}-desc`} className="switch-row__description">
            {description}
          </span>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={description ? `${id}-desc` : undefined}
        className="switch"
        onClick={() => onChange(!checked)}
      >
        <span className="switch__thumb" aria-hidden="true" />
      </button>
    </div>
  );
}
