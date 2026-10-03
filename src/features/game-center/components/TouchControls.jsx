import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from 'lucide-react';
import { cx } from '../../../utils/cx.js';

/**
 * Controles táctiles. Usan Pointer Events (ratón, dedo y lápiz por igual) y
 * solo bloquean los gestos del navegador sobre sí mismos (`touch-action: none`
 * en su CSS), nunca en toda la página.
 */

/** Botón que se mantiene pulsado (girar mientras el dedo está encima). */
export function HoldButton({ label, icon: Icon, onChange, className }) {
  const [pressed, setPressed] = useState(false);
  const set = (value) => {
    setPressed(value);
    onChange(value);
  };
  return (
    <button
      type="button"
      className={cx('hold-btn', pressed && 'is-pressed', className)}
      aria-label={label}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture?.(event.pointerId);
        set(true);
      }}
      onPointerUp={() => set(false)}
      onPointerCancel={() => set(false)}
      onLostPointerCapture={() => set(false)}
      onContextMenu={(event) => event.preventDefault()}
      // Teclado: Espacio/Enter también funcionan (accesibilidad).
      onKeyDown={(event) => (event.key === ' ' || event.key === 'Enter') && set(true)}
      onKeyUp={(event) => (event.key === ' ' || event.key === 'Enter') && set(false)}
    >
      <Icon aria-hidden="true" />
    </button>
  );
}

/** Par de botones izquierda/derecha que escribe en `inputRef.current.{left,right}`. */
export function SteerButtons({ inputRef, className }) {
  return (
    <div className={cx('steer-buttons', className)} data-no-gesture>
      <HoldButton label="Girar a la izquierda" icon={ArrowLeft} onChange={(v) => (inputRef.current.left = v)} />
      <HoldButton label="Girar a la derecha" icon={ArrowRight} onChange={(v) => (inputRef.current.right = v)} />
    </div>
  );
}

/**
 * Controles de conducción (Aparcar el carro, Traffic Rider): volante ‹ › a la
 * izquierda y pedales a la derecha, todos mantenidos (respuesta continua). Escribe
 * en `inputRef.current.{left, right, up, down}`. Cada botón se suelta solo si el
 * dedo se va, se cancela el gesto o se pierde la captura: nada queda pulsado.
 * `side`: en móvil horizontal, volante y pedales en columnas a los lados.
 */
export function DriveControls({ inputRef, brakeLabel = 'Frenar', side = false }) {
  const set = (key) => (value) => {
    inputRef.current = { ...inputRef.current, [key]: value };
  };
  return (
    <div className={cx('drive-pad', side && 'is-side')} data-no-gesture>
      <div className="drive-pad__group" role="group" aria-label="Dirección">
        <HoldButton label="Girar a la izquierda" icon={ArrowLeft} onChange={set('left')} className="drive-btn" />
        <HoldButton label="Girar a la derecha" icon={ArrowRight} onChange={set('right')} className="drive-btn" />
      </div>
      <div className="drive-pad__group drive-pad__group--pedals" role="group" aria-label="Pedales">
        <HoldButton label={brakeLabel} icon={ArrowDown} onChange={set('down')} className="drive-btn drive-btn--brake" />
        <HoldButton label="Acelerar" icon={ArrowUp} onChange={set('up')} className="drive-btn drive-btn--gas" />
      </div>
    </div>
  );
}

/**
 * Controles de plataformas: a la izquierda, una almohadilla de movimiento en la
 * que el pulgar puede deslizarse de ‹ a › sin levantarse; a la derecha, el botón
 * de salto (mantenerlo salta más alto). Son dos zonas independientes, así que se
 * puede correr y saltar a la vez con dos dedos. Escribe en
 * `inputRef.current.{left, right, jump}`; todo se suelta al levantar, cancelar o
 * perder el dedo.
 */
export function PlatformControls({ inputRef }) {
  const pad = useRef(null);
  const pointer = useRef(null);
  const [dir, setDir] = useState(0);
  const write = (d) => {
    inputRef.current = { ...inputRef.current, left: d < 0, right: d > 0 };
    setDir(d);
  };
  const follow = (event) => {
    const rect = pad.current.getBoundingClientRect();
    write(event.clientX < rect.left + rect.width / 2 ? -1 : 1);
  };
  const release = (event) => {
    if (pointer.current !== event.pointerId) return;
    pointer.current = null;
    write(0);
  };
  return (
    <div className="platform-pad" data-no-gesture>
      <div
        ref={pad}
        className="move-pad"
        role="group"
        aria-label="Moverse: izquierda y derecha"
        onPointerDown={(event) => {
          if (pointer.current !== null) return;
          pointer.current = event.pointerId;
          event.currentTarget.setPointerCapture?.(event.pointerId);
          follow(event);
        }}
        onPointerMove={(event) => pointer.current === event.pointerId && follow(event)}
        onPointerUp={release}
        onPointerCancel={release}
        onLostPointerCapture={release}
        onContextMenu={(event) => event.preventDefault()}
      >
        <span className={cx('move-pad__side', dir < 0 && 'is-pressed')} aria-hidden="true">
          <ArrowLeft />
        </span>
        <span className={cx('move-pad__side', dir > 0 && 'is-pressed')} aria-hidden="true">
          <ArrowRight />
        </span>
      </div>
      <HoldButton label="Saltar" icon={ArrowUp} onChange={(v) => (inputRef.current = { ...inputRef.current, jump: v })} className="jump-btn" />
    </div>
  );
}

