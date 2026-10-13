/**
 * Motor compartido de los juegos de cocina (Heladería, Pizzería, Pastelería).
 * Sin DOM y determinista con semilla.
 *
 * Una receta (recipes/*.js) describe los pasos de preparación de forma
 * declarativa; el motor genera pedidos según el nivel, guarda lo que la
 * persona va preparando, compara el resultado con el pedido y puntúa.
 *
 * Tipos de paso:
 *   single     una opción entre varias (recipiente, masa, salsa…)
 *   sequence   lista ordenada (bolas de helado de abajo arriba, capas del pastel)
 *   set        conjunto sin orden (toppings, decoraciones)
 *   placement  conjunto de ingredientes, cada uno en toda la pizza o en una mitad
 *   bake       cocción en tiempo real: se saca del horno en el punto pedido
 *
 * Cada paso declara en qué niveles aparece (`from`) y cuántos elementos pide
 * por nivel (`count`). Un paso que aún no aparece no se pide ni se evalúa.
 */
import { createRng } from '../../../services/gameLifecycle.js';

export const LEVEL_IDS = Object.freeze([1, 2, 3]);

/** Configuración común del turno por nivel. */
export const SHIFT = Object.freeze({
  1: { orders: 4, timeLimit: null, label: 'Aprendiz', passAt: 0.7 },
  2: { orders: 5, timeLimit: 90, label: 'Cocinero', passAt: 0.75 },
  3: { orders: 6, timeLimit: 60, label: 'Chef', passAt: 0.8 },
});

/** Cocción: el indicador va de 0 a 1 mientras está en el horno. */
export const BAKE_ZONES = Object.freeze([
  { id: 'cruda', label: 'Cruda', from: 0, to: 0.3 },
  { id: 'poco', label: 'Poco hecha', from: 0.3, to: 0.5 },
  { id: 'media', label: 'Al punto', from: 0.5, to: 0.7 },
  { id: 'bien', label: 'Bien hecha', from: 0.7, to: 0.86 },
  { id: 'quemada', label: 'Quemada', from: 0.86, to: Infinity },
]);
export const BAKE_TARGETS = Object.freeze(['poco', 'media', 'bien']);

export const zoneOf = (value) => (value === null || value === undefined ? null : BAKE_ZONES.find((z) => value >= z.from && value < z.to)?.id ?? 'quemada');
export const zoneLabel = (id) => BAKE_ZONES.find((z) => z.id === id)?.label ?? 'Sin hornear';

export const PLACEMENTS = Object.freeze([
  { id: 'toda', label: 'Toda' },
  { id: 'izq', label: 'Mitad izquierda' },
  { id: 'der', label: 'Mitad derecha' },
]);
export const placementLabel = (id) => PLACEMENTS.find((p) => p.id === id)?.label ?? id;

export const activeSteps = (recipe, level) => recipe.steps.filter((s) => level >= (s.from ?? 1));
const countFor = (step, level) => {
  const c = step.count?.[level] ?? step.count?.[Object.keys(step.count).at(-1)] ?? [1, 1];
  return Array.isArray(c) ? c : [c, c];
};
export const optionLabel = (step, id) => step.options?.find((o) => o.id === id)?.label ?? id;

/** Valor vacío de un paso (lo que hay antes de que la persona elija). */
function emptyValue(step) {
  if (step.kind === 'single') return null;
  if (step.kind === 'bake') return null;
  return [];
}

export function emptyBuild(recipe, level) {
  return Object.fromEntries(activeSteps(recipe, level).map((s) => [s.id, emptyValue(s)]));
}

function pickDistinct(rng, list, n) {
  const pool = [...list];
  const out = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  return out;
}

/** Genera un pedido válido para el nivel. */
export function generateOrder(recipe, level, rng) {
  const order = {};
  for (const step of activeSteps(recipe, level)) {
    const [min, max] = countFor(step, level);
    const ids = step.options?.filter((o) => (o.from ?? 1) <= level).map((o) => o.id) ?? [];
    if (step.kind === 'single') {
      order[step.id] = rng.pick(ids);
    } else if (step.kind === 'sequence') {
      const n = rng.int(min, max);
      // En secuencias se permite repetir, pero no tres iguales seguidas (sería aburrido de leer).
      const seq = [];
      while (seq.length < n) {
        const id = rng.pick(ids);
        if (seq.length >= 2 && seq.at(-1) === id && seq.at(-2) === id) continue;
        seq.push(id);
      }
      order[step.id] = seq;
    } else if (step.kind === 'set') {
      order[step.id] = pickDistinct(rng, ids, rng.int(min, max)).sort();
    } else if (step.kind === 'placement') {
      const places = level >= (step.halvesFrom ?? 99) ? ['toda', 'izq', 'der'] : ['toda'];
      order[step.id] = pickDistinct(rng, ids, rng.int(min, max))
        .map((id) => ({ id, place: rng.pick(places) }))
        .sort((a, b) => a.id.localeCompare(b.id));
    } else if (step.kind === 'bake') {
      order[step.id] = rng.pick(BAKE_TARGETS);
    }
  }
  if (recipe.fixOrder) recipe.fixOrder(order, level);
  return order;
}

