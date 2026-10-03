/**
 * Motor de «Saltos de Lumi» (plataformas 2D original). Sin DOM y determinista:
 * paso fijo de 1/60 s, así una misma secuencia de entradas da siempre el mismo
 * resultado (lo usan el planificador que demuestra que cada nivel se puede
 * superar y las pruebas que reproducen esas soluciones).
 *
 * Unidades: píxeles del mundo (una casilla = T = 16) y segundos.
 *
 * NIVELES (ASCII, una cadena por fila):
 *   #  suelo            =  bloque            -  plataforma de un sentido (se atraviesa desde abajo)
 *   ^  pinchos          o  chispa (moneda)   C  farol (punto de control)
 *   G  vela final       P  salida de Lumi    S  muelle
 *   b  sombra (camina y se gira en paredes y bordes)
 *   m  polilla (vuela en un vaivén fijo)
 *   H  plataforma móvil horizontal (3 casillas, recorre 4 a la derecha)
 *   V  plataforma móvil vertical   (3 casillas, sube 4)
 *
 * El jugador cae o toca pinchos o enemigos → pierde una vida y vuelve al último
 * farol encendido. Se pisa a los enemigos cayendo sobre ellos.
 */

export const T = 16;
export const DT = 1 / 60;
export const PW = 10; // ancho de Lumi
export const PH = 14; // alto de Lumi

export const PHYS = Object.freeze({
  runMax: 150,
  accelGround: 1500,
  accelAir: 1050,
  friction: 1800,
  airDrag: 300,
  jumpV: 365,
  gravityUp: 1150, // subiendo con el salto pulsado (salto largo)
  gravityRelease: 2800, // subiendo tras soltar (salto corto)
  gravityDown: 1900,
  maxFall: 560,
  coyote: 0.1, // margen para saltar justo después de dejar el borde
  buffer: 0.12, // salto pulsado un poco antes de tocar el suelo
  stomp: 260,
  stompHeld: 390,
  spring: 480, // ~6 casillas, se mantenga o no el salto
  respawn: 0.7,
  invulnerable: 1.2,
});

const BLOB = Object.freeze({ w: 12, h: 10, speed: 32 });
const MOTH = Object.freeze({ w: 12, h: 10, reach: 40 });
const MOVER = Object.freeze({ w: 3 * T, h: 6, range: 4 * T, period: 3.4 });

const SOLID = new Set(['#', '=']);
export const isSolidChar = (c) => SOLID.has(c);

/** Convierte un nivel ASCII en datos del motor. Lanza si el nivel está mal formado. */
export function parseLevel(def) {
  const width = Math.max(...def.rows.map((r) => r.length));
  const rows = def.rows.map((r) => r.padEnd(width, ' '));
  const grid = rows.map((r) => r.split(''));
  const out = { id: def.id, name: def.name, theme: def.theme, cols: width, rows: rows.length, coins: [], checkpoints: [], enemies: [], movers: [], springs: [], goal: null, start: null };
  for (let r = 0; r < rows.length; r += 1) {
    for (let c = 0; c < width; c += 1) {
      const ch = grid[r][c];
      const x = c * T;
      const y = r * T;
      switch (ch) {
        case 'P':
          if (out.start) throw new Error(`${def.id}: más de una salida`);
          out.start = { x: x + (T - PW) / 2, y: y + T - PH };
          break;
        case 'o':
          out.coins.push({ x: x + T / 2, y: y + T / 2 });
          break;
        case 'C':
          out.checkpoints.push({ x, y, spawn: { x: x + (T - PW) / 2, y: y + T - PH } });
          break;
        case 'G':
          out.goal = { x, y: y - 3 * T, w: T, h: 4 * T, base: { x, y } };
          break;
        case 'S':
          out.springs.push({ x: x + 2, y: y + T - 6, w: T - 4, h: 6 });
          break;
        case 'b':
          out.enemies.push({ type: 'blob', x0: x + 2, y0: y + T - BLOB.h });
          break;
        case 'm':
          out.enemies.push({ type: 'moth', x0: x + 2, y0: y + 3, phase: (c * 0.7) % (Math.PI * 2) });
          break;
        case 'H':
          out.movers.push({ axis: 'x', x0: x, y0: y + T - MOVER.h });
          break;
        case 'V':
          out.movers.push({ axis: 'y', x0: x, y0: y + T - MOVER.h });
          break;
        default:
          continue;
      }
      grid[r][c] = ' ';
    }
  }
  if (!out.start) throw new Error(`${def.id}: falta la salida P`);
  if (!out.goal) throw new Error(`${def.id}: falta la vela G`);
  out.checkpoints.sort((a, b) => a.x - b.x);
  out.grid = grid.map((r) => r.join(''));
  return out;
}

