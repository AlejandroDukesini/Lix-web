import { describe, expect, it } from 'vitest';
import { canEscape, createState, isWon, parseBoard, range, slide, solve } from '../engine/busEngine.js';
import { LEVELS, TIERS } from '../levels/levels.js';
import { starsFor } from '../Cochera.jsx';

const level = (rows) => ({ board: rows.join('') });

describe('Salida de la cochera · reglas', () => {
  const simple = level(['......', '......', 'xx..a.', '....a.', '......', '......']);

  it('cada vehículo se desliza solo por su eje y respeta los bordes', () => {
    const s = createState(simple);
    expect(range(s, 'x')).toEqual({ min: 0, max: 2 });
    expect(range(s, 'a')).toEqual({ min: -2, max: 2 });
    expect(slide(s, 'x', 3)).toBeNull(); // chocaría con «a»
    expect(slide(s, 'x', -1)).toBeNull(); // se saldría
    expect(slide(s, 'a', 2).vehicles.find((v) => v.id === 'a')).toMatchObject({ row: 4, col: 4 });
  });

  it('colisiones: no se atraviesan vehículos ni bolardos', () => {
    const s = createState(level(['......', '......', 'xx.o..', '......', '......', '......']));
    expect(range(s, 'x').max).toBe(1);
  });

  it('victoria cuando el microbús llega al borde derecho', () => {
    let s = createState(simple);
    expect(canEscape(s)).toBe(false);
    s = slide(s, 'a', 2);
    expect(canEscape(s)).toBe(true);
    s = slide(s, 'x', 4);
    expect(isWon(s)).toBe(true);
  });

  it('el solucionador da el mínimo exacto', () => {
    expect(solve(createState(simple))).toEqual([
      { id: 'a', delta: expect.any(Number) },
      { id: 'x', delta: 4 },
    ]);
  });

  it('rechaza tableros mal formados', () => {
    expect(() => parseBoard('x'.repeat(36))).toThrow();
    expect(() => parseBoard('......'.repeat(6))).toThrow(); // sin microbús
  });

  it('estrellas: en el mínimo → 3; con pista → máximo 2', () => {
    expect(starsFor(10, 10, false)).toBe(3);
    expect(starsFor(14, 10, false)).toBe(2);
    expect(starsFor(30, 10, false)).toBe(1);
    expect(starsFor(10, 10, true)).toBe(2);
  });
});

describe('Salida de la cochera · niveles', () => {
  it('cuatro dificultades, ids y tableros únicos', () => {
    expect(TIERS.map((t) => t.id)).toEqual(['facil', 'medio', 'dificil', 'avanzado']);
    for (const tier of TIERS) expect(LEVELS.filter((l) => l.tier === tier.id).length).toBeGreaterThanOrEqual(5);
    expect(new Set(LEVELS.map((l) => l.id)).size).toBe(LEVELS.length);
    expect(new Set(LEVELS.map((l) => l.board)).size).toBe(LEVELS.length);
  });

  it('todos tienen solución en exactamente `par` movimientos (búsqueda en anchura)', () => {
    for (const l of LEVELS) {
      const path = solve(createState(l), { limit: 1_000_000 });
      expect(path, l.id).not.toBeNull();
      expect(path.length, l.id).toBe(l.par);
      let s = createState(l);
      for (const { id, delta } of path) s = slide(s, id, delta);
      expect(isWon(s), l.id).toBe(true);
    }
  }, 60_000);

  it('la dificultad crece con cada grupo', () => {
    const max = (t) => Math.max(...LEVELS.filter((l) => l.tier === t).map((l) => l.par));
    const min = (t) => Math.min(...LEVELS.filter((l) => l.tier === t).map((l) => l.par));
    expect(min('medio')).toBeGreaterThan(max('facil'));
    expect(min('dificil')).toBeGreaterThan(max('medio'));
    expect(min('avanzado')).toBeGreaterThan(max('dificil'));
  });
});