export const CUSTOMERS = Object.freeze(['Vega', 'Altair', 'Sirio', 'Lira', 'Antares', 'Polaris', 'Rigel', 'Deneb', 'Capella', 'Aldebarán', 'Spica', 'Electra']);

export function createShift(recipe, level, seed = 1) {
  const rng = createRng(seed);
  const config = SHIFT[level] ?? SHIFT[1];
  const customers = pickDistinct(rng, CUSTOMERS, config.orders);
  const orders = customers.map((customer) => ({ customer, spec: generateOrder(recipe, level, rng) }));
  return { recipe: recipe.id, level, config, orders, index: 0, results: [] };
}

// --- Construcción ----------------------------------------------------------------

export function setSingle(build, stepId, value) {
  return { ...build, [stepId]: value };
}

export function pushItem(build, step, value, level) {
  const [, max] = countFor(step, level);
  const list = build[step.id] ?? [];
  const limit = step.maxBuild ?? max + 1;
  if (list.length >= limit) return build;
  return { ...build, [step.id]: [...list, value] };
}

export function popItem(build, stepId) {
  const list = build[stepId] ?? [];
  return list.length ? { ...build, [stepId]: list.slice(0, -1) } : build;
}

export function toggleItem(build, stepId, value) {
  const list = build[stepId] ?? [];
  return { ...build, [stepId]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value].sort() };
}

/** Coloca un ingrediente en un sitio; si ya estaba en ese sitio se quita, si estaba en otro se mueve. */
export function placeItem(build, stepId, id, place) {
  const list = build[stepId] ?? [];
  const current = list.find((p) => p.id === id);
  const rest = list.filter((p) => p.id !== id);
  const next = current?.place === place ? rest : [...rest, { id, place }];
  return { ...build, [stepId]: next.sort((a, b) => a.id.localeCompare(b.id)) };
}

// --- Evaluación ------------------------------------------------------------------

/**
 * Compara lo preparado con el pedido. Devuelve la precisión (0–1) y, por cada
 * elemento, un estado legible sin depender del color:
 *   ok | wrong | missing | extra | partial
 */
export function evaluate(recipe, level, order, build) {
  const items = [];
  let earned = 0;
  let total = 0;
  for (const step of activeSteps(recipe, level)) {
    const want = order[step.id];
    const have = build[step.id];
    const label = (id) => optionLabel(step, id);
    if (step.kind === 'single') {
      total += 1;
      if (have === want) {
        earned += 1;
        items.push({ step: step.label, status: 'ok', text: label(want) });
      } else {
        items.push({ step: step.label, status: have === null || have === undefined ? 'missing' : 'wrong', text: have ? `${label(have)} (pedían ${label(want)})` : `Falta: ${label(want)}` });
      }
    } else if (step.kind === 'sequence') {
      const length = Math.max(want.length, have.length);
      for (let i = 0; i < length; i += 1) {
        total += 1;
        const pos = `${step.itemLabel ?? 'Elemento'} ${i + 1}`;
        if (i >= have.length) items.push({ step: step.label, status: 'missing', text: `${pos}: falta ${label(want[i])}` });
        else if (i >= want.length) items.push({ step: step.label, status: 'extra', text: `${pos}: ${label(have[i])} sobra` });
        else if (have[i] === want[i]) {
          earned += 1;
          items.push({ step: step.label, status: 'ok', text: `${pos}: ${label(want[i])}` });
        } else {
          // Ingrediente correcto pero en otra posición: medio punto.
          const elsewhere = want.includes(have[i]);
          if (elsewhere) earned += 0.5;
          items.push({ step: step.label, status: elsewhere ? 'partial' : 'wrong', text: `${pos}: ${label(have[i])} (pedían ${label(want[i])}${elsewhere ? ', está en otro orden' : ''})` });
        }
      }
    } else if (step.kind === 'set') {
      const union = new Set([...want, ...have]);
      if (!union.size) {
        total += 1;
        earned += 1;
        items.push({ step: step.label, status: 'ok', text: 'Sin nada, como pedían' });
      }
      for (const id of union) {
        total += 1;
        if (want.includes(id) && have.includes(id)) {
          earned += 1;
          items.push({ step: step.label, status: 'ok', text: label(id) });
        } else if (want.includes(id)) items.push({ step: step.label, status: 'missing', text: `Falta: ${label(id)}` });
        else items.push({ step: step.label, status: 'extra', text: `Sobra: ${label(id)}` });
      }
    } else if (step.kind === 'placement') {
      const ids = new Set([...want.map((p) => p.id), ...have.map((p) => p.id)]);
      for (const id of ids) {
        total += 1;
        const w = want.find((p) => p.id === id);
        const h = have.find((p) => p.id === id);
        if (w && h && w.place === h.place) {
          earned += 1;
          items.push({ step: step.label, status: 'ok', text: `${label(id)} · ${placementLabel(w.place).toLowerCase()}` });
        } else if (w && h) {
          earned += 0.5;
          items.push({ step: step.label, status: 'partial', text: `${label(id)}: en ${placementLabel(h.place).toLowerCase()} (pedían ${placementLabel(w.place).toLowerCase()})` });
        } else if (w) items.push({ step: step.label, status: 'missing', text: `Falta: ${label(id)} (${placementLabel(w.place).toLowerCase()})` });
        else items.push({ step: step.label, status: 'extra', text: `Sobra: ${label(id)}` });
      }
    } else if (step.kind === 'bake') {
      total += 1;
      const zone = zoneOf(have);
      const order3 = ['cruda', 'poco', 'media', 'bien', 'quemada'];
      const distance = zone ? Math.abs(order3.indexOf(zone) - order3.indexOf(want)) : 9;
      if (distance === 0) {
        earned += 1;
        items.push({ step: step.label, status: 'ok', text: zoneLabel(want) });
      } else if (distance === 1 && zone !== 'quemada' && zone !== 'cruda') {
        earned += 0.5;
        items.push({ step: step.label, status: 'partial', text: `${zoneLabel(zone)} (pedían ${zoneLabel(want).toLowerCase()})` });
      } else {
        items.push({ step: step.label, status: zone ? 'wrong' : 'missing', text: zone ? `${zoneLabel(zone)} (pedían ${zoneLabel(want).toLowerCase()})` : `Sin hornear (pedían ${zoneLabel(want).toLowerCase()})` });
      }
    }
  }
  const precision = total ? earned / total : 0;
  return { precision, earned, total, items, perfect: precision === 1 };
}