export const tileAt = (level, c, r) => {
  if (c < 0 || c >= level.cols) return '#'; // paredes invisibles a los lados
  if (r < 0 || r >= level.rows) return ' ';
  return level.grid[r][c];
};

const spawnPlayer = (spawn) => ({
  x: spawn.x,
  y: spawn.y,
  vx: 0,
  vy: 0,
  onGround: true,
  ground: -1, // -1 casilla, n ≥ 0 plataforma móvil n, null en el aire
  coyote: 0,
  buffer: 0,
  jumping: false,
  boost: false, // impulso de muelle: sube como un salto largo aunque no se mantenga
  prevJump: true, // un salto mantenido desde antes no cuenta como pulsación nueva
  facing: 1,
  invulnerable: 0,
  airTime: 0,
  landed: 0,
});

export function createWorld(levelOrDef, { lives = 3 } = {}) {
  const level = levelOrDef.grid ? levelOrDef : parseLevel(levelOrDef);
  return {
    level,
    t: 0,
    frame: 0,
    player: spawnPlayer(level.start),
    enemies: level.enemies.map((e) => ({ ...e, x: e.x0, y: e.y0, vx: e.type === 'blob' ? -BLOB.speed : 0, vy: 0, w: e.type === 'blob' ? BLOB.w : MOTH.w, h: e.type === 'blob' ? BLOB.h : MOTH.h, alive: true })),
    movers: level.movers.map((m) => ({ ...m, x: m.x0, y: m.y0, px: m.x0, py: m.y0, dx: 0, dy: 0, w: MOVER.w, h: MOVER.h })),
    coins: level.coins.map(() => false),
    coinCount: 0,
    checkpoint: -1,
    lives,
    deaths: 0,
    stomps: 0,
    respawn: 0,
    status: 'playing', // 'playing' | 'won' | 'lost'
  };
}

/** Copia barata del mundo (para el planificador). El nivel se comparte. */
export function cloneWorld(w) {
  return {
    ...w,
    player: { ...w.player },
    enemies: w.enemies.map((e) => ({ ...e })),
    movers: w.movers.map((m) => ({ ...m })),
    coins: w.coins.slice(),
  };
}

const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const box = (p, inset = 0) => ({ x: p.x + inset, y: p.y + inset, w: PW - inset * 2, h: PH - inset * 2 });

/** ¿Hay una casilla sólida en el rectángulo? */
function solidIn(level, x, y, w, h) {
  const c0 = Math.floor(x / T);
  const c1 = Math.floor((x + w - 0.001) / T);
  const r0 = Math.floor(y / T);
  const r1 = Math.floor((y + h - 0.001) / T);
  for (let r = r0; r <= r1; r += 1) for (let c = c0; c <= c1; c += 1) if (isSolidChar(tileAt(level, c, r))) return true;
  return false;
}

/** Mueve horizontalmente un cuerpo {x,y,w,h} con paredes. Devuelve true si chocó. */
function moveX(level, body, w, h, dx) {
  if (!dx) return false;
  body.x += dx;
  if (!solidIn(level, body.x, body.y, w, h)) return false;
  if (dx > 0) body.x = Math.floor((body.x + w) / T) * T - w;
  else body.x = Math.floor(body.x / T + 1) * T;
  return true;
}

/**
 * Mueve verticalmente con suelo, techo y plataformas de un sentido.
 * Devuelve 'floor' | 'ceiling' | null.
 */
function moveY(level, body, w, h, dy) {
  const prevBottom = body.y + h;
  body.y += dy;
  if (dy > 0) {
    const bottom = body.y + h;
    const r = Math.floor((bottom - 0.001) / T);
    const c0 = Math.floor(body.x / T);
    const c1 = Math.floor((body.x + w - 0.001) / T);
    for (let c = c0; c <= c1; c += 1) {
      const ch = tileAt(level, c, r);
      const top = r * T;
      if (isSolidChar(ch) || (ch === '-' && prevBottom <= top + 0.01)) {
        body.y = top - h;
        return 'floor';
      }
    }
  } else if (dy < 0 && solidIn(level, body.x, body.y, w, h)) {
    body.y = Math.floor(body.y / T + 1) * T;
    return 'ceiling';
  }
  return null;
}

function moversAt(w) {
  for (const m of w.movers) {
    const phase = (1 - Math.cos((2 * Math.PI * w.t) / MOVER.period)) / 2;
    const x = m.x0 + (m.axis === 'x' ? MOVER.range * phase : 0);
    const y = m.y0 - (m.axis === 'y' ? MOVER.range * phase : 0);
    m.px = m.x;
    m.py = m.y;
    m.dx = x - m.x;
    m.dy = y - m.y;
    m.x = x;
    m.y = y;
  }
}

