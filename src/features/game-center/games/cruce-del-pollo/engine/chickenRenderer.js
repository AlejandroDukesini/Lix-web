/**
 * Dibujo de «Pollo pasando la calle» en Canvas 2D (vista cenital con volumen).
 *
 * Dirección artística: diorama de granja en tarde soleada. Luz desde arriba a
 * la izquierda, así que cada objeto tiene cara superior iluminada, costado en
 * sombra y sombra de contacto hacia abajo a la derecha. Hierba con matas y
 * flores, asfalto con grano y bordillos, río con orillas de arena y reflejos,
 * troncos con corteza y anillos, coches, furgonetas y camiones con cristales,
 * faros y llantas, y una gallina con plumaje sombreado que se aplasta y estira
 * al saltar.
 *
 * Todo se pinta una vez en sprites (render/sprites.js) y se copia en cada
 * fotograma. Los objetos se colocan con las mismas x del motor: lo que se ve es
 * lo que choca (las sombras y adornos quedan fuera de la caja de choque).
 *
 * La derrota es caricaturesca: plumas que saltan, ojos en espiral y la gallina
 * aplastada como en los dibujos animados. Nada de imágenes realistas.
 */
import { COLS, chickenX, logicalRow } from './chickenEngine.js';
import { blit, createSpriteCache } from '../../../render/sprites.js';
import { createParticles } from '../../../render/particles.js';
import { createQualityMonitor } from '../../../render/quality.js';
import { contactShadow, hash, hsl, roundRect, seeded, speckle, vGradient } from '../../../render/paint.js';

const VISIBLE_ROWS = 11;

export function createRenderState() {
  return {
    camera: null,
    particles: createParticles(160),
    sprites: createSpriteCache(220),
    quality: createQualityMonitor(),
    time: 0,
    reduced: false,
    deathAt: null,
    impact: null,
    wasHopping: false,
  };
}

/** Libera los sprites (al salir del juego o reiniciar). */
export function disposeRenderState(view) {
  view.sprites.clear();
  view.particles.clear();
}

/** Geometría de la vista: tamaño de casilla y margen para centrar la cuadrícula. */
export function layoutFor(size) {
  const cell = Math.max(18, Math.min(size.width / COLS, size.height / VISIBLE_ROWS, 72));
  return { cell, left: (size.width - cell * COLS) / 2 };
}

// ---------------------------------------------------------------- terreno

const GRASS = [
  ['#86d06a', '#79c45e'],
  ['#7cc862', '#70bb57'],
];

function paintGrassStrip(ctx, w, h, parity, variant) {
  const [base, dark] = GRASS[parity];
  ctx.fillStyle = vGradient(ctx, 0, h, [
    [0, base],
    [1, dark],
  ]);
  ctx.fillRect(0, 0, w, h);
  const rand = seeded(variant * 97 + parity * 13 + 5);
  // Manchas de césped más claro y más oscuro (sin patrón repetido visible).
  for (let i = 0; i < 14; i += 1) {
    ctx.fillStyle = rand() < 0.5 ? 'rgba(255,255,210,0.07)' : 'rgba(20,70,20,0.07)';
    ctx.beginPath();
    ctx.ellipse(rand() * w, rand() * h, h * (0.3 + rand() * 0.5), h * (0.12 + rand() * 0.2), 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Briznas.
  ctx.lineCap = 'round';
  for (let i = 0; i < w / 4; i += 1) {
    const x = rand() * w;
    const y = h * 0.2 + rand() * h * 0.75;
    const len = h * (0.06 + rand() * 0.08);
    ctx.strokeStyle = rand() < 0.5 ? 'rgba(40,110,40,0.45)' : 'rgba(200,240,150,0.45)';
    ctx.lineWidth = Math.max(0.8, h * 0.018);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rand() - 0.5) * len, y - len);
    ctx.stroke();
  }
  // Borde inferior sombreado: la franja parece una terraza ligeramente elevada.
  ctx.fillStyle = 'rgba(30,80,30,0.18)';
  ctx.fillRect(0, h - h * 0.06, w, h * 0.06);
}

function paintTuft(ctx, w, h) {
  ctx.lineCap = 'round';
  const blades = [
    [-0.35, '#4f9c3e'],
    [-0.12, '#62b24c'],
    [0.1, '#4f9c3e'],
    [0.32, '#6cbc55'],
  ];
  contactShadow(ctx, w / 2, h * 0.86, w * 0.4, h * 0.12, 0.2);
  for (const [dx, color] of blades) {
    ctx.strokeStyle = color;
    ctx.lineWidth = w * 0.11;
    ctx.beginPath();
    ctx.moveTo(w / 2 + dx * w * 0.4, h * 0.85);
    ctx.quadraticCurveTo(w / 2 + dx * w * 0.6, h * 0.45, w / 2 + dx * w * 1.1, h * 0.18);
    ctx.stroke();
  }
}

