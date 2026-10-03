import { describe, expect, it } from 'vitest';
import * as orbit from '../engine/orbitEngine.js';
import * as territory from '../engine/territoryEngine.js';
import * as decoy from '../engine/decoyEngine.js';

const DT = 1 / 60;

describe('Órbita (recolectar y crecer)', () => {
  it('el jugador se mueve con la entrada y no sale de la arena', () => {
    const state = orbit.createOrbit(1);
    for (const bot of state.bots) Object.assign(bot, { alive: false, respawnIn: 999 });
    orbit.stepOrbit(state, { x: 1, y: 0 }, 0.5);
    expect(state.player.x).toBeGreaterThan(50);
    for (let i = 0; i < 600; i += 1) orbit.stepOrbit(state, { x: 1, y: 0 }, DT);
    expect(Math.hypot(state.player.x, state.player.y)).toBeLessThanOrEqual(orbit.ARENA_RADIUS);
  });

  it('recoger una partícula aumenta la masa', () => {
    const state = orbit.createOrbit(2);
    state.pellets[0].x = state.player.x + 2;
    state.pellets[0].y = state.player.y;
    const before = state.player.mass;
    const events = orbit.stepOrbit(state, {}, DT);
    expect(events.some((e) => e.type === 'pellet')).toBe(true);
    expect(state.player.mass).toBeGreaterThan(before);
  });

  it('una entidad bastante más grande absorbe a la pequeña (y no al revés)', () => {
    const state = orbit.createOrbit(3);
    const bot = state.bots[0];
    Object.assign(bot, { x: state.player.x + 1, y: state.player.y, mass: 5 });
    const events = orbit.stepOrbit(state, {}, DT);
    expect(events.some((e) => e.type === 'absorb')).toBe(true);
    expect(bot.alive).toBe(false);

    // Masas parecidas: nadie absorbe a nadie.
    const even = orbit.createOrbit(4);
    Object.assign(even.bots[0], { x: even.player.x + 1, y: even.player.y, mass: even.player.mass * 1.1 });
    orbit.stepOrbit(even, {}, DT);
    expect(even.player.alive).toBe(true);
    expect(even.bots[0].alive).toBe(true);
  });

  it('los bots absorbidos reaparecen al cabo de un momento', () => {
    const state = orbit.createOrbit(5);
    const bot = state.bots[0];
    Object.assign(bot, { x: state.player.x + 1, y: state.player.y, mass: 5 });
    orbit.stepOrbit(state, {}, DT);
    for (let i = 0; i < 60 * 3; i += 1) orbit.stepOrbit(state, {}, DT);
    expect(bot.alive).toBe(true);
  });

  it('ser absorbido termina la partida', () => {
    const state = orbit.createOrbit(6);
    Object.assign(state.bots[7], { x: state.player.x, y: state.player.y, mass: 200 });
    const events = orbit.stepOrbit(state, {}, DT);
    expect(events.some((e) => e.type === 'absorbed')).toBe(true);
    expect(state).toMatchObject({ over: true, result: 'absorbed' });
  });

  it('alcanzar la masa objetivo es la victoria; agotar el tiempo termina la partida', () => {
    const win = orbit.createOrbit(7);
    win.player.mass = orbit.TARGET_MASS;
    expect(orbit.stepOrbit(win, {}, DT).some((e) => e.type === 'win')).toBe(true);

    const timeout = orbit.createOrbit(8);
    timeout.time = orbit.TIME_LIMIT;
    orbit.stepOrbit(timeout, {}, DT);
    expect(timeout.result).toBe('timeout');
  });

  it('IA: huye de quien puede absorberla, persigue presas y si no recolecta', () => {
    const state = orbit.createOrbit(9);
    const bot = state.bots[3];
    state.bots.forEach((b) => b !== bot && (b.alive = false));
    Object.assign(bot, { x: 0, y: 0, mass: 20 });
    Object.assign(state.player, { x: 60, y: 0, mass: 80 });
    expect(orbit.decide(state, bot).type).toBe('flee');
    Object.assign(state.player, { mass: 5 });
    expect(orbit.decide(state, bot)).toMatchObject({ type: 'chase', target: state.player });
    Object.assign(state.player, { x: 1000, y: 0, mass: 20 });
    expect(orbit.decide(state, bot).type).toBe('collect');
  });

  it('los rivales son bots del juego, identificados como tales', () => {
    const state = orbit.createOrbit(10);
    expect(state.bots.every((b) => b.isBot && b.name.startsWith('Bot'))).toBe(true);
    expect(orbit.leaderboard(state).some((e) => e.name === 'Tú')).toBe(true);
  });
});

