import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Hand, MoveHorizontal, RotateCcw, Smartphone } from 'lucide-react';
import { HoldButton } from '../../../components/TouchControls.jsx';
import { Button } from '../../../../../components/common/Button.jsx';
import { cx } from '../../../../../utils/cx.js';

/**
 * Controles de la moto y su configuración (exclusivos de Traffic Rider).
 *
 * Métodos (se guardan en `record.settings.control`):
 *  - 'buttons': manillar ‹ › a la izquierda; freno y acelerador a la derecha.
 *  - 'swipe':   arrastrar el dedo a izquierda/derecha sobre la carretera gira de
 *               forma proporcional; freno y acelerador siguen a la derecha.
 *  - 'tilt':    inclinar el dispositivo gira; freno y acelerador a la derecha.
 *               Pide permiso cuando el sistema lo exige (iOS) y solo se ofrece
 *               si llegan lecturas reales del sensor.
 */
export const CONTROL_METHODS = Object.freeze([
  { id: 'buttons', label: 'Botones', description: 'Manillar ‹ › y pedales en pantalla.', icon: Hand },
  { id: 'swipe', label: 'Deslizar', description: 'Arrastra el dedo sobre la carretera para girar.', icon: MoveHorizontal },
  { id: 'tilt', label: 'Inclinación', description: 'Inclina el teléfono como un manillar.', icon: Smartphone },
]);
export const DEFAULT_CONTROL = 'buttons';
export const controlMethod = (record) =>
  CONTROL_METHODS.some((m) => m.id === record?.settings?.control) ? record.settings.control : DEFAULT_CONTROL;

const TILT_RANGE = 24; // grados de inclinación para el giro máximo
const TILT_DEADZONE = 3;

/** Lectura de inclinación lateral según la orientación de la pantalla. */
function lateralTilt(event) {
  const angle = window.screen?.orientation?.angle ?? window.orientation ?? 0;
  if (angle === 90) return event.beta;
  if (angle === -90 || angle === 270) return -event.beta;
  return event.gamma;
}

export function tiltToSteer(degrees) {
  if (!Number.isFinite(degrees) || Math.abs(degrees) < TILT_DEADZONE) return 0;
  return Math.max(-1, Math.min(1, (degrees - Math.sign(degrees) * TILT_DEADZONE) / (TILT_RANGE - TILT_DEADZONE)));
}

/** Pide permiso (si hace falta) y comprueba que el sensor envía datos. Resuelve true/false. */
export async function enableTilt(timeout = 1200) {
  if (typeof window === 'undefined' || typeof window.DeviceOrientationEvent === 'undefined') return false;
  try {
    if (typeof window.DeviceOrientationEvent.requestPermission === 'function') {
      const answer = await window.DeviceOrientationEvent.requestPermission();
      if (answer !== 'granted') return false;
    }
  } catch {
    return false;
  }
  return new Promise((resolve) => {
    const onReading = (event) => {
      if (event.gamma === null && event.beta === null) return;
      cleanup();
      resolve(true);
    };
    const timer = setTimeout(() => {
      cleanup();
      resolve(false);
    }, timeout);
    const cleanup = () => {
      clearTimeout(timer);
      window.removeEventListener('deviceorientation', onReading);
    };
    window.addEventListener('deviceorientation', onReading);
  });
}

/** Escribe en `steerRef` (−1…1) la inclinación lateral, tomando como neutra la primera lectura. */
export function useTiltSteer(steerRef, enabled) {
  useEffect(() => {
    if (!enabled) return undefined;
    let neutral = null;
    const onOrientation = (event) => {
      const value = lateralTilt(event);
      if (!Number.isFinite(value)) return;
      neutral ??= Math.max(-15, Math.min(15, value));
      steerRef.current = tiltToSteer(value - neutral);
    };
    window.addEventListener('deviceorientation', onOrientation);
    return () => {
      window.removeEventListener('deviceorientation', onOrientation);
      steerRef.current = 0;
    };
  }, [enabled, steerRef]);
}

/**
 * Manillar y pedales. `inputRef.current.{left,right,up,down}`; con 'swipe' o
 * 'tilt' el manillar se sustituye por una indicación del método activo.
 * `steer` (−1…1) solo sirve para inclinar el dibujo del manillar.
 */
