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
  GRID_BACK,
  heightAt,
  positionOf,
  standings,
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
  it('hay seis circuitos con dificultad creciente y recorridos distintos', () => {
    expect(CIRCUITS.map((c) => c.difficulty)).toEqual(['Fácil', 'Media', 'Difícil', 'Difícil', 'Muy difícil', 'Experto']);
    expect(findCircuit('cascada').name).toBe('Cascada Coral');
    // No son copias con otros colores: cada uno tiene su propia secuencia de tramos.
    const shapes = CIRCUITS.map((c) => c.sections.map((sec) => `${sec.len}:${sec.curve ?? 0}:${sec.width ?? 1}:${sec.walls ?? true}`).join('|'));
    expect(new Set(shapes).size).toBe(6);
    for (const c of CIRCUITS) expect(c.sections.flatMap((sec) => sec.items ?? []).some((i) => i.type === 'float')).toBe(true);
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
    expect(race.player.z).toBeGreaterThan(race.track.startZ - GRID_BACK + 15);
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
    expect(race.rivals.map((r) => r.name)).toEqual(['Bot Pro', 'Bot Regular', 'Bot Fácil']);
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
    expect(fresh.player.z).toBe(fresh.track.startZ - GRID_BACK);
    expect(fresh.time).toBe(0);
    expect(fresh.track.segments.flatMap((s) => s.items).every((i) => !i.hit)).toBe(true);
  });
});

describe('Aquapark: competidores y equilibrio', () => {
  it('cuatro corredores: el jugador sale detrás, todos separados y sin solaparse', () => {
    const race = createRace(CIRCUITS[0]);
    for (const rival of race.rivals) expect(rival.z).toBeGreaterThan(race.player.z);
    const racers = [race.player, ...race.rivals];
    for (let i = 0; i < racers.length; i += 1) {
      for (let j = i + 1; j < racers.length; j += 1) {
        const apart = Math.abs(racers[i].z - racers[j].z) > 2 || Math.abs(racers[i].x - racers[j].x) > PLAYER_HALF * 4;
        expect(apart).toBe(true);
      }
    }
  });

  for (const circuit of CIRCUITS) {
    it(`«${circuit.name}»: los bots terminan en orden Pro → Regular → Fácil y no siguen al jugador`, () => {
      const race = createRace(circuit);
      // Jugador quieto: los bots corren por su cuenta.
      for (let t = 0; t < 200 && race.rivals.some((r) => r.finishedAt === null); t += DT) stepRace(race, { steer: 0 }, DT);
      const [pro, regular, easy] = race.rivals;
      expect(pro.finishedAt).not.toBeNull();
      expect(easy.finishedAt).not.toBeNull();
      expect(pro.finishedAt).toBeLessThan(regular.finishedAt);
      expect(regular.finishedAt).toBeLessThan(easy.finishedAt);
    });
  }

  it('el jugador no es mucho más rápido que el Bot Pro: un recorrido limpio gana por poco en los difíciles', () => {
    for (const circuit of CIRCUITS.slice(2)) {
      const race = createRace(circuit);
      run(race, autopilot);
      const pro = race.rivals[0];
      for (let t = 0; t < 60 && pro.finishedAt === null; t += DT) stepRace(race, {}, DT);
      const margin = (pro.finishedAt - race.player.finishedAt) / race.player.finishedAt;
      // Gana quien pilota bien, pero con menos de un 8 % de ventaja: hay carrera.
      expect(margin).toBeLessThan(0.08);
    }
  });

  it('pilotar mal (contra la pared todo el rato) pierde contra el Bot Pro', () => {
    const race = createRace(CIRCUITS[0]);
    run(race, () => ({ right: true }));
    expect(standings(race)[0].id).not.toBe('player');
  });

  it('tras la meta el flotador se desliza hasta detenerse, sin saltos ni retrocesos', () => {
    const race = createRace(CIRCUITS[0]);
    run(race, autopilot);
    let last = race.player.z;
    for (let i = 0; i < 180; i += 1) {
      expect(stepRace(race, {}, DT)).toEqual([]);
      expect(race.player.z).toBeGreaterThanOrEqual(last);
      last = race.player.z;
    }
    expect(race.player.speed).toBe(0);
  });

  it('al estrecharse el canal la pared empuja hacia dentro de forma continua (sin rebote)', () => {
    const race = createRace(findCircuit('glaciar'));
    const narrow = race.track.segments.find((s) => s.width < 0.7 && s.walls);
    race.player.z = narrow.z - 2;
    race.player.x = 0.85;
    race.player.speed = MAX_SPEED;
    let previous = race.player.x;
    for (let i = 0; i < 30; i += 1) {
      stepRace(race, { steer: 0 }, DT);
      expect(Math.abs(race.player.x - previous)).toBeLessThan(0.06);
      previous = race.player.x;
    }
  });

  it('la altura del tobogán es continua (la cámara no salta entre segmentos)', () => {
    const { track } = createRace(CIRCUITS[0]);
    for (let z = 0; z < 400; z += 0.5) expect(Math.abs(heightAt(track, z + 0.5) - heightAt(track, z))).toBeLessThan(0.2);
  });
});
