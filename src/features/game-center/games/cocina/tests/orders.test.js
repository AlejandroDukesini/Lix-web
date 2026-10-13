import { describe, expect, it } from 'vitest';
import { createRng } from '../../../services/gameLifecycle.js';
import {
  SHIFT,
  activeSteps,
  createShift,
  deliver,
  describeOrder,
  emptyBuild,
  evaluate,
  generateOrder,
  isLevelUnlocked,
  isShiftOver,
  placeItem,
  popItem,
  pushItem,
  scoreOrder,
  setSingle,
  summarize,
  toggleItem,
  zoneOf,
} from '../engine/orders.js';
import { HELADERIA, PASTELERIA, PIZZERIA, RECIPES } from '../recipes/recipes.js';

const ALL = Object.values(RECIPES);
const stepOf = (recipe, id) => recipe.steps.find((s) => s.id === id);
/** Construcción idéntica al pedido (como la haría una persona perfecta). */
const perfectBuild = (order, recipe) => {
  const build = structuredClone(order);
  const bake = recipe.steps.find((s) => s.kind === 'bake');
  if (bake) build[bake.id] = { poco: 0.4, media: 0.6, bien: 0.78 }[order[bake.id]];
  return build;
};

describe('pedidos', () => {
  it.each(ALL.flatMap((r) => [1, 2, 3].map((l) => [r.id, l, r])))('%s nivel %i: pedidos válidos para su nivel', (_, level, recipe) => {
    const rng = createRng(level * 101);
    for (let n = 0; n < 60; n += 1) {
      const order = generateOrder(recipe, level, rng);
      const steps = activeSteps(recipe, level);
      expect(Object.keys(order).sort()).toEqual(steps.map((s) => s.id).sort());
      for (const step of steps) {
        const allowed = step.options?.filter((o) => (o.from ?? 1) <= level).map((o) => o.id);
        const value = order[step.id];
        if (step.kind === 'single') expect(allowed).toContain(value);
        if (step.kind === 'bake') expect(['poco', 'media', 'bien']).toContain(value);
        if (step.kind === 'sequence' || step.kind === 'set' || step.kind === 'placement') {
          const [min, max] = step.count[level];
          expect(value.length).toBeGreaterThanOrEqual(min);
          expect(value.length).toBeLessThanOrEqual(max);
          for (const item of value) expect(allowed).toContain(item.id ?? item);
        }
        if (step.kind === 'set') expect(new Set(value).size).toBe(value.length);
        if (step.kind === 'placement' && level < 3) expect(value.every((p) => p.place === 'toda')).toBe(true);
      }
    }
  });

  it('la misma semilla da el mismo turno', () => {
    expect(createShift(PIZZERIA, 2, 9).orders).toEqual(createShift(PIZZERIA, 2, 9).orders);
    expect(createShift(PIZZERIA, 2, 9).orders).not.toEqual(createShift(PIZZERIA, 2, 10).orders);
  });

  it('la dificultad crece: más pasos y más elementos por pedido', () => {
    const size = (recipe, level) => {
      const rng = createRng(3);
      let total = 0;
      for (let i = 0; i < 80; i += 1) {
        const order = generateOrder(recipe, level, rng);
        total += Object.values(order).reduce((a, v) => a + (Array.isArray(v) ? v.length : 1), 0);
      }
      return total / 80;
    };
    for (const recipe of ALL) {
      expect(activeSteps(recipe, 3).length).toBeGreaterThanOrEqual(activeSteps(recipe, 1).length);
      expect(size(recipe, 2)).toBeGreaterThan(size(recipe, 1));
      expect(size(recipe, 3)).toBeGreaterThan(size(recipe, 2));
    }
    expect(SHIFT[3].orders).toBeGreaterThan(SHIFT[1].orders);
    expect(SHIFT[3].timeLimit).toBeLessThan(SHIFT[2].timeLimit);
    expect(SHIFT[1].timeLimit).toBeNull();
    expect(SHIFT[3].passAt).toBeGreaterThan(SHIFT[1].passAt);
  });

  it('en la pizzería de nivel 1 siempre se pide «al punto»', () => {
    const rng = createRng(5);
    for (let i = 0; i < 20; i += 1) expect(generateOrder(PIZZERIA, 1, rng).coccion).toBe('media');
  });

  it('la comanda se puede leer como texto', () => {
    const lines = describeOrder(HELADERIA, 2, { recipiente: 'cono', bolas: ['vainilla', 'chocolate'], salsa: 'caramelo', toppings: [] });
    expect(lines).toContainEqual({ step: 'Bolas', list: ['1. Vainilla', '2. Chocolate'] });
    expect(lines).toContainEqual({ step: 'Toppings', text: 'Nada' });
  });
});

