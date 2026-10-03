import { useEffect, useLayoutEffect, useRef } from 'react';

/** Traduce teclas físicas a acciones de juego comunes. */
const KEY_ACTIONS = {
  ArrowLeft: 'left',
  a: 'left',
  A: 'left',
  ArrowRight: 'right',
  d: 'right',
  D: 'right',
  ArrowUp: 'up',
  w: 'up',
  W: 'up',
  ArrowDown: 'down',
  s: 'down',
  S: 'down',
  ' ': 'action',
  Enter: 'confirm',
  Escape: 'pause',
  p: 'pause',
  P: 'pause',
};

export function keyToAction(key) {
  return KEY_ACTIONS[key] ?? null;
}

const isTyping = (target) =>
  target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

/**
 * Teclado del juego. Devuelve un ref con el conjunto de acciones pulsadas
 * (para controles continuos) y llama a `onAction(action, event)` en cada
 * pulsación nueva (para acciones discretas).
 *
 * Los listeners se añaden solo mientras `active` es true y se retiran al salir.
 * Flechas y espacio no desplazan la página durante la partida; si el foco está
 * en un campo de texto, el juego no intercepta nada.
 */
export function useKeyboard({ active = true, onAction } = {}) {
  const pressed = useRef(new Set());
  const handler = useRef(onAction);
  useLayoutEffect(() => {
    handler.current = onAction;
  });

  useEffect(() => {
    const keys = pressed.current;
    if (!active) {
      keys.clear();
      return undefined;
    }
    const down = (event) => {
      if (isTyping(event.target) || event.ctrlKey || event.metaKey || event.altKey) return;
      const action = keyToAction(event.key);
      if (!action) return;
      // Espacio/Enter sobre un botón enfocado deben seguir pulsando ese botón.
      const onButton = event.target instanceof HTMLElement && event.target.closest('button, a, [role="button"]');
      if ((action === 'action' || action === 'confirm') && onButton) return;
      if (['left', 'right', 'up', 'down', 'action'].includes(action)) event.preventDefault();
      if (!event.repeat) handler.current?.(action, event);
      keys.add(action);
    };
    const up = (event) => {
      const action = keyToAction(event.key);
      if (action) keys.delete(action);
    };
    const clear = () => keys.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clear);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear);
      keys.clear();
    };
  }, [active]);

  return pressed;
}
