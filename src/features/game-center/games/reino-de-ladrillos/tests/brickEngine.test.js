import { describe, expect, it } from 'vitest';
import { DT, PHYS, POINTS, SIZE, T, cloneWorld, coinTotal, compressInputs, createWorld, decodeInput, expandInputs, parseLevel, step } from '../engine/brickEngine.js';
import { LEVELS } from '../levels/levels.js';
import { SOLUTIONS } from '../levels/solutions.js';

/** Nivel de prueba: 14 filas, suelo en las dos últimas. Las filas que se pasan van encima del suelo. */
function lvl(lines, { width = 40, ground = '#' } = {}) {
  const top = Array.from({ length: 12 - lines.length }, () => '');
  const rows = [...top, ...lines].map((r) => r.padEnd(width, ' '));
  rows.push(ground.repeat(width), ground.repeat(width));
  rows[11] = rows[11].slice(0, width - 2) + 'F ';
  rows[10] = rows[10].slice(0, width - 2) + 'F ';
  return { id: 'test', name: 'Prueba', rows };
}
/** Mundo listo: un fotograma sin pulsar nada (un salto mantenido desde antes de empezar no cuenta). */
const fresh = (def, carry) => {
  const w = createWorld(def, carry);
  step(w, {});
  return w;
};
const run = (w, input, frames) => {
  const events = [];
  for (let i = 0; i < frames; i += 1) events.push(...step(w, input));
  return events;
};
const R = { right: true };
const RJ = { right: true, jump: true };
const J = { jump: true };

describe('movimiento', () => {
  it('acelera hasta la velocidad máxima y frena por rozamiento', () => {
    const w = fresh(lvl(['P']));
    run(w, R, 6);
    expect(w.player.vx).toBeGreaterThan(0);
    expect(w.player.vx).toBeLessThan(PHYS.walkMax);
    run(w, R, 60);
    expect(w.player.vx).toBe(PHYS.walkMax);
    run(w, {}, 60);
    expect(w.player.vx).toBe(0);
  });

  it('la gravedad lo mantiene sobre el suelo', () => {
    const w = fresh(lvl(['P']));
    run(w, {}, 30);
    expect(w.player.onGround).toBe(true);
    expect(w.player.y + w.player.h).toBeCloseTo(12 * T);
  });

  it('salta (más alto si mantiene el botón) y vuelve a caer', () => {
    const peak = (frames) => {
      const w = fresh(lvl(['P']));
      let min = Infinity;
      for (let i = 0; i < 90; i += 1) {
        step(w, { jump: i < frames });
        min = Math.min(min, w.player.y);
      }
      expect(w.player.onGround).toBe(true);
      return 12 * T - min;
    };
    const tap = peak(2);
    const held = peak(40);
    expect(held).toBeGreaterThan(tap * 1.5);
    expect(held).toBeGreaterThan(3.5 * T); // supera una tubería de 3
  });

  it('no repite el salto si se mantiene pulsado', () => {
    const w = fresh(lvl(['P']));
    const events = run(w, J, 120);
    expect(events.filter((e) => e.type === 'jump')).toHaveLength(1);
  });

  it('choca con las paredes', () => {
    const w = fresh(lvl(['P   =', '    =']));
    run(w, R, 120);
    expect(w.player.x + w.player.w).toBeLessThanOrEqual(4 * T);
  });

  it('la cámara solo avanza y el borde izquierdo frena', () => {
    const w = fresh(lvl(['P'], { width: 80 }));
    run(w, R, 180);
    expect(w.camX).toBeGreaterThan(0);
    run(w, { left: true }, 40); // primero frena (y la cámara aún avanza un poco)
    const cam = w.camX;
    run(w, { left: true }, 240);
    expect(w.camX).toBe(cam);
    expect(w.player.x).toBeGreaterThanOrEqual(cam);
  });
});

