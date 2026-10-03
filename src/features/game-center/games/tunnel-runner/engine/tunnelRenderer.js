/**
 * Dibujo de Tunnel Runner en Canvas 2D.
 *
 * Proyección en perspectiva: un punto del túnel a `d` metros de la cámara se
 * dibuja a un radio K / d del centro. El túnel es circular: las paredes son
 * coronas (arcos) divididas en los SIDES carriles del motor, sin aristas. Se
 * rota para que la nave quede siempre abajo; las bandas se colorean según su
 * posición en el mundo (no en pantalla), así que se ven pasar y transmiten la
 * velocidad. La luz cae con la distancia: profundidad sin efectos agresivos.
 *
 * Los obstáculos ocupan exactamente los carriles bloqueados del motor (misma
 * geometría que la colisión), dibujados como sectores de anillo redondeados.
 */
import { SECTOR_LENGTH, SIDES, SIDE_ARC, VIEW_DEPTH, ringOffset } from './tunnelEngine.js';

const CAMERA_BACK = 3.2; // metros entre la cámara y la nave
const BAND = 6; // metros por banda de pared
const NEAR = 1.2;
const HUES = [188, 32, 350, 248, 152, 284];
const SLAB = 1.4; // grosor visual de los obstáculos (m)
const INNER = 0.52; // los obstáculos llegan hasta el 52 % del radio
const LANE_GAP = 0.035; // separación visual entre carriles bloqueados (rad)

export function createRenderState() {
  return { particles: [], flash: 0, shake: 0, time: 0, reduced: false };
}

const hueOf = (distance) => {
  const sector = Math.floor(distance / SECTOR_LENGTH);
  const t = (distance % SECTOR_LENGTH) / SECTOR_LENGTH;
  const a = HUES[sector % HUES.length];
  const b = HUES[(sector + 1) % HUES.length];
  const blend = t > 0.87 ? (t - 0.87) / 0.13 : 0;
  let diff = b - a;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return (a + diff * blend + 360) % 360;
};

