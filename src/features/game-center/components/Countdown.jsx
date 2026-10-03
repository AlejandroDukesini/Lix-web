import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * Cuenta atrás 3-2-1 antes de empezar. Se detiene si `paused`.
 * Los temporizadores se cancelan al desmontar.
 */
export function Countdown({ from = 3, paused = false, onTick, onDone }) {
  const [value, setValue] = useState(from);
  const callbacks = useRef({ onTick, onDone });
  useLayoutEffect(() => {
    callbacks.current = { onTick, onDone };
  });

  useEffect(() => {
    if (paused) return undefined;
    if (value <= 0) {
      callbacks.current.onDone?.();
      return undefined;
    }
    callbacks.current.onTick?.(value);
    const timer = setTimeout(() => setValue((v) => v - 1), 700);
    return () => clearTimeout(timer);
  }, [value, paused]);

  if (value <= 0) return null;
  return (
    <div className="game-countdown" aria-live="assertive">
      <span key={value} className="game-countdown__value">
        {value}
      </span>
    </div>
  );
}
