import { describe, expect, it } from 'vitest';
import { act, createDuoState, isWon, openDoors, parseDuo, solvableAlone, solveDuo } from '../engine/duoEngine.js';
import { DUO_LEVELS } from '../levels/duoLevels.js';

const board = (rows) => parseDuo({ rows });

describe('Lava y Agua · Dúo · movimiento', () => {
  it('andar una casilla y caer por gravedad', () => {
    const b = board(['#######', '#R.U..#', '#.#####', '#######']);
    const out = act(b, createDuoState(b), 'brasa', 'left');
    expect(out).toBeNull(); // pared
    const fall = board(['######', '#R...#', '##.U.#', '##...#', '######']);
    const s = act(fall, createDuoState(fall), 'brasa', 'right').state;
    expect(s.heroes.brasa).toEqual([3, 2]); // cae dos casillas
  });

  it('saltar: sube hasta 2 y avanza hasta 2; sin apoyo no se puede saltar', () => {
    const b = board(['########', '#......#', '#......#', '#R..U..#', '########']);
    const s = act(b, createDuoState(b), 'brasa', 'jumpRight').state;
    expect(s.heroes.brasa).toEqual([3, 3]);
    expect(act(b, createDuoState(b), 'brasa', 'jumpLeft')).not.toBeNull(); // sube aunque no avance de lado
  });

  it('cada uno resiste su elemento; el del otro y el ácido son mortales', () => {
    const lava = board(['#####', '#RLU#', '#####']);
    expect(act(lava, createDuoState(lava), 'brasa', 'right').state.dead).toBeNull();
    expect(act(lava, createDuoState(lava), 'gota', 'left').state.dead).toBe('gota');
    const water = board(['#####', '#RWU#', '#####']);
    expect(act(water, createDuoState(water), 'brasa', 'right').state.dead).toBe('brasa');
    const acid = board(['#####', '#RGU#', '#####']);
    expect(act(acid, createDuoState(acid), 'gota', 'left').state.dead).toBe('gota');
  });

  it('las placas abren su compuerta solo mientras alguien las pisa', () => {
    const b = board(['#######', '#..A..#', '#Ra.AU#', '#######']);
    let s = createDuoState(b);
    expect(openDoors(b, s.heroes).has('A')).toBe(false);
    expect(act(b, s, 'gota', 'left')).toBeNull(); // compuerta cerrada
    s = act(b, s, 'brasa', 'right').state;
    expect(openDoors(b, s.heroes).has('A')).toBe(true);
    expect(act(b, s, 'gota', 'left')).not.toBeNull();
  });

  it('un personaje sirve de plataforma al otro', () => {
    const b = board(['#####', '#...#', '#...#', '#R.U#', '#####']);
    let s = createDuoState(b);
    s = act(b, s, 'brasa', 'right').state; // Brasa junto a Gota
    const up = act(b, s, 'brasa', 'jumpRight').state; // salta y cae encima de Gota
    expect(up.heroes.brasa).toEqual([2, 3]);
  });

  it('victoria solo con los dos en su puerta', () => {
    const b = board(['#####', '#RFE#', '#U..#', '#####']);
    expect(isWon(b, createDuoState(b))).toBe(false);
  });
});

describe('Lava y Agua · Dúo · niveles', () => {
  it('ids únicos y mapas bien formados', () => {
    expect(new Set(DUO_LEVELS.map((l) => l.id)).size).toBe(DUO_LEVELS.length);
    for (const level of DUO_LEVELS) expect(() => parseDuo(level)).not.toThrow();
  });

  it('todos tienen solución en exactamente `par` movimientos (y se puede jugar)', () => {
    for (const level of DUO_LEVELS) {
      const b = parseDuo(level);
      const path = solveDuo(b);
      expect(path, level.id).not.toBeNull();
      expect(path.length, level.id).toBe(level.par);
      let s = createDuoState(b);
      for (const { hero, action } of path) s = act(b, s, hero, action).state;
      expect(isWon(b, s), level.id).toBe(true);
    }
  });

  it('salvo el tutorial, exigen cooperar: alguno no llega solo a su puerta', () => {
    for (const level of DUO_LEVELS.filter((l) => !l.tutorial)) {
      const b = parseDuo(level);
      expect(solvableAlone(b, 'brasa') && solvableAlone(b, 'gota'), level.id).toBe(false);
    }
  });
});
