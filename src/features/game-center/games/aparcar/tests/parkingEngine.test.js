import { describe, expect, it } from 'vitest';
import { CAR, MAX_HITS, PHYSICS, createParking, inSpot, levelProblems, overlap, starsFor, step } from '../engine/parkingEngine.js';
import { LEVELS } from '../levels/levels.js';
import { SOLUTIONS } from '../levels/solutions.js';

const DT = 1 / 60;
const drive = (state, input, seconds) => {
  const events = [];
  for (let t = 0; t < seconds - 1e-9; t += DT) events.push(...step(state, input, DT));
  return events;
};
const open = { id: 'test', width: 60, height: 60, start: { x: 30, y: 30, angle: 0 }, spot: { x: 50, y: 50, w: 5.2, h: 3, angle: 0 }, obstacles: [] };

describe('movimiento', () => {
  it('acelera de forma progresiva hasta la velocidad máxima', () => {
    const state = createParking(open);
    drive(state, { throttle: 1 }, 0.5);
    const early = state.car.speed;
    expect(early).toBeGreaterThan(1);
    expect(early).toBeLessThan(PHYSICS.maxForward);
    drive(state, { throttle: 1 }, 5);
    expect(state.car.speed).toBeCloseTo(PHYSICS.maxForward);
    expect(state.car.x).toBeGreaterThan(30);
  });

  it('frena antes de dar marcha atrás, y la marcha atrás es más lenta', () => {
    const state = createParking(open);
    drive(state, { throttle: 1 }, 1);
    drive(state, { throttle: -1 }, 0.2);
    expect(state.car.speed).toBeGreaterThan(0); // aún frenando
    drive(state, { throttle: -1 }, 4);
    expect(state.car.speed).toBeCloseTo(-PHYSICS.maxReverse);
  });

  it('sin acelerar el coche se detiene solo', () => {
    const state = createParking(open);
    drive(state, { throttle: 1 }, 1);
    drive(state, {}, 4);
    expect(state.car.speed).toBe(0);
  });

  it('parado no gira; en marcha gira hacia el lado del volante (y al revés marcha atrás)', () => {
    const still = createParking(open);
    drive(still, { steer: 1 }, 1);
    expect(still.car.angle).toBe(0);
    const forward = createParking(open);
    drive(forward, { throttle: 1, steer: 1 }, 1);
    expect(forward.car.angle).toBeGreaterThan(0.2);
    const reverse = createParking(open);
    drive(reverse, { throttle: -1, steer: 1 }, 1);
    expect(reverse.car.angle).toBeLessThan(-0.05);
  });

  it('el volante se mueve a velocidad limitada y vuelve al centro al soltarlo', () => {
    const state = createParking(open);
    drive(state, { steer: 1 }, 0.1);
    expect(state.car.steer).toBeLessThan(PHYSICS.steerMax);
    drive(state, { steer: 1 }, 1);
    expect(state.car.steer).toBeCloseTo(PHYSICS.steerMax);
    drive(state, {}, 1);
    expect(state.car.steer).toBe(0);
  });
});

describe('colisiones', () => {
  it('los rectángulos orientados se solapan solo cuando se tocan', () => {
    expect(overlap({ x: 0, y: 0, w: 4, h: 2, angle: 0 }, { x: 3.9, y: 0, w: 4, h: 2, angle: 0 })).toBe(true);
    expect(overlap({ x: 0, y: 0, w: 4, h: 2, angle: 0 }, { x: 4.1, y: 0, w: 4, h: 2, angle: 0 })).toBe(false);
    expect(overlap({ x: 0, y: 0, w: 4, h: 0.5, angle: Math.PI / 4 }, { x: 1.2, y: -1.2, w: 0.5, h: 0.5, angle: 0 })).toBe(false);
  });

  it('chocar no atraviesa: rebota, cuenta un golpe y al tercero se acaba', () => {
    const level = { ...open, obstacles: [{ x: 36, y: 30, w: 2, h: 6, angle: 0, kind: 'wall' }] };
    const state = createParking(level);
    const events = drive(state, { throttle: 1 }, 3);
    expect(events.filter((e) => e.type === 'hit')).toHaveLength(1);
    expect(state.car.x + CAR.length / 2).toBeLessThanOrEqual(35);
    for (let i = 1; i < MAX_HITS; i += 1) {
      drive(state, { throttle: -1 }, 0.8);
      drive(state, { throttle: 1 }, 2);
    }
    expect(state.status).toBe('wrecked');
  });

  it('los bordes del aparcamiento son muros', () => {
    const state = createParking({ ...open, start: { x: 3, y: 30, angle: Math.PI } });
    const events = drive(state, { throttle: 1 }, 2);
    expect(events).toContainEqual({ type: 'hit' });
    expect(state.car.x).toBeGreaterThan(CAR.length / 2 - 0.1);
  });
});

describe('aparcar', () => {
  const spotAt = (angle, extra = {}) => ({ ...open, spot: { x: 30, y: 30, w: 5.2, h: 3, angle, ...extra } });

  it('hay que estar dentro, orientado como pide la plaza y parado un momento', () => {
    expect(inSpot(spotAt(0), { x: 30, y: 30, angle: 0 })).toBe(true);
    expect(inSpot(spotAt(0), { x: 30.8, y: 30, angle: 0 })).toBe(false); // asoma por delante
    expect(inSpot(spotAt(0), { x: 30, y: 30, angle: Math.PI })).toBe(false); // al revés
    expect(inSpot(spotAt(0, { either: true }), { x: 30, y: 30, angle: Math.PI })).toBe(true);
    const state = createParking({ ...spotAt(0), start: { x: 30, y: 30, angle: 0 } });
    expect(drive(state, {}, 0.5)).toEqual([]);
    expect(drive(state, {}, 0.5)).toContainEqual({ type: 'parked' });
  });

  it('pasar por la plaza sin detenerse no cuenta', () => {
    const state = createParking({ ...spotAt(0), start: { x: 20, y: 30, angle: 0 }, width: 80 });
    drive(state, { throttle: 1 }, 4);
    expect(state.status).toBe('driving');
  });

  it('las estrellas premian no chocar y el buen tiempo', () => {
    const base = { level: { par: 10 } };
    expect(starsFor({ ...base, hits: 0, time: 9 })).toBe(3);
    expect(starsFor({ ...base, hits: 1, time: 9 })).toBe(2);
    expect(starsFor({ ...base, hits: 2, time: 9 })).toBe(1);
  });
});

describe('niveles', () => {
  it('hay ocho niveles válidos', () => {
    expect(LEVELS).toHaveLength(8);
    for (const level of LEVELS) expect(levelProblems(level), level.id).toEqual([]);
  });

  it.each(LEVELS.map((l) => [l.name, l]))('«%s» tiene una solución que aparca sin tocar nada', (_, level) => {
    const solution = SOLUTIONS[level.id];
    expect(solution).toBeTruthy();
    const state = createParking(level);
    for (const [throttle, steer, frames] of solution) {
      for (let f = 0; f < frames && state.status === 'driving'; f += 1) step(state, { throttle, steer }, DT);
    }
    expect(state).toMatchObject({ status: 'parked', hits: 0 });
  });
});
