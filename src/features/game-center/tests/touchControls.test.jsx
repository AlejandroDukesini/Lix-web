import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ControlsHint, PlatformControls, steerFromDrag, useDragSteer, useSwipe } from '../components/TouchControls.jsx';

describe('arrastre para girar', () => {
  it('ignora movimientos pequeños (toques accidentales) y es proporcional después', () => {
    expect(steerFromDrag(6)).toBe(0);
    expect(steerFromDrag(-9)).toBe(0);
    expect(steerFromDrag(40)).toBeGreaterThan(0);
    expect(steerFromDrag(40)).toBeLessThan(1);
    expect(steerFromDrag(-200)).toBe(-1);
    expect(steerFromDrag(70)).toBe(1);
  });

  function Stage() {
    const drag = useDragSteer();
    return (
      <div data-testid="stage" {...drag.handlers}>
        <button type="button">Pausa</button>
        <output data-testid="steer">{drag.indicator ? 'arrastrando' : 'quieto'}</output>
        <StageValue steerRef={drag.steerRef} />
      </div>
    );
  }
  // Expone el valor del ref (se lee en el bucle del juego, no se renderiza).
  let readSteer = () => 0;
  function StageValue({ steerRef }) {
    readSteer = () => steerRef.current;
    return null;
  }

  it('gira mientras se arrastra y vuelve a cero al soltar', () => {
    render(<Stage />);
    const stage = screen.getByTestId('stage');
    fireEvent.pointerDown(stage, { pointerId: 1, clientX: 100, clientY: 100 });
    expect(screen.getByTestId('steer')).toHaveTextContent('arrastrando');
    fireEvent.pointerMove(stage, { pointerId: 1, clientX: 160, clientY: 100 });
    expect(readSteer()).toBeGreaterThan(0.7);
    fireEvent.pointerMove(stage, { pointerId: 1, clientX: 40, clientY: 100 });
    expect(readSteer()).toBeLessThan(-0.7);
    fireEvent.pointerUp(stage, { pointerId: 1 });
    expect(readSteer()).toBe(0);
    expect(screen.getByTestId('steer')).toHaveTextContent('quieto');
  });

  it('un toque que empieza en un botón no inicia el arrastre (sin acciones duplicadas)', () => {
    render(<Stage />);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Pausa' }), { pointerId: 2, clientX: 10, clientY: 10 });
    expect(screen.getByTestId('steer')).toHaveTextContent('quieto');
  });
});

describe('deslizamientos', () => {
  function Board({ onSwipe, onTap }) {
    const swipe = useSwipe(onSwipe);
    return (
      <div data-testid="board" {...swipe}>
        <button type="button" onClick={onTap}>
          Celda
        </button>
        <div data-no-gesture>
          <button type="button">Cruceta</button>
        </div>
      </div>
    );
  }

  it('reconoce la dirección solo a partir del umbral', () => {
    const onSwipe = vi.fn();
    render(<Board onSwipe={onSwipe} onTap={() => {}} />);
    const board = screen.getByTestId('board');
    fireEvent.pointerDown(board, { pointerType: 'touch', clientX: 100, clientY: 100 });
    fireEvent.pointerMove(board, { pointerType: 'touch', clientX: 110, clientY: 104 });
    expect(onSwipe).not.toHaveBeenCalled();
    fireEvent.pointerMove(board, { pointerType: 'touch', clientX: 100, clientY: 150 });
    expect(onSwipe).toHaveBeenCalledWith('down');
    fireEvent.pointerMove(board, { pointerType: 'touch', clientX: 40, clientY: 150 });
    expect(onSwipe).toHaveBeenCalledTimes(1); // un gesto = una acción
  });

  it('un deslizamiento que empieza sobre una celda no se convierte además en un toque', () => {
    const onSwipe = vi.fn();
    const onTap = vi.fn();
    render(<Board onSwipe={onSwipe} onTap={onTap} />);
    const cell = screen.getByRole('button', { name: 'Celda' });
    fireEvent.pointerDown(cell, { pointerType: 'touch', clientX: 100, clientY: 100 });
    fireEvent.pointerMove(cell, { pointerType: 'touch', clientX: 160, clientY: 100 });
    fireEvent.click(cell);
    expect(onSwipe).toHaveBeenCalledWith('right');
    expect(onTap).not.toHaveBeenCalled();
  });

  it('los controles marcados (cruceta, HUD) no inician deslizamientos', () => {
    const onSwipe = vi.fn();
    render(<Board onSwipe={onSwipe} onTap={() => {}} />);
    const dpad = screen.getByRole('button', { name: 'Cruceta' });
    fireEvent.pointerDown(dpad, { pointerType: 'touch', clientX: 100, clientY: 100 });
    fireEvent.pointerMove(dpad, { pointerType: 'touch', clientX: 200, clientY: 100 });
    expect(onSwipe).not.toHaveBeenCalled();
  });
});

describe('pista de controles', () => {
  const pointerDown = (pointerType) => {
    const event = new Event('pointerdown');
    Object.defineProperty(event, 'pointerType', { value: pointerType });
    window.dispatchEvent(event);
  };
  const hint = () => render(<ControlsHint touch="Desliza ← →" desktop="← → o A D" />);

  it('muestra los gestos a quien acaba de tocar la pantalla, aunque el dispositivo diga tener ratón', () => {
    pointerDown('touch');
    hint();
    expect(screen.getByRole('status')).toHaveTextContent('Desliza ← →');
  });

  it('muestra el teclado a quien usa ratón (p. ej. un portátil táctil manejado con ratón)', () => {
    pointerDown('mouse');
    hint();
    expect(screen.getByRole('status')).toHaveTextContent('← → o A D');
  });
});

describe('controles de plataformas', () => {
  it('se corre y se salta a la vez con dos dedos, y el pulgar puede deslizarse de ‹ a ›', () => {
    const input = { current: { left: false, right: false, jump: false } };
    render(<PlatformControls inputRef={input} />);
    const pad = screen.getByRole('group', { name: /Moverse/ });
    // jsdom da un rectángulo de 0×0: a la izquierda del centro es «‹», a la derecha «›».
    fireEvent.pointerDown(pad, { pointerId: 1, clientX: -10 });
    expect(input.current).toMatchObject({ left: true, right: false });
    fireEvent.pointerMove(pad, { pointerId: 1, clientX: 10 });
    expect(input.current).toMatchObject({ left: false, right: true });
    // Segundo dedo en «Saltar» sin soltar el primero.
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Saltar' }), { pointerId: 2 });
    expect(input.current).toMatchObject({ right: true, jump: true });
    // Otro dedo sobre la almohadilla no le quita el control al primero.
    fireEvent.pointerDown(pad, { pointerId: 3, clientX: -10 });
    expect(input.current.right).toBe(true);
    // Soltar el primer dedo para el movimiento pero mantiene el salto.
    fireEvent.pointerUp(pad, { pointerId: 1 });
    expect(input.current).toMatchObject({ left: false, right: false, jump: true });
    fireEvent.pointerCancel(screen.getByRole('button', { name: 'Saltar' }), { pointerId: 2 });
    expect(input.current.jump).toBe(false);
  });
});
