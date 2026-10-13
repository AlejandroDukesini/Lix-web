/**
 * Motor de «Reino de Ladrillos», homenaje original a los plataformas de
 * desplazamiento lateral de los 8 bits. Sin DOM y determinista: paso fijo de
 * 1/60 s, así una secuencia de entradas da siempre el mismo resultado (lo usan
 * el planificador que demuestra cada nivel y las pruebas).
 *
 * Unidades: píxeles del mundo (casilla T = 16) y segundos. y crece hacia abajo.
 *
 * NIVELES (ASCII, ver levels/levels.js):
 *   #  suelo          =  bloque duro        B  ladrillo (se rompe siendo grande)
 *   ?  bloque con moneda                    M  bloque con corazón (crecer)
 *   T  tubería        -  plataforma fina (se atraviesa desde abajo)
 *   L  lava (mortal)  o  moneda             C  bandera de control
 *   F  mástil final   P  salida
 *   g  gorgojo (camina; se aplasta cayéndole encima)
 *   k  caracol (al pisarlo se esconde; su caparazón se patea y arrasa)
 *
 * Reglas: pequeño → un golpe y se pierde una vida; grande → un golpe y vuelve a
 * pequeño (con unos instantes de invulnerabilidad). Caer al vacío, tocar lava o
 * quedarse sin tiempo cuesta una vida. 100 monedas = 1 vida. La cámara solo
 * avanza (como en los clásicos): no se puede volver atrás más allá del borde.
 */

export const T = 16;
export const DT = 1 / 60;
export const LEVEL_TIME = 200; // segundos por nivel
export const VIEW_W = 288; // ancho de la vista en píxeles del mundo (el dibujo escala)

export const PHYS = Object.freeze({
  walkMax: 112,
  accelGround: 720,
  accelAir: 520,
  friction: 900,
  turnBoost: 1.6, // cambiar de sentido frena más rápido
  jumpV: 330,
  jumpSpeedBonus: 0.25, // corriendo se salta un poco más alto
  gravityHold: 880,
  gravityRelease: 2300,
  gravityDown: 1500,
  maxFall: 460,
  coyote: 0.08,
  buffer: 0.1,
  stomp: 230,
  stompHeld: 320,
  invulnerable: 1.6,
  respawn: 1.2,
});

export const SIZE = Object.freeze({ small: { w: 12, h: 14 }, big: { w: 12, h: 26 } });
const WALKER = Object.freeze({ w: 14, h: 14, speed: 30 });
const SHELL_SPEED = 210;
const ITEM_SPEED = 46;

export const POINTS = Object.freeze({ coin: 200, stomp: 100, brick: 50, powerup: 1000, shell: 200, timeBonus: 50 });

const SOLID = new Set(['#', '=', 'B', '?', 'M', 'U', 'T']);
export const isSolid = (c) => SOLID.has(c);

export function parseLevel(def) {
  const width = Math.max(...def.rows.map((r) => r.length));
  const rows = def.rows.map((r) => r.padEnd(width, ' ').split(''));
  const out = { id: def.id, name: def.name, theme: def.theme, cols: width, rows: rows.length, coins: [], enemies: [], checkpoints: [], flag: null, start: null, time: def.time ?? LEVEL_TIME };
  for (let r = 0; r < rows.length; r += 1) {
    for (let c = 0; c < width; c += 1) {
      const ch = rows[r][c];
      const x = c * T;
      const y = r * T;
      if (ch === 'P') out.start = { x: x + 2, y: y + T - SIZE.small.h };
      else if (ch === 'o') out.coins.push({ x: x + 3, y: y + 2, w: 10, h: 12 });
      else if (ch === 'g' || ch === 'k') out.enemies.push({ type: ch === 'g' ? 'walker' : 'snail', x0: x + 1, y0: y + T - WALKER.h });
      else if (ch === 'C') out.checkpoints.push({ x, y, spawn: { x: x + 2, y: y + T - SIZE.small.h } });
      else if (ch === 'F') {
        if (!out.flag) out.flag = { x: x + 6, top: y, bottom: y + T, w: 4 };
        else out.flag.bottom = y + T;
      } else continue;
      rows[r][c] = ' ';
    }
  }
  if (!out.start) throw new Error(`${def.id}: falta P`);
  if (!out.flag) throw new Error(`${def.id}: falta F`);
  out.checkpoints.sort((a, b) => a.x - b.x);
  out.grid = rows;
  return out;
}

