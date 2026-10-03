/**
 * Niveles de «Aparcar el carro» (originales). Metros, y hacia abajo.
 *
 *   width, height   tamaño del aparcamiento (sus bordes son muros)
 *   start           { x, y, angle } posición inicial del coche (centro)
 *   spot            plaza { x, y, w (largo), h (ancho), angle } — el coche debe acabar
 *                   mirando hacia `angle` (con `either`, hacia cualquiera de los dos lados)
 *   obstacles       rectángulos orientados { x, y, w, h, angle, kind: 'car' | 'cone' | 'wall' | 'planter' }
 *   par             segundos para las tres estrellas
 *
 * Cada nivel tiene una solución comprobada: levels/solutions.js (generada por
 * scripts/plan-parking.mjs) aparca el coche sin tocar nada usando el motor real.
 */
const UP = -Math.PI / 2;
const DOWN = Math.PI / 2;
const RIGHT = 0;
const LEFT = Math.PI;

const parked = (x, y, angle, hue) => ({ x, y, w: 4.3, h: 1.85, angle, kind: 'car', hue });
const cone = (x, y) => ({ x, y, w: 0.55, h: 0.55, angle: 0, kind: 'cone' });
const wall = (x, y, w, h) => ({ x, y, w, h, angle: 0, kind: 'wall' });

export const LEVELS = Object.freeze([
  {
    id: 'primera',
    name: 'Primera plaza',
    tip: 'Avanza y gira con calma: la plaza es amplia.',
    width: 20,
    height: 20,
    start: { x: 5, y: 15, angle: UP },
    spot: { x: 14.5, y: 5.5, w: 5.4, h: 3.4, angle: UP },
    obstacles: [],
    par: 14,
  },
  {
    id: 'conos',
    name: 'Entre conos',
    tip: 'Un pasillo de conos lleva hasta la plaza. No los toques.',
    width: 20,
    height: 22,
    start: { x: 10, y: 18.5, angle: UP },
    spot: { x: 10, y: 3.6, w: 5.2, h: 3.0, angle: UP },
    obstacles: [6.6, 9.6, 12.6].flatMap((y) => [cone(7.4, y), cone(12.6, y)]).concat([wall(3, 4, 6, 1), wall(17, 4, 6, 1)]),
    par: 14,
  },
  {
    id: 'esquina',
    name: 'La esquina',
    tip: 'Gira a tiempo: la plaza está al doblar la esquina.',
    width: 22,
    height: 20,
    start: { x: 4, y: 16, angle: UP },
    spot: { x: 17.6, y: 4.2, w: 5.2, h: 3.0, angle: RIGHT },
    obstacles: [wall(13, 13, 14, 8), parked(17.6, 1.2, RIGHT, 210), parked(17.6, 7.4, RIGHT, 20)],
    par: 18,
  },
  {
    id: 'bateria',
    name: 'En batería',
    tip: 'Entra de frente en el hueco entre los dos coches.',
    width: 22,
    height: 20,
    start: { x: 3.5, y: 15, angle: RIGHT },
    spot: { x: 11, y: 4.2, w: 5.2, h: 3.0, angle: UP },
    obstacles: [parked(5, 4.2, UP, 340), parked(8, 4.2, UP, 200), parked(14, 4.2, UP, 120), parked(17, 4.2, UP, 45)],
    par: 18,
  },
  {
    id: 'reversa',
    name: 'Marcha atrás',
    tip: 'Esta plaza se ocupa marcha atrás: el coche debe quedar mirando al pasillo.',
    width: 22,
    height: 20,
    start: { x: 3.5, y: 13, angle: RIGHT },
    spot: { x: 11, y: 4.2, w: 5.2, h: 3.0, angle: DOWN },
    obstacles: [parked(5, 4.2, DOWN, 260), parked(8, 4.2, DOWN, 15), parked(14, 4.2, UP, 160), parked(17, 4.2, DOWN, 300)],
    par: 24,
  },
  {
    id: 'linea',
    name: 'En línea',
    tip: 'Aparcamiento en paralelo: pasa de largo, da marcha atrás girando y endereza.',
    width: 24,
    height: 16,
    start: { x: 4, y: 7.5, angle: RIGHT },
    spot: { x: 12, y: 2.5, w: 6.4, h: 2.6, angle: RIGHT },
    obstacles: [parked(5.9, 2.4, RIGHT, 90), parked(18.1, 2.4, RIGHT, 0), wall(12, 0.35, 24, 0.7)],
    par: 26,
  },
  {
    id: 'pasillo',
    name: 'Pasillo estrecho',
    tip: 'Cruza el pasillo recto y sin prisa; la plaza espera al final, a la derecha.',
    width: 22,
    height: 22,
    start: { x: 11, y: 19, angle: UP },
    spot: { x: 17.4, y: 3.8, w: 5.2, h: 3.0, angle: RIGHT },
    obstacles: [wall(4.5, 11.5, 9, 3), wall(17.5, 11.5, 9, 3), { ...wall(6, 3.8, 6, 6), kind: 'planter' }, parked(17.4, 0.9, RIGHT, 280), parked(17.4, 6.9, RIGHT, 140)],
    par: 24,
  },
  {
    id: 'final',
    name: 'Todo junto',
    tip: 'Pasillo, giro y marcha atrás en una plaza ajustada. Planifica antes de mover.',
    width: 24,
    height: 22,
    start: { x: 3.5, y: 18.5, angle: RIGHT },
    spot: { x: 18, y: 4, w: 5.0, h: 2.8, angle: DOWN },
    obstacles: [
      wall(9, 12.5, 12, 1.2),
      cone(17, 9.2),
      cone(21.5, 9.2),
      parked(15, 4, DOWN, 30),
      parked(21, 4, UP, 220),
      { ...wall(5, 4.5, 5, 5), kind: 'planter' },
    ],
    par: 30,
  },
]);

export const findLevel = (id) => LEVELS.find((level) => level.id === id) ?? null;
