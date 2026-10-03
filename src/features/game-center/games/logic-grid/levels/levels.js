/**
 * Niveles del juego de lógica.
 *
 * Diseñados con ayuda de un generador y elegidos a mano por forma y dificultad.
 * Cada `limit` es el número MÍNIMO de movimientos que resuelve el nivel, calculado
 * con el solucionador del motor (búsqueda exhaustiva por profundización iterativa).
 * En "Trazo único" el límite es siempre celdas − 1 (cada celda se pisa una vez).
 *
 * Las pruebas (tests/levels.test.js) vuelven a demostrar en cada ejecución que
 * todos los niveles tienen solución con exactamente ese límite y no con uno menor.
 * Si se añade o edita un nivel, las pruebas fallan hasta que el límite sea correcto.
 *
 * Regla común: ninguna casilla se pisa dos veces (ver engine/gridEngine.js).
 * Mapa: '#' muro · '.' celda por cubrir · 'S' salida.
 */

export const LEVELS = [
  {
    id: 'deslizar-01',
    name: 'Primer trazo',
    rule: 'slide',
    limit: 3,
    map: [
      '...S',
      '.###',
      '....',
    ],
  },
  {
    id: 'deslizar-02',
    name: 'Escalón',
    rule: 'slide',
    limit: 3,
    map: [
      '.###',
      '.###',
      '.##S',
      '....',
    ],
  },
  {
    id: 'deslizar-03',
    name: 'Herradura',
    rule: 'slide',
    limit: 4,
    map: [
      '.S...',
      '.###.',
      '.....',
    ],
  },
  {
    id: 'deslizar-04',
    name: 'Bastones',
    rule: 'slide',
    limit: 5,
    map: [
      '.##..',
      '.##..',
      '.##.S',
      '.##.#',
      '....#',
    ],
  },
  {
    id: 'deslizar-05',
    name: 'Esquinas',
    rule: 'slide',
    limit: 6,
    map: [
      '###..',
      '..S..',
      '.##..',
      '.##..',
      '.....',
    ],
  },
  {
    id: 'deslizar-06',
    name: 'Zigzag',
    rule: 'slide',
    limit: 7,
    map: [
      '..##.',
      '.S##.',
      '.....',
      '..###',
      '..###',
    ],
  },
  {
    id: 'deslizar-07',
    name: 'Caracol',
    rule: 'slide',
    limit: 7,
    map: [
      '...##',
      '.#.##',
      '.#S..',
      '.##..',
      '.##..',
      '.....',
    ],
  },
  {
    id: 'deslizar-08',
    name: 'Columnas',
    rule: 'slide',
    limit: 9,
    map: [
      '.....',
      'S..#.',
      '...#.',
      '.#.#.',
      '##.#.',
      '##...',
    ],
  },
  {
    id: 'deslizar-09',
    name: 'Bahía',
    rule: 'slide',
    limit: 9,
    map: [
      '......',
      '.S....',
      '.##..#',
      '.##..#',
      '.#...#',
      '.....#',
    ],
  },
  {
    id: 'deslizar-10',
    name: 'Ventanas',
    rule: 'slide',
    limit: 10,
    map: [
      '....##',
      '......',
      '..S##.',
      '......',
      '.####.',
      '......',
    ],
  },
  {
    id: 'deslizar-11',
    name: 'Gran salón',
    rule: 'slide',
    limit: 10,
    map: [
      '......',
      '......',
      '....#.',
      '.S..#.',
      '.#..#.',
      '......',
    ],
  },
  {
    id: 'deslizar-12',
    name: 'Laberinto',
    rule: 'slide',
    limit: 11,
    map: [
      '.......',
      '.#S###.',
      '.#.....',
      '.#..###',
      '....###',
      '.......',
      '.......',
    ],
  },
  {
    id: 'path-01',
    name: 'Paseo',
    rule: 'path',
    limit: 11,
    map: [
      'S...',
      '....',
      '....',
    ],
  },
  {
    id: 'path-02',
    name: 'Esquina',
    rule: 'path',
    limit: 13,
    map: [
      '.S.#',
      '...#',
      '....',
      '....',
    ],
  },
  {
    id: 'path-03',
    name: 'Columna',
    rule: 'path',
    limit: 21,
    map: [
      '..S..',
      '..#..',
      '.....',
      '...#.',
      '#....',
    ],
  },
  {
    id: 'path-04',
    name: 'Muelle',
    rule: 'path',
    limit: 21,
    map: [
      '.....',
      'S..##',
      '#....',
      '.....',
      '.....',
    ],
  },
  {
    id: 'path-05',
    name: 'Islas',
    rule: 'path',
    limit: 26,
    map: [
      '#...#.',
      '......',
      '...#..',
      '......',
      '.....S',
    ],
  },
  {
    id: 'path-06',
    name: 'Desvío',
    rule: 'path',
    limit: 31,
    map: [
      '..#...',
      '.....S',
      '......',
      '..#...',
      '.#....',
      '.#....',
    ],
  },
  {
    id: 'path-07',
    name: 'Camino único',
    rule: 'path',
    limit: 21,
    map: [
      '...#.',
      '.....',
      '..#..',
      '..S#.',
      '.....',
    ],
  },
  {
    id: 'path-08',
    name: 'Cúpula',
    rule: 'path',
    limit: 31,
    map: [
      '#....#',
      '......',
      '...#..',
      '......',
      '......',
      '.S.#..',
    ],
  },
];

export const SERIES = [
  {
    id: 'slide',
    name: 'Deslizar',
    description: 'Te deslizas hasta un muro o una casilla ya cubierta. Planea el orden: ninguna casilla se repite.',
  },
  {
    id: 'path',
    name: 'Trazo único',
    description: 'Un camino continuo que pisa cada celda una sola vez.',
  },
];

export const levelsOf = (seriesId) => LEVELS.filter((level) => level.rule === seriesId);
export const findLevel = (id) => LEVELS.find((level) => level.id === id) ?? null;
