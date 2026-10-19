/**
 * Dibujo de «Bloques que caen» en Canvas 2D. El tablero es una ventana al cielo
 * nocturno: las piezas son teselas de vidrio iluminado y cada línea que se
 * completa cruza el tablero como una estrella fugaz.
 */
import { COLS, HIDDEN, ROWS, SHAPES, VISIBLE_ROWS, cellsOf, ghostOf, preview } from './blocksEngine.js';
import { createSpriteCache } from '../../../render/sprites.js';

// Teselas y nebulosa en caché: la pieza de vidrio se pinta una vez por color y tamaño.
const sprites = createSpriteCache(60);
let spriteDpr = 1;

/** Libera las teselas en caché (al salir del juego). */
export function disposeRenderState() {
  sprites.clear();
}

export const PIECE_COLORS = Object.freeze({
  I: '#5ee6ff',
  O: '#ffd166',
  T: '#b48cff',
  S: '#6ee7a8',
  Z: '#ff6f91',
  J: '#6c8cff',
  L: '#ffa45c',
});

const SKY_TOP = '#0b1030';
const SKY_BOTTOM = '#1b1446';

export function createRenderState(seed = 1) {
  // Estrellas de fondo fijas (posiciones relativas), generadas una vez.
  let s = seed >>> 0 || 1;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const stars = Array.from({ length: 90 }, () => ({ x: rand(), y: rand(), r: 0.4 + rand() * 1.1, a: 0.25 + rand() * 0.6, tw: rand() * 6 }));
  return { stars, effects: [], time: 0, layout: null };
}

/** Efectos visuales a partir de los eventos del motor. */
export function addEffects(view, events, reduced) {
  for (const e of events) {
    if (e.type === 'lines') view.effects.push({ type: 'lines', rows: e.rows, count: e.count, t: 0, dur: reduced ? 0.2 : 0.45 });
    if (e.type === 'lock' && !reduced) view.effects.push({ type: 'lock', cells: e.cells, t: 0, dur: 0.18 });
  }
}

/**
 * Calcula dónde va cada cosa. `insetBottom` deja sitio a los controles táctiles.
 * El tablero se mide en casillas enteras de píxel para que la cuadrícula sea nítida.
 */
export function computeLayout(width, height, { insetBottom = 0, insetTop = 64 } = {}) {
  const availH = Math.max(120, height - insetTop - insetBottom - 16);
  const narrow = width < 520;
  // Columna lateral (reserva y siguientes) de ~4,6 casillas a la derecha; en estrecho, más compacta.
  const sideCells = narrow ? 3.6 : 5;
  const cell = Math.max(8, Math.floor(Math.min(availH / VISIBLE_ROWS, (width - 24) / (COLS + sideCells + 0.6))));
  const boardW = cell * COLS;
  const boardH = cell * VISIBLE_ROWS;
  const sideW = cell * sideCells;
  const totalW = boardW + sideW + cell * 0.6;
  const x = Math.round((width - totalW) / 2);
  const y = Math.round(insetTop + (availH - boardH) / 2 + 8);
  return { cell, x, y, boardW, boardH, sideX: x + boardW + Math.round(cell * 0.6), sideW, narrow };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function shade(hex, amount) {
  const n = Number.parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c + amount * 255)));
  return `rgb(${f((n >> 16) & 255)}, ${f((n >> 8) & 255)}, ${f(n & 255)})`;
}

/**
 * Tesela de vidriera iluminada: marco de plomo, bisel claro arriba a la
 * izquierda y oscuro abajo a la derecha, cara central con luz interior, una
 * faceta diagonal y un destello. Se pinta una vez por color y tamaño.
 */
