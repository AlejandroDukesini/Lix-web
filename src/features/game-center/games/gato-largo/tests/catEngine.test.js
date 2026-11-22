import { describe, expect, it } from 'vitest';
import { createState, directionTowards, headOf, isStuck, isWon, parseLevel, shrink, solve, stretch } from '../engine/catEngine.js';
import { LEVELS, TIERS } from '../levels/levels.js';
import { starsFor } from '../GatoLargo.jsx';

const board = (map) => parseLevel({ map });

describe('Gato largo · movimiento', () => {
  it('la cabeza avanza en línea recta hasta chocar y deja el cuerpo detrás', () => {
    const b = board(['S...', '.##.', '....']);
    const s = stretch(b, createState(b), 'right');
    expect(s.path).toEqual([0, 1, 2, 3]);
    expect(headOf(s)).toBe(3);
    expect(s.moves).toEqual([{ dir: 'right', length: 3 }]);
  });

  it('no atraviesa muebles, paredes ni su propio cuerpo', () => {
    const b = board(['S#', '..']);
    expect(stretch(b, createState(b), 'right')).toBeNull();
    expect(stretch(b, createState(b), 'up')).toBeNull();
    let s = stretch(b, createState(b), 'down');
    s = stretch(b, s, 'right');
    expect(stretch(b, s, 'left')).toBeNull(); // su cuerpo está ahí
  });

  it('encoger deshace exactamente el último estirón', () => {
    const b = board(['S..', '...']);
    const a = stretch(b, createState(b), 'right');
    const c = stretch(b, a, 'down');
    expect(shrink(c)).toEqual(a);
    expect(shrink(createState(b))).toEqual(createState(b));
  });

  it('victoria al llenar la habitación; atrapado si no queda dirección libre', () => {
    const b = board(['S.', '..']);
    let s = stretch(b, createState(b), 'right');
    s = stretch(b, s, 'down');
    s = stretch(b, s, 'left');
    expect(isWon(b, s)).toBe(true);
    // En un pasillo, si el gato sale hacia la derecha deja la izquierda sin cubrir y queda atrapado.
    const hall = board(['.S.']);
    const stuck = stretch(hall, createState(hall), 'right');
    expect(isStuck(hall, stuck)).toBe(true);
    expect(isWon(hall, stuck)).toBe(false);
  });

  it('tocar una casilla en línea con la cabeza da su dirección', () => {
    const b = board(['S..', '...']);
    expect(directionTowards(b, createState(b), 2)).toBe('right');
    expect(directionTowards(b, createState(b), 3)).toBe('down');
    expect(directionTowards(b, createState(b), 4)).toBeNull();
  });

  it('estrellas: sin encoger → 3; con pista → máximo 2', () => {
    expect(starsFor(0, false)).toBe(3);
    expect(starsFor(2, false)).toBe(2);
    expect(starsFor(9, false)).toBe(1);
    expect(starsFor(0, true)).toBe(2);
  });
});

describe('Gato largo · habitaciones', () => {
  it('hay habitaciones en las cuatro dificultades, con ids únicos y bien formadas', () => {
    expect(TIERS.map((t) => t.id)).toEqual(['facil', 'medio', 'dificil', 'avanzado']);
    for (const tier of TIERS) expect(LEVELS.filter((l) => l.tier === tier.id).length).toBeGreaterThanOrEqual(5);
    expect(new Set(LEVELS.map((l) => l.id)).size).toBe(LEVELS.length);
    for (const level of LEVELS) expect(() => parseLevel(level)).not.toThrow();
  });

  it('todas tienen solución (se comprueba jugándola)', () => {
    for (const level of LEVELS) {
      const b = parseLevel(level);
      const { solution } = solve(b);
      expect(solution, level.id).not.toBeNull();
      let s = createState(b);
      for (const dir of solution) s = stretch(b, s, dir);
      expect(isWon(b, s), level.id).toBe(true);
    }
  });

  it('las habitaciones crecen con la dificultad', () => {
    const cells = (tier) => Math.max(...LEVELS.filter((l) => l.tier === tier).map((l) => parseLevel(l).total));
    expect(cells('avanzado')).toBeGreaterThan(cells('facil'));
  });
});
