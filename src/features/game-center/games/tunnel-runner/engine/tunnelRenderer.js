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
 * Su altura depende del tamaño (los pequeños son bajos, los grandes casi tapan
 * el carril) y los rápidos llevan estela y un borde de aviso.
 *
 * Tramos de 1000 m (ZONES): cada banda de pared se pinta con el tramo al que
 * pertenece en el mundo, así el nuevo aspecto aparece al fondo y llega poco a
 * poco hasta la nave; el color se funde en los 80 m alrededor del cambio.
 */
import { SIDES, SIDE_ARC, VIEW_DEPTH, ZONE_LENGTH, obstacleZ, ringOffset, zoneAt, zoneOf } from './tunnelEngine.js';

const CAMERA_BACK = 3.2; // metros entre la cámara y la nave
const BAND = 6; // metros por banda de pared
const NEAR = 1.2;
const SLAB = 1.4; // grosor visual de los obstáculos (m)
// Hasta dónde llega cada obstáculo hacia el centro (fracción del radio): el tamaño se ve.
const INNER = { ring: 0.52, small: 0.74, medium: 0.6, large: 0.46 };
const BLEND = 80; // metros de fundido entre tramos
const LANE_GAP = 0.035; // separación visual entre carriles bloqueados (rad)

export function createRenderState() {
  return { particles: [], flash: 0, shake: 0, time: 0, reduced: false };
}

const mixHue = (a, b, t) => {
  let diff = b - a;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return (a + diff * t + 360) % 360;
};

/** Aspecto del túnel en una posición del mundo: tramo + fundido con el siguiente. */
export function lookAt(position) {
  const index = zoneAt(position);
  const zone = zoneOf(index);
  const into = position - index * ZONE_LENGTH;
  const t = into > ZONE_LENGTH - BLEND ? (into - (ZONE_LENGTH - BLEND)) / BLEND : 0;
  if (!t) return { zone, hue: zone.hue, sat: zone.sat, light: zone.light, t: 0 };
  const next = zoneOf(index + 1);
  return {
    zone: t > 0.5 ? next : zone,
    hue: mixHue(zone.hue, next.hue, t),
    sat: zone.sat + (next.sat - zone.sat) * t,
    light: zone.light + (next.light - zone.light) * t,
    t,
  };
}

/** Variación de luz de cada carril según el dibujo de pared del tramo. */
function wallShade(pattern, band, side, time) {
  switch (pattern) {
    case 'ribs':
      return band % 3 === 0 ? 1 : side % 2 ? 0.45 : 0.55;
    case 'spiral':
      return (band + side) % 4 < 2 ? 1 : 0.5;
    case 'panels':
      return side % 3 === 0 ? 0.35 : band % 2 ? 0.8 : 0.7;
    case 'checker':
      return (Math.floor(band / 2) + Math.floor(side / 2)) % 2 ? 0.95 : 0.5;
    case 'pulse':
      return 0.55 + 0.4 * (0.5 + 0.5 * Math.sin(time * 2.4 + band * 0.7));
    default:
      return (band + side) % 2 === 0 ? 1 : 0.62;
  }
}

