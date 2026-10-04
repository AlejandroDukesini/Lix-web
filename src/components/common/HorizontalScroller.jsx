import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cx } from '../../utils/cx.js';

const DRAG_THRESHOLD = 6;

/**
 * Lista horizontal desplazable dentro de su propio contenedor (chips, pestañas…).
 *  - Táctil: swipe nativo; `overscroll-behavior-x: contain` evita arrastrar la página.
 *  - Ratón: se puede arrastrar; si hubo arrastre, el clic final no selecciona nada.
 *  - Flechas laterales cuando hay contenido oculto (solo con puntero fino), y un
 *    degradado en el borde que sugiere que la lista continúa.
 *  - `scrollToItem(el)` centra un elemento moviendo solo la lista, nunca la página.
 */
export const HorizontalScroller = forwardRef(function HorizontalScroller(
  { as: Tag = 'div', className, trackClassName, label, children, ...rest },
  ref,
) {
  const trackRef = useRef(null);
  const drag = useRef(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  const measure = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const start = el.scrollLeft <= 2;
    const end = el.scrollLeft >= max - 2;
    setEdges((current) => (current.start === start && current.end === end ? current : { start, end }));
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return undefined;
    measure();
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(onScroll) : null;
    observer?.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener('scroll', onScroll);
      observer?.disconnect();
    };
  }, [measure]);

  const scrollToItem = useCallback((item, behavior = 'smooth') => {
    const el = trackRef.current;
    if (!el || !item) return;
    const left = item.offsetLeft - (el.clientWidth - item.offsetWidth) / 2;
    const reduced = document.documentElement.dataset.motion === 'reduced';
    if (typeof el.scrollTo === 'function') el.scrollTo({ left: Math.max(0, left), behavior: reduced ? 'auto' : behavior });
    else el.scrollLeft = Math.max(0, left);
  }, []);

  useImperativeHandle(ref, () => ({ scrollToItem, element: trackRef.current }), [scrollToItem]);

  const page = (direction) => {
    const el = trackRef.current;
    if (!el) return;
    const reduced = document.documentElement.dataset.motion === 'reduced';
    const delta = direction * el.clientWidth * 0.7;
    if (typeof el.scrollBy === 'function') el.scrollBy({ left: delta, behavior: reduced ? 'auto' : 'smooth' });
    else el.scrollLeft += delta;
  };

  // Arrastre con ratón (el táctil ya desplaza de forma nativa).
  const onPointerDown = (event) => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    drag.current = { x: event.clientX, left: trackRef.current.scrollLeft, moved: false, id: event.pointerId };
  };
  const onPointerMove = (event) => {
    const state = drag.current;
    if (!state || state.id !== event.pointerId) return;
    const dx = event.clientX - state.x;
    if (!state.moved && Math.abs(dx) < DRAG_THRESHOLD) return;
    if (!state.moved) {
      state.moved = true;
      trackRef.current.setPointerCapture?.(event.pointerId);
      trackRef.current.dataset.dragging = 'true';
    }
    trackRef.current.scrollLeft = state.left - dx;
  };
  const endDrag = (event) => {
    const state = drag.current;
    if (!state || state.id !== event.pointerId) return;
    if (state.moved) {
      // Se descarta el clic que el navegador emite al soltar tras un arrastre.
      const swallow = (clickEvent) => {
        clickEvent.stopPropagation();
        clickEvent.preventDefault();
      };
      trackRef.current.addEventListener('click', swallow, { capture: true, once: true });
      setTimeout(() => trackRef.current?.removeEventListener('click', swallow, { capture: true }), 0);
    }
    delete trackRef.current.dataset.dragging;
    drag.current = null;
  };

  return (
    <div className={cx('hscroll', !edges.start && 'has-before', !edges.end && 'has-after', className)}>
      <button type="button" className="hscroll__arrow hscroll__arrow--prev" onClick={() => page(-1)} tabIndex={-1} aria-hidden="true" hidden={edges.start}>
        <ChevronLeft />
      </button>
      <Tag
        ref={trackRef}
        className={cx('hscroll__track', trackClassName)}
        aria-label={label}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        {...rest}
      >
        {children}
      </Tag>
      <button type="button" className="hscroll__arrow hscroll__arrow--next" onClick={() => page(1)} tabIndex={-1} aria-hidden="true" hidden={edges.end}>
        <ChevronRight />
      </button>
    </div>
  );
});
