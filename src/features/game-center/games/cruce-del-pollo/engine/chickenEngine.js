/**
 * Motor de «Pollo pasando la calle» (sin DOM, determinista con semilla).
 *
 * El mundo es una pila de filas de COLS casillas que crece hacia arriba:
 *   grass  hierba: zona segura
 *   road   carretera: vehículos que avanzan en una dirección; tocar uno es perder
 *   river  río: troncos que flotan; hay que ir subido a uno (te arrastra) o caes al agua
 *   goal   meta de la ronda (el nido): al llegar se supera la ronda
 *
 * La gallina se mueve a saltos de una casilla. Su fila «lógica» cambia a mitad
 * del salto y su caja de choque es más estrecha que la casilla (HIT_MARGIN), así
 * que un roce con la esquina de un coche no cuenta: las colisiones son justas.
 * Hay ROUNDS rondas, cada una con más carriles, más velocidad y más río. Superar
 * la última es ganar; cualquier choque o caída termina la partida.
 *
 * Unidades: x en casillas (la casilla c ocupa [c, c+1)), tiempo en segundos.
 */

export const COLS = 9;
export const ROUNDS = 10;
export const HOP_TIME = 0.14;
export const HIT_MARGIN = 0.2;
export const START_COL = 4;
// Puntos: una por fila nueva alcanzada y un extra por ronda superada.
export const ROUND_BONUS = 10;
// Carriles seguidos como máximo entre dos zonas seguras.
export const MAX_STREAK = 3;

const DIRS = { up: [0, 1], down: [0, -1], left: [-1, 0], right: [1, 0] };