function paintFlower(ctx, w, h, petal) {
  const cx = w / 2;
  const cy = h * 0.42;
  ctx.strokeStyle = '#3f8f35';
  ctx.lineWidth = w * 0.07;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx, h * 0.9);
  ctx.stroke();
  ctx.fillStyle = '#4fa040';
  ctx.beginPath();
  ctx.ellipse(cx + w * 0.12, h * 0.72, w * 0.14, w * 0.06, -0.5, 0, Math.PI * 2);
  ctx.fill();
  for (let i = 0; i < 5; i += 1) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    ctx.fillStyle = petal;
    ctx.beginPath();
    ctx.ellipse(cx + Math.cos(a) * w * 0.17, cy + Math.sin(a) * w * 0.17, w * 0.14, w * 0.1, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.beginPath();
  ctx.arc(cx + w * 0.03, cy + w * 0.04, w * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffb02e';
  ctx.beginPath();
  ctx.arc(cx, cy, w * 0.09, 0, Math.PI * 2);
  ctx.fill();
}

function paintPebbles(ctx, w, h) {
  const rand = seeded(31);
  for (let i = 0; i < 3; i += 1) {
    const x = w * (0.25 + rand() * 0.5);
    const y = h * (0.35 + rand() * 0.4);
    const r = w * (0.08 + rand() * 0.08);
    contactShadow(ctx, x + r * 0.3, y + r * 0.5, r * 1.2, r * 0.5, 0.25);
    ctx.fillStyle = vGradient(ctx, y - r, y + r, [
      [0, '#e3ddd0'],
      [1, '#a9a193'],
    ]);
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.75, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintAsphalt(ctx, w, h, variant) {
  ctx.fillStyle = vGradient(ctx, 0, h, [
    [0, '#55596a'],
    [1, '#4a4e5e'],
  ]);
  ctx.fillRect(0, 0, w, h);
  const rand = seeded(variant * 131 + 7);
  speckle(ctx, 0, 0, w, h, Math.round((w * h) / 22), ['rgba(255,255,255,0.08)', 'rgba(0,0,0,0.12)', 'rgba(255,255,255,0.05)'], rand, [0.6, 1.4]);
  // Huellas de rodadura más oscuras y alguna grieta reparada.
  ctx.fillStyle = 'rgba(20,20,30,0.12)';
  ctx.fillRect(0, h * 0.22, w, h * 0.14);
  ctx.fillRect(0, h * 0.64, w, h * 0.14);
  ctx.strokeStyle = 'rgba(25,25,35,0.45)';
  ctx.lineWidth = Math.max(1, h * 0.025);
  for (let k = 0; k < 2; k += 1) {
    let x = rand() * w;
    let y = rand() * h;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < 4; s += 1) {
      x += (rand() - 0.3) * h * 0.4;
      y += (rand() - 0.5) * h * 0.3;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // Mancha de aceite.
  const ox = rand() * w;
  const g = ctx.createRadialGradient(ox, h * 0.5, 0, ox, h * 0.5, h * 0.35);
  g.addColorStop(0, 'rgba(15,15,25,0.3)');
  g.addColorStop(1, 'rgba(15,15,25,0)');
  ctx.fillStyle = g;
  ctx.fillRect(ox - h * 0.4, 0, h * 0.8, h);
}

function paintCurb(ctx, w, h) {
  // Bordillo de piedra: bloques alternos blancos y grises con canto iluminado.
  const block = h * 0.9;
  for (let x = 0, i = 0; x < w; x += block, i += 1) {
    ctx.fillStyle = i % 2 ? '#d9dbe2' : '#b9bcc7';
    ctx.fillRect(x, 0, block, h);
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillRect(x, 0, block, h * 0.3);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(x + block - 1, 0, 1, h);
  }
}

function paintBank(ctx, w, h, top) {
  // Orilla de arena húmeda entre hierba y agua.
  const rand = seeded(top ? 11 : 17);
  ctx.fillStyle = vGradient(ctx, 0, h, top
    ? [
        [0, '#e7cf94'],
        [1, '#c9ab6c'],
      ]
    : [
        [0, '#c9ab6c'],
        [1, '#e7cf94'],
      ]);
  ctx.beginPath();
  ctx.moveTo(0, top ? 0 : h);
  for (let x = 0; x <= w; x += h * 0.8) ctx.lineTo(x, top ? h * (0.55 + rand() * 0.45) : h * (0.45 - rand() * 0.45));
  ctx.lineTo(w, top ? 0 : h);
  ctx.closePath();
  ctx.fill();
  speckle(ctx, 0, 0, w, h, w / 3, ['rgba(120,90,40,0.35)', 'rgba(255,250,220,0.5)'], rand, [0.6, 1.3]);
}

// ---------------------------------------------------------------- objetos

function paintLog(ctx, w, h, seed) {
  const rand = seeded(seed);
  const pad = h * 0.12;
  const bodyH = h - pad * 2;
  const top = pad;
  const r = bodyH / 2;
  // Corteza: cilindro con luz arriba.
  ctx.fillStyle = vGradient(ctx, top, top + bodyH, [
    [0, '#c68a52'],
    [0.35, '#a0602f'],
    [0.85, '#6e3d1c'],
    [1, '#5a3016'],
  ]);
  roundRect(ctx, r * 0.4, top, w - r * 0.8, bodyH, r);
  ctx.fill();
  // Surcos de la corteza.
  ctx.strokeStyle = 'rgba(60,30,12,0.45)';
  ctx.lineCap = 'round';
  for (let i = 0; i < w / (h * 0.35); i += 1) {
    const x = r + rand() * (w - r * 3);
    const y = top + bodyH * (0.15 + rand() * 0.7);
    ctx.lineWidth = Math.max(1, h * (0.025 + rand() * 0.02));
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + h * (0.4 + rand() * 0.6), y + (rand() - 0.5) * h * 0.08);
    ctx.stroke();
  }
  // Brillo superior.
  ctx.fillStyle = 'rgba(255,230,190,0.22)';
  roundRect(ctx, r, top + bodyH * 0.1, w - r * 2.6, bodyH * 0.16, bodyH * 0.08);
  ctx.fill();
  // Musgo.
  for (let i = 0; i < 2; i += 1) {
    const x = r * 2 + rand() * (w - r * 5);
    ctx.fillStyle = 'rgba(110,160,60,0.75)';
    ctx.beginPath();
    ctx.ellipse(x, top + bodyH * 0.22, h * 0.22, h * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(160,210,90,0.6)';
    ctx.beginPath();
    ctx.ellipse(x - h * 0.05, top + bodyH * 0.18, h * 0.12, h * 0.05, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Extremos cortados con anillos.
  for (const ex of [r * 0.75, w - r * 0.75]) {
    ctx.fillStyle = '#e5b47a';
    ctx.beginPath();
    ctx.ellipse(ex, top + r, r * 0.45, r * 0.95, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(150,90,40,0.6)';
    ctx.lineWidth = Math.max(0.8, h * 0.02);
    for (const k of [0.7, 0.45, 0.2]) {
      ctx.beginPath();
      ctx.ellipse(ex, top + r, r * 0.45 * k, r * 0.95 * k, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.strokeStyle = '#7a4520';
    ctx.lineWidth = Math.max(1, h * 0.035);
    ctx.beginPath();
    ctx.ellipse(ex, top + r, r * 0.45, r * 0.95, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

/**
 * Vehículo visto desde arriba, mirando a la derecha. `w`×`h` es la caja del
 * motor; el sprite tiene margen para la sombra y las ruedas.
 */
function paintVehicle(ctx, W, H, kind, hue, len, cell) {
  const m = cell * 0.12; // margen del sprite
  const w = W - m * 2;
  const h = (kind === 'truck' ? 0.78 : 0.68) * cell;
  const x = m;
  const y = (H - h) / 2;
  const body = hsl(hue, 70, 55);
  const bodyLight = hsl(hue, 80, 70);
  const bodyDark = hsl(hue, 65, 36);

  // Sombra proyectada (abajo a la derecha).
  ctx.fillStyle = 'rgba(15,15,30,0.32)';
  roundRect(ctx, x + cell * 0.06, y + cell * 0.1, w, h, h * 0.3);
  ctx.fill();

  // Ruedas que asoman.
  ctx.fillStyle = '#1b1a22';
  const wheels = kind === 'truck' ? [0.12, 0.42, len - 0.62, len - 0.36] : [0.18, len - 0.42];
  for (const wx of wheels) {
    roundRect(ctx, x + wx * cell, y - cell * 0.05, cell * 0.24, h + cell * 0.1, cell * 0.05);
    ctx.fill();
    ctx.fillStyle = '#3a3946';
    ctx.fillRect(x + wx * cell + cell * 0.04, y - cell * 0.04, cell * 0.16, cell * 0.03);
    ctx.fillRect(x + wx * cell + cell * 0.04, y + h + cell * 0.01, cell * 0.16, cell * 0.03);
    ctx.fillStyle = '#1b1a22';
  }

  const shadeBody = (bx, by, bw, bh, r, light, mid, dark) => {
    ctx.fillStyle = vGradient(ctx, by, by + bh, [
      [0, light],
      [0.45, mid],
      [1, dark],
    ]);
    roundRect(ctx, bx, by, bw, bh, r);
    ctx.fill();
    ctx.strokeStyle = 'rgba(20,15,30,0.45)';
    ctx.lineWidth = Math.max(1, cell * 0.025);
    ctx.stroke();
  };

  if (kind === 'truck') {
    const cab = cell * 0.78;
    const boxW = w - cab - cell * 0.06;
    // Contenedor ondulado.
    shadeBody(x, y, boxW, h, cell * 0.08, '#f6f7fb', '#dfe2ea', '#aeb3c2');
    ctx.strokeStyle = 'rgba(80,85,110,0.25)';
    ctx.lineWidth = Math.max(1, cell * 0.02);
    for (let rx = x + cell * 0.12; rx < x + boxW - cell * 0.05; rx += cell * 0.14) {
      ctx.beginPath();
      ctx.moveTo(rx, y + h * 0.08);
      ctx.lineTo(rx, y + h * 0.92);
      ctx.stroke();
    }
    // Franja de color de la empresa (sin marca).
    ctx.fillStyle = body;
    ctx.fillRect(x + cell * 0.08, y + h * 0.42, boxW - cell * 0.16, h * 0.16);
    // Enganche.
    ctx.fillStyle = '#3c3a46';
    ctx.fillRect(x + boxW - cell * 0.02, y + h * 0.4, cell * 0.1, h * 0.2);
    // Cabina.
    const cx = x + boxW + cell * 0.06;
    shadeBody(cx, y + h * 0.04, cab, h * 0.92, cell * 0.16, bodyLight, body, bodyDark);
    ctx.fillStyle = vGradient(ctx, y, y + h, [
      [0, '#d8f1ff'],
      [1, '#7fb3d6'],
    ]);
    roundRect(ctx, cx + cab * 0.58, y + h * 0.16, cab * 0.26, h * 0.68, cell * 0.06);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(cx + cab * 0.62, y + h * 0.2, cab * 0.05, h * 0.6);
    // Retrovisores.
    ctx.fillStyle = bodyDark;
    ctx.fillRect(cx + cab * 0.5, y - cell * 0.04, cell * 0.08, cell * 0.06);
    ctx.fillRect(cx + cab * 0.5, y + h - cell * 0.02, cell * 0.08, cell * 0.06);
  } else {
    const r = h * 0.34;
    shadeBody(x, y, w, h, r, bodyLight, body, bodyDark);
    // Capó con línea central y brillo.
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = Math.max(1, cell * 0.015);
    ctx.beginPath();
    ctx.moveTo(x + w * 0.8, y + h * 0.5);
    ctx.lineTo(x + w * 0.97, y + h * 0.5);
    ctx.stroke();
    // Techo.
    const roofX = x + w * (kind === 'van' ? 0.12 : 0.26);
    const roofW = w * (kind === 'van' ? 0.62 : 0.42);
    ctx.fillStyle = vGradient(ctx, y, y + h, [
      [0, bodyLight],
      [1, bodyDark],
    ]);
    roundRect(ctx, roofX, y + h * 0.14, roofW, h * 0.72, h * 0.2);
    ctx.fill();
    if (kind === 'van') {
      // Baca.
      ctx.strokeStyle = 'rgba(30,30,40,0.5)';
      ctx.lineWidth = Math.max(1, cell * 0.02);
      for (const k of [0.3, 0.5, 0.7]) {
        ctx.beginPath();
        ctx.moveTo(roofX + roofW * 0.12, y + h * k);
        ctx.lineTo(roofX + roofW * 0.88, y + h * k);
        ctx.stroke();
      }
    }
    // Parabrisas delantero y luneta.
    const glass = vGradient(ctx, y, y + h, [
      [0, '#e2f5ff'],
      [0.5, '#9fcbe6'],
      [1, '#5e8eb0'],
    ]);
    ctx.fillStyle = glass;
    roundRect(ctx, roofX + roofW, y + h * 0.16, w * 0.12, h * 0.68, h * 0.12);
    ctx.fill();
    roundRect(ctx, roofX - w * 0.08, y + h * 0.2, w * 0.07, h * 0.6, h * 0.1);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.moveTo(roofX + roofW + w * 0.03, y + h * 0.2);
    ctx.lineTo(roofX + roofW + w * 0.06, y + h * 0.2);
    ctx.lineTo(roofX + roofW + w * 0.025, y + h * 0.75);
    ctx.lineTo(roofX + roofW + w * 0.005, y + h * 0.75);
    ctx.closePath();
    ctx.fill();
    // Retrovisores.
    ctx.fillStyle = bodyDark;
    ctx.beginPath();
    ctx.ellipse(roofX + roofW + w * 0.02, y - cell * 0.01, cell * 0.05, cell * 0.035, 0, 0, Math.PI * 2);
    ctx.ellipse(roofX + roofW + w * 0.02, y + h + cell * 0.01, cell * 0.05, cell * 0.035, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Faros delanteros y pilotos traseros.
  for (const fy of [0.2, 0.8]) {
    ctx.fillStyle = '#fff6c9';
    ctx.beginPath();
    ctx.ellipse(x + w - cell * 0.04, y + h * fy, cell * 0.035, cell * 0.06, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8364f';
    ctx.fillRect(x + cell * 0.01, y + h * fy - cell * 0.045, cell * 0.04, cell * 0.09);
  }
}

/**
 * Gallina en vista ¾. Mira a la derecha (lateral), hacia abajo (de frente) o
 * hacia arriba (de espaldas). `dead` dibuja ojos en espiral.
 */
function paintChicken(ctx, W, H, facing, dead) {
  const cx = W / 2;
  const cy = H * 0.52;
  const r = W * 0.33;
  const side = facing === 'side';
  const back = facing === 'up';

  // Patas.
  ctx.strokeStyle = '#ec8a1c';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = r * 0.13;
  for (const lx of side ? [-0.18, 0.18] : [-0.3, 0.3]) {
    ctx.beginPath();
    ctx.moveTo(cx + lx * r, cy + r * 0.6);
    ctx.lineTo(cx + lx * r, cy + r * 1.02);
    ctx.lineTo(cx + lx * r + (side ? r * 0.18 : 0), cy + r * 1.08);
    ctx.stroke();
  }

  // Cola (detrás del cuerpo).
  ctx.fillStyle = '#e9e2d6';
  if (side) {
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.6, cy - r * 0.1);
    ctx.quadraticCurveTo(cx - r * 1.35, cy - r * 0.75, cx - r * 1.05, cy - r * 1.0);
    ctx.quadraticCurveTo(cx - r * 0.85, cy - r * 0.45, cx - r * 0.35, cy - r * 0.35);
    ctx.fill();
  } else if (back) {
    for (const a of [-0.45, 0, 0.45]) {
      ctx.beginPath();
      ctx.ellipse(cx + Math.sin(a) * r * 0.5, cy - r * 0.55, r * 0.2, r * 0.45, a, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Cuerpo: plumaje blanco con sombra cálida abajo y brillo arriba.
  const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.45, r * 0.1, cx, cy, r * 1.15);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.6, '#f7f1e6');
  g.addColorStop(1, '#d9cbb4');
  ctx.fillStyle = g;
  ctx.beginPath();
  if (side) ctx.ellipse(cx, cy, r * 1.0, r * 0.88, 0, 0, Math.PI * 2);
  else ctx.ellipse(cx, cy, r * 0.88, r * 0.92, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(90,60,40,0.4)';
  ctx.lineWidth = Math.max(1, r * 0.06);
  ctx.stroke();

  // Plumas del pecho (pequeñas escamas).
  ctx.strokeStyle = 'rgba(170,140,110,0.35)';
  ctx.lineWidth = Math.max(0.8, r * 0.04);
  for (let i = 0; i < 4; i += 1) {
    const px = cx + (side ? r * 0.35 : -r * 0.3 + i * r * 0.2);
    const py = cy + r * (side ? 0.05 + i * 0.12 : 0.35);
    ctx.beginPath();
    ctx.arc(px, py, r * 0.12, 0.2, Math.PI - 0.2);
    ctx.stroke();
  }

  // Ala.
  ctx.fillStyle = vGradient(ctx, cy - r * 0.2, cy + r * 0.5, [
    [0, '#f1eadf'],
    [1, '#cdbda4'],
  ]);
  ctx.beginPath();
  if (side) ctx.ellipse(cx - r * 0.15, cy + r * 0.12, r * 0.52, r * 0.36, -0.25, 0, Math.PI * 2);
  else {
    ctx.ellipse(cx - r * 0.78, cy + r * 0.1, r * 0.2, r * 0.42, 0.2, 0, Math.PI * 2);
    ctx.ellipse(cx + r * 0.78, cy + r * 0.1, r * 0.2, r * 0.42, -0.2, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.strokeStyle = 'rgba(120,90,60,0.35)';
  ctx.stroke();

  // Cresta.
  const combX = side ? cx + r * 0.35 : cx;
  ctx.fillStyle = vGradient(ctx, cy - r * 1.3, cy - r * 0.7, [
    [0, '#ff5a63'],
    [1, '#c8202f'],
  ]);
  for (const [dx, dy, s] of [
    [-0.18, -0.92, 0.17],
    [0.02, -1.04, 0.2],
    [0.22, -0.94, 0.16],
  ]) {
    ctx.beginPath();
    ctx.arc(combX + dx * r, cy + dy * r, s * r, 0, Math.PI * 2);
    ctx.fill();
  }
  if (back) return;

  // Cara.
  const eyeY = cy - r * 0.38;
  const beakX = side ? cx + r * 0.95 : cx;
  const beakY = cy - r * (side ? 0.2 : 0.15);
  // Barbilla.
  ctx.fillStyle = '#e0303f';
  ctx.beginPath();
  ctx.ellipse(side ? cx + r * 0.78 : cx, beakY + r * 0.22, r * 0.09, r * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();
  // Pico.
  ctx.fillStyle = vGradient(ctx, beakY - r * 0.15, beakY + r * 0.15, [
    [0, '#ffc14d'],
    [1, '#e88a12'],
  ]);
  ctx.beginPath();
  if (side) {
    ctx.moveTo(beakX - r * 0.12, beakY - r * 0.14);
    ctx.quadraticCurveTo(beakX + r * 0.35, beakY - r * 0.02, beakX - r * 0.12, beakY + r * 0.12);
  } else {
    ctx.moveTo(beakX - r * 0.16, beakY - r * 0.04);
    ctx.lineTo(beakX + r * 0.16, beakY - r * 0.04);
    ctx.lineTo(beakX, beakY + r * 0.2);
  }
  ctx.closePath();
  ctx.fill();
  // Ojos.
  const eyes = side ? [cx + r * 0.52] : [cx - r * 0.3, cx + r * 0.3];
  for (const ex of eyes) {
    if (dead) {
      ctx.strokeStyle = '#2b2522';
      ctx.lineWidth = Math.max(1, r * 0.06);
      ctx.beginPath();
      for (let a = 0; a < Math.PI * 4; a += 0.3) {
        const rr = (a / (Math.PI * 4)) * r * 0.17;
        ctx.lineTo(ex + Math.cos(a) * rr, eyeY + Math.sin(a) * rr);
      }
      ctx.stroke();
      continue;
    }
    ctx.fillStyle = '#2b2522';
    ctx.beginPath();
    ctx.ellipse(ex, eyeY, r * 0.1, r * 0.13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ex - r * 0.03, eyeY - r * 0.05, r * 0.04, 0, Math.PI * 2);
    ctx.fill();
  }
  // Rubor.
  ctx.fillStyle = 'rgba(255,120,120,0.3)';
  for (const ex of side ? [cx + r * 0.45] : [cx - r * 0.5, cx + r * 0.5]) {
    ctx.beginPath();
    ctx.ellipse(ex, eyeY + r * 0.25, r * 0.12, r * 0.07, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintNest(ctx, w, h) {
  const cx = w / 2;
  const cy = h * 0.62;
  contactShadow(ctx, cx + w * 0.03, cy + h * 0.14, w * 0.48, h * 0.18, 0.35);
  // Paja exterior.
  ctx.fillStyle = vGradient(ctx, cy - h * 0.25, cy + h * 0.2, [
    [0, '#d9a75a'],
    [1, '#8c5a26'],
  ]);
  ctx.beginPath();
  ctx.ellipse(cx, cy, w * 0.44, h * 0.24, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,220,150,0.6)';
  ctx.lineWidth = Math.max(1, h * 0.025);
  const rand = seeded(5);
  for (let i = 0; i < 22; i += 1) {
    const a = rand() * Math.PI * 2;
    const rx = w * 0.4;
    const ry = h * 0.2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry);
    ctx.lineTo(cx + Math.cos(a + 0.35) * rx * 1.05, cy + Math.sin(a + 0.35) * ry * 1.1);
    ctx.stroke();
  }
  // Hueco.
  ctx.fillStyle = '#6b4219';
  ctx.beginPath();
  ctx.ellipse(cx, cy - h * 0.04, w * 0.3, h * 0.13, 0, 0, Math.PI * 2);
  ctx.fill();
  // Huevos.
  for (const dx of [-0.13, 0.13, 0]) {
    const ex = cx + dx * w;
    const ey = cy - h * (dx === 0 ? 0.1 : 0.04);
    const eg = ctx.createRadialGradient(ex - w * 0.03, ey - h * 0.06, 1, ex, ey, w * 0.1);
    eg.addColorStop(0, '#ffffff');
    eg.addColorStop(1, '#ead9bd');
    ctx.fillStyle = eg;
    ctx.beginPath();
    ctx.ellipse(ex, ey, w * 0.075, h * 0.13, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintFence(ctx, w, h) {
  // Valla de madera de la granja (adorno sobre la franja de meta, no bloquea).
  const post = h * 0.14;
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(0, h * 0.62, w, h * 0.08);
  for (const ry of [0.3, 0.52]) {
    ctx.fillStyle = vGradient(ctx, h * ry, h * (ry + 0.09), [
      [0, '#f2d6a6'],
      [1, '#b8854b'],
    ]);
    ctx.fillRect(0, h * ry, w, h * 0.09);
  }
  for (let x = post; x < w; x += h * 0.9) {
    ctx.fillStyle = vGradient(ctx, h * 0.12, h * 0.7, [
      [0, '#f6dfb4'],
      [1, '#a8763f'],
    ]);
    roundRect(ctx, x - post / 2, h * 0.14, post, h * 0.54, post * 0.3);
    ctx.fill();
  }
}

function paintFarm(ctx, w, h) {
  // Paisaje más allá de la meta: prado, árboles y un granero en el horizonte.
  ctx.fillStyle = vGradient(ctx, 0, h, [
    [0, '#c4e7a6'],
    [0.45, '#9cd57f'],
    [1, '#7cc862'],
  ]);
  ctx.fillRect(0, 0, w, h);
  const rand = seeded(77);
  // Colinas.
  for (const [y, color] of [
    [0.22, 'rgba(120,180,100,0.55)'],
    [0.38, 'rgba(100,170,85,0.6)'],
  ]) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, h * y);
    for (let x = 0; x <= w; x += w / 6) ctx.quadraticCurveTo(x + w / 12, h * (y - 0.06 - rand() * 0.05), x + w / 6, h * y);
    ctx.lineTo(w, h);
    ctx.fill();
  }
  // Granero.
  const bx = w * 0.62;
  const by = h * 0.42;
  const bw = w * 0.16;
  const bh = bw * 0.62;
  contactShadow(ctx, bx + bw / 2, by + bh, bw * 0.7, bh * 0.15, 0.3);
  ctx.fillStyle = vGradient(ctx, by, by + bh, [
    [0, '#d9433c'],
    [1, '#9e2420'],
  ]);
  ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = '#6e3a2c';
  ctx.beginPath();
  ctx.moveTo(bx - bw * 0.06, by + 1);
  ctx.lineTo(bx + bw * 0.5, by - bh * 0.55);
  ctx.lineTo(bx + bw * 1.06, by + 1);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#fbf3e4';
  ctx.lineWidth = Math.max(1, bw * 0.03);
  ctx.strokeRect(bx + bw * 0.34, by + bh * 0.38, bw * 0.32, bh * 0.62);
  ctx.beginPath();
  ctx.moveTo(bx + bw * 0.34, by + bh * 0.38);
  ctx.lineTo(bx + bw * 0.66, by + bh);
  ctx.moveTo(bx + bw * 0.66, by + bh * 0.38);
  ctx.lineTo(bx + bw * 0.34, by + bh);
  ctx.stroke();
  // Silo.
  const sx = bx + bw * 1.12;
  const silo = ctx.createLinearGradient(sx, 0, sx + bw * 0.24, 0);
  silo.addColorStop(0, '#f1f1ee');
  silo.addColorStop(1, '#a9a9a4');
  ctx.fillStyle = silo;
  ctx.fillRect(sx, by - bh * 0.3, bw * 0.24, bh * 1.3);
  ctx.fillStyle = '#7b8a96';
  ctx.beginPath();
  ctx.arc(sx + bw * 0.12, by - bh * 0.3, bw * 0.12, Math.PI, 0);
  ctx.fill();
  // Árboles redondos.
  for (let i = 0; i < 7; i += 1) {
    const tx = rand() * w;
    if (Math.abs(tx - (bx + bw * 0.6)) < bw) continue;
    const ty = h * (0.45 + rand() * 0.4);
    const tr = w * (0.035 + rand() * 0.03);
    contactShadow(ctx, tx + tr * 0.3, ty + tr * 1.3, tr * 1.1, tr * 0.35, 0.3);
    ctx.fillStyle = '#7a5230';
    ctx.fillRect(tx - tr * 0.12, ty + tr * 0.4, tr * 0.24, tr * 0.9);
    const tg = ctx.createRadialGradient(tx - tr * 0.4, ty - tr * 0.4, tr * 0.1, tx, ty, tr * 1.2);
    tg.addColorStop(0, '#8fd46c');
    tg.addColorStop(1, '#3f8a35');
    ctx.fillStyle = tg;
    ctx.beginPath();
    ctx.arc(tx, ty, tr, 0, Math.PI * 2);
    ctx.fill();
  }
  // Fardos de heno.
  for (const [hx, hy] of [
    [0.2, 0.8],
    [0.3, 0.86],
    [0.84, 0.82],
  ]) {
    const r = w * 0.03;
    contactShadow(ctx, w * hx + r * 0.3, h * hy + r * 0.9, r * 1.4, r * 0.4, 0.3);
    ctx.fillStyle = '#e6c25e';
    ctx.beginPath();
    ctx.ellipse(w * hx, h * hy, r * 1.3, r, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(150,110,30,0.6)';
    ctx.lineWidth = Math.max(1, r * 0.12);
    ctx.beginPath();
    ctx.ellipse(w * hx + r * 0.6, h * hy, r * 0.45, r * 0.8, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function paintHedge(ctx, w, h) {
  // Seto de los márgenes en pantallas anchas. Las matas se repiten por los
  // bordes para que la textura encaje sin costuras al teselarla.
  ctx.fillStyle = '#356f30';
  ctx.fillRect(0, 0, w, h);
  const rand = seeded(9);
  for (let i = 0; i < 70; i += 1) {
    const x = rand() * w;
    const y = rand() * h;
    const r = 8 + rand() * 9;
    for (const ox of [-w, 0, w]) {
      for (const oy of [-h, 0, h]) {
        const px = x + ox;
        const py = y + oy;
        if (px + r < 0 || px - r > w || py + r < 0 || py - r > h) continue;
        const g = ctx.createRadialGradient(px - r * 0.35, py - r * 0.35, 1, px, py, r);
        g.addColorStop(0, '#6fb352');
        g.addColorStop(0.7, '#3f8336');
        g.addColorStop(1, '#2c5f28');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

// ---------------------------------------------------------------- partículas

/** Duración de la secuencia de impacto antes del menú de derrota (s). */
export const IMPACT_SECONDS = 3;
const BLOOD = ['#d1203b', '#e63950', '#a3132b', '#ff5470'];

/**
 * Impacto: plumas y, si fue un coche, «salpicadura» de dibujos animados (círculos
 * rojos de tamaños y velocidades variados) más una mancha que crece en el suelo.
 * La densidad se adapta al tamaño del tablero y a la calidad; con movimiento
 * reducido las partículas apenas se desplazan.
 */
export function burst(view, x, y, kind, cell = 40) {
  const calm = view.reduced ? 0.2 : 1;
  const low = view.quality.quality === 'low' ? 0.6 : 1;
  const density = Math.max(0.6, Math.min(1.3, cell / 48)) * low;
  view.impact = { x, y, kind, at: view.time };
  const feathers = Math.round(14 * density);
  for (let i = 0; i < feathers; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const speed = (40 + Math.random() * 120) * calm;
    const drop = kind === 'water' && i % 2;
    view.particles.emit({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed - 60 * calm, spin: (Math.random() - 0.5) * 8, decay: 0.45, gravity: 160, drag: 1.5, kind: drop ? 'drop' : 'feather' });
  }
  if (kind !== 'car') return;
  const drops = Math.round(26 * density);
  for (let i = 0; i < drops; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const speed = (60 + Math.random() * 260) * calm;
    view.particles.emit({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed * 0.7 - 40 * calm, size: 0.035 + Math.random() * 0.09, decay: 0.32 + Math.random() * 0.12, gravity: 260, drag: 2.4, color: BLOOD[i % BLOOD.length], kind: 'blood' });
  }
}

function dust(view, x, y, cell) {
  if (view.reduced) return;
  const n = view.quality.quality === 'low' ? 3 : 6;
  for (let i = 0; i < n; i += 1) {
    const a = Math.PI + (i / (n - 1)) * Math.PI;
    view.particles.emit({ x: x + Math.cos(a) * cell * 0.2, y: y + cell * 0.3, vx: Math.cos(a) * cell * 1.4, vy: -Math.abs(Math.sin(a)) * cell * 0.5, decay: 2.6, drag: 3, size: cell * (0.07 + Math.random() * 0.05), kind: 'dust' });
  }
}

function splashRing(view, x, y, cell) {
  if (view.reduced) return;
  for (let i = 0; i < 6; i += 1) {
    const a = -Math.PI * (0.15 + Math.random() * 0.7);
    view.particles.emit({ x, y: y + cell * 0.2, vx: Math.cos(a) * cell * 1.6, vy: Math.sin(a) * cell * 2.4, gravity: cell * 9, decay: 1.8, kind: 'drop' });
  }
}

// ---------------------------------------------------------------- escena

export function renderChicken(ctx, size, state, view, dt) {
  if (!ctx || !size.width) return;
  view.time += dt;
  view.quality.sample(dt);
  const dpr = size.dpr || 1;
  const sprites = view.sprites;
  const high = view.quality.quality === 'high';
  const { cell, left } = layoutFor(size);
  const { chicken } = state;
  const hopT = chicken.hop ? Math.min(1, chicken.hop.t) : 0;
  const lift = chicken.hop ? Math.sin(hopT * Math.PI) * cell * 0.26 : 0;
  const rowPos = chicken.hop ? chicken.hop.fromRow + (chicken.hop.toRow - chicken.hop.fromRow) * hopT : chicken.row;

  // Cámara: la gallina en el tercio inferior; sigue con suavidad (al instante con movimiento reducido).
  const target = rowPos - 2.6;
  if (view.camera === null || view.reduced) view.camera = target;
  else view.camera += (target - view.camera) * Math.min(1, dt * 6);
  view.camera = Math.max(-0.5, view.camera);
  const screenY = (row) => size.height - (row - view.camera + 1) * cell;

  // Sacudida breve del impacto (no con movimiento reducido).
  const sinceImpact = view.impact ? view.time - view.impact.at : Infinity;
  const shake = !view.reduced && sinceImpact < 0.35 ? (1 - sinceImpact / 0.35) * cell * 0.12 : 0;
  ctx.save();
  if (shake) ctx.translate((Math.random() - 0.5) * shake * 2, (Math.random() - 0.5) * shake * 2);

  const width = cell * COLS;
  // Fondo: la hierba continúa por debajo de la salida.
  ctx.fillStyle = '#74c25b';
  ctx.fillRect(0, 0, size.width, size.height);
  const first = Math.max(0, Math.floor(view.camera) - 1);
  const last = Math.min(state.rows.length - 1, Math.ceil(view.camera + size.height / cell) + 1);

  // Más allá de la última fila: la granja en el horizonte.
  const topRowY = screenY(state.rows.length - 1);
  if (topRowY > 0) {
    const farmH = Math.max(cell * 6, topRowY);
    const farm = sprites.get('farm', width, cell * 6, paintFarm, dpr);
    ctx.fillStyle = '#c4e7a6';
    ctx.fillRect(0, 0, size.width, topRowY);
    ctx.drawImage(farm.canvas, left, topRowY - cell * 6, width, cell * 6);
    if (farmH > cell * 6) {
      ctx.fillStyle = vGradient(ctx, 0, topRowY - cell * 6, [
        [0, '#dff1ff'],
        [1, '#c4e7a6'],
      ]);
      ctx.fillRect(left, 0, width, topRowY - cell * 6);
    }
  }

  // Terreno por filas.
  for (let i = first; i <= last; i += 1) {
    const row = state.rows[i];
    const y = screenY(i);
    const below = state.rows[i - 1];
    const above = state.rows[i + 1];
    if (row.type === 'grass' || row.type === 'goal') {
      const strip = sprites.get(`grass${i % 2}${Math.floor(hash(i) * 3)}`, width, cell, (c, w, h) => paintGrassStrip(c, w, h, i % 2, Math.floor(hash(i) * 3)), dpr);
      ctx.drawImage(strip.canvas, left, y, width, cell);
    } else if (row.type === 'road') {
      const variant = Math.floor(hash(i, 3) * 4);
      const strip = sprites.get(`road${variant}`, width, cell, (c, w, h) => paintAsphalt(c, w, h, variant), dpr);
      ctx.drawImage(strip.canvas, left, y, width, cell);
      // Línea discontinua entre carriles de carretera.
      if (above?.type === 'road') {
        ctx.fillStyle = 'rgba(255,255,255,0.78)';
        for (let c = 0; c < COLS; c += 1) {
          roundRect(ctx, left + c * cell + cell * 0.22, y - cell * 0.035, cell * 0.56, cell * 0.07, cell * 0.03);
          ctx.fill();
        }
      }
      const curbH = cell * 0.09;
      const curb = sprites.get('curb', width, curbH, paintCurb, dpr);
      if (above && above.type !== 'road') ctx.drawImage(curb.canvas, left, y - curbH * 0.4, width, curbH);
      if (below && below.type !== 'road') ctx.drawImage(curb.canvas, left, y + cell - curbH * 0.6, width, curbH);
    } else {
      // Río: agua con profundidad, reflejos que corren con la corriente.
      ctx.fillStyle = vGradient(ctx, y, y + cell, [
        [0, '#2f8fd0'],
        [0.5, '#3aa7e3'],
        [1, '#2b86c6'],
      ]);
      ctx.fillRect(left, y, width, cell);
      const flow = view.reduced ? 0 : view.time * row.speed * row.dir * cell;
      ctx.strokeStyle = 'rgba(255,255,255,0.32)';
      ctx.lineWidth = Math.max(1, cell * 0.035);
      ctx.lineCap = 'round';
      for (let k = 0; k < COLS * 1.5; k += 1) {
        const seedX = hash(i, k) * width;
        const wx = left + ((((seedX + flow) % width) + width) % width);
        const wy = y + cell * (0.2 + hash(k, i) * 0.6);
        const len = cell * (0.15 + hash(k, i, 1) * 0.25);
        ctx.beginPath();
        ctx.moveTo(wx, wy);
        ctx.quadraticCurveTo(wx + len / 2, wy - cell * 0.04, wx + len, wy);
        ctx.stroke();
      }
      const bankH = cell * 0.16;
      if (above && above.type !== 'river') {
        const bank = sprites.get('bankTop', width, bankH, (c, w, h) => paintBank(c, w, h, true), dpr);
        ctx.drawImage(bank.canvas, left, y, width, bankH);
      }
      if (below && below.type !== 'river') {
        const bank = sprites.get('bankBottom', width, bankH, (c, w, h) => paintBank(c, w, h, false), dpr);
        ctx.drawImage(bank.canvas, left, y + cell - bankH, width, bankH);
      }
    }
  }

  // Adornos de la hierba (nunca bloquean: son solo dibujo).
  const deco = cell * 0.5;
  for (let i = first; i <= last; i += 1) {
    const row = state.rows[i];
    if (row.type !== 'grass') continue;
    const y = screenY(i);
    for (const col of row.flowers ?? []) {
      const petal = ['#ffffff', '#ffd166', '#ff8fab', '#b9a6ff'][(col + i) % 4];
      const flower = sprites.get(`flower${petal}`, deco, deco, (c, w, h) => paintFlower(c, w, h, petal), dpr);
      blit(ctx, flower, left + (col + 0.5 + (hash(i, col) - 0.5) * 0.4) * cell, y + cell * 0.5);
    }
    for (let k = 0; k < 3; k += 1) {
      const col = Math.floor(hash(i, k, 9) * COLS);
      const tuft = sprites.get('tuft', deco * 0.8, deco * 0.8, paintTuft, dpr);
      blit(ctx, tuft, left + (col + hash(k, i)) * cell, y + cell * (0.3 + hash(i, k) * 0.5));
    }
    if (hash(i, 99) < 0.4) {
      const col = Math.floor(hash(i, 98) * COLS);
      blit(ctx, sprites.get('pebbles', deco, deco, paintPebbles, dpr), left + (col + 0.5) * cell, y + cell * 0.55);
    }
  }

  // Meta: valla de madera y nido.
  for (let i = first; i <= last; i += 1) {
    const row = state.rows[i];
    if (row.type !== 'goal') continue;
    const y = screenY(i);
    const fence = sprites.get('fence', width, cell * 0.5, paintFence, dpr);
    ctx.drawImage(fence.canvas, left, y - cell * 0.18, width, cell * 0.5);
    const nest = sprites.get('nest', cell * 1.3, cell, paintNest, dpr);
    blit(ctx, nest, left + width / 2, y + cell * 0.55);
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(left, 0, width, size.height);
  ctx.clip();

  // Troncos (debajo de la gallina), con estela en el agua.
  for (let i = first; i <= last; i += 1) {
    const row = state.rows[i];
    if (row.type !== 'river') continue;
    const y = screenY(i);
    for (const log of row.items) {
      const px = left + log.x * cell;
      const len = log.len * cell;
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.beginPath();
      ctx.ellipse(px + len / 2, y + cell * 0.55, len * 0.55, cell * 0.38, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(10,50,90,0.3)';
      roundRect(ctx, px + cell * 0.08, y + cell * 0.26, len, cell * 0.58, cell * 0.29);
      ctx.fill();
      const seed = Math.round(log.len * 10) + i * 7;
      const sprite = sprites.get(`log${seed}`, len, cell * 0.86, (c, w, h) => paintLog(c, w, h, seed), dpr);
      ctx.drawImage(sprite.canvas, px, y + cell * 0.07, len, cell * 0.86);
    }
  }

  const deadKind = state.status === 'dead' ? state.cause : null;
  const cx = left + (chickenX(chicken) + 0.5) * cell;
  const cy = size.height - (rowPos - view.camera + 0.5) * cell;
  const sunk = deadKind === 'water' || deadKind === 'current';

  // Polvo / salpicadura al aterrizar.
  if (view.wasHopping && !chicken.hop && !deadKind) {
    const landed = state.rows[chicken.row];
    if (landed?.type === 'river') splashRing(view, cx, cy, cell);
    else dust(view, cx, cy, cell);
  }
  view.wasHopping = Boolean(chicken.hop);

  // Mancha en el asfalto: crece rápido y se queda (estilo dibujos animados).
  if (view.impact?.kind === 'car') {
    const grow = Math.min(1, sinceImpact / 0.25);
    ctx.fillStyle = 'rgba(178, 20, 45, 0.85)';
    const blobs = [[0, 0, 0.42], [0.32, 0.12, 0.2], [-0.3, 0.16, 0.18], [0.12, -0.28, 0.15], [-0.22, -0.2, 0.12], [0.46, -0.1, 0.09]];
    for (const [dx, dy, r] of blobs) {
      ctx.beginPath();
      ctx.ellipse(cx + dx * cell, cy + dy * cell * 0.7, r * cell * grow, r * cell * 0.75 * grow, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (!sunk) {
    // Sombra que se encoge al subir, cuerpo que se estira en el aire y se aplasta al caer.
    const shadowK = 1 - lift / (cell * 0.6);
    contactShadow(ctx, cx + cell * 0.04, cy + cell * 0.3, cell * 0.34 * shadowK, cell * 0.12 * shadowK, 0.35);
    const facing = chicken.facing === 'up' ? 'up' : chicken.facing === 'down' ? 'down' : 'side';
    const sprite = sprites.get(`hen${facing}${deadKind ? 'x' : ''}`, cell * 1.1, cell * 1.1, (c, w, h) => paintChicken(c, w, h, facing, Boolean(deadKind)), dpr);
    let sx = chicken.facing === 'left' ? -1 : 1;
    let sy = 1;
    if (deadKind === 'car') {
      sx *= 1.35;
      sy = 0.42;
    } else if (chicken.hop && !view.reduced) {
      const k = Math.sin(hopT * Math.PI);
      sx *= 1 - k * 0.1;
      sy = 1 + k * 0.12;
    } else if (!view.reduced) {
      // Respiración en reposo.
      sy = 1 + Math.sin(view.time * 4) * 0.02;
    }
    ctx.save();
    ctx.translate(cx, cy + cell * 0.32 - lift);
    ctx.scale(sx, sy);
    ctx.drawImage(sprite.canvas, -sprite.w / 2, -sprite.h * 0.8, sprite.w, sprite.h);
    ctx.restore();
  }

  // Vehículos encima de todo lo del suelo.
  for (let i = first; i <= last; i += 1) {
    const row = state.rows[i];
    if (row.type !== 'road') continue;
    const y = screenY(i);
    for (const car of row.items) {
      const m = cell * 0.12;
      const W = car.len * cell + m * 2;
      const H = cell * 1.1;
      const sprite = sprites.get(`car${car.kind}${car.hue}${car.len}`, W, H, (c, w, h) => paintVehicle(c, w, h, car.kind, car.hue ?? 0, car.len, cell), dpr);
      const px = left + car.x * cell;
      ctx.save();
      ctx.translate(px + car.len * cell * 0.5, y + cell / 2);
      if (row.dir < 0) ctx.scale(-1, 1);
      ctx.drawImage(sprite.canvas, -W / 2, -H / 2, W, H);
      ctx.restore();
    }
  }
  ctx.restore();

  // Bordes de la cuadrícula en pantallas anchas: setos.
  if (left > 2) {
    const hedge = sprites.get('hedge', 160, 160, paintHedge, 1);
    const pattern = ctx.createPattern(hedge.canvas, 'repeat');
    if (pattern) {
      ctx.save();
      ctx.fillStyle = pattern;
      ctx.translate(0, ((size.height - (0 - view.camera) * cell) % 160));
      ctx.fillRect(0, -160, left, size.height + 320);
      ctx.fillRect(left + width, -160, left, size.height + 320);
      ctx.restore();
    }
    ctx.fillStyle = 'rgba(10,30,10,0.35)';
    ctx.fillRect(left - 6, 0, 6, size.height);
    ctx.fillRect(left + width, 0, 6, size.height);
  }

  // Sombras de nubes a la deriva (solo calidad alta y con movimiento).
  if (high && !view.reduced) {
    for (let k = 0; k < 2; k += 1) {
      const span = size.width + cell * 8;
      const x = ((view.time * cell * 0.35 + k * span * 0.55) % span) - cell * 4;
      const y = ((k * 0.47 + 0.2) * size.height) % size.height;
      contactShadow(ctx, x, y, cell * 3.2, cell * 1.6, 0.08);
    }
  }

  // Ondas al caer al agua.
  if (sunk && view.deathAt !== null) {
    const k = Math.min(1, (view.time - view.deathAt) / 0.8);
    ctx.strokeStyle = `rgba(255,255,255,${1 - k})`;
    ctx.lineWidth = 3;
    for (const s of [0.4, 0.7]) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, cell * s * (0.4 + k), cell * s * 0.4 * (0.4 + k), 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Destello del golpe: un aro blanco que se abre.
  if (view.impact && sinceImpact < 0.4) {
    const k = sinceImpact / 0.4;
    ctx.strokeStyle = `rgba(255,255,255,${0.9 * (1 - k)})`;
    ctx.lineWidth = Math.max(2, cell * 0.08 * (1 - k));
    ctx.beginPath();
    ctx.arc(view.impact.x, view.impact.y, cell * (0.3 + k * 0.9), 0, Math.PI * 2);
    ctx.stroke();
  }

  // Partículas (plumas, gotas, polvo y salpicadura).
  view.particles.update(dt, (p) => {
    ctx.globalAlpha = Math.max(0, Math.min(1, p.kind === 'blood' ? p.life * 1.6 : p.life));
    if (p.kind === 'blood') {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(1.5, cell * p.size * (0.6 + 0.4 * p.life)), 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'dust') {
      ctx.fillStyle = 'rgba(240,230,200,0.8)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1.6 - p.life * 0.6), 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'drop') {
      ctx.fillStyle = '#d6f1ff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, cell * 0.05, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(0, 0, cell * 0.12, cell * 0.045, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(160,140,120,0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-cell * 0.11, 0);
      ctx.lineTo(cell * 0.11, 0);
      ctx.stroke();
      ctx.restore();
    }
  });
  ctx.globalAlpha = 1;

  // Viñeta suave: centra la mirada sin oscurecer la zona de juego.
  const vignette = sprites.get('vignette', size.width, size.height, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h * 0.6, Math.min(w, h) * 0.45, w / 2, h * 0.6, Math.max(w, h) * 0.8);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(20,40,10,0.28)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  }, 1);
  ctx.drawImage(vignette.canvas, 0, 0, size.width, size.height);
  ctx.restore();
}

/** Centro en pantalla de la gallina (para lanzar las plumas desde allí). */
export function chickenScreenPoint(size, state, view) {
  const { cell, left } = layoutFor(size);
  const row = logicalRow(state.chicken);
  return { x: left + (chickenX(state.chicken) + 0.5) * cell, y: size.height - (row - (view.camera ?? 0) + 0.5) * cell };
}