export function RiderControls({ inputRef, method, side = false, steer = 0 }) {
  const [state, setState] = useState({ left: false, right: false, up: false, down: false });
  const set = (key) => (value) => {
    inputRef.current = { ...inputRef.current, [key]: value };
    setState((current) => ({ ...current, [key]: value }));
  };
  const turn = state.right ? 1 : state.left ? -1 : steer;
  return (
    <div className={cx('rider-pad', side && 'is-side')} data-no-gesture>
      {method === 'buttons' ? (
        <div className="rider-bar" role="group" aria-label="Manillar" style={{ '--turn': turn }}>
          <HoldButton label="Girar a la izquierda" icon={ChevronLeft} onChange={set('left')} className="rider-grip rider-grip--left" />
          <span className="rider-bar__stem" aria-hidden="true" />
          <HoldButton label="Girar a la derecha" icon={ChevronRight} onChange={set('right')} className="rider-grip rider-grip--right" />
        </div>
      ) : (
        <p className="rider-pad__method" aria-hidden="true" style={{ '--turn': turn }}>
          {method === 'tilt' ? <Smartphone /> : <MoveHorizontal />}
          {method === 'tilt' ? 'Inclina para girar' : 'Desliza para girar'}
        </p>
      )}
      <div className="rider-pedals" role="group" aria-label="Freno y acelerador">
        <span className="rider-pedal">
          <HoldButton label="Frenar" icon={BrakeIcon} onChange={set('down')} className="rider-btn rider-btn--brake" />
          <span className={cx('rider-pedal__label', state.down && 'is-on')} aria-hidden="true">
            Freno
          </span>
        </span>
        <span className="rider-pedal">
          <HoldButton label="Acelerar" icon={ThrottleIcon} onChange={set('up')} className="rider-btn rider-btn--gas" />
          <span className={cx('rider-pedal__label', state.up && 'is-on')} aria-hidden="true">
            Gas
          </span>
        </span>
      </div>
    </div>
  );
}

/** Maneta de freno. */
function BrakeIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...props}>
      <path d="M5 7h9a3 3 0 0 1 3 3v0" />
      <path d="M6 7l11 10" />
      <circle cx="5" cy="7" r="1.6" fill="currentColor" />
    </svg>
  );
}

/** Puño del acelerador con la flecha de giro. */
function ThrottleIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="4" y="9" width="12" height="6" rx="3" />
      <path d="M16 12h4" />
      <path d="M8 5.5a7 7 0 0 1 8 0" />
      <path d="M15 3.8l1 1.7-1.9.4" />
    </svg>
  );
}

/** Leyenda permanente de teclado (escritorio). */
export function KeyLegend() {
  return (
    <p className="rider-keys" aria-hidden="true">
      <span><kbd>↑</kbd> Gas</span>
      <span><kbd>↓</kbd> Freno</span>
      <span><kbd>←</kbd><kbd>→</kbd> Dirección</span>
    </p>
  );
}

/** Selector del método de control (pantalla de modos y menú de pausa). */
export function ControlSettings({ value, onChange }) {
  const [checking, setChecking] = useState(false);
  const [tiltError, setTiltError] = useState(null);
  const mounted = useRef(true);
  useEffect(() => () => (mounted.current = false), []);

  const pick = async (id) => {
    setTiltError(null);
    if (id !== 'tilt') {
      onChange(id);
      return;
    }
    setChecking(true);
    const ok = await enableTilt();
    if (!mounted.current) return;
    setChecking(false);
    if (ok) onChange('tilt');
    else setTiltError('Este dispositivo no envía la inclinación (o no se dio permiso). Puedes usar botones o deslizar.');
  };

  return (
    <div className="rider-settings">
      <div className="rider-settings__options" role="radiogroup" aria-label="Método de control">
        {CONTROL_METHODS.map(({ id, label, description, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={value === id}
            className={cx('rider-option', value === id && 'is-active')}
            onClick={() => pick(id)}
            disabled={checking}
          >
            <Icon aria-hidden="true" />
            <span>
              <strong>
                {label}
                {value === id && <em> · activo</em>}
              </strong>
              <small>{id === 'tilt' && checking ? 'Comprobando el sensor…' : description}</small>
            </span>
          </button>
        ))}
      </div>
      {tiltError && (
        <p className="rider-settings__error" role="alert">
          {tiltError}
        </p>
      )}
      <p className="rider-settings__note">En el ordenador se conduce siempre con el teclado: ↑ gas, ↓ freno, ← → dirección.</p>
      {value !== DEFAULT_CONTROL && (
        <Button variant="ghost" size="sm" icon={RotateCcw} onClick={() => pick(DEFAULT_CONTROL)}>
          Volver a botones
        </Button>
      )}
    </div>
  );
}
