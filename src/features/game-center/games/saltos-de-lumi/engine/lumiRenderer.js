/**
 * Dibujo de «Saltos de Lumi» en Canvas 2D (solo lee el mundo; no lo cambia).
 *
 * Lumi es una chispa de luz: recoge chispas, enciende faroles y llega hasta una
 * vela que se enciende al tocarla. Cada nivel tiene su ambiente (atardecer en la
 * pradera, bosque, cueva, nubes, noche) con fondos en paralaje.
 */
import { PH, PW, T, isSolidChar, tileAt } from './lumiEngine.js';

export const THEMES = Object.freeze({
  pradera: { sky: ['#2b2350', '#7a4a78', '#f0a27a'], far: '#5a3d6b', near: '#3e2f57', top: '#7fd39a', body: '#4a3552', edge: '#2e2238', block: '#d98f5c', plank: '#c8875a', stars: false },
  bosque: { sky: ['#0d2a2c', '#1d4a45', '#4f8a6e'], far: '#173c39', near: '#0f2c2a', top: '#8fd17a', body: '#2f3b2c', edge: '#1c2619', block: '#9a7b52', plank: '#a77d4f', stars: false },
  cueva: { sky: ['#0d0b16', '#1a1528', '#2a2238'], far: '#211b30', near: '#171223', top: '#7b6fa3', body: '#2c2540', edge: '#1a1528', block: '#5d5280', plank: '#7a6a9a', stars: false, crystals: true },
  nubes: { sky: ['#6d8fe0', '#a9b8f0', '#ffd6e8'], far: '#ffffff', near: '#f3e9ff', top: '#ffffff', body: '#dfe3fb', edge: '#b9c1ea', block: '#ffc9a8', plank: '#e7b0d6', stars: false, cloudy: true },
  noche: { sky: ['#070a22', '#151a45', '#2d2a63'], far: '#1c1f4a', near: '#13153a', top: '#6c7bd6', body: '#1e2150', edge: '#11133a', block: '#4b4f9a', plank: '#6a5fb0', stars: true },
});

export function createRenderState() {
  return { camX: null, camY: null, particles: [], squash: 0, time: 0, seen: 0 };
}

/** Añade efectos (partículas, sacudidas) según los eventos del motor. */
export function addEffects(view, events, world, reduced) {
  if (reduced) return;
  const burst = (x, y, color, n, speed = 70) => {
    for (let i = 0; i < n; i += 1) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
      view.particles.push({ x, y, vx: Math.cos(a) * speed * (0.5 + Math.random()), vy: Math.sin(a) * speed * (0.5 + Math.random()) - 20, life: 0.5 + Math.random() * 0.3, color });
    }
  };
  for (const e of events) {
    if (e.type === 'coin') {
      const c = world.level.coins[e.index];
      burst(c.x, c.y, '#ffe27a', 8, 60);
    } else if (e.type === 'stomp') burst(e.x + 6, e.y + 5, '#6b4d8f', 10, 80);
    else if (e.type === 'death') burst(e.x + PW / 2, e.y + PH / 2, '#ffd27a', 16, 110);
    else if (e.type === 'checkpoint') {
      const cp = world.level.checkpoints[e.index];
      burst(cp.x + T / 2, cp.y - 6, '#ffcf6b', 12, 50);
    } else if (e.type === 'win') burst(world.level.goal.base.x + T / 2, world.level.goal.base.y - 26, '#ffb347', 24, 90);
    else if (e.type === 'land') view.squash = 1;
  }
}

const roundRect = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h);
};