const AMBIENT = {
  streaks: { color: '255 255 255', speed: 1.4, length: 1 },
  embers: { color: '255 170 90', speed: 0.9, length: 0.35 },
  bubbles: { color: '255 210 225', speed: 0.7, length: 0.15 },
  snow: { color: '235 248 255', speed: 0.6, length: 0.12 },
  fireflies: { color: '210 255 140', speed: 0.5, length: 0.1 },
  stars: { color: '230 210 255', speed: 1.1, length: 0.5 },
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

  const here = lookAt(state.distance);
  const far = lookAt(state.distance + VIEW_DEPTH);
  const hue = here.hue;
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
  // La luz del fondo es la del tramo que viene: anuncia el cambio antes de llegar.
  const glow = ctx.createRadialGradient(fx, fy, 0, fx, fy, minSide * 0.32 * far.light);
  glow.addColorStop(0, `hsl(${far.hue} 100% 88% / 0.95)`);
  glow.addColorStop(0.18, `hsl(${far.hue} 90% 60% / 0.35)`);
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
    const look = lookAt(state.distance + d);
    const { pattern, deco } = look.zone;
    for (let side = 0; side < SIDES; side += 1) {
      const shade = wallShade(pattern, worldBand, side, view.time);
      ctx.fillStyle = `hsl(${look.hue} ${look.sat * (0.75 + shade * 0.25)}% ${(5 + fog * 32 * shade) * look.light}%)`;
      ringSector(d, near, side * SIDE_ARC, (side + 1) * SIDE_ARC + 0.002);
      ctx.fill();
    }
    // Decoración del tramo: aros de luz, farolas en las juntas o enredaderas.
    const [rx, ry] = center(d);
    if (deco === 'rims' || worldBand % 3 === 0) {
      ctx.strokeStyle = `hsl(${(look.hue + 30) % 360} 100% 72% / ${0.08 + fog * 0.45})`;
      ctx.lineWidth = Math.max(1, fog * (deco === 'rims' ? 2.5 : 1.5));
      ctx.beginPath();
      ctx.arc(rx, ry, radius(d), 0, Math.PI * 2);
      ctx.stroke();
    }
    if (deco === 'lamps' && worldBand % 4 === 0 && fog > 0.05) {
      ctx.fillStyle = `hsl(${(look.hue + 40) % 360} 100% 80% / ${0.25 + fog * 0.7})`;
      for (let side = 0; side < SIDES; side += 3) {
        const a = side * SIDE_ARC + rot;
        ctx.beginPath();
        ctx.arc(rx + Math.cos(a) * radius(d) * 0.97, ry + Math.sin(a) * radius(d) * 0.97, Math.max(1.5, fog * radius(d) * 0.025), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (deco === 'vines' && fog > 0.05) {
      ctx.strokeStyle = `hsl(${(look.hue + 20) % 360} 70% 45% / ${fog * 0.8})`;
      ctx.lineWidth = Math.max(1, fog * 3);
      for (let side = (worldBand % 2) * 2; side < SIDES; side += 4) {
        const a = side * SIDE_ARC + rot + Math.sin(worldBand * 1.3) * 0.08;
        const [nx, ny] = center(near);
        ctx.beginPath();
        ctx.moveTo(rx + Math.cos(a) * radius(d) * 0.99, ry + Math.sin(a) * radius(d) * 0.99);
        ctx.lineTo(nx + Math.cos(a + 0.05) * radius(near) * 0.99, ny + Math.sin(a + 0.05) * radius(near) * 0.99);
        ctx.stroke();
      }
    }
  }

  // Ambiente del tramo: estelas, brasas, burbujas, nieve, luciérnagas o estrellas.
  const ambient = AMBIENT[here.zone.ambient] ?? AMBIENT.streaks;
  const speedFactor = (state.speed / 40) * ambient.length;
  while (view.particles.length < 40) {
    view.particles.push({ angle: Math.random() * Math.PI * 2, d: NEAR + Math.random() * VIEW_DEPTH * 0.6, r: 0.55 + Math.random() * 0.35 });
  }
  ctx.lineCap = 'round';
  for (const p of view.particles) {
    p.d -= state.speed * dt * ambient.speed;
    if (p.d < NEAR) {
      p.d = VIEW_DEPTH * (0.3 + Math.random() * 0.4);
      p.angle = Math.random() * Math.PI * 2;
    }
    const tail = p.d + 2 + speedFactor * 3;
    const [x1, y1] = center(p.d);
    const [x2, y2] = center(tail);
    const a = p.angle + rot;
    const fog = Math.max(0, 1 - p.d / VIEW_DEPTH);
    ctx.strokeStyle = `rgb(${ambient.color} / ${fog * (ambient.length < 0.3 ? 0.75 : 0.4)})`;
    ctx.lineWidth = Math.max(1, fog * (ambient.length < 0.3 ? 4 : 2.2));
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
    const d = obstacleZ(ring, state.distance) - state.distance + CAMERA_BACK;
    if (d < NEAR || d > VIEW_DEPTH) continue;
    const fog = Math.max(0, 1 - d / VIEW_DEPTH);
    const spin = ringOffset(ring, state.distance);
    const round = Math.max(1, radius(d) * 0.03);
    const inner = INNER[ring.size] ?? INNER.ring;
    const fast = ring.approach > 0;
    // Estela de los rápidos: copias tenues detrás, en la dirección de la que vienen.
    if (fast && !view.reduced) {
      for (let k = 3; k >= 1; k -= 1) {
        const back = d + k * 3.2;
        if (back > VIEW_DEPTH) continue;
        ctx.fillStyle = `hsl(${(accent + 20) % 360} 95% 60% / ${0.12 * (4 - k) * fog})`;
        for (let side = 0; side < SIDES; side += 1) {
          if (!ring.blocked[side]) continue;
          ringSector(back, back, side * SIDE_ARC + spin + LANE_GAP, (side + 1) * SIDE_ARC + spin - LANE_GAP, 1, inner);
          ctx.fill();
        }
      }
    }
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
        ringSector(depth, depth, a1, a2, 1, inner);
        ctx.fill();
        ctx.stroke();
      }
    }
    // Borde de aviso (amarillo) en los rápidos: se distinguen de lejos.
    if (fast) {
      ctx.strokeStyle = `hsl(48 100% 62% / ${0.35 + fog * 0.65})`;
      ctx.lineWidth = Math.max(1.5, radius(d) * 0.02);
      for (let side = 0; side < SIDES; side += 1) {
        if (!ring.blocked[side]) continue;
        const [ox, oy] = center(d);
        ctx.beginPath();
        ctx.arc(ox, oy, radius(d) * inner, side * SIDE_ARC + spin + rot + LANE_GAP, (side + 1) * SIDE_ARC + spin + rot - LANE_GAP);
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