describe('bloques', () => {
  // Bloque 3 casillas por encima del suelo, justo encima del jugador.
  const under = (block) => lvl(['  ' + block, '', '', 'P']);

  it('el bloque «?» da una moneda y queda gastado', () => {
    const w = fresh(under('?'));
    w.player.x = 2 * T + 2;
    const events = run(w, J, 40);
    expect(events.some((e) => e.type === 'blockCoin')).toBe(true);
    expect(w.coinCount).toBe(1);
    expect(w.score).toBe(POINTS.coin);
    expect(w.grid[8][2]).toBe('U');
    run(w, {}, 60);
    run(w, J, 40);
    expect(w.coinCount).toBe(1);
  });

  it('el ladrillo rebota si eres pequeño y se rompe si eres grande', () => {
    const small = fresh(under('B'));
    small.player.x = 2 * T + 2;
    run(small, J, 40);
    expect(small.grid[8][2]).toBe('B');
    const big = fresh(under('B'), { big: true });
    big.player.x = 2 * T + 2;
    const events = run(big, J, 40);
    expect(events.some((e) => e.type === 'brick')).toBe(true);
    expect(big.grid[8][2]).toBe(' ');
  });

  it('el corazón sale del bloque, camina y al tocarlo se crece', () => {
    const w = fresh(lvl(['  M', '', '', 'P']));
    w.player.x = 2 * T + 2;
    run(w, J, 30);
    expect(w.items).toHaveLength(1);
    // El corazón camina a la derecha, cae del bloque y sigue: esperar a que baje y alcanzarlo.
    run(w, {}, 120);
    expect(w.items[0].y + w.items[0].h).toBeCloseTo(12 * T);
    let grew = false;
    for (let i = 0; i < 300 && !grew; i += 1) grew = step(w, R).some((e) => e.type === 'powerup');
    expect(grew).toBe(true);
    expect(w.player.big).toBe(true);
    expect(w.player.h).toBe(SIZE.big.h);
  });
});

describe('enemigos y daño', () => {
  it('pisar a un gorgojo lo elimina y rebota', () => {
    const w = fresh(lvl(['P   g']));
    w.enemies[0].vx = 0;
    // Saltar y caer encima.
    const events = [];
    for (let i = 0; i < 120 && !events.some((e) => e.type === 'stomp'); i += 1) events.push(...step(w, { right: true, jump: i < 40 }));
    expect(events.some((e) => e.type === 'stomp')).toBe(true);
    expect(w.enemies[0].alive).toBe(false);
    expect(w.status).toBe('playing');
  });

  it('tocarlo de lado: grande encoge, pequeño pierde una vida', () => {
    const big = fresh(lvl(['P  g']), { big: true });
    const e1 = run(big, R, 90);
    expect(e1.some((e) => e.type === 'shrink')).toBe(true);
    expect(big.player.big).toBe(false);
    expect(big.lives).toBe(3);

    const small = fresh(lvl(['P  g']));
    const e2 = run(small, R, 90);
    expect(e2.some((e) => e.type === 'death')).toBe(true);
    expect(small.lives).toBe(2);
  });

  it('el caracol se esconde, se patea y su caparazón arrasa', () => {
    const w = fresh(lvl(['P   k      g'], { width: 50 }));
    for (const e of w.enemies) e.vx = 0;
    for (let i = 0; i < 120 && w.enemies[0].state !== 'shell'; i += 1) step(w, { right: true, jump: i < 40 });
    expect(w.enemies[0].state).toBe('shell');
    // El rebote del pisotón lo lleva por encima: volver al suelo a la izquierda del caparazón y patearlo caminando hacia él.
    run(w, {}, 60);
    w.player.x = w.enemies[0].x - 24;
    w.player.vx = 0;
    let kicked = false;
    for (let i = 0; i < 120 && !kicked; i += 1) kicked = step(w, R).some((e) => e.type === 'kick');
    expect(kicked).toBe(true);
    run(w, {}, 120);
    expect(w.enemies[1].alive).toBe(false);
    expect(w.status).toBe('playing');
  });

  it('caer al vacío o a la lava cuesta una vida y reaparece en la bandera de control', () => {
    const def = lvl(['P  C'], { width: 40 });
    def.rows[12] = '#'.repeat(8) + ' '.repeat(4) + '#'.repeat(28);
    def.rows[13] = '#'.repeat(8) + ' '.repeat(4) + '#'.repeat(28);
    const w = fresh(def);
    const events = [];
    for (let i = 0; i < 300 && !events.some((e) => e.type === 'death'); i += 1) events.push(...step(w, R));
    expect(events.some((e) => e.type === 'checkpoint')).toBe(true);
    expect(events).toContainEqual({ type: 'death', cause: 'pit' });
    run(w, {}, Math.ceil(PHYS.respawn / DT) + 2);
    expect(w.status).toBe('playing');
    expect(w.player.x).toBe(w.level.checkpoints[0].spawn.x);

    const lava = lvl(['P'], { width: 40 });
    lava.rows[12] = '#'.repeat(6) + ' '.repeat(3) + '#'.repeat(31);
    lava.rows[13] = '#'.repeat(6) + 'LLL' + '#'.repeat(31);
    const wl = fresh(lava);
    expect(run(wl, R, 200)).toContainEqual({ type: 'death', cause: 'lava' });
  });

  it('sin vidas, la partida se pierde', () => {
    const w = fresh(lvl(['P  g']), { lives: 1 });
    run(w, R, 90);
    run(w, {}, Math.ceil(PHYS.respawn / DT) + 2);
    expect(w.status).toBe('lost');
    expect(step(w, R)).toEqual([]);
  });

  it('sin tiempo se pierde una vida', () => {
    const w = fresh(lvl(['P']));
    w.timeLeft = 0.05;
    expect(run(w, {}, 10)).toContainEqual({ type: 'death', cause: 'time' });
  });
});