describe('preparación', () => {
  it('añadir, quitar, alternar y colocar', () => {
    let b = emptyBuild(PIZZERIA, 3);
    expect(b).toMatchObject({ tamano: null, ingredientes: [], coccion: null });
    b = setSingle(b, 'tamano', 'grande');
    b = placeItem(b, 'ingredientes', 'pepperoni', 'izq');
    b = placeItem(b, 'ingredientes', 'pepperoni', 'der'); // se mueve
    expect(b.ingredientes).toEqual([{ id: 'pepperoni', place: 'der' }]);
    b = placeItem(b, 'ingredientes', 'pepperoni', 'der'); // mismo sitio: se quita
    expect(b.ingredientes).toEqual([]);

    let h = emptyBuild(HELADERIA, 3);
    const bolas = stepOf(HELADERIA, 'bolas');
    for (let i = 0; i < 9; i += 1) h = pushItem(h, bolas, 'fresa', 3);
    expect(h.bolas).toHaveLength(bolas.maxBuild); // con tope
    h = popItem(h, 'bolas');
    expect(h.bolas).toHaveLength(bolas.maxBuild - 1);
    h = toggleItem(h, 'toppings', 'nueces');
    h = toggleItem(h, 'toppings', 'chispas');
    expect(h.toppings).toEqual(['chispas', 'nueces']);
    h = toggleItem(h, 'toppings', 'nueces');
    expect(h.toppings).toEqual(['chispas']);
  });
});