// --- Aleatoriedad con semilla (mulberry32) guardada en el estado: se puede clonar.
function random(state) {
  state.rng = (state.rng + 0x6d2b79f5) >>> 0;
  let t = state.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const between = (state, a, b) => a + (b - a) * random(state);
const pick = (state, list) => list[Math.floor(random(state) * list.length)];

/** Parámetros de dificultad de una ronda (1…ROUNDS). */
export function roundConfig(round) {
  const r = Math.min(ROUNDS, Math.max(1, round));
  return {
    lanes: Math.min(12, 3 + r),
    rivers: r < 3 ? 0 : Math.min(4, Math.floor((r - 1) / 2)),
    speed: 1.3 + r * 0.2, // casillas/s de los coches (media)
    trucks: r >= 2,
    logSpeed: 0.7 + r * 0.06,
  };
}

const VEHICLES = [
  { kind: 'car', len: 1.3 },
  { kind: 'car', len: 1.3 },
  { kind: 'van', len: 1.7 },
];
const TRUCK = { kind: 'truck', len: 2.6 };

/**
 * Coloca objetos en un carril circular dejando huecos dentro de [minGap, maxGap].
 * La longitud del bucle se calcula para que el hueco «de la vuelta» (entre el
 * último objeto y el primero cuando reaparece) también sea uno de esos huecos.
 */
function fillLane(state, makeItem, minGap, maxGap) {
  const items = [];
  const first = between(state, -2, 1);
  let x = first;
  while (x < COLS + 4) {
    const item = makeItem();
    items.push({ ...item, x });
    x += item.len + between(state, minGap, maxGap);
  }
  return { items, loop: x - first };
}

function roadRow(state, cfg, dir) {
  const speed = cfg.speed * between(state, 0.75, 1.25);
  // Hueco mínimo en casillas: el tiempo que tarda en pasar (hueco/velocidad) da
  // margen para cruzar de un salto con holgura, también en las rondas rápidas.
  const minGap = 2.2 + speed * 0.45;
  const { items, loop } = fillLane(
    state,
    () => (cfg.trucks && random(state) < 0.25 ? TRUCK : pick(state, VEHICLES)),
    minGap,
    minGap + 3,
  );
  const hue = Math.floor(between(state, 0, 360));
  return { type: 'road', dir, speed, loop, items: items.map((it, i) => ({ ...it, hue: (hue + i * 67) % 360 })) };
}

function riverRow(state, cfg, dir) {
  const speed = cfg.logSpeed * between(state, 0.8, 1.2);
  // Troncos largos y huecos cortos: siempre hay a dónde saltar con poca espera.
  const { items, loop } = fillLane(state, () => ({ kind: 'log', len: Math.round(between(state, 3, 4.6) * 10) / 10 }), 1.2, 2.2);
  return { type: 'river', dir, speed, loop, items };
}

const grassRow = (state) => ({
  type: 'grass',
  dir: 0,
  speed: 0,
  loop: COLS,
  items: [],
  // Decoración en casillas que no son la salida (nunca bloquea el paso).
  flowers: Array.from({ length: 3 }, () => Math.floor(between(state, 0, COLS))),
});

/** Añade las filas de una ronda encima de las existentes. */
function appendRound(state, round) {
  const cfg = roundConfig(round);
  state.rows.push(grassRow(state));
  // Orden de carriles: grupos de carretera con, a partir de la ronda 3, ríos intercalados.
  const kinds = Array.from({ length: cfg.lanes }, (_, i) => (i < cfg.rivers ? 'river' : 'road'));
  for (let i = kinds.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random(state) * (i + 1));
    [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
  }
  let lastDir = random(state) < 0.5 ? 1 : -1;
  kinds.forEach((kind, i) => {
    const dir = random(state) < 0.65 ? -lastDir : lastDir;
    lastDir = dir;
    state.rows.push(kind === 'road' ? roadRow(state, cfg, dir) : riverRow(state, cfg, dir));
    // Respiro: nunca más de MAX_STREAK carriles seguidos sin una franja de hierba
    // donde esperar el momento (en la carretera no se puede uno quedar parado).
    if (i % MAX_STREAK === MAX_STREAK - 1 && i < kinds.length - 1) state.rows.push(grassRow(state));
  });
  state.rows.push({ type: 'goal', dir: 0, speed: 0, loop: COLS, items: [], round });
}

export function createRun(seed = 1) {
  const state = {
    rng: seed >>> 0,
    rows: [],
    round: 1,
    roundStartRow: 0,
    chicken: { x: START_COL, row: 0, hop: null, facing: 'up' },
    queued: null,
    maxRow: 0,
    score: 0,
    status: 'playing', // 'playing' | 'dead' | 'won'
    cause: null,
    time: 0,
  };
  state.rows.push(grassRow(state));
  appendRound(state, 1);
  return state;
}

/** Fila en la que está la gallina a efectos de colisión (cambia a mitad de salto). */
export function logicalRow(chicken) {
  if (!chicken.hop) return chicken.row;
  return chicken.hop.t >= 0.5 ? chicken.hop.toRow : chicken.hop.fromRow;
}

/** Posición x continua (interpolada durante el salto). */
export function chickenX(chicken) {
  if (!chicken.hop) return chicken.x;
  const k = Math.min(1, chicken.hop.t);
  return chicken.hop.fromX + (chicken.hop.toX - chicken.hop.fromX) * k;
}

/** ¿Se puede empezar este salto ahora? (bordes y vuelta atrás limitada). */
export function canHop(state, direction) {
  const { chicken } = state;
  if (state.status !== 'playing' || chicken.hop) return false;
  const [dx, dy] = DIRS[direction] ?? [0, 0];
  if (!dx && !dy) return false;
  const row = chicken.row + dy;
  if (row < state.roundStartRow || row >= state.rows.length) return false;
  const x = Math.round(chicken.x) + dx;
  return x >= 0 && x <= COLS - 1;
}

/** Ordena un salto. Si ya está saltando, se guarda uno (solo uno) para encadenar. */
export function requestHop(state, direction) {
  if (!DIRS[direction] || state.status !== 'playing') return false;
  if (state.chicken.hop) {
    state.queued = direction;
    return true;
  }
  return startHop(state, direction);
}

function startHop(state, direction) {
  const { chicken } = state;
  chicken.facing = direction;
  if (!canHop(state, direction)) return false;
  const [dx, dy] = DIRS[direction];
  // En tierra se salta de casilla en casilla; hacia o sobre el río se conserva la
  // posición continua (la del tronco), y al volver a tierra se encaja en la casilla.
  const fromX = chicken.x;
  const toRow = chicken.row + dy;
  const toType = state.rows[toRow].type;
  const onRiver = state.rows[chicken.row].type === 'river';
  let toX;
  if (dy !== 0) toX = toType === 'river' ? chicken.x : Math.round(chicken.x);
  else toX = onRiver ? chicken.x + dx : Math.round(chicken.x) + dx;
  chicken.hop = { t: 0, fromRow: chicken.row, toRow, fromX, toX: Math.min(COLS - 1, Math.max(0, toX)) };
  return true;
}

const overlaps = (a0, a1, b0, b1) => a0 < b1 && b0 < a1;

/** Objeto del carril en el que está la x indicada (los troncos ya movidos). */
function logUnder(row, x) {
  const center = x + 0.5;
  return row.items.find((log) => center >= log.x + 0.05 && center <= log.x + log.len - 0.05) ?? null;
}

function die(state, cause, events) {
  state.status = 'dead';
  state.cause = cause;
  state.chicken.hop = null;
  events.push({ type: 'dead', cause });
}

/**
 * Avanza la simulación `dt` segundos. Devuelve eventos:
 *   { type: 'hop' } | { type: 'land' } | { type: 'score', score } | { type: 'round', round }
 *   { type: 'dead', cause: 'car' | 'water' | 'current' } | { type: 'won' }
 */
export function step(state, dt) {
  const events = [];
  if (state.status !== 'playing') return events;
  state.time += dt;

  // 1. Tráfico y troncos.
  for (const row of state.rows) {
    if (!row.speed) continue;
    const v = row.speed * row.dir * dt;
    for (const item of row.items) {
      item.x += v;
      if (row.dir > 0 && item.x > COLS + 1) item.x -= row.loop;
      if (row.dir < 0 && item.x + item.len < -1) item.x += row.loop;
    }
  }

  // 2. La gallina: salto en curso o arrastre del tronco.
  const { chicken } = state;
  if (chicken.hop) {
    chicken.hop.t += dt / HOP_TIME;
    if (chicken.hop.t >= 1) {
      chicken.row = chicken.hop.toRow;
      chicken.x = chicken.hop.toX;
      chicken.hop = null;
      events.push({ type: 'land' });
      if (chicken.row > state.maxRow) {
        state.score += chicken.row - state.maxRow;
        state.maxRow = chicken.row;
        events.push({ type: 'score', score: state.score });
      }
    }
  } else {
    const row = state.rows[chicken.row];
    if (row.type === 'river') {
      const log = logUnder(row, chicken.x);
      if (log) chicken.x += row.speed * row.dir * dt;
      if (chicken.x < -0.45 || chicken.x > COLS - 0.55) {
        die(state, 'current', events);
        return events;
      }
    }
  }

  // 3. Colisiones en la fila lógica.
  const rowIndex = logicalRow(chicken);
  const row = state.rows[rowIndex];
  const x = chickenX(chicken);
  if (row.type === 'road') {
    const hit = row.items.some((car) => overlaps(x + HIT_MARGIN, x + 1 - HIT_MARGIN, car.x, car.x + car.len));
    if (hit) {
      die(state, 'car', events);
      return events;
    }
  } else if (row.type === 'river' && !chicken.hop && !logUnder(row, chicken.x)) {
    die(state, 'water', events);
    return events;
  }

  // 4. Meta de la ronda.
  if (!chicken.hop && row.type === 'goal' && rowIndex === chicken.row && row.round === state.round) {
    state.score += ROUND_BONUS;
    events.push({ type: 'round', round: state.round });
    if (state.round >= ROUNDS) {
      state.status = 'won';
      events.push({ type: 'won' });
      return events;
    }
    state.round += 1;
    state.roundStartRow = chicken.row;
    appendRound(state, state.round);
  }

  // 5. Salto encadenado.
  if (!chicken.hop && state.queued) {
    const next = state.queued;
    state.queued = null;
    if (startHop(state, next)) events.push({ type: 'hop' });
  }
  return events;
}

/** Copia independiente del estado (para el piloto automático de las pruebas). */
export const cloneRun = (state) => structuredClone(state);