/** Cruceta de cuatro direcciones. */
export function DPad({ onDirection, className }) {
  const button = (direction, Icon, label) => (
    <button
      type="button"
      className={`dpad__btn dpad__btn--${direction}`}
      aria-label={label}
      onPointerDown={(event) => {
        event.preventDefault();
        onDirection(direction);
      }}
      onKeyDown={(event) => (event.key === ' ' || event.key === 'Enter') && onDirection(direction)}
    >
      <Icon aria-hidden="true" />
    </button>
  );
  return (
    <div className={cx('dpad', className)} role="group" aria-label="Dirección" data-no-gesture>
      {button('up', ArrowUp, 'Arriba')}
      {button('left', ArrowLeft, 'Izquierda')}
      {button('right', ArrowRight, 'Derecha')}
      {button('down', ArrowDown, 'Abajo')}
    </div>
  );
}

/**
 * Joystick virtual: al tocar el escenario aparece donde pusiste el dedo y
 * escribe en `vectorRef.current` un vector de longitud ≤ 1.
 * Con ratón no se activa (el ratón tiene su propio control).
 */
export function Joystick({ vectorRef, radius = 56, disabled = false }) {
  const [stick, setStick] = useState(null);
  const origin = useRef(null);

  const release = () => {
    origin.current = null;
    vectorRef.current = { x: 0, y: 0 };
    setStick(null);
  };

  // En pausa o al terminar, el joystick se suelta solo.
  useEffect(() => {
    if (!disabled) return;
    origin.current = null;
    vectorRef.current = { x: 0, y: 0 };
    setStick(null);
  }, [disabled, vectorRef]);

  return (
    <div
      className="joystick-zone"
      onPointerDown={(event) => {
        if (disabled || event.pointerType === 'mouse') return;
        event.currentTarget.setPointerCapture?.(event.pointerId);
        const rect = event.currentTarget.getBoundingClientRect();
        origin.current = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top };
        setStick({ x: event.clientX - rect.left, y: event.clientY - rect.top, dx: 0, dy: 0 });
      }}
      onPointerMove={(event) => {
        if (!origin.current) return;
        let dx = event.clientX - origin.current.x;
        let dy = event.clientY - origin.current.y;
        const length = Math.hypot(dx, dy);
        if (length > radius) {
          dx = (dx / length) * radius;
          dy = (dy / length) * radius;
        }
        vectorRef.current = { x: dx / radius, y: dy / radius };
        setStick((s) => s && { ...s, dx, dy });
      }}
      onPointerUp={release}
      onPointerCancel={release}
    >
      {stick && (
        <span className="joystick" style={{ left: stick.x, top: stick.y, '--r': `${radius}px` }} aria-hidden="true">
          <span className="joystick__knob" style={{ transform: `translate(${stick.dx}px, ${stick.dy}px)` }} />
        </span>
      )}
    </div>
  );
}

/**
 * Dirección analógica por arrastre horizontal (Aquapark, Tunnel Runner).
 *
 * Al apoyar el dedo se fija un origen; desplazarlo a izquierda o derecha gira
 * de forma proporcional (`range` px = giro máximo). Por debajo de `deadZone` px
 * no se gira: un toque accidental no mueve nada. Al levantar el dedo, el giro
 * vuelve a cero. Solo escucha Pointer Events (dedo, ratón y lápiz por igual),
 * así que nunca se procesa la misma acción por dos tipos de evento, y los
 * toques que empiezan sobre un botón (pausa, botones táctiles) se ignoran.
 *
 * Devuelve `steerRef` (−1…1), los manejadores para el escenario y el estado del
 * indicador visual.
 */
export function steerFromDrag(dx, { deadZone = 10, range = 70 } = {}) {
  if (Math.abs(dx) < deadZone) return 0;
  const sign = Math.sign(dx);
  return sign * Math.min(1, (Math.abs(dx) - deadZone) / (range - deadZone));
}