function paintTile(ctx, size, color) {
  const pad = Math.max(1, size * 0.05);
  const s = size - pad * 2;
  const r = Math.max(2, size * 0.16);
  const bevel = Math.max(1.5, size * 0.14);
  // Plomo.
  ctx.fillStyle = 'rgba(6,8,24,0.85)';
  roundRect(ctx, pad, pad, s, s, r);
  ctx.fill();
  // Bisel: cuatro caras con luz distinta.
  const x0 = pad + 1;
  const y0 = pad + 1;
  const w = s - 2;
  const faces = [
    [shade(color, 0.32), [x0, y0], [x0 + w, y0], [x0 + w - bevel, y0 + bevel], [x0 + bevel, y0 + bevel]],
    [shade(color, 0.16), [x0, y0], [x0 + bevel, y0 + bevel], [x0 + bevel, y0 + w - bevel], [x0, y0 + w]],
    [shade(color, -0.22), [x0 + w, y0], [x0 + w, y0 + w], [x0 + w - bevel, y0 + w - bevel], [x0 + w - bevel, y0 + bevel]],
    [shade(color, -0.3), [x0, y0 + w], [x0 + bevel, y0 + w - bevel], [x0 + w - bevel, y0 + w - bevel], [x0 + w, y0 + w]],
  ];
  ctx.save();
  roundRect(ctx, x0, y0, w, w, r * 0.85);
  ctx.clip();
  for (const [fill, ...pts] of faces) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  // Cara central con luz interior.
  const inner = w - bevel * 2;
  const glow = ctx.createRadialGradient(x0 + bevel + inner * 0.35, y0 + bevel + inner * 0.3, inner * 0.05, x0 + w / 2, y0 + w / 2, inner * 0.75);
  glow.addColorStop(0, shade(color, 0.35));
  glow.addColorStop(0.55, color);
  glow.addColorStop(1, shade(color, -0.12));
  ctx.fillStyle = glow;
  roundRect(ctx, x0 + bevel, y0 + bevel, inner, inner, Math.max(1, r * 0.4));
  ctx.fill();
  // Faceta diagonal y destello.
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.beginPath();
  ctx.moveTo(x0 + bevel, y0 + bevel + inner * 0.55);
  ctx.lineTo(x0 + bevel + inner * 0.55, y0 + bevel);
  ctx.lineTo(x0 + bevel + inner * 0.8, y0 + bevel);
  ctx.lineTo(x0 + bevel, y0 + bevel + inner * 0.8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath();
  ctx.arc(x0 + bevel + inner * 0.22, y0 + bevel + inner * 0.2, Math.max(0.8, inner * 0.07), 0, Math.PI * 2);
  ctx.fill();
}

function drawTile(ctx, x, y, size, color, alpha = 1) {
  const sprite = sprites.get(`t${color}`, size, size, (c, w) => paintTile(c, w, color), spriteDpr);
  if (!sprite) return;
  ctx.globalAlpha = alpha;
  ctx.drawImage(sprite.canvas, x, y, size, size);
  ctx.globalAlpha = 1;
}

/** Nebulosa del fondo (manchas de color suaves), en caché por tamaño de pantalla. */
function paintNebula(ctx, w, h) {
  const blobs = [
    [0.18, 0.22, 0.45, '120 80 220'],
    [0.85, 0.35, 0.4, '60 140 230'],
    [0.6, 0.85, 0.5, '220 90 170'],
    [0.1, 0.8, 0.35, '80 200 220'],
  ];
  for (const [x, y, r, rgb] of blobs) {
    const g = ctx.createRadialGradient(w * x, h * y, 0, w * x, h * y, Math.max(w, h) * r);
    g.addColorStop(0, `rgb(${rgb} / 0.22)`);
    g.addColorStop(1, `rgb(${rgb} / 0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
}

function drawMini(ctx, type, cx, cy, size, alpha = 1) {
  if (!type) return;
  const cells = SHAPES[type][0];
  const xs = cells.map(([x]) => x);
  const ys = cells.map(([, y]) => y);
  const w = (Math.max(...xs) - Math.min(...xs) + 1) * size;
  const h = (Math.max(...ys) - Math.min(...ys) + 1) * size;
  const ox = cx - w / 2 - Math.min(...xs) * size;
  const oy = cy - h / 2 - Math.min(...ys) * size;
  for (const [x, y] of cells) drawTile(ctx, ox + x * size, oy + y * size, size, PIECE_COLORS[type], alpha);
}

function panel(ctx, x, y, w, h, label, cell) {
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.strokeStyle = 'rgba(190,200,255,0.22)';
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, w, h, Math.max(6, cell * 0.35));
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(225,230,255,0.75)';
  ctx.font = `600 ${Math.max(10, Math.round(cell * 0.48))}px Manrope, system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(label, x + cell * 0.35, y + cell * 0.25);
}

export function renderBlocks(ctx, size, state, view, dt, { insetBottom = 0, reduced = false } = {}) {
  if (!ctx || !size.width) return;
  const { width, height } = size;
  spriteDpr = size.dpr || 1;
  view.time += dt;
  const layout = computeLayout(width, height, { insetBottom });
  view.layout = layout;
  const { cell, x: bx, y: by, boardW, boardH } = layout;

  // Cielo
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, SKY_TOP);
  sky.addColorStop(1, SKY_BOTTOM);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);
  const nebula = sprites.get('nebula', width, height, paintNebula, 0.5);
  if (nebula) ctx.drawImage(nebula.canvas, 0, 0, width, height);
  for (const star of view.stars) {
    const twinkle = reduced ? 1 : 0.65 + 0.35 * Math.sin(view.time * 1.4 + star.tw);
    ctx.globalAlpha = star.a * twinkle;
    ctx.fillStyle = '#e8ecff';
    ctx.beginPath();
    ctx.arc(star.x * width, star.y * height, star.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Pozo del tablero: ventana con marco metálico biselado y cristal oscuro.
  const frame = Math.max(5, cell * 0.28);
  const rim = ctx.createLinearGradient(bx, by - frame, bx, by + boardH + frame);
  rim.addColorStop(0, '#8d97d6');
  rim.addColorStop(0.5, '#3c4380');
  rim.addColorStop(1, '#262b5a');
  ctx.fillStyle = rim;
  roundRect(ctx, bx - frame, by - frame, boardW + frame * 2, boardH + frame * 2, Math.max(8, cell * 0.4));
  ctx.fill();
  ctx.strokeStyle = 'rgba(220, 228, 255, 0.45)';
  ctx.lineWidth = 1;
  ctx.stroke();
  const well = ctx.createLinearGradient(0, by, 0, by + boardH);
  well.addColorStop(0, 'rgba(10, 12, 40, 0.92)');
  well.addColorStop(1, 'rgba(18, 14, 52, 0.92)');
  ctx.fillStyle = well;
  roundRect(ctx, bx - 2, by - 2, boardW + 4, boardH + 4, Math.max(4, cell * 0.2));
  ctx.fill();
  ctx.strokeStyle = 'rgba(160, 175, 255, 0.07)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let c = 1; c < COLS; c += 1) {
    ctx.moveTo(bx + c * cell + 0.5, by);
    ctx.lineTo(bx + c * cell + 0.5, by + boardH);
  }
  for (let r = 1; r < VISIBLE_ROWS; r += 1) {
    ctx.moveTo(bx, by + r * cell + 0.5);
    ctx.lineTo(bx + boardW, by + r * cell + 0.5);
  }
  ctx.stroke();

  const toScreen = (gx, gy) => [bx + gx * cell, by + (gy - HIDDEN) * cell];

  // Bloques fijos
  for (let gy = HIDDEN; gy < ROWS; gy += 1) {
    for (let gx = 0; gx < COLS; gx += 1) {
      const type = state.board[gy * COLS + gx];
      if (type) {
        const [sx, sy] = toScreen(gx, gy);
        drawTile(ctx, sx, sy, cell, state.over ? '#59607a' : PIECE_COLORS[type]);
      }
    }
  }

  // Sombra y pieza activa
  if (state.active) {
    // Sombra: contorno y relleno muy tenue del color de la pieza, donde caerá.
    const ghost = ghostOf(state);
    const tint = PIECE_COLORS[state.active.type];
    ctx.strokeStyle = shade(tint, 0.1);
    ctx.lineWidth = Math.max(1, cell * 0.08);
    for (const [gx, gy] of cellsOf(ghost)) {
      if (gy < HIDDEN) continue;
      const [sx, sy] = toScreen(gx, gy);
      roundRect(ctx, sx + cell * 0.12, sy + cell * 0.12, cell * 0.76, cell * 0.76, cell * 0.18);
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = tint;
      ctx.fill();
      ctx.globalAlpha = 0.55;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (const [gx, gy] of cellsOf(state.active)) {
      if (gy < HIDDEN) continue;
      const [sx, sy] = toScreen(gx, gy);
      drawTile(ctx, sx, sy, cell, PIECE_COLORS[state.active.type]);
    }
  }

  // Efectos: destello al fijar y estrella fugaz por línea completada
  view.effects = view.effects.filter((e) => (e.t += dt) < e.dur);
  for (const e of view.effects) {
    const k = e.t / e.dur;
    if (e.type === 'lock') {
      ctx.fillStyle = `rgba(255,255,255,${0.35 * (1 - k)})`;
      for (const [gx, gy] of e.cells) {
        if (gy < HIDDEN) continue;
        const [sx, sy] = toScreen(gx, gy);
        ctx.fillRect(sx + 1, sy + 1, cell - 2, cell - 2);
      }
    } else if (e.type === 'lines') {
      // Las filas ya se borraron en el motor; la estela recorre la altura que ocupaban.
      e.rows.forEach((gy, i) => {
        const sy = by + (gy - HIDDEN) * cell;
        const band = ctx.createLinearGradient(bx, 0, bx + boardW, 0);
        const head = Math.min(1, k * 1.6 - i * 0.08);
        band.addColorStop(0, 'rgba(255,255,255,0)');
        band.addColorStop(Math.max(0, head - 0.35), 'rgba(255,255,255,0)');
        band.addColorStop(Math.max(0, Math.min(1, head)), `rgba(255,250,220,${0.9 * (1 - k)})`);
        band.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = band;
        ctx.fillRect(bx, sy, boardW, cell);
      });
      if (e.count === 4) {
        ctx.fillStyle = `rgba(255, 236, 170, ${0.18 * (1 - k)})`;
        ctx.fillRect(bx, by, boardW, boardH);
      }
    }
  }

  // Columna lateral: reserva y siguientes
  const { sideX, sideW, narrow } = layout;
  const mini = Math.max(6, Math.round(cell * (narrow ? 0.62 : 0.72)));
  const holdH = cell * 3.4;
  panel(ctx, sideX, by, sideW, holdH, 'Reserva', cell);
  drawMini(ctx, state.hold, sideX + sideW / 2, by + holdH / 2 + cell * 0.35, mini, state.canHold ? 1 : 0.35);
  const nextY = by + holdH + cell * 0.6;
  const nextH = cell * 9;
  panel(ctx, sideX, nextY, sideW, nextH, 'Siguen', cell);
  preview(state, 3).forEach((type, i) => drawMini(ctx, type, sideX + sideW / 2, nextY + cell * 2.3 + i * cell * 2.4, i === 0 ? mini : mini * 0.82, i === 0 ? 1 : 0.75));
}
