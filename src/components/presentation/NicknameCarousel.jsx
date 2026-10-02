import { useEffect, useState } from 'react';
import { useReducedMotion } from '../../hooks/useReducedMotion.js';
import { cx } from '../../utils/cx.js';
import './nickname.css';

/*
 * Ritmo pensado para leerse con calma:
 *   entrada  ≈ 1.1 s + 80 ms por letra (las letras aparecen de una en una, desde el desenfoque)
 *   lectura  3.2 s con el apodo completamente nítido y su trazo dibujado debajo
 *   salida   1.1 s (se desvanece suavemente hacia arriba)
 */
const LETTER_MS = 80;
const ENTER_MS = 1100;
const HOLD_MS = 3200;
const EXIT_MS = 1100;
const REDUCED = { enter: 400, hold: 4200, exit: 600 };

/**
 * Muestra los apodos uno tras otro con una animación lenta y romántica.
 * El texto animado es decorativo; los lectores de pantalla oyen solo el primer
 * apodo, sin anuncios repetitivos. Se pausa al pasar el puntero por encima.
 */
export function NicknameCarousel({ nicknames, rotate = true, className }) {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState('in');
  const [paused, setPaused] = useState(false);

  const count = nicknames.length;
  const current = nicknames[index % count] ?? '';
  const animating = rotate && count > 1;

  useEffect(() => {
    if (!animating || paused) return undefined;
    const enter = reduced ? REDUCED.enter : ENTER_MS + current.length * LETTER_MS;
    const hold = reduced ? REDUCED.hold : HOLD_MS;
    const exit = reduced ? REDUCED.exit : EXIT_MS;

    const timer =
      phase === 'in'
        ? setTimeout(() => setPhase('out'), enter + hold)
        : setTimeout(() => {
            setIndex((i) => (i + 1) % count);
            setPhase('in');
          }, exit);
    return () => clearTimeout(timer);
  }, [animating, paused, phase, reduced, count, current.length]);

  // Si se edita la lista y el índice queda fuera de rango, vuelve al primero.
  useEffect(() => {
    if (index >= count) setIndex(0);
  }, [index, count]);

  const word = animating ? current : nicknames[0];

  return (
    <span
      className={cx('nickname', `is-${animating ? phase : 'in'}`, reduced && 'is-reduced', className)}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
    >
      <span className="sr-only">{nicknames[0]}</span>
      <span className="nickname__stage" aria-hidden="true">
        <span className="nickname__word" key={`${index}-${word}`}>
          {[...word].map((char, i) => (
            <span className="nickname__char" style={{ '--i': i }} key={i}>
              {char === ' ' ? ' ' : char}
            </span>
          ))}
          <svg className="nickname__flourish" viewBox="0 0 220 24" preserveAspectRatio="none">
            <path pathLength="1" d="M4 16C46 6 88 20 128 12s70-8 88 0" />
          </svg>
          <svg className="nickname__sparkle" viewBox="0 0 24 24">
            <path d="M12 0c1 7 5 11 12 12-7 1-11 5-12 12-1-7-5-11-12-12 7-1 11-5 12-12z" />
          </svg>
        </span>
      </span>
    </span>
  );
}
