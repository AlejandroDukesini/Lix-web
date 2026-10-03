import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { GameOverlay } from '../components/GameOverlay.jsx';

function setup() {
  const onNext = vi.fn();
  render(<GameOverlay title="¡Despejado!" actions={<button type="button" onClick={onNext}>Siguiente nivel</button>} />);
  return { onNext, button: screen.getByRole('button', { name: 'Siguiente nivel' }) };
}

describe('paneles del juego: clics fantasma', () => {
  it('ignora el clic que llega de un toque empezado fuera del panel (el que terminó la partida)', () => {
    const { onNext, button } = setup();
    fireEvent.click(button, { detail: 1 });
    expect(onNext).not.toHaveBeenCalled();
  });

  it('acepta un toque o clic que empieza dentro del panel', () => {
    const { onNext, button } = setup();
    fireEvent.pointerDown(button);
    fireEvent.click(button, { detail: 1 });
    expect(onNext).toHaveBeenCalledOnce();
  });

  it('el teclado (Intro / Espacio, detail 0) siempre funciona', () => {
    const { onNext, button } = setup();
    fireEvent.click(button, { detail: 0 });
    expect(onNext).toHaveBeenCalledOnce();
  });
});