export function tileAt(world, c, r) {
  const lvl = world.level;
  if (c < 0) return '=';
  if (c >= lvl.cols) return '=';
  if (r < 0 || r >= lvl.rows) return ' ';
  return world.grid[r][c];
}

const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

function spawnPlayer(spawn, big = false) {
  const size = big ? SIZE.big : SIZE.small;
  return {
    x: spawn.x,
    y: spawn.y + SIZE.small.h - size.h,
    w: size.w,
    h: size.h,
    vx: 0,
    vy: 0,
    big,
    onGround: true,
    coyote: 0,
    buffer: 0,
    jumping: false,
    prevJump: true,
    facing: 1,
    invulnerable: 0,
    stompChain: 0,
  };
}

function makeEnemies(level) {
  return level.enemies.map((e, i) => ({ id: i, type: e.type, x: e.x0, y: e.y0, w: WALKER.w, h: WALKER.h, vx: -WALKER.speed, vy: 0, state: 'walk', active: false, alive: true, dead: 0 }));
}

/**
 * Mundo de un nivel. `carry` conserva lo que viene del nivel anterior en la
 * misma partida: vidas, monedas, puntos y si se es grande.
 */
export function createWorld(levelOrDef, carry = {}) {
  const level = levelOrDef.grid ? levelOrDef : parseLevel(levelOrDef);
  return {
    level,
    grid: level.grid.map((r) => [...r]),
    t: 0,
    frame: 0,
    timeLeft: level.time,
    player: spawnPlayer(level.start, Boolean(carry.big)),
    enemies: makeEnemies(level),
    coins: level.coins.map(() => false),
    items: [],
    bumps: [], // bloques que rebotan (dibujo y golpe a lo que esté encima)
    camX: 0,
    viewW: VIEW_W,
    checkpoint: -1,
    lives: carry.lives ?? 3,
    coinCount: carry.coins ?? 0,
    score: carry.score ?? 0,
    levelCoins: 0,
    stomps: 0,
    bricks: 0,
    deaths: 0,
    status: 'playing', // playing | dying | won | lost
    dyingFor: 0,
    cause: null,
    flagY: null,
  };
}

// ------------------------------------------------------------------ colisiones

function collideX(world, body) {
  const top = Math.floor(body.y / T);
  const bottom = Math.floor((body.y + body.h - 0.01) / T);
  if (body.vx > 0) {
    const c = Math.floor((body.x + body.w) / T);
    for (let r = top; r <= bottom; r += 1)
      if (isSolid(tileAt(world, c, r))) {
        body.x = c * T - body.w;
        return 1;
      }
  } else if (body.vx < 0) {
    const c = Math.floor(body.x / T);
    for (let r = top; r <= bottom; r += 1)
      if (isSolid(tileAt(world, c, r))) {
        body.x = (c + 1) * T;
        return -1;
      }
  }
  return 0;
}

/** Devuelve { ground, head: [c, r] | null }. `prevBottom` permite las plataformas finas. */
function collideY(world, body, prevBottom) {
  const left = Math.floor(body.x / T);
  const right = Math.floor((body.x + body.w - 0.01) / T);
  if (body.vy > 0) {
    const r = Math.floor((body.y + body.h) / T);
    for (let c = left; c <= right; c += 1) {
      const t = tileAt(world, c, r);
      if (isSolid(t) || (t === '-' && prevBottom <= r * T + 0.01)) {
        body.y = r * T - body.h;
        body.vy = 0;
        return { ground: true, head: null };
      }
    }
  } else if (body.vy < 0) {
    const r = Math.floor(body.y / T);
    // Golpe de cabeza: el bloque más cercano al centro del cuerpo.
    const center = Math.floor((body.x + body.w / 2) / T);
    const order = [center, ...[left, right].filter((c) => c !== center)];
    for (const c of order) {
      if (c < left || c > right) continue;
      if (isSolid(tileAt(world, c, r))) {
        body.y = (r + 1) * T;
        body.vy = 0;
        return { ground: false, head: [c, r] };
      }
    }
  }
  return { ground: false, head: null };
}

