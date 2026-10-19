/**
 * Dibujo de «Aparcar el carro» en Canvas 2D (vista cenital).
 *
 * El aparcamiento entero cabe en la zona libre del lienzo: se descuentan los
 * márgenes que ocupan el marcador y los controles táctiles (`insets`), así que
 * los botones nunca tapan la plaza ni los obstáculos. Las formas que se dibujan
 * son exactamente los rectángulos del motor: lo que se ve es lo que choca (las
 * sombras quedan fuera, desplazadas, y no cuentan).
 *
 * Dirección artística: aparcamiento de barrio a media tarde. Asfalto con grano
 * y manchas, pintura de plazas gastada, acera de baldosas alrededor, coches con
 * carrocería sombreada, lunas con reflejos y retrovisores, conos con franjas
 * reflectantes, jardineras de madera con arbustos y barreras de hormigón con
 * franjas de aviso. Todo se pinta una vez como sprite y se copia cada fotograma;
 * las ruedas delanteras y las luces (freno, marcha atrás) se dibujan en vivo.
 */
import { CAR, PARK_HOLD, corners } from './parkingEngine.js';
import { createSpriteCache } from '../../../render/sprites.js';
import { contactShadow, glow, hsl, roundRect, seeded, speckle } from '../../../render/paint.js';

const PX_PER_M = 36; // resolución de los sprites

export function createRenderState() {
  return { flash: 0, time: 0, sprites: createSpriteCache(60) };
}

export function disposeRenderState(view) {
  view.sprites?.clear();
}

export function viewFor(size, level, insets = {}) {
  const { top = 0, bottom = 0, left = 0, right = 0 } = insets;
  const pad = 10;
  const availW = size.width - left - right - pad * 2;
  const availH = size.height - top - bottom - pad * 2;
  const scale = Math.max(4, Math.min(availW / level.width, availH / level.height));
  return {
    scale,
    ox: left + pad + (availW - level.width * scale) / 2,
    oy: top + pad + (availH - level.height * scale) / 2,
  };
}

// ---------------------------------------------------------------- texturas

function paintAsphaltTile(ctx, w, h) {
  ctx.fillStyle = '#4b4f5d';
  ctx.fillRect(0, 0, w, h);
  const rand = seeded(12);
  speckle(ctx, 0, 0, w, h, 900, ['rgba(255,255,255,0.07)', 'rgba(0,0,0,0.12)', 'rgba(170,175,190,0.08)'], rand, [0.8, 1.8]);
  for (let i = 0; i < 3; i += 1) {
    const x = rand() * w;
    const y = rand() * h;
    const r = 18 + rand() * 26;
    for (const ox of [-w, 0, w]) {
      for (const oy of [-h, 0, h]) {
        const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
        g.addColorStop(0, 'rgba(20,20,30,0.18)');
        g.addColorStop(1, 'rgba(20,20,30,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
      }
    }
  }
}

function paintPavingTile(ctx, w, h) {
  // Baldosas de acera (2×2 por loseta) con juntas y algún brote de hierba.
  const n = 2;
  const t = w / n;
  const rand = seeded(4);
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      const l = 40 + rand() * 5;
      ctx.fillStyle = `hsl(30 8% ${l}%)`;
      ctx.fillRect(i * t, j * t, t, t);
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(i * t + 1, j * t + 1, t - 2, 2);
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.fillRect(i * t, j * t + t - 2, t, 2);
      ctx.fillRect(i * t + t - 2, j * t, 2, t);
    }
  }
  speckle(ctx, 0, 0, w, h, 120, ['rgba(0,0,0,0.08)', 'rgba(255,255,255,0.12)'], rand, [0.8, 1.5]);
  ctx.fillStyle = '#6a9f4e';
  for (let k = 0; k < 3; k += 1) ctx.fillRect(t - 2 + rand() * 2, rand() * h, 2, 3);
}

// ---------------------------------------------------------------- sprites