export function useDragSteer({ enabled = true, deadZone = 10, range = 70 } = {}) {
  const steerRef = useRef(0);
  const drag = useRef(null);
  const [indicator, setIndicator] = useState(null);

  const release = () => {
    drag.current = null;
    steerRef.current = 0;
    setIndicator(null);
  };

  useEffect(() => {
    if (!enabled) {
      drag.current = null;
      steerRef.current = 0;
      setIndicator(null);
    }
  }, [enabled]);

  const handlers = {
    onPointerDown: (event) => {
      if (!enabled || drag.current || event.target.closest?.('button, a, [data-no-gesture]')) return;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      const rect = event.currentTarget.getBoundingClientRect();
      drag.current = { id: event.pointerId, x: event.clientX };
      setIndicator({ x: event.clientX - rect.left, y: event.clientY - rect.top, offset: 0 });
    },
    onPointerMove: (event) => {
      const d = drag.current;
      if (!d || d.id !== event.pointerId) return;
      const dx = event.clientX - d.x;
      steerRef.current = steerFromDrag(dx, { deadZone, range });
      const offset = Math.max(-range, Math.min(range, dx)) * (60 / range);
      setIndicator((current) => current && { ...current, offset });
    },
    onPointerUp: (event) => drag.current?.id === event.pointerId && release(),
    onPointerCancel: (event) => drag.current?.id === event.pointerId && release(),
  };

  return { steerRef, handlers, indicator };
}

/** Indicador del arrastre: una guía horizontal con el punto que sigue al dedo. */
export function DragIndicator({ indicator }) {
  if (!indicator) return null;
  return <span className="drag-steer" style={{ left: indicator.x, top: indicator.y, '--offset': `${indicator.offset}px` }} aria-hidden="true" />;
}

/*
 * Tipo del último puntero que usó la persona. `(pointer: coarse)` describe el
 * dispositivo principal, no lo que se está usando: en un portátil táctil o una
 * tableta con ratón acierta solo a medias. Se usa el último `pointerdown` real
 * (el toque en «Jugar» o en el circuito) y la media query solo si aún no hubo ninguno.
 */
let lastPointerType = null;
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', (event) => (lastPointerType = event.pointerType), { capture: true, passive: true });
}

export function usesTouch() {
  if (lastPointerType) return lastPointerType !== 'mouse';
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(pointer: coarse)').matches);
}

/** Pista de controles que se muestra unos segundos al empezar (también hay ayuda en «?»). */
export function ControlsHint({ touch, desktop, icon: Icon, duration = 4500 }) {
  const [visible, setVisible] = useState(true);
  const [coarse] = useState(usesTouch);
  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), duration);
    return () => clearTimeout(timer);
  }, [duration]);
  if (!visible) return null;
  return (
    <p className="controls-hint" role="status">
      {Icon && <Icon aria-hidden="true" />}
      {coarse ? touch : desktop}
    </p>
  );
}

/**
 * Detecta deslizamientos sobre un elemento y llama a `onSwipe('up'|'down'|'left'|'right')`.
 * Con `onTap`, un toque corto sin desplazamiento también es una acción (p. ej. avanzar).
 * Devuelve los manejadores para extenderlos sobre el elemento.
 */
export function useSwipe(onSwipe, { threshold = 24, onTap } = {}) {
  const start = useRef(null);
  const handler = useRef(onSwipe);
  const tapHandler = useRef(onTap);
  useLayoutEffect(() => {
    handler.current = onSwipe;
    tapHandler.current = onTap;
  });
  const suppressClickUntil = useRef(0);
  return {
    onPointerDown: (event) => {
      if (event.pointerType === 'mouse' || event.target.closest?.('[data-no-gesture]')) return;
      start.current = {
        x: event.clientX,
        y: event.clientY,
        fired: false,
        at: performance.now(),
        // Tocar un botón o enlace es pulsarlo, nunca además un «toque» del juego.
        onControl: Boolean(event.target.closest?.('button, a, input, select, textarea')),
      };
    },
    // Un deslizamiento que empezó sobre una celda no debe convertirse además en un toque.
    onClickCapture: (event) => {
      if (performance.now() < suppressClickUntil.current) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    onPointerMove: (event) => {
      const s = start.current;
      if (!s || s.fired) return;
      const dx = event.clientX - s.x;
      const dy = event.clientY - s.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return;
      s.fired = true;
      suppressClickUntil.current = performance.now() + 400;
      handler.current(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
    },
    onPointerUp: (event) => {
      const s = start.current;
      start.current = null;
      // Toque: no se deslizó, fue breve y apenas se movió (un deslizamiento nunca es además un toque).
      if (s && !s.fired && !s.onControl && tapHandler.current && performance.now() - s.at < 350) {
        if (Math.hypot(event.clientX - s.x, event.clientY - s.y) < threshold / 2) tapHandler.current();
      }
    },
    onPointerCancel: () => {
      start.current = null;
    },
  };
}
