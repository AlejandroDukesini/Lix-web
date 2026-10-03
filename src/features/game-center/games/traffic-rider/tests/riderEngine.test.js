import { describe, expect, it } from 'vitest';
import { BIKE, KMH, LANES, LANE_W, MISSIONS, PHYSICS, ROAD_HALF, createRide, laneX, missionProgress, sceneAt, step } from '../engine/riderEngine.js';

const DT = 1 / 60;
const ride = (state, input, seconds) => {
  const events = [];
  for (let t = 0; t < seconds - 1e-9 && state.status === 'riding'; t += DT) events.push(...step(state, input, DT));
  return events;
};
/** Carretera vacía (sin tráfico) para probar la moto sola. */
const empty = (seed = 1) => {
  const state = createRide(seed);
  state.nextSpawnZ = Infinity;
  return state;
};
const car = (lane, z, speed = 15) => ({ id: 99, kind: 'car', lane, x: laneX(lane), z, speed, cruise: speed, passed: false, width: 1.8, length: 4.4, height: 1.4 });

describe('conducción', () => {
  it('acelera cada vez menos hasta la velocidad máxima', () => {
    const state = empty();
    ride(state, { throttle: 1 }, 1);
    const first = state.bike.speed - 22;
    ride(state, { throttle: 1 }, 1);
    const second = state.bike.speed - 22 - first;
    expect(second).toBeLessThan(first);
    ride(state, { throttle: 1 }, 40);
    expect(state.bike.speed).toBeLessThanOrEqual(PHYSICS.maxSpeed);
    expect(state.bike.speed * KMH).toBeGreaterThan(200);
  });

  it('frena más fuerte de lo que acelera y sin acelerar pierde velocidad poco a poco', () => {
    const state = empty();
    ride(state, { throttle: 1 }, 5);
    const top = state.bike.speed;
    ride(state, { throttle: -1 }, 1);
    expect(top - state.bike.speed).toBeGreaterThan(15);
    const coast = empty();
    ride(coast, {}, 1);
    expect(coast.bike.speed).toBeCloseTo(22 - PHYSICS.drag, 1);
  });

  it('el movimiento lateral es progresivo (no salta) y los bordes la contienen', () => {
    const state = empty();
    const x0 = state.bike.x;
    step(state, { steer: 1 }, DT);
    expect(state.bike.x - x0).toBeLessThan(0.05);
    ride(state, { steer: 1 }, 0.5);
    expect(state.bike.vx).toBeCloseTo(PHYSICS.lateralMax);
    ride(state, { steer: 1 }, 5);
    expect(state.status).toBe('riding');
    expect(state.bike.x).toBeLessThanOrEqual(ROAD_HALF - BIKE.width / 2);
  });
});

describe('tráfico, adelantamientos y choques', () => {
  it('chocar con un vehículo termina la carrera', () => {
    const state = empty();
    state.traffic.push(car(1, 30, 10));
    const events = ride(state, { throttle: 1 }, 5);
    expect(state.status).toBe('crashed');
    expect(events).toContainEqual({ type: 'crash', with: 'car' });
  });

  it('un vehículo que llega por detrás no embiste a la moto: se pone a su ritmo', () => {
    const state = empty();
    state.bike.speed = 15;
    const chaser = { ...car(1, -20, 30), cruise: 30 };
    state.traffic.push(chaser);
    ride(state, { throttle: -1 }, 6);
    expect(state.status).toBe('riding');
    expect(chaser.z).toBeLessThan(state.bike.z);
  });

  it('pasar por el carril de al lado cuenta como adelantamiento (ajustado si se va rápido)', () => {
    const state = empty();
    state.bike.speed = 40;
    state.traffic.push(car(2, 30, 15));
    const events = ride(state, { throttle: 1 }, 4);
    expect(state.status).toBe('riding');
    expect(events).toContainEqual({ type: 'overtake', close: true });
    expect(state.overtakes).toBe(1);
    expect(state.close).toBe(1);
  });

  it('puntúa la distancia, más por encima de 100 km/h', () => {
    const slow = empty();
    slow.bike.speed = 20;
    ride(slow, {}, 0.1);
    const fast = empty();
    fast.bike.speed = 40;
    ride(fast, { throttle: 1 }, 0.1);
    expect(slow.score / slow.bike.z).toBeCloseTo(1);
    expect(fast.score / fast.bike.z).toBeCloseTo(1.5);
  });

  it('el tráfico nunca ocupa los cuatro carriles a la vez en una franja corta', () => {
    // Se acumulan las infracciones y se comprueba una vez (miles de `expect` hacen la prueba muy lenta).
    const blocked = [];
    for (let seed = 1; seed <= 6; seed += 1) {
      const state = createRide(seed);
      state.bike.x = -100; // fuera del camino: solo se observa el tráfico
      for (let t = 0; t < 240; t += DT) {
        step(state, { throttle: 1 }, DT);
        for (const v of state.traffic) {
          if (v.z < state.bike.z) continue;
          const lanes = new Set(state.traffic.filter((o) => Math.abs(o.z - v.z) < 6).map((o) => o.lane));
          if (lanes.size >= LANES) blocked.push({ seed, z: Math.round(v.z) });
        }
      }
    }
    expect(blocked).toEqual([]);
  });

  it('el escenario cambia cada 2,5 km', () => {
    expect(sceneAt(0).id).toBe('afueras');
    expect(sceneAt(2600).id).toBe('costa');
    expect(sceneAt(10100).id).toBe('afueras');
  });
});

