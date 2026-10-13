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

const LEVEL_H = 14 * T;

const THEMES = {
  pradera: { sky: ['#7ec8ff', '#cdeeff'], ground: '#b5713a', groundDark: '#7d4a22', top: '#5fcf5a', hill: '#6fbf73', far: '#a6dcae', brick: '#c8643b', block: '#e8a33d' },
  subsuelo: { sky: ['#0d0f1e', '#1c1d34'], ground: '#4a5a7a', groundDark: '#2e3850', top: '#6c7fa3', hill: '#1d2238', far: '#171a2c', brick: '#5b6f99', block: '#c98f2e' },
  copas: { sky: ['#ff9f7a', '#ffd7a1'], ground: '#8a5a33', groundDark: '#5c3a1f', top: '#7ad16c', hill: '#c9708a', far: '#f1a98c', brick: '#c8643b', block: '#e8a33d' },
  castillo: { sky: ['#1a0b14', '#3b1420'], ground: '#5d5560', groundDark: '#3a333d', top: '#7a7080', hill: '#2a1119', far: '#220d15', brick: '#6e6170', block: '#d39a35' },
};

export function createRenderState() {
  return { time: 0, popups: [], debris: [], coinPops: [], layout: null };
}

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

function drawBackground(ctx, theme, camX, viewW, time) {
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
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.ellipse(px, py, 18, 7, 0, 0, Math.PI * 2);
      ctx.ellipse(px + 12, py - 4, 12, 7, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawTile(ctx, ch, x, y, theme, world, c, r, time) {
  switch (ch) {
    case '#': {
      const top = r === 0 || world.grid[r - 1][c] !== '#';
      rect(ctx, x, y, T, T, theme.ground);
      rect(ctx, x, y + T - 3, T, 3, theme.groundDark);
      rect(ctx, x + ((c * 5) % 11), y + 6, 2, 2, theme.groundDark);
      if (top) {
        rect(ctx, x, y, T, 4, theme.top);
        rect(ctx, x + ((c * 3) % 13), y + 4, 2, 2, theme.top);
      }
      break;
    }
    case '=':
      rect(ctx, x, y, T, T, theme.groundDark);
      rect(ctx, x + 1, y + 1, T - 2, T - 2, theme.ground);
      rect(ctx, x + 1, y + 1, T - 2, 2, 'rgba(255,255,255,0.25)');
      rect(ctx, x + 1, y + T - 3, T - 2, 2, 'rgba(0,0,0,0.25)');
      break;
    case 'B':
      rect(ctx, x, y, T, T, theme.brick);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(x, y + 7, T, 1);
      ctx.fillRect(x, y + 15, T, 1);
      ctx.fillRect(x + 7, y, 1, 7);
      ctx.fillRect(x + 3, y + 8, 1, 7);
      ctx.fillRect(x + 12, y + 8, 1, 7);
      rect(ctx, x, y, T, 1, 'rgba(255,255,255,0.25)');
      break;
    case '?':
    case 'M': {
      const glow = 0.5 + 0.5 * Math.sin(time * 4 + c);
      rect(ctx, x, y, T, T, '#7a4a12');
      rect(ctx, x + 1, y + 1, T - 2, T - 2, theme.block);
      rect(ctx, x + 1, y + 1, T - 2, 2, 'rgba(255,255,255,0.35)');
      drawStar(ctx, x + T / 2, y + T / 2 + 0.5, 5, `rgba(255, 250, 220, ${0.6 + glow * 0.4})`);
      break;
    }
    case 'U':
      rect(ctx, x, y, T, T, '#5a3a1e');
      rect(ctx, x + 1, y + 1, T - 2, T - 2, '#8b5e34');
      break;
    case 'T': {
      // Columna de piedra (las «tuberías» de este reino): capitel arriba.
      const top = r === 0 || world.grid[r - 1][c] !== 'T';
      const left = c === 0 || world.grid[r][c - 1] !== 'T';
      rect(ctx, x, y, T, T, '#3f9c94');
      rect(ctx, x + (left ? 2 : 0), y, 3, T, 'rgba(255,255,255,0.25)');
      rect(ctx, x + (left ? 9 : 7), y, 2, T, 'rgba(0,0,0,0.18)');
      if (top) {
        rect(ctx, x - (left ? 1 : 0), y, T + 1, 5, '#55c2b8');
        rect(ctx, x - (left ? 1 : 0), y + 5, T + 1, 1, 'rgba(0,0,0,0.3)');
      }
      break;
    }
    case '-': {
      // Copa de árbol: hojas encima y tronco hasta el suelo (decorado).
      rect(ctx, x, y, T, 6, '#4fae55');
      rect(ctx, x, y, T, 2, '#7ad16c');
      rect(ctx, x + ((c * 7) % 12), y + 2, 3, 2, '#3c8a42');
      const left = world.grid[r][c - 1] !== '-';
      const right = world.grid[r][c + 1] !== '-';
      if (left) rect(ctx, x - 2, y + 1, 3, 5, '#4fae55');
      if (right) rect(ctx, x + T - 1, y + 1, 3, 5, '#4fae55');
      break;
    }
    case 'L': {
      const wave = Math.sin(time * 3 + c * 0.9) * 1.5;
      rect(ctx, x, y + 3 + wave, T, T - 3 - wave, '#e8441a');
      rect(ctx, x, y + 3 + wave, T, 3, '#ffb347');
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

function drawPlayer(ctx, p, time, dying) {
  if (p.invulnerable > 0 && Math.floor(time * 16) % 2 === 0 && !dying) return;
  const x = Math.round(p.x);
  const y = Math.round(p.y);
  const f = p.facing;
  const big = p.h > SIZE.small.h;
  const run = Math.abs(p.vx) > 10 && p.onGround ? Math.floor(time * 12) % 2 : 0;
  ctx.save();
  if (f < 0) {
    ctx.translate(x + p.w / 2, 0);
    ctx.scale(-1, 1);
    ctx.translate(-(x + p.w / 2), 0);
  }
  const h = p.h;
  const headH = big ? 10 : 7;
  // Botas
  rect(ctx, x + 1 + (run ? 1 : 0), y + h - 3, 4, 3, '#3a2440');
  rect(ctx, x + 7 - (run ? 1 : 0), y + h - 3, 4, 3, '#3a2440');
  // Abrigo
  rect(ctx, x + 1, y + headH, 10, h - headH - 3, '#2f8f9d');
  rect(ctx, x + 1, y + headH, 10, 2, '#46b3c2');
  if (big) rect(ctx, x + 5, y + headH + 3, 2, h - headH - 7, '#24707b');
  // Bufanda rosa (ondea)
  rect(ctx, x, y + headH - 1, 12, 3, '#ff6fa8');
  rect(ctx, x - 3 - (run ? 1 : 0), y + headH, 4, 2, '#ff6fa8');
  // Cara y casco
  rect(ctx, x + 2, y + 1, 9, headH - 1, '#ffd9b8');
  rect(ctx, x + 1, y, 11, big ? 4 : 3, '#f2b632');
  rect(ctx, x + 1, y + (big ? 3 : 2), 4, 1, '#f2b632');
  rect(ctx, x + 8, y + (big ? 5 : 3), 2, 2, '#2a1a2a');
  ctx.restore();
}

function drawEnemy(ctx, e, time) {
  const x = Math.round(e.x);
  const y = Math.round(e.y);
  if (e.state === 'dead' && e.how === 'stomp') {
    if (e.dead > 0.5) return;
    rect(ctx, x, y + e.h - 4, e.w, 4, '#5b3a7a');
    return;
  }
  const flip = e.state === 'dead';
  ctx.save();
  if (flip) {
    ctx.translate(0, y * 2 + e.h);
    ctx.scale(1, -1);
  }
  if (e.type === 'walker') {
    const step = Math.floor(time * 8) % 2;
    rect(ctx, x + 1 + step, y + e.h - 2, 3, 2, '#2a1a2a');
    rect(ctx, x + e.w - 4 - step, y + e.h - 2, 3, 2, '#2a1a2a');
    ctx.fillStyle = '#6b3fa0';
    ctx.beginPath();
    ctx.ellipse(x + e.w / 2, y + e.h / 2 + 1, e.w / 2, e.h / 2 - 1, 0, 0, Math.PI * 2);
    ctx.fill();
    rect(ctx, x + e.w / 2 - 0.5, y + 2, 1, e.h - 5, '#4a2a74');
    rect(ctx, x + 2, y + 4, 3, 3, '#fff');
    rect(ctx, x + e.w - 5, y + 4, 3, 3, '#fff');
    rect(ctx, x + 3, y + 5, 1, 1, '#000');
    rect(ctx, x + e.w - 4, y + 5, 1, 1, '#000');
  } else {
    // Caracol: concha en espiral; escondido solo se ve la concha.
    if (e.state === 'walk') {
      rect(ctx, x, y + e.h - 4, e.w, 4, '#9be37a');
      rect(ctx, x - 1, y + e.h - 9, 3, 6, '#9be37a');
      rect(ctx, x - 1, y + e.h - 11, 1, 3, '#9be37a');
    }
    ctx.fillStyle = '#ff9f43';
    ctx.beginPath();
    ctx.arc(x + e.w / 2 + 1, y + e.h / 2, e.h / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#a3561c';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 4; a += 0.3) {
      const rr = (a / (Math.PI * 4)) * (e.h / 2 - 1.5);
      ctx.lineTo(x + e.w / 2 + 1 + Math.cos(a) * rr, y + e.h / 2 + Math.sin(a) * rr);
    }
    ctx.stroke();
  }
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

  drawBackground(ctx, theme, camX, v.viewW, reduced ? 0 : view.time);
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
      if (ch !== ' ') drawTile(ctx, ch, c * T, r * T + bumpOf(c, r), theme, world, c, r, reduced ? 0 : view.time);
    }
  }

  // Monedas
  world.level.coins.forEach((coin, i) => {
    if (world.coins[i] || coin.x < camX - T || coin.x > camX + v.viewW + T) return;
    const squash = reduced ? 1 : Math.abs(Math.cos(view.time * 3 + coin.x * 0.05));
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.ellipse(coin.x + 5, coin.y + 6, Math.max(1.2, 5 * squash), 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff4b0';
    ctx.fillRect(coin.x + 4, coin.y + 2, 1.5, 6);
  });

  for (const it of world.items) drawHeart(ctx, it.x + 6, it.y + 6, 5.5, '#ff4f8b');
  for (const e of world.enemies) if (e.active || e.state === 'dead') drawEnemy(ctx, e, view.time);
  drawPlayer(ctx, world.player, view.time, world.status === 'dying');

  // Efectos
  view.coinPops = view.coinPops.filter((p) => (p.t += dt) < 0.45);
  for (const p of view.coinPops) {
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.ellipse(p.x + 5, p.y - p.t * 70, 4, 6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  view.debris = view.debris.filter((d) => (d.t += dt) < 0.8);
  for (const d of view.debris) {
    d.vy += 900 * dt;
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    rect(ctx, d.x, d.y, 5, 5, theme.brick);
  }
  view.popups = view.popups.filter((p) => (p.t += dt) < 0.8);
  ctx.font = 'bold 8px Manrope, system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const p of view.popups) {
    ctx.fillStyle = `rgba(255,255,255,${1 - p.t / 0.8})`;
    ctx.fillText(p.text, p.x + 8, p.y - p.t * 30);
  }
  ctx.restore();
}