function drawBackground(ctx, width, height, theme, camX, view, viewH) {
  const g = ctx.createLinearGradient(0, 0, 0, viewH);
  g.addColorStop(0, theme.sky[0]);
  g.addColorStop(0.6, theme.sky[1]);
  g.addColorStop(1, theme.sky[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
  if (theme.stars) {
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < 70; i += 1) {
      const x = (((i * 137.5 - camX * 0.05) % width) + width) % width;
      const y = (i * 53.3) % (viewH * 0.7);
      const tw = 0.5 + 0.5 * Math.sin(view.time * 2 + i);
      ctx.globalAlpha = 0.3 + tw * 0.6;
      ctx.fillRect(x, y, i % 5 === 0 ? 2 : 1, i % 5 === 0 ? 2 : 1);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fff6d8';
    ctx.beginPath();
    ctx.arc(width * 0.8, viewH * 0.18, 18, 0, Math.PI * 2);
    ctx.fill();
  }
  // Dos capas de siluetas (colinas, árboles, rocas o nubes) que se mueven más despacio que el nivel.
  const layer = (color, factor, base, amp, wave, alpha) => {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, viewH);
    for (let x = 0; x <= width + 20; x += 20) {
      const wx = x + camX * factor;
      const y = viewH * base - amp * (Math.sin(wx / wave) * 0.6 + Math.sin(wx / (wave * 0.37)) * 0.4);
      ctx.lineTo(x, theme.cloudy ? y + Math.abs(Math.sin(wx / 31)) * 10 : y);
    }
    ctx.lineTo(width, viewH);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  };
  layer(theme.far, 0.15, 0.62, 40, 160, theme.cloudy ? 0.5 : 1);
  layer(theme.near, 0.35, 0.78, 30, 90, theme.cloudy ? 0.7 : 1);
}

function drawTiles(ctx, level, theme, c0, c1, r0, r1, time) {
  const tops = [];
  for (let r = r0; r <= r1; r += 1) {
    for (let c = c0; c <= c1; c += 1) {
      const x = c * T;
      const y = r * T;
      if (c < 0 || c >= level.cols) {
        // Fuera del nivel (margen de cámara en móvil): pared lisa.
        ctx.fillStyle = theme.edge;
        ctx.fillRect(x, y, T + 0.5, T + 0.5);
        continue;
      }
      const ch = tileAt(level, c, r);
      if (ch === '#') {
        // +0,5: sin rendijas entre casillas al escalar a tamaños fraccionarios.
        ctx.fillStyle = theme.body;
        ctx.fillRect(x, y, T + 0.5, T + 0.5);
        if (r > 0 && !isSolidChar(tileAt(level, c, r - 1))) tops.push([c, r]);
        else if ((c * 7 + r * 13) % 5 === 0) {
          ctx.fillStyle = theme.edge;
          ctx.fillRect(x + 4, y + 6, 3, 2);
          ctx.fillRect(x + 10, y + 11, 2, 2);
        }
        if (theme.crystals && !isSolidChar(tileAt(level, c, r + 1)) && r < level.rows - 1 && (c * 11) % 4 === 0) {
          // Cristales colgando del techo de la cueva.
          ctx.fillStyle = `rgba(150, 220, 255, ${0.55 + 0.25 * Math.sin(time * 2 + c)})`;
          ctx.beginPath();
          ctx.moveTo(x + 4, y + T);
          ctx.lineTo(x + 7, y + T + 7);
          ctx.lineTo(x + 10, y + T);
          ctx.fill();
        }
      } else if (ch === '=') {
        ctx.fillStyle = theme.block;
        roundRect(ctx, x + 0.5, y + 0.5, T - 1, T - 1, 3);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(x + 2, y + 2, T - 4, 2);
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.fillRect(x + 2, y + T - 3, T - 4, 2);
      } else if (ch === '-') {
        ctx.fillStyle = theme.plank;
        roundRect(ctx, x, y, T, 5, 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(x, y + 4, T, 1);
      } else if (ch === '^') {
        // Zarzas con espinas (claras sobre fondo oscuro para que se distingan bien).
        ctx.fillStyle = '#e9e2f5';
        ctx.strokeStyle = '#3a2440';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < 3; i += 1) {
          ctx.moveTo(x + 1 + i * 5, y + T);
          ctx.lineTo(x + 3.5 + i * 5, y + T * 0.42);
          ctx.lineTo(x + 6 + i * 5, y + T);
        }
        ctx.fill();
        ctx.stroke();
      }
    }
  }
  // Segunda pasada: el borde de hierba/musgo/nube, encima de todos los cuerpos (sin rendijas).
  for (const [c, r] of tops) {
    const x = c * T;
    const y = r * T;
    // Borde superior continuo, redondeado solo en los extremos de cada tramo.
    const open = (dc) => !isSolidChar(tileAt(level, c + dc, r)) || isSolidChar(tileAt(level, c + dc, r - 1));
    const left = c > 0 && open(-1) ? 3 : 0;
    const right = c < level.cols - 1 && open(1) ? 3 : 0;
    ctx.fillStyle = theme.top;
    ctx.beginPath();
    const w = right ? T : T + 0.5;
    if (ctx.roundRect) ctx.roundRect(x, y - 1, w, 6, [left, right, right, left]);
    else ctx.rect(x, y - 1, w, 6);
    ctx.fill();
    ctx.fillStyle = theme.edge;
    ctx.fillRect(x, y + 5, T, 1);
  }
}

function drawLumi(ctx, p, view, world, reduced) {
  if (world.respawn > 0 && world.status === 'playing') return;
  if (p.invulnerable > 0 && Math.floor(view.time * 12) % 2 === 0) ctx.globalAlpha = 0.45;
  const cx = p.x + PW / 2;
  const cy = p.y + PH / 2 + 1;
  // Estiramiento al saltar y aplastamiento al aterrizar.
  const stretch = reduced ? 0 : Math.max(-0.18, Math.min(0.2, -p.vy / 1800));
  const squash = reduced ? 0 : view.squash * 0.25;
  const sx = 1 - stretch * 0.6 + squash;
  const sy = 1 + stretch - squash;
  const glow = ctx.createRadialGradient(cx, cy, 2, cx, cy, 22);
  glow.addColorStop(0, 'rgba(255, 214, 120, 0.55)');
  glow.addColorStop(1, 'rgba(255, 180, 80, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(cx - 22, cy - 22, 44, 44);
  ctx.save();
  ctx.translate(cx, cy + 7 * (1 - sy));
  ctx.scale(sx, sy);
  // Llamita de la cabeza.
  const flick = reduced ? 0 : Math.sin(view.time * 18) * 0.8;
  ctx.fillStyle = '#ffb347';
  ctx.beginPath();
  ctx.moveTo(-3, -6);
  ctx.quadraticCurveTo(-p.facing * 2 + flick, -15, 1 - p.facing * 3, -13 + flick);
  ctx.quadraticCurveTo(2, -9, 3, -6);
  ctx.fill();
  const body = ctx.createRadialGradient(-2, -3, 1, 0, 0, 8);
  body.addColorStop(0, '#fff8d6');
  body.addColorStop(0.6, '#ffd36b');
  body.addColorStop(1, '#ff9f43');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, 0, 7, 7.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Ojos que miran hacia donde va.
  ctx.fillStyle = '#3a2440';
  const blink = Math.floor(view.time * 10) % 37 === 0;
  ctx.fillRect(p.facing * 1.5 - 3, -1.5, 1.6, blink ? 0.6 : 3);
  ctx.fillRect(p.facing * 1.5 + 1.4, -1.5, 1.6, blink ? 0.6 : 3);
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawEnemy(ctx, e, time, reduced) {
  if (!e.alive) return;
  if (e.type === 'blob') {
    const wob = reduced ? 0 : Math.sin(time * 8 + e.x0) * 1.2;
    ctx.fillStyle = '#3b2453';
    ctx.beginPath();
    ctx.moveTo(e.x, e.y + e.h);
    ctx.quadraticCurveTo(e.x - 1, e.y - wob, e.x + e.w / 2, e.y - 1 - wob);
    ctx.quadraticCurveTo(e.x + e.w + 1, e.y - wob, e.x + e.w, e.y + e.h);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ff8fa3';
    const look = e.vx > 0 ? 1.5 : -1.5;
    ctx.fillRect(e.x + 3 + look, e.y + 3, 2, 2);
    ctx.fillRect(e.x + 7 + look, e.y + 3, 2, 2);
    return;
  }
  // Polilla: cuerpo y alas que aletean.
  const flap = reduced ? 0.6 : Math.abs(Math.sin(time * 14 + e.phase));
  ctx.fillStyle = '#c9b4e8';
  ctx.beginPath();
  ctx.ellipse(e.x + e.w / 2 - 4, e.y + 4, 4, 2 + flap * 3, -0.5, 0, Math.PI * 2);
  ctx.ellipse(e.x + e.w / 2 + 4, e.y + 4, 4, 2 + flap * 3, 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#5b4378';
  ctx.beginPath();
  ctx.ellipse(e.x + e.w / 2, e.y + 6, 2.5, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawProps(ctx, world, view, reduced) {
  const { level } = world;
  const t = view.time;
  // Chispas (monedas).
  level.coins.forEach((c, i) => {
    if (world.coins[i]) return;
    const bob = reduced ? 0 : Math.sin(t * 3 + i) * 1.5;
    const g = ctx.createRadialGradient(c.x, c.y + bob, 0, c.x, c.y + bob, 9);
    g.addColorStop(0, 'rgba(255, 236, 150, 0.9)');
    g.addColorStop(1, 'rgba(255, 210, 90, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(c.x - 9, c.y - 9 + bob, 18, 18);
    ctx.fillStyle = '#fff3b0';
    ctx.beginPath();
    for (let k = 0; k < 8; k += 1) {
      const a = (k / 8) * Math.PI * 2 + (reduced ? 0 : t);
      const r = k % 2 ? 2 : 5;
      ctx.lineTo(c.x + Math.cos(a) * r, c.y + bob + Math.sin(a) * r);
    }
    ctx.fill();
  });
  // Faroles (puntos de control).
  level.checkpoints.forEach((cp, i) => {
    const lit = i <= world.checkpoint;
    ctx.fillStyle = '#4a3b55';
    ctx.fillRect(cp.x + 7, cp.y - 6, 2, T + 6);
    if (lit) {
      const g = ctx.createRadialGradient(cp.x + 8, cp.y - 9, 1, cp.x + 8, cp.y - 9, 22);
      g.addColorStop(0, 'rgba(255, 200, 100, 0.6)');
      g.addColorStop(1, 'rgba(255, 200, 100, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(cp.x - 14, cp.y - 31, 44, 44);
    }
    ctx.fillStyle = lit ? '#ffd27a' : '#8b8597';
    roundRect(ctx, cp.x + 4, cp.y - 14, 8, 9, 2);
    ctx.fill();
    ctx.strokeStyle = '#2e2238';
    ctx.lineWidth = 1;
    ctx.stroke();
  });
  // Muelles.
  for (const s of level.springs) {
    ctx.strokeStyle = '#b8c0d8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let k = 0; k < 4; k += 1) {
      ctx.moveTo(s.x + 1, s.y + 2 + k);
      ctx.lineTo(s.x + s.w - 1, s.y + 3 + k);
    }
    ctx.stroke();
    ctx.fillStyle = '#ff7a8a';
    roundRect(ctx, s.x - 1, s.y - 1, s.w + 2, 3, 1.5);
    ctx.fill();
  }
  // Plataformas móviles.
  for (const m of world.movers) {
    ctx.fillStyle = '#f2e6c9';
    roundRect(ctx, m.x, m.y, m.w, m.h, 3);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(m.x + 2, m.y + m.h - 2, m.w - 4, 2);
    ctx.fillStyle = '#c6a76c';
    for (let k = 1; k < 3; k += 1) ctx.fillRect(m.x + k * T - 0.5, m.y + 1, 1, m.h - 2);
  }
  // Vela final: se enciende al llegar.
  const { base } = level.goal;
  const lit = world.status === 'won';
  ctx.fillStyle = '#f6ecd9';
  roundRect(ctx, base.x + 3, base.y - 18, 10, 34, 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(base.x + 10, base.y - 18, 3, 34);
  ctx.fillStyle = '#3a2a2a';
  ctx.fillRect(base.x + 7.5, base.y - 22, 1, 4);
  if (lit) {
    const g = ctx.createRadialGradient(base.x + 8, base.y - 26, 1, base.x + 8, base.y - 26, 40);
    g.addColorStop(0, 'rgba(255, 190, 90, 0.8)');
    g.addColorStop(1, 'rgba(255, 190, 90, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(base.x - 32, base.y - 66, 80, 80);
    ctx.fillStyle = '#ffcf5a';
    ctx.beginPath();
    ctx.ellipse(base.x + 8, base.y - 27, 3, 6, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Una pequeña marca para que se vea la meta desde lejos.
    ctx.strokeStyle = 'rgba(255, 220, 150, 0.7)';
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.arc(base.x + 8, base.y - 27, 6 + (reduced ? 0 : Math.sin(t * 3)), 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

/**
 * Dibuja el mundo. `insetBottom` (px) reserva espacio abajo para los controles
 * táctiles en vertical: el nivel se apoya encima de ellos.
 */
export function renderLumi(ctx, size, world, view, dt = 0, { reduced = false, insetBottom = 0, insetX = 0 } = {}) {
  if (!ctx || !size.width) return;
  const { width, height } = size;
  const { level } = world;
  const theme = THEMES[level.theme] ?? THEMES.pradera;
  view.time += dt;
  view.squash = Math.max(0, view.squash - dt * 6);

  const viewH = Math.max(120, height - insetBottom);
  const scale = Math.max(1, Math.min(viewH / (14 * T), width / (12 * T)));
  const visW = width / scale;
  const visH = viewH / scale;
  const levelW = level.cols * T;
  const levelH = level.rows * T;
  const p = world.player;

  // Cámara: sigue a Lumi con algo de anticipación hacia donde mira, sin salirse del nivel.
  const targetX = p.x + PW / 2 - visW / 2 + p.facing * visW * 0.12;
  const targetY = p.y + PH / 2 - visH * 0.55;
  // `insetX` (px de pantalla): margen a los lados para que los controles de las
  // esquinas no tapen a Lumi al principio o al final del nivel.
  const margin = insetX / scale;
  const clampX = (x) => (levelW <= visW ? (levelW - visW) / 2 : Math.max(-margin, Math.min(levelW - visW + margin, x)));
  const clampY = (y) => (levelH <= visH ? levelH - visH : Math.max(0, Math.min(levelH - visH, y)));
  if (view.camX === null || world.respawn > 0) {
    view.camX = clampX(targetX);
    view.camY = clampY(targetY);
  } else {
    const k = reduced ? 1 : Math.min(1, dt * 5);
    view.camX = clampX(view.camX + (targetX - view.camX) * k);
    view.camY = clampY(view.camY + (targetY - view.camY) * Math.min(1, dt * 4));
  }
  const camX = view.camX;
  const camY = view.camY;

  drawBackground(ctx, width, height, theme, camX * scale, view, viewH);
  ctx.save();
  ctx.scale(scale, scale);
  ctx.translate(-Math.round(camX * scale) / scale, -Math.round(camY * scale) / scale);
  const c0 = Math.floor(camX / T) - 1;
  const c1 = Math.ceil((camX + visW) / T) + 1;
  const r0 = Math.max(0, Math.floor(camY / T) - 1);
  const r1 = Math.min(level.rows - 1, Math.ceil((camY + visH) / T) + 1);
  drawTiles(ctx, level, theme, c0, c1, r0, r1, view.time);
  drawProps(ctx, world, view, reduced);
  for (const e of world.enemies) drawEnemy(ctx, e, view.time, reduced);
  drawLumi(ctx, p, view, world, reduced);

  // Partículas.
  view.particles = view.particles.filter((q) => (q.life -= dt) > 0);
  for (const q of view.particles) {
    q.x += q.vx * dt;
    q.y += q.vy * dt;
    q.vy += 200 * dt;
    ctx.globalAlpha = Math.min(1, q.life * 2);
    ctx.fillStyle = q.color;
    ctx.fillRect(q.x - 1, q.y - 1, 2.5, 2.5);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // Bajo el nivel (zona de los controles táctiles en vertical): tierra oscura.
  const bottom = (levelH - camY) * scale;
  if (bottom < height) {
    ctx.fillStyle = theme.edge;
    ctx.fillRect(0, bottom, width, height - bottom);
  }
}
