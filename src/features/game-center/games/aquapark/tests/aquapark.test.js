import { describe, expect, it } from 'vitest';
import { CIRCUITS, findCircuit } from '../engine/circuits.js';
import {
  CENTRIFUGAL,
  FLOAT_HALF,
  MAX_SPEED,
  PLAYER_HALF,
  SEGMENT_LENGTH,
  STEER_SPEED,
  createRace,
  positionOf,
  progressOf,
  raceTimeMs,
  safeLane,
  segmentAt,
  stepRace,
} from '../engine/aquaparkEngine.js';

const DT = 1 / 60;

/** Piloto automático: busca un carril libre y compensa la curva. */
function autopilot(race) {
  const { player, track } = race;
  const seg = segmentAt(track, player.z);
  const ratio = Math.min(1.15, player.speed / MAX_SPEED);
  const lane = safeLane(track, player.z, 0, 12);
  const counter = (seg.curve * CENTRIFUGAL * ratio * ratio) / STEER_SPEED;
  return { steer: Math.max(-1, Math.min(1, (lane - player.x) * 5 + counter)) };
}

function run(race, pilot, maxSeconds = 240) {
  const events = [];
  for (let t = 0; t < maxSeconds && !race.finished; t += DT) events.push(...stepRace(race, pilot(race), DT));
  return events;
}

describe('Aquapark: circuitos', () => {
  it('hay tres circuitos con dificultad creciente', () => {
    expect(CIRCUITS.map((c) => c.difficulty)).toEqual(['Fácil', 'Media', 'Difícil']);
    expect(findCircuit('cascada').name).toBe('Cascada Coral');
  });

  for (const circuit of CIRCUITS) {
    it(`«${circuit.name}» se puede completar sin chocar ni caer`, () => {
      const race = createRace(circuit);
      const events = run(race, autopilot);
      expect(race.finished).toBe(true);
      expect(events.filter((e) => e.type === 'fall')).toHaveLength(0);
      expect(events.filter((e) => e.type === 'hit')).toHaveLength(0);
      expect(raceTimeMs(race)).toBeGreaterThan(20_000);
      expect(raceTimeMs(race)).toBeLessThan(120_000);
    });

    it(`«${circuit.name}»: cada fila de flotadores deja hueco para pasar`, () => {
      for (const seg of createRace(circuit).track.segments) {
        const floats = seg.items.filter((i) => i.type === 'float').map((i) => i.x);
        if (!floats.length) continue;
        const free = [];
        for (let x = -seg.width + PLAYER_HALF; x <= seg.width - PLAYER_HALF; x += 0.01) {
          if (floats.every((f) => Math.abs(f - x) >= FLOAT_HALF + PLAYER_HALF)) free.push(x);
        }
        expect(free.length).toBeGreaterThan(5);
      }
    });
  }
});

describe('Aquapark: mecánicas', () => {
  const circuit = CIRCUITS[0];

  it('acelera y avanza; el cronómetro corre', () => {
    const race = createRace(circuit);
    for (let i = 0; i < 120; i += 1) stepRace(race, {}, DT);
    expect(race.player.speed).toBeGreaterThan(15);
    // Parte de cero: ~18 m en 2 s con 9 m/s² de aceleración.
    expect(race.player.z).toBeGreaterThan(race.track.startZ + 15);
    expect(raceTimeMs(race)).toBeCloseTo(2000, -2);
    expect(progressOf(race)).toBeGreaterThan(0);
  });

  it('se mueve lateralmente con la dirección', () => {
    const race = createRace(circuit);
    for (let i = 0; i < 20; i += 1) stepRace(race, { right: true }, DT);
    expect(race.player.x).toBeGreaterThan(0.2);
    for (let i = 0; i < 40; i += 1) stepRace(race, { left: true }, DT);
    expect(race.player.x).toBeLessThan(0);
  });

  it('la pared detiene al jugador en el borde', () => {
    const race = createRace(circuit);
    const events = [];
    for (let i = 0; i < 120; i += 1) events.push(...stepRace(race, { right: true }, DT));
    expect(race.player.x).toBeLessThanOrEqual(1 - PLAYER_HALF + 1e-9);
    expect(events.some((e) => e.type === 'scrape')).toBe(true);
  });

  it('chocar con un flotador frena', () => {
    const race = createRace(circuit);
    const target = race.track.segments.find((s) => s.items.some((i) => i.type === 'float'));
    const float = target.items.find((i) => i.type === 'float');
    race.player.z = target.z - SEGMENT_LENGTH * 2;
    race.player.x = float.x;
    race.player.speed = MAX_SPEED;
    const events = [];
    for (let i = 0; i < 30; i += 1) events.push(...stepRace(race, { steer: 0 }, DT));
    expect(events.some((e) => e.type === 'hit')).toBe(true);
    expect(race.stats.hits).toBe(1);
  });

  it('salirse en un tramo sin paredes es caer al agua y volver al último punto de control', () => {
    const race = createRace(findCircuit('cascada'));
    const open = race.track.segments.find((s) => !s.walls);
    race.player.z = open.z + 1;
    race.player.checkpointZ = open.z;
    race.player.speed = MAX_SPEED;
    const events = [];
    for (let i = 0; i < 60 && !events.some((e) => e.type === 'fall'); i += 1) events.push(...stepRace(race, { right: true }, DT));
    expect(events.some((e) => e.type === 'fall')).toBe(true);
    for (let i = 0; i < 120 && !events.some((e) => e.type === 'respawn'); i += 1) events.push(...stepRace(race, {}, DT));
    expect(events.some((e) => e.type === 'respawn')).toBe(true);
    expect(race.player.z).toBe(open.z);
    expect(race.player.x).toBe(0);
  });

  it('una rampa hace saltar por encima de los flotadores', () => {
    const race = createRace(circuit);
    const ramp = race.track.segments.find((s) => s.items.some((i) => i.type === 'ramp'));
    race.player.z = ramp.z - 1;
    race.player.speed = MAX_SPEED;
    const events = run({ ...race, finished: false }, () => ({}), 0.2);
    expect(events.some((e) => e.type === 'jump')).toBe(true);
  });

  it('detecta la meta y registra el tiempo; los rivales son del juego y ordenan la posición', () => {
    const race = createRace(circuit);
    run(race, autopilot);
    expect(race.player.finishedAt).not.toBeNull();
    expect(race.rivals.every((r) => r.name.startsWith('Bot'))).toBe(true);
    expect(positionOf(race)).toBeGreaterThanOrEqual(1);
    expect(positionOf(race)).toBeLessThanOrEqual(4);
    // Un pilotaje limpio gana al rival más rápido del circuito fácil.
    expect(positionOf(race)).toBe(1);
    expect(stepRace(race, { right: true }, DT)).toEqual([]);
  });

  it('reiniciar crea una carrera nueva desde la salida', () => {
    const race = createRace(circuit);
    run(race, autopilot, 5);
    const fresh = createRace(circuit);
    expect(fresh.player.z).toBe(fresh.track.startZ);
    expect(fresh.time).toBe(0);
    expect(fresh.track.segments.flatMap((s) => s.items).every((i) => !i.hit)).toBe(true);
  });
});
