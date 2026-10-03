/**
 * Motor de Aquapark: construcción del recorrido, física del deslizamiento,
 * colisiones, caídas al agua, meta y rivales controlados por el juego.
 *
 * Coordenadas: `z` en metros a lo largo del tobogán; `x` lateral normalizado
 * (0 = centro, ±width = borde del canal). Todo es determinista: con la misma
 * entrada, el mismo resultado (las pruebas lo aprovechan).
 */

export const SEGMENT_LENGTH = 4; // metros
export const MAX_SPEED = 32; // m/s
export const ACCEL = 9;
export const BOOST_FACTOR = 1.38;
export const BOOST_TIME = 1.8;
export const STEER_SPEED = 1.55; // anchos de canal por segundo
export const CENTRIFUGAL = 1.05;
export const PLAYER_HALF = 0.12;
export const FLOAT_HALF = 0.18;
export const AIR_TIME = 0.85;
export const FALL_TIME = 1.5;
export const RESPAWN_SPEED = 0.45;
export const START_RUN = 12; // segmentos rectos antes de la salida (para el escenario)

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/** Convierte la definición de un circuito en segmentos. */
export function buildTrack(circuit) {
  const segments = [];
  const push = (data) => segments.push({ index: segments.length, z: segments.length * SEGMENT_LENGTH, ...data });
  for (let i = 0; i < START_RUN; i += 1) push({ curve: 0, drop: 0, width: 1, walls: true, items: [], section: -1 });

  circuit.sections.forEach((section, sectionIndex) => {
    const { len, curve = 0, drop = 0, width = 1, walls = true, items = [] } = section;
    const start = segments.length;
    for (let i = 0; i < len; i += 1) {
      const t = i / len;
      // Curvatura: entra en el primer cuarto, se mantiene y sale en el último cuarto.
      const strength = t < 0.25 ? ease(t / 0.25) : t > 0.75 ? ease((1 - t) / 0.25) : 1;
      push({ curve: curve * strength, drop, width, walls, items: [], section: sectionIndex, checkpoint: i === 0 });
    }
    for (const item of items) {
      const seg = segments[start + Math.min(item.at, len - 1)];
      seg.items.push({ ...item, hit: false });
    }
  });

  const finishIndex = segments.length;
  // Tramo final tras la meta: la piscina de llegada.
  for (let i = 0; i < 30; i += 1) push({ curve: 0, drop: 0, width: 1.2, walls: true, items: [], section: -2 });

  // Altura acumulada (solo para dibujar el descenso).
  let y = 0;
  for (const seg of segments) {
    seg.y = y;
    y -= 0.35 + seg.drop * 0.5;
  }
  return { segments, finishZ: finishIndex * SEGMENT_LENGTH, startZ: START_RUN * SEGMENT_LENGTH, circuit };
}

export const segmentAt = (track, z) =>
  track.segments[Math.max(0, Math.min(track.segments.length - 1, Math.floor(z / SEGMENT_LENGTH)))];

/** Carril libre de flotadores más cercano a `preferred` en los próximos segmentos (para la IA y el piloto de pruebas). */
export function safeLane(track, z, preferred = 0, lookahead = 10) {
  const first = Math.floor(z / SEGMENT_LENGTH);
  const blockers = [];
  let width = 1;
  for (let i = 1; i <= lookahead; i += 1) {
    const seg = track.segments[first + i];
    if (!seg) break;
    width = Math.min(width, seg.width);
    for (const item of seg.items) if (item.type === 'float') blockers.push(item.x);
  }
  const limit = width - PLAYER_HALF - 0.08;
  const clear = (x) => blockers.every((b) => Math.abs(b - x) > FLOAT_HALF + PLAYER_HALF + 0.06);
  let best = null;
  for (let x = -limit; x <= limit + 1e-9; x += 0.05) {
    if (!clear(x)) continue;
    if (best === null || Math.abs(x - preferred) < Math.abs(best - preferred)) best = x;
  }
  return best ?? 0;
}

function createRivals(track) {
  const names = ['Bot Coral', 'Bot Brisa', 'Bot Marea'];
  const colors = ['#ff9f1c', '#9b5de5', '#00bbf9'];
  return track.circuit.rivalPace.map((pace, i) => ({
    id: i,
    name: names[i],
    color: colors[i],
    pace,
    z: track.startZ - (i + 1) * 3,
    x: [-0.5, 0.5, 0][i],
    speed: 0,
    finishedAt: null,
  }));
}

export function createRace(circuit) {
  const track = buildTrack(circuit);
  return {
    track,
    time: 0,
    player: {
      z: track.startZ,
      x: 0,
      speed: 0,
      boost: 0,
      air: 0,
      stun: 0,
      falling: 0,
      steer: 0,
      checkpointZ: track.startZ,
      finishedAt: null,
    },
    rivals: createRivals(track),
    finished: false,
    stats: { hits: 0, falls: 0, boosts: 0, jumps: 0 },
  };
}

/** Velocidad máxima según el impulso activo. */
const topSpeed = (player) => MAX_SPEED * (player.boost > 0 ? BOOST_FACTOR : 1);

