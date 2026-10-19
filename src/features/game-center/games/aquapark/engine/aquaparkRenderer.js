/**
 * Dibujo de Aquapark en Canvas 2D.
 *
 * Técnica de "carretera por segmentos": cada borde de segmento se proyecta desde
 * una cámara detrás del jugador; la curvatura se acumula segmento a segmento y el
 * descenso desplaza los segmentos lejanos. Sobre esa base, cada borde se dibuja
 * como una SECCIÓN CURVA de medio tubo (no un trapecio plano): un arco de ángulo
 * θ ∈ [−θmax, θmax] con sombreado según la inclinación, agua en el fondo y un
 * labio redondeado en el borde. Los tramos sin paredes tienen un θmax pequeño:
 * se ve que no protegen.
 *
 * Coherencia con la física: la posición lateral normalizada `x` (la misma que usa
 * el motor para las colisiones) se proyecta igual para el jugador, los rivales y
 * los flotadores: X = centro + x · semiancho. El arco solo añade altura visual.
 *
 * Se dibuja de lejos a cerca (algoritmo del pintor) y el jugador al final.
 */
import { FALL_TIME, FLOAT_HALF, PLAYER_HALF, SEGMENT_LENGTH, heightAt, segmentAt } from './aquaparkEngine.js';
import { createSpriteCache } from '../../../render/sprites.js';
import { seeded } from '../../../render/paint.js';

const ROAD_W = 3.2; // metros por unidad de ancho normalizado
const CAMERA_BACK = 7;
const CAMERA_HEIGHT = 2.6;
const DRAW_SEGMENTS = 110;
const CURVE_SCALE = 0.045;
const TUBE_RADIUS = 1.18; // radio del tubo respecto al semiancho del suelo
const TUBE_DEPTH = 1.25; // metros de pared en un tramo con paredes
const THETA_WALL = 1.32; // ángulo del labio (rad) con paredes
const THETA_OPEN = 0.62; // y sin paredes
const BANDS_NEAR = 12; // franjas de la sección (cerca)
const BANDS_FAR = 6; // (lejos)

export function createAquaView() {
  return { bgOffset: 0, time: 0, splashes: [], bump: 0, sprites: createSpriteCache(40) };
}

/** Libera los sprites de la vista (al salir o reiniciar). */
export function disposeAquaView(view) {
  view.sprites?.clear();
}

// Resolución fija de los sprites de bañista: se escalan con la perspectiva.
const RIDER_PX = 120;

// ---------------------------------------------------------------- colores

const shadeCache = new Map();
/** Mezcla un color hex con negro (f < 0) o blanco (f > 0). Cacheado: se llama miles de veces por fotograma. */
function shade(hex, f) {
  const key = `${hex}|${f.toFixed(2)}`;
  let value = shadeCache.get(key);
  if (value) return value;
  const n = parseInt(hex.slice(1), 16);
  const mix = (c) => Math.round(f < 0 ? c * (1 + f) : c + (255 - c) * f);
  value = `rgb(${mix((n >> 16) & 255)} ${mix((n >> 8) & 255)} ${mix(n & 255)})`;
  if (shadeCache.size > 4000) shadeCache.clear();
  shadeCache.set(key, value);
  return value;
}

// ---------------------------------------------------------------- fondo