describe('monedas, puntos y meta', () => {
  it('100 monedas dan una vida', () => {
    const w = fresh(lvl(['Po']), { coins: 99 });
    const events = run(w, R, 30);
    expect(events.some((e) => e.type === 'oneUp')).toBe(true);
    expect(w.lives).toBe(4);
  });

  it('llegar al mástil gana el nivel con bonificación por altura y por tiempo', () => {
    const w = fresh(lvl(['P'], { width: 20 }));
    const events = run(w, R, 400);
    const flag = events.find((e) => e.type === 'flag');
    expect(flag).toBeTruthy();
    expect(w.status).toBe('won');
    expect(flag.timeBonus).toBeGreaterThan(0);
    expect(w.score).toBe(flag.bonus + flag.timeBonus);
  });

  it('cuenta las monedas de un nivel y comprime entradas', () => {
    expect(coinTotal({ rows: ['o?o', ' ? '] })).toBe(4);
    const masks = [2, 2, 6, 6, 6, 0];
    expect(expandInputs(compressInputs(masks))).toEqual(masks);
    expect(decodeInput(6)).toEqual({ left: false, right: true, jump: true });
  });

  it('determinista: misma entrada, mismo resultado (y clonar no comparte estado)', () => {
    const a = createWorld(LEVELS[0]);
    const b = cloneWorld(a);
    for (let i = 0; i < 300; i += 1) {
      const input = decodeInput(i % 40 < 10 ? 6 : 2);
      step(a, input);
      step(b, input);
    }
    expect(b.player).toEqual(a.player);
    expect(b.score).toBe(a.score);
  });
});

describe('niveles', () => {
  it('están bien formados', () => {
    for (const def of LEVELS) {
      const level = parseLevel(def);
      expect(level.rows).toBe(14);
      expect(level.checkpoints.length).toBeGreaterThanOrEqual(1);
      expect(coinTotal(def)).toBeGreaterThan(5);
    }
  });

  it.each(LEVELS.map((l) => [l.name, l]))('«%s» se supera con el motor real sin perder ninguna vida', (_, def) => {
    expect(SOLUTIONS[def.id]).toBeTruthy();
    const w = createWorld(def, { lives: 1 });
    for (const mask of expandInputs(SOLUTIONS[def.id])) {
      const events = step(w, decodeInput(mask));
      expect(events.some((e) => e.type === 'death')).toBe(false);
      if (w.status === 'won') break;
    }
    expect(w.status).toBe('won');
  });
});
