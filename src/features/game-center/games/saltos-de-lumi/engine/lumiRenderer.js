/**
 * Dibujo de «Saltos de Lumi» en Canvas 2D (solo lee el mundo; no lo cambia).
 *
 * Lumi es una chispa de luz: recoge chispas, enciende faroles y llega hasta una
 * vela que se enciende al tocarla. Cada nivel tiene su ambiente (atardecer en la
 * pradera, bosque, cueva, nubes, noche).
 *
 * Dirección artística: cuento ilustrado de noche cálida. El fondo son dos capas
 * de siluetas con paralaje propias de cada ambiente (colinas con árboles, pinos,
 * estalactitas, nubes, tejados con ventanas encendidas) y luciérnagas en el
 * aire. El terreno se pinta con textura (piedras, raíces, cristales o algodón de
 * nube) y un borde de hierba, musgo o escarcha con briznas; los bloques son
 * sillares tallados, las pasarelas tablas con clavos y las zarzas tallos
 * espinosos claros (se distinguen bien sobre fondo oscuro).
 *
 * Las losetas se pintan una vez por ambiente en sprites (render/sprites.js) a
 * resolución fija y se copian escaladas. La geometría de colisión es la del
 * motor: cada losa ocupa exactamente su casilla.
 */
import { PH, PW, T, isSolidChar, tileAt } from './lumiEngine.js';
import { createSpriteCache } from '../../../render/sprites.js';
import { createParticles } from '../../../render/particles.js';
import { createQualityMonitor } from '../../../render/quality.js';
import { hash, seeded } from '../../../render/paint.js';

export const THEMES = Object.freeze({
  pradera: { sky: ['#2b2350', '#7a4a78', '#f0a27a'], far: '#5a3d6b', near: '#3e2f57', top: '#7fd39a', body: '#4a3552', edge: '#2e2238', block: '#d98f5c', plank: '#c8875a', stars: false, motes: '#ffd98a' },
  bosque: { sky: ['#0d2a2c', '#1d4a45', '#4f8a6e'], far: '#173c39', near: '#0f2c2a', top: '#8fd17a', body: '#2f3b2c', edge: '#1c2619', block: '#9a7b52', plank: '#a77d4f', stars: false, motes: '#d2ff8c' },
  cueva: { sky: ['#0d0b16', '#1a1528', '#2a2238'], far: '#211b30', near: '#171223', top: '#7b6fa3', body: '#2c2540', edge: '#1a1528', block: '#5d5280', plank: '#7a6a9a', stars: false, crystals: true, motes: '#9fe3ff' },
  nubes: { sky: ['#6d8fe0', '#a9b8f0', '#ffd6e8'], far: '#ffffff', near: '#f3e9ff', top: '#ffffff', body: '#dfe3fb', edge: '#b9c1ea', block: '#ffc9a8', plank: '#e7b0d6', stars: false, cloudy: true, motes: '#ffffff' },
  noche: { sky: ['#070a22', '#151a45', '#2d2a63'], far: '#1c1f4a', near: '#13153a', top: '#6c7bd6', body: '#1e2150', edge: '#11133a', block: '#4b4f9a', plank: '#6a5fb0', stars: true, motes: '#ffe7a3' },
});

const RES = 5; // píxeles de sprite por unidad del mundo

export function createRenderState() {
  return {
    camX: null,
    camY: null,
    particles: createParticles(120),
    sprites: createSpriteCache(90),
    quality: createQualityMonitor(),
    squash: 0,
    time: 0,
    seen: 0,
    trail: 0,
  };
}

export function disposeRenderState(view) {
  view.sprites?.clear();
  view.particles?.clear();
}

/** Añade efectos (partículas, sacudidas) según los eventos del motor. */
export function addEffects(view, events, world, reduced) {
  if (reduced) return;
  const low = view.quality?.quality === 'low';
  const burst = (x, y, color, n, speed = 70) => {
    const count = low ? Math.ceil(n / 2) : n;
    for (let i = 0; i < count; i += 1) {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      view.particles.emit({ x, y, vx: Math.cos(a) * speed * (0.5 + Math.random()), vy: Math.sin(a) * speed * (0.5 + Math.random()) - 20, decay: 1 / (0.5 + Math.random() * 0.3), gravity: 200, size: 2.5, color });
    }
  };
  for (const e of events) {
    if (e.type === 'coin') {
      const c = world.level.coins[e.index];
      burst(c.x, c.y, '#ffe27a', 10, 60);
    } else if (e.type === 'stomp') burst(e.x + 6, e.y + 5, '#8a68b8', 12, 80);
    else if (e.type === 'death') burst(e.x + PW / 2, e.y + PH / 2, '#ffd27a', 18, 110);
    else if (e.type === 'checkpoint') {
      const cp = world.level.checkpoints[e.index];
      burst(cp.x + T / 2, cp.y - 6, '#ffcf6b', 14, 50);
    } else if (e.type === 'win') burst(world.level.goal.base.x + T / 2, world.level.goal.base.y - 26, '#ffb347', 26, 90);
    else if (e.type === 'land') view.squash = 1;
  }
}