function updateEnemies(w) {
  const { level } = w;
  for (const e of w.enemies) {
    if (!e.alive) continue;
    if (e.type === 'moth') {
      e.x = e.x0 + MOTH.reach * Math.sin(w.t * 1.3 + e.phase);
      e.y = e.y0 + 6 * Math.sin(w.t * 2.6 + e.phase);
      e.vx = Math.cos(w.t * 1.3 + e.phase);
      continue;
    }
    // Sombra: camina, cae con gravedad y se gira ante paredes o bordes.
    e.vy = Math.min(PHYS.maxFall, e.vy + PHYS.gravityDown * DT);
    if (moveY(level, e, e.w, e.h, e.vy * DT) === 'floor') e.vy = 0;
    const hit = moveX(level, e, e.w, e.h, e.vx * DT);
    const aheadX = e.vx > 0 ? e.x + e.w + 1 : e.x - 1;
    const below = tileAt(level, Math.floor(aheadX / T), Math.floor((e.y + e.h + 1) / T));
    if (hit || (e.vy === 0 && !isSolidChar(below) && below !== '-')) e.vx = -e.vx;
  }
}

function die(w, events) {
  w.deaths += 1;
  w.lives -= 1;
  events.push({ type: 'death', x: w.player.x, y: w.player.y });
  if (w.lives <= 0) {
    w.status = 'lost';
    return;
  }
  w.respawn = PHYS.respawn;
}

/**
 * Avanza un paso fijo (DT). `input` = { left, right, jump } (booleanos, mantenidos).
 * Devuelve los eventos del paso: jump, land, coin, stomp, spring, checkpoint, death, win.
 */
