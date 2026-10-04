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
export const GRID_BACK = 10; // el jugador sale estos metros por detrás de la línea (los bots, delante)
const WALL_PULL = 2.6; // anchos/s: al estrecharse el canal, la pared empuja hacia dentro sin saltos

/**
 * Rivales: tres perfiles con comportamiento propio (no siguen al jugador).
 *   pace       fracción de la velocidad máxima (× botScale del circuito)
 *   reaction   segundos entre decisiones de carril (más = reacciona tarde)
 *   lookahead  segmentos que mira por delante para esquivar
 *   mistake    probabilidad de no esquivar en una decisión (pierde tiempo)
 *   boostSeek  probabilidad de buscar un impulso cercano
 *   steer      agilidad lateral (fracción de la del jugador)
 */
export const BOT_PROFILES = Object.freeze([
  { id: 'pro', name: 'Bot Pro', color: '#ff4f6d', pace: 0.985, reaction: 0.16, lookahead: 13, mistake: 0.05, boostSeek: 0.75, steer: 1, lane: -0.45, grid: [0, -0.58] },
  { id: 'regular', name: 'Bot Regular', color: '#9b5de5', pace: 0.935, reaction: 0.32, lookahead: 9, mistake: 0.15, boostSeek: 0.4, steer: 0.85, lane: 0.4, grid: [0, 0.58] },
  { id: 'easy', name: 'Bot Fácil', color: '#00bbf9', pace: 0.87, reaction: 0.55, lookahead: 6, mistake: 0.3, boostSeek: 0.12, steer: 0.7, lane: 0, grid: [-5, -0.3] },
]);

/** Generador pseudoaleatorio determinista (misma carrera ⇒ mismos fallos de los bots). */
function seededRandom(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hashId = (text) => [...text].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);

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

/** Altura del tobogán en `z`, interpolada entre segmentos (la cámara no da saltos de 4 en 4 m). */
export function heightAt(track, z) {
  const i = Math.max(0, Math.min(track.segments.length - 1, Math.floor(z / SEGMENT_LENGTH)));
  const seg = track.segments[i];
  const next = track.segments[i + 1] ?? seg;
  const t = Math.max(0, Math.min(1, z / SEGMENT_LENGTH - i));
  return seg.y + (next.y - seg.y) * t;
}

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
  const scale = track.circuit.botScale ?? 1;
  return BOT_PROFILES.map((profile, i) => ({
    id: i,
    profile: profile.id,
    name: profile.name,
    color: profile.color,
    pace: profile.pace * scale,
    // Parrilla: los bots salen delante y en carriles distintos; el jugador, detrás.
    z: track.startZ + profile.grid[0],
    x: profile.grid[1],
    lane: profile.grid[1],
    speed: 0,
    boost: 0,
    stun: 0,
    air: 0,
    think: 0,
    finishedAt: null,
  }));
}

