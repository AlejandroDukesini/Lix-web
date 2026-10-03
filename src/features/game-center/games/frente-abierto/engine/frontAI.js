/**
 * IA local de «Frente Abierto». Usa exactamente las funciones del motor que usa
 * la persona (reinforce, order, endTurn), así que nunca hace jugadas ilegales.
 * Es un cálculo pequeño por jugada: no bloquea la interfaz.
 *
 * Niveles (cambian el comportamiento, no solo un número):
 *   facil    refuerza un frente al azar; como mucho 2 ataques por turno y solo
 *            con ventaja clara; no ataca a la persona en los 3 primeros turnos.
 *   normal   refuerza donde puede conquistar; ataca todo lo que gana, primero
 *            ciudades y territorios de la persona; lleva tropas del interior al frente.
 *   dificil  además defiende sus ciudades amenazadas, solo ataca si podrá aguantar
 *            el territorio (salvo ciudades de la persona) y concentra fuerzas.
 */
import { PLAYER, defenseOf, neighborsOf, order, reinforce, territoriesOf } from './frontEngine.js';

export const AI_LEVELS = Object.freeze([
  { id: 'facil', name: 'Fácil', description: 'Juega con calma y te deja aprender: pocos ataques y nunca al principio.' },
  { id: 'normal', name: 'Normal', description: 'Busca ciudades y tus territorios débiles, y refuerza su frente.' },
  { id: 'dificil', name: 'Difícil', description: 'Defiende lo que tiene, concentra fuerzas y solo ataca cuando puede aguantar.' },
]);

const MAX_ORDERS = 14;

