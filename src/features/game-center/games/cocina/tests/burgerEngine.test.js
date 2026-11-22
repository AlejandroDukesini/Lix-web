import { describe, expect, it } from 'vitest';
import {
  INGREDIENTS,
  cookPatty,
  createDay,
  createOrder,
  evaluate,
  flipPatty,
  grillSlots,
  newIngredientsOn,
  newPatty,
  pattyDoneness,
  summarizeDay,
  unlockedIngredients,
} from '../engine/burgerEngine.js';
import { createRng } from '../../../services/gameLifecycle.js';

const cookSides = (a, b) => ({ ...newPatty('t'), sides: [a, b] });
const order = (layers, doneness = 'perfecta', patience = 100) => ({ layers, doneness, patience });
const perfect = (layers) => layers.map((id) => (id === 'carne' ? { id, doneness: 'perfecta' } : { id }));

describe('Hamburguesería · parrilla', () => {
  it('solo se cocina la cara que está sobre la plancha, y voltear cambia de cara', () => {
    let p = newPatty('a');
    p = cookPatty(p, 5, 0.1);
    expect(p.sides[0]).toBeCloseTo(0.5);
    expect(p.sides[1]).toBe(0);
    p = flipPatty(p);
    p = cookPatty(p, 2, 0.1);
    expect(p.sides).toEqual([0.5, expect.closeTo(0.2)]);
    expect(p.flips).toBe(1);
  });

  it('estados de cocción: cruda, poco hecha, al punto, muy hecha y quemada', () => {
    expect(pattyDoneness(cookSides(0.7, 0.1))).toBe('cruda');
    expect(pattyDoneness(cookSides(0.7, 0.45))).toBe('poco');
    expect(pattyDoneness(cookSides(0.7, 0.75))).toBe('perfecta');
    expect(pattyDoneness(cookSides(0.9, 0.95))).toBe('hecha');
    expect(pattyDoneness(cookSides(0.7, 1.1))).toBe('quemada');
  });

  it('la cocción no pasa del máximo', () => {
    expect(cookPatty(newPatty('a'), 1000).sides[0]).toBe(1.25);
  });

  it('la plancha grande añade huecos', () => {
    expect(grillSlots({})).toBe(3);
    expect(grillSlots({ plancha: true })).toBe(5);
  });
});

describe('Hamburguesería · pedidos y progresión', () => {
  it('las comandas empiezan y terminan con pan y solo usan ingredientes desbloqueados', () => {
    const rng = createRng(7);
    for (let day = 1; day <= 6; day += 1) {
      const allowed = new Set(unlockedIngredients(day));
      for (let i = 0; i < 30; i += 1) {
        const o = createOrder(rng, day, i);
        expect(o.layers[0]).toBe('pan-base');
        expect(o.layers.at(-1)).toBe('pan-tapa');
        expect(o.layers).toContain('carne');
        for (const id of o.layers) expect(allowed.has(id), `${id} en día ${day}`).toBe(true);
        if (day < 3) expect(o.doneness).toBe('perfecta');
      }
    }
  });

  it('cada día trae más clientes y nuevos ingredientes', () => {
    expect(createDay(1, 1).orders.length).toBeLessThan(createDay(4, 1).orders.length);
    expect(newIngredientsOn(2)).toEqual(['cebolla', 'ketchup']);
    expect(unlockedIngredients(1).every((id) => INGREDIENTS[id].from === 1)).toBe(true);
    const arrivals = createDay(3, 9).orders.map((o) => o.arrivesAt);
    expect([...arrivals].sort((a, b) => a - b)).toEqual(arrivals);
    expect(arrivals[0]).toBe(0);
  });
});

describe('Hamburguesería · entrega y puntuación', () => {
  const layers = ['pan-base', 'carne', 'queso', 'lechuga', 'pan-tapa'];

  it('un pedido exacto, al punto y rápido es excelente', () => {
    const r = evaluate(order(layers), perfect(layers), 10);
    expect(r.total).toBe(100);
    expect(r.grade).toBe('excelente');
    expect(r.coins).toBeGreaterThan(10);
  });

  it('faltan ingredientes → pedido incompleto, y se dice cuáles', () => {
    const r = evaluate(order(layers), perfect(['pan-base', 'carne', 'pan-tapa']), 10);
    expect(r.grade).toBe('incompleto');
    expect(r.items.filter((i) => i.status === 'missing').map((i) => i.text)).toEqual(['Queso', 'Lechuga']);
  });

  it('ingredientes que sobran y orden cambiado restan', () => {
    const extra = evaluate(order(layers), perfect([...layers.slice(0, -1), 'tomate', 'pan-tapa']), 10);
    expect(extra.items.some((i) => i.status === 'extra' && i.text === 'Tomate')).toBe(true);
    expect(extra.total).toBeLessThan(100);
    const swapped = evaluate(order(layers), perfect(['pan-base', 'lechuga', 'queso', 'carne', 'pan-tapa']), 10);
    expect(swapped.scores.order).toBeLessThan(1);
    expect(swapped.scores.ingredients).toBe(1);
  });

  it('la cocción cuenta: quemada no puntúa, un punto de diferencia vale la mitad', () => {
    const burnt = evaluate(order(layers), [{ id: 'pan-base' }, { id: 'carne', doneness: 'quemada' }, { id: 'queso' }, { id: 'lechuga' }, { id: 'pan-tapa' }], 10);
    expect(burnt.scores.cooking).toBe(0);
    const near = evaluate(order(layers), [{ id: 'pan-base' }, { id: 'carne', doneness: 'hecha' }, { id: 'queso' }, { id: 'lechuga' }, { id: 'pan-tapa' }], 10);
    expect(near.scores.cooking).toBe(0.5);
    const wellDone = evaluate(order(layers, 'hecha'), [{ id: 'pan-base' }, { id: 'carne', doneness: 'hecha' }, { id: 'queso' }, { id: 'lechuga' }, { id: 'pan-tapa' }], 10);
    expect(wellDone.scores.cooking).toBe(1);
  });

  it('el tiempo de espera reduce la nota', () => {
    const fast = evaluate(order(layers), perfect(layers), 10);
    const slow = evaluate(order(layers), perfect(layers), 95);
    const late = evaluate(order(layers), perfect(layers), 200);
    expect(fast.scores.time).toBe(1);
    expect(slow.scores.time).toBeLessThan(0.5);
    expect(late.scores.time).toBe(0.2);
    expect(late.total).toBeLessThan(fast.total);
  });

  it('una hamburguesa equivocada es pedido incorrecto', () => {
    const r = evaluate(order(layers), perfect(['tomate', 'pepinillos']), 150);
    expect(['incompleto', 'incorrecto']).toContain(r.grade);
    expect(r.total).toBeLessThan(40);
  });

  it('resumen del día: media, monedas y estrellas', () => {
    const s = summarizeDay([
      { total: 100, coins: 15, grade: 'excelente' },
      { total: 80, coins: 9, grade: 'muy-bien' },
    ]);
    expect(s).toMatchObject({ average: 90, coins: 24, stars: 3, excellent: 1, served: 2 });
  });
});
