/**
 * Dibujo de «Reino de Ladrillos» en Canvas 2D, con píxeles grandes y gráficos
 * originales: una exploradora de bufanda rosa, gorgojos, caracoles, columnas de
 * piedra, bloques con una estrella grabada y, al final de cada nivel, un pequeño
 * observatorio con un banderín de corazón.
 *
 * La vista mide siempre 14 casillas de alto (todo el nivel); el ancho visible
 * depende de la pantalla y se le comunica al motor (`world.viewW`).
 */
import { SIZE, T } from './brickEngine.js';
import { createSpriteCache } from '../../../render/sprites.js';
import {
  BLOCK,
  BRICK,
  COIN,
  COIN_PALETTE,
  GROUND,
  GROUND_TOP,
  HARD,
  HEART,
  HEART_PALETTE,
  PLAYER_PALETTE,
  SHELL,
  SNAIL,
  SNAIL_PALETTE,
  WEEVIL,
  WEEVIL_FLAT,
  WEEVIL_PALETTE,
  pixelSprite,
  playerFrame,
} from './pixelArt.js';

const LEVEL_H = 14 * T;

const THEMES = {
  pradera: { sky: ['#7ec8ff', '#cdeeff'], ground: '#b5713a', groundDark: '#7d4a22', top: '#5fcf5a', hill: '#6fbf73', far: '#a6dcae', brick: '#c8643b', block: '#e8a33d' },
  subsuelo: { sky: ['#0d0f1e', '#1c1d34'], ground: '#4a5a7a', groundDark: '#2e3850', top: '#6c7fa3', hill: '#1d2238', far: '#171a2c', brick: '#5b6f99', block: '#c98f2e' },
  copas: { sky: ['#ff9f7a', '#ffd7a1'], ground: '#8a5a33', groundDark: '#5c3a1f', top: '#7ad16c', hill: '#c9708a', far: '#f1a98c', brick: '#c8643b', block: '#e8a33d' },
  castillo: { sky: ['#1a0b14', '#3b1420'], ground: '#5d5560', groundDark: '#3a333d', top: '#7a7080', hill: '#2a1119', far: '#220d15', brick: '#6e6170', block: '#d39a35' },
};

export function createRenderState() {
  return { time: 0, popups: [], debris: [], coinPops: [], layout: null, sprites: createSpriteCache(120) };
}

export function disposeRenderState(view) {
  view.sprites?.clear();
}

/** Aclara (f > 0) u oscurece (f < 0) un color hex. */
function tone(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (c) => Math.round(f < 0 ? c * (1 + f) : c + (255 - c) * f);
  const r = ch((n >> 16) & 255);
  const g = ch((n >> 8) & 255);
  const b = ch(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/** Paletas de las losetas de cada ambiente (derivadas de sus colores). */
const tilePalettes = new Map();
function paletteFor(theme) {
  let p = tilePalettes.get(theme);
  if (p) return p;
  p = {
    ground: { G: theme.top, H: tone(theme.top, 0.35), g: tone(theme.top, -0.25), D: theme.ground, d: theme.groundDark, l: tone(theme.ground, 0.18) },
    brick: { R: theme.brick, r: tone(theme.brick, -0.25), L: tone(theme.brick, 0.3), m: tone(theme.groundDark, -0.2) },
    block: { o: '#4a2a0c', Y: tone(theme.block, 0.45), y: theme.block, z: tone(theme.block, -0.3), q: '#7a4a12', S: '#fff3cf' },
    used: { o: '#3a240f', Y: '#a9784a', y: '#8b5e34', z: '#5a3a1e', q: '#5a3a1e', S: '#8b5e34' },
    hard: { L: tone(theme.ground, 0.35), l: theme.ground, D: theme.groundDark, d: tone(theme.groundDark, -0.25) },
  };
  tilePalettes.set(theme, p);
  return p;
}

const CLOUD = [
  '..........oooo..........',
  '.......ooowwwwooo.......',
  '.....oowwwwwwwwwwoo.....',
  '..ooowwwwwwwwwwwwwwooo..',
  '.owwwwwwwwwwwwwwwwwwwwo.',
  'owwwwwwwwwwwwwwwwwwwwwwo',
  'owwwwwwwwwwwwwwwwwwwwwwo',
  'oWWWwwwwwwwwwwwwwwwWWWWo',
  '.oWWWWWWWWWWWWWWWWWWWWo.',
  '..oooooooooooooooooooo..',
];
const CLOUD_PALETTE = { o: '#9fc3e6', w: '#ffffff', W: '#dcebfa' };

export function addEffects(view, events, reduced) {
  for (const e of events) {
    if (e.type === 'score' && e.points >= 100) view.popups.push({ x: e.x, y: e.y, text: String(e.points), t: 0 });
    if (e.type === 'blockCoin') view.coinPops.push({ x: e.x + 3, y: e.y - 4, t: 0 });
    if (e.type === 'brick' && !reduced)
      for (const [dx, dy] of [[-1, -1.4], [1, -1.4], [-0.7, -0.6], [0.7, -0.6]]) view.debris.push({ x: e.x + 8, y: e.y + 8, vx: dx * 70, vy: dy * 160, t: 0 });
  }
}

/** Escala y ancho visible del mundo para el tamaño del lienzo. */
export function computeView(width, height, { insetBottom = 0, insetTop = 0 } = {}) {
  const availH = Math.max(100, height - insetBottom - insetTop);
  const scale = Math.max(1, Math.min(availH / LEVEL_H, width / 256));
  const viewW = Math.min(width / scale, 30 * T);
  const offsetY = insetTop + Math.max(0, (availH - LEVEL_H * scale) / 2);
  return { scale, viewW, offsetY };
}

function rect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.ceil(w), Math.ceil(h));
}

