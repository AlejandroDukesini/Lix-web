/**
 * Motor de «Despejar el estacionamiento» (sin interfaz).
 *
 * Tablero de `width` × `height` casillas. Cada coche ocupa `length` casillas en
 * su eje (`axis`: 'h' horizontal, 'v' vertical) y tiene una dirección de salida
 * (`dir`: 'right' | 'left' en horizontal, 'up' | 'down' en vertical). Solo se
 * mueve en esa dirección, hacia delante: nunca retrocede.
 *
 * Las salidas están marcadas en el borde (`exits`: { side, index }): un coche
 * solo abandona el tablero si su fila (o columna) tiene una salida en ese lado y
 * el camino hasta ella está libre. Tocar otro borde no sirve: allí se detiene.
 * Los `walls` son pilares (casillas bloqueadas).
 *
 * Estado: { cars: { id: { ...coche, row, col } } }. Al salir, el coche desaparece.
 */

export const DIRS = Object.freeze({ right: [0, 1], left: [0, -1], up: [-1, 0], down: [1, 0] });
const SIDE = { right: 'right', left: 'left', up: 'top', down: 'bottom' };

export function cellsOf(car) {
  return Array.from({ length: car.length }, (_, k) => (car.axis === 'h' ? [car.row, car.col + k] : [car.row + k, car.col]));
}

export function createState(level) {
  return { cars: Object.fromEntries(level.cars.map((car) => [car.id, { ...car }])) };
}

/** Mapa de ocupación: 'id' del coche, '#' pilar o vacío. */
export function occupancy(level, state) {
  const grid = Array.from({ length: level.height }, () => Array(level.width).fill(null));
  for (const key of level.walls ?? []) {
    const [r, c] = key.split(',').map(Number);
    grid[r][c] = '#';
  }
  for (const car of Object.values(state.cars)) for (const [r, c] of cellsOf(car)) grid[r][c] = car.id;
  return grid;
}

/** Casilla de delante del coche (la primera que pisaría al avanzar). */
function frontOf(car) {
  const [dr, dc] = DIRS[car.dir];
  if (car.dir === 'right') return [car.row, car.col + car.length];
  if (car.dir === 'down') return [car.row + car.length, car.col];
  return [car.row + dr, car.col + dc];
}

export const hasExit = (level, car) =>
  (level.exits ?? []).some((e) => e.side === SIDE[car.dir] && e.index === (car.axis === 'h' ? car.row : car.col));

/**
 * Hasta dónde puede avanzar un coche: `steps` casillas dentro del tablero y si,
 * con el camino libre hasta el borde, puede salir (`canExit`).
 */
export function reach(level, state, id, grid = occupancy(level, state)) {
  const car = state.cars[id];
  if (!car) return { steps: 0, canExit: false };
  const [dr, dc] = DIRS[car.dir];
  let [r, c] = frontOf(car);
  let steps = 0;
  while (r >= 0 && c >= 0 && r < level.height && c < level.width && grid[r][c] === null) {
    steps += 1;
    r += dr;
    c += dc;
  }
  const atEdge = r < 0 || c < 0 || r >= level.height || c >= level.width;
  return { steps, canExit: atEdge && hasExit(level, car) };
}

/**
 * Mueve un coche `k` casillas (1 ≤ k ≤ steps) o lo saca (`k = 'exit'`).
 * Devuelve el nuevo estado, o null si el movimiento no es válido.
 */
export function move(level, state, id, k) {
  const car = state.cars[id];
  if (!car) return null;
  const { steps, canExit } = reach(level, state, id);
  if (k === 'exit') {
    if (!canExit) return null;
    const cars = { ...state.cars };
    delete cars[id];
    return { cars };
  }
  if (!Number.isInteger(k) || k < 1 || k > steps) return null;
  const [dr, dc] = DIRS[car.dir];
  return { cars: { ...state.cars, [id]: { ...car, row: car.row + dr * k, col: car.col + dc * k } } };
}

/** Lo que hace un toque: salir si se puede; si no, avanzar todo lo posible. */
export function tapMove(level, state, id) {
  const { steps, canExit } = reach(level, state, id);
  if (canExit) return { state: move(level, state, id, 'exit'), exited: true, steps };
  if (steps > 0) return { state: move(level, state, id, steps), exited: false, steps };
  return { state: null, exited: false, steps: 0 };
}

export const isCleared = (state) => Object.keys(state.cars).length === 0;

const keyOf = (state) =>
  Object.keys(state.cars)
    .sort()
    .map((id) => `${id}:${state.cars[id].row},${state.cars[id].col}`)
    .join('|');

