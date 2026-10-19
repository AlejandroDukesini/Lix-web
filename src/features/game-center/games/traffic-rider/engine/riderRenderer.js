/**
 * Dibujo de Traffic Rider en Canvas 2D: carretera en perspectiva (2,5D) vista
 * desde detrás de la moto.
 *
 * Proyección: un punto a `dz` metros por delante de la cámara y desplazado `x`
 * metros se dibuja a escala F/dz. La cámara se ajusta a la pantalla para que la
 * carretera, a la altura de la moto, ocupe ~90 % del ancho y la moto quede por
 * encima de la franja de controles táctiles (`bottomInset`): lo que viene de
 * frente siempre se ve por encima de los botones.
 *
 * Dirección artística: «road movie» ilustrada. Cada escenario tiene su cielo,
 * su horizonte en capas con paralaje (colinas, dunas, acantilados o rascacielos
 * con ventanas encendidas), su vegetación o mobiliario de borde y una bruma que
 * da profundidad. Los vehículos y la moto son sprites detallados vistos desde
 * atrás (lunas, pilotos, matrícula, paragolpes, ruedas), pintados una vez y
 * escalados con la perspectiva. Las cajas de choque no cambian: los sprites
 * ocupan el ancho y alto del motor.
 *
 * Las curvas son solo visuales (desplazan el dibujo); la física es recta, como
 * en Aquapark.
 */
import { LANES, LANE_W, PHYSICS, ROAD_HALF, sceneAt } from './riderEngine.js';
import { createSpriteCache } from '../../../render/sprites.js';
import { createQualityMonitor } from '../../../render/quality.js';
import { contactShadow, glow, roundRect, seeded, vGradient } from '../../../render/paint.js';

const CAM_BACK = 7; // metros entre la cámara y la moto
const CAM_FOLLOW = 0.3; // fracción del movimiento lateral de la moto que sigue la cámara
const DRAW_DIST = 240;
const SEG = 6;
const PX_PER_M = 48; // resolución de los sprites de vehículos

const PALETTES = {
  afueras: { skyTop: '#4ea6f5', skyBottom: '#d6efff', haze: '214 236 255', grass: ['#6dbb5a', '#63b051'], road: '#545866', shoulder: ['#e8e8e8', '#d1495b'], line: '#ffffff', sun: '#fff7cf', hills: ['#8fc7a0', '#6fae7c', '#57985f'] },
  costa: { skyTop: '#f57a5c', skyBottom: '#ffd7a0', haze: '255 214 170', grass: ['#e7c98f', '#dcbc80'], road: '#5b5560', shoulder: ['#ffffff', '#3a7bd5'], line: '#fff6e2', sun: '#fff0b5', hills: ['#c98b8f', '#9c6f86', '#3f7fa8'] },
  desierto: { skyTop: '#ee9c4e', skyBottom: '#ffe3a8', haze: '255 226 175', grass: ['#e3b16a', '#d9a55c'], road: '#6a5d58', shoulder: ['#ffffff', '#e0702c'], line: '#fff1cc', sun: '#fffbe0', hills: ['#e2a77a', '#cf8a5e', '#b8714a'] },
  ciudad: { skyTop: '#0d1130', skyBottom: '#3a3266', haze: '70 60 120', grass: ['#2c3048', '#262a40'], road: '#3c4052', shoulder: ['#c7c9d1', '#ffb347'], line: '#ffe9a8', sun: '#f4f1ff', hills: ['#2a2d55', '#20234a', '#171a3a'] },
};
const CAR_COLORS = ['#ff6f91', '#5fb4ff', '#ffc65c', '#5fd6a0', '#b28cff', '#eef0f5', '#ff9f5c'];

export function createRenderState() {
  return { time: 0, reduced: false, sprites: createSpriteCache(90), quality: createQualityMonitor() };
}

export function disposeRenderState(view) {
  view.sprites?.clear();
}

/** Curvatura visual de la carretera según la distancia (suave). */
const curveAt = (z) => 0.0011 * Math.sin(z / 420) + 0.0006 * Math.sin(z / 170);

export function cameraFor(size, bottomInset) {
  const horizon = Math.round(size.height * 0.36);
  const roadPx = Math.min(size.width * 0.92, size.height * 1.3);
  const bikeScale = roadPx / (ROAD_HALF * 2); // px por metro a la distancia de la moto
  const F = bikeScale * CAM_BACK;
  // La moto queda por encima de los controles y nunca pegada al borde inferior: en
  // vertical, hacia el 72 % del alto (se ve la carretera por delante y la moto entera).
  const portrait = size.height > size.width * 1.15;
  const bikeY = Math.min(size.height - bottomInset - 24, size.height * (portrait ? 0.72 : 0.84));
  const camH = Math.max(0.8, (bikeY - horizon) / bikeScale);
  return { horizon, F, camH, bikeY, bikeScale };
}