function onGroundCheck(world, body) {
  const r = Math.floor((body.y + body.h + 0.5) / T);
  const left = Math.floor(body.x / T);
  const right = Math.floor((body.x + body.w - 0.01) / T);
  for (let c = left; c <= right; c += 1) {
    const t = tileAt(world, c, r);
    if (isSolid(t) || (t === '-' && Math.abs(body.y + body.h - r * T) < 0.6)) return true;
  }
  return false;
}

// ------------------------------------------------------------------ eventos del jugador

function addScore(world, points, events, x, y) {
  world.score += points;
  events.push({ type: 'score', points, x, y });
}

function gainCoin(world, events, x, y) {
  world.coinCount += 1;
  world.levelCoins += 1;
  addScore(world, POINTS.coin, events, x, y);
  events.push({ type: 'coin', x, y });
  if (world.coinCount % 100 === 0) {
    world.lives += 1;
    events.push({ type: 'oneUp' });
  }
}

function hitBlock(world, c, r, events) {
  const t = world.grid[r][c];
  const p = world.player;
  const x = c * T;
  const y = r * T;
  // Lo que esté encima del bloque golpeado sale despedido.
  for (const e of world.enemies) {
    if (e.alive && e.state !== 'dead' && e.x + e.w > x && e.x < x + T && Math.abs(e.y + e.h - y) < 2) killEnemy(world, e, events, 'bump');
  }
  if (t === '?') {
    world.grid[r][c] = 'U';
    world.bumps.push({ c, r, t: 0 });
    gainCoin(world, events, x + 4, y - T);
    events.push({ type: 'blockCoin', x, y });
  } else if (t === 'M') {
    world.grid[r][c] = 'U';
    world.bumps.push({ c, r, t: 0 });
    world.items.push({ x: x + 2, y: y - 0.01, w: 12, h: 12, vx: ITEM_SPEED, vy: 0, rise: 12, alive: true });
    events.push({ type: 'powerupSpawn', x, y });
  } else if (t === 'B') {
    if (p.big) {
      world.grid[r][c] = ' ';
      world.bricks += 1;
      addScore(world, POINTS.brick, events, x, y);
      events.push({ type: 'brick', x, y });
    } else {
      world.bumps.push({ c, r, t: 0 });
      events.push({ type: 'bump', x, y });
    }
  } else {
    events.push({ type: 'bump', x, y, hard: true });
  }
}

function killEnemy(world, e, events, how) {
  e.state = 'dead';
  e.alive = false;
  e.dead = 0;
  e.how = how;
  e.vy = how === 'stomp' ? 0 : -200;
  addScore(world, how === 'stomp' ? POINTS.stomp : POINTS.shell, events, e.x, e.y);
  events.push({ type: how === 'stomp' ? 'stomp' : 'kill', x: e.x, y: e.y });
}

function hurt(world, events) {
  const p = world.player;
  if (p.invulnerable > 0 || world.status !== 'playing') return;
  if (p.big) {
    p.big = false;
    p.y += p.h - SIZE.small.h;
    p.h = SIZE.small.h;
    p.invulnerable = PHYS.invulnerable;
    events.push({ type: 'shrink' });
  } else {
    die(world, events, 'enemy');
  }
}

function die(world, events, cause) {
  if (world.status !== 'playing') return;
  world.status = 'dying';
  world.cause = cause;
  world.dyingFor = 0;
  world.deaths += 1;
  world.lives -= 1;
  world.player.vy = cause === 'pit' ? 0 : -300;
  world.player.vx = 0;
  events.push({ type: 'death', cause });
}