/** Coche visto desde arriba, mirando a +x, ocupando W×H (sin ruedas ni luces). */
function paintCarBody(ctx, W, H, color, dark) {
  const r = H * 0.3;
  // Carrocería: laterales más oscuros (curvatura), centro iluminado.
  const body = ctx.createLinearGradient(0, 0, 0, H);
  body.addColorStop(0, dark);
  body.addColorStop(0.18, color);
  body.addColorStop(0.5, color);
  body.addColorStop(0.82, color);
  body.addColorStop(1, dark);
  ctx.fillStyle = body;
  roundRect(ctx, 0, H * 0.04, W, H * 0.92, r);
  ctx.fill();
  ctx.strokeStyle = 'rgba(15,10,25,0.5)';
  ctx.lineWidth = Math.max(1, H * 0.025);
  ctx.stroke();
  // Capó y maletero: líneas de panel.
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = Math.max(0.8, H * 0.015);
  ctx.beginPath();
  ctx.moveTo(W * 0.72, H * 0.14);
  ctx.quadraticCurveTo(W * 0.68, H * 0.5, W * 0.72, H * 0.86);
  ctx.moveTo(W * 0.2, H * 0.14);
  ctx.quadraticCurveTo(W * 0.24, H * 0.5, W * 0.2, H * 0.86);
  ctx.moveTo(W * 0.86, H * 0.5);
  ctx.lineTo(W * 0.97, H * 0.5);
  ctx.stroke();
  // Habitáculo: techo con degradado y lunas.
  const roofX = W * 0.3;
  const roofW = W * 0.36;
  ctx.fillStyle = '#1d2433';
  roundRect(ctx, W * 0.22, H * 0.12, W * 0.52, H * 0.76, H * 0.18);
  ctx.fill();
  const glass = ctx.createLinearGradient(0, 0, W, H);
  glass.addColorStop(0, '#bfe4ff');
  glass.addColorStop(0.5, '#5d87ad');
  glass.addColorStop(1, '#2a4560');
  ctx.fillStyle = glass;
  // Parabrisas delantero (trapecio) y luneta.
  ctx.beginPath();
  ctx.moveTo(W * 0.66, H * 0.18);
  ctx.lineTo(W * 0.73, H * 0.14);
  ctx.lineTo(W * 0.73, H * 0.86);
  ctx.lineTo(W * 0.66, H * 0.82);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(W * 0.3, H * 0.2);
  ctx.lineTo(W * 0.23, H * 0.16);
  ctx.lineTo(W * 0.23, H * 0.84);
  ctx.lineTo(W * 0.3, H * 0.8);
  ctx.closePath();
  ctx.fill();
  // Ventanillas laterales.
  ctx.fillStyle = 'rgba(120,170,210,0.75)';
  ctx.fillRect(W * 0.32, H * 0.13, W * 0.32, H * 0.06);
  ctx.fillRect(W * 0.32, H * 0.81, W * 0.32, H * 0.06);
  // Techo.
  const roof = ctx.createLinearGradient(0, H * 0.2, 0, H * 0.8);
  roof.addColorStop(0, dark);
  roof.addColorStop(0.3, color);
  roof.addColorStop(1, dark);
  ctx.fillStyle = roof;
  roundRect(ctx, roofX, H * 0.2, roofW, H * 0.6, H * 0.12);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  roundRect(ctx, roofX + roofW * 0.1, H * 0.26, roofW * 0.7, H * 0.08, H * 0.04);
  ctx.fill();
  // Reflejo diagonal en el parabrisas.
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.moveTo(W * 0.685, H * 0.24);
  ctx.lineTo(W * 0.705, H * 0.22);
  ctx.lineTo(W * 0.705, H * 0.5);
  ctx.lineTo(W * 0.685, H * 0.54);
  ctx.closePath();
  ctx.fill();
  // Retrovisores.
  ctx.fillStyle = dark;
  for (const y of [0, H]) {
    ctx.beginPath();
    ctx.ellipse(W * 0.66, y === 0 ? H * 0.03 : H * 0.97, W * 0.025, H * 0.06, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Faros y pilotos apagados (las luces encendidas se dibujan encima).
  for (const fy of [0.2, 0.8]) {
    ctx.fillStyle = '#f4f1de';
    roundRect(ctx, W * 0.94, H * fy - H * 0.08, W * 0.045, H * 0.16, H * 0.04);
    ctx.fill();
    ctx.fillStyle = '#8c1d2a';
    roundRect(ctx, W * 0.01, H * fy - H * 0.08, W * 0.035, H * 0.16, H * 0.04);
    ctx.fill();
  }
}

function paintCone(ctx, W, H) {
  const c = W / 2;
  contactShadow(ctx, c + W * 0.08, c + W * 0.1, W * 0.48, W * 0.42, 0.4);
  // Base cuadrada.
  ctx.fillStyle = '#e8641a';
  roundRect(ctx, W * 0.08, H * 0.08, W * 0.84, H * 0.84, W * 0.14);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  roundRect(ctx, W * 0.08, H * 0.6, W * 0.84, H * 0.32, W * 0.12);
  ctx.fill();
  // Cono en anillos: naranja, reflectante blanco, naranja y punta.
  for (const [r, color] of [
    [0.36, '#ff7a1a'],
    [0.27, '#f5f5f5'],
    [0.2, '#ff7a1a'],
    [0.11, '#ffb27a'],
  ]) {
    const g = ctx.createRadialGradient(c - W * 0.08, c - W * 0.08, 0, c, c, W * r);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.25, color);
    g.addColorStop(1, color);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(c, c, W * r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintPlanter(ctx, W, H) {
  const rand = seeded(Math.round(W * 7 + H));
  contactShadow(ctx, W / 2 + W * 0.04, H / 2 + H * 0.08, W * 0.55, H * 0.55, 0.35);
  // Caja de madera con tablas.
  ctx.fillStyle = '#8a5f3a';
  roundRect(ctx, 0, 0, W, H, Math.min(W, H) * 0.08);
  ctx.fill();
  const plank = Math.max(6, Math.min(W, H) * 0.12);
  ctx.strokeStyle = 'rgba(50,30,15,0.45)';
  ctx.lineWidth = 1;
  for (let x = plank; x < W; x += plank * 2.2) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, plank);
    ctx.moveTo(x, H - plank);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,220,170,0.25)';
  ctx.fillRect(0, 0, W, plank * 0.3);
  // Tierra.
  ctx.fillStyle = '#4a3324';
  roundRect(ctx, plank, plank, W - plank * 2, H - plank * 2, plank * 0.4);
  ctx.fill();
  // Arbustos y flores.
  const bushes = Math.max(3, Math.round((W * H) / (plank * plank * 6)));
  for (let i = 0; i < bushes; i += 1) {
    const x = plank * 1.6 + rand() * (W - plank * 3.2);
    const y = plank * 1.6 + rand() * (H - plank * 3.2);
    const r = plank * (0.9 + rand() * 0.7);
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, 1, x, y, r);
    g.addColorStop(0, '#8fd17a');
    g.addColorStop(0.7, '#4f9e5c');
    g.addColorStop(1, '#2f6e3c');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    if (rand() < 0.6) {
      ctx.fillStyle = ['#ff8fab', '#ffd166', '#ffffff'][i % 3];
      ctx.beginPath();
      ctx.arc(x + r * 0.3, y - r * 0.2, r * 0.16, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function paintWall(ctx, W, H) {
  const rand = seeded(Math.round(W + H * 3));
  // Barrera de hormigón: cara superior clara con aristas y franjas de aviso.
  ctx.fillStyle = '#9da3ad';
  roundRect(ctx, 0, 0, W, H, Math.min(W, H) * 0.15);
  ctx.fill();
  const inset = Math.min(W, H) * 0.18;
  ctx.fillStyle = '#c5cad3';
  roundRect(ctx, inset, inset, W - inset * 2, H - inset * 2, Math.min(W, H) * 0.1);
  ctx.fill();
  speckle(ctx, 0, 0, W, H, (W * H) / 30, ['rgba(0,0,0,0.12)', 'rgba(255,255,255,0.2)'], rand, [0.8, 1.6]);
  ctx.save();
  roundRect(ctx, inset, inset, W - inset * 2, H - inset * 2, Math.min(W, H) * 0.1);
  ctx.clip();
  const band = Math.min(W, H) * 0.5;
  ctx.fillStyle = 'rgba(255,196,0,0.85)';
  for (let k = -H; k < W + H; k += band * 2) {
    ctx.beginPath();
    ctx.moveTo(k, 0);
    ctx.lineTo(k + band, 0);
    ctx.lineTo(k + band - H, H);
    ctx.lineTo(k - H, H);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- dibujo

/** Coche centrado en el origen, mirando a +x (unidades en píxeles de pantalla). */
function drawCar(ctx, view, length, width, color, { steer = 0, brake = false, reverse = false, lights = true, dpr = 1 } = {}) {
  // Sombra proyectada (abajo a la derecha, fuera de la caja de choque).
  ctx.fillStyle = 'rgba(10,10,20,0.35)';
  roundRect(ctx, -length / 2 + width * 0.08, -width / 2 + width * 0.14, length, width, width * 0.3);
  ctx.fill();
  // Ruedas (las delanteras giran con el volante).
  ctx.fillStyle = '#16151c';
  for (const [wx, front] of [[length * 0.3, true], [-length * 0.3, false]]) {
    for (const wy of [-width / 2 + width * 0.06, width / 2 - width * 0.06]) {
      ctx.save();
      ctx.translate(wx, wy);
      if (front) ctx.rotate(steer);
      roundRect(ctx, -length * 0.1, -width * 0.09, length * 0.2, width * 0.18, width * 0.05);
      ctx.fill();
      ctx.restore();
    }
  }
  const dark = shadeHsl(color);
  const sprite = view.sprites.get(`car${color}`, CAR.length * PX_PER_M, CAR.width * PX_PER_M, (c, w, h) => paintCarBody(c, w, h, color, dark), Math.min(2, dpr));
  ctx.drawImage(sprite.canvas, -length / 2, -width / 2, length, width);
  if (!lights) return;
  // Faros, luces de freno y de marcha atrás.
  for (const wy of [-width * 0.3, width * 0.3]) {
    if (brake || reverse) {
      glow(ctx, -length / 2 - width * 0.05, wy, width * 0.45, reverse ? 'rgba(255,255,255,0.7)' : 'rgba(255,40,60,0.75)');
      ctx.fillStyle = reverse ? '#ffffff' : '#ff3b4f';
      roundRect(ctx, -length / 2 + length * 0.01, wy - width * 0.08, length * 0.04, width * 0.16, width * 0.04);
      ctx.fill();
    }
    glow(ctx, length / 2 + width * 0.1, wy, width * 0.35, 'rgba(255,244,184,0.35)');
  }
}

/** Versión oscura de un color hsl(...) o hex para los laterales del coche. */
function shadeHsl(color) {
  const m = /hsl\((\d+)\s+(\d+)%\s+(\d+)%/.exec(color);
  if (m) return hsl(Number(m[1]), Number(m[2]), Number(m[3]) - 18);
  return 'rgba(0,0,0,0.35)';
}

function drawObstacle(ctx, view, o, s, dpr) {
  ctx.save();
  ctx.translate(o.x * s, o.y * s);
  ctx.rotate(o.angle ?? 0);
  const w = o.w * s;
  const h = o.h * s;
  if (o.kind === 'car') {
    drawCar(ctx, view, w, h, hsl(o.hue ?? 210, 45, 55), { lights: false, dpr });
  } else if (o.kind === 'cone') {
    const sprite = view.sprites.get('cone', 40, 40, paintCone, dpr);
    // El cono se dibuja algo mayor que su caja: la base cuadrada es la que choca.
    ctx.drawImage(sprite.canvas, -w * 0.6, -h * 0.6, w * 1.2, h * 1.2);
  } else if (o.kind === 'planter') {
    const sprite = view.sprites.get(`planter${o.w}x${o.h}`, o.w * PX_PER_M, o.h * PX_PER_M, paintPlanter, Math.min(2, dpr));
    ctx.drawImage(sprite.canvas, -w / 2, -h / 2, w, h);
  } else {
    ctx.fillStyle = 'rgba(10,10,20,0.3)';
    roundRect(ctx, -w / 2 + s * 0.15, -h / 2 + s * 0.2, w, h, s * 0.2);
    ctx.fill();
    const sprite = view.sprites.get(`wall${o.w}x${o.h}`, o.w * PX_PER_M, o.h * PX_PER_M, paintWall, Math.min(2, dpr));
    ctx.drawImage(sprite.canvas, -w / 2, -h / 2, w, h);
  }
  ctx.restore();
}

function drawSpot(ctx, spot, s, progress, time) {
  ctx.save();
  ctx.translate(spot.x * s, spot.y * s);
  ctx.rotate(spot.angle);
  const w = spot.w * s;
  const h = spot.h * s;
  // Plaza iluminada: degradado que se llena al mantener el coche dentro.
  const fill = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
  fill.addColorStop(0, `rgba(80, 220, 140, ${0.12 + progress * 0.3})`);
  fill.addColorStop(1, `rgba(80, 220, 140, ${0.22 + progress * 0.35})`);
  ctx.fillStyle = fill;
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.strokeStyle = 'rgba(92,227,154,0.35)';
  ctx.lineWidth = Math.max(6, s * 0.4);
  ctx.strokeRect(-w / 2, -h / 2, w, h);
  ctx.strokeStyle = '#5ce39a';
  ctx.lineWidth = Math.max(2, s * 0.12);
  ctx.setLineDash([s * 0.5, s * 0.35]);
  ctx.lineDashOffset = -time * s;
  ctx.strokeRect(-w / 2, -h / 2, w, h);
  ctx.setLineDash([]);
  // Flecha pintada: hacia dónde debe mirar el coche aparcado.
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.moveTo(w * 0.3, 0);
  ctx.lineTo(w * 0.05, -h * 0.28);
  ctx.lineTo(w * 0.05, -h * 0.1);
  ctx.lineTo(-w * 0.28, -h * 0.1);
  ctx.lineTo(-w * 0.28, h * 0.1);
  ctx.lineTo(w * 0.05, h * 0.1);
  ctx.lineTo(w * 0.05, h * 0.28);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function renderParking(ctx, size, state, view, input, insets, dt) {
  if (!ctx || !size.width) return;
  view.time += dt;
  view.flash = Math.max(0, view.flash - dt * 2.5);
  view.sprites ??= createSpriteCache(60);
  const dpr = size.dpr || 1;
  const { level, car } = state;
  const { scale: s, ox, oy } = viewFor(size, level, insets);
  const lotW = level.width * s;
  const lotH = level.height * s;

  // Acera de baldosas alrededor del aparcamiento.
  const paving = view.sprites.get('paving', 64, 64, paintPavingTile, 1);
  const pavingPattern = ctx.createPattern(paving.canvas, 'repeat');
  ctx.fillStyle = pavingPattern ?? '#b9b2a6';
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.save();
  ctx.translate(ox, oy);

  // Bordillo con sombra y asfalto con textura.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-s * 0.35 + 3, -s * 0.35 + 4, lotW + s * 0.7, lotH + s * 0.7);
  ctx.fillStyle = '#dfe1e7';
  ctx.fillRect(-s * 0.35, -s * 0.35, lotW + s * 0.7, lotH + s * 0.7);
  const asphalt = view.sprites.get('asphalt', 256, 256, paintAsphaltTile, 1);
  const asphaltPattern = ctx.createPattern(asphalt.canvas, 'repeat');
  ctx.fillStyle = asphaltPattern ?? '#4a4e5c';
  ctx.fillRect(0, 0, lotW, lotH);
  // Sombra interior del bordillo: el asfalto queda un escalón más bajo.
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = Math.max(2, s * 0.15);
  ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, lotW - ctx.lineWidth, lotH - ctx.lineWidth);

  // Líneas de las plazas ocupadas (pintura gastada).
  ctx.strokeStyle = 'rgba(255,255,255,0.42)';
  ctx.lineWidth = Math.max(1.5, s * 0.1);
  for (const o of level.obstacles.filter((ob) => ob.kind === 'car')) {
    ctx.save();
    ctx.translate(o.x * s, o.y * s);
    ctx.rotate(o.angle);
    ctx.strokeRect((-o.w / 2 - 0.4) * s, (-o.h / 2 - 0.5) * s, (o.w + 0.8) * s, (o.h + 1) * s);
    ctx.restore();
  }

  drawSpot(ctx, level.spot, s, Math.min(1, state.parkTimer / PARK_HOLD), view.time);
  for (const o of level.obstacles) drawObstacle(ctx, view, o, s, dpr);

  // El coche del jugador.
  const moving = Math.abs(car.speed) > 0.05;
  const braking = moving && input.throttle !== 0 && Math.sign(input.throttle) !== Math.sign(car.speed);
  ctx.save();
  ctx.translate(car.x * s, car.y * s);
  ctx.rotate(car.angle);
  drawCar(ctx, view, CAR.length * s, CAR.width * s, 'hsl(352 100% 66%)', {
    steer: car.steer,
    brake: braking || (!moving && input.throttle < 0 && car.speed === 0),
    reverse: car.speed < -0.05,
    dpr,
  });
  ctx.restore();

  // Anillo de «quieto un momento» al estar bien colocado.
  if (state.parkTimer > 0) {
    ctx.strokeStyle = '#5ce39a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(car.x * s, car.y * s, CAR.width * s * 0.9, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, state.parkTimer / PARK_HOLD));
    ctx.stroke();
  }
  ctx.restore();

  if (view.flash > 0) {
    ctx.fillStyle = `rgba(255, 60, 80, ${view.flash * 0.25})`;
    ctx.fillRect(0, 0, size.width, size.height);
  }
}

/** Esquinas del coche en pantalla (para pruebas visuales). */
export const carScreenCorners = (size, state, insets) => {
  const { scale, ox, oy } = viewFor(size, state.level, insets);
  return corners({ x: state.car.x, y: state.car.y, w: CAR.length, h: CAR.width, angle: state.car.angle }).map(([x, y]) => [ox + x * scale, oy + y * scale]);
};
