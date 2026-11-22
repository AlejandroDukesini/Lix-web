/**
 * Lava y Agua · modo Dúo — motor puro de un rompecabezas cooperativo por turnos,
 * visto de lado, con gravedad.
 *
 * Dos personajes: Brasa (de lava) y Gota (de agua). Cada pulsación mueve a uno:
 * andar una casilla o saltar (sube hasta 2 casillas y avanza hasta 2 hacia un
 * lado). Después todo cae hasta apoyarse en suelo, en una compuerta cerrada o
 * en el otro personaje: se pueden usar de plataforma el uno al otro.
 *
 *  Brasa cruza la lava sin daño y se apaga en el agua; Gota, al revés. El ácido
 *  verde acaba con los dos. Una placa abre su compuerta (misma letra) mientras
 *  alguien la pisa. Se gana cuando cada uno está en su puerta a la vez.
 *
 * Mapa: '#' roca · '.' aire · 'L' lava · 'W' agua · 'G' ácido · 'a'/'b' placas ·
 *       'A'/'B' compuertas · 'E' puerta de Brasa · 'F' puerta de Gota ·
 *       'R' Brasa · 'U' Gota (las casillas iniciales son aire).
 */

export const HEROES = Object.freeze({
  brasa: { name: 'Brasa', safe: 'L', exit: 'E', start: 'R' },
  gota: { name: 'Gota', safe: 'W', exit: 'F', start: 'U' },
});
export const HERO_IDS = Object.freeze(['brasa', 'gota']);
export const ACTIONS = Object.freeze(['left', 'right', 'jumpLeft', 'jumpRight']);
const DEADLY = { brasa: new Set(['W', 'G']), gota: new Set(['L', 'G']) };

export function parseDuo(level) {
  const rows = level.rows;
  const height = rows.length;
  const width = rows[0].length;
  const cells = [];
  const start = {};
  const plates = {};
  for (let r = 0; r < height; r += 1) {
    if (rows[r].length !== width) throw new Error(`Fila ${r} con otro ancho`);
    for (let c = 0; c < width; c += 1) {
      let ch = rows[r][c];
      if (ch === 'R') start.brasa = [r, c];
      if (ch === 'U') start.gota = [r, c];
      if (ch === 'R' || ch === 'U') ch = '.';
      if (ch === 'a' || ch === 'b') (plates[ch] ??= []).push([r, c]);
      cells.push(ch);
    }
  }
  if (!start.brasa || !start.gota) throw new Error('Faltan Brasa (R) o Gota (U)');
  return { width, height, cells, start, plates };
}

export const cellAt = (board, r, c) => (r < 0 || c < 0 || r >= board.height || c >= board.width ? '#' : board.cells[r * board.width + c]);

/** Compuertas abiertas: las de las placas que alguien pisa (y las que alguien ocupa). */
export function openDoors(board, heroes) {
  const open = new Set();
  for (const [letter, list] of Object.entries(board.plates)) {
    if (list.some(([r, c]) => HERO_IDS.some((h) => heroes[h][0] === r && heroes[h][1] === c))) open.add(letter.toUpperCase());
  }
  for (const h of HERO_IDS) {
    const ch = cellAt(board, heroes[h][0], heroes[h][1]);
    if (ch === 'A' || ch === 'B') open.add(ch);
  }
  return open;
}

const isSolid = (board, open, r, c) => {
  const ch = cellAt(board, r, c);
  return ch === '#' || ((ch === 'A' || ch === 'B') && !open.has(ch));
};

export function createDuoState(board) {
  return { heroes: { brasa: [...board.start.brasa], gota: [...board.start.gota] }, dead: null };
}

const other = (hero) => (hero === 'brasa' ? 'gota' : 'brasa');
const occupiedBy = (heroes, hero, r, c) => heroes[other(hero)][0] === r && heroes[other(hero)][1] === c;
const blocked = (board, open, heroes, hero, r, c) => isSolid(board, open, r, c) || occupiedBy(heroes, hero, r, c);
const supported = (board, open, heroes, hero) => {
  const [r, c] = heroes[hero];
  return blocked(board, open, heroes, hero, r + 1, c);
};
const touches = (board, hero, r, c) => DEADLY[hero].has(cellAt(board, r, c));