function respawn(world, events) {
  if (world.lives <= 0) {
    world.status = 'lost';
    events.push({ type: 'gameOver' });
    return;
  }
  const cp = world.checkpoint >= 0 ? world.level.checkpoints[world.checkpoint] : null;
  world.player = spawnPlayer(cp ? cp.spawn : world.level.start, false);
  world.player.invulnerable = 1;
  world.camX = Math.max(0, world.player.x - world.viewW * 0.35);
  world.enemies = makeEnemies(world.level).map((e, i) => (world.enemies[i] && !world.enemies[i].alive ? world.enemies[i] : e));
  world.items = [];
  world.timeLeft = world.level.time;
  world.status = 'playing';
  events.push({ type: 'respawn' });
}

// ------------------------------------------------------------------ paso

function stepPlayer(world, input, events) {
  const p = world.player;
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const accel = p.onGround ? PHYS.accelGround : PHYS.accelAir;
  if (dir !== 0) {
    const turning = Math.sign(p.vx) === -dir && p.vx !== 0;
    p.vx += dir * accel * (turning ? PHYS.turnBoost : 1) * DT;
    p.facing = dir;
  } else if (p.onGround) {
    const f = PHYS.friction * DT;
    p.vx = Math.abs(p.vx) <= f ? 0 : p.vx - Math.sign(p.vx) * f;
  }
  p.vx = Math.max(-PHYS.walkMax, Math.min(PHYS.walkMax, p.vx));

  const pressed = input.jump && !p.prevJump;
  p.prevJump = input.jump;
  if (pressed) p.buffer = PHYS.buffer;
  else p.buffer = Math.max(0, p.buffer - DT);
  p.coyote = p.onGround ? PHYS.coyote : Math.max(0, p.coyote - DT);
  if (p.buffer > 0 && p.coyote > 0) {
    p.vy = -(PHYS.jumpV + Math.abs(p.vx) * PHYS.jumpSpeedBonus);
    p.jumping = true;
    p.onGround = false;
    p.coyote = 0;
    p.buffer = 0;
    events.push({ type: 'jump' });
  }
  const g = p.vy < 0 ? (input.jump && p.jumping ? PHYS.gravityHold : PHYS.gravityRelease) : PHYS.gravityDown;
  p.vy = Math.min(PHYS.maxFall, p.vy + g * DT);

  p.x += p.vx * DT;
  // La cámara solo avanza: el borde izquierdo de la vista es una pared.
  if (p.x < world.camX) {
    p.x = world.camX;
    if (p.vx < 0) p.vx = 0;
  }
  if (collideX(world, p)) p.vx = 0;
  const prevBottom = p.y + p.h;
  p.y += p.vy * DT;
  const { ground, head } = collideY(world, p, prevBottom);
  if (head) {
    p.jumping = false;
    hitBlock(world, head[0], head[1], events);
  }
  p.onGround = ground || (p.vy >= 0 && onGroundCheck(world, p));
  if (p.onGround) {
    p.jumping = false;
    p.stompChain = 0;
  }
  if (p.invulnerable > 0) p.invulnerable = Math.max(0, p.invulnerable - DT);

  // Lava y vacío
  const lvlH = world.level.rows * T;
  if (p.y > lvlH + 8) die(world, events, 'pit');
  const cx0 = Math.floor((p.x + 2) / T);
  const cx1 = Math.floor((p.x + p.w - 2) / T);
  const cy0 = Math.floor((p.y + 2) / T);
  const cy1 = Math.floor((p.y + p.h - 1) / T);
  for (let c = cx0; c <= cx1; c += 1) for (let r = cy0; r <= cy1; r += 1) if (tileAt(world, c, r) === 'L') die(world, events, 'lava');

  // Monedas sueltas
  world.level.coins.forEach((coin, i) => {
    if (!world.coins[i] && overlap(p, coin)) {
      world.coins[i] = true;
      gainCoin(world, events, coin.x, coin.y);
    }
  });

  // Banderas de control
  world.level.checkpoints.forEach((cp, i) => {
    if (i > world.checkpoint && p.x + p.w >= cp.x + 4) {
      world.checkpoint = i;
      events.push({ type: 'checkpoint', x: cp.x, y: cp.y });
    }
  });

  // Mástil final
  const flag = world.level.flag;
  if (world.status === 'playing' && p.x + p.w >= flag.x && p.x <= flag.x + flag.w + 8 && p.y + p.h >= flag.top) {
    const span = flag.bottom - flag.top;
    const height = Math.max(0, Math.min(1, (flag.bottom - (p.y + p.h)) / span));
    const bonus = [100, 400, 800, 2000, 5000][Math.min(4, Math.floor(height * 5))];
    addScore(world, bonus, events, flag.x, p.y);
    const timeBonus = Math.ceil(world.timeLeft) * POINTS.timeBonus;
    world.score += timeBonus;
    world.status = 'won';
    world.flagY = p.y;
    events.push({ type: 'flag', bonus, timeBonus, height });
  }

  // Cámara: empuja cuando el jugador pasa del 40 % de la vista.
  const maxCam = Math.max(0, world.level.cols * T - world.viewW);
  world.camX = Math.min(maxCam, Math.max(world.camX, p.x - world.viewW * 0.4));
}

