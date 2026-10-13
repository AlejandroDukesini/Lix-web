/**
 * Niveles de «Lava y Agua».
 *
 * Salvo el primero (tutorial), salieron de un generador filtrado con el
 * solucionador del motor y solo se aceptaron si:
 *  - tienen solución (en turnos, esperas incluidas) y ninguna más corta que `par`;
 *  - el camino más corto «a ciegas» (ignorando los líquidos) termina en la lava:
 *    hay que pensar, no basta con ir recto;
 *  - cada mecánica es necesaria: en «agua» la solución pisa piedra creada por el
 *    agua; en «compuerta» sin pisar la palanca no hay solución; en «lava espesa»
 *    con lava normal no hay solución.
 * Las pruebas vuelven a comprobar todo esto con el motor real.
 */
export const LEVELS = Object.freeze([
  {
    id: 'primer-paso',
    name: 'Primer paso',
    tier: 'lava',
    hint: 'La lava avanza una casilla por cada paso tuyo. Corre hacia la salida.',
    par: 6,
    rows: ['#########', '#L......#', '#.......#', '#P.....E#', '#########'],
  },
  {
    id: 'rodeo',
    name: 'El rodeo',
    tier: 'lava',
    hint: 'El camino directo pasa demasiado cerca de la lava. Busca otro.',
    par: 9,
    rows: ['##########', '#.....####', '#...#L#P.#', '#...##...#', '##.#...#.#', '#.....#.##', '#.E..#.###', '##########'],
  },
  {
    id: 'escalera',
    name: 'Escalera',
    tier: 'lava',
    hint: 'Sube antes de girar: la lava de abajo llega más lejos de lo que parece.',
    par: 9,
    rows: ['###########', '#........##', '#.........#', '#E......#.#', '#.#..##.###', '#..####...#', '##.....P..#', '#.....L...#', '###########'],
  },
  {
    id: 'laberinto',
    name: 'Laberinto caliente',
    tier: 'lava',
    hint: 'Cuenta las casillas: cada paso tuyo es un paso de la lava.',
    par: 12,
    rows: ['############', '#.....##...#', '#E.....#...#', '#...##.....#', '##....###..#', '##...##.P..#', '##......#L.#', '############'],
  },
  {
    id: 'agua-que-enfria',
    name: 'Agua que enfría',
    tier: 'agua',
    hint: 'Donde el agua toca la lava aparece piedra. La piedra se pisa y frena la lava.',
    par: 11,
    rows: ['###########', '#P.L.....##', '#..#...#..#', '#...W.#...#', '##.......E#', '#.......#.#', '##.#......#', '###########'],
  },
  {
    id: 'muro-de-piedra',
    name: 'Muro de piedra',
    tier: 'agua',
    hint: 'Deja que el agua levante un muro entre tú y la lava.',
    par: 10,
    rows: ['###########', '##L#W.....#', '#.##....E##', '#P##......#', '#.W.......#', '#...#.L.#.#', '#........##', '###########'],
  },
  {
    id: 'dos-rios',
    name: 'Dos ríos',
    tier: 'agua',
    hint: 'Dos lavas y dos aguas. El agua se puede pisar: no hace daño.',
    par: 12,
    rows: ['############', '#.#...W..E.#', '###........#', '##....#....#', '#...#.L..L##', '#.W#..#....#', '#.P.....#..#', '############'],
  },
  {
    id: 'la-compuerta',
    name: 'La compuerta',
    tier: 'compuerta',
    hint: 'Pisa la palanca para abrir su compuerta: el agua saldrá a frenar la lava.',
    par: 9,
    rows: ['###########', '#P......#.#', '#..a...#..#', '#.....AWE.#', '#......#.L#', '#.#.......#', '###########'],
  },
  {
    id: 'deposito',
    name: 'El depósito',
    tier: 'compuerta',
    hint: 'El agua espera tras la compuerta. Ábrela a tiempo.',
    par: 10,
    rows: ['###########', '##..E.#..##', '#.L#......#', '#.#WA.....#', '##.#.#....#', '#.........#', '#.#.#..Pa##', '###########'],
  },
  {
    id: 'vuelta-larga',
    name: 'La vuelta larga',
    tier: 'compuerta',
    hint: 'Primero la palanca, después la salida. El orden importa.',
    par: 12,
    rows: ['############', '#...#AWE.L.#', '###.#.##...#', '#..a..##..##', '#.##..#.##.#', '#..P###....#', '#....###...#', '############'],
  },
  {
    id: 'lava-espesa',
    name: 'Lava espesa',
    tier: 'espesa',
    hint: 'Esta lava es lenta: avanza un turno de cada dos. Úsalo a tu favor.',
    lavaEvery: 2,
    par: 9,
    rows: ['############', '#.....L..#.#', '#.P....#...#', '#..W......E#', '#..#...##..#', '##.#.#..#..#', '############'],
  },
  {
    id: 'ultimo-tramo',
    name: 'Último tramo',
    tier: 'espesa',
    hint: 'Lava lenta, agua y un camino estrecho. Todo lo aprendido.',
    lavaEvery: 2,
    par: 12,
    rows: ['#########', '#.#....P#', '#...#..##', '###.#..##', '#.##..#.#', '#..#.#..#', '#.E#W.#.#', '#...L#..#', '#########'],
  },
]);

export const TIER_LABELS = Object.freeze({ lava: 'Lava', agua: 'Agua y piedra', compuerta: 'Compuertas', espesa: 'Lava espesa' });