function drawBackground(ctx, W, H, horizon, theme, view) {
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, theme.sky[0]);
  sky.addColorStop(1, theme.sky[1]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, horizon + 1);

  if (theme.night) {
    ctx.fillStyle = 'rgb(255 255 255 / 0.8)';
    for (let i = 0; i < 60; i += 1) {
      const x = (i * 97.3 + view.bgOffset * 0.05) % W;
      const y = (((i * 71) % 100) / 100) * horizon * 0.8;
      ctx.beginPath();
      ctx.arc((x + W) % W, y, i % 3 === 0 ? 1.4 : 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const sunX = W * 0.78;
  const sunY = horizon * 0.34;
  const halo = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, Math.max(W, H) * 0.2);
  halo.addColorStop(0, theme.sun);
  halo.addColorStop(0.2, `${theme.sun}aa`);
  halo.addColorStop(1, 'transparent');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, W, horizon);
  ctx.fillStyle = theme.sun;
  ctx.beginPath();
  ctx.arc(sunX, sunY, Math.min(W, H) * 0.05, 0, Math.PI * 2);
  ctx.fill();

  // Colinas suaves (curvas cuadráticas) con paralaje según las curvas recorridas.
  const layers = [
    { speed: 0.12, height: 0.15, alpha: 0.5, step: 160 },
    { speed: 0.25, height: 0.09, alpha: 0.85, step: 110 },
  ];
  for (const layer of layers) {
    ctx.fillStyle = theme.hills;
    ctx.globalAlpha = layer.alpha;
    ctx.beginPath();
    ctx.moveTo(-10, horizon + 1);
    const shift = (view.bgOffset * layer.speed) % layer.step;
    let prevX = -layer.step - 10;
    let prevY = horizon;
    for (let x = -layer.step; x <= W + layer.step; x += layer.step / 3) {
      const k = (x - shift) / layer.step;
      const y = horizon - H * layer.height * (0.55 + 0.45 * Math.sin(k * 2.1) * Math.cos(k * 0.7));
      ctx.quadraticCurveTo(prevX, prevY, (prevX + x) / 2, (prevY + y) / 2);
      prevX = x;
      prevY = y;
    }
    ctx.lineTo(W + 10, horizon + 1);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Torres de toboganes lejanas y palmeras: el parque se extiende más allá.
  const stripW = 760;
  const stripH = Math.max(40, horizon * 0.5);
  const park = view.sprites.get(`park${theme.hills}${theme.night ? 'n' : ''}`, stripW, stripH, (c, w, h) => paintParkSkyline(c, w, h, theme), 1);
  const parkShift = (((view.bgOffset * 0.35) % stripW) + stripW) % stripW;
  for (let x = -parkShift; x < W; x += stripW) ctx.drawImage(park.canvas, x, horizon - stripH + 2, stripW, stripH);

  // Piscina con brillos ondulados.
  const pool = ctx.createLinearGradient(0, horizon, 0, H);
  pool.addColorStop(0, theme.pool[0]);
  pool.addColorStop(1, theme.pool[1]);
  ctx.fillStyle = pool;
  ctx.fillRect(0, horizon, W, H - horizon);
  // Cáusticas: red de luz del fondo de la piscina, en movimiento lento.
  const caustics = view.sprites.get('caustics', 256, 256, paintCaustics, 1);
  const pattern = ctx.createPattern(caustics.canvas, 'repeat');
  if (pattern) {
    ctx.save();
    ctx.globalAlpha = theme.night ? 0.07 : 0.12;
    ctx.beginPath();
    ctx.rect(0, horizon, W, H - horizon);
    ctx.clip();
    const drift = view.reduced ? 0 : view.time * 9;
    ctx.translate(-(drift % 256) - (view.bgOffset % 256), horizon - (drift * 0.6) % 256);
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, W + 512, H + 512);
    ctx.restore();
  }
  ctx.strokeStyle = 'rgb(255 255 255 / 0.3)';
  ctx.lineCap = 'round';
  ctx.lineWidth = 2;
  for (let i = 0; i < 18; i += 1) {
    const y = horizon + (((i * 37) % 100) / 100) * (H - horizon);
    const x = ((i * 211 + view.time * 26 * (1 + (i % 3))) % (W + 80)) - 40;
    const w = 10 + (i % 4) * 8 * (y / H);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + w / 2, y - 3, x + w, y);
    ctx.stroke();
  }
}

// ---------------------------------------------------------------- elementos

