/**
 * Arte compartido de la Arena .io — «microcosmos bioluminiscente».
 *
 * Las tres modalidades ocurren en la misma placa de cultivo vista al
 * microscopio: fondo profundo con motas en suspensión (dos capas con paralaje),
 * esporas que brillan, células con membrana que ondula, núcleo, orgánulos y
 * ojos que miran hacia donde se mueven, y drones mecánicos como avispas.
 *
 * Coste por fotograma acotado: fondo y esporas son sprites/patrones en caché,
 * las células visibles son pocas (≤ 9) y nada usa `shadowBlur`.
 */
import { createSpriteCache } from '../../../render/sprites.js';
import { createParticles } from '../../../render/particles.js';
import { createQualityMonitor } from '../../../render/quality.js';
import { glow, seeded } from '../../../render/paint.js';

/** Estado de dibujo de una partida (se guarda en `view`). */
export function ensureArt(view) {
  if (!view.art) {
    view.art = {
      sprites: createSpriteCache(80),
      particles: createParticles(140),
      quality: createQualityMonitor(),
      track: new Map(), // id → { x, y, dx, dy, mass }
    };
  }
  return view.art;
}

export function disposeArt(view) {
  view.art?.sprites.clear();
  view.art?.particles.clear();
}

const TILE = 256;

