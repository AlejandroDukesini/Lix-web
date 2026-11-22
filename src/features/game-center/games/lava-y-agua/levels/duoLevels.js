/**
 * Niveles del modo Dúo (Brasa y Gota), diseñados a mano.
 *
 * Las pruebas (tests/duoEngine.test.js) demuestran con el motor real que todos
 * tienen solución, que `par` es el mínimo de movimientos (búsqueda en anchura) y
 * que, salvo el tutorial, al menos uno de los dos no puede llegar a su puerta
 * sin la ayuda del otro.
 *
 * Mapa: '#' roca · '.' aire · 'L' lava · 'W' agua · 'G' ácido · 'a'/'b' placas ·
 *       'A'/'B' compuertas · 'E' puerta de Brasa · 'F' puerta de Gota ·
 *       'R' Brasa · 'U' Gota.
 */
export const DUO_LEVELS = Object.freeze([
  {
    id: 'duo-01',
    name: 'Cada cual a su puerta',
    hint: 'Brasa cruza la lava, Gota el agua. El charco del otro hay que saltarlo.',
    par: 11,
    tutorial: true,
    rows: ['##############', '#............#', '#............#', '#UR..L..W..FE#', '##############'],
  },
  {
    id: 'duo-02',
    name: 'Tú sujetas, yo paso',
    hint: 'La compuerta solo está abierta mientras alguien pisa una placa.',
    par: 12,
    rows: ['###############', '#......A......#', '#RU.a.LA.aW.FE#', '###############'],
  },
  {
    id: 'duo-03',
    name: 'Sobre tus hombros',
    hint: 'Nadie salta tan alto solo. Subirse encima del otro da una casilla más.',
    par: 12,
    rows: ['##############', '#............#', '#........#aF##', '#........#####', '#RU......A..E#', '##############'],
  },
  {
    id: 'duo-04',
    name: 'Ácido',
    hint: 'El ácido verde no perdona a ninguno de los dos. Las placas de abajo están lejos.',
    par: 13,
    rows: ['###############', '#.............#', '#.......#.....#', '#UR..G..#..A.E#', '###a#####b#B#F#', '###############'],
  },
  {
    id: 'duo-05',
    name: 'La repisa',
    hint: 'La placa está en lo alto de una repisa; la puerta, al otro lado del muro.',
    par: 14,
    rows: ['#################', '#...........#...#', '#.......a...A...#', '#.......#...A...#', '#UR..L..#W..A.FE#', '#################'],
  },
  {
    id: 'duo-06',
    name: 'La torre',
    hint: 'Las puertas están arriba; la placa, en un sótano.',
    par: 11,
    rows: ['##############', '#.........####', '#....FE...####', '#....##...####', '#..........b.#', '#UR.....###B##', '#####W###..a.#', '##############'],
  },
  {
    id: 'duo-07',
    name: 'Relevos',
    hint: 'Dos compuertas, dos placas: os tocará turnaros para abrir paso.',
    par: 18,
    rows: ['####################', '#......A......B....#', '#......A......B....#', '#UR.a..A.L.b..B.WFE#', '####################'],
  },
]);