/**
 * Aplica una acción de un personaje. Devuelve { state, trail } (trail: casillas
 * recorridas por cada uno, para animar) o null si no se mueve nada.
 */
export function act(board, state, hero, action) {
  if (state.dead || isWon(board, state)) return null;
  const heroes = { brasa: [...state.heroes.brasa], gota: [...state.heroes.gota] };
  let open = openDoors(board, heroes);
  const trail = { brasa: [], gota: [] };
  let dead = null;
  const step = (h, r, c) => {
    heroes[h] = [r, c];
    trail[h].push([r, c]);
    if (!dead && touches(board, h, r, c)) dead = h;
  };
  const [r0, c0] = heroes[hero];
  const dir = action === 'left' || action === 'jumpLeft' ? -1 : 1;
  if (action === 'left' || action === 'right') {
    if (blocked(board, open, heroes, hero, r0, c0 + dir)) return null;
    step(hero, r0, c0 + dir);
  } else if (action === 'jumpLeft' || action === 'jumpRight') {
    if (!supported(board, open, heroes, hero)) return null;
    let [r, c] = [r0, c0];
    for (let k = 0; k < 2 && !blocked(board, open, heroes, hero, r - 1, c); k += 1) step(hero, (r -= 1), c);
    for (let k = 0; k < 2 && !blocked(board, open, heroes, hero, r, c + dir); k += 1) step(hero, r, (c += dir));
    if (r === r0 && c === c0) return null;
  } else return null;

  // Gravedad para los dos hasta que todo esté quieto (las compuertas cambian al pisar o dejar placas).
  for (let guard = 0; guard < 64; guard += 1) {
    open = openDoors(board, heroes);
    let moved = false;
    for (const h of HERO_IDS) {
      const [r, c] = heroes[h];
      if (r + 1 < board.height && !blocked(board, open, heroes, h, r + 1, c)) {
        step(h, r + 1, c);
        moved = true;
      }
    }
    if (!moved) break;
  }
  return { state: { heroes, dead }, trail };
}

export function isWon(board, state) {
  if (state.dead) return false;
  return HERO_IDS.every((h) => cellAt(board, state.heroes[h][0], state.heroes[h][1]) === HEROES[h].exit);
}

const keyOf = (state) => `${state.heroes.brasa.join(',')}|${state.heroes.gota.join(',')}`;

/** Solución más corta por búsqueda en anchura: [{ hero, action }] o null. */
export function solveDuo(board, start = createDuoState(board), { limit = 200_000 } = {}) {
  if (isWon(board, start)) return [];
  const parent = new Map([[keyOf(start), null]]);
  let frontier = [start];
  while (frontier.length) {
    const next = [];
    for (const s of frontier) {
      for (const hero of HERO_IDS) {
        for (const action of ACTIONS) {
          const out = act(board, s, hero, action);
          if (!out || out.state.dead) continue;
          const k = keyOf(out.state);
          if (parent.has(k)) continue;
          parent.set(k, { prev: keyOf(s), hero, action });
          if (isWon(board, out.state)) {
            const path = [];
            let key = k;
            while (parent.get(key)) {
              const p = parent.get(key);
              path.unshift({ hero: p.hero, action: p.action });
              key = p.prev;
            }
            return path;
          }
          if (parent.size > limit) return null;
          next.push(out.state);
        }
      }
    }
    frontier = next;
  }
  return null;
}

/** ¿Se puede ganar moviendo solo a un personaje? (para comprobar que el nivel exige cooperar). */
export function solvableAlone(board, hero) {
  const startState = createDuoState(board);
  const seen = new Set([keyOf(startState)]);
  let frontier = [startState];
  while (frontier.length) {
    const next = [];
    for (const s of frontier) {
      for (const action of ACTIONS) {
        const out = act(board, s, hero, action);
        if (!out || out.state.dead) continue;
        const k = keyOf(out.state);
        if (seen.has(k)) continue;
        seen.add(k);
        // ¿Llega a su puerta? (el otro, quieto)
        const [r, c] = out.state.heroes[hero];
        if (cellAt(board, r, c) === HEROES[hero].exit) return true;
        next.push(out.state);
      }
    }
    frontier = next;
  }
  return false;
}
