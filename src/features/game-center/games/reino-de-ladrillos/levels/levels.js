/**
 * Niveles de «Reino de Ladrillos». Se construyen con un pequeño constructor
 * (más legible que 14 cadenas de 200 caracteres) y se exportan como filas ASCII
 * para el motor (ver la leyenda en engine/brickEngine.js).
 *
 * El suelo está en las filas 12-13; la persona nace en la fila 11.
 * Cada nivel se demuestra superable con el motor real: scripts/plan-ladrillos.mjs
 * busca una secuencia de entradas que llega al mástil sin perder ninguna vida y
 * la guarda en levels/solutions.js; las pruebas la reproducen.
 */

const H = 14;
const GROUND = 12;

function builder(width) {
  const g = Array.from({ length: H }, () => new Array(width).fill(' '));
  const api = {
    set(x, y, ch) {
      if (x >= 0 && x < width && y >= 0 && y < H) g[y][x] = ch;
      return api;
    },
    text(x, y, str) {
      [...str].forEach((ch, i) => ch !== '.' && api.set(x + i, y, ch));
      return api;
    },
    fill(x0, x1, y0, y1, ch) {
      for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) api.set(x, y, ch);
      return api;
    },
    ground(x0, x1, top = GROUND) {
      return api.fill(x0, x1, top, H - 1, '#');
    },
    /** Tubería de 2 de ancho y `h` casillas sobre el suelo. */
    pipe(x, h) {
      return api.fill(x, x + 1, GROUND - h, GROUND - 1, 'T');
    },
    /** Escalera de bloques duros: sube (`up`) o baja, de `n` peldaños. */
    stairs(x, n, up = true) {
      for (let i = 0; i < n; i += 1) {
        const height = up ? i + 1 : n - i;
        api.fill(x + i, x + i, GROUND - height, GROUND - 1, '=');
      }
      return api;
    },
    /** Mástil final de 9 casillas con su base. */
    flag(x) {
      api.fill(x, x, GROUND - 9, GROUND - 2, 'F');
      return api.set(x, GROUND - 1, '=');
    },
    rows: () => g.map((r) => r.join('')),
  };
  return api;
}

function pradera() {
  const b = builder(190);
  b.ground(0, 68).ground(71, 86).ground(90, 150).ground(153, 189);
  b.set(3, GROUND - 1, 'P');
  b.text(14, 8, '?').text(18, 8, 'BMB?B').text(20, 4, '?');
  b.set(22, GROUND - 1, 'g');
  b.pipe(28, 2).pipe(38, 3).set(44, GROUND - 1, 'g').set(46, GROUND - 1, 'g').pipe(50, 3);
  b.text(56, 9, 'ooo');
  b.pipe(62, 2);
  // Hueco de 2 y escalón con monedas
  b.text(73, 8, 'B?B').text(74, 4, 'ooo').set(80, GROUND - 1, 'k');
  b.set(88, 9, 'o').set(89, 9, 'o');
  b.set(94, GROUND - 1, 'C');
  b.text(98, 8, 'BBBBBBBB').text(99, 4, 'ooo?ooo').set(102, GROUND - 1, 'g').set(104, GROUND - 1, 'g');
  b.text(112, 8, '?B?').set(118, GROUND - 1, 'k').set(124, GROUND - 1, 'g');
  b.stairs(130, 4).stairs(136, 4, false);
  b.text(142, 8, 'B?BB').set(146, GROUND - 1, 'g');
  b.stairs(160, 8);
  b.flag(176);
  return { id: 'pradera', name: 'Pradera de ladrillo', theme: 'pradera', hint: 'Golpea los bloques desde abajo. El corazón te hace grande.', rows: b.rows() };
}

function subsuelo() {
  const b = builder(180);
  b.fill(0, 179, 0, 1, '=');
  b.ground(0, 40).ground(44, 80).ground(84, 86).ground(90, 130).ground(134, 179);
  b.set(2, GROUND - 1, 'P');
  b.text(8, 8, 'M').text(12, 8, 'BBBBB').text(12, 7, 'ooooo');
  b.set(18, GROUND - 1, 'g').set(20, GROUND - 1, 'g');
  b.fill(24, 26, 8, 11, 'B').text(24, 7, 'ooo');
  b.set(32, GROUND - 1, 'k');
  b.text(42, 8, 'ooo');
  b.fill(50, 60, 2, 4, 'B').text(50, 8, '?BBBB?BBBB?');
  b.set(54, GROUND - 1, 'g').set(57, GROUND - 1, 'g');
  b.pipe(66, 3).set(70, GROUND - 1, 'k').pipe(74, 2);
  b.text(83, 8, 'ooooo');
  b.set(92, GROUND - 1, 'C');
  b.stairs(96, 3).text(100, 7, 'BBBB').set(101, 6, 'o').set(102, 6, 'o');
  b.set(106, GROUND - 1, 'g').set(108, GROUND - 1, 'g').set(110, GROUND - 1, 'g');
  b.pipe(116, 2).pipe(122, 3);
  b.text(131, 8, 'ooo');
  b.text(138, 8, 'B?B?B').set(144, GROUND - 1, 'k').set(150, GROUND - 1, 'g');
  b.stairs(156, 6);
  b.fill(162, 179, 2, 3, ' ');
  b.flag(170);
  return { id: 'subsuelo', name: 'Bajo tierra', theme: 'subsuelo', hint: 'Techo bajo: siendo grande puedes romper ladrillos con la cabeza.', rows: b.rows() };
}

