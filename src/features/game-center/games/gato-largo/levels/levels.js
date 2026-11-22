/**
 * Habitaciones del Gato largo.
 *
 * Generadas con una semilla fija y elegidas por el solucionador del motor: todas
 * tienen solución, y casi todas una única forma de llenar la habitación. Las
 * pruebas (tests/catEngine.test.js) lo vuelven a demostrar en cada ejecución.
 *
 * Mapa: '#' mueble · '.' suelo · 'S' el rincón donde duerme el gato.
 */
export const TIERS = Object.freeze([
  { id: 'facil', label: 'Fácil', note: 'Habitaciones pequeñas' },
  { id: 'medio', label: 'Medio', note: '6 × 6 y más muebles' },
  { id: 'dificil', label: 'Difícil', note: 'Varios caminos que parecen buenos' },
  { id: 'avanzado', label: 'Avanzado', note: 'Salones de 7 × 7 y 7 × 8' },
]);

export const LEVELS = Object.freeze([
  {
    id: 'facil-01',
    tier: 'facil',
    map: [
      '....',
      '....',
      '...#',
      '.S..',
    ],
  },
  {
    id: 'facil-02',
    tier: 'facil',
    map: [
      '.....',
      '.....',
      'S....',
      '..#..',
      '....#',
    ],
  },
  {
    id: 'facil-03',
    tier: 'facil',
    map: [
      '.....',
      '.....',
      '.....',
      '.S#..',
    ],
  },
  {
    id: 'facil-04',
    tier: 'facil',
    map: [
      '....',
      '..#.',
      '....',
      '.S..',
    ],
  },
  {
    id: 'facil-05',
    tier: 'facil',
    map: [
      '.....',
      '.....',
      '....#',
      '..S..',
    ],
  },
  {
    id: 'facil-06',
    tier: 'facil',
    map: [
      '....',
      '.S..',
      '....',
      '#...',
    ],
  },
  {
    id: 'facil-07',
    tier: 'facil',
    map: [
      '...#',
      '##..',
      '..S.',
      '....',
    ],
  },
  {
    id: 'facil-08',
    tier: 'facil',
    map: [
      '.....',
      '.#...',
      '.....',
      '.....',
      '..S..',
    ],
  },
  {
    id: 'medio-01',
    tier: 'medio',
    map: [
      '......',
      '......',
      '##....',
      '.S.##.',
      '......',
    ],
  },
  {
    id: 'medio-02',
    tier: 'medio',
    map: [
      '......',
      '...##.',
      '.S....',
      '......',
      '......',
    ],
  },
  {
    id: 'medio-03',
    tier: 'medio',
    map: [
      '......',
      '.#....',
      '.S....',
      '......',
      '...#..',
      '.....#',
    ],
  },
  {
    id: 'medio-04',
    tier: 'medio',
    map: [
      '..#...',
      '..#.S.',
      '...##.',
      '.#....',
      '...#..',
    ],
  },
  {
    id: 'medio-05',
    tier: 'medio',
    map: [
      '......',
      '......',
      '..##..',
      '......',
      '..S...',
      '......',
    ],
  },
  {
    id: 'medio-06',
    tier: 'medio',
    map: [
      '...#..',
      '.#....',
      '......',
      '...S#.',
      '......',
    ],
  },
  {
    id: 'medio-07',
    tier: 'medio',
    map: [
      '......',
      '.#....',
      '...#..',
      '#..S..',
      '......',
      '......',
    ],
  },
  {
    id: 'medio-08',
    tier: 'medio',
    map: [
      '......',
      '..S#..',
      '.....#',
      '......',
      '.#..#.',
      '......',
    ],
  },
  {
    id: 'dificil-01',
    tier: 'dificil',
    map: [
      '......',
      '...S#.',
      '#...#.',
      '#.....',
      '......',
      '......',
    ],
  },
  {
    id: 'dificil-02',
    tier: 'dificil',
    map: [
      '....S#',
      '......',
      '#.....',
      '..#...',
      '....#.',
      '......',
    ],
  },
  {
    id: 'dificil-03',
    tier: 'dificil',
    map: [
      '.....#',
      '.....#',
      '..S...',
      '....#.',
      '......',
      '...###',
    ],
  },
  {
    id: 'dificil-04',
    tier: 'dificil',
    map: [
      '......',
      '...#..',
      '......',
      '..#.S.',
      '....#.',
      '......',
    ],
  },
  {
    id: 'dificil-05',
    tier: 'dificil',
    map: [
      '.......',
      '..#..#.',
      '..#....',
      '..#.S..',
      '.......',
      '.......',
    ],
  },
  {
    id: 'dificil-06',
    tier: 'dificil',
    map: [
      '......',
      '...#S.',
      '.#....',
      '....##',
      '......',
      '......',
    ],
  },
  {
    id: 'dificil-07',
    tier: 'dificil',
    map: [
      '#.....',
      '#.....',
      '...S..',
      '......',
      '....#.',
      '......',
    ],
  },
  {
    id: 'dificil-08',
    tier: 'dificil',
    map: [
      '#.....',
      '..##..',
      '.....#',
      '......',
      '....S.',
      '......',
    ],
  },
  {
    id: 'avanzado-01',
    tier: 'avanzado',
    map: [
      '......##',
      '........',
      '...#.##.',
      '......#.',
      '...S#...',
      '.#......',
      '........',
    ],
  },
  {
    id: 'avanzado-02',
    tier: 'avanzado',
    map: [
      '#...#..',
      '..#....',
      '.#.....',
      '.#....S',
      '.......',
      '.......',
      '.......',
    ],
  },
  {
    id: 'avanzado-03',
    tier: 'avanzado',
    map: [
      '##.....',
      '.S.....',
      '....#..',
      '..#..#.',
      '...#...',
      '.#.....',
      '.......',
    ],
  },
  {
    id: 'avanzado-04',
    tier: 'avanzado',
    map: [
      '.......',
      '.......',
      '..#....',
      '###....',
      '.....S.',
      '.....#.',
      '..##...',
    ],
  },
  {
    id: 'avanzado-05',
    tier: 'avanzado',
    map: [
      '.......',
      '.#.....',
      '.#..#..',
      '.......',
      '#..S.#.',
      '.....#.',
      '.......',
    ],
  },
  {
    id: 'avanzado-06',
    tier: 'avanzado',
    map: [
      '..#....',
      '.....#.',
      '.#.#...',
      '......#',
      '....S..',
      '.#...#.',
      '...#...',
    ],
  },
]);
