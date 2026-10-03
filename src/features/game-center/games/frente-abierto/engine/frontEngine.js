/**
 * Motor de «Frente Abierto»: estrategia territorial POR TURNOS (sin DOM, determinista).
 *
 * MAPA: una isla de territorios hexagonales (coordenadas axiales). Cada uno:
 *   { key, owner ('p' | 'a1' | 'a2' | 'a3' | null = neutral), troops, kind: 'plain' | 'city' | 'fort' }
 *   y sus adyacentes son los hexágonos vecinos de tierra.
 *
 * TURNO de cada bando (la persona y la IA siguen las mismas reglas):
 *   1. Refuerzos: max(3, ⌊territorios / 3⌋) + 2 por ciudad propia. Se colocan en territorios propios.
 *   2. Órdenes, tantas como se quiera: desde un territorio propio con ≥ 2 tropas que no haya
 *      actuado este turno, enviar k tropas (1 … tropas − 1) a un vecino:
 *        - propio: se mueven;
 *        - neutral o rival: ataque.
 *      El destino tampoco puede actuar después en este turno (sin cadenas por todo el mapa).
 *   3. Terminar turno.
 *
 * COMBATE (sin dados: el resultado se conoce antes de confirmar):
 *   defensa = tropas del defensor × 1,5 si es fortaleza.
 *   Si k > defensa: se conquista; quedan k − ⌈defensa⌉ (al menos 1).
 *   Si no: se pierden las k enviadas y el defensor pierde ⌊k / multiplicador⌋.
 *
 * VICTORIA: eliminar a todos los rivales. DERROTA: perder todos los territorios.
 */

export const NEIGHBORS = Object.freeze([
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
]);
export const keyOf = (q, r) => `${q},${r}`;
export const parseKey = (key) => key.split(',').map(Number);
export const FORT_BONUS = 1.5;
export const PLAYER = 'p';
const START_NEIGHBORS = 3;

export const FACTIONS = Object.freeze({
  p: { id: 'p', name: 'Tú', color: '#5fb4ff', glyph: '★' },
  a1: { id: 'a1', name: 'Rojo', color: '#ff6f6f', glyph: '▲' },
  a2: { id: 'a2', name: 'Ámbar', color: '#ffc65c', glyph: '■' },
  a3: { id: 'a3', name: 'Violeta', color: '#b28cff', glyph: '◆' },
});

function createRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hexDistance = (a, b) => {
  const [q1, r1] = parseKey(a);
  const [q2, r2] = parseKey(b);
  return (Math.abs(q1 - q2) + Math.abs(r1 - r2) + Math.abs(q1 + r1 - q2 - r2)) / 2;
};

export function neighborsOf(map, key) {
  const [q, r] = parseKey(key);
  return NEIGHBORS.map(([dq, dr]) => keyOf(q + dq, r + dr)).filter((k) => k in map);
}

/**
 * Isla conexa de radio `radius`: se quitan hexágonos del borde al azar (agua)
 * sin desconectar el mapa. Las facciones empiezan lejos unas de otras, cada una
 * con una capital (ciudad); hay ciudades y fortalezas neutrales repartidas.
 */
export function generateMap({ radius = 4, rivals = 1, seed = 1, water = 0.18 } = {}) {
  const rng = createRng(seed);
  const all = [];
  for (let q = -radius; q <= radius; q += 1) {
    for (let r = Math.max(-radius, -q - radius); r <= Math.min(radius, -q + radius); r += 1) all.push(keyOf(q, r));
  }
  const land = new Set(all);
  const connected = (set) => {
    const [first] = set;
    const seen = new Set([first]);
    const stack = [first];
    while (stack.length) {
      const [q, r] = parseKey(stack.pop());
      for (const [dq, dr] of NEIGHBORS) {
        const k = keyOf(q + dq, r + dr);
        if (set.has(k) && !seen.has(k)) {
          seen.add(k);
          stack.push(k);
        }
      }
    }
    return seen.size === set.size;
  };
  const edge = all.filter((k) => hexDistance(k, '0,0') >= radius - 1);
  for (const k of edge) {
    if (rng() < water) {
      land.delete(k);
      if (!connected(land)) land.add(k);
    }
  }
  const map = {};
  for (const key of land) map[key] = { key, owner: null, troops: 1 + Math.floor(rng() * 3), kind: 'plain' };

  // Capitales: la persona y las IA en puntos lejanos entre sí. Todas empiezan igual:
  // capital (5) + 3 territorios vecinos (2), así que solo valen casillas con sitio alrededor.
  const factions = [PLAYER, 'a1', 'a2', 'a3'].slice(0, rivals + 1);
  const keys = Object.keys(map);
  const roomy = keys.filter((k) => neighborsOf(map, k).length >= 4);
  const starts = [];
  const farthest = (score) => roomy.filter((k) => !starts.includes(k)).reduce((best, k) => (score(k) > score(best) ? k : best));
  for (const faction of factions) {
    const free = (k) => neighborsOf(map, k).filter((n) => map[n].owner === null);
    const candidate = farthest((k) => (free(k).length < START_NEIGHBORS ? -1 : starts.length ? Math.min(...starts.map((s) => hexDistance(k, s))) : hexDistance(k, '0,0')));
    starts.push(candidate);
    map[candidate] = { ...map[candidate], owner: faction, troops: 5, kind: 'city', capital: faction };
    for (const n of free(candidate).slice(0, START_NEIGHBORS)) map[n] = { ...map[n], owner: faction, troops: 2 };
  }
  // Ciudades y fortalezas neutrales.
  const neutral = keys.filter((k) => map[k].owner === null).sort(() => rng() - 0.5);
  const cities = Math.max(2, Math.round(keys.length / 14));
  neutral.slice(0, cities).forEach((k) => (map[k] = { ...map[k], kind: 'city', troops: 3 + Math.floor(rng() * 2) }));
  neutral.slice(cities, cities + Math.max(1, Math.round(keys.length / 20))).forEach((k) => (map[k] = { ...map[k], kind: 'fort', troops: 2 }));
  return map;
}

