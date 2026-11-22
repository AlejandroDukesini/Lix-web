/**
 * Hamburguesería — motor puro (sin React) de la jornada por estaciones.
 *
 *  Pedidos   llega un cliente y su comanda: capas de abajo arriba y el punto de la carne.
 *  Parrilla  cada carne tiene dos caras que se cocinan en tiempo real; hay que voltear y retirar.
 *  Montaje   se apilan las capas en orden; las carnes llegan desde la bandeja con su punto.
 *  Entrega   se compara con la comanda: ingredientes, orden, cocción y tiempo → nota y monedas.
 */
import { createRng } from '../../../services/gameLifecycle.js';

/** Ingredientes. `from` = día en que se desbloquea. */
export const INGREDIENTS = Object.freeze({
  'pan-base': { label: 'Pan de abajo', kind: 'bun', from: 1 },
  carne: { label: 'Carne', kind: 'patty', from: 1 },
  queso: { label: 'Queso', kind: 'layer', from: 1 },
  lechuga: { label: 'Lechuga', kind: 'layer', from: 1 },
  tomate: { label: 'Tomate', kind: 'layer', from: 1 },
  cebolla: { label: 'Cebolla', kind: 'layer', from: 2 },
  ketchup: { label: 'Kétchup', kind: 'sauce', from: 2 },
  pepinillos: { label: 'Pepinillos', kind: 'layer', from: 3 },
  mostaza: { label: 'Mostaza', kind: 'sauce', from: 3 },
  bacon: { label: 'Bacon', kind: 'layer', from: 4 },
  mayonesa: { label: 'Mayonesa', kind: 'sauce', from: 4 },
  'pan-tapa': { label: 'Pan de arriba', kind: 'bun', from: 1 },
});
export const INGREDIENT_IDS = Object.keys(INGREDIENTS);
export const unlockedIngredients = (day) => INGREDIENT_IDS.filter((id) => INGREDIENTS[id].from <= day);
export const newIngredientsOn = (day) => INGREDIENT_IDS.filter((id) => INGREDIENTS[id].from === day && day > 1);

/** Punto de la carne: valor de cocción de cada cara (0 cruda … 1 al límite). */
export const DONENESS = Object.freeze([
  { id: 'cruda', label: 'Cruda', to: 0.35 },
  { id: 'poco', label: 'Poco hecha', to: 0.6 },
  { id: 'perfecta', label: 'Al punto', to: 0.85 },
  { id: 'hecha', label: 'Muy hecha', to: 1.05 },
  { id: 'quemada', label: 'Quemada', to: Infinity },
]);
const DONENESS_INDEX = Object.fromEntries(DONENESS.map((d, i) => [d.id, i]));
export const donenessLabel = (id) => DONENESS.find((d) => d.id === id)?.label ?? id;
const sideClass = (v) => DONENESS.find((d) => v < d.to).id;

/** Punto de una carne: el de su cara menos hecha, salvo que alguna se haya quemado. */
export function pattyDoneness(patty) {
  const [a, b] = patty.sides;
  if (Math.max(a, b) >= 1.05) return 'quemada';
  const low = sideClass(Math.min(a, b));
  const high = sideClass(Math.max(a, b));
  if (high === 'hecha') return low === 'cruda' || low === 'poco' ? low : 'hecha';
  return low;
}

export const GRILL_SPEED = 1 / 11; // fracción de cara por segundo (≈ 7 s hasta «al punto»)
export const MAX_SIDE = 1.25;

/** Cocina la cara que está sobre la plancha. */
export function cookPatty(patty, dt, speed = GRILL_SPEED) {
  const sides = [...patty.sides];
  sides[patty.down] = Math.min(MAX_SIDE, sides[patty.down] + dt * speed);
  return { ...patty, sides };
}
export const flipPatty = (patty) => ({ ...patty, down: 1 - patty.down, flips: patty.flips + 1 });
export const newPatty = (id) => ({ id, sides: [0, 0], down: 0, flips: 0 });

/** Configuración de la jornada según el día. */
export function dayConfig(day) {
  return {
    customers: Math.min(8, 3 + day),
    arrivalEvery: Math.max(9, 22 - day * 2), // segundos entre clientes
    patience: Math.max(70, 120 - day * 6), // segundos que esperan de buen humor
    doubleFrom: 3,
    wellDoneFrom: 3,
  };
}