describe('evaluación', () => {
  it.each(ALL.map((r) => [r.id, r]))('%s: lo mismo que el pedido es 100 % en los tres niveles', (_, recipe) => {
    const rng = createRng(77);
    for (const level of [1, 2, 3]) {
      for (let i = 0; i < 15; i += 1) {
        const order = generateOrder(recipe, level, rng);
        const result = evaluate(recipe, level, order, perfectBuild(order, recipe));
        expect(result.precision).toBe(1);
        expect(result.perfect).toBe(true);
        expect(result.items.every((item) => item.status === 'ok')).toBe(true);
      }
    }
  });

  it('opción equivocada o vacía', () => {
    const order = { recipiente: 'cono', bolas: ['fresa'] };
    const wrong = evaluate(HELADERIA, 1, order, { recipiente: 'tarrina', bolas: ['fresa'] });
    expect(wrong.precision).toBe(0.5);
    expect(wrong.items[0]).toMatchObject({ status: 'wrong', text: 'Tarrina (pedían Cono)' });
    const empty = evaluate(HELADERIA, 1, order, { recipiente: null, bolas: [] });
    expect(empty.precision).toBe(0);
    expect(empty.items.map((i) => i.status)).toEqual(['missing', 'missing']);
  });

  it('el orden de las bolas cuenta: ingrediente bien pero en otro sitio vale medio', () => {
    const order = { recipiente: 'cono', bolas: ['vainilla', 'chocolate'] };
    const swapped = evaluate(HELADERIA, 1, order, { recipiente: 'cono', bolas: ['chocolate', 'vainilla'] });
    expect(swapped.precision).toBeCloseTo((1 + 0.5 + 0.5) / 3);
    expect(swapped.items.filter((i) => i.status === 'partial')).toHaveLength(2);
    const extra = evaluate(HELADERIA, 1, order, { recipiente: 'cono', bolas: ['vainilla', 'chocolate', 'fresa'] });
    expect(extra.items.at(-1)).toMatchObject({ status: 'extra' });
    expect(extra.precision).toBeCloseTo(3 / 4);
  });

  it('toppings y decoraciones: faltan y sobran', () => {
    const order = { forma: 'redondo', capas: ['chocolate'], cobertura: 'fresa', decoracion: ['fresas', 'velas'] };
    const r = evaluate(PASTELERIA, 1, order, { ...order, decoracion: ['velas', 'chispas'] });
    const deco = r.items.filter((i) => i.step === 'Decoración');
    expect(deco.map((i) => i.status).sort()).toEqual(['extra', 'missing', 'ok']);
    expect(r.precision).toBeCloseTo(4 / 6);
  });

  it('ingredientes por mitades: en otra mitad vale medio', () => {
    const order = { tamano: 'grande', masa: 'fina', salsa: 'tomate', queso: 'mozzarella', ingredientes: [{ id: 'pepperoni', place: 'izq' }], coccion: 'media' };
    const r = evaluate(PIZZERIA, 3, order, { ...order, ingredientes: [{ id: 'pepperoni', place: 'der' }], coccion: 0.6 });
    expect(r.items.find((i) => i.step === 'Ingredientes').status).toBe('partial');
    expect(r.precision).toBeCloseTo(5.5 / 6);
  });

  it('cocción: zona exacta, contigua (medio) y quemada (nada)', () => {
    expect(zoneOf(0.1)).toBe('cruda');
    expect(zoneOf(0.6)).toBe('media');
    expect(zoneOf(0.95)).toBe('quemada');
    const order = { tamano: 'pequena', salsa: 'tomate', queso: 'mozzarella', ingredientes: [{ id: 'pepperoni', place: 'toda' }], coccion: 'bien' };
    const bake = (value) => evaluate(PIZZERIA, 1, order, { ...order, coccion: value }).items.find((i) => i.step === 'Cocción').status;
    expect(bake(0.78)).toBe('ok');
    expect(bake(0.6)).toBe('partial');
    expect(bake(0.95)).toBe('wrong');
    expect(bake(null)).toBe('missing');
  });
});

describe('puntuación y turno', () => {
  it('puntos por precisión y bono de rapidez solo si la precisión es alta', () => {
    expect(scoreOrder(1)).toEqual({ base: 100, bonus: 0, points: 100 });
    expect(scoreOrder(1, 0.5)).toEqual({ base: 100, bonus: 25, points: 125 });
    expect(scoreOrder(0.5, 1).bonus).toBe(0);
  });

  it('un turno perfecto se supera con 3 estrellas; uno flojo no se supera', () => {
    let shift = createShift(PASTELERIA, 2, 4);
    while (!isShiftOver(shift)) shift = deliver(shift, PASTELERIA, perfectBuild(shift.orders[shift.index].spec, PASTELERIA), { timeLeftFraction: 0.5 });
    const good = summarize(shift);
    expect(good).toMatchObject({ won: true, stars: 3, perfect: SHIFT[2].orders, orders: SHIFT[2].orders });
    expect(good.points).toBe(SHIFT[2].orders * 125);

    let bad = createShift(PASTELERIA, 2, 4);
    while (!isShiftOver(bad)) bad = deliver(bad, PASTELERIA, emptyBuild(PASTELERIA, 2));
    expect(summarize(bad)).toMatchObject({ won: false, stars: 0, precision: 0 });
  });

  it('los niveles se desbloquean en orden', () => {
    expect(isLevelUnlocked(1, {})).toBe(true);
    expect(isLevelUnlocked(2, {})).toBe(false);
    expect(isLevelUnlocked(2, { stars: { 1: 1 } })).toBe(true);
    expect(isLevelUnlocked(3, { stars: { 1: 3 } })).toBe(false);
  });
});