describe('Territorio (control del espacio)', () => {
  const T = territory.TICK;
  const tick = (state, n = 1) => {
    const events = [];
    for (let i = 0; i < n; i += 1) events.push(...territory.stepTerritory(state, T));
    return events;
  };
  /** Mapa sin bots para aislar las reglas. */
  const solo = (seed = 1) => {
    const state = territory.createTerritory(seed);
    for (const bot of state.actors.slice(1)) {
      bot.alive = false;
      bot.respawnIn = 1e9;
      for (let i = 0; i < state.owner.length; i += 1) if (state.owner[i] === bot.id) state.owner[i] = 0;
    }
    return state;
  };

  it('avanza una celda por paso y deja rastro fuera de su territorio', () => {
    const state = solo();
    const player = territory.playerOf(state);
    const start = { x: player.x, y: player.y };
    tick(state, 4); // sale de su casa de 5×5 por arriba
    expect(player.y).toBe(start.y - 4);
    expect(player.trailLength).toBe(2);
  });

  it('al volver a casa, el rastro y lo encerrado pasan a ser suyos', () => {
    const state = solo();
    const before = territory.shareOf(state, territory.PLAYER_ID);
    // Casa: 5×5 alrededor de (31, 31). Sale 3 celdas por arriba, 2 a la izquierda y vuelve bajando.
    tick(state, 5);
    territory.steer(state, 'left');
    tick(state, 2);
    territory.steer(state, 'down');
    const events = tick(state, 4);
    expect(events.some((e) => e.type === 'capture' && e.gained > 0)).toBe(true);
    expect(territory.shareOf(state, territory.PLAYER_ID)).toBeGreaterThan(before);
    expect(territory.playerOf(state).trailLength).toBe(0);
  });

  it('no permite dar media vuelta', () => {
    const state = solo();
    expect(territory.steer(state, 'down')).toBe(false);
    expect(territory.steer(state, 'left')).toBe(true);
  });

  it('pisar el propio rastro elimina al jugador', () => {
    const state = solo();
    tick(state, 5);
    territory.steer(state, 'left');
    tick(state, 1);
    territory.steer(state, 'down');
    tick(state, 1);
    territory.steer(state, 'right');
    tick(state, 2);
    expect(state).toMatchObject({ over: true, result: 'eliminated' });
  });

  it('salir del mapa elimina', () => {
    const state = solo();
    territory.steer(state, 'right');
    tick(state, 20);
    expect(state.result).toBe('eliminated');
  });

  it('cruzar el rastro de un bot lo elimina', () => {
    const state = territory.createTerritory(2);
    const player = territory.playerOf(state);
    const bot = state.actors[1];
    // Rastro artificial del bot justo delante del jugador.
    const ahead = (player.y - 1) * territory.SIZE + player.x;
    state.trail[ahead] = bot.id;
    bot.trailLength = 1;
    const events = tick(state, 1);
    expect(events.some((e) => e.type === 'cut')).toBe(true);
    expect(bot.alive).toBe(false);
    expect(state.cuts).toBe(1);
  });

  it('dominar el porcentaje objetivo da la victoria; el tiempo agotado termina', () => {
    const state = solo();
    for (let i = 0; i < state.owner.length * territory.WIN_SHARE; i += 1) state.owner[i] = territory.PLAYER_ID;
    const player = territory.playerOf(state);
    state.owner[(player.y - 1) * territory.SIZE + player.x] = territory.PLAYER_ID;
    tick(state, 1);
    expect(state.result).toBe('win');

    const late = solo(3);
    late.time = territory.TIME_LIMIT;
    tick(late, 1);
    expect(late.result).toBe('timeout');
  });

  it('IA: los bots amplían su territorio sin suicidarse', () => {
    const state = territory.createTerritory(4);
    const player = territory.playerOf(state);
    // El jugador da vueltas dentro de su casa (cuadrado de 3×3 alrededor del centro).
    const loop = ['up', 'up', 'left', 'left', 'down', 'down', 'right', 'right'];
    territory.steer(state, 'left');
    const deaths = [];
    for (let i = 0; i < 400; i += 1) {
      territory.steer(state, loop[i % loop.length]);
      deaths.push(...territory.stepTerritory(state, territory.TICK).filter((e) => e.type === 'eliminated'));
      if (state.over) break;
    }
    expect(player.alive).toBe(true);
    expect(deaths.filter((e) => e.cause === 'self' || e.cause === 'wall')).toEqual([]);
    const bots = state.actors.slice(1).map((b) => territory.shareOf(state, b.id));
    expect(Math.max(...bots)).toBeGreaterThan(25 / territory.SIZE ** 2);
  });
});