function stepEnemies(world, events) {
  const p = world.player;
  for (const e of world.enemies) {
    if (e.state === 'dead') {
      e.dead += DT;
      if (e.how !== 'stomp') {
        e.vy += PHYS.gravityDown * DT;
        e.y += e.vy * DT;
      }
      continue;
    }
    if (e.grace > 0) e.grace = Math.max(0, e.grace - DT);
    if (!e.active) {
      if (e.x < world.camX + world.viewW + 24) e.active = true;
      else continue;
    }
    // Movimiento con gravedad; se gira en las paredes.
    if (e.state !== 'shell') {
      e.x += e.vx * DT;
      const hit = collideX(world, e);
      if (hit) e.vx = -hit * Math.abs(e.vx);
    } else if (e.vx !== 0) {
      e.x += e.vx * DT;
      const hit = collideX(world, e);
      if (hit) {
        e.vx = -hit * SHELL_SPEED;
        events.push({ type: 'bump', x: e.x, y: e.y, hard: true });
      }
    }
    e.vy = Math.min(PHYS.maxFall, e.vy + PHYS.gravityDown * DT);
    const prevBottom = e.y + e.h;
    e.y += e.vy * DT;
    collideY(world, e, prevBottom);
    if (e.y > world.level.rows * T + 32 || e.x < world.camX - 64) {
      e.alive = false;
      e.state = 'dead';
      e.dead = 9;
      continue;
    }
    // Caparazón en marcha: arrasa con los demás.
    if (e.state === 'shell' && e.vx !== 0) {
      for (const o of world.enemies) if (o !== e && o.alive && o.state !== 'dead' && overlap(e, o)) killEnemy(world, o, events, 'shell');
    }
    if (world.status !== 'playing' || !overlap(p, e)) continue;
    const falling = p.vy > 0 && p.y + p.h - e.y < 10;
    if (falling) {
      // Pisotón
      p.stompChain += 1;
      p.vy = -(p.prevJump ? PHYS.stompHeld : PHYS.stomp);
      p.jumping = p.prevJump;
      p.y = e.y - p.h;
      if (e.type === 'snail' && e.state === 'walk') {
        e.state = 'shell';
        e.vx = 0;
        e.h = 12;
        e.y += 2;
        addScore(world, POINTS.stomp, events, e.x, e.y);
        events.push({ type: 'stomp', x: e.x, y: e.y });
        world.stomps += 1;
      } else if (e.state === 'shell') {
        e.vx = e.vx === 0 ? (p.x + p.w / 2 < e.x + e.w / 2 ? SHELL_SPEED : -SHELL_SPEED) : 0;
        e.grace = 0.25;
        events.push({ type: 'kick', x: e.x, y: e.y });
      } else {
        killEnemy(world, e, events, 'stomp');
        world.stomps += 1;
        if (p.stompChain > 1) addScore(world, POINTS.stomp * (2 ** (p.stompChain - 1) - 1), events, e.x, e.y - 8);
      }
    } else if (e.state === 'shell' && e.vx === 0) {
      // Patear un caparazón quieto
      e.vx = p.x + p.w / 2 < e.x + e.w / 2 ? SHELL_SPEED : -SHELL_SPEED;
      e.x += Math.sign(e.vx) * 4;
      e.grace = 0.25;
      events.push({ type: 'kick', x: e.x, y: e.y });
    } else if (!(e.grace > 0)) {
      hurt(world, events);
    }
  }
}