/** Puntos de un pedido: 100 × precisión + hasta 50 por rapidez (solo con reloj y si la precisión es alta). */
export function scoreOrder(precision, timeLeftFraction = null) {
  const base = Math.round(precision * 100);
  const bonus = timeLeftFraction !== null && precision >= 0.8 ? Math.round(50 * Math.max(0, Math.min(1, timeLeftFraction)) * precision) : 0;
  return { base, bonus, points: base + bonus };
}

/** Registra la entrega del pedido actual y avanza. */
export function deliver(shift, recipe, build, { timeLeftFraction = null } = {}) {
  const order = shift.orders[shift.index];
  const evaluation = evaluate(recipe, shift.level, order.spec, build);
  const score = scoreOrder(evaluation.precision, timeLeftFraction);
  const result = { customer: order.customer, ...evaluation, ...score };
  return { ...shift, index: shift.index + 1, results: [...shift.results, result], last: result };
}

export const isShiftOver = (shift) => shift.index >= shift.orders.length;

export function summarize(shift) {
  const n = shift.results.length;
  const precision = n ? shift.results.reduce((a, r) => a + r.precision, 0) / n : 0;
  const points = shift.results.reduce((a, r) => a + r.points, 0);
  const perfect = shift.results.filter((r) => r.perfect).length;
  const passAt = shift.config.passAt;
  const won = n === shift.orders.length && precision >= passAt;
  const stars = !won ? 0 : precision >= 0.95 ? 3 : precision >= 0.85 ? 2 : 1;
  return { precision, points, perfect, won, stars, orders: n };
}

/** ¿Está el nivel desbloqueado? El 1 siempre; los demás, al superar el anterior. */
export const isLevelUnlocked = (level, progress) => level === 1 || Boolean(progress?.stars?.[level - 1]);

/** Texto legible del pedido (para la comanda y para lectores de pantalla). */
export function describeOrder(recipe, level, spec) {
  const lines = [];
  for (const step of activeSteps(recipe, level)) {
    const v = spec[step.id];
    const label = (id) => optionLabel(step, id);
    if (step.kind === 'single') lines.push({ step: step.label, text: label(v) });
    else if (step.kind === 'sequence') lines.push({ step: step.label, list: v.map((id, i) => `${i + 1}. ${label(id)}`) });
    else if (step.kind === 'set') lines.push({ step: step.label, text: v.length ? v.map(label).join(', ') : 'Nada' });
    else if (step.kind === 'placement') lines.push({ step: step.label, list: v.map((p) => `${label(p.id)} · ${placementLabel(p.place).toLowerCase()}`) });
    else if (step.kind === 'bake') lines.push({ step: step.label, text: zoneLabel(v) });
  }
  return lines;
}