const roundRect = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
};

/** Mezcla dos colores hex (t = 0 → a, 1 → b). */
function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (s) => Math.round(((pa >> s) & 255) + (((pb >> s) & 255) - ((pa >> s) & 255)) * t);
  return `rgb(${ch(16)} ${ch(8)} ${ch(0)})`;
}

// ------------------------------------------------------------ fondo

/** Capa de siluetas teselable (ancho W px) propia de cada ambiente. */
function paintBackdrop(ctx, W, H, themeId, theme, near) {
  const rand = seeded(themeId.length * 17 + (near ? 5 : 1));
  const color = near ? theme.near : theme.far;
  const top = mix(color, theme.sky[2], near ? 0.12 : 0.28);
  const fill = ctx.createLinearGradient(0, 0, 0, H);
  fill.addColorStop(0, top);
  fill.addColorStop(1, color);
  ctx.fillStyle = fill;
  const base = H * (near ? 0.55 : 0.4);
  const amp = H * (near ? 0.11 : 0.16);
  const ridge = (x) => {
    const t = (x / W) * Math.PI * 2;
    return base - amp * (Math.sin(t * (near ? 3 : 2) + (near ? 1 : 0)) * 0.6 + Math.sin(t * (near ? 7 : 5)) * 0.4);
  };
  if (theme.cloudy) {
    // Nubes algodonosas en hilera.
    ctx.globalAlpha = near ? 0.75 : 0.5;
    for (let x = -40; x < W + 40; x += 34) {
      const y = ridge(x);
      ctx.beginPath();
      ctx.arc(x, y, 26 + rand() * 18, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillRect(0, base, W, H - base);
    ctx.globalAlpha = 1;
    return;
  }
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 8) ctx.lineTo(x, ridge(x));
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fill();
  if (themeId === 'pradera') {
    // Árboles redondos y un molino lejano.
    for (let i = 0; i < (near ? 5 : 8); i += 1) {
      const x = rand() * W;
      const y = ridge(x);
      const r = near ? 10 + rand() * 8 : 6 + rand() * 5;
      ctx.fillRect(x - 1.5, y - r, 3, r + 2);
      ctx.beginPath();
      ctx.arc(x, y - r * 1.2, r, 0, Math.PI * 2);
      ctx.fill();
    }
    if (!near) {
      const x = W * 0.7;
      const y = ridge(x);
      ctx.fillRect(x - 4, y - 34, 8, 34);
      ctx.save();
      ctx.translate(x, y - 34);
      for (let k = 0; k < 4; k += 1) {
        ctx.rotate(Math.PI / 2);
        ctx.fillRect(-1.5, 0, 3, 22);
      }
      ctx.restore();
    }
  } else if (themeId === 'bosque') {
    // Pinos de varios tamaños.
    for (let i = 0; i < (near ? 10 : 16); i += 1) {
      const x = rand() * W;
      const y = ridge(x) + 6;
      const h = near ? 40 + rand() * 40 : 26 + rand() * 26;
      ctx.beginPath();
      ctx.moveTo(x, y - h);
      for (let k = 1; k <= 3; k += 1) {
        ctx.lineTo(x + (h * 0.18 * k) / 1.5, y - h + (h * k) / 3);
        ctx.lineTo(x + (h * 0.08 * k) / 1.5, y - h + (h * k) / 3);
      }
      for (let k = 3; k >= 1; k -= 1) {
        ctx.lineTo(x - (h * 0.08 * k) / 1.5, y - h + (h * k) / 3);
        ctx.lineTo(x - (h * 0.18 * k) / 1.5, y - h + (h * k) / 3);
      }
      ctx.closePath();
      ctx.fill();
    }
  } else if (themeId === 'cueva') {
    // Estalactitas que cuelgan del techo y columnas.
    for (let i = 0; i < (near ? 12 : 18); i += 1) {
      const x = rand() * W;
      const len = H * (near ? 0.15 + rand() * 0.25 : 0.1 + rand() * 0.2);
      const w = 6 + rand() * (near ? 14 : 10);
      ctx.beginPath();
      ctx.moveTo(x - w, 0);
      ctx.lineTo(x + w, 0);
      ctx.lineTo(x, len);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillRect(0, 0, W, 6);
    if (near) {
      for (let i = 0; i < 6; i += 1) {
        const x = rand() * W;
        ctx.fillStyle = `rgba(150,220,255,${0.25 + rand() * 0.25})`;
        ctx.beginPath();
        ctx.moveTo(x, ridge(x) - 14);
        ctx.lineTo(x + 4, ridge(x));
        ctx.lineTo(x - 4, ridge(x));
        ctx.closePath();
        ctx.fill();
      }
    }
  } else if (themeId === 'noche') {
    // Tejados de un pueblo con ventanas encendidas.
    for (let x = 0; x < W; x += 22 + rand() * 30) {
      const y = ridge(x) + 4;
      const w = 18 + rand() * 18;
      const h = (near ? 18 : 12) + rand() * 14;
      ctx.fillStyle = color;
      ctx.fillRect(x, y - h, w, h + 40);
      ctx.beginPath();
      ctx.moveTo(x - 3, y - h);
      ctx.lineTo(x + w / 2, y - h - w * 0.45);
      ctx.lineTo(x + w + 3, y - h);
      ctx.closePath();
      ctx.fill();
      if (rand() < 0.7) {
        ctx.fillStyle = 'rgba(255,214,130,0.85)';
        ctx.fillRect(x + w * 0.3, y - h * 0.7, 4, 5);
        if (rand() < 0.5) ctx.fillRect(x + w * 0.62, y - h * 0.7, 4, 5);
      }
    }
  }
}

function drawBackground(ctx, width, height, theme, themeId, camX, view, viewH) {
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
    // Luna con halo.
    const moon = ctx.createRadialGradient(width * 0.8, viewH * 0.18, 10, width * 0.8, viewH * 0.18, 70);
    moon.addColorStop(0, 'rgba(255,246,216,0.35)');
    moon.addColorStop(1, 'rgba(255,246,216,0)');
    ctx.fillStyle = moon;
    ctx.fillRect(width * 0.8 - 70, viewH * 0.18 - 70, 140, 140);
    ctx.fillStyle = '#fff6d8';
    ctx.beginPath();
    ctx.arc(width * 0.8, viewH * 0.18, 18, 0, Math.PI * 2);
    ctx.fill();
  } else if (!theme.crystals) {
    // Sol bajo (atardecer) o resplandor difuso.
    const sx = width * 0.72;
    const sy = viewH * 0.55;
    const sun = ctx.createRadialGradient(sx, sy, 0, sx, sy, viewH * 0.45);
    sun.addColorStop(0, 'rgba(255,220,170,0.45)');
    sun.addColorStop(1, 'rgba(255,220,170,0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, width, viewH);
  }
  // Dos capas de siluetas con paralaje (sprites teselables).
  const stripW = 640;
  for (const [near, factor, top] of [
    [false, 0.15, 0.3],
    [true, 0.35, 0.48],
  ]) {
    const stripH = Math.round(viewH * (1 - top));
    const strip = view.sprites.get(`bg-${themeId}-${near}`, stripW, stripH, (c, w, h) => paintBackdrop(c, w, h, themeId, theme, near), 1);
    const shift = (((camX * factor) % stripW) + stripW) % stripW;
    for (let x = -shift; x < width; x += stripW) ctx.drawImage(strip.canvas, x, viewH * top, stripW, stripH);
    if (themeId === 'cueva') {
      // En la cueva las estalactitas cuelgan desde arriba.
      for (let x = -shift; x < width; x += stripW) ctx.drawImage(strip.canvas, x, 0, stripW, stripH * 0.5);
    }
  }
  if (viewH < height) {
    ctx.fillStyle = theme.near;
    ctx.fillRect(0, viewH, width, height - viewH);
  }
  // Luciérnagas o motas en el aire (no con movimiento reducido: quedan quietas).
  const motes = view.quality.quality === 'low' ? 10 : 22;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < motes; i += 1) {
    const t = view.reduced ? 0 : view.time;
    const x = (((hash(i, 1) * width * 1.5 - camX * (0.25 + hash(i, 2) * 0.3) + Math.sin(t * 0.6 + i) * 18) % width) + width) % width;
    const y = viewH * (0.15 + hash(i, 3) * 0.7) + Math.cos(t * 0.8 + i * 2) * 10;
    const a = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(t * 2.2 + i * 1.7));
    const r = 1.2 + hash(i, 4) * 1.6;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 4);
    glow.addColorStop(0, theme.motes);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = a;
    ctx.fillStyle = glow;
    ctx.fillRect(x - r * 4, y - r * 4, r * 8, r * 8);
  }
  ctx.restore();
}

