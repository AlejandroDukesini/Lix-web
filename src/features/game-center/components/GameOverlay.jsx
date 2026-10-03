import { useEffect, useId, useRef } from 'react';
import { DoorOpen, Play, RotateCcw } from 'lucide-react';
import { Button } from '../../../components/common/Button.jsx';
import { cx } from '../../../utils/cx.js';

/**
 * Panel superpuesto al escenario del juego (pausa, resultados, preparación).
 * Se distingue claramente del juego: superficie del estilo activo, fondo velado.
 * Al aparecer, el foco va al panel para que el teclado y los lectores de
 * pantalla lo encuentren de inmediato.
 */
export function GameOverlay({ eyebrow, title, children, actions, tone = 'neutral', className, scrim = true }) {
  const titleId = useId();
  const panel = useRef(null);
  const pressedInside = useRef(false);
  useEffect(() => {
    const target = panel.current?.querySelector('[data-autofocus]') ?? panel.current;
    target?.focus({ preventScroll: true });
  }, []);
  return (
    <div
      className={cx('game-overlay', scrim && 'has-scrim', `is-${tone}`, className)}
      data-no-gesture
      onPointerDownCapture={() => {
        pressedInside.current = true;
      }}
      // «Clic fantasma»: el toque que terminó la partida (sobre el juego, antes de que existiera
      // este panel) genera después un clic en el mismo punto, que caería en un botón del panel
      // («Siguiente nivel»). Un clic de puntero solo vale si la pulsación empezó dentro del panel.
      // Los clics de teclado (detail 0) no se ven afectados.
      onClickCapture={(event) => {
        if (event.detail > 0 && !pressedInside.current) {
          event.preventDefault();
          event.stopPropagation();
        }
        pressedInside.current = false;
      }}
    >
      <section ref={panel} className="game-overlay__panel" role="dialog" aria-labelledby={titleId} tabIndex={-1}>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2 id={titleId} className="game-overlay__title">
          {title}
        </h2>
        {children && <div className="game-overlay__body">{children}</div>}
        {actions && <div className="game-overlay__actions">{actions}</div>}
      </section>
    </div>
  );
}

/** Menú de pausa común. */
export function PauseMenu({ onResume, onRestart, onExit, children }) {
  return (
    <GameOverlay
      eyebrow="Partida en pausa"
      title="Pausa"
      actions={
        <>
          <Button icon={Play} onClick={onResume} data-autofocus>
            Continuar
          </Button>
          {onRestart && (
            <Button variant="secondary" icon={RotateCcw} onClick={onRestart}>
              Reiniciar
            </Button>
          )}
          <Button variant="ghost" icon={DoorOpen} onClick={onExit}>
            Salir al Game Center
          </Button>
        </>
      }
    >
      {children ?? <p>El juego está detenido. Nada avanza hasta que continúes.</p>}
    </GameOverlay>
  );
}
