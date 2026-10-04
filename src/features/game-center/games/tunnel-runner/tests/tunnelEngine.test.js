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
  OBSTACLE_TYPES,
  ZONE_LENGTH,
  obstacleZ,
  zoneAt,
} from '../engine/tunnelEngine.js';
import { lookAt } from '../engine/tunnelRenderer.js';
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

describe('variedad de obstáculos y tramos visuales', () => {
  const series = (seed, meters) => {
    const state = createTunnel(seed);
    while (state.rings.at(-1).z < meters) state.rings.push(nextRing(state));
    return state.rings;
  };

  it('aparecen las seis combinaciones de tamaño y velocidad, además de los anillos', () => {
    const seen = new Set();
    for (let seed = 1; seed <= 10; seed += 1) for (const o of series(seed, 6000)) seen.add(o.kind === 'ring' ? 'ring' : o.type);
    for (const type of OBSTACLE_TYPES) expect(seen.has(type.id)).toBe(true);
    expect(seen.has('ring')).toBe(true);
  });

  it('cada obstáculo tiene tamaño, velocidad, posición, colisión y dificultad dentro del presupuesto', () => {
    for (const o of series(3, 6000)) {
      expect(['small', 'medium', 'large', 'ring']).toContain(o.size);
      expect(o.approach).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(o.center)).toBe(true);
      expect(o.blocked.filter(Boolean).length).toBeGreaterThan(0);
      expect(collides(o, o.center)).toBe(false);
      const type = OBSTACLE_TYPES.find((t) => t.id === o.type);
      if (type) expect(o.z).toBeGreaterThanOrEqual(type.from);
    }
  });

  it('los rápidos se acercan más deprisa pero llegan exactamente a su punto de encuentro', () => {
    const fast = series(5, 6000).find((o) => o.approach > 0);
    expect(fast).toBeTruthy();
    expect(obstacleZ(fast, fast.z - 100)).toBeGreaterThan(fast.z);
    expect(obstacleZ(fast, fast.z)).toBe(fast.z);
  });

  it('nunca hay dos obstáculos rápidos seguidos (siempre se ve venir el siguiente)', () => {
    for (let seed = 1; seed <= 10; seed += 1) {
      const list = series(seed, 6000);
      for (let i = 1; i < list.length; i += 1) expect(list[i].approach > 0 && list[i - 1].approach > 0).toBe(false);
    }
  });

  it('el autopiloto sobrevive 6 km con todos los tipos (secuencias posibles)', () => {
    for (let seed = 1; seed <= 8; seed += 1) {
      const state = createTunnel(seed);
      while (state.distance < 6000) {
        step(state, autopilot(state), DT);
        if (!state.alive) throw new Error(`Semilla ${seed}: choque en ${Math.round(state.distance)} m`);
      }
    }
  });

  it('cada 1000 m cambia de tramo con un fundido gradual y sin cambiar la dificultad de golpe', () => {
    expect(zoneAt(999)).toBe(0);
    expect(zoneAt(1000)).toBe(1);
    const state = createTunnel(9);
    const events = [];
    while (state.distance < 1050 && state.alive) events.push(...step(state, autopilot(state), DT));
    expect(events.some((e) => e.type === 'zone' && e.zone === 1)).toBe(true);
    const before = lookAt(ZONE_LENGTH - 81);
    const mid = lookAt(ZONE_LENGTH - 40);
    const after = lookAt(ZONE_LENGTH + 1);
    expect(before.t).toBe(0);
    expect(mid.t).toBeGreaterThan(0.4);
    expect(mid.t).toBeLessThan(0.6);
    expect(after.zone.id).not.toBe(before.zone.id);
    expect(speedAt(1001) - speedAt(999)).toBeLessThan(0.1);
  });
});