describe('Señuelo (supervivencia)', () => {
  it('el jugador se mueve y no sale de la arena', () => {
    const state = decoy.createDecoy(1);
    for (let i = 0; i < 300; i += 1) decoy.stepDecoy(state, { x: 0, y: -1 }, DT);
    expect(Math.hypot(state.player.x, state.player.y)).toBeLessThanOrEqual(decoy.ARENA_RADIUS);
  });

  it('cada dron se anuncia antes de aparecer y lejos del jugador', () => {
    const state = decoy.createDecoy(2);
    const events = [];
    for (let i = 0; i < 60 * 2; i += 1) events.push(...decoy.stepDecoy(state, {}, DT));
    expect(events.some((e) => e.type === 'warning')).toBe(true);
    for (let seed = 1; seed < 30; seed += 1) {
      const s = decoy.createDecoy(seed);
      s.player.x = 300;
      expect(Math.hypot(decoy.spawnPosition(s).x - 300, decoy.spawnPosition(s).y)).toBeGreaterThanOrEqual(decoy.SAFE_SPAWN_DISTANCE);
    }
  });

  it('los drones persiguen al jugador', () => {
    const state = decoy.createDecoy(3);
    state.nextSpawn = 999;
    state.drones.push({ x: -300, y: 0, heading: Math.PI / 2, alive: true });
    const before = Math.hypot(state.drones[0].x, state.drones[0].y);
    for (let i = 0; i < 60; i += 1) decoy.stepDecoy(state, {}, DT);
    expect(Math.hypot(state.drones[0].x, state.drones[0].y)).toBeLessThan(before);
  });

  it('dos drones que chocan se desintegran', () => {
    const state = decoy.createDecoy(4);
    state.nextSpawn = 999;
    state.player.x = 400;
    state.drones.push({ x: 0, y: 0, heading: 0, alive: true }, { x: 5, y: 0, heading: Math.PI, alive: true });
    const events = decoy.stepDecoy(state, {}, DT);
    expect(events.some((e) => e.type === 'pop')).toBe(true);
    expect(state.drones).toHaveLength(0);
    expect(state.popped).toBe(2);
  });

  it('tocar un dron termina la partida; sobrevivir el tiempo es la victoria', () => {
    const caught = decoy.createDecoy(5);
    caught.drones.push({ x: caught.player.x + 5, y: 0, heading: 0, alive: true });
    decoy.stepDecoy(caught, {}, DT);
    expect(caught.result).toBe('caught');

    const win = decoy.createDecoy(6);
    win.time = decoy.SURVIVE_TIME;
    decoy.stepDecoy(win, {}, DT);
    expect(win.result).toBe('win');
  });

  it('recoger chispas suma puntos', () => {
    const state = decoy.createDecoy(7);
    state.sparks[0].x = state.player.x;
    state.sparks[0].y = state.player.y;
    const before = decoy.scoreOf(state);
    decoy.stepDecoy(state, {}, DT);
    expect(state.collected).toBe(1);
    expect(decoy.scoreOf(state)).toBeGreaterThan(before);
  });

  it('la dificultad aumenta con el tiempo sin superar al jugador', () => {
    expect(decoy.spawnInterval(60)).toBeLessThan(decoy.spawnInterval(0));
    expect(decoy.droneSpeed(80)).toBeGreaterThan(decoy.droneSpeed(0));
    expect(decoy.droneSpeed(1000)).toBeLessThan(decoy.PLAYER_SPEED);
  });
});