export function renderTunnel(ctx, size, state, view, dt = 0) {
  if (!ctx) return;
  const { width: W, height: H } = size;
  const minSide = Math.min(W, H);
  const K = minSide * 0.5 * CAMERA_BACK;
  const shaking = view.shake > 0 && !view.reduced;
  const cx = W / 2 + (shaking ? (Math.random() - 0.5) * view.shake * 10 : 0);
  const cy = H * 0.44 + (shaking ? (Math.random() - 0.5) * view.shake * 10 : 0);
  view.time += dt;
  view.flash = Math.max(0, view.flash - dt * 2.5);
  view.shake = Math.max(0, view.shake - dt * 3);

  const hue = hueOf(state.distance);
  // Curvatura suave: el centro de los anillos lejanos se desplaza.
  const bendX = Math.sin(state.distance * 0.0045) * minSide * 0.0009;
  const bendY = Math.cos(state.distance * 0.0031) * minSide * 0.0006;
  const center = (d) => [cx + bendX * d * d, cy + bendY * d * d];
  const radius = (d) => K / d;
  // Rotación: el carril bajo la nave queda abajo (π/2 en pantalla, con y hacia abajo).
  const rot = Math.PI / 2 - state.angle;

  // Fondo: el final del túnel brilla.
  ctx.fillStyle = `hsl(${hue} 55% 5%)`;
  ctx.fillRect(0, 0, W, H);
  const [fx, fy] = center(VIEW_DEPTH);
  const glow = ctx.createRadialGradient(fx, fy, 0, fx, fy, minSide * 0.32);
  glow.addColorStop(0, `hsl(${hue} 100% 88% / 0.95)`);
  glow.addColorStop(0.18, `hsl(${hue} 90% 60% / 0.35)`);
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  /** Corona entre dos profundidades y dos ángulos (centros distintos por la curvatura). */
  const ringSector = (dFar, dNear, a1, a2, rFarK = 1, rNearK = 1) => {
    const [x1, y1] = center(dFar);
    const [x2, y2] = center(dNear);
    ctx.beginPath();
    ctx.arc(x1, y1, radius(dFar) * rFarK, a1 + rot, a2 + rot);
    ctx.arc(x2, y2, radius(dNear) * rNearK, a2 + rot, a1 + rot, true);
    ctx.closePath();
  };

  // Paredes: bandas de lejos a cerca.
  const offset = state.distance % BAND;
  for (let d = VIEW_DEPTH - offset; d > NEAR; d -= BAND) {
    const near = Math.max(NEAR, d - BAND);
    const worldBand = Math.floor((state.distance + d) / BAND);
    const fog = Math.max(0, 1 - d / VIEW_DEPTH) ** 1.3;
    for (let side = 0; side < SIDES; side += 1) {
      const stripe = (worldBand + side) % 2 === 0;
      ctx.fillStyle = `hsl(${hue} ${stripe ? 62 : 48}% ${5 + fog * (stripe ? 30 : 23)}%)`;
      ringSector(d, near, side * SIDE_ARC, (side + 1) * SIDE_ARC + 0.002);
      ctx.fill();
    }
    // Aro de luz en el borde de la banda.
    const [rx, ry] = center(d);
    ctx.strokeStyle = `hsl(${(hue + 30) % 360} 100% 72% / ${0.08 + fog * 0.45})`;
    ctx.lineWidth = Math.max(1, fog * 2.5);
    ctx.beginPath();
    ctx.arc(rx, ry, radius(d), 0, Math.PI * 2);
    ctx.stroke();
  }

  // Estelas de velocidad: trazos redondeados y tenues.
  const speedFactor = state.speed / 40;
  while (view.particles.length < 40) {
    view.particles.push({ angle: Math.random() * Math.PI * 2, d: NEAR + Math.random() * VIEW_DEPTH * 0.6, r: 0.55 + Math.random() * 0.35 });
  }
  ctx.lineCap = 'round';
  for (const p of view.particles) {
    p.d -= state.speed * dt * 1.4;
    if (p.d < NEAR) {
      p.d = VIEW_DEPTH * (0.3 + Math.random() * 0.4);
      p.angle = Math.random() * Math.PI * 2;
    }
    const tail = p.d + 2 + speedFactor * 3;
    const [x1, y1] = center(p.d);
    const [x2, y2] = center(tail);
    const a = p.angle + rot;
    const fog = Math.max(0, 1 - p.d / VIEW_DEPTH);
    ctx.strokeStyle = `rgb(255 255 255 / ${fog * 0.4})`;
    ctx.lineWidth = Math.max(1, fog * 2.2);
    ctx.beginPath();
    ctx.moveTo(x1 + Math.cos(a) * radius(p.d) * p.r, y1 + Math.sin(a) * radius(p.d) * p.r);
    ctx.lineTo(x2 + Math.cos(a) * radius(tail) * p.r, y2 + Math.sin(a) * radius(tail) * p.r);
    ctx.stroke();
  }

  // Obstáculos de lejos a cerca: sectores de anillo con esquinas redondeadas.
  const accent = (hue + 160) % 360;
  ctx.lineJoin = 'round';
  for (let i = state.rings.length - 1; i >= 0; i -= 1) {
    const ring = state.rings[i];
    const d = ring.z - state.distance + CAMERA_BACK;
    if (d < NEAR || d > VIEW_DEPTH) continue;
    const fog = Math.max(0, 1 - d / VIEW_DEPTH);
    const spin = ringOffset(ring, state.distance);
    const round = Math.max(1, radius(d) * 0.03);
    // Cara trasera (grosor) y cara delantera iluminada.
    for (const [depth, light, alpha] of [
      [d + SLAB, 10 + fog * 16, 1],
      [d, 26 + fog * 40, 0.6 + fog * 0.4],
    ]) {
      ctx.fillStyle = `hsl(${accent} 85% ${light}% / ${alpha})`;
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = round;
      for (let side = 0; side < SIDES; side += 1) {
        if (!ring.blocked[side]) continue;
        const a1 = side * SIDE_ARC + spin + LANE_GAP;
        const a2 = (side + 1) * SIDE_ARC + spin - LANE_GAP;
        ringSector(depth, depth, a1, a2, 1, INNER);
        ctx.fill();
        ctx.stroke();
      }
    }
    // Borde luminoso de los carriles libres: ayuda a leer por dónde pasar.
    const [ox, oy] = center(d);
    ctx.strokeStyle = `hsl(${(hue + 30) % 360} 100% 82% / ${fog * 0.85})`;
    ctx.lineWidth = Math.max(1.5, fog * 4);
    for (const side of ring.gapSides) {
      ctx.beginPath();
      ctx.arc(ox, oy, radius(d) * 0.98, side * SIDE_ARC + spin + rot + 0.04, (side + 1) * SIDE_ARC + spin + rot - 0.04);
      ctx.stroke();
    }
  }

  // Nave: siempre abajo, con forma de gota y cabina, inclinada según el giro.
  const [sx, sy0] = center(CAMERA_BACK);
  const sy = sy0 + radius(CAMERA_BACK) * 0.84;
  const s = minSide * 0.045;
  const tilt = Math.max(-0.4, Math.min(0.4, -state.omega * 0.11));
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(tilt);
  const flame = 0.75 + Math.sin(view.time * 32) * 0.2;
  const thrust = ctx.createRadialGradient(0, s * 0.8, 0, 0, s * 0.8, s * 1.1 * flame);
  thrust.addColorStop(0, `hsl(${(hue + 30) % 360} 100% 85% / 0.9)`);
  thrust.addColorStop(1, 'transparent');
  ctx.fillStyle = thrust;
  ctx.beginPath();
  ctx.arc(0, s * 0.8, s * 1.1 * flame, 0, Math.PI * 2);
  ctx.fill();
  const hull = ctx.createLinearGradient(0, -s, 0, s * 0.7);
  hull.addColorStop(0, '#ffffff');
  hull.addColorStop(1, `hsl(${hue} 60% 78%)`);
  ctx.fillStyle = hull;
  ctx.strokeStyle = `hsl(${hue} 100% 62%)`;
  ctx.lineWidth = Math.max(2, s * 0.1);
  ctx.beginPath();
  ctx.moveTo(0, -s * 1.05);
  ctx.bezierCurveTo(s * 0.55, -s * 0.9, s * 1.35, s * 0.25, s * 1.1, s * 0.55);
  ctx.quadraticCurveTo(0, s * 0.95, -s * 1.1, s * 0.55);
  ctx.bezierCurveTo(-s * 1.35, s * 0.25, -s * 0.55, -s * 0.9, 0, -s * 1.05);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = `hsl(${hue} 90% 40%)`;
  ctx.beginPath();
  ctx.ellipse(0, -s * 0.25, s * 0.28, s * 0.38, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Choque: un velo rojizo breve y suave (sin destellos con movimiento reducido).
  if (view.flash > 0 && !view.reduced) {
    ctx.fillStyle = `rgb(255 80 120 / ${view.flash * 0.3})`;
    ctx.fillRect(0, 0, W, H);
  }
}
