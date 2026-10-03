import { describe, expect, it } from 'vitest';
import { DT, PHYS, T, compressInputs, createWorld, decodeInput, expandInputs, parseLevel, step } from '../engine/lumiEngine.js';
import { LEVELS } from '../levels/levels.js';
import { SOLUTIONS } from '../levels/solutions.js';

const W = 40;
/** Nivel de prueba: suelo en la fila 12 y lo que se añada. */
function test(rows = {}, { width = W } = {}) {
  const grid = Array.from({ length: 14 }, (_, r) => (r >= 12 ? '#'.repeat(width) : ' '.repeat(width)).split(''));
  for (const [key, ch] of Object.entries(rows)) {
    const [c, r] = key.split(',').map(Number);
    grid[r][c] = ch;
  }
  if (!Object.values(rows).includes('P')) grid[11][2] = 'P';
  if (!Object.values(rows).includes('G')) grid[11][width - 2] = 'G';
  const w = createWorld({ id: 'test', rows: grid.map((r) => r.join('')) });
  // Al aparecer, un salto ya mantenido no cuenta: se empieza con el botón suelto.
  w.player.prevJump = false;
  return w;
}
const run = (w, input, frames) => {
  const events = [];
  for (let i = 0; i < frames; i += 1) events.push(...step(w, input));
  return events;
};
/** Altura máxima (en casillas) de un salto manteniendo el botón `hold` fotogramas. */
function jumpHeight(hold) {
  const w = test();
  const y0 = w.player.y;
  let min = y0;
  for (let f = 0; f < 90; f += 1) {
    step(w, { jump: f < hold });
    min = Math.min(min, w.player.y);
  }
  return (y0 - min) / T;
}

describe('niveles', () => {
  it('rechaza niveles sin salida o sin vela', () => {
    expect(() => parseLevel({ id: 'x', rows: ['   G', '####'] })).toThrow(/salida/);
    expect(() => parseLevel({ id: 'x', rows: ['P   ', '####'] })).toThrow(/vela/);
  });

  it('cada nivel es válido y tiene chispas, faroles y enemigos', () => {
    expect(LEVELS).toHaveLength(8);
    for (const def of LEVELS) {
      const level = parseLevel(def);
      expect(level.coins.length, def.id).toBeGreaterThanOrEqual(8);
      expect(level.checkpoints.length, def.id).toBeGreaterThanOrEqual(1);
      expect(level.enemies.length, def.id).toBeGreaterThanOrEqual(1);
    }
  });

  it('cada nivel se puede superar: su solución llega a la vela sin perder vidas', () => {
    for (const def of LEVELS) {
      const w = createWorld(def);
      for (const mask of expandInputs(SOLUTIONS[def.id])) {
        step(w, decodeInput(mask));
        if (w.status !== 'playing') break;
      }
      expect(w.status, def.id).toBe('won');
      expect(w.deaths, def.id).toBe(0);
    }
  });

  it('el motor es determinista y las entradas se comprimen sin pérdida', () => {
    const inputs = expandInputs(SOLUTIONS.l2);
    expect(expandInputs(compressInputs(inputs))).toEqual(inputs);
    const a = createWorld(LEVELS[1]);
    const b = createWorld(LEVELS[1]);
    for (const m of inputs.slice(0, 400)) {
      step(a, decodeInput(m));
      step(b, decodeInput(m));
    }
    expect(a.player).toEqual(b.player);
    expect(a.enemies).toEqual(b.enemies);
  });
});

