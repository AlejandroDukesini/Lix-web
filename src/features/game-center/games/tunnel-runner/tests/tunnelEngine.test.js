import { describe, expect, it } from 'vitest';
import {
  MIN_GAP,
  PLAYER_ARC,
  REACH_MARGIN,
  SIDES,
  SIDE_ARC,
  angularDistance,
  collides,
  createRing,
  createTunnel,
  nextRing,
  reachBetween,
  scoreOf,
  sectorAt,
  spacingAt,
  speedAt,
  step,
} from '../engine/tunnelEngine.js';
import { createRng } from '../../../services/gameLifecycle.js';

const DT = 1 / 60;

/** Piloto automático: apunta siempre al centro del hueco del próximo anillo. */
function autopilot(state) {
  const ring = state.rings.find((r) => !r.passed && r.z > state.distance);
  if (!ring) return {};
  let diff = ring.center - state.angle;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  if (Math.abs(diff) < 0.02) return {};
  return diff > 0 ? { right: true } : { left: true };
}

describe('movimiento', () => {
  it('gira a izquierda y derecha con algo de inercia', () => {
    const state = createTunnel(1);
    step(state, { right: true }, DT);
    expect(state.omega).toBeGreaterThan(0);
    for (let i = 0; i < 30; i += 1) step(state, { right: true }, DT);
    const right = state.angle;
    expect(right).toBeGreaterThan(0.5);
    for (let i = 0; i < 60; i += 1) step(state, { left: true }, DT);
    expect(angularDistance(state.angle, right)).toBeGreaterThan(0.5);
  });

  it('avanza y suma distancia (puntuación)', () => {
    const state = createTunnel(2);
    for (let i = 0; i < 60; i += 1) step(state, autopilot(state), DT);
    expect(scoreOf(state)).toBeGreaterThanOrEqual(23);
    expect(scoreOf(state)).toBeLessThanOrEqual(26);
  });
});

describe('colisiones', () => {
  it('choca con una cara bloqueada y pasa por una libre', () => {
    const ring = createRing({ z: 10, center: Math.PI, gap: 2, pattern: 'gate', spin: 0, rng: createRng(1) });
    expect(collides(ring, 0)).toBe(true);
    expect(collides(ring, ring.center)).toBe(false);
  });

  it('el borde de la nave también cuenta', () => {
    const ring = createRing({ z: 10, center: Math.PI, gap: 2, pattern: 'gate', spin: 0, rng: createRng(1) });
    const edge = ring.center + SIDE_ARC - PLAYER_ARC / 4;
    expect(collides(ring, edge)).toBe(true);
  });

  it('al chocar termina la partida', () => {
    const state = createTunnel(3);
    const events = [];
    // Sin girar, tarde o temprano un anillo bloquea la posición.
    for (let i = 0; i < 60 * 60 && state.alive; i += 1) events.push(...step(state, {}, DT));
    expect(state.alive).toBe(false);
    expect(events.at(-1).type).toBe('crash');
    expect(step(state, { right: true }, DT)).toEqual([]);
  });
});

describe('generación de obstáculos', () => {
  /** Serie completa de anillos hasta `meters`: el generador no depende de lo que haga la nave. */
  const series = (seed, meters) => {
    const state = createTunnel(seed);
    while (state.rings.at(-1).z < meters) state.rings.push(nextRing(state));
    return state.rings;
  };

  it('cada anillo deja un hueco de al menos dos caras contiguas', () => {
    for (const ring of series(4, 5000)) {
      expect(ring.gapSides.length).toBeGreaterThanOrEqual(MIN_GAP);
      for (const side of ring.gapSides) expect(ring.blocked[side]).toBe(false);
      expect(ring.blocked.filter(Boolean).length).toBeLessThan(SIDES);
    }
  });

  it('el hueco siguiente siempre es alcanzable a tiempo (20 semillas × 3 km)', () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const state = createTunnel(seed);
      while (state.distance < 3000) {
        step(state, autopilot(state), DT);
        if (!state.alive) throw new Error(`Semilla ${seed}: choque inevitable en ${Math.round(state.distance)} m`);
      }
      const rings = series(seed, 5000);
      for (let i = 1; i < rings.length; i += 1) {
        const reach = reachBetween(rings[i - 1].z, rings[i].z - rings[i - 1].z);
        expect(angularDistance(rings[i].center, rings[i - 1].center)).toBeLessThanOrEqual(reach * REACH_MARGIN + SIDE_ARC / 2 + 1e-9);
      }
    }
  });

  it('la dificultad sube: más velocidad, anillos más juntos, huecos más estrechos', () => {
    expect(speedAt(2000)).toBeGreaterThan(speedAt(0));
    expect(spacingAt(2000)).toBeLessThan(spacingAt(0));
    const early = createTunnel(7).rings.slice(0, 3);
    expect(Math.min(...early.map((r) => r.gapSides.length))).toBeGreaterThanOrEqual(5);
    expect(sectorAt(1000)).toBe(2);
  });

  it('es reproducible con la misma semilla', () => {
    const a = createTunnel(42);
    const b = createTunnel(42);
    expect(a.rings.map((r) => r.blocked.join())).toEqual(b.rings.map((r) => r.blocked.join()));
  });

  it('reiniciar crea un túnel nuevo desde cero', () => {
    const state = createTunnel(5);
    for (let i = 0; i < 200; i += 1) step(state, autopilot(state), DT);
    const fresh = createTunnel(6);
    expect(fresh.distance).toBe(0);
    expect(fresh.alive).toBe(true);
    expect(fresh.passed).toBe(0);
  });
});