const NAMES = ['Vega', 'Altair', 'Lyra', 'Orión', 'Sirio', 'Electra', 'Rigel', 'Maia', 'Deneb', 'Antares', 'Capella', 'Mira', 'Atlas', 'Nova', 'Polaris', 'Elnath'];
const LOOKS = [
  { skin: '#f2c9a0', hair: '#3b2a1f', shirt: '#e86a5a' },
  { skin: '#c68b5e', hair: '#1f1a17', shirt: '#3f7fd8' },
  { skin: '#8d5a3b', hair: '#111', shirt: '#2fa36b' },
  { skin: '#f6d7b8', hair: '#c9762f', shirt: '#8e5bd6' },
  { skin: '#e0a878', hair: '#6b4a2b', shirt: '#f08c2a' },
  { skin: '#a8714a', hair: '#2a2a2a', shirt: '#1fb3b0' },
];

/** Comanda: capas de abajo arriba y el punto pedido para la carne. */
export function createOrder(rng, day, index) {
  const config = dayConfig(day);
  const available = unlockedIngredients(day);
  const toppings = available.filter((id) => INGREDIENTS[id].kind === 'layer');
  const sauces = available.filter((id) => INGREDIENTS[id].kind === 'sauce');
  const pick = (list) => list[Math.floor(rng() * list.length)];
  const patties = day >= config.doubleFrom && rng() < 0.35 ? 2 : 1;
  const layers = ['pan-base'];
  if (sauces.length && rng() < 0.5) layers.push(pick(sauces));
  for (let p = 0; p < patties; p += 1) {
    layers.push('carne');
    if (rng() < (p === 0 ? 0.75 : 0.5)) layers.push('queso');
  }
  const count = Math.min(toppings.length, 1 + Math.floor(rng() * Math.min(4, 1 + day)));
  const chosen = [...toppings.filter((t) => t !== 'queso')].sort(() => rng() - 0.5).slice(0, count);
  layers.push(...chosen);
  if (sauces.length && rng() < 0.55) layers.push(pick(sauces));
  layers.push('pan-tapa');
  const doneness = day >= config.wellDoneFrom && rng() < 0.3 ? 'hecha' : 'perfecta';
  return {
    id: `p${day}-${index}`,
    customer: NAMES[Math.floor(rng() * NAMES.length)],
    look: LOOKS[Math.floor(rng() * LOOKS.length)],
    layers,
    doneness,
    patience: config.patience,
  };
}

/** Jornada completa: los clientes del día y cuándo llegan. */
export function createDay(day, seed = Date.now() >>> 0) {
  const rng = createRng(seed);
  const config = dayConfig(day);
  const orders = Array.from({ length: config.customers }, (_, i) => ({ ...createOrder(rng, day, i), arrivesAt: i === 0 ? 0 : 3 + i * config.arrivalEvery + Math.floor(rng() * 4) }));
  return { day, orders, config };
}

/** Subsecuencia común más larga (para valorar el orden de las capas). */
function lcs(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i += 1)
    for (let j = 1; j <= b.length; j += 1) dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
  return dp[a.length][b.length];
}

const countBy = (list) => list.reduce((acc, id) => ((acc[id] = (acc[id] ?? 0) + 1), acc), {});

export const GRADES = Object.freeze({
  excelente: { label: '¡Excelente!', tone: 'win' },
  'muy-bien': { label: 'Muy bien', tone: 'win' },
  correcto: { label: 'Correcto', tone: 'neutral' },
  incompleto: { label: 'Pedido incompleto', tone: 'lose' },
  incorrecto: { label: 'Pedido incorrecto', tone: 'lose' },
});

/**
 * Evalúa una hamburguesa servida.
 *   build: [{ id, doneness? }] de abajo arriba
 *   waited: segundos que esperó el cliente desde que pidió
 * Devuelve las puntuaciones parciales (0–1), el total (0–100), la nota, el detalle y las monedas.
 */