/** Inclinación de la moto (radianes, positivo = hacia la derecha en pantalla). */
export const leanFor = (bike) => (bike.vx / PHYSICS.lateralMax) * 0.32;

/** Posición horizontal de la moto en pantalla (sin la curva visual): crece al girar a la derecha. */
export function bikeScreenX(size, bike, bottomInset = 0) {
  const cam = cameraFor(size, bottomInset);
  return size.width / 2 + (bike.x - bike.x * CAM_FOLLOW) * (cam.F / CAM_BACK);
}

// ------------------------------------------------------------ horizonte

/** Franja de horizonte que se repite en horizontal (W px de ancho, H de alto). */
function paintSkyline(ctx, W, H, sceneId, layer, colors) {
  const rand = seeded(layer * 41 + sceneId.length * 7);
  const color = colors[layer];
  if (sceneId === 'ciudad') {
    // Rascacielos con ventanas encendidas y antenas con luz.
    let x = 0;
    while (x < W) {
      const bw = 26 + rand() * 46;
      const bh = H * (0.3 + rand() * (0.55 + layer * 0.12));
      ctx.fillStyle = color;
      ctx.fillRect(x, H - bh, bw, bh);
      if (layer > 0) {
        const lit = layer === 2 ? 0.5 : 0.3;
        for (let wy = H - bh + 6; wy < H - 6; wy += 9) {
          for (let wx = x + 5; wx < x + bw - 6; wx += 8) {
            if (rand() > lit) continue;
            ctx.fillStyle = rand() < 0.8 ? 'rgba(255,214,120,0.85)' : 'rgba(170,220,255,0.8)';
            ctx.fillRect(wx, wy, 4, 5);
          }
        }
      }
      if (rand() < 0.3) {
        ctx.fillStyle = color;
        ctx.fillRect(x + bw / 2 - 1, H - bh - 12, 2, 12);
        ctx.fillStyle = '#ff4a5e';
        ctx.fillRect(x + bw / 2 - 2, H - bh - 14, 4, 3);
      }
      x += bw + rand() * 6;
    }
    return;
  }
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, H);
  const peaks = sceneId === 'desierto' ? 4 : sceneId === 'costa' ? 3 : 5;
  const amp = H * (0.45 + layer * 0.12);
  const base = H * (0.95 - layer * 0.08);
  // Curva periódica: el final enlaza con el principio (sin costura al repetir).
  for (let x = 0; x <= W; x += 6) {
    const t = (x / W) * Math.PI * 2;
    let y = Math.sin(t * peaks + layer) * 0.5 + Math.sin(t * (peaks * 2 + 1) + layer * 2) * 0.2;
    if (sceneId === 'costa' && layer === 2) y = -0.6; // el mar, plano
    ctx.lineTo(x, base - amp * (0.5 + y * 0.5));
  }
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fill();
  if (sceneId === 'costa' && layer === 2) {
    // Destellos del sol sobre el mar.
    ctx.fillStyle = 'rgba(255,240,200,0.55)';
    for (let i = 0; i < 40; i += 1) ctx.fillRect(rand() * W, base - amp * 0.2 + rand() * (H - base + amp * 0.2), 6 + rand() * 10, 1.5);
  }
  if (sceneId === 'afueras' && layer === 2) {
    // Bosquecillos sobre las colinas cercanas.
    for (let i = 0; i < 26; i += 1) {
      const tx = rand() * W;
      const t = (tx / W) * Math.PI * 2;
      const y = base - amp * (0.5 + (Math.sin(t * peaks + layer) * 0.5 + Math.sin(t * (peaks * 2 + 1) + layer * 2) * 0.2) * 0.5);
      ctx.fillStyle = '#3f7e47';
      ctx.beginPath();
      ctx.arc(tx, y + 2, 4 + rand() * 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function paintCloud(ctx, W, H) {
  const puffs = [
    [0.25, 0.62, 0.22],
    [0.45, 0.45, 0.3],
    [0.68, 0.55, 0.24],
    [0.84, 0.66, 0.15],
  ];
  for (const [x, y, r] of puffs) {
    const g = ctx.createRadialGradient(W * x, H * y - H * r * 0.3, 0, W * x, H * y, W * r);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.7, 'rgba(255,255,255,0.75)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(W * x, H * y, W * r, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ------------------------------------------------------------ borde

/** Objetos de borde, anclados abajo al centro. Tamaño en metros: w×h. */
const PROPS = {
  afueras: { w: 4, h: 6 },
  costa: { w: 4, h: 7 },
  desierto: { w: 2.4, h: 4 },
  ciudad: { w: 2, h: 7 },
};

function paintProp(ctx, W, H, sceneId) {
  const cx = W / 2;
  if (sceneId === 'afueras') {
    contactShadow(ctx, cx, H * 0.97, W * 0.4, H * 0.04, 0.3);
    ctx.fillStyle = vGradient(ctx, H * 0.55, H, [
      [0, '#8a643f'],
      [1, '#5a3d22'],
    ]);
    ctx.fillRect(cx - W * 0.05, H * 0.55, W * 0.1, H * 0.43);
    for (const [x, y, r, c] of [
      [0.5, 0.42, 0.36, '#3f8a4c'],
      [0.32, 0.5, 0.24, '#357a40'],
      [0.68, 0.5, 0.25, '#357a40'],
      [0.5, 0.25, 0.27, '#4f9c5a'],
    ]) {
      const g = ctx.createRadialGradient(W * (x - 0.1), H * (y - 0.08), 1, W * x, H * y, W * r);
      g.addColorStop(0, '#8fd17a');
      g.addColorStop(1, c);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(W * x, H * y, W * r, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (sceneId === 'costa') {
    // Palmera.
    contactShadow(ctx, cx, H * 0.97, W * 0.3, H * 0.03, 0.3);
    ctx.strokeStyle = '#8a6a44';
    ctx.lineWidth = W * 0.07;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, H * 0.98);
    ctx.quadraticCurveTo(cx + W * 0.12, H * 0.55, cx - W * 0.05, H * 0.2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(60,40,20,0.4)';
    ctx.lineWidth = 1.5;
    for (let k = 0.3; k < 0.95; k += 0.07) {
      const y = H * k;
      ctx.beginPath();
      ctx.moveTo(cx - W * 0.03, y);
      ctx.lineTo(cx + W * 0.05, y - 2);
      ctx.stroke();
    }
    ctx.fillStyle = '#2e8b6e';
    for (let i = 0; i < 7; i += 1) {
      const a = -Math.PI / 2 + (i - 3) * 0.5;
      ctx.save();
      ctx.translate(cx - W * 0.05, H * 0.2);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.ellipse(W * 0.22, 0, W * 0.24, H * 0.035, 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  } else if (sceneId === 'desierto') {
    // Cactus saguaro.
    contactShadow(ctx, cx, H * 0.97, W * 0.35, H * 0.04, 0.3);
    const body = (x, y, w, h) => {
      const g = ctx.createLinearGradient(x, 0, x + w, 0);
      g.addColorStop(0, '#7dbb6f');
      g.addColorStop(1, '#3f7a44');
      ctx.fillStyle = g;
      roundRect(ctx, x, y, w, h, w / 2);
      ctx.fill();
    };
    body(cx - W * 0.1, H * 0.1, W * 0.2, H * 0.88);
    body(cx - W * 0.42, H * 0.35, W * 0.16, H * 0.3);
    body(cx - W * 0.42, H * 0.55, W * 0.36, H * 0.1);
    body(cx + W * 0.26, H * 0.25, W * 0.16, H * 0.3);
    body(cx + W * 0.06, H * 0.47, W * 0.36, H * 0.1);
  } else {
    // Farola.
    ctx.fillStyle = vGradient(ctx, 0, H, [
      [0, '#9aa0b8'],
      [1, '#5f6478'],
    ]);
    ctx.fillRect(cx - W * 0.05, H * 0.1, W * 0.1, H * 0.9);
    ctx.fillRect(cx - W * 0.05, H * 0.08, W * 0.4, W * 0.08);
    ctx.fillStyle = '#ffe7a8';
    roundRect(ctx, cx + W * 0.2, H * 0.08, W * 0.25, W * 0.12, W * 0.04);
    ctx.fill();
  }
}

// ------------------------------------------------------------ vehículos

/** Trasera de un vehículo: ocupa exactamente w×h metros (escalado a PX_PER_M). */
function paintVehicle(ctx, W, H, kind, color, night) {
  const r = Math.min(W, H) * 0.12;
  // Ruedas que asoman por debajo.
  ctx.fillStyle = '#16151c';
  for (const x of [0.04, 0.78]) {
    roundRect(ctx, W * x, H * 0.82, W * 0.18, H * 0.18, r * 0.5);
    ctx.fill();
  }
  if (kind === 'truck') {
    // Caja con puertas traseras, bisagras y barras.
    ctx.fillStyle = vGradient(ctx, 0, H, [
      [0, '#ffffff'],
      [0.8, '#d5d9e4'],
      [1, '#a9afbf'],
    ]);
    roundRect(ctx, 0, 0, W, H * 0.86, r * 0.5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(60,70,90,0.45)';
    ctx.lineWidth = Math.max(1, W * 0.012);
    ctx.strokeRect(W * 0.06, H * 0.06, W * 0.88, H * 0.66);
    ctx.beginPath();
    ctx.moveTo(W / 2, H * 0.06);
    ctx.lineTo(W / 2, H * 0.72);
    ctx.stroke();
    for (const x of [0.3, 0.7]) {
      ctx.fillStyle = '#8a90a2';
      ctx.fillRect(W * x - W * 0.012, H * 0.1, W * 0.024, H * 0.58);
    }
    ctx.fillStyle = color;
    ctx.fillRect(W * 0.06, H * 0.44, W * 0.88, H * 0.05);
    // Paragolpes antiempotramiento.
    ctx.fillStyle = '#3a3c48';
    ctx.fillRect(W * 0.04, H * 0.8, W * 0.92, H * 0.05);
  } else if (kind === 'bus') {
    ctx.fillStyle = vGradient(ctx, 0, H, [
      [0, '#ffd77a'],
      [1, '#e8a93a'],
    ]);
    roundRect(ctx, 0, 0, W, H * 0.86, r);
    ctx.fill();
    // Luna trasera y rejilla del motor.
    ctx.fillStyle = night ? '#141830' : vGradient(ctx, 0, H * 0.4, [
      [0, '#4a6a8f'],
      [1, '#1f2c44'],
    ]);
    roundRect(ctx, W * 0.08, H * 0.08, W * 0.84, H * 0.3, r * 0.5);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(W * 0.12, H * 0.1, W * 0.2, H * 0.04);
    ctx.fillStyle = 'rgba(80,50,10,0.35)';
    for (let k = 0; k < 6; k += 1) ctx.fillRect(W * 0.25, H * (0.5 + k * 0.035), W * 0.5, H * 0.015);
    ctx.fillStyle = '#3a3c48';
    ctx.fillRect(W * 0.03, H * 0.8, W * 0.94, H * 0.05);
  } else {
    // Turismo o furgoneta: carrocería, luna, maletero, paragolpes y matrícula.
    const roofH = kind === 'van' ? 0.42 : 0.38;
    ctx.fillStyle = vGradient(ctx, 0, H, [
      [0, color],
      [0.6, color],
      [1, 'rgba(0,0,0,0.35)'],
    ]);
    roundRect(ctx, W * 0.02, H * roofH * 0.5, W * 0.96, H * (0.86 - roofH * 0.5), r);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    roundRect(ctx, W * 0.02, H * 0.62, W * 0.96, H * 0.24, r);
    ctx.fill();
    // Techo y luna.
    ctx.fillStyle = color;
    roundRect(ctx, W * 0.12, 0, W * 0.76, H * roofH, r * 1.2);
    ctx.fill();
    ctx.fillStyle = night ? '#121628' : vGradient(ctx, 0, H * roofH, [
      [0, '#9cc3e4'],
      [1, '#36506f'],
    ]);
    roundRect(ctx, W * 0.17, H * 0.06, W * 0.66, H * (roofH - 0.1), r * 0.6);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.moveTo(W * 0.22, H * 0.08);
    ctx.lineTo(W * 0.34, H * 0.08);
    ctx.lineTo(W * 0.26, H * (roofH - 0.05));
    ctx.lineTo(W * 0.2, H * (roofH - 0.05));
    ctx.closePath();
    ctx.fill();
    // Brillo sobre la carrocería.
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(W * 0.06, H * (roofH + 0.04), W * 0.88, H * 0.04);
    // Matrícula.
    ctx.fillStyle = '#f4f4f0';
    roundRect(ctx, W * 0.36, H * 0.6, W * 0.28, H * 0.09, 2);
    ctx.fill();
    ctx.fillStyle = '#2b2f3e';
    ctx.fillRect(W * 0.4, H * 0.635, W * 0.2, H * 0.02);
    ctx.fillStyle = '#2a2c36';
    ctx.fillRect(W * 0.02, H * 0.76, W * 0.96, H * 0.07);
  }
  // Pilotos traseros.
  const lightY = kind === 'truck' || kind === 'bus' ? 0.7 : 0.5;
  for (const x of [0.05, 0.79]) {
    ctx.fillStyle = '#7a0d1a';
    roundRect(ctx, W * x, H * lightY, W * 0.16, H * 0.09, 3);
    ctx.fill();
    ctx.fillStyle = night ? '#ff4d5e' : '#e5484d';
    roundRect(ctx, W * x + 2, H * lightY + 2, W * 0.16 - 4, H * 0.09 - 4, 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,220,220,0.7)';
    ctx.fillRect(W * x + 3, H * lightY + 3, W * 0.05, H * 0.02);
  }
}

/** Moto y piloto vistos desde atrás (2 m de alto × 1,6 m de ancho). */
function paintBike(ctx, W, H, night) {
  const s = W / 1.6; // px por metro
  const cx = W / 2;
  const ground = H;
  // Rueda trasera.
  ctx.fillStyle = vGradient(ctx, ground - 0.75 * s, ground, [
    [0, '#3a3946'],
    [1, '#141319'],
  ]);
  roundRect(ctx, cx - 0.16 * s, ground - 0.75 * s, 0.32 * s, 0.75 * s, 0.14 * s);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(cx - 0.12 * s, ground - 0.7 * s, 0.04 * s, 0.6 * s);
  // Basculante y escapes.
  ctx.fillStyle = '#4a4b58';
  ctx.fillRect(cx - 0.26 * s, ground - 0.7 * s, 0.07 * s, 0.32 * s);
  ctx.fillRect(cx + 0.19 * s, ground - 0.7 * s, 0.07 * s, 0.32 * s);
  for (const k of [-1, 1]) {
    const ex = cx + k * 0.33 * s;
    ctx.fillStyle = vGradient(ctx, ground - 0.62 * s, ground - 0.42 * s, [
      [0, '#e9ecf3'],
      [1, '#8d93a5'],
    ]);
    roundRect(ctx, ex - 0.08 * s, ground - 0.66 * s, 0.16 * s, 0.24 * s, 0.07 * s);
    ctx.fill();
    ctx.fillStyle = '#1a1a22';
    ctx.beginPath();
    ctx.ellipse(ex, ground - 0.5 * s, 0.045 * s, 0.06 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Colín carenado.
  ctx.fillStyle = vGradient(ctx, ground - 1.3 * s, ground - 0.65 * s, [
    [0, '#ff8a98'],
    [0.5, '#ff4f66'],
    [1, '#b61f37'],
  ]);
  ctx.beginPath();
  ctx.moveTo(cx - 0.36 * s, ground - 0.72 * s);
  ctx.quadraticCurveTo(cx - 0.42 * s, ground - 1.2 * s, cx - 0.18 * s, ground - 1.28 * s);
  ctx.lineTo(cx + 0.18 * s, ground - 1.28 * s);
  ctx.quadraticCurveTo(cx + 0.42 * s, ground - 1.2 * s, cx + 0.36 * s, ground - 0.72 * s);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(60,0,10,0.5)';
  ctx.lineWidth = Math.max(1, 0.02 * s);
  ctx.stroke();
  // Piloto trasero y matrícula.
  ctx.fillStyle = night ? '#ff5468' : '#e8364f';
  roundRect(ctx, cx - 0.16 * s, ground - 0.92 * s, 0.32 * s, 0.09 * s, 0.04 * s);
  ctx.fill();
  ctx.fillStyle = '#f4f4f0';
  ctx.fillRect(cx - 0.11 * s, ground - 0.8 * s, 0.22 * s, 0.1 * s);
  // Piloto: chaqueta con franjas, brazos hacia el manillar.
  ctx.fillStyle = vGradient(ctx, ground - 2 * s, ground - 1.1 * s, [
    [0, '#3b4f8f'],
    [1, '#1d2a55'],
  ]);
  ctx.beginPath();
  ctx.moveTo(cx - 0.32 * s, ground - 1.15 * s);
  ctx.quadraticCurveTo(cx - 0.38 * s, ground - 1.85 * s, cx - 0.18 * s, ground - 1.95 * s);
  ctx.lineTo(cx + 0.18 * s, ground - 1.95 * s);
  ctx.quadraticCurveTo(cx + 0.38 * s, ground - 1.85 * s, cx + 0.32 * s, ground - 1.15 * s);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(cx - 0.035 * s, ground - 1.92 * s, 0.07 * s, 0.75 * s);
  ctx.fillStyle = '#5fb4ff';
  ctx.fillRect(cx - 0.3 * s, ground - 1.5 * s, 0.6 * s, 0.05 * s);
  // Brazos.
  ctx.strokeStyle = '#25336a';
  ctx.lineWidth = 0.13 * s;
  ctx.lineCap = 'round';
  for (const k of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + k * 0.28 * s, ground - 1.82 * s);
    ctx.lineTo(cx + k * 0.48 * s, ground - 1.45 * s);
    ctx.stroke();
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(cx + k * 0.5 * s, ground - 1.42 * s, 0.07 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  // Casco con visera y reflejo.
  const helmet = ctx.createRadialGradient(cx - 0.08 * s, ground - 2.25 * s, 0.02 * s, cx, ground - 2.15 * s, 0.3 * s);
  helmet.addColorStop(0, '#ffffff');
  helmet.addColorStop(0.7, '#e6e9f2');
  helmet.addColorStop(1, '#a9afc2');
  ctx.fillStyle = helmet;
  ctx.beginPath();
  ctx.arc(cx, ground - 2.15 * s, 0.28 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#5fb4ff';
  ctx.fillRect(cx - 0.28 * s, ground - 2.2 * s, 0.56 * s, 0.07 * s);
  ctx.fillStyle = '#ff4f66';
  ctx.fillRect(cx - 0.03 * s, ground - 2.42 * s, 0.06 * s, 0.25 * s);
}

// ------------------------------------------------------------ escena

export function renderRide(ctx, size, state, view, bottomInset, dt) {
  if (!ctx || !size.width) return;
  view.time += dt;
  view.quality?.sample(dt);
  view.sprites ??= createSpriteCache(90);
  const sprites = view.sprites;
  const dpr = size.dpr || 1;
  const { width: w, height: h } = size;
  const cam = cameraFor(size, bottomInset);
  const { bike } = state;
  const scene = sceneAt(bike.z);
  const P = PALETTES[scene.id];
  const night = scene.id === 'ciudad';
  const camZ = bike.z - CAM_BACK;
  // La cámara sigue solo un poco el movimiento lateral: así la moto se desplaza en
  // pantalla hacia donde se gira.
  const camX = bike.x * CAM_FOLLOW;
  const cx = w / 2;

  // Cielo.
  ctx.fillStyle = vGradient(ctx, 0, cam.horizon, [
    [0, P.skyTop],
    [1, P.skyBottom],
  ]);
  ctx.fillRect(0, 0, w, cam.horizon + 1);
  if (night) {
    // Estrellas fijas.
    const rand = seeded(5);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < 50; i += 1) ctx.fillRect(rand() * w, rand() * cam.horizon * 0.7, 1.5, 1.5);
  }
  // Sol (o luna) con halo.
  const sunR = Math.min(w, h) * 0.05;
  const sunX = w * 0.76;
  const sunY = cam.horizon * (scene.id === 'costa' ? 0.75 : 0.42);
  glow(ctx, sunX, sunY, sunR * 4, `${P.sun}`, night ? 0.25 : 0.45);
  ctx.fillStyle = P.sun;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.fill();
  // Nubes a la deriva (de día).
  if (!night) {
    const cloud = sprites.get('cloud', 220, 80, paintCloud, 1);
    for (let i = 0; i < 3; i += 1) {
      const span = w + 260;
      const x = ((((i * 0.37 * span - view.time * (6 + i * 3) - bike.z * 0.01) % span) + span) % span) - 240;
      const y = cam.horizon * (0.12 + i * 0.16);
      const k = 0.6 + i * 0.25;
      ctx.globalAlpha = 0.7;
      ctx.drawImage(cloud.canvas, x, y, 220 * k, 80 * k);
    }
    ctx.globalAlpha = 1;
  }

  // Horizonte en tres capas con paralaje.
  const stripW = 900;
  for (let layer = 0; layer < 3; layer += 1) {
    const stripH = Math.max(30, cam.horizon * (0.22 + layer * 0.06));
    const strip = sprites.get(`sky-${scene.id}-${layer}`, stripW, stripH, (c, sw, sh) => paintSkyline(c, sw, sh, scene.id, layer, P.hills), dpr > 1 ? 1.5 : 1);
    const speed = 0.004 + layer * 0.006;
    const shift = (((bike.z * speed + camX * (layer + 1) * 4) % stripW) + stripW) % stripW;
    for (let x = -shift; x < w; x += stripW) ctx.drawImage(strip.canvas, x, cam.horizon - stripH + 1, stripW, stripH);
  }
  ctx.fillStyle = P.grass[0];
  ctx.fillRect(0, cam.horizon, w, h - cam.horizon);

  // Proyección de un punto (x lateral, z absoluto) a pantalla.
  let curveOffset = 0;
  const project = (x, z) => {
    const dz = z - camZ;
    const scale = cam.F / dz;
    const c = curveAt(camZ);
    curveOffset = c * dz * dz * 0.5;
    return { sx: cx + (x - camX + curveOffset) * scale, sy: cam.horizon + cam.camH * scale, scale };
  };

  // Carretera: de lejos a cerca, por tramos.
  // El primer tramo empieza en el que contiene a la cámara (recortado delante de ella):
  // antes se saltaba y entre la cámara y el siguiente múltiplo de SEG se veía el césped,
  // un hueco que cambiaba en cada fotograma justo bajo la moto (parpadeo).
  const startZ = Math.floor(camZ / SEG) * SEG;
  const props = [];
  for (let z = startZ + DRAW_DIST; z >= startZ; z -= SEG) {
    const far = project(0, z + SEG);
    const near = project(0, Math.max(camZ + 0.8, z));
    if (near.sy <= far.sy) continue;
    const stripe = Math.floor(z / (SEG * 2)) % 2;
    const quad = (xFar, xNear, wFar, wNear, color) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(xFar - wFar, far.sy);
      ctx.lineTo(xFar + wFar, far.sy);
      // +1 px: los tramos se solapan y el antialiasing no deja una costura clara entre ellos.
      ctx.lineTo(xNear + wNear, near.sy + 1);
      ctx.lineTo(xNear - wNear, near.sy + 1);
      ctx.closePath();
      ctx.fill();
    };
    ctx.fillStyle = P.grass[stripe];
    ctx.fillRect(0, far.sy, w, near.sy - far.sy + 1);
    quad(far.sx, near.sx, (ROAD_HALF + 0.9) * far.scale, (ROAD_HALF + 0.9) * near.scale, P.shoulder[stripe]);
    quad(far.sx, near.sx, ROAD_HALF * far.scale, ROAD_HALF * near.scale, P.road);
    // Asfalto: franjas de rodadura algo más oscuras en el centro de cada carril.
    ctx.fillStyle = 'rgba(0,0,0,0.07)';
    for (let k = 0; k < LANES; k += 1) {
      const lx = -ROAD_HALF + (k + 0.5) * LANE_W;
      ctx.beginPath();
      ctx.moveTo(far.sx + (lx - 0.5) * far.scale, far.sy);
      ctx.lineTo(far.sx + (lx + 0.5) * far.scale, far.sy);
      ctx.lineTo(near.sx + (lx + 0.5) * near.scale, near.sy);
      ctx.lineTo(near.sx + (lx - 0.5) * near.scale, near.sy);
      ctx.closePath();
      ctx.fill();
    }
    // Líneas de borde continuas.
    ctx.fillStyle = P.line;
    for (const side of [-1, 1]) {
      const ex = side * (ROAD_HALF - 0.15);
      ctx.beginPath();
      ctx.moveTo(far.sx + (ex - 0.06) * far.scale, far.sy);
      ctx.lineTo(far.sx + (ex + 0.06) * far.scale, far.sy);
      ctx.lineTo(near.sx + (ex + 0.06) * near.scale, near.sy + 1);
      ctx.lineTo(near.sx + (ex - 0.06) * near.scale, near.sy + 1);
      ctx.closePath();
      ctx.fill();
    }
    if (stripe === 0) {
      for (let k = 1; k < LANES; k += 1) {
        const lx = -ROAD_HALF + k * LANE_W;
        ctx.fillStyle = P.line;
        ctx.beginPath();
        ctx.moveTo(far.sx + (lx - 0.08) * far.scale, far.sy);
        ctx.lineTo(far.sx + (lx + 0.08) * far.scale, far.sy);
        ctx.lineTo(near.sx + (lx + 0.08) * near.scale, near.sy);
        ctx.lineTo(near.sx + (lx - 0.08) * near.scale, near.sy);
        ctx.closePath();
        ctx.fill();
      }
    }
    // Objetos del borde cada 24 m (se dibujan después, mezclados por profundidad con el tráfico).
    if (Math.floor(z) % 24 === 0 && z > camZ + 1) props.push(z);
  }

  // Bruma sobre el asfalto lejano: profundidad atmosférica barata.
  const hazeH = (h - cam.horizon) * 0.22;
  ctx.fillStyle = vGradient(ctx, cam.horizon, cam.horizon + hazeH, [
    [0, `rgb(${P.haze} / 0.55)`],
    [1, `rgb(${P.haze} / 0)`],
  ]);
  ctx.fillRect(0, cam.horizon, w, hazeH);

  // Objetos del borde y tráfico, de lejos a cerca.
  const ahead = state.traffic.filter((v) => v.z - v.length / 2 > camZ + 1);
  const drawables = [
    ...props.map((z) => ({ z, prop: true })),
    ...ahead.map((v) => ({ z: v.z - v.length / 2, v })),
  ].sort((a, b) => b.z - a.z);
  const propSize = PROPS[scene.id];
  const propSprite = sprites.get(`prop-${scene.id}`, propSize.w * 30, propSize.h * 30, (c, pw, ph) => paintProp(c, pw, ph, scene.id), dpr);
  for (const item of drawables) {
    if (item.prop) {
      for (const side of [-1, 1]) {
        const offset = side * (ROAD_HALF + 2.2 + propSize.w * 0.5 + (Math.floor(item.z / 24) % 3) * 0.8);
        const p = project(offset, item.z);
        const pw = propSize.w * p.scale;
        const ph = propSize.h * p.scale;
        if (p.sx + pw < 0 || p.sx - pw > w) continue;
        // El sprite mira a la derecha; en el lado derecho se refleja para que
        // farolas y palmeras se inclinen hacia la carretera.
        ctx.save();
        ctx.translate(p.sx, p.sy);
        if (side > 0) ctx.scale(-1, 1);
        ctx.drawImage(propSprite.canvas, -pw / 2, -ph, pw, ph);
        ctx.restore();
        if (night) glow(ctx, p.sx - side * pw * 0.32, p.sy - ph * 0.9, ph * 0.35, 'rgba(255,214,140,0.5)', 0.8);
      }
      continue;
    }
    const v = item.v;
    const p = project(v.x, item.z);
    const s = p.scale;
    const vw = v.width * s;
    const vh = v.height * s;
    contactShadow(ctx, p.sx, p.sy, vw * 0.62, Math.max(2, vh * 0.1), 0.4);
    const color = v.kind === 'truck' ? CAR_COLORS[v.id % CAR_COLORS.length] : v.kind === 'bus' ? '#ffc65c' : CAR_COLORS[v.id % CAR_COLORS.length];
    const sprite = sprites.get(`veh-${v.kind}-${color}-${night ? 'n' : 'd'}`, v.width * PX_PER_M, v.height * PX_PER_M, (c, sw, sh) => paintVehicle(c, sw, sh, v.kind, color, night), 1);
    ctx.drawImage(sprite.canvas, p.sx - vw / 2, p.sy - vh, vw, vh);
    if (night) {
      const ly = p.sy - vh * (v.kind === 'truck' || v.kind === 'bus' ? 0.26 : 0.46);
      glow(ctx, p.sx - vw * 0.37, ly, vw * 0.3, 'rgba(255,60,80,0.55)');
      glow(ctx, p.sx + vw * 0.37, ly, vw * 0.3, 'rgba(255,60,80,0.55)');
    }
  }

  // La moto: vista trasera, inclinada según el movimiento lateral.
  const bp = project(bike.x, bike.z);
  const s = bp.scale;
  const lean = leanFor(bike);
  contactShadow(ctx, bp.sx, bp.sy, 0.75 * s, 0.14 * s, 0.4);
  if (night) glow(ctx, bp.sx, bp.sy - 0.9 * s, 0.6 * s, 'rgba(255,70,90,0.6)');
  const bikeSprite = sprites.get(`bike-${night ? 'n' : 'd'}`, 1.6 * PX_PER_M, 2.5 * PX_PER_M, (c, bw, bh) => paintBike(c, bw, bh, night), 1);
  ctx.save();
  ctx.translate(bp.sx, bp.sy);
  // Inclinación hacia el lado del giro (en canvas, un ángulo positivo gira en sentido horario: hacia la derecha).
  ctx.rotate(lean);
  ctx.drawImage(bikeSprite.canvas, -0.8 * s, -2.5 * s, 1.6 * s, 2.5 * s);
  ctx.restore();

  // Líneas de velocidad discretas en los bordes (no con movimiento reducido).
  if (!view.reduced && bike.speed > 38) {
    const k = (bike.speed - 38) / (PHYSICS.maxSpeed - 38);
    ctx.strokeStyle = `rgba(255,255,255,${0.12 + k * 0.18})`;
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i += 1) {
      const t = (view.time * 2.4 + i / 6) % 1;
      const side = i % 2 ? 1 : -1;
      const x = cx + side * w * (0.38 + t * 0.2);
      const y = cam.horizon + (h - cam.horizon) * (0.2 + t * 0.7);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + side * w * 0.05, y + h * 0.05);
      ctx.stroke();
    }
  }
}