function seeded(state) {
  let s = (state.seed * 7919 + state.turn * 104729 + state.factions.indexOf(state.current) * 31) >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const enemyOf = (me, t) => t.owner !== null && t.owner !== me;
const isFrontier = (state, t) => neighborsOf(state.map, t.key).some((k) => state.map[k].owner !== t.owner);

/** Tropas rivales (no neutrales) que pueden atacar este territorio. */
const threatOf = (state, t) =>
  neighborsOf(state.map, t.key)
    .map((k) => state.map[k])
    .filter((n) => enemyOf(t.owner, n))
    .reduce((sum, n) => sum + Math.max(0, n.troops - 1), 0);

/** Valor de un objetivo: ciudades, la capital y los territorios de la persona, primero. */
function targetValue(state, me, target) {
  let value = 1;
  if (target.kind === 'city') value += 4;
  if (target.owner === PLAYER) value += 2;
  if (target.capital) value += 4;
  if (enemyOf(me, target)) value += 1;
  return value;
}

/**
 * Ataques posibles.
 *   Fácil y Normal envían todas las tropas menos una.
 *   Difícil deja en el origen una reserva proporcional a las amenazas que tiene
 *   alrededor (así un gran ejército no avanza por un pasillo dejando atrás
 *   territorios con una tropa que el rival recupera al momento), y solo conquista
 *   lo que podrá conservar.
 */
function attacks(state, me, level) {
  const out = [];
  for (const source of territoriesOf(state, me)) {
    if (state.acted.includes(source.key) || source.troops < 2) continue;
    for (const k of neighborsOf(state.map, source.key)) {
      const target = state.map[k];
      if (target.owner === me) continue;
      // La reserva cubre las amenazas del origen, sin contar la del propio objetivo (conquistarlo la elimina).
      const otherThreat = threatOf(state, source) - (enemyOf(me, target) ? Math.max(0, target.troops - 1) : 0);
      const keep = level === 'dificil' ? Math.max(1, Math.ceil(otherThreat * 0.5)) : 1;
      const send = source.troops - keep;
      if (send < 1) continue;
      const margin = send - defenseOf(target);
      if (margin <= 0) continue;
      out.push({ from: source.key, to: k, k: send, margin, value: targetValue(state, me, target), target });
    }
  }
  return out;
}

/** Dónde colocar refuerzos y cuántos: { key, n }. */
function chooseReinforcement(state, me, level, rng) {
  const own = territoriesOf(state, me);
  const frontier = own.filter((t) => isFrontier(state, t));
  const pool = frontier.length ? frontier : own;
  const all = state.reinforcements;
  if (level === 'facil') return { key: pool[Math.floor(rng() * pool.length)].key, n: all };
  if (level === 'dificil') {
    // Primero, la ciudad propia más amenazada, pero solo con lo necesario para aguantar:
    // el resto va al frente de ataque (si no, una amenaza que crece la tendría siempre a la defensiva).
    const danger = own
      .filter((t) => t.kind === 'city')
      .map((t) => ({ t, gap: threatOf(state, t) - defenseOf(t) }))
      .filter((d) => d.gap >= 0)
      .sort((a, b) => b.gap - a.gap)[0];
    if (danger && !state.reinforcedDanger) return { key: danger.t.key, n: Math.min(all, Math.floor(danger.gap) + 1), danger: true };
  }
  // El frente desde el que se puede conquistar lo más valioso.
  let best = null;
  for (const t of pool) {
    for (const k of neighborsOf(state.map, t.key)) {
      const target = state.map[k];
      if (target.owner === me) continue;
      const need = defenseOf(target) + 1 - (t.troops - 1);
      const score = targetValue(state, me, target) * 10 - Math.max(0, need) - (level === 'dificil' ? threatOf(state, t) * 0.5 : 0);
      if (!best || score > best.score) best = { key: t.key, score };
    }
  }
  return { key: (best ?? { key: pool[0].key }).key, n: all };
}

/** Siguiente acción de la IA, o null cuando quiere terminar el turno. */
export function nextAction(state) {
  const me = state.current;
  const level = state.difficulty;
  const rng = seeded(state);
  if (state.phase === 'reinforce') {
    const choice = chooseReinforcement(state, me, level, rng);
    return { type: 'reinforce', key: choice.key, n: choice.n, danger: choice.danger };
  }
  const done = state.log.filter((e) => e.turn === state.turn && e.faction === me).length;
  if (done >= MAX_ORDERS) return null;

  let options = attacks(state, me, level);
  if (level === 'facil') {
    if (done >= 2) return null;
    options = options.filter((o) => o.margin >= 2 && !(state.turn <= 3 && o.target.owner === PLAYER));
    if (!options.length) return null;
    const pick = options[Math.floor(rng() * options.length)];
    return { type: 'order', from: pick.from, to: pick.to, k: pick.k };
  }
  if (level === 'dificil') {
    options = options.filter((o) => {
      // ¿Aguantará el territorio conquistado? Ciudades de la persona: siempre.
      if (o.target.owner === PLAYER && o.target.kind === 'city') return true;
      const survivors = o.k - Math.ceil(defenseOf(o.target));
      const after = { ...o.target, owner: me, troops: survivors };
      return survivors >= Math.ceil(threatOf(state, after) * 0.5) || o.target.owner === null;
    });
  }
  if (options.length) {
    const pick = options.sort((a, b) => b.value * 10 + b.margin - (a.value * 10 + a.margin))[0];
    return { type: 'order', from: pick.from, to: pick.to, k: pick.k };
  }
  // Sin ataques: llevar tropas del interior al frente.
  for (const t of territoriesOf(state, me)) {
    if (state.acted.includes(t.key) || t.troops < 3 || isFrontier(state, t)) continue;
    const towards = neighborsOf(state.map, t.key)
      .map((k) => state.map[k])
      .filter((n) => n.owner === me)
      .sort((a, b) => Number(isFrontier(state, b)) - Number(isFrontier(state, a)) || threatOf(state, b) - threatOf(state, a))[0];
    if (towards) return { type: 'order', from: t.key, to: towards.key, k: t.troops - 1 };
  }
  return null;
}

/** Aplica una acción de la IA (o null) y devuelve el nuevo estado y si el turno sigue. */
export function applyAction(state, action) {
  if (!action) return { state, done: true };
  if (action.type === 'reinforce') {
    const next = reinforce(state, action.key, action.n);
    // La defensa de urgencia se hace una sola vez por turno; lo que sobra va al ataque.
    return { state: next ? { ...next, reinforcedDanger: next.phase === 'reinforce' && action.danger ? true : undefined } : state, done: !next };
  }
  const outcome = order(state, action.from, action.to, action.k);
  return { state: outcome ? outcome.state : state, done: !outcome, result: outcome?.result };
}