export function createGame({ radius = 4, rivals = 1, difficulty = 'normal', seed = 1 } = {}) {
  const map = generateMap({ radius, rivals, seed });
  const factions = [PLAYER, 'a1', 'a2', 'a3'].slice(0, rivals + 1);
  const state = {
    map,
    factions,
    difficulty,
    turn: 1,
    current: PLAYER,
    phase: 'reinforce', // 'reinforce' | 'orders'
    reinforcements: 0,
    acted: [],
    status: 'playing', // 'playing' | 'won' | 'lost'
    log: [],
    seed,
  };
  state.reinforcements = income(state, PLAYER);
  return state;
}

export const territoriesOf = (state, faction) => Object.values(state.map).filter((t) => t.owner === faction);

export function income(state, faction) {
  const own = territoriesOf(state, faction);
  return Math.max(3, Math.floor(own.length / 3)) + 2 * own.filter((t) => t.kind === 'city').length;
}

export const defenseOf = (t) => t.troops * (t.kind === 'fort' ? FORT_BONUS : 1);

/** Resultado previsto de enviar k tropas de `from` a `to` (sin cambiar nada). */
export function previewOrder(state, from, to, k) {
  const source = state.map[from];
  const target = state.map[to];
  if (target.owner === source.owner) return { type: 'move', k };
  const defense = defenseOf(target);
  if (k > defense) return { type: 'capture', k, survivors: Math.max(1, k - Math.ceil(defense)), defense };
  const mult = target.kind === 'fort' ? FORT_BONUS : 1;
  return { type: 'repelled', k, defenderLoss: Math.min(target.troops, Math.floor(k / mult)), defense };
}

/** ¿Es legal esta orden para el bando que juega? Devuelve el motivo si no. */
export function orderError(state, from, to, k) {
  if (state.status !== 'playing') return 'La partida ha terminado.';
  if (state.phase !== 'orders') return 'Primero coloca los refuerzos.';
  const source = state.map[from];
  const target = state.map[to];
  if (!source || !target) return 'Territorio inexistente.';
  if (source.owner !== state.current) return 'Ese territorio no es tuyo.';
  if (state.acted.includes(from)) return 'Ese territorio ya actuó este turno.';
  if (!neighborsOf(state.map, from).includes(to)) return 'Solo se puede actuar sobre territorios vecinos.';
  if (source.troops < 2) return 'Hace falta dejar al menos una tropa.';
  if (!Number.isInteger(k) || k < 1 || k > source.troops - 1) return 'Cantidad de tropas no válida.';
  return null;
}

const checkEnd = (state) => {
  if (!territoriesOf(state, PLAYER).length) state.status = 'lost';
  else if (state.factions.filter((f) => f !== PLAYER).every((f) => !territoriesOf(state, f).length)) state.status = 'won';
};

/** Coloca `n` refuerzos en un territorio propio. */
export function reinforce(prev, key, n = 1) {
  const t = prev.map[key];
  if (prev.phase !== 'reinforce' || !t || t.owner !== prev.current || n < 1 || n > prev.reinforcements) return null;
  const state = structuredClone(prev);
  state.map[key].troops += n;
  state.reinforcements -= n;
  if (!state.reinforcements) state.phase = 'orders';
  return state;
}

/** Ejecuta una orden. Devuelve { state, result } o null si no es legal. */
export function order(prev, from, to, k) {
  if (orderError(prev, from, to, k)) return null;
  const state = structuredClone(prev);
  const result = previewOrder(state, from, to, k);
  const source = state.map[from];
  const target = state.map[to];
  source.troops -= k;
  if (result.type === 'move') target.troops += k;
  else if (result.type === 'capture') {
    target.owner = source.owner;
    target.troops = result.survivors;
    if (target.capital) delete target.capital;
  } else target.troops -= result.defenderLoss;
  state.acted.push(from, to);
  state.log.push({ turn: state.turn, faction: state.current, from, to, ...result });
  checkEnd(state);
  return { state, result };
}

/** Termina el turno del bando actual y pasa al siguiente con territorios. */
export function endTurn(prev) {
  if (prev.status !== 'playing') return prev;
  const state = structuredClone(prev);
  const order = state.factions;
  let index = order.indexOf(state.current);
  do {
    index = (index + 1) % order.length;
    if (index === 0) state.turn += 1;
  } while (!territoriesOf(state, order[index]).length);
  state.current = order[index];
  state.acted = [];
  state.phase = 'reinforce';
  state.reinforcements = income(state, state.current);
  return state;
}

/** Destinos válidos desde un territorio: [{ key, kind: 'move' | 'attack' }]. */
export function targetsFrom(state, from) {
  const source = state.map[from];
  if (!source || source.owner !== state.current || state.phase !== 'orders' || state.acted.includes(from) || source.troops < 2) return [];
  return neighborsOf(state.map, from).map((key) => ({ key, kind: state.map[key].owner === source.owner ? 'move' : 'attack' }));
}