function stepItems(world, events) {
  const p = world.player;
  for (const it of world.items) {
    if (!it.alive) continue;
    if (it.rise > 0) {
      const d = Math.min(it.rise, 24 * DT);
      it.y -= d;
      it.rise -= d;
      continue;
    }
    it.x += it.vx * DT;
    const hit = collideX(world, it);
    if (hit) it.vx = -hit * ITEM_SPEED;
    it.vy = Math.min(PHYS.maxFall, it.vy + PHYS.gravityDown * DT);
    const prevBottom = it.y + it.h;
    it.y += it.vy * DT;
    collideY(world, it, prevBottom);
    if (it.y > world.level.rows * T + 32) it.alive = false;
    if (world.status === 'playing' && overlap(p, it)) {
      it.alive = false;
      addScore(world, POINTS.powerup, events, it.x, it.y);
      if (!p.big) {
        p.big = true;
        p.y -= SIZE.big.h - p.h;
        p.h = SIZE.big.h;
        // Si al crecer queda dentro de un techo, se queda agachado... aquí basta con bajarlo hasta caber.
        while (collidesTiles(world, p) && p.h > SIZE.small.h) p.y += 1;
      }
      events.push({ type: 'powerup' });
    }
  }
  world.items = world.items.filter((it) => it.alive);
}

function collidesTiles(world, body) {
  const c0 = Math.floor(body.x / T);
  const c1 = Math.floor((body.x + body.w - 0.01) / T);
  const r0 = Math.floor(body.y / T);
  const r1 = Math.floor((body.y + body.h - 0.01) / T);
  for (let c = c0; c <= c1; c += 1) for (let r = r0; r <= r1; r += 1) if (isSolid(tileAt(world, c, r))) return true;
  return false;
}

/** Un paso de 1/60 s. input: { left, right, jump }. Devuelve los eventos ocurridos. */
export function step(world, input = {}) {
  const events = [];
  if (world.status === 'won' || world.status === 'lost') return events;
  world.t += DT;
  world.frame += 1;
  world.bumps = world.bumps.filter((b) => (b.t += DT) < 0.2);

  if (world.status === 'dying') {
    world.dyingFor += DT;
    const p = world.player;
    if (world.cause !== 'pit') {
      p.vy += PHYS.gravityDown * DT;
      p.y += p.vy * DT;
    }
    if (world.dyingFor >= PHYS.respawn) respawn(world, events);
    return events;
  }

  world.timeLeft = Math.max(0, world.timeLeft - DT);
  if (world.timeLeft <= 0) {
    die(world, events, 'time');
    return events;
  }
  stepPlayer(world, input, events);
  if (world.status === 'playing') stepEnemies(world, events);
  if (world.status === 'playing') stepItems(world, events);
  return events;
}

/** Monedas de un nivel (sueltas + bloques «?»). */
export function coinTotal(def) {
  const text = def.rows.join('');
  return (text.match(/o/g) ?? []).length + (text.match(/\?/g) ?? []).length;
}

// ------------------------------------------------------------------ utilidades (planificador y pruebas)

/** Copia independiente del mundo (para explorar jugadas sin tocar el original). */
export function cloneWorld(w) {
  return {
    ...w,
    grid: w.grid.map((r) => [...r]),
    player: { ...w.player },
    enemies: w.enemies.map((e) => ({ ...e })),
    items: w.items.map((i) => ({ ...i })),
    bumps: w.bumps.map((b) => ({ ...b })),
    coins: w.coins.slice(),
  };
}

/** Entradas como máscara: 1 izquierda, 2 derecha, 4 salto. */
export const decodeInput = (mask) => ({ left: Boolean(mask & 1), right: Boolean(mask & 2), jump: Boolean(mask & 4) });

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
