/**
 * Dibujo de «Pollo pasando la calle» en Canvas 2D (vista cenital).
 *
 * La cuadrícula ocupa el ancho disponible (COLS casillas) y la cámara sube
 * suavemente siguiendo a la gallina, que queda en el tercio inferior. Los coches,
 * troncos y la gallina se dibujan con las mismas x del motor: lo que se ve es lo
 * que choca. Todo son formas redondeadas propias (sin sprites externos).
 *
 * La derrota es caricaturesca: plumas que saltan, ojos en espiral y la gallina
 * aplastada como en los dibujos animados. Nada de imágenes realistas.
 */
import { COLS, chickenX, logicalRow } from './chickenEngine.js';

const VISIBLE_ROWS = 11;

export function createRenderState() {
  return { camera: null, particles: [], time: 0, reduced: false, deathAt: null };
}

/** Geometría de la vista: tamaño de casilla y margen para centrar la cuadrícula. */
export function layoutFor(size) {
  const cell = Math.max(18, Math.min(size.width / COLS, size.height / VISIBLE_ROWS, 72));
  return { cell, left: (size.width - cell * COLS) / 2 };
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawGrass(ctx, row, index, x, y, w, cell) {
  ctx.fillStyle = index % 2 ? '#7fcf6a' : '#74c560';
  ctx.fillRect(x, y, w, cell);
  for (const col of row.flowers ?? []) {
    const fx = x + (col + 0.5) * cell;
    ctx.fillStyle = col % 2 ? '#ffffff' : '#ffd166';
    for (let i = 0; i < 5; i += 1) {
      const a = (i / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(fx + Math.cos(a) * cell * 0.07, y + cell * 0.5 + Math.sin(a) * cell * 0.07, cell * 0.05, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ff8a5b';
    ctx.beginPath();
    ctx.arc(fx, y + cell * 0.5, cell * 0.045, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawGoal(ctx, x, y, w, cell) {
  ctx.fillStyle = '#f3d27a';
  ctx.fillRect(x, y, w, cell);
  // Franja a cuadros de meta.
  const square = cell / 4;
  for (let i = 0; i < w / square; i += 1) {
    ctx.fillStyle = i % 2 ? '#2d2a3a' : '#ffffff';
    ctx.fillRect(x + i * square, y, square, square);
    ctx.fillStyle = i % 2 ? '#ffffff' : '#2d2a3a';
    ctx.fillRect(x + i * square, y + square, square, square);
  }
  // Nido en el centro.
  const cx = x + w / 2;
  const cy = y + cell * 0.68;
  ctx.fillStyle = '#a0672f';
  ctx.beginPath();
  ctx.ellipse(cx, cy, cell * 0.55, cell * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff6e2';
  for (const dx of [-0.18, 0, 0.18]) {
    ctx.beginPath();
    ctx.ellipse(cx + dx * cell, cy - cell * 0.08, cell * 0.09, cell * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawRoad(ctx, rows, index, x, y, w, cell) {
  ctx.fillStyle = '#4a4e5c';
  ctx.fillRect(x, y, w, cell);
  // Líneas discontinuas entre carriles de carretera.
  if (rows[index + 1]?.type === 'road') {
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    for (let i = 0; i < COLS; i += 1) {
      roundRect(ctx, x + i * cell + cell * 0.2, y - 1.5, cell * 0.6, 3, 1.5);
      ctx.fill();
    }
  }
  // Bordillos con las zonas seguras.
  ctx.fillStyle = '#c7c9d1';
  if (rows[index + 1] && rows[index + 1].type !== 'road') ctx.fillRect(x, y, w, 3);
  if (rows[index - 1] && rows[index - 1].type !== 'road') ctx.fillRect(x, y + cell - 3, w, 3);
}

function drawRiver(ctx, x, y, w, cell, time, reduced) {
  ctx.fillStyle = '#3aa7e3';
  ctx.fillRect(x, y, w, cell);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  const shift = reduced ? 0 : (time * 18) % cell;
  for (let i = -1; i < COLS + 1; i += 1) {
    const wx = x + i * cell + shift;
    ctx.beginPath();
    ctx.arc(wx + cell * 0.3, y + cell * 0.55, cell * 0.14, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
  }
}

function drawLog(ctx, px, y, length, cell) {
  const h = cell * 0.62;
  const top = y + (cell - h) / 2;
  ctx.fillStyle = '#9a5b2e';
  roundRect(ctx, px, top, length, h, h / 2);
  ctx.fill();
  ctx.fillStyle = '#b8743f';
  roundRect(ctx, px + 3, top + 3, length - 6, h * 0.35, h * 0.2);
  ctx.fill();
  // Anillos en los extremos.
  ctx.fillStyle = '#d9a46b';
  for (const ex of [px + h * 0.42, px + length - h * 0.42]) {
    ctx.beginPath();
    ctx.ellipse(ex, top + h / 2, h * 0.22, h * 0.36, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawVehicle(ctx, car, dir, px, y, cell) {
  const length = car.len * cell;
  const h = cell * (car.kind === 'truck' ? 0.78 : 0.68);
  const top = y + (cell - h) / 2;
  const color = `hsl(${car.hue ?? 0} 72% 56%)`;
  // Ruedas.
  ctx.fillStyle = '#1f1d27';
  for (const wx of [0.18, car.len - 0.42]) {
    roundRect(ctx, px + wx * cell, top - 3, cell * 0.24, h + 6, 3);
    ctx.fill();
  }
  if (car.kind === 'truck') {
    // Remolque + cabina.
    const cab = cell * 0.7;
    const cabX = dir > 0 ? px + length - cab : px;
    const boxX = dir > 0 ? px : px + cab + 2;
    ctx.fillStyle = '#eef0f5';
    roundRect(ctx, boxX, top, length - cab - 2, h, 6);
    ctx.fill();
    ctx.fillStyle = color;
    roundRect(ctx, cabX, top + 2, cab, h - 4, 8);
    ctx.fill();
    ctx.fillStyle = 'rgba(190,230,255,0.9)';
    roundRect(ctx, dir > 0 ? cabX + cab * 0.55 : cabX + cab * 0.1, top + h * 0.2, cab * 0.32, h * 0.6, 4);
    ctx.fill();
  } else {
    ctx.fillStyle = color;
    roundRect(ctx, px, top, length, h, h * 0.35);
    ctx.fill();
    // Techo y parabrisas (delante según la dirección).
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    roundRect(ctx, px + length * 0.28, top + h * 0.18, length * 0.44, h * 0.64, h * 0.25);
    ctx.fill();
    ctx.fillStyle = 'rgba(190,230,255,0.92)';
    const glass = dir > 0 ? px + length * 0.66 : px + length * 0.2;
    roundRect(ctx, glass, top + h * 0.2, length * 0.14, h * 0.6, 4);
    ctx.fill();
  }
  // Faros delanteros.
  ctx.fillStyle = '#fff3b0';
  const front = dir > 0 ? px + length - 4 : px + 1;
  for (const fy of [0.2, 0.8]) {
    ctx.beginPath();
    ctx.arc(front + 1.5, top + h * fy, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawChicken(ctx, cx, cy, cell, facing, lift, dead) {
  const r = cell * 0.32;
  // Sombra.
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 0.85, r * 0.9, r * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(cx, cy - lift);
  if (dead === 'car') ctx.scale(1.35, 0.42); // aplastada, de dibujos animados
  const flip = facing === 'left' ? -1 : 1;
  ctx.scale(flip, 1);
  // Patas.
  ctx.strokeStyle = '#f08a24';
  ctx.lineWidth = Math.max(2, cell * 0.045);
  ctx.lineCap = 'round';
  for (const lx of [-0.25, 0.2]) {
    ctx.beginPath();
    ctx.moveTo(lx * r, r * 0.6);
    ctx.lineTo(lx * r, r * 1.0);
    ctx.stroke();
  }
  // Cuerpo.
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(0, 0, r, r * 0.92, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(60,40,30,0.25)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Ala.
  ctx.fillStyle = '#efe7da';
  ctx.beginPath();
  ctx.ellipse(-r * 0.2, r * 0.12, r * 0.45, r * 0.32, -0.3, 0, Math.PI * 2);
  ctx.fill();
  // Cresta.
  ctx.fillStyle = '#ef3e4a';
  for (const [dx, s] of [[0.05, 0.2], [0.28, 0.17], [-0.16, 0.16]]) {
    ctx.beginPath();
    ctx.arc(dx * r, -r * 0.9, s * r, 0, Math.PI * 2);
    ctx.fill();
  }
  // Pico.
  ctx.fillStyle = '#f7a325';
  ctx.beginPath();
  ctx.moveTo(r * 0.8, -r * 0.25);
  ctx.quadraticCurveTo(r * 1.25, -r * 0.12, r * 0.8, r * 0.05);
  ctx.closePath();
  ctx.fill();
  // Ojo (en espiral si ha perdido).
  ctx.strokeStyle = '#2b2522';
  ctx.fillStyle = '#2b2522';
  if (dead) {
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 4; a += 0.3) {
      const rr = (a / (Math.PI * 4)) * r * 0.2;
      ctx.lineTo(r * 0.42 + Math.cos(a) * rr, -r * 0.32 + Math.sin(a) * rr);
    }
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(r * 0.45, -r * 0.32, r * 0.11, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Lanza plumas (y gotas si cae al agua) desde un punto. */
export function burst(view, x, y, kind) {
  if (view.reduced) return;
  for (let i = 0; i < 16; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const speed = 40 + Math.random() * 120;
    view.particles.push({
      x,
      y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed - 60,
      spin: Math.random() * 6,
      life: 1,
      kind: kind === 'water' && i % 2 ? 'drop' : 'feather',
    });
  }
}

export function renderChicken(ctx, size, state, view, dt) {
  if (!ctx || !size.width) return;
  view.time += dt;
  const { cell, left } = layoutFor(size);
  const { chicken } = state;
  const lift = chicken.hop ? Math.sin(Math.min(1, chicken.hop.t) * Math.PI) * cell * 0.22 : 0;
  const rowPos = chicken.hop ? chicken.hop.fromRow + (chicken.hop.toRow - chicken.hop.fromRow) * Math.min(1, chicken.hop.t) : chicken.row;

  // Cámara: la gallina en el tercio inferior; sigue con suavidad (al instante con movimiento reducido).
  const target = rowPos - 2.6;
  if (view.camera === null || view.reduced) view.camera = target;
  else view.camera += (target - view.camera) * Math.min(1, dt * 6);
  view.camera = Math.max(-0.5, view.camera);
  const screenY = (row) => size.height - (row - view.camera + 1) * cell;

  ctx.fillStyle = '#5fb24f';
  ctx.fillRect(0, 0, size.width, size.height);
  const width = cell * COLS;
  const first = Math.max(0, Math.floor(view.camera) - 1);
  const last = Math.min(state.rows.length - 1, Math.ceil(view.camera + size.height / cell) + 1);

  for (let i = first; i <= last; i += 1) {
    const row = state.rows[i];
    const y = screenY(i);
    if (row.type === 'grass') drawGrass(ctx, row, i, left, y, width, cell);
    else if (row.type === 'goal') drawGoal(ctx, left, y, width, cell);
    else if (row.type === 'road') drawRoad(ctx, state.rows, i, left, y, width, cell);
    else drawRiver(ctx, left, y, width, cell, view.time, view.reduced);
  }

  // Troncos debajo de la gallina; coches encima de todo lo del suelo.
  ctx.save();
  ctx.beginPath();
  ctx.rect(left, 0, width, size.height);
  ctx.clip();
  for (let i = first; i <= last; i += 1) {
    const row = state.rows[i];
    if (row.type !== 'river') continue;
    for (const log of row.items) drawLog(ctx, left + log.x * cell, screenY(i), log.len * cell, cell);
  }
  const deadKind = state.status === 'dead' ? state.cause : null;
  const cx = left + (chickenX(chicken) + 0.5) * cell;
  const cy = size.height - (rowPos - view.camera + 0.5) * cell;
  const sunk = deadKind === 'water' || deadKind === 'current';
  if (!sunk) drawChicken(ctx, cx, cy, cell, chicken.facing, lift, deadKind);
  for (let i = first; i <= last; i += 1) {
    const row = state.rows[i];
    if (row.type !== 'road') continue;
    for (const car of row.items) drawVehicle(ctx, car, row.dir, left + car.x * cell, screenY(i), cell);
  }
  ctx.restore();

  // Bordes de la cuadrícula en pantallas anchas: setos.
  if (left > 2) {
    ctx.fillStyle = 'rgba(30,70,40,0.35)';
    ctx.fillRect(0, 0, left, size.height);
    ctx.fillRect(left + width, 0, left, size.height);
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

  // Partículas (plumas y gotas).
  view.particles = view.particles.filter((p) => p.life > 0);
  for (const p of view.particles) {
    p.life -= dt * 0.8;
    p.vy += 160 * dt;
    p.vx *= 1 - dt * 1.5;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.spin += dt * 4;
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.spin);
    ctx.fillStyle = p.kind === 'drop' ? '#bfe7ff' : '#ffffff';
    ctx.beginPath();
    if (p.kind === 'drop') ctx.arc(0, 0, cell * 0.06, 0, Math.PI * 2);
    else ctx.ellipse(0, 0, cell * 0.11, cell * 0.04, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

/** Centro en pantalla de la gallina (para lanzar las plumas desde allí). */
export function chickenScreenPoint(size, state, view) {
  const { cell, left } = layoutFor(size);
  const row = logicalRow(state.chicken);
  return { x: left + (chickenX(state.chicken) + 0.5) * cell, y: size.height - (row - (view.camera ?? 0) + 0.5) * cell };
}