export function evaluate(order, build, waited) {
  const wanted = order.layers;
  const served = build.map((b) => b.id);
  const want = countBy(wanted);
  const got = countBy(served);
  const items = [];
  let matched = 0;
  let missingCount = 0;
  for (const id of Object.keys(want)) {
    const ok = Math.min(want[id], got[id] ?? 0);
    matched += ok;
    if (want[id] > ok) {
      missingCount += want[id] - ok;
      items.push({ status: 'missing', text: `${INGREDIENTS[id].label}${want[id] - ok > 1 ? ` ×${want[id] - ok}` : ''}` });
    }
  }
  let extras = 0;
  for (const id of Object.keys(got)) {
    const over = got[id] - (want[id] ?? 0);
    if (over > 0) {
      extras += over;
      items.push({ status: 'extra', text: `${INGREDIENTS[id].label}${over > 1 ? ` ×${over}` : ''}` });
    }
  }
  const ingredients = Math.max(0, (matched - extras * 0.5) / wanted.length);
  const order_ = served.length ? lcs(wanted, served) / Math.max(wanted.length, served.length) : 0;
  if (matched === wanted.length && !extras && order_ < 1) items.push({ status: 'partial', text: 'Las capas están en otro orden' });

  const patties = build.filter((b) => b.id === 'carne');
  let cooking = 0;
  if (patties.length) {
    const target = DONENESS_INDEX[order.doneness];
    for (const p of patties) {
      const diff = Math.abs(DONENESS_INDEX[p.doneness] - target);
      const value = p.doneness === 'quemada' || p.doneness === 'cruda' ? 0 : diff === 0 ? 1 : diff === 1 ? 0.5 : 0;
      cooking += value;
      items.push({ status: value === 1 ? 'ok' : value > 0 ? 'partial' : 'wrong', text: `Carne ${donenessLabel(p.doneness).toLowerCase()} (pedía ${donenessLabel(order.doneness).toLowerCase()})` });
    }
    cooking /= Math.max(patties.length, want.carne ?? 1);
  }

  const time = waited <= order.patience * 0.5 ? 1 : waited >= order.patience ? 0.2 : 1 - ((waited - order.patience * 0.5) / (order.patience * 0.5)) * 0.8;
  if (time < 0.6) items.push({ status: time <= 0.2 ? 'wrong' : 'partial', text: `Esperó ${Math.round(waited)} s` });
  if (!items.length || items.every((i) => i.status === 'ok')) items.unshift({ status: 'ok', text: 'Ingredientes y orden exactos' });

  const total = Math.round((ingredients * 0.4 + order_ * 0.2 + cooking * 0.25 + time * 0.15) * 100);
  // Si falta algo, nunca pasa de «incompleto» (y si casi nada coincide, es incorrecto).
  const grade = missingCount
    ? matched / wanted.length >= 0.5
      ? 'incompleto'
      : 'incorrecto'
    : total >= 90
      ? 'excelente'
      : total >= 75
        ? 'muy-bien'
        : total >= 55
          ? 'correcto'
          : 'incorrecto';
  const coins = Math.round(total / 10) + (grade === 'excelente' ? Math.round(time * 6) : grade === 'muy-bien' ? Math.round(time * 3) : 0);
  return { scores: { ingredients, order: order_, cooking, time }, total, grade, items, coins, tip: coins - Math.round(total / 10) };
}

/** Mejoras de la cocina (se compran con monedas entre jornadas). */
export const UPGRADES = Object.freeze([
  { id: 'plancha', label: 'Plancha más grande', text: 'Dos huecos más en la parrilla (de 3 a 5 carnes a la vez).', cost: 40 },
  { id: 'campana', label: 'Campanita de volteo', text: 'Suena y brilla cuando una cara llega a su punto.', cost: 30 },
  { id: 'musica', label: 'Música en el local', text: 'Los clientes esperan de buen humor un 25 % más.', cost: 50 },
]);
export const grillSlots = (upgrades) => (upgrades?.plancha ? 5 : 3);
export const patienceFactor = (upgrades) => (upgrades?.musica ? 1.25 : 1);

/** Resumen de la jornada: media, estrellas (1–3) y monedas. */
export function summarizeDay(results) {
  const total = results.reduce((a, r) => a + r.total, 0);
  const average = results.length ? total / results.length : 0;
  const coins = results.reduce((a, r) => a + r.coins, 0);
  const stars = average >= 85 ? 3 : average >= 65 ? 2 : 1;
  return { average, coins, stars, excellent: results.filter((r) => r.grade === 'excelente').length, served: results.length };
}