function drawFloat(ctx, x, y, radius) {
  const h = radius * 0.46;
  ctx.fillStyle = 'rgb(0 40 70 / 0.22)';
  ctx.beginPath();
  ctx.ellipse(x, y + h * 0.35, radius * 1.05, h * 0.8, 0, 0, Math.PI * 2);
  ctx.fill();
  // Rosco con volumen (degradado radial), franjas blancas y agujero central.
  const body = ctx.createRadialGradient(x - radius * 0.3, y - h * 0.9, radius * 0.1, x, y - h * 0.4, radius * 1.1);
  body.addColorStop(0, '#ffd9e2');
  body.addColorStop(0.5, '#ff6f91');
  body.addColorStop(1, '#d9466b');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(x, y - h * 0.45, radius, h, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgb(255 255 255 / 0.85)';
  for (let i = 0; i < 4; i += 1) {
    const a1 = (i / 4) * Math.PI * 2 + 0.3;
    ctx.beginPath();
    ctx.ellipse(x, y - h * 0.45, radius, h, 0, a1, a1 + 0.42);
    ctx.ellipse(x, y - h * 0.45, radius * 0.55, h * 0.5, 0, a1 + 0.42, a1, true);
    ctx.fill();
  }
  ctx.fillStyle = 'rgb(10 70 110 / 0.75)';
  ctx.beginPath();
  ctx.ellipse(x, y - h * 0.5, radius * 0.42, h * 0.36, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgb(255 255 255 / 0.7)';
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1, radius * 0.08);
  ctx.beginPath();
  ctx.ellipse(x - radius * 0.15, y - h * 0.85, radius * 0.5, h * 0.35, -0.15, Math.PI * 1.1, Math.PI * 1.65);
  ctx.stroke();
}

/** Siluetas lejanas del parque (torres, toboganes en espiral, palmeras), teseladas en horizontal. */
function paintParkSkyline(ctx, W, H, theme) {
  const rand = seeded(theme.hills.length * 13 + W);
  const base = shade(theme.hills, theme.night ? -0.2 : -0.12);
  const light = shade(theme.hills, 0.25);
  ctx.lineCap = 'round';
  // Torres con toboganes que bajan en espiral.
  for (const tx of [0.12, 0.47, 0.8]) {
    const x = W * tx;
    const top = H * (0.08 + rand() * 0.2);
    ctx.fillStyle = base;
    ctx.fillRect(x - 3, top, 6, H - top);
    ctx.fillRect(x - 16, top, 32, 6);
    ctx.fillStyle = light;
    ctx.beginPath();
    ctx.moveTo(x - 18, top);
    ctx.lineTo(x, top - 14);
    ctx.lineTo(x + 18, top);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = shade(theme.slide[rand() < 0.5 ? 0 : 1], -0.15);
    ctx.lineWidth = 6;
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    for (let k = 0; k <= 40; k += 1) {
      const t = k / 40;
      const px = x + Math.sin(t * Math.PI * 3) * (18 + t * 10);
      const py = top + 6 + t * (H - top - 6);
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // Palmeras.
  for (let i = 0; i < 6; i += 1) {
    const x = rand() * W;
    const h = H * (0.35 + rand() * 0.3);
    ctx.strokeStyle = base;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, H);
    ctx.quadraticCurveTo(x + 6, H - h * 0.5, x - 2, H - h);
    ctx.stroke();
    ctx.fillStyle = base;
    for (let k = 0; k < 6; k += 1) {
      const a = -Math.PI / 2 + (k - 2.5) * 0.55;
      ctx.save();
      ctx.translate(x - 2, H - h);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.ellipse(10, 0, 12, 2.6, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

/** Red de cáusticas (líneas de luz curvas) en una loseta que encaja por los bordes. */
function paintCaustics(ctx, W, H) {
  const rand = seeded(21);
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineCap = 'round';
  for (let i = 0; i < 26; i += 1) {
    const x = rand() * W;
    const y = rand() * H;
    const r = 14 + rand() * 22;
    ctx.lineWidth = 0.8 + rand() * 1.1;
    for (const ox of [-W, 0, W]) {
      for (const oy of [-H, 0, H]) {
        ctx.beginPath();
        ctx.ellipse(x + ox, y + oy, r, r * (0.55 + rand() * 0.3), rand() * Math.PI, 0.3, Math.PI * (1.2 + rand() * 0.6));
        ctx.stroke();
      }
    }
  }
}

const SKIN = ['#f1c7a3', '#d9a07a', '#a8714c', '#7a4b2e'];
const HAIR = ['#2b1b14', '#5a3622', '#c9873f', '#1b1b22'];
const SUIT = ['#2b6cb0', '#e76f51', '#2a9d8f', '#6d4bd6', '#e63973'];

/**
 * Bañista de espaldas sentado en su flotador. Sprite de RIDER_PX de ancho; el
 * centro del flotador queda en (W/2, H·0.72).
 */
function paintRider(ctx, W, H, color, seed) {
  const rand = seeded(seed);
  const skin = SKIN[Math.floor(rand() * SKIN.length)];
  const hair = HAIR[Math.floor(rand() * HAIR.length)];
  const suit = SUIT[Math.floor(rand() * SUIT.length)];
  const longHair = rand() < 0.5;
  const w = W * 0.92;
  const h = w * 0.46;
  const cx = W / 2;
  const cy = H * 0.72;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // Flotador: rosco con volumen, franjas y brillo.
  const ring = ctx.createRadialGradient(cx - w * 0.15, cy - h * 0.4, w * 0.05, cx, cy, w * 0.6);
  ring.addColorStop(0, shade(color, 0.6));
  ring.addColorStop(0.55, color);
  ring.addColorStop(1, shade(color, -0.35));
  ctx.fillStyle = ring;
  ctx.beginPath();
  ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (const a of [0.35, 2.2]) {
    ctx.beginPath();
    ctx.ellipse(cx + Math.cos(a) * w * 0.42, cy + Math.sin(a) * h * 0.38, w * 0.06, h * 0.22, a, 0, Math.PI * 2);
    ctx.fill();
  }
  // Hueco central (agua).
  ctx.fillStyle = 'rgba(10,60,100,0.55)';
  ctx.beginPath();
  ctx.ellipse(cx, cy - h * 0.05, w * 0.22, h * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  // Espalda con bañador.
  const back = ctx.createLinearGradient(cx - w * 0.2, 0, cx + w * 0.2, 0);
  back.addColorStop(0, shade(skin, -0.2));
  back.addColorStop(0.45, skin);
  back.addColorStop(1, shade(skin, -0.3));
  ctx.fillStyle = back;
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.2, cy - h * 0.05);
  ctx.quadraticCurveTo(cx - w * 0.24, cy - h * 1.15, cx - w * 0.12, cy - h * 1.3);
  ctx.lineTo(cx + w * 0.12, cy - h * 1.3);
  ctx.quadraticCurveTo(cx + w * 0.24, cy - h * 1.15, cx + w * 0.2, cy - h * 0.05);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = suit;
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.21, cy - h * 0.15);
  ctx.lineTo(cx - w * 0.2, cy - h * 0.6);
  ctx.quadraticCurveTo(cx, cy - h * 0.72, cx + w * 0.2, cy - h * 0.6);
  ctx.lineTo(cx + w * 0.21, cy - h * 0.15);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = suit;
  ctx.lineWidth = w * 0.025;
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.1, cy - h * 0.62);
  ctx.lineTo(cx - w * 0.08, cy - h * 1.25);
  ctx.moveTo(cx + w * 0.1, cy - h * 0.62);
  ctx.lineTo(cx + w * 0.08, cy - h * 1.25);
  ctx.stroke();
  // Brazos hacia las asas del flotador.
  ctx.strokeStyle = skin;
  ctx.lineWidth = w * 0.075;
  for (const k of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + k * w * 0.15, cy - h * 1.15);
    ctx.quadraticCurveTo(cx + k * w * 0.36, cy - h * 0.75, cx + k * w * 0.34, cy - h * 0.12);
    ctx.stroke();
    ctx.fillStyle = shade(skin, -0.1);
    ctx.beginPath();
    ctx.arc(cx + k * w * 0.34, cy - h * 0.1, w * 0.05, 0, Math.PI * 2);
    ctx.fill();
  }
  // Cabeza con pelo (de espaldas).
  const headY = cy - h * 1.62;
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(cx, headY + h * 0.05, w * 0.13, 0, Math.PI * 2);
  ctx.fill();
  const hg = ctx.createRadialGradient(cx - w * 0.04, headY - h * 0.15, 1, cx, headY, w * 0.15);
  hg.addColorStop(0, shade(hair, 0.35));
  hg.addColorStop(1, hair);
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.arc(cx, headY, w * 0.135, Math.PI * 0.95, Math.PI * 2.05);
  ctx.quadraticCurveTo(cx + w * 0.12, headY + h * 0.25, cx, headY + h * 0.22);
  ctx.quadraticCurveTo(cx - w * 0.12, headY + h * 0.25, cx - w * 0.135, headY);
  ctx.fill();
  if (longHair) {
    ctx.beginPath();
    ctx.ellipse(cx, headY + h * 0.42, w * 0.05, h * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Orejas.
  ctx.fillStyle = shade(skin, -0.1);
  for (const k of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(cx + k * w * 0.135, headY + h * 0.08, w * 0.025, h * 0.07, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Parte delantera del flotador, por encima de las manos.
  ctx.strokeStyle = shade(color, 0.3);
  ctx.lineWidth = h * 0.28;
  ctx.beginPath();
  ctx.ellipse(cx, cy, w * 0.4, h * 0.3, 0, 0.15, Math.PI - 0.15);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = h * 0.06;
  ctx.beginPath();
  ctx.ellipse(cx, cy - h * 0.03, w * 0.4, h * 0.28, 0, 0.5, Math.PI - 0.5);
  ctx.stroke();
}

function drawRider(ctx, x, y, halfWidth, color, lean = 0, label = null, hurt = 0, sprites = null) {
  const w = halfWidth * 2;
  const h = w * 0.46;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(lean);
  ctx.fillStyle = 'rgb(0 40 70 / 0.22)';
  ctx.beginPath();
  ctx.ellipse(0, h * 0.4, w * 0.56, h * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  const seed = [...color].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0;
  const sprite = sprites?.get(`rider${color}`, RIDER_PX, RIDER_PX * 1.15, (c, sw, sh) => paintRider(c, sw, sh, color, seed), 1);
  if (sprite) {
    // El sprite mide RIDER_PX de ancho con el flotador al 92 %: se escala al ancho del bañista.
    const k = w / (RIDER_PX * 0.92);
    ctx.drawImage(sprite.canvas, -sprite.w * k * 0.5, -sprite.h * k * 0.72, sprite.w * k, sprite.h * k);
  }
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (hurt > 0) {
    ctx.strokeStyle = `rgb(255 90 90 / ${hurt})`;
    ctx.lineWidth = Math.max(2, w * 0.05);
    ctx.beginPath();
    ctx.ellipse(0, -h * 0.2, w * 0.75, h * 1.4, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  if (label) {
    const size = Math.max(10, Math.min(14, w * 0.18));
    ctx.font = `700 ${size}px Manrope, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    const tw = ctx.measureText(label).width + 12;
    const ly = y - h * 2.1;
    ctx.fillStyle = 'rgb(0 0 0 / 0.35)';
    ctx.beginPath();
    ctx.roundRect(x - tw / 2, ly - size, tw, size + 6, (size + 6) / 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(label, x, ly);
  }
}

/** Dos cheurones de trazo redondeado que apuntan hacia delante. */
function drawBoost(ctx, a, b, x) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#ffd166';
  ctx.lineWidth = Math.max(2, a.w * 0.06);
  for (const t of [0.15, 0.55]) {
    const at = (k, u) => a[k] + (b[k] - a[k]) * u;
    const y1 = at('y', t);
    const y2 = at('y', t + 0.35);
    const cx1 = at('x', t) + x * at('w', t);
    const cx2 = at('x', t + 0.35) + x * at('w', t + 0.35);
    const half = at('w', t) * 0.2;
    ctx.beginPath();
    ctx.moveTo(cx1 - half, y1);
    ctx.lineTo(cx2, y2);
    ctx.lineTo(cx1 + half, y1);
    ctx.stroke();
  }
  ctx.restore();
}

function drawRamp(ctx, a, b) {
  const rise = 0.55 * b.scaleY;
  const span = 0.82;
  const grad = ctx.createLinearGradient(0, b.y - rise, 0, a.y);
  grad.addColorStop(0, '#fff1b8');
  grad.addColorStop(1, '#ffb703');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(a.x - a.w * span, a.y);
  ctx.quadraticCurveTo(b.x - b.w * span, a.y - rise * 0.2, b.x - b.w * span, b.y - rise);
  ctx.lineTo(b.x + b.w * span, b.y - rise);
  ctx.quadraticCurveTo(b.x + b.w * span, a.y - rise * 0.2, a.x + a.w * span, a.y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#e76f51';
  ctx.lineWidth = Math.max(1.5, b.scale * 0.08);
  ctx.lineJoin = 'round';
  ctx.stroke();
}

function drawArch(ctx, p, theme) {
  const r = p.w * TUBE_RADIUS * 1.05;
  const top = p.y - p.scaleY * 2.6;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = theme.slide[0];
  ctx.lineWidth = Math.max(3, p.scale * 0.35);
  ctx.beginPath();
  ctx.moveTo(p.x - r, p.y - p.scaleY * 0.6);
  ctx.lineTo(p.x - r, top);
  ctx.arc(p.x, top, r, Math.PI, 0);
  ctx.lineTo(p.x + r, p.y - p.scaleY * 0.6);
  ctx.stroke();
  const label = Math.max(9, p.scale * 0.5);
  ctx.font = `800 ${label}px "Bricolage Grotesque", system-ui, sans-serif`;
  const tw = ctx.measureText('META').width + label;
  ctx.fillStyle = theme.slide[1];
  ctx.beginPath();
  ctx.roundRect(p.x - tw / 2, top - r - label * 0.9, tw, label * 1.5, label * 0.75);
  ctx.fill();
  ctx.fillStyle = '#1d1d1d';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('META', p.x, top - r - label * 0.15);
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
}

// ---------------------------------------------------------------- tobogán

/** Ángulo del labio en un segmento, suavizado con sus vecinos (transición gradual entre tramos con y sin paredes). */
function thetaAt(track, index) {
  let sum = 0;
  let count = 0;
  for (let i = index - 2; i <= index + 2; i += 1) {
    const seg = track.segments[i];
    if (!seg) continue;
    sum += seg.walls ? THETA_WALL : THETA_OPEN;
    count += 1;
  }
  return sum / count;
}

/** Punto de la sección curva: θ = 0 es el fondo del tubo; ±θmax son los labios. */
function sectionPoint(p, theta) {
  const r = p.w * TUBE_RADIUS;
  return [p.x + Math.sin(theta) * r, p.y - (1 - Math.cos(theta)) * TUBE_DEPTH * p.scaleY * 1.15];
}

/** Altura visual en la posición lateral normalizada `x`: al girar se sube por la pared. */
function lift(p, x) {
  const theta = Math.asin(Math.max(-0.99, Math.min(0.99, x / TUBE_RADIUS)));
  return (1 - Math.cos(theta)) * TUBE_DEPTH * p.scaleY * 1.15;
}

function drawStrip(ctx, a, b, theme, view, near) {
  const seg = a.seg;
  const bands = near ? BANDS_NEAR : BANDS_FAR;
  const stripe = Math.floor(seg.index / 4) % 2 === 0;
  const wallColor = stripe ? theme.slide[0] : theme.slide[1];
  const waterColor = Math.floor((seg.index + view.time * 5) / 3) % 2 === 0 ? theme.water[0] : theme.water[1];
  const tA = a.theta;
  const tB = b.theta;
  for (let i = 0; i < bands; i += 1) {
    const u1 = -1 + (2 * i) / bands;
    const u2 = -1 + (2 * (i + 1)) / bands;
    const mid = Math.abs((u1 + u2) / 2);
    const [x1, y1] = sectionPoint(a, u1 * tA);
    const [x2, y2] = sectionPoint(a, u2 * tA);
    const [x3, y3] = sectionPoint(b, u2 * tB);
    const [x4, y4] = sectionPoint(b, u1 * tB);
    // Agua en el fondo; paredes de color, más oscuras cuanto más inclinadas (volumen).
    const tilt = mid * mid;
    ctx.fillStyle = mid < 0.42 ? shade(waterColor, 0.12 - tilt * 0.4) : shade(wallColor, 0.14 - tilt * 0.38);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y3);
    ctx.lineTo(x4, y4);
    ctx.closePath();
    ctx.fill();
    // Un trazo fino del mismo color tapa las costuras de antialiasing entre franjas.
    if (near) {
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
  // Corriente del agua: trazos redondeados que avanzan.
  if (near && seg.index % 3 === 0) {
    ctx.strokeStyle = 'rgb(255 255 255 / 0.45)';
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, a.w * 0.025);
    for (const lane of [-0.3, 0.3]) {
      ctx.beginPath();
      ctx.moveTo(...sectionPoint(a, lane * tA * 0.6));
      ctx.lineTo(...sectionPoint(b, lane * tB * 0.6));
      ctx.stroke();
    }
  }
  // Labio del tubo: las tapas redondas se solapan y forman un borde continuo.
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1.5, Math.min(a.scale * 0.22, a.w * 0.07));
  ctx.strokeStyle = shade(wallColor, 0.35);
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(...sectionPoint(a, side * tA));
    ctx.lineTo(...sectionPoint(b, side * tB));
    ctx.stroke();
  }
}

/** Dibuja un fotograma. `view` guarda el estado visual (paralaje, salpicaduras, golpe); `dt` lo hace avanzar. */
export function renderAquapark(ctx, size, race, view, dt = 0) {
  if (!ctx) return;
  const { width: W, height: H } = size;
  const { track, player } = race;
  const theme = track.circuit.theme;
  view.time += dt;
  view.bump = Math.max(0, view.bump - dt * 2.5);

  // Focal horizontal limitada por el ancho; la vertical, por el alto: en vertical
  // (móvil) el tobogán sigue llenando la pantalla hasta abajo.
  const focal = Math.min(W * 0.95, H * 1.25);
  const focalY = Math.max(focal, H * 0.95);
  const horizon = H * 0.36;
  const camZ = player.z - CAMERA_BACK;
  const baseSeg = segmentAt(track, Math.max(0, camZ));
  const playerSeg = segmentAt(track, player.z);
  // Altura interpolada: con la altura del segmento (escalonada cada 4 m) la cámara
  // daba un salto al cruzar cada borde y todo el tobogán parecía brincar.
  const playerY = heightAt(track, player.z);
  const camY = playerY + CAMERA_HEIGHT + (heightAt(track, Math.max(0, camZ)) - playerY) * 0.4;
  const camX = player.x * ROAD_W * 0.5;
  view.bgOffset += playerSeg.curve * player.speed * dt * 6;

  ctx.save();
  // Pequeña sacudida al chocar (se omite con movimiento reducido: bump llega a 0 desde fuera).
  if (view.bump > 0 && !view.reduced) ctx.translate((Math.random() - 0.5) * view.bump * 6, (Math.random() - 0.5) * view.bump * 6);
  drawBackground(ctx, W, H, horizon, theme, view);

  const startIndex = Math.floor(Math.max(0, camZ) / SEGMENT_LENGTH);
  const fraction = (Math.max(0, camZ) % SEGMENT_LENGTH) / SEGMENT_LENGTH;
  const points = [];
  let x = 0;
  let dx = -baseSeg.curve * CURVE_SCALE * fraction;
  for (let n = 0; n <= DRAW_SEGMENTS; n += 1) {
    const seg = track.segments[startIndex + n];
    if (!seg) break;
    const z = seg.z - camZ;
    if (z > 0.6) {
      const scale = focal / z;
      const scaleY = focalY / z;
      points.push({
        seg,
        scale,
        scaleY,
        x: W / 2 + scale * (x - camX),
        y: horizon - scaleY * (seg.y - camY),
        w: scale * ROAD_W * seg.width,
        theta: thetaAt(track, seg.index),
      });
    } else points.push(null);
    x += dx;
    dx += seg.curve * CURVE_SCALE;
  }

  const finishIndex = Math.floor(track.finishZ / SEGMENT_LENGTH);
  const sprites = [];
  for (let n = points.length - 2; n >= 0; n -= 1) {
    const a = points[n];
    const b = points[n + 1];
    if (!a || !b) continue;
    drawStrip(ctx, a, b, theme, view, n < 45);
    const seg = a.seg;
    if (seg.index === finishIndex) {
      const cells = 8;
      for (let i = 0; i < cells; i += 1) {
        ctx.fillStyle = i % 2 ? '#ffffff' : '#1d1d1d';
        const u1 = (-1 + (2 * i) / cells) * a.theta * 0.75;
        const u2 = (-1 + (2 * (i + 1)) / cells) * a.theta * 0.75;
        ctx.beginPath();
        ctx.moveTo(...sectionPoint(a, u1));
        ctx.lineTo(...sectionPoint(b, u1));
        ctx.lineTo(...sectionPoint(b, u2));
        ctx.lineTo(...sectionPoint(a, u2));
        ctx.fill();
      }
      sprites.push({ n, draw: () => drawArch(ctx, a, theme) });
    }
    for (const item of seg.items) {
      if (item.type === 'boost') drawBoost(ctx, a, b, item.x);
      else if (item.type === 'ramp') drawRamp(ctx, a, b);
      else if (item.type === 'float') {
        // Misma proyección lateral que el jugador: la colisión coincide con lo que se ve.
        const fx = a.x + item.x * a.w;
        const fy = a.y - lift(a, item.x);
        sprites.push({ n, draw: () => drawFloat(ctx, fx, fy, FLOAT_HALF * a.w) });
      }
    }
  }

  for (const rival of race.rivals) {
    const ahead = rival.z - camZ;
    if (ahead < 1 || ahead > DRAW_SEGMENTS * SEGMENT_LENGTH) continue;
    const n = Math.floor((rival.z - startIndex * SEGMENT_LENGTH) / SEGMENT_LENGTH);
    const p = points[n];
    if (!p) continue;
    sprites.push({
      n,
      z: rival.z,
      draw: () =>
        drawRider(ctx, p.x + rival.x * p.w, p.y - lift(p, rival.x), PLAYER_HALF * p.w * 1.3, rival.color, rival.x * 0.35, n < 40 ? rival.name : null, 0, view.sprites),
    });
  }
  sprites.sort((s1, s2) => s2.n - s1.n || (s2.z ?? 0) - (s1.z ?? 0)).forEach((sprite) => sprite.draw());

  // Jugador, interpolado a su profundidad exacta dentro del segmento.
  const along = (player.z - startIndex * SEGMENT_LENGTH) / SEGMENT_LENGTH;
  const pn = Math.floor(along);
  const p1 = points[pn];
  const p2 = points[pn + 1] ?? p1;
  if (p1 && p2) {
    const t = along - pn;
    const lerp = (k) => p1[k] + (p2[k] - p1[k]) * t;
    const pp = { x: lerp('x'), y: lerp('y'), w: lerp('w'), scaleY: lerp('scaleY') };
    let px = pp.x + player.x * pp.w;
    let py = pp.y - lift(pp, player.x);
    // Dibujo algo mayor que la caja de colisión (PLAYER_HALF): se lee mejor y no penaliza.
    const half = PLAYER_HALF * pp.w * 1.3;
    let alpha = 1;
    if (player.air > 0) py -= Math.sin((1 - player.air / 0.85) * Math.PI) * half * 2.4;
    if (player.falling > 0) {
      const k = 1 - player.falling / FALL_TIME;
      px += Math.sign(player.x || 1) * half * 3.5 * Math.min(1, k * 2);
      py += half * 5 * k * k;
      alpha = Math.max(0, 1 - k * 1.4);
      if (k > 0.45 && !view.splashed) {
        view.splashed = true;
        view.splashes.push({ x: px, y: py, t: 0, size: half * 2 });
      }
    } else view.splashed = false;

    if (player.falling <= 0 && player.air <= 0 && player.speed > 16) {
      ctx.fillStyle = 'rgb(255 255 255 / 0.6)';
      for (let i = 0; i < 7; i += 1) {
        const wobble = Math.sin(view.time * 24 + i * 1.7) * half * 0.12;
        ctx.beginPath();
        ctx.arc(px + (i - 3) * half * 0.26 + wobble, py + half * 0.62 + (i % 2) * half * 0.08, half * (0.07 + (i % 3) * 0.025), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = alpha;
    drawRider(ctx, px, py, half, '#ffd166', player.steer * 0.22, null, view.bump, view.sprites);
    ctx.globalAlpha = 1;
    if (player.boost > 0) {
      ctx.strokeStyle = 'rgb(255 209 102 / 0.75)';
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(2, half * 0.08);
      for (let i = 0; i < 5; i += 1) {
        const lx = px + (i - 2) * half * 0.6;
        ctx.beginPath();
        ctx.moveTo(lx, py + half * 0.9);
        ctx.lineTo(lx, py + half * (1.5 + (i % 2) * 0.5));
        ctx.stroke();
      }
    }
  }

  view.splashes = view.splashes.filter((s) => s.t < 1);
  for (const splash of view.splashes) {
    splash.t += dt * 1.6;
    ctx.strokeStyle = `rgb(255 255 255 / ${1 - splash.t})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(splash.x, splash.y, splash.size * (0.5 + splash.t * 1.5), splash.size * (0.2 + splash.t * 0.5), 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = `rgb(255 255 255 / ${0.8 - splash.t * 0.8})`;
    for (let i = 0; i < 9; i += 1) {
      const angle = Math.PI + (i / 8) * Math.PI;
      const r = splash.size * splash.t * 1.4;
      ctx.beginPath();
      ctx.arc(splash.x + Math.cos(angle) * r, splash.y + Math.sin(angle) * r * 1.4 - splash.t * splash.size, splash.size * 0.06, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}