function paintDeepTile(ctx, w, h, seed, dense) {
  const rand = seeded(seed);
  ctx.clearRect(0, 0, w, h);
  // Motas en suspensión (repetidas en los bordes para teselar sin costuras).
  const count = dense ? 46 : 14;
  for (let i = 0; i < count; i += 1) {
    const x = rand() * w;
    const y = rand() * h;
    const r = dense ? 0.5 + rand() * 1 : 2 + rand() * 5;
    // Motas tenues y azuladas: nunca se confunden con las esporas comestibles.
    const a = dense ? 0.06 + rand() * 0.12 : 0.04 + rand() * 0.06;
    const hue = 200 + rand() * 50;
    for (const ox of [-w, 0, w]) {
      for (const oy of [-h, 0, h]) {
        const px = x + ox;
        const py = y + oy;
        if (px + r * 3 < 0 || px - r * 3 > w || py + r * 3 < 0 || py - r * 3 > h) continue;
        const g = ctx.createRadialGradient(px, py, 0, px, py, r * 3);
        g.addColorStop(0, `hsl(${hue} 90% 75% / ${a})`);
        g.addColorStop(1, `hsl(${hue} 90% 60% / 0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(px, py, r * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

/**
 * Fondo de la placa: degradado profundo + dos capas de motas con paralaje.
 * `camX/camY` en píxeles de pantalla (desplazamiento de la cámara).
 */
export function drawDeepBackground(ctx, art, W, H, camX = 0, camY = 0, time = 0) {
  const base = ctx.createRadialGradient(W / 2, H * 0.45, 0, W / 2, H * 0.45, Math.max(W, H) * 0.8);
  base.addColorStop(0, '#13234a');
  base.addColorStop(0.55, '#0c1433');
  base.addColorStop(1, '#070a1e');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);
  const layers = [
    ['far', 0.35, false],
    ['near', 1, true],
  ];
  for (const [key, parallax, dense] of layers) {
    const tile = art.sprites.get(`deep-${key}`, TILE, TILE, (c, w, h) => paintDeepTile(c, w, h, dense ? 7 : 3, dense), 1);
    const pattern = tile && ctx.createPattern(tile.canvas, 'repeat');
    if (!pattern) continue;
    const drift = dense ? 0 : time * 4;
    const ox = (((-camX * parallax + drift) % TILE) + TILE) % TILE;
    const oy = (((-camY * parallax + drift * 0.6) % TILE) + TILE) % TILE;
    ctx.save();
    ctx.translate(ox - TILE, oy - TILE);
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, W + TILE * 2, H + TILE * 2);
    ctx.restore();
  }
}

/** Viñeta suave en caché. */
export function drawVignette(ctx, art, W, H, strength = 0.55) {
  const sprite = art.sprites.get(
    `vig${strength}`,
    W,
    H,
    (c, w, h) => {
      const g = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, `rgba(2,4,14,${strength})`);
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
    },
    1,
  );
  ctx.drawImage(sprite.canvas, 0, 0, W, H);
}

/** Espora luminosa (partícula comestible). */
function paintSpore(ctx, w, h, hue) {
  const c = w / 2;
  const halo = ctx.createRadialGradient(c, c, 0, c, c, c);
  halo.addColorStop(0, `hsl(${hue} 100% 75% / 0.55)`);
  halo.addColorStop(0.4, `hsl(${hue} 100% 60% / 0.18)`);
  halo.addColorStop(1, `hsl(${hue} 100% 60% / 0)`);
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, w, h);
  const r = w * 0.17;
  const body = ctx.createRadialGradient(c - r * 0.4, c - r * 0.4, 0, c, c, r);
  body.addColorStop(0, '#ffffff');
  body.addColorStop(0.45, `hsl(${hue} 100% 78%)`);
  body.addColorStop(1, `hsl(${hue} 90% 50%)`);
  ctx.fillStyle = body;
  ctx.beginPath();
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2;
    const rr = i % 2 ? r * 0.82 : r;
    ctx.lineTo(c + Math.cos(a) * rr, c + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

export function drawSpore(ctx, art, x, y, size, hue, dpr, pulse = 1) {
  const bucket = Math.round(hue / 20) * 20;
  const s = Math.max(12, Math.round(size));
  const sprite = art.sprites.get(`spore${bucket}`, s, s, (c, w, h) => paintSpore(c, w, h, bucket), dpr);
  const d = s * pulse;
  ctx.drawImage(sprite.canvas, x - d / 2, y - d / 2, d, d);
}

/** Dirección suavizada de una entidad a partir de su movimiento (para los ojos). */
export function trackMotion(art, id, x, y, dt) {
  const prev = art.track.get(id);
  if (!prev) {
    const t = { x, y, dx: 0, dy: 1, speed: 0 };
    art.track.set(id, t);
    return t;
  }
  const vx = x - prev.x;
  const vy = y - prev.y;
  const len = Math.hypot(vx, vy);
  if (len > 0.01 && dt > 0) {
    const k = Math.min(1, dt * 8);
    prev.dx += (vx / len - prev.dx) * k;
    prev.dy += (vy / len - prev.dy) * k;
    prev.speed = len / dt;
  } else if (dt > 0) {
    prev.speed *= 0.9;
  }
  prev.x = x;
  prev.y = y;
  return prev;
}

/**
 * Célula viva: membrana ondulante, citoplasma translúcido, núcleo y orgánulos,
 * ojos que miran hacia donde avanza. `seed` fija la disposición de orgánulos.
 */
export function drawCell(ctx, x, y, r, hue, { time = 0, seed = 1, dir = { dx: 0, dy: 1 }, eyes = true, calm = false, sat = 85 } = {}) {
  const points = r > 40 ? 32 : 22;
  const wobble = calm ? 0 : Math.min(0.045, 1.6 / Math.max(8, r));
  // Halo exterior.
  glow(ctx, x, y, r * 1.45, `hsl(${hue} 100% 60% / 0.28)`);
  // Membrana.
  ctx.beginPath();
  for (let i = 0; i <= points; i += 1) {
    const a = (i / points) * Math.PI * 2;
    const k = 1 + wobble * Math.sin(a * 3 + time * 2.2 + seed) + wobble * 0.6 * Math.sin(a * 5 - time * 1.7 + seed * 2);
    const px = x + Math.cos(a) * r * k;
    const py = y + Math.sin(a) * r * k;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  const body = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.05, x, y, r);
  body.addColorStop(0, `hsl(${hue} ${sat}% 88%)`);
  body.addColorStop(0.5, `hsl(${hue} ${sat}% 62%)`);
  body.addColorStop(0.88, `hsl(${hue} ${sat}% 46%)`);
  body.addColorStop(1, `hsl(${hue} ${sat}% 70%)`);
  ctx.fillStyle = body;
  ctx.fill();
  ctx.strokeStyle = `hsl(${hue} 100% 86% / 0.9)`;
  ctx.lineWidth = Math.max(1.5, r * 0.07);
  ctx.stroke();
  if (r < 7) return;
  // Orgánulos (giran despacio).
  const rand = seeded(seed * 31 + 7);
  const n = r > 30 ? 5 : 3;
  for (let i = 0; i < n; i += 1) {
    const a = rand() * Math.PI * 2 + time * (0.2 + rand() * 0.3);
    const d = r * (0.35 + rand() * 0.35);
    ctx.fillStyle = `hsl(${(hue + 40) % 360} 90% 82% / 0.55)`;
    ctx.beginPath();
    ctx.ellipse(x + Math.cos(a) * d, y + Math.sin(a) * d, r * (0.06 + rand() * 0.06), r * 0.05, a, 0, Math.PI * 2);
    ctx.fill();
  }
  // Núcleo, desplazado hacia atrás del movimiento.
  const nx = x - dir.dx * r * 0.22;
  const ny = y - dir.dy * r * 0.22 + r * 0.18;
  ctx.fillStyle = `hsl(${hue} 70% 32% / 0.45)`;
  ctx.beginPath();
  ctx.arc(nx, ny, r * 0.26, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `hsl(${hue} 80% 85% / 0.35)`;
  ctx.beginPath();
  ctx.arc(nx - r * 0.07, ny - r * 0.07, r * 0.09, 0, Math.PI * 2);
  ctx.fill();
  // Brillo especular.
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.42, y - r * 0.5, r * 0.18, r * 0.09, -0.6, 0, Math.PI * 2);
  ctx.fill();
  if (!eyes || r < 10) return;
  // Ojos.
  const ex = dir.dx * r * 0.28;
  const ey = dir.dy * r * 0.28 - r * 0.12;
  const px = -dir.dy;
  const py = dir.dx;
  const blink = calm ? 1 : Math.abs(Math.sin(time * 0.9 + seed)) > 0.985 ? 0.15 : 1;
  for (const side of [-1, 1]) {
    const cx = x + ex + px * side * r * 0.22;
    const cy = y + ey + py * side * r * 0.22;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * 0.16, r * 0.19 * blink, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#10162e';
    ctx.beginPath();
    ctx.ellipse(cx + dir.dx * r * 0.05, cy + dir.dy * r * 0.05, r * 0.09, r * 0.1 * blink, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Dron avispa: cuerpo segmentado, alas en movimiento y ojo rojo. Mira a +x. */
function paintDrone(ctx, W, H) {
  const cx = W * 0.45;
  const cy = H / 2;
  const r = H * 0.28;
  // Cuerpo trasero (aguijón).
  const tail = ctx.createLinearGradient(0, cy - r, 0, cy + r);
  tail.addColorStop(0, '#ff9be9');
  tail.addColorStop(1, '#a3157e');
  ctx.fillStyle = tail;
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.3, cy - r * 0.55);
  ctx.quadraticCurveTo(cx - r * 1.6, cy, cx - r * 0.3, cy + r * 0.55);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(40,0,30,0.5)';
  ctx.lineWidth = Math.max(1, r * 0.08);
  for (const k of [0.55, 0.95]) {
    ctx.beginPath();
    ctx.moveTo(cx - r * k, cy - r * (0.5 - k * 0.25));
    ctx.lineTo(cx - r * k, cy + r * (0.5 - k * 0.25));
    ctx.stroke();
  }
  // Tórax.
  const body = ctx.createRadialGradient(cx, cy - r * 0.3, r * 0.1, cx, cy, r * 0.8);
  body.addColorStop(0, '#ffe1f8');
  body.addColorStop(0.5, '#ff4fd8');
  body.addColorStop(1, '#8a0f6a');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(cx + r * 0.2, cy, r * 0.75, r * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Ojo sensor.
  const eye = ctx.createRadialGradient(cx + r * 0.65, cy, 0, cx + r * 0.65, cy, r * 0.3);
  eye.addColorStop(0, '#ffffff');
  eye.addColorStop(0.4, '#ff6b6b');
  eye.addColorStop(1, '#600');
  ctx.fillStyle = eye;
  ctx.beginPath();
  ctx.arc(cx + r * 0.65, cy, r * 0.26, 0, Math.PI * 2);
  ctx.fill();
}

export function drawDrone(ctx, art, x, y, r, heading, time, dpr) {
  // El cuerpo del sprite (0,28·H) coincide con el radio de choque del motor.
  const W = r * 5;
  const H = r * 3.4;
  const sprite = art.sprites.get('drone', W, H, paintDrone, dpr);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading);
  // Estela.
  const trail = ctx.createLinearGradient(-r * 3.2, 0, -r * 0.6, 0);
  trail.addColorStop(0, 'rgba(255,79,216,0)');
  trail.addColorStop(1, 'rgba(255,79,216,0.45)');
  ctx.fillStyle = trail;
  ctx.beginPath();
  ctx.moveTo(-r * 0.6, -r * 0.35);
  ctx.lineTo(-r * 3.2, 0);
  ctx.lineTo(-r * 0.6, r * 0.35);
  ctx.closePath();
  ctx.fill();
  // Alas translúcidas que vibran.
  const flap = 0.75 + Math.sin(time * 60 + x) * 0.25;
  ctx.fillStyle = 'rgba(220,240,255,0.35)';
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 1;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(-r * 0.1, side * r * 0.75 * flap, r * 0.75, r * 0.32 * flap, side * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.drawImage(sprite.canvas, -W * 0.45, -H / 2, W, H);
  ctx.restore();
}

/** Estallido de partículas (absorciones, explosiones, recogidas). */
export function burst(art, x, y, hue, scale = 1, count = 14, reduced = false) {
  if (reduced) return;
  const n = art.quality.quality === 'low' ? Math.ceil(count / 2) : count;
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
    const sp = (40 + Math.random() * 120) * scale;
    art.particles.emit({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 3, decay: 1.4 + Math.random(), size: (2 + Math.random() * 3) * scale, color: `hsl(${hue} 100% ${65 + Math.random() * 20}%)` });
  }
}

export function drawParticles(ctx, art, dt) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  art.particles.update(dt, (p) => {
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(0.8, p.size * (0.4 + p.life * 0.6)), 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
}

/** Tono HSL aproximado a partir de un color #rrggbb (para teñir células con los colores del motor). */
export function hueOf(hex) {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex ?? '');
  if (!m) return 190;
  const [r, g, b] = [m[1], m[2], m[3]].map((v) => parseInt(v, 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const d = max - min;
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return Math.round(((h * 60) + 360) % 360);
}