function stepPlayer(race, input, dt, events) {
  const { player, track } = race;

  if (player.falling > 0) {
    player.falling -= dt;
    if (player.falling <= 0) {
      player.falling = 0;
      player.z = player.checkpointZ;
      player.x = 0;
      player.speed = MAX_SPEED * RESPAWN_SPEED;
      player.boost = 0;
      player.air = 0;
      events.push({ type: 'respawn' });
    }
    return;
  }

  const before = player.z;
  const seg = segmentAt(track, player.z);

  // Velocidad: acelera hacia la máxima; el impulso decae con el tiempo.
  player.boost = Math.max(0, player.boost - dt);
  player.stun = Math.max(0, player.stun - dt);
  const target = topSpeed(player);
  if (player.speed < target) player.speed = Math.min(target, player.speed + ACCEL * dt);
  else player.speed = Math.max(target, player.speed - ACCEL * 0.6 * dt);
  player.z += player.speed * dt;

  // Dirección y fuerza centrífuga (más fuerte cuanto más rápido).
  const steer = input.steer ?? (input.right ? 1 : 0) - (input.left ? 1 : 0);
  player.steer += (steer - player.steer) * Math.min(1, dt * 10);
  const control = (player.air > 0 ? 0.5 : 1) * (player.stun > 0 ? 0.35 : 1);
  const ratio = Math.min(1.15, player.speed / MAX_SPEED);
  player.x += player.steer * STEER_SPEED * control * dt;
  if (player.air <= 0) player.x -= seg.curve * CENTRIFUGAL * ratio * ratio * dt;

  if (player.air > 0) {
    player.air = Math.max(0, player.air - dt);
    if (player.air === 0) events.push({ type: 'land' });
  }

  // Elementos de los segmentos cruzados en este paso.
  const firstSeg = Math.floor(before / SEGMENT_LENGTH) + 1;
  const lastSeg = Math.floor(player.z / SEGMENT_LENGTH);
  for (let index = firstSeg; index <= lastSeg; index += 1) {
    const crossed = track.segments[index];
    if (!crossed) continue;
    if (crossed.checkpoint) {
      player.checkpointZ = crossed.z;
      // El primer tramo empieza en la salida: solo se anuncian los siguientes.
      if (crossed.section > 0) events.push({ type: 'checkpoint', section: crossed.section, total: track.circuit.sections.length });
    }
    for (const item of crossed.items) {
      const overlap = Math.abs(item.x - player.x) < FLOAT_HALF + PLAYER_HALF;
      if (item.type === 'ramp' && player.air <= 0) {
        player.air = AIR_TIME;
        race.stats.jumps += 1;
        events.push({ type: 'jump' });
      } else if (item.type === 'boost' && player.air <= 0 && Math.abs(item.x - player.x) < 0.3) {
        player.boost = BOOST_TIME;
        race.stats.boosts += 1;
        events.push({ type: 'boost' });
      } else if (item.type === 'float' && player.air <= 0 && overlap && !item.hit) {
        item.hit = true;
        player.speed *= 0.4;
        player.stun = 0.45;
        player.x += player.x >= item.x ? 0.12 : -0.12;
        race.stats.hits += 1;
        events.push({ type: 'hit' });
      }
    }
  }

  // Bordes: con paredes se roza y se frena; sin paredes se cae al agua.
  const current = segmentAt(track, player.z);
  const edge = current.width - PLAYER_HALF;
  if (Math.abs(player.x) > edge && player.air <= 0) {
    if (current.walls) {
      player.x = Math.sign(player.x) * edge;
      player.speed = Math.max(MAX_SPEED * 0.35, player.speed * (1 - 1.4 * dt));
      events.push({ type: 'scrape' });
    } else if (Math.abs(player.x) > current.width + 0.04) {
      player.falling = FALL_TIME;
      race.stats.falls += 1;
      events.push({ type: 'fall' });
    }
  }

  if (player.z >= track.finishZ && player.finishedAt === null) {
    // Instante exacto del cruce, interpolado dentro del paso.
    const fraction = (track.finishZ - before) / Math.max(1e-6, player.z - before);
    player.finishedAt = race.time - dt + dt * fraction;
    events.push({ type: 'finish' });
  }
}

function stepRivals(race, dt) {
  const { track } = race;
  for (const rival of race.rivals) {
    const seg = segmentAt(track, rival.z);
    // Ritmo propio con una ligera variación: no es aleatorio, es una ola suave.
    const wave = 1 + 0.035 * Math.sin(race.time * 0.6 + rival.id * 2.1);
    const pace = MAX_SPEED * rival.pace * wave * (seg.width < 0.9 ? 0.96 : 1);
    rival.speed = Math.min(pace, rival.speed + ACCEL * dt);
    const before = rival.z;
    rival.z += rival.speed * dt;
    const lane = safeLane(track, rival.z, [-0.35, 0.35, 0][rival.id], 8);
    rival.x += (lane - rival.x) * Math.min(1, dt * 2.5);
    if (rival.finishedAt === null && rival.z >= track.finishZ) {
      rival.finishedAt = race.time - dt + (dt * (track.finishZ - before)) / Math.max(1e-6, rival.z - before);
    }
  }
}

/** Avanza la carrera `dt` segundos. Devuelve los eventos ocurridos (para sonido y efectos). */
export function stepRace(race, input, dt) {
  const events = [];
  if (race.finished) return events;
  race.time += dt;
  stepPlayer(race, input, dt, events);
  stepRivals(race, dt);
  if (race.player.finishedAt !== null) race.finished = true;
  return events;
}

/** Posición actual del jugador (1 = primero). */
export function positionOf(race) {
  const { player } = race;
  let ahead = 0;
  for (const rival of race.rivals) {
    if (player.finishedAt !== null) {
      if (rival.finishedAt !== null && rival.finishedAt < player.finishedAt) ahead += 1;
    } else if (rival.finishedAt !== null || rival.z > player.z) ahead += 1;
  }
  return ahead + 1;
}

/** Progreso de 0 a 1 entre la salida y la meta. */
export const progressOf = (race) =>
  Math.min(1, Math.max(0, (race.player.z - race.track.startZ) / (race.track.finishZ - race.track.startZ)));

/** Tiempo de carrera en milisegundos (el de llegada si ya terminó). */
export const raceTimeMs = (race) => Math.round((race.player.finishedAt ?? race.time) * 1000);
