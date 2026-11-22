/**
 * Niveles de la Botica de colores.
 *
 * Generados con una semilla fija y comprobados con el solucionador del motor
 * (tests/sortEngine.test.js lo verifica de nuevo en cada ejecución): todos tienen
 * solución. Cada cadena es un frasco, de abajo arriba; '' es un frasco vacío.
 * `par` es la solución más corta encontrada (óptima en los niveles pequeños).
 *
 * La dificultad crece con el número de colores y de frascos, la altura de los
 * frascos (4 o 5 capas) y los frascos vacíos de reserva (2, o solo 1 al final de «Difícil»).
 */
export const TIERS = Object.freeze([
  { id: 'facil', label: 'Fácil', note: '3 a 5 tinturas, dos frascos de reserva' },
  { id: 'medio', label: 'Medio', note: '5 a 8 tinturas' },
  { id: 'dificil', label: 'Difícil', note: 'Hasta 10 tinturas; al final, una sola reserva' },
  { id: 'avanzado', label: 'Avanzado', note: 'Frascos de 5 capas y hasta 12 tinturas' },
]);

const RAW = [
  { id: 'facil-01', tier: 'facil', capacity: 4, par: 7, tubes: ['cbba', 'cbaa', 'bacc', '', ''] },
  { id: 'facil-02', tier: 'facil', capacity: 4, par: 9, tubes: ['bcaa', 'abcb', 'cbac', '', ''] },
  { id: 'facil-03', tier: 'facil', capacity: 4, par: 10, tubes: ['dabb', 'caab', 'bdcc', 'ddca', '', ''] },
  { id: 'facil-04', tier: 'facil', capacity: 4, par: 12, tubes: ['cdbc', 'dacb', 'acdb', 'aadb', '', ''] },
  { id: 'facil-05', tier: 'facil', capacity: 4, par: 15, tubes: ['adbe', 'ceac', 'ebbe', 'cada', 'ddcb', '', ''] },
  { id: 'facil-06', tier: 'facil', capacity: 4, par: 14, tubes: ['aaec', 'dbea', 'edcb', 'ccae', 'bdbd', '', ''] },
  { id: 'medio-01', tier: 'medio', capacity: 4, par: 14, tubes: ['aedb', 'dbcc', 'eaae', 'cacd', 'ebbd', '', ''] },
  { id: 'medio-02', tier: 'medio', capacity: 4, par: 17, tubes: ['dcae', 'cbaa', 'bddf', 'cbcb', 'deff', 'aefe', '', ''] },
  { id: 'medio-03', tier: 'medio', capacity: 4, par: 19, tubes: ['babe', 'cdab', 'bffe', 'fdcd', 'aeac', 'efdc', '', ''] },
  { id: 'medio-04', tier: 'medio', capacity: 4, par: 19, tubes: ['fdgg', 'befd', 'gaad', 'eecf', 'ccda', 'bfeb', 'agbc', '', ''] },
  { id: 'medio-05', tier: 'medio', capacity: 4, par: 23, tubes: ['cdge', 'dbgf', 'adce', 'acge', 'faeb', 'cbbf', 'agdf', '', ''] },
  { id: 'medio-06', tier: 'medio', capacity: 4, par: 25, tubes: ['fagc', 'cgaa', 'chbg', 'cbbd', 'dheh', 'efda', 'beeh', 'fdgf', '', ''] },
  { id: 'dificil-01', tier: 'dificil', capacity: 4, par: 26, tubes: ['hgca', 'afed', 'dhgh', 'efab', 'hdfc', 'fegd', 'cbec', 'gabb', '', ''] },
  { id: 'dificil-02', tier: 'dificil', capacity: 4, par: 28, tubes: ['hcef', 'eacg', 'dhbb', 'ageb', 'giia', 'gfhe', 'ddhc', 'idba', 'fcfi', '', ''] },
  { id: 'dificil-03', tier: 'dificil', capacity: 4, par: 31, tubes: ['fhcc', 'gfea', 'deih', 'dehh', 'eadi', 'bgbg', 'bcdi', 'facf', 'ibag', '', ''] },
  { id: 'dificil-04', tier: 'dificil', capacity: 4, par: 33, tubes: ['djec', 'afbi', 'dghb', 'beih', 'gjfc', 'eadc', 'jdbi', 'aigh', 'fefh', 'jgca', '', ''] },
  { id: 'dificil-05', tier: 'dificil', capacity: 4, par: 20, tubes: ['ecbf', 'bedc', 'fcdf', 'eabf', 'dbda', 'aaec', ''] },
  { id: 'dificil-06', tier: 'dificil', capacity: 4, par: 22, tubes: ['afcb', 'abad', 'dcge', 'cffa', 'egdb', 'ecgb', 'fged', ''] },
  { id: 'avanzado-01', tier: 'avanzado', capacity: 5, par: 29, tubes: ['bbdgg', 'efbcb', 'cabda', 'adcce', 'gafeg', 'fedcf', 'adgfe', '', ''] },
  { id: 'avanzado-02', tier: 'avanzado', capacity: 5, par: 33, tubes: ['ddbfh', 'bbcfh', 'eafdc', 'deefa', 'cgbfg', 'hegha', 'becgd', 'hacag', '', ''] },
  { id: 'avanzado-03', tier: 'avanzado', capacity: 5, par: 39, tubes: ['igbdg', 'fhfeg', 'gbdch', 'bbhie', 'daieb', 'cefcc', 'aiehc', 'afdad', 'hgifa', '', ''] },
  { id: 'avanzado-04', tier: 'avanzado', capacity: 5, par: 44, tubes: ['jcegc', 'bgjeh', 'deifb', 'fjagf', 'aabah', 'hhead', 'igecj', 'icdbg', 'hcfji', 'ddfbi', '', ''] },
  { id: 'avanzado-05', tier: 'avanzado', capacity: 5, par: 46, tubes: ['ihhkg', 'kcfba', 'digaa', 'ciagi', 'cjkbf', 'fjejj', 'gdbeh', 'deahf', 'decjk', 'heikb', 'bdfcg', '', ''] },
  { id: 'avanzado-06', tier: 'avanzado', capacity: 5, par: 52, tubes: ['deklj', 'ajgbl', 'acfci', 'ihijc', 'leaik', 'ljgfl', 'gifjk', 'bhaee', 'bdagb', 'bhcch', 'fdedk', 'khgfd', '', ''] },
];

export const LEVELS = Object.freeze(
  RAW.map((level) => Object.freeze({ ...level, tubes: level.tubes.map((t) => t.split('')) })),
);