// ------------------------------------------------------------ losetas

function paintBody(ctx, w, h, theme, themeId, variant) {
  const rand = seeded(variant * 31 + themeId.length);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, mix(theme.body, '#ffffff', 0.04));
  g.addColorStop(1, mix(theme.body, '#000000', 0.12));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  if (theme.cloudy) {
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.arc(rand() * w, rand() * h, 2 + rand() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }
  // Piedras incrustadas con luz arriba.
  for (let i = 0; i < 2 + variant; i += 1) {
    const x = 2 + rand() * (w - 4);
    const y = 2 + rand() * (h - 4);
    const r = 0.9 + rand() * 1.6;
    ctx.fillStyle = mix(theme.body, '#000000', 0.3);
    ctx.beginPath();
    ctx.ellipse(x + 0.3, y + 0.4, r * 1.2, r, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = mix(theme.body, '#ffffff', 0.18);
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.1, r * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  if (themeId === 'bosque' && variant === 1) {
    // Raíz que atraviesa la tierra.
    ctx.strokeStyle = 'rgba(120,90,50,0.6)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.3);
    ctx.quadraticCurveTo(w * 0.5, h * 0.7, w, h * 0.45);
    ctx.stroke();
  }
  if (theme.crystals && variant === 2) {
    ctx.fillStyle = 'rgba(150,220,255,0.7)';
    ctx.beginPath();
    ctx.moveTo(w * 0.5, h * 0.25);
    ctx.lineTo(w * 0.62, h * 0.6);
    ctx.lineTo(w * 0.38, h * 0.6);
    ctx.closePath();
    ctx.fill();
  }
}

/** Borde superior (hierba, musgo, escarcha o nube) con briznas. `l`/`r`: extremos redondeados. */
function paintCap(ctx, w, h, theme, themeId, l, r, variant) {
  // El sprite mide T×8: 3 unidades por encima de la losa y 5 dentro.
  const y0 = 3;
  const g = ctx.createLinearGradient(0, y0 - 1, 0, y0 + 5);
  g.addColorStop(0, mix(theme.top, '#ffffff', 0.25));
  g.addColorStop(1, mix(theme.top, '#000000', 0.25));
  ctx.fillStyle = g;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(0, y0 - 1, w, 6, [l ? 3 : 0, r ? 3 : 0, r ? 3 : 0, l ? 3 : 0]);
  else ctx.rect(0, y0 - 1, w, 6);
  ctx.fill();
  // Borde ondulado hacia abajo.
  ctx.beginPath();
  for (let x = 0; x <= w; x += 2) ctx.lineTo(x, y0 + 4.6 + Math.sin(x * 1.3) * 0.6);
  ctx.lineTo(w, y0 + 3);
  ctx.lineTo(0, y0 + 3);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = theme.edge;
  ctx.fillRect(0, y0 + 5, w, 0.8);
  if (theme.cloudy) {
    ctx.fillStyle = '#ffffff';
    for (let x = 2; x < w; x += 5) {
      ctx.beginPath();
      ctx.arc(x, y0, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }
  // Briznas.
  const rand = seeded(w * 3 + (l ? 1 : 0) + (r ? 2 : 0) + themeId.length + variant * 101);
  ctx.strokeStyle = mix(theme.top, '#ffffff', 0.35);
  ctx.lineWidth = 0.6;
  ctx.lineCap = 'round';
  for (let x = 1 + (l ? 2 : 0); x < w - (r ? 2 : 0); x += 1.6) {
    const hgt = 1 + rand() * 2.2;
    ctx.beginPath();
    ctx.moveTo(x, y0);
    ctx.lineTo(x + (rand() - 0.5) * 1.2, y0 - hgt);
    ctx.stroke();
  }
  if (themeId === 'pradera' && variant === 0) {
    ctx.fillStyle = rand() < 0.5 ? '#ffd166' : '#ff8fab';
    ctx.beginPath();
    ctx.arc(w * (0.3 + rand() * 0.4), y0 - 2, 1, 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintBlock(ctx, w, h, theme) {
  // Sillar tallado: bisel claro arriba-izquierda, sombra abajo-derecha y grieta.
  ctx.fillStyle = mix(theme.block, '#000000', 0.25);
  roundRect(ctx, 0.5, 0.5, w - 1, h - 1, 2.5);
  ctx.fill();
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, mix(theme.block, '#ffffff', 0.25));
  g.addColorStop(1, theme.block);
  ctx.fillStyle = g;
  roundRect(ctx, 1.5, 1.5, w - 3, h - 3.5, 2);
  ctx.fill();
  ctx.strokeStyle = mix(theme.block, '#000000', 0.35);
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(w * 0.62, 2);
  ctx.lineTo(w * 0.55, h * 0.4);
  ctx.lineTo(w * 0.66, h * 0.55);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(2.5, 2.2, w * 0.4, 0.8);
}

function paintPlank(ctx, w, h, theme) {
  const g = ctx.createLinearGradient(0, 0, 0, 5);
  g.addColorStop(0, mix(theme.plank, '#ffffff', 0.25));
  g.addColorStop(1, mix(theme.plank, '#000000', 0.2));
  ctx.fillStyle = g;
  roundRect(ctx, 0, 0, w, 5, 1.5);
  ctx.fill();
  ctx.strokeStyle = 'rgba(60,30,10,0.35)';
  ctx.lineWidth = 0.4;
  ctx.beginPath();
  ctx.moveTo(1, 1.8);
  ctx.lineTo(w - 3, 2.1);
  ctx.moveTo(3, 3.4);
  ctx.lineTo(w - 1, 3.2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, 4.4, w, 0.6);
  ctx.fillStyle = '#d9d2c4';
  for (const x of [2, w - 2]) {
    ctx.beginPath();
    ctx.arc(x, 2.5, 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
  // Cuerdas que la sujetan.
  ctx.strokeStyle = 'rgba(230,210,170,0.55)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(w * 0.5, 5);
  ctx.lineTo(w * 0.5, h);
  ctx.stroke();
}

function paintThorns(ctx, w, h) {
  // Zarza: tallos curvos oscuros con espinas claras (se leen sobre fondo oscuro).
  ctx.lineCap = 'round';
  for (const [x0, lean] of [
    [3, -1],
    [8, 0.5],
    [13, 1],
  ]) {
    ctx.strokeStyle = '#3a2440';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x0, h);
    ctx.quadraticCurveTo(x0 + lean * 2, h * 0.7, x0 + lean, h * 0.38);
    ctx.stroke();
    ctx.fillStyle = '#efe7fb';
    for (const k of [0.85, 0.65, 0.48]) {
      const px = x0 + lean * (1 - k) * 1.6;
      const py = h * k;
      ctx.beginPath();
      ctx.moveTo(px - 0.6, py);
      ctx.lineTo(px - 2.6, py - 1.4);
      ctx.lineTo(px - 0.4, py - 1);
      ctx.moveTo(px + 0.6, py - 0.5);
      ctx.lineTo(px + 2.6, py - 2);
      ctx.lineTo(px + 0.4, py - 1.6);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(x0 + lean - 1.2, h * 0.42);
    ctx.lineTo(x0 + lean, h * 0.3);
    ctx.lineTo(x0 + lean + 1.2, h * 0.42);
    ctx.fill();
  }
}

function drawTiles(ctx, level, theme, themeId, view, c0, c1, r0, r1, time) {
  const sprites = view.sprites;
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
        const variant = Math.floor(hash(c, r) * 3);
        const body = sprites.get(`body-${themeId}-${variant}`, T, T, (s, w, h) => paintBody(s, w, h, theme, themeId, variant), RES);
        // +0,5: sin rendijas entre casillas al escalar a tamaños fraccionarios.
        ctx.drawImage(body.canvas, x, y, T + 0.5, T + 0.5);
        if (r > 0 && !isSolidChar(tileAt(level, c, r - 1))) tops.push([c, r]);
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
        const block = sprites.get(`block-${themeId}`, T, T, (s, w, h) => paintBlock(s, w, h, theme), RES);
        ctx.drawImage(block.canvas, x, y, T, T);
      } else if (ch === '-') {
        const plank = sprites.get(`plank-${themeId}`, T, 9, (s, w, h) => paintPlank(s, w, h, theme), RES);
        ctx.drawImage(plank.canvas, x, y, T, 9);
      } else if (ch === '^') {
        const thorns = sprites.get('thorns', T, T, paintThorns, RES);
        ctx.drawImage(thorns.canvas, x, y, T, T);
      }
    }
  }
  // Segunda pasada: el borde de hierba/musgo/nube, encima de todos los cuerpos (sin rendijas).
  for (const [c, r] of tops) {
    const open = (dc) => !isSolidChar(tileAt(level, c + dc, r)) || isSolidChar(tileAt(level, c + dc, r - 1));
    const left = c > 0 && open(-1);
    const right = c < level.cols - 1 && open(1);
    const variant = Math.floor(hash(c, r, 7) * 3);
    const cap = sprites.get(`cap-${themeId}-${left ? 1 : 0}${right ? 1 : 0}${variant}`, T, 9, (s, w, h) => paintCap(s, w, h, theme, themeId, left, right, variant), RES);
    ctx.drawImage(cap.canvas, c * T, r * T - 3, right ? T : T + 0.5, 9);
  }
}

// ------------------------------------------------------------ personajes

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
  const pulse = reduced ? 1 : 1 + Math.sin(view.time * 3) * 0.06;
  const glow = ctx.createRadialGradient(cx, cy, 2, cx, cy, 26 * pulse);
  glow.addColorStop(0, 'rgba(255, 214, 120, 0.6)');
  glow.addColorStop(0.5, 'rgba(255, 190, 90, 0.18)');
  glow.addColorStop(1, 'rgba(255, 180, 80, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(cx - 26, cy - 26, 52, 52);
  ctx.save();
  ctx.translate(cx, cy + 7 * (1 - sy));
  ctx.scale(sx, sy);
  // Llamita de la cabeza (dos capas).
  const flick = reduced ? 0 : Math.sin(view.time * 18) * 0.8;
  ctx.fillStyle = '#ff8f3a';
  ctx.beginPath();
  ctx.moveTo(-3.5, -5.5);
  ctx.quadraticCurveTo(-p.facing * 2.5 + flick, -16, 1 - p.facing * 3.5, -14 + flick);
  ctx.quadraticCurveTo(2.5, -9, 3.5, -5.5);
  ctx.fill();
  ctx.fillStyle = '#ffd36b';
  ctx.beginPath();
  ctx.moveTo(-2, -6);
  ctx.quadraticCurveTo(-p.facing * 1.5 + flick * 0.6, -12.5, 0.5 - p.facing * 2, -11 + flick * 0.6);
  ctx.quadraticCurveTo(1.5, -8, 2, -6);
  ctx.fill();
  const body = ctx.createRadialGradient(-2, -3, 1, 0, 0, 8);
  body.addColorStop(0, '#fffbe6');
  body.addColorStop(0.55, '#ffd36b');
  body.addColorStop(1, '#ff9f43');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, 0, 7, 7.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(200,90,20,0.45)';
  ctx.lineWidth = 0.6;
  ctx.stroke();
  // Mejillas.
  ctx.fillStyle = 'rgba(255,120,90,0.45)';
  ctx.beginPath();
  ctx.ellipse(p.facing * 1.5 - 4, 2.2, 1.4, 0.9, 0, 0, Math.PI * 2);
  ctx.ellipse(p.facing * 1.5 + 4, 2.2, 1.4, 0.9, 0, 0, Math.PI * 2);
  ctx.fill();
  // Ojos que miran hacia donde va, con brillo.
  const blink = Math.floor(view.time * 10) % 37 === 0;
  for (const ex of [p.facing * 1.5 - 2.3, p.facing * 1.5 + 2.1]) {
    ctx.fillStyle = '#3a2440';
    ctx.beginPath();
    ctx.ellipse(ex, -0.2, 1.1, blink ? 0.3 : 1.7, 0, 0, Math.PI * 2);
    ctx.fill();
    if (!blink) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ex - 0.35, -0.9, 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawEnemy(ctx, e, time, reduced) {
  if (!e.alive) return;
  if (e.type === 'blob') {
    // Babosa de sombra: gelatina brillante con ojos rosados.
    const wob = reduced ? 0 : Math.sin(time * 8 + e.x0) * 1.2;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(e.x + e.w / 2, e.y + e.h, e.w * 0.6, 1.4, 0, 0, Math.PI * 2);
    ctx.fill();
    const g = ctx.createLinearGradient(0, e.y - 2, 0, e.y + e.h);
    g.addColorStop(0, '#6b4596');
    g.addColorStop(1, '#2a1740');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(e.x, e.y + e.h);
    ctx.quadraticCurveTo(e.x - 1, e.y - wob, e.x + e.w / 2, e.y - 1 - wob);
    ctx.quadraticCurveTo(e.x + e.w + 1, e.y - wob, e.x + e.w, e.y + e.h);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(e.x + e.w * 0.3, e.y + 2 - wob * 0.5, 1.8, 0.9, -0.5, 0, Math.PI * 2);
    ctx.fill();
    const look = e.vx > 0 ? 1.2 : -1.2;
    for (const ex of [e.x + 4 + look, e.x + 8 + look]) {
      ctx.fillStyle = '#ffd1dc';
      ctx.beginPath();
      ctx.arc(ex, e.y + 4.5, 1.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2a1740';
      ctx.beginPath();
      ctx.arc(ex + look * 0.4, e.y + 4.8, 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }
  // Polilla: alas con dibujo, cuerpo peludo y antenas.
  const flap = reduced ? 0.6 : Math.abs(Math.sin(time * 14 + e.phase));
  const cx = e.x + e.w / 2;
  for (const k of [-1, 1]) {
    const wing = ctx.createRadialGradient(cx + k * 4, e.y + 4, 0.5, cx + k * 4, e.y + 4, 5);
    wing.addColorStop(0, '#f1e6ff');
    wing.addColorStop(1, '#a58bd0');
    ctx.fillStyle = wing;
    ctx.beginPath();
    ctx.ellipse(cx + k * 4, e.y + 4, 4.4, 2 + flap * 3, k * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#6f569a';
    ctx.beginPath();
    ctx.arc(cx + k * 4.5, e.y + 4, 1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#4b3568';
  ctx.beginPath();
  ctx.ellipse(cx, e.y + 6, 2.5, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#4b3568';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(cx - 0.8, e.y + 2);
  ctx.quadraticCurveTo(cx - 2, e.y - 1, cx - 3, e.y - 1);
  ctx.moveTo(cx + 0.8, e.y + 2);
  ctx.quadraticCurveTo(cx + 2, e.y - 1, cx + 3, e.y - 1);
  ctx.stroke();
}

function drawProps(ctx, world, view, reduced) {
  const { level } = world;
  const t = view.time;
  // Chispas (monedas).
  level.coins.forEach((c, i) => {
    if (world.coins[i]) return;
    const bob = reduced ? 0 : Math.sin(t * 3 + i) * 1.5;
    const g = ctx.createRadialGradient(c.x, c.y + bob, 0, c.x, c.y + bob, 10);
    g.addColorStop(0, 'rgba(255, 236, 150, 0.9)');
    g.addColorStop(1, 'rgba(255, 210, 90, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(c.x - 10, c.y - 10 + bob, 20, 20);
    ctx.fillStyle = '#fff3b0';
    ctx.beginPath();
    for (let k = 0; k < 8; k += 1) {
      const a = (k / 8) * Math.PI * 2 + (reduced ? 0 : t);
      const r = k % 2 ? 2 : 5;
      ctx.lineTo(c.x + Math.cos(a) * r, c.y + bob + Math.sin(a) * r);
    }
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(c.x, c.y + bob, 1.2, 0, Math.PI * 2);
    ctx.fill();
  });
  // Faroles (puntos de control): poste de hierro, farol con cristales.
  level.checkpoints.forEach((cp, i) => {
    const lit = i <= world.checkpoint;
    ctx.fillStyle = '#3d3149';
    ctx.fillRect(cp.x + 7, cp.y - 6, 2, T + 6);
    ctx.fillRect(cp.x + 5, cp.y + T - 2, 6, 2);
    if (lit) {
      const g = ctx.createRadialGradient(cp.x + 8, cp.y - 9, 1, cp.x + 8, cp.y - 9, 26);
      g.addColorStop(0, 'rgba(255, 200, 100, 0.65)');
      g.addColorStop(1, 'rgba(255, 200, 100, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(cp.x - 18, cp.y - 35, 52, 52);
    }
    ctx.fillStyle = '#2e2238';
    ctx.beginPath();
    ctx.moveTo(cp.x + 3.5, cp.y - 14);
    ctx.lineTo(cp.x + 8, cp.y - 17.5);
    ctx.lineTo(cp.x + 12.5, cp.y - 14);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = lit ? '#ffd27a' : '#6f6880';
    roundRect(ctx, cp.x + 4.5, cp.y - 14, 7, 8, 1.5);
    ctx.fill();
    if (lit) {
      ctx.fillStyle = '#fff3c4';
      ctx.beginPath();
      ctx.ellipse(cp.x + 8, cp.y - 10, 1.4, 2.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = '#2e2238';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(cp.x + 8, cp.y - 14);
    ctx.lineTo(cp.x + 8, cp.y - 6);
    ctx.stroke();
    roundRect(ctx, cp.x + 4.5, cp.y - 14, 7, 8, 1.5);
    ctx.stroke();
  });
  // Muelles.
  for (const s of level.springs) {
    ctx.strokeStyle = '#c9d0e4';
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
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(s.x, s.y - 0.6, s.w * 0.5, 0.8);
  }
  // Plataformas móviles: balsa de madera clara.
  for (const m of world.movers) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    roundRect(ctx, m.x + 1, m.y + 2, m.w, m.h, 3);
    ctx.fill();
    const g = ctx.createLinearGradient(0, m.y, 0, m.y + m.h);
    g.addColorStop(0, '#fff3dc');
    g.addColorStop(1, '#d9c39a');
    ctx.fillStyle = g;
    roundRect(ctx, m.x, m.y, m.w, m.h, 3);
    ctx.fill();
    ctx.fillStyle = '#b8955f';
    for (let k = 1; k < 3; k += 1) ctx.fillRect(m.x + k * T - 0.5, m.y + 1, 1, m.h - 2);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(m.x + 2, m.y + 1, m.w - 4, 0.8);
  }
  // Vela final: se enciende al llegar.
  const { base } = level.goal;
  const lit = world.status === 'won';
  // Encendido progresivo: la llama nace pequeña, crece y el halo se abre (view.litAt).
  const since = lit && view.litAt != null ? view.time - view.litAt : 1.6;
  const grow = reduced ? 1 : Math.min(1, since / 1.1);
  const ease = 1 - (1 - grow) ** 3;
  // Platillo y vela con cera derretida.
  ctx.fillStyle = '#b98a4e';
  ctx.beginPath();
  ctx.ellipse(base.x + 8, base.y + 16, 9, 2.2, 0, 0, Math.PI * 2);
  ctx.fill();
  const wax = ctx.createLinearGradient(base.x + 3, 0, base.x + 13, 0);
  wax.addColorStop(0, '#fffaf0');
  wax.addColorStop(1, '#e2d3b8');
  ctx.fillStyle = wax;
  roundRect(ctx, base.x + 3, base.y - 18, 10, 34, 2);
  ctx.fill();
  ctx.fillStyle = '#fffaf0';
  ctx.beginPath();
  ctx.ellipse(base.x + 5, base.y - 14, 1.3, 3.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3a2a2a';
  ctx.fillRect(base.x + 7.5, base.y - 22, 1, 4);
  if (lit) {
    const fx = base.x + 8;
    const fy = base.y - 22;
    const flicker = reduced ? 1 : 1 + Math.sin(t * 18) * 0.06 * grow;
    const halo = 14 + 46 * ease;
    const g = ctx.createRadialGradient(fx, fy - 5, 1, fx, fy - 5, halo);
    g.addColorStop(0, `rgba(255, 190, 90, ${0.85 * ease})`);
    g.addColorStop(1, 'rgba(255, 190, 90, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(fx - halo, fy - 5 - halo, halo * 2, halo * 2);
    // Aro de luz que se expande una vez al prender.
    if (!reduced && since < 1.2) {
      const k = since / 1.2;
      ctx.strokeStyle = `rgba(255, 230, 170, ${0.8 * (1 - k)})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(fx, fy - 5, 6 + k * 40, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Llama: de una chispa a su tamaño, con núcleo claro.
    const h = 7 * Math.max(0.15, ease) * flicker;
    ctx.fillStyle = '#ff9f43';
    ctx.beginPath();
    ctx.ellipse(fx, fy - h * 0.75, 3.4 * Math.max(0.3, ease), h, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath();
    ctx.ellipse(fx, fy - h * 0.55, 1.6 * Math.max(0.3, ease), h * 0.5, 0, 0, Math.PI * 2);
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
  view.sprites ??= createSpriteCache(90);
  view.particles ??= createParticles(120);
  view.quality ??= createQualityMonitor();
  view.quality.sample(dt);
  view.reduced = reduced;
  const { width, height } = size;
  const { level } = world;
  const themeId = THEMES[level.theme] ? level.theme : 'pradera';
  const theme = THEMES[themeId];
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
  // Nivel más bajo que la vista: se centra en vertical (antes quedaba pegado abajo,
  // sobre los controles, con medio cielo vacío encima).
  const clampY = (y) => (levelH <= visH ? (levelH - visH) / 2 : Math.max(0, Math.min(levelH - visH, y)));
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

  drawBackground(ctx, width, height, theme, themeId, camX * scale, view, viewH);
  ctx.save();
  ctx.scale(scale, scale);
  ctx.translate(-Math.round(camX * scale) / scale, -Math.round(camY * scale) / scale);
  const c0 = Math.floor(camX / T) - 1;
  const c1 = Math.ceil((camX + visW) / T) + 1;
  const r0 = Math.max(0, Math.floor(camY / T) - 1);
  const r1 = Math.min(level.rows - 1, Math.ceil((camY + visH) / T) + 1);
  drawTiles(ctx, level, theme, themeId, view, c0, c1, r0, r1, view.time);
  drawProps(ctx, world, view, reduced);
  for (const e of world.enemies) drawEnemy(ctx, e, view.time, reduced);

  // Estela de chispitas al correr.
  view.trail -= dt;
  if (!reduced && dt > 0 && Math.abs(p.vx) > 40 && view.trail <= 0 && !(world.respawn > 0)) {
    view.trail = 0.06;
    view.particles.emit({ x: p.x + PW / 2 - p.facing * 4, y: p.y + PH * 0.6, vx: -p.facing * 10, vy: -12, decay: 2.2, gravity: -10, size: 1.6, color: '#ffd98a' });
  }
  drawLumi(ctx, p, view, world, reduced);

  // Partículas.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  view.particles.update(dt, (q) => {
    ctx.globalAlpha = Math.min(1, q.life * 2);
    ctx.fillStyle = q.color;
    ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
  });
  ctx.restore();
  ctx.globalAlpha = 1;
  ctx.restore();

  // Bajo el nivel (zona de los controles táctiles en vertical): tierra oscura.
  const bottom = (levelH - camY) * scale;
  if (bottom < height) {
    ctx.fillStyle = theme.edge;
    ctx.fillRect(0, bottom, width, height - bottom);
  }
}