function copas() {
  const b = builder(170);
  b.ground(0, 14).ground(160, 169);
  b.set(3, GROUND - 1, 'P');
  b.text(8, 8, 'M');
  // Copas de árboles: plataformas finas sobre troncos (los troncos son decorado = plataforma de un sentido)
  const tree = (x, w, top) => b.fill(x, x + w - 1, top, top, '-');
  tree(17, 5, 10);
  b.text(18, 9, 'ooo');
  tree(24, 4, 8);
  tree(30, 6, 9).set(33, 8, 'g');
  tree(38, 4, 7);
  b.text(39, 6, 'oo');
  tree(44, 6, 9);
  b.ground(52, 62);
  b.set(56, GROUND - 1, 'k').text(55, 8, '?B?');
  tree(65, 4, 9);
  tree(71, 5, 7).set(73, 6, 'g');
  b.ground(78, 84).set(80, GROUND - 1, 'C');
  tree(87, 3, 9);
  tree(92, 3, 7);
  b.text(92, 6, 'ooo');
  tree(97, 6, 9).set(100, 8, 'g');
  tree(105, 4, 8);
  b.ground(111, 118).text(113, 8, 'B?B').set(116, GROUND - 1, 'g');
  tree(121, 4, 10);
  tree(127, 4, 8);
  tree(133, 5, 9).set(135, 8, 'k');
  tree(140, 4, 7).text(140, 6, 'oooo');
  tree(146, 4, 9);
  tree(152, 5, 10);
  b.stairs(160, 2);
  b.flag(165);
  return { id: 'copas', name: 'Copas de los árboles', theme: 'copas', hint: 'Las plataformas finas se atraviesan desde abajo. No mires al vacío.', rows: b.rows() };
}

function castillo() {
  const b = builder(170);
  b.fill(0, 169, 0, 1, '=');
  b.fill(0, 169, 13, 13, 'L');
  b.ground(0, 12).ground(16, 30).ground(34, 36).ground(40, 62).ground(67, 90).ground(95, 120).ground(124, 126).ground(130, 169);
  b.set(2, GROUND - 1, 'P');
  b.text(6, 8, 'M');
  b.fill(13, 15, 13, 13, 'L');
  b.stairs(20, 3).set(26, GROUND - 1, 'g').set(28, GROUND - 1, 'g');
  b.text(34, 8, 'ooo');
  b.fill(44, 52, 7, 7, '=').text(45, 6, 'ooooooo').set(48, GROUND - 1, 'k').set(55, GROUND - 1, 'g').set(58, GROUND - 1, 'g');
  b.text(64, 8, '=');
  b.set(70, GROUND - 1, 'C');
  b.fill(74, 75, 9, 11, '=').fill(80, 81, 8, 11, '=').set(84, GROUND - 1, 'g').set(86, GROUND - 1, 'g');
  b.text(92, 8, '?');
  b.text(98, 8, 'BBB?BBB').set(102, GROUND - 1, 'k').set(108, GROUND - 1, 'g').set(110, GROUND - 1, 'g');
  b.stairs(114, 4);
  b.text(124, 7, 'ooo');
  b.set(134, GROUND - 1, 'g').set(137, GROUND - 1, 'k').set(140, GROUND - 1, 'g');
  b.stairs(146, 7);
  b.flag(162);
  return { id: 'castillo', name: 'El castillo de lava', theme: 'castillo', time: 180, hint: 'Lava bajo los puentes. Último tramo: llega al mástil del castillo.', rows: b.rows() };
}

export const LEVELS = Object.freeze([pradera(), subsuelo(), copas(), castillo()]);
export const THEME_NAMES = Object.freeze({ pradera: 'Pradera', subsuelo: 'Subterráneo', copas: 'Árboles', castillo: 'Castillo' });