export function createRace(circuit) {
  const track = buildTrack(circuit);
  return {
    track,
    time: 0,
    random: seededRandom(hashId(circuit.id)),
    player: {
      z: track.startZ - GRID_BACK,
      x: 0,
      speed: 0,
      boost: 0,
      air: 0,
      stun: 0,
      falling: 0,
      steer: 0,
      knock: 0,
      checkpointZ: track.startZ - GRID_BACK,
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
  const xBefore = player.x;
  player.x += player.steer * STEER_SPEED * control * dt;
  if (player.air <= 0) player.x -= seg.curve * CENTRIFUGAL * ratio * ratio * dt;
  // Empujón lateral de un choque: se disipa en unas décimas (antes era un salto de posición).
  player.x += player.knock * dt;
  player.knock *= Math.exp(-8 * dt);

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
        player.knock = player.x >= item.x ? 0.9 : -0.9;
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
      // La pared devuelve hacia dentro de forma continua: al estrecharse el canal
      // ya no hay un «rebote» instantáneo contra un límite invisible.
      player.x = Math.sign(player.x) * Math.max(edge, Math.min(Math.abs(player.x), Math.abs(xBefore) - WALL_PULL * dt));
      player.knock = 0;
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

/** Impulso cercano por delante (para los bots que lo buscan). */
function boostAhead(track, z, lookahead) {
  const first = Math.floor(z / SEGMENT_LENGTH);
  for (let i = 2; i <= lookahead; i += 1) {
    const item = track.segments[first + i]?.items.find((it) => it.type === 'boost');
    if (item) return item.x;
  }
  return null;
}

function stepRivals(race, dt) {
  const { track } = race;
  for (const rival of race.rivals) {
    const profile = BOT_PROFILES[rival.id];
    const seg = segmentAt(track, rival.z);
    rival.boost = Math.max(0, rival.boost - dt);
    rival.stun = Math.max(0, rival.stun - dt);
    rival.air = Math.max(0, rival.air - dt);

    // Velocidad: su ritmo, algo menos en curvas cerradas y canales estrechos; los impulsos también les sirven.
    const corner = 1 - Math.abs(seg.curve) * 0.05;
    const narrow = seg.width < 0.9 ? 0.97 : 1;
    const target = MAX_SPEED * rival.pace * corner * narrow * (rival.boost > 0 ? BOOST_FACTOR : 1);
    if (rival.speed < target) rival.speed = Math.min(target, rival.speed + ACCEL * dt);
    else rival.speed = Math.max(target, rival.speed - ACCEL * 0.6 * dt);
    const before = rival.z;
    rival.z += rival.speed * dt;

    // Decisiones con su tiempo de reacción: esquivar, buscar un impulso o (a veces) equivocarse.
    rival.think -= dt;
    if (rival.think <= 0) {
      rival.think = profile.reaction * (0.8 + race.random() * 0.4);
      if (race.random() < profile.mistake) {
        rival.lane = rival.x; // no ve el obstáculo a tiempo: sigue recto
      } else {
        const boost = race.random() < profile.boostSeek ? boostAhead(track, rival.z, profile.lookahead) : null;
        rival.lane = safeLane(track, rival.z, boost ?? profile.lane, profile.lookahead);
      }
    }
    const control = (rival.stun > 0 ? 0.35 : 1) * (rival.air > 0 ? 0.5 : 1);
    const maxMove = STEER_SPEED * profile.steer * control * dt;
    rival.x += Math.max(-maxMove, Math.min(maxMove, rival.lane - rival.x));

    // Lo que hay en los segmentos que cruza: los mismos flotadores, impulsos y rampas que el jugador.
    const firstSeg = Math.floor(before / SEGMENT_LENGTH) + 1;
    const lastSeg = Math.floor(rival.z / SEGMENT_LENGTH);
    for (let index = firstSeg; index <= lastSeg; index += 1) {
      for (const item of track.segments[index]?.items ?? []) {
        if (item.type === 'ramp' && rival.air <= 0) rival.air = AIR_TIME;
        else if (item.type === 'boost' && rival.air <= 0 && Math.abs(item.x - rival.x) < 0.3) rival.boost = BOOST_TIME;
        else if (item.type === 'float' && rival.air <= 0 && Math.abs(item.x - rival.x) < FLOAT_HALF + PLAYER_HALF) {
          rival.speed *= 0.45;
          rival.stun = 0.5;
        }
      }
    }
    // Los bots no se caen: se mantienen dentro del canal.
    const limit = segmentAt(track, rival.z).width - PLAYER_HALF;
    if (Math.abs(rival.x) > limit) rival.x = Math.sign(rival.x) * Math.max(limit, Math.abs(rival.x) - WALL_PULL * dt);

    if (rival.finishedAt === null && rival.z >= track.finishZ) {
      rival.finishedAt = race.time - dt + (dt * (track.finishZ - before)) / Math.max(1e-6, rival.z - before);
    }
  }
}

/**
 * Tras la meta el flotador sigue deslizándose hasta la piscina y se detiene con
 * suavidad (antes la imagen se congelaba de golpe en la línea).
 */
function coast(race, dt) {
  const { player, track } = race;
  race.time += dt;
  player.speed = Math.max(0, player.speed - ACCEL * 1.8 * dt);
  const end = track.segments.length * SEGMENT_LENGTH - SEGMENT_LENGTH * 12;
  player.z = Math.min(end, player.z + player.speed * dt);
  player.steer *= Math.exp(-4 * dt);
  player.x *= Math.exp(-2 * dt);
  player.knock = 0;
  player.air = Math.max(0, player.air - dt);
  stepRivals(race, dt);
}

/** Avanza la carrera `dt` segundos. Devuelve los eventos ocurridos (para sonido y efectos). */
export function stepRace(race, input, dt) {
  const events = [];
  if (race.finished) {
    coast(race, dt);
    return events;
  }
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

/** Clasificación completa (jugador y bots), para el resultado. */
export function standings(race) {
  const entries = [
    { id: 'player', name: 'Tú', z: race.player.z, finishedAt: race.player.finishedAt },
    ...race.rivals.map((r) => ({ id: r.profile, name: r.name, z: r.z, finishedAt: r.finishedAt })),
  ];
  return entries.sort((a, b) => {
    if (a.finishedAt !== null && b.finishedAt !== null) return a.finishedAt - b.finishedAt;
    if (a.finishedAt !== null) return -1;
    if (b.finishedAt !== null) return 1;
    return b.z - a.z;
  });
}

/** Tiempo de carrera en milisegundos (el de llegada si ya terminó). */
export const raceTimeMs = (race) => Math.round((race.player.finishedAt ?? race.time) * 1000);