/** Todos los movimientos posibles desde un estado. */
export function movesFrom(level, state) {
  const grid = occupancy(level, state);
  const out = [];
  for (const id of Object.keys(state.cars)) {
    const { steps, canExit } = reach(level, state, id, grid);
    if (canExit) out.push({ id, k: 'exit' });
    for (let k = 1; k <= steps; k += 1) out.push({ id, k });
  }
  return out;
}

/**
 * Resolvedor: búsqueda en anchura (mínimo de movimientos). Como los coches solo
 * avanzan, el espacio de estados es finito. Devuelve { moves, path } o null si
 * no hay solución (o se supera el presupuesto).
 */
export function solve(level, state = createState(level), budget = 400_000) {
  if (isCleared(state)) return { moves: 0, path: [] };
  const seen = new Set([keyOf(state)]);
  let frontier = [{ state, path: [] }];
  let explored = 0;
  while (frontier.length) {
    const next = [];
    for (const node of frontier) {
      for (const m of movesFrom(level, node.state)) {
        const after = move(level, node.state, m.id, m.k);
        const path = [...node.path, m];
        if (isCleared(after)) return { moves: path.length, path };
        const key = keyOf(after);
        if (seen.has(key)) continue;
        seen.add(key);
        next.push({ state: after, path });
        explored += 1;
        if (explored > budget) return null;
      }
    }
    frontier = next;
  }
  return null;
}

/**
 * Busca una solución en profundidad (probando primero las salidas): más rápida
 * que la mínima. Devuelve { path, exhausted }: `path` es la lista de movimientos
 * (o null), y `exhausted` indica que se agotó el presupuesto sin terminar de
 * buscar, es decir, que NO está demostrado que no haya solución.
 */
export function searchSolution(level, state = createState(level), budget = 200_000) {
  const seen = new Set();
  let explored = 0;
  let exhausted = false;
  const dfs = (s, path) => {
    if (isCleared(s)) return path;
    const key = keyOf(s);
    if (seen.has(key)) return null;
    if (explored > budget) {
      exhausted = true;
      return null;
    }
    seen.add(key);
    explored += 1;
    const moves = movesFrom(level, s).sort((x, y) => (y.k === 'exit') - (x.k === 'exit'));
    for (const m of moves) {
      const found = dfs(move(level, s, m.id, m.k), [...path, m]);
      if (found) return found;
    }
    return null;
  };
  const path = dfs(state, []);
  return { path, exhausted: !path && exhausted };
}

export const findSolution = (level, state, budget) => searchSolution(level, state, budget).path;

/** ¿Queda alguna forma de despejar? Ante la duda (búsqueda incompleta) responde que sí: nunca un falso «sin salida». */
export function isSolvable(level, state, budget) {
  const { path, exhausted } = searchSolution(level, state, budget);
  return Boolean(path) || exhausted;
}

/**
 * Medidas de dificultad: `rounds`, cuántas tandas de salidas hacen falta si en
 * cada una salen todos los coches que pueden; `needsManeuver`, si en algún
 * momento ninguno puede salir y hay que mover uno a medias para abrir paso;
 * `traps`, cuántos primeros movimientos dejan el tablero sin solución.
 */
export function difficultyOf(level) {
  let state = createState(level);
  let rounds = 0;
  let needsManeuver = false;
  while (!isCleared(state)) {
    const exitable = Object.keys(state.cars).filter((id) => reach(level, state, id).canExit);
    if (!exitable.length) {
      needsManeuver = true;
      break;
    }
    for (const id of exitable) state = move(level, state, id, 'exit') ?? state;
    rounds += 1;
  }
  const start = createState(level);
  const traps = movesFrom(level, start).filter((m) => !isSolvable(level, move(level, start, m.id, m.k), 50_000)).length;
  return { rounds, needsManeuver, traps };
}

/** Problemas de un nivel (vacío si es válido). */
export function levelProblems(level) {
  const problems = [];
  const grid = Array.from({ length: level.height }, () => Array(level.width).fill(null));
  for (const key of level.walls ?? []) {
    const [r, c] = key.split(',').map(Number);
    grid[r][c] = '#';
  }
  for (const car of level.cars) {
    if (car.axis === 'h' ? !['left', 'right'].includes(car.dir) : !['up', 'down'].includes(car.dir)) problems.push(`${car.id}: dirección fuera de su eje`);
    for (const [r, c] of cellsOf(car)) {
      if (r < 0 || c < 0 || r >= level.height || c >= level.width) problems.push(`${car.id}: fuera del tablero`);
      else if (grid[r][c]) problems.push(`${car.id}: se superpone con ${grid[r][c]}`);
      else grid[r][c] = car.id;
    }
    if (!hasExit(level, car)) problems.push(`${car.id}: no tiene salida en su línea`);
  }
  return problems;
}