function drawStar(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

function drawHeart(ctx, cx, cy, s, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy + s * 0.9);
  ctx.bezierCurveTo(cx - s * 1.4, cy, cx - s * 0.7, cy - s, cx, cy - s * 0.35);
  ctx.bezierCurveTo(cx + s * 0.7, cy - s, cx + s * 1.4, cy, cx, cy + s * 0.9);
  ctx.fill();
}

function drawBackground(ctx, theme, camX, viewW, time, sprites) {
  const g = ctx.createLinearGradient(0, 0, 0, LEVEL_H);
  g.addColorStop(0, theme.sky[0]);
  g.addColorStop(1, theme.sky[1]);
  ctx.fillStyle = g;
  ctx.fillRect(camX - 2, -LEVEL_H, viewW + 4, LEVEL_H * 3);
  // Colinas lejanas con paralaje
  for (const [factor, color, amp, base] of [
    [0.25, theme.far, 26, 150],
    [0.5, theme.hill, 34, 170],
  ]) {
    ctx.fillStyle = color;
    ctx.beginPath();
    const off = camX * (1 - factor);
    ctx.moveTo(camX - 2, LEVEL_H);
    for (let x = camX - 2; x <= camX + viewW + 4; x += 8) {
      const wx = x - off;
      ctx.lineTo(x, base - Math.abs(Math.sin(wx / 90)) * amp - Math.sin(wx / 37) * 6);
    }
    ctx.lineTo(camX + viewW + 4, LEVEL_H);
    ctx.fill();
    // Contorno y matas: las colinas parecen ilustradas, no manchas planas.
    ctx.strokeStyle = tone(color, -0.25);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = camX - 2; x <= camX + viewW + 4; x += 8) {
      const wx = x - off;
      const y = base - Math.abs(Math.sin(wx / 90)) * amp - Math.sin(wx / 37) * 6;
      if (x === camX - 2) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.fillStyle = tone(color, -0.12);
    for (let x = Math.floor((camX - off) / 23) * 23; x < camX - off + viewW + 23; x += 23) {
      const sx = x + off;
      const y = base - Math.abs(Math.sin(x / 90)) * amp - Math.sin(x / 37) * 6;
      const k = Math.abs(Math.sin(x * 12.9898));
      if (k < 0.55) continue;
      ctx.beginPath();
      ctx.arc(sx, y + 14 + k * 30, 3 + k * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Nubes (o estrellas en los niveles oscuros)
  const dark = theme === THEMES.subsuelo || theme === THEMES.castillo;
  for (let i = 0; i < 24; i += 1) {
    const px = i * 140 + ((i * 53) % 60) + camX * 0.6 + (dark ? 0 : time * 3);
    if (px < camX - 60 || px > camX + viewW + 60) continue;
    const py = 20 + ((i * 53) % 70);
    if (dark) {
      rect(ctx, px, py, 2, 2, '#e8e4ff');
      rect(ctx, px + 47, py + 31, 1, 1, '#8a7fb0');
    } else {
      const cloud = pixelSprite(sprites, 'cloud', CLOUD, CLOUD_PALETTE);
      ctx.drawImage(cloud.canvas, Math.round(px - 12), Math.round(py - 6));
    }
  }
}

function drawTile(ctx, ch, x, y, theme, world, c, r, time, sprites) {
  const pal = paletteFor(theme);
  const themeKey = theme.top + theme.ground;
  switch (ch) {
    case '#': {
      const top = r === 0 || world.grid[r - 1][c] !== '#';
      const sprite = top ? pixelSprite(sprites, `gt${themeKey}`, GROUND_TOP, pal.ground) : pixelSprite(sprites, `g${themeKey}${c % 2}`, GROUND, pal.ground, c % 2 === 1);
      ctx.drawImage(sprite.canvas, x, y);
      break;
    }
    case '=':
      ctx.drawImage(pixelSprite(sprites, `h${themeKey}`, HARD, pal.hard).canvas, x, y);
      break;
    case 'B':
      ctx.drawImage(pixelSprite(sprites, `b${theme.brick}${theme.groundDark}`, BRICK, pal.brick).canvas, x, y);
      break;
    case '?':
    case 'M': {
      ctx.drawImage(pixelSprite(sprites, `q${theme.block}`, BLOCK, pal.block).canvas, x, y);
      // La estrella late: invita a golpear el bloque.
      const glow = 0.5 + 0.5 * Math.sin(time * 4 + c);
      drawStar(ctx, x + T / 2, y + 7, 4.2, `rgba(255, 255, 240, ${glow * 0.45})`);
      break;
    }
    case 'U':
      ctx.drawImage(pixelSprite(sprites, 'used', BLOCK, pal.used).canvas, x, y);
      break;
    case 'T': {
      // Columna de piedra (las «tuberías» de este reino): capitel arriba.
      const top = r === 0 || world.grid[r - 1][c] !== 'T';
      const left = c === 0 || world.grid[r][c - 1] !== 'T';
      // Fuste cilíndrico en bandas de luz (pixel art) con estrías y capitel moldurado.
      const bands = left ? ['#2a6f69', '#3f9c94', '#7fded4', '#55c2b8', '#3f9c94', '#3f9c94', '#3f9c94', '#3f9c94'] : ['#3f9c94', '#3f9c94', '#3f9c94', '#368a83', '#2f7b75', '#2a6f69', '#225c57', '#1a4a46'];
      for (let k = 0; k < 8; k += 1) rect(ctx, x + k * 2, y, 2, T, bands[k]);
      rect(ctx, x + (left ? 0 : T - 1), y, 1, T, '#163f3b');
      if ((r + c) % 2 === 0) rect(ctx, x + 6, y + 4, 1, 8, 'rgba(0,0,0,0.15)');
      if (top) {
        rect(ctx, x - (left ? 1 : 0), y, T + 1, 6, '#163f3b');
        rect(ctx, x - (left ? 1 : 0) + 1, y + 1, T - 1, 4, '#55c2b8');
        rect(ctx, x - (left ? 1 : 0) + 1, y + 1, T - 1, 1, '#9cefe6');
        rect(ctx, x - (left ? 1 : 0), y + 6, T + 1, 1, 'rgba(0,0,0,0.3)');
      }
      break;
    }
    case '-': {
      // Copa de árbol: hojas encima y tronco hasta el suelo (decorado).
      rect(ctx, x, y - 1, T, 7, '#2c6a33');
      rect(ctx, x, y, T, 5, '#4fae55');
      rect(ctx, x, y, T, 2, '#7ad16c');
      rect(ctx, x + ((c * 7) % 12), y + 2, 3, 2, '#3c8a42');
      rect(ctx, x + ((c * 5 + 6) % 13), y + 1, 2, 1, '#a8e68f');
      const left = world.grid[r][c - 1] !== '-';
      const right = world.grid[r][c + 1] !== '-';
      if (left) rect(ctx, x - 2, y + 1, 3, 5, '#4fae55');
      if (right) rect(ctx, x + T - 1, y + 1, 3, 5, '#4fae55');
      break;
    }
    case 'L': {
      const wave = Math.sin(time * 3 + c * 0.9) * 1.5;
      rect(ctx, x, y + 3 + wave, T, T - 3 - wave, '#c22f12');
      rect(ctx, x, y + 6 + wave, T, T - 6 - wave, '#e8441a');
      rect(ctx, x, y + 3 + wave, T, 3, '#ffb347');
      rect(ctx, x + ((c * 5) % 12), y + 9 + wave, 2, 2, '#ffd27a');
      const bubble = (time * 1.3 + c * 0.37) % 1;
      if (bubble < 0.3) rect(ctx, x + ((c * 7) % 11) + 2, y + 2 + wave - bubble * 10, 2, 2, '#ffb347');
      break;
    }
    default:
  }
}

function drawTrunks(ctx, world, c0, c1) {
  for (let c = c0; c <= c1; c += 1) {
    for (let r = 0; r < world.level.rows; r += 1) {
      if (world.grid[r][c] !== '-') continue;
      const left = world.grid[r][c - 1] !== '-';
      let len = 0;
      while (world.grid[r][c + len] === '-') len += 1;
      if (!left) continue;
      const mid = c + Math.floor(len / 2);
      rect(ctx, mid * T + 4, (r + 1) * T - 10, 8, LEVEL_H - (r + 1) * T + 10, '#7a4a28');
      rect(ctx, mid * T + 4, (r + 1) * T - 10, 2, LEVEL_H, 'rgba(255,255,255,0.12)');
    }
  }
}

function drawPlayer(ctx, p, time, dying, sprites) {
  if (p.invulnerable > 0 && Math.floor(time * 16) % 2 === 0 && !dying) return;
  const big = p.h > SIZE.small.h;
  const running = Math.abs(p.vx) > 10 && p.onGround;
  const pose = dying || !p.onGround ? 'jump' : running ? (Math.floor(time * 12) % 2 ? 'runA' : 'runB') : 'idle';
  const flip = p.facing < 0;
  const sprite = pixelSprite(sprites, `p${big ? 'B' : 's'}${pose}${flip ? 'L' : 'R'}`, playerFrame(big, pose), PLAYER_PALETTE, flip);
  // El sprite tiene el ancho (12) y el alto de la caja: lo que se ve es lo que choca.
  ctx.drawImage(sprite.canvas, Math.round(p.x + (p.w - sprite.w) / 2), Math.round(p.y + p.h - sprite.h));
}

function drawEnemy(ctx, e, time, sprites) {
  const x = Math.round(e.x);
  const y = Math.round(e.y);
  if (e.state === 'dead' && e.how === 'stomp') {
    if (e.dead > 0.5) return;
    ctx.drawImage(pixelSprite(sprites, 'wflat', WEEVIL_FLAT, WEEVIL_PALETTE).canvas, x, y + e.h - 4);
    return;
  }
  const flip = e.state === 'dead';
  ctx.save();
  if (flip) {
    ctx.translate(0, y * 2 + e.h);
    ctx.scale(1, -1);
  }
  const step = Math.floor(time * 8) % 2;
  const right = e.vx > 0;
  let sprite;
  if (e.type === 'walker') sprite = pixelSprite(sprites, `w${step}`, WEEVIL[step], WEEVIL_PALETTE);
  else if (e.state === 'walk') sprite = pixelSprite(sprites, `s${step}${right ? 'R' : 'L'}`, SNAIL[step], SNAIL_PALETTE, right);
  else sprite = pixelSprite(sprites, 'shell', SHELL, SNAIL_PALETTE);
  ctx.drawImage(sprite.canvas, x + Math.round((e.w - sprite.w) / 2), y + e.h - sprite.h);
  ctx.restore();
}

function drawGoal(ctx, flag, theme, won, flagY) {
  const x = flag.x;
  rect(ctx, x, flag.top, 3, flag.bottom - flag.top, '#d9d9e6');
  rect(ctx, x - 1, flag.top - 3, 5, 4, '#ffd166');
  const py = won && flagY !== null ? Math.min(flag.bottom - 14, flagY) : flag.top + 4;
  ctx.fillStyle = '#ff6fa8';
  ctx.beginPath();
  ctx.moveTo(x + 3, py);
  ctx.lineTo(x + 20, py + 6);
  ctx.lineTo(x + 3, py + 12);
  ctx.fill();
  drawHeart(ctx, x + 9, py + 6, 2.6, '#fff');
  // Observatorio
  const ox = x + 3 * T;
  const base = flag.bottom;
  rect(ctx, ox, base - 40, 48, 40, theme === THEMES.castillo || theme === THEMES.subsuelo ? '#6e6170' : '#efe6d8');
  rect(ctx, ox + 18, base - 18, 12, 18, '#3a2440');
  ctx.fillStyle = '#c3cbe6';
  ctx.beginPath();
  ctx.arc(ox + 24, base - 40, 22, Math.PI, 0);
  ctx.fill();
  rect(ctx, ox + 21, base - 62, 6, 22, '#8a93b8');
  ctx.strokeStyle = '#3a2440';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(ox + 24, base - 48);
  ctx.lineTo(ox + 40, base - 66);
  ctx.stroke();
  if (won) drawStar(ctx, ox + 46, base - 74, 5, '#fff3b0');
}

export function renderBricks(ctx, size, world, view, dt, { insetBottom = 0, reduced = false } = {}) {
  if (!ctx || !size.width) return;
  view.time += dt;
  const { width, height } = size;
  const v = computeView(width, height, { insetBottom, insetTop: 0 });
  view.layout = v;
  world.viewW = v.viewW;
  const theme = THEMES[world.level.theme] ?? THEMES.pradera;
  const camX = world.camX;

  ctx.fillStyle = theme.sky[1];
  ctx.fillRect(0, 0, width, height);
  ctx.save();
  ctx.translate(0, v.offsetY);
  ctx.scale(v.scale, v.scale);
  ctx.translate(-Math.round(camX * v.scale) / v.scale, 0);
  ctx.imageSmoothingEnabled = false;

  view.sprites ??= createSpriteCache(120);
  const sprites = view.sprites;
  drawBackground(ctx, theme, camX, v.viewW, reduced ? 0 : view.time, sprites);
  const c0 = Math.max(0, Math.floor(camX / T) - 1);
  const c1 = Math.min(world.level.cols - 1, Math.ceil((camX + v.viewW) / T) + 1);
  drawTrunks(ctx, world, Math.max(0, c0 - 8), c1);
  drawGoal(ctx, world.level.flag, theme, world.status === 'won', world.flagY);

  // Banderas de control
  world.level.checkpoints.forEach((cp, i) => {
    if (cp.x < camX - T || cp.x > camX + v.viewW + T) return;
    const reached = i <= world.checkpoint;
    rect(ctx, cp.x + 7, cp.y - 16, 2, 32, '#d9d9e6');
    ctx.fillStyle = reached ? '#ff6fa8' : '#8a8aa0';
    ctx.beginPath();
    const fy = reached ? cp.y - 16 : cp.y + 4;
    ctx.moveTo(cp.x + 9, fy);
    ctx.lineTo(cp.x + 19, fy + 4);
    ctx.lineTo(cp.x + 9, fy + 8);
    ctx.fill();
  });

  const bumpOf = (c, r) => {
    const b = world.bumps.find((bb) => bb.c === c && bb.r === r);
    return b ? -Math.sin((b.t / 0.2) * Math.PI) * 4 : 0;
  };
  for (let r = 0; r < world.level.rows; r += 1) {
    for (let c = c0; c <= c1; c += 1) {
      const ch = world.grid[r][c];
      if (ch !== ' ') drawTile(ctx, ch, c * T, r * T + bumpOf(c, r), theme, world, c, r, reduced ? 0 : view.time, sprites);
    }
  }

  // Monedas
  world.level.coins.forEach((coin, i) => {
    if (world.coins[i] || coin.x < camX - T || coin.x > camX + v.viewW + T) return;
    // Moneda que gira: tres fotogramas (de frente, de tres cuartos y de canto).
    const turn = reduced ? 1 : Math.abs(Math.cos(view.time * 3 + coin.x * 0.05));
    const frame = turn > 0.66 ? 0 : turn > 0.25 ? 1 : 2;
    ctx.drawImage(pixelSprite(sprites, `coin${frame}`, COIN[frame], COIN_PALETTE).canvas, coin.x, coin.y);
  });

  const heart = pixelSprite(sprites, 'heart', HEART, HEART_PALETTE);
  for (const it of world.items) ctx.drawImage(heart.canvas, Math.round(it.x), Math.round(it.y + 1));
  for (const e of world.enemies) if (e.active || e.state === 'dead') drawEnemy(ctx, e, view.time, sprites);
  drawPlayer(ctx, world.player, view.time, world.status === 'dying', sprites);

  // Efectos
  view.coinPops = view.coinPops.filter((p) => (p.t += dt) < 0.45);
  for (const p of view.coinPops) {
    const frame = Math.floor(p.t * 14) % 3;
    ctx.drawImage(pixelSprite(sprites, `coin${frame}`, COIN[frame], COIN_PALETTE).canvas, Math.round(p.x), Math.round(p.y - p.t * 70));
  }
  view.debris = view.debris.filter((d) => (d.t += dt) < 0.8);
  for (const d of view.debris) {
    d.vy += 900 * dt;
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    rect(ctx, d.x, d.y, 5, 5, theme.brick);
    rect(ctx, d.x, d.y, 5, 1, tone(theme.brick, 0.3));
    rect(ctx, d.x + 4, d.y, 1, 5, tone(theme.brick, -0.3));
  }
  view.popups = view.popups.filter((p) => (p.t += dt) < 0.8);
  ctx.font = 'bold 8px Manrope, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  for (const p of view.popups) {
    const a = 1 - p.t / 0.8;
    ctx.strokeStyle = `rgba(42,26,42,${a})`;
    ctx.strokeText(p.text, p.x + 8, p.y - p.t * 30);
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.fillText(p.text, p.x + 8, p.y - p.t * 30);
  }
  ctx.restore();
}
