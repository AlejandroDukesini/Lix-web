/**
 * Niveles de «Salida de la cochera».
 *
 * Generados con una semilla fija: se coloca una cochera al azar, se exploran
 * todos sus estados y se elige el más alejado de la salida; los más difíciles
 * se refinaron añadiendo y quitando vehículos (búsqueda local). `par` es el
 * mínimo exacto de movimientos, calculado por búsqueda en anchura; las pruebas
 * (tests/busEngine.test.js) lo vuelven a demostrar en cada ejecución.
 *
 * Tablero de 6 × 6 escrito fila a fila: '.' libre · 'x' microbús dorado (fila 3,
 * sale por la derecha) · letras: coches (2) y autobuses (3) · 'o' bolardo.
 */
export const TIERS = Object.freeze([
  { id: 'facil', label: 'Fácil', note: '3 a 7 movimientos' },
  { id: 'medio', label: 'Medio', note: '8 a 14 movimientos' },
  { id: 'dificil', label: 'Difícil', note: '15 a 24 movimientos' },
  { id: 'avanzado', label: 'Avanzado', note: 'Los atascos más largos' },
]);

export const LEVELS = Object.freeze([
  { id: 'facil-01', tier: 'facil', par: 3, board: 'a...bbaccdddxx.e..fffe...gghh.iii...' },
  { id: 'facil-02', tier: 'facil', par: 3, board: 'a.....abbccdxx.e.d...effggo...hhhii.' },
  { id: 'facil-03', tier: 'facil', par: 4, board: '.a.....abcddxxbc.efffggehhi.j...i.j.' },
  { id: 'facil-04', tier: 'facil', par: 4, board: 'a.....a.bcd.xxbcd.....eef..gg.f.....' },
  { id: 'facil-05', tier: 'facil', par: 5, board: '.aa.....b.cdxxb.cd....eefffo..ggg...' },
  { id: 'facil-06', tier: 'facil', par: 6, board: '..abbb..a.cc.xx..d.....de....fe..ggf' },
  { id: 'facil-07', tier: 'facil', par: 7, board: '.a..bb.ac.dexxc.de..fff..gghh.iijjkk' },
  { id: 'facil-08', tier: 'facil', par: 7, board: '...a.....abb..xxc..dddc...efff..egg.' },
  { id: 'medio-01', tier: 'medio', par: 8, board: '.....a...bcaxx.bca.dee...d.f.....fgg' },
  { id: 'medio-02', tier: 'medio', par: 8, board: '.aabb...cde.xxcde........ffgg..hh...' },
  { id: 'medio-03', tier: 'medio', par: 8, board: '...abbc..adec.xxde.fffdg...hhg.....g' },
  { id: 'medio-04', tier: 'medio', par: 9, board: '..aabbcc.deexx.d.fghiiifghj..k..jllk' },
  { id: 'medio-05', tier: 'medio', par: 10, board: '.....a..bcdaxxbcdae..fffeggghh......' },
  { id: 'medio-06', tier: 'medio', par: 11, board: 'aaa.b.c...b.cxx.b...de....deff...gg.' },
  { id: 'medio-07', tier: 'medio', par: 12, board: 'abcc..abde..xxde..fggehhfiijjk.llmmk' },
  { id: 'medio-08', tier: 'medio', par: 14, board: 'abccddab.effxx.e.....eghiijjgh..kk..' },
  { id: 'dificil-01', tier: 'dificil', par: 15, board: '.abbcd.a.ecd.xxe.df.ghhhf.g.....g...' },
  { id: 'dificil-02', tier: 'dificil', par: 16, board: '.aabcc...bdexx..defffggeh.iij.hkkkj.' },
  { id: 'dificil-03', tier: 'dificil', par: 17, board: '.aabccdd.befxx..efggghhfi.jjk.illlk.' },
  { id: 'dificil-04', tier: 'dificil', par: 18, board: 'a.bb..accde.xxfde...fgg.hhhi...jji..' },
  { id: 'dificil-05', tier: 'dificil', par: 20, board: 'a.....abbcd.xxecd...efgghhhf.i..jj.i' },
  { id: 'dificil-06', tier: 'dificil', par: 23, board: 'a..bccaddbefxxg.ef..ghhfiiij.....jkk' },
  { id: 'dificil-07', tier: 'dificil', par: 24, board: '.aabcdef.bcdefxxc.ghhi..g..ijjgkkll.' },
  { id: 'dificil-08', tier: 'dificil', par: 24, board: 'a..bccaddbefxxg.ef..ghhfiiij...kkjll' },
  { id: 'avanzado-01', tier: 'avanzado', par: 25, board: 'abbbccadd..eaxx.fegghhfe.ijjj..ikkll' },
  { id: 'avanzado-02', tier: 'avanzado', par: 27, board: 'aa.b.cde.bfcdexxf.ghhif.g.jikkg.jll.' },
  { id: 'avanzado-03', tier: 'avanzado', par: 27, board: 'a..bccaddbefxxg.efhhgiifjjjk..ll.k..' },
  { id: 'avanzado-04', tier: 'avanzado', par: 28, board: '..abbcd.aeecdxxf.c.ggfhhiiij..kk.j..' },
  { id: 'avanzado-05', tier: 'avanzado', par: 33, board: '.ab.cc.ab..dxxb.edfgggedfhhi..jj.ikk' },
  { id: 'avanzado-06', tier: 'avanzado', par: 49, board: '...abb.ccad.xxefd.ggefhhijjj.ki.ll.k' },
]);
