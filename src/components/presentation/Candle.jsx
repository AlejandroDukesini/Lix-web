import { useId } from 'react';
import { cx } from '../../utils/cx.js';
import './candle.css';

/**
 * Vela ilustrada con CSS + SVG, sin imágenes ni audio.
 *
 * state:  'lit'  llama encendida con parpadeo orgánico
 *         'out'  secuencia de apagado: la llama se inclina, se encoge y
 *                desaparece; la mecha queda como brasa y sube el humo.
 * wind:   0–1, inclina la llama en tiempo real (soplido por micrófono).
 * size:   'xl' (ocular del viaje astral, escala con --candle-em) | 'lg' | 'md' | 'sm' (tarjetas).
 * monogram: letra grabada en oro sobre la cera, dentro de un medallón (sustituye al corazón).
 *
 * Es puramente decorativa (aria-hidden): las acciones viven en botones reales.
 */
export function Candle({ state = 'lit', wind = 0, size = 'lg', monogram, className }) {
  // Los ids de React pueden contener caracteres no válidos dentro de url(#...).
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const gradient = (name) => `${name}-${id}`;

  return (
    <div
      className={cx('candle', `candle--${size}`, `candle--${state}`, monogram && 'candle--monogram', className)}
      style={{ '--wind': wind }}
      aria-hidden="true"
    >
      <div className="candle__halo" />

      <div className="candle__flame-wrap">
        <svg className="candle__flame" viewBox="0 0 100 160">
          <defs>
            <radialGradient id={gradient('outer')} cx="50%" cy="78%" r="62%">
              <stop offset="0" className="stop-flame-hot" />
              <stop offset="0.55" className="stop-flame-mid" />
              <stop offset="1" className="stop-flame-edge" />
            </radialGradient>
            <radialGradient id={gradient('inner')} cx="50%" cy="80%" r="55%">
              <stop offset="0" className="stop-core" />
              <stop offset="0.7" className="stop-core-soft" />
              <stop offset="1" className="stop-core-fade" />
            </radialGradient>
          </defs>
          <path
            className="candle__flame-outer"
            d="M50 4C58 32 86 62 86 104c0 26-16 46-36 46S14 130 14 104C14 62 42 32 50 4z"
            fill={`url(#${gradient('outer')})`}
          />
          <path
            className="candle__flame-inner"
            d="M50 46c5 18 22 38 22 64 0 17-10 30-22 30s-22-13-22-30c0-26 17-46 22-64z"
            fill={`url(#${gradient('inner')})`}
          />
          <ellipse className="candle__flame-base" cx="50" cy="138" rx="12" ry="9" />
        </svg>
      </div>

      <div className="candle__wick">
        <span className="candle__ember" />
      </div>

      <svg className="candle__smoke" viewBox="0 0 80 200" fill="none">
        <path className="candle__smoke-trail candle__smoke-trail--1" pathLength="1" d="M40 196c-10-22 14-36 2-58s-18-38 4-62 8-46-4-70" />
        <path className="candle__smoke-trail candle__smoke-trail--2" pathLength="1" d="M42 196c12-20-10-38 4-58s16-34-2-60-4-40 10-70" />
        <path className="candle__smoke-trail candle__smoke-trail--3" pathLength="1" d="M38 196c-6-16 8-30-2-48s-14-30 4-50" />
      </svg>

      <div className="candle__body">
        <span className="candle__pool" />
        <span className="candle__drip candle__drip--1" />
        <span className="candle__drip candle__drip--2" />
        <span className="candle__drip candle__drip--3" />
        <span className="candle__texture" />
        {monogram ? (
          <span className="candle__monogram">
            <span className="candle__monogram-letter">{monogram}</span>
          </span>
        ) : (
          <svg className="candle__heart" viewBox="0 0 24 22">
            <path d="M12 21s-9-5.6-9-12A5 5 0 0 1 12 6a5 5 0 0 1 9 3c0 6.4-9 12-9 12z" />
          </svg>
        )}
        <span className="candle__sheen" />
      </div>
      <div className="candle__plate" />
    </div>
  );
}