export function step(w, input) {
  const events = [];
  if (w.status !== 'playing') return events;
  w.t += DT;
  w.frame += 1;
  moversAt(w);
  updateEnemies(w);

  if (w.respawn > 0) {
    w.respawn -= DT;
    if (w.respawn <= 0) {
      const cp = w.level.checkpoints[w.checkpoint];
      w.player = spawnPlayer(cp ? cp.spawn : w.level.start);
      w.player.invulnerable = PHYS.invulnerable;
      events.push({ type: 'respawn' });
    }
    return events;
  }

  const { level } = w;
  const p = w.player;
  p.invulnerable = Math.max(0, p.invulnerable - DT);
  p.landed = Math.max(0, p.landed - DT);

  // Sobre una plataforma móvil: lleva a Lumi consigo.
  if (p.ground !== null && p.ground >= 0) {
    const m = w.movers[p.ground];
    moveX(level, p, PW, PH, m.dx);
    p.y = m.y - PH;
  }

  // Horizontal.
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (dir) {
    const accel = p.onGround ? PHYS.accelGround : PHYS.accelAir;
    // Cambiar de sentido frena antes (respuesta rápida).
    const turn = Math.sign(p.vx) === -dir ? (p.onGround ? PHYS.friction : PHYS.airDrag) : 0;
    p.vx += dir * (accel + turn) * DT;
    p.vx = Math.max(-PHYS.runMax, Math.min(PHYS.runMax, p.vx));
    p.facing = dir;
  } else {
    const decel = (p.onGround ? PHYS.friction : PHYS.airDrag) * DT;
    p.vx = Math.abs(p.vx) <= decel ? 0 : p.vx - Math.sign(p.vx) * decel;
  }

  // Salto: margen tras el borde (coyote) y pulsación anticipada (buffer).
  const pressed = input.jump && !p.prevJump;
  p.prevJump = input.jump;
  p.buffer = pressed ? PHYS.buffer : Math.max(0, p.buffer - DT);
  p.coyote = p.onGround ? PHYS.coyote : Math.max(0, p.coyote - DT);
  if (p.buffer > 0 && p.coyote > 0) {
    // Al saltar desde una plataforma que sube, se hereda su impulso.
    const lift = p.ground !== null && p.ground >= 0 ? Math.min(0, w.movers[p.ground].dy / DT) : 0;
    p.vy = -PHYS.jumpV + lift;
    p.buffer = 0;
    p.coyote = 0;
    p.onGround = false;
    p.ground = null;
    p.jumping = true;
    p.boost = false;
    events.push({ type: 'jump' });
  }

  const gravity = p.vy < 0 ? ((input.jump || p.boost) && p.jumping ? PHYS.gravityUp : PHYS.gravityRelease) : PHYS.gravityDown;
  p.vy = Math.min(PHYS.maxFall, p.vy + gravity * DT);
  if (p.vy >= 0) {
    p.jumping = false;
    p.boost = false;
  }

  if (moveX(level, p, PW, PH, p.vx * DT)) p.vx = 0;
  const wasGround = p.onGround;
  const prevBottom = p.y + PH;
  const hitY = moveY(level, p, PW, PH, p.vy * DT);
  p.onGround = false;
  p.ground = null;
  if (hitY === 'floor') {
    p.vy = 0;
    p.onGround = true;
    p.ground = -1;
  } else if (hitY === 'ceiling') p.vy = 0;

  // Plataformas móviles (se aterriza encima; desde abajo se atraviesan).
  if (p.vy >= 0) {
    for (let i = 0; i < w.movers.length; i += 1) {
      const m = w.movers[i];
      const bottom = p.y + PH;
      if (p.x + PW > m.x && p.x < m.x + m.w && prevBottom <= Math.max(m.py, m.y) + 1.5 && bottom >= m.y) {
        p.y = m.y - PH;
        p.vy = 0;
        p.onGround = true;
        p.ground = i;
        break;
      }
    }
  }
  if (p.onGround) {
    if (!wasGround && p.airTime > 0.12) {
      p.landed = 0.12;
      events.push({ type: 'land' });
    }
    p.airTime = 0;
  } else p.airTime += DT;

  // Muelles.
  for (const s of level.springs) {
    if (p.vy >= 0 && overlap(box(p), s)) {
      p.y = s.y - PH;
      p.vy = -PHYS.spring;
      p.jumping = true;
      p.boost = true;
      p.onGround = false;
      p.ground = null;
      events.push({ type: 'spring' });
    }
  }

  const me = box(p, 1);
  // Chispas.
  level.coins.forEach((c, i) => {
    if (!w.coins[i] && overlap(me, { x: c.x - 6, y: c.y - 6, w: 12, h: 12 })) {
      w.coins[i] = true;
      w.coinCount += 1;
      events.push({ type: 'coin', index: i });
    }
  });
  // Faroles.
  level.checkpoints.forEach((cp, i) => {
    if (i > w.checkpoint && overlap(me, { x: cp.x, y: cp.y - T, w: T, h: 2 * T })) {
      w.checkpoint = i;
      events.push({ type: 'checkpoint', index: i });
    }
  });
  // Vela final.
  if (overlap(me, level.goal)) {
    w.status = 'won';
    events.push({ type: 'win' });
    return events;
  }

  // Peligros: caída, pinchos y enemigos.
  if (p.y > level.rows * T + 24) {
    die(w, events);
    return events;
  }
  if (p.invulnerable <= 0) {
    const c0 = Math.floor(me.x / T);
    const c1 = Math.floor((me.x + me.w) / T);
    const r0 = Math.floor(me.y / T);
    const r1 = Math.floor((me.y + me.h) / T);
    for (let r = r0; r <= r1; r += 1) {
      for (let c = c0; c <= c1; c += 1) {
        if (tileAt(level, c, r) === '^' && overlap(me, { x: c * T + 3, y: r * T + T * 0.45, w: T - 6, h: T * 0.55 })) {
          die(w, events);
          return events;
        }
      }
    }
  }
  for (const e of w.enemies) {
    if (!e.alive || !overlap(box(p), e)) continue;
    if (p.vy > 0 && prevBottom <= e.y + 6) {
      e.alive = false;
      w.stomps += 1;
      p.vy = -(input.jump ? PHYS.stompHeld : PHYS.stomp);
      p.jumping = input.jump;
      events.push({ type: 'stomp', x: e.x, y: e.y });
    } else if (p.invulnerable <= 0) {
      die(w, events);
      return events;
    }
  }
  return events;
}

/** Entradas codificadas: bit 1 izquierda, 2 derecha, 4 salto. */
export const decodeInput = (mask) => ({ left: Boolean(mask & 1), right: Boolean(mask & 2), jump: Boolean(mask & 4) });

/** «máscara×fotogramas» separados por comas → lista de máscaras por fotograma. */
export function expandInputs(rle) {
  const out = [];
  for (const part of rle.split(',')) {
    const [mask, frames] = part.split('x').map(Number);
    for (let i = 0; i < frames; i += 1) out.push(mask);
  }
  return out;
}

export function compressInputs(masks) {
  const out = [];
  for (const m of masks) {
    const last = out[out.length - 1];
    if (last && last[0] === m) last[1] += 1;
    else out.push([m, 1]);
  }
  return out.map(([m, n]) => `${m}x${n}`).join(',');
}