/**
 * Piloto prudente: va al carril con más espacio libre por delante (sin meterse
 * junto a un coche) y frena si no puede esquivar. Si sobrevive kilómetros con
 * varias semillas, el tráfico siempre deja un hueco alcanzable.
 */
function autopilot(state, goal, { maxTime = 600, aggressive = false } = {}) {
  const gapIn = (lane) => {
    const ahead = state.traffic.filter((v) => v.lane === lane && v.z + v.length / 2 > state.bike.z - BIKE.length);
    return ahead.length ? Math.min(...ahead.map((v) => v.z - v.length / 2 - state.bike.z)) : Infinity;
  };
  const sideBlocked = (lane) => state.traffic.some((v) => v.lane === lane && Math.abs(v.z - state.bike.z) < v.length / 2 + 4);
  let target = Math.round((state.bike.x + ROAD_HALF) / LANE_W - 0.5);
  while (state.status === 'riding' && state.time < maxTime && !goal(state)) {
    const current = Math.max(0, Math.min(LANES - 1, Math.round((state.bike.x + ROAD_HALF) / LANE_W - 0.5)));
    if (Math.abs(state.bike.x - laneX(target)) < 0.4) {
      let best = current;
      for (const lane of [current - 1, current + 1]) {
        if (lane < 0 || lane >= LANES || sideBlocked(lane)) continue;
        if (gapIn(lane) > gapIn(best) + 8) best = lane;
      }
      target = best;
    }
    const dx = laneX(target) - state.bike.x;
    const steer = Math.abs(dx) < 0.15 ? 0 : Math.max(-1, Math.min(1, dx * 1.2));
    const gap = Math.min(gapIn(current), gapIn(target));
    const brakeDistance = state.bike.speed ** 2 / (2 * PHYSICS.brake) + 12;
    const throttle = gap < brakeDistance ? -1 : aggressive || state.bike.speed < 45 ? 1 : 0.4;
    step(state, { throttle, steer }, DT);
  }
  return state;
}

describe('carreras posibles', () => {
  it('un piloto prudente recorre 6 km sin chocar con varias semillas', { timeout: 120_000 }, () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const state = autopilot(createRide(seed), (s) => s.bike.z >= 6000);
      expect({ seed, status: state.status, z: Math.round(state.bike.z) }).toMatchObject({ seed, status: 'riding' });
    }
  });

  it.each(MISSIONS.map((m) => [m.name, m]))('la misión «%s» se puede cumplir', { timeout: 60_000 }, (_, mission) => {
    const results = [1, 2, 3].map((seed) => {
      const state = autopilot(createRide(seed), (s) => missionProgress(mission, s).done || missionProgress(mission, s).failed, {
        aggressive: mission.type !== 'distance',
      });
      return missionProgress(mission, state).done;
    });
    expect(results.filter(Boolean).length).toBeGreaterThanOrEqual(2);
  });
});
