import { describe, expect, it } from 'vitest';
import { contrastRatio, INK, normalizeHex, PAPER, readableOn } from './color.js';

describe('colores', () => {
  it('normaliza hexadecimales y rechaza valores inválidos', () => {
    expect(normalizeHex('#ABC')).toBe('#aabbcc');
    expect(normalizeHex('ef6f8c')).toBe('#ef6f8c');
    expect(normalizeHex('red')).toBeNull();
    expect(normalizeHex('#12345')).toBeNull();
  });

  it('calcula el contraste WCAG', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
  });

  it('elige texto legible sobre cada fondo', () => {
    expect(readableOn('#f5b961')).toBe(INK);
    expect(readableOn('#3b0a1e')).toBe(PAPER);
  });
});