describe('movimiento', () => {
  it('acelera hasta la velocidad máxima y se detiene al soltar', () => {
    const w = test();
    run(w, { right: true }, 60);
    expect(w.player.vx).toBe(PHYS.runMax);
    run(w, {}, 12);
    expect(w.player.vx).toBe(0);
  });

  it('salto variable: mantener el botón salta más que un toque (de ~1,5 a ~3,4 casillas)', () => {
    const tap = jumpHeight(1);
    const full = jumpHeight(60);
    expect(tap).toBeGreaterThan(1.2);
    expect(tap).toBeLessThan(2);
    expect(full).toBeGreaterThan(3.2);
    expect(full).toBeLessThan(3.6);
  });

  it('un salto mantenido no se repite solo: hay que volver a pulsar', () => {
    const w = test();
    const jumps = run(w, { jump: true }, 120).filter((e) => e.type === 'jump');
    expect(jumps).toHaveLength(1);
  });

  it('las paredes detienen a Lumi', () => {
    const w = test({ '6,11': '=', '6,10': '=' });
    run(w, { right: true }, 60);
    expect(w.player.x + 10).toBeLessThanOrEqual(6 * T);
    expect(w.player.vx).toBe(0);
  });

  it('margen tras el borde: se puede saltar justo después de dejar el suelo', () => {
    // Suelo hasta la columna 5 y vacío después.
    const make = () => {
      const w = test();
      w.level.grid = w.level.grid.map((row, r) => (r >= 12 ? row.slice(0, 6) + ' '.repeat(W - 6) : row));
      return w;
    };
    const edgeFrames = (w) => {
      let f = 0;
      while (w.player.onGround && f < 200) {
        step(w, { right: true });
        f += 1;
      }
      return f;
    };
    const late = make();
    edgeFrames(late);
    run(late, { right: true }, 4); // 4 fotogramas en el aire (< 0,1 s)
    expect(run(late, { right: true, jump: true }, 1).some((e) => e.type === 'jump')).toBe(true);
    const tooLate = make();
    edgeFrames(tooLate);
    run(tooLate, { right: true }, 10); // ~0,17 s: ya no
    expect(run(tooLate, { right: true, jump: true }, 1).some((e) => e.type === 'jump')).toBe(false);
  });

  it('pulsación anticipada: saltar un poco antes de aterrizar cuenta al tocar el suelo', () => {
    const w = test();
    run(w, { jump: true }, 1);
    run(w, {}, 1);
    while (w.player.vy < 0 || w.player.y + 14 < 12 * T - 6) step(w, {});
    // A punto de aterrizar: se pulsa en el aire y se mantiene.
    const events = run(w, { jump: true }, 8);
    expect(events.filter((e) => e.type === 'jump')).toHaveLength(1);
  });

  it('las plataformas finas se atraviesan desde abajo y sostienen desde arriba', () => {
    const w = test({ '2,9': '-', '3,9': '-' });
    run(w, { jump: true }, 40);
    run(w, {}, 40);
    expect(w.player.onGround).toBe(true);
    expect(w.player.y + 14).toBe(9 * T);
  });

  it('las plataformas móviles llevan a Lumi consigo', () => {
    const w = test({ '2,9': 'H', '8,9': 'P', '30,11': 'G' });
    // Lumi empieza en el suelo; se sube a la plataforma saltando desde debajo de ella no
    // es posible (se atraviesa solo hacia abajo), así que se coloca encima.
    w.player.x = w.movers[0].x + 18;
    w.player.y = w.movers[0].y - 14;
    w.player.ground = 0;
    const x0 = w.player.x;
    run(w, {}, Math.round(PHYS.respawn / DT) + 60);
    expect(w.player.ground).toBe(0);
    expect(w.player.x).toBeGreaterThan(x0 + 20);
  });

  it('los muelles lanzan más alto que un salto', () => {
    const w = test({ '5,11': 'S' });
    let min = w.player.y;
    const events = [];
    for (let f = 0; f < 90; f += 1) {
      events.push(...step(w, { right: f < 30 }));
      min = Math.min(min, w.player.y);
    }
    expect(events.some((e) => e.type === 'spring')).toBe(true);
    expect((11 * T + 2 - min) / T).toBeGreaterThan(5);
  });
});

describe('peligros, enemigos y objetos', () => {
  it('pisar una sombra desde arriba la elimina y hace rebotar', () => {
    const w = test({ '6,11': 'b' });
    w.player.x = w.enemies[0].x;
    w.player.y = w.enemies[0].y - 40;
    w.player.onGround = false;
    w.player.ground = null;
    const events = run(w, {}, 30);
    expect(events.some((e) => e.type === 'stomp')).toBe(true);
    expect(w.enemies[0].alive).toBe(false);
    expect(w.deaths).toBe(0);
  });

  it('tocarla de lado cuesta una vida y Lumi vuelve al último farol', () => {
    const w = test({ '9,11': 'b', '5,11': 'C' });
    run(w, { right: true }, 20);
    expect(w.checkpoint).toBe(0);
    const events = run(w, { right: true }, 60);
    expect(events.some((e) => e.type === 'death')).toBe(true);
    expect(w.lives).toBe(2);
    run(w, {}, Math.round(PHYS.respawn / DT) + 2);
    expect(Math.floor(w.player.x / T)).toBe(5);
    // Al reaparecer es invulnerable un momento.
    expect(w.player.invulnerable).toBeGreaterThan(0);
  });

  it('las sombras se dan la vuelta en los bordes y no caen', () => {
    const w = test({ '20,11': 'b' });
    w.level.grid = w.level.grid.map((row, r) => (r === 12 ? ' '.repeat(16) + '#'.repeat(8) + ' '.repeat(W - 24) : row));
    run(w, {}, 600);
    const e = w.enemies[0];
    expect(e.x).toBeGreaterThanOrEqual(16 * T - 1);
    expect(e.x + e.w).toBeLessThanOrEqual(24 * T + 1);
    expect(e.y).toBe(12 * T - e.h);
  });

  it('pinchos y caídas cuestan una vida; sin vidas se pierde', () => {
    const spikes = test({ '5,11': '^' });
    expect(run(spikes, { right: true }, 40).some((e) => e.type === 'death')).toBe(true);
    const pit = test();
    pit.level.grid = pit.level.grid.map((row, r) => (r >= 12 ? '#'.repeat(5) + ' '.repeat(W - 5) : row));
    pit.lives = 1;
    run(pit, { right: true }, 120);
    expect(pit.status).toBe('lost');
  });

  it('las chispas se cuentan una vez y la vela termina el nivel', () => {
    const w = test({ '5,11': 'o', '6,11': 'o', '10,11': 'G' });
    const events = run(w, { right: true }, 120);
    expect(events.filter((e) => e.type === 'coin')).toHaveLength(2);
    expect(w.coinCount).toBe(2);
    expect(w.status).toBe('won');
  });
});
