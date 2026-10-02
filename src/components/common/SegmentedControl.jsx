import { useId } from 'react';
import { cx } from '../../utils/cx.js';

/**
 * Selector de una opción entre varias, construido con radios nativos: las
 * flechas del teclado, el anuncio "1 de 2" y el foco funcionan sin JavaScript extra.
 * options: [{ value, label, description?, icon? }]
 */
export function SegmentedControl({ label, options, value, onChange, name, layout = 'inline', hideLabel = false }) {
  const generated = useId();
  const groupName = name ?? generated;
  const labelId = `${generated}-label`;

  return (
    <div className={cx('segmented', `segmented--${layout}`)}>
      <span id={labelId} className={cx('segmented__label', hideLabel && 'sr-only')}>
        {label}
      </span>
      <div role="radiogroup" aria-labelledby={labelId} className="segmented__options">
        {options.map((option) => {
          const Icon = option.icon;
          const checked = option.value === value;
          return (
            <label key={String(option.value)} className={cx('segmented__option', checked && 'is-checked')}>
              <input
                type="radio"
                className="sr-only"
                name={groupName}
                value={String(option.value)}
                checked={checked}
                onChange={() => onChange(option.value)}
              />
              {option.preview}
              <span className="segmented__content">
                {Icon && <Icon className="segmented__icon" aria-hidden="true" />}
                <span className="segmented__text">
                  <span className="segmented__title">{option.label}</span>
                  {option.description && <span className="segmented__description">{option.description}</span>}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
