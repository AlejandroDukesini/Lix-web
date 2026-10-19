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
import { createSpriteCache } from '../../../render/sprites.js';
import { createParticles } from '../../../render/particles.js';
import { createQualityMonitor } from '../../../render/quality.js';
import { glow as addGlow } from '../../../render/paint.js';

const CAMERA_BACK = 3.2; // metros entre la cámara y la nave
const BAND = 6; // metros por banda de pared
const NEAR = 1.2;
const SLAB = 1.4; // grosor visual de los obstáculos (m)
// Hasta dónde llega cada obstáculo hacia el centro (fracción del radio): el tamaño se ve.
const INNER = { ring: 0.52, small: 0.74, medium: 0.6, large: 0.46 };
const BLEND = 80; // metros de fundido entre tramos
const LANE_GAP = 0.035; // separación visual entre carriles bloqueados (rad)

export function createRenderState() {
  return {
    particles: [],
    sparks: createParticles(90),
    sprites: createSpriteCache(40),
    quality: createQualityMonitor(),
    flash: 0,
    lastFlash: 0,
    shake: 0,
    time: 0,
    reduced: false,
  };
}

export function disposeRenderState(view) {
  view.sprites.clear();
  view.sparks.clear();
}

/**
 * Nave vista desde atrás: casco en flecha con alas, cabina de cristal, toberas
 * y líneas de panel. Se pinta una vez por tono de tramo (en pasos de 10°).
 */
function paintShip(ctx, W, H, hue) {
  const cx = W / 2;
  const s = W / 3.2;
  const cy = H * 0.5;
  const wing = ctx.createLinearGradient(0, cy - s * 0.2, 0, cy + s * 0.6);
  wing.addColorStop(0, `hsl(${hue} 30% 88%)`);
  wing.addColorStop(1, `hsl(${hue} 35% 42%)`);
  ctx.strokeStyle = `hsl(${hue} 50% 18%)`;
  ctx.lineWidth = Math.max(1, s * 0.05);
  ctx.lineJoin = 'round';
  for (const k of [-1, 1]) {
    // Ala.
    ctx.fillStyle = wing;
    ctx.beginPath();
    ctx.moveTo(cx + k * s * 0.35, cy - s * 0.2);
    ctx.lineTo(cx + k * s * 1.45, cy + s * 0.32);
    ctx.lineTo(cx + k * s * 1.5, cy + s * 0.5);
    ctx.lineTo(cx + k * s * 0.4, cy + s * 0.48);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Franja de color.
    ctx.fillStyle = `hsl(${hue} 95% 58%)`;
    ctx.beginPath();
    ctx.moveTo(cx + k * s * 0.9, cy + s * 0.12);
    ctx.lineTo(cx + k * s * 1.3, cy + s * 0.32);
    ctx.lineTo(cx + k * s * 1.25, cy + s * 0.4);
    ctx.lineTo(cx + k * s * 0.85, cy + s * 0.22);
    ctx.closePath();
    ctx.fill();
    // Luz de posición en la punta.
    ctx.fillStyle = k < 0 ? '#ff5a6e' : '#5affb4';
    ctx.beginPath();
    ctx.arc(cx + k * s * 1.47, cy + s * 0.42, s * 0.06, 0, Math.PI * 2);
    ctx.fill();
  }
  // Casco central con reflejo metálico.
  const hull = ctx.createLinearGradient(cx - s * 0.6, 0, cx + s * 0.6, 0);
  hull.addColorStop(0, `hsl(${hue} 20% 55%)`);
  hull.addColorStop(0.35, '#ffffff');
  hull.addColorStop(0.7, `hsl(${hue} 25% 80%)`);
  hull.addColorStop(1, `hsl(${hue} 30% 45%)`);
  ctx.fillStyle = hull;
  ctx.beginPath();
  ctx.moveTo(cx, cy - s * 1.0);
  ctx.bezierCurveTo(cx + s * 0.45, cy - s * 0.7, cx + s * 0.62, cy + s * 0.2, cx + s * 0.55, cy + s * 0.62);
  ctx.lineTo(cx - s * 0.55, cy + s * 0.62);
  ctx.bezierCurveTo(cx - s * 0.62, cy + s * 0.2, cx - s * 0.45, cy - s * 0.7, cx, cy - s * 1.0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Líneas de panel.
  ctx.strokeStyle = `hsl(${hue} 30% 30% / 0.45)`;
  ctx.lineWidth = Math.max(0.8, s * 0.025);
  ctx.beginPath();
  ctx.moveTo(cx - s * 0.42, cy + s * 0.2);
  ctx.lineTo(cx + s * 0.42, cy + s * 0.2);
  ctx.moveTo(cx, cy + s * 0.2);
  ctx.lineTo(cx, cy + s * 0.62);
  ctx.stroke();
  // Cabina.
  const glass = ctx.createLinearGradient(0, cy - s * 0.75, 0, cy + s * 0.1);
  glass.addColorStop(0, `hsl(${hue} 90% 85%)`);
  glass.addColorStop(0.5, `hsl(${hue} 80% 40%)`);
  glass.addColorStop(1, `hsl(${hue} 90% 18%)`);
  ctx.fillStyle = glass;
  ctx.strokeStyle = `hsl(${hue} 40% 20%)`;
  ctx.lineWidth = Math.max(1, s * 0.05);
  ctx.beginPath();
  ctx.ellipse(cx, cy - s * 0.3, s * 0.24, s * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath();
  ctx.ellipse(cx - s * 0.08, cy - s * 0.48, s * 0.06, s * 0.16, -0.3, 0, Math.PI * 2);
  ctx.fill();
  // Toberas.
  for (const k of [-1, 1]) {
    const nx = cx + k * s * 0.3;
    const ny = cy + s * 0.66;
    ctx.fillStyle = '#2b2a35';
    ctx.beginPath();
    ctx.ellipse(nx, ny, s * 0.2, s * 0.13, 0, 0, Math.PI * 2);
    ctx.fill();
    const core = ctx.createRadialGradient(nx, ny, 0, nx, ny, s * 0.15);
    core.addColorStop(0, '#ffffff');
    core.addColorStop(0.5, `hsl(${(hue + 30) % 360} 100% 70%)`);
    core.addColorStop(1, `hsl(${(hue + 30) % 360} 100% 40%)`);
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.ellipse(nx, ny, s * 0.13, s * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function burstSparks(view, x, y, hue, scale) {
  if (view.reduced) return;
  const n = view.quality.quality === 'low' ? 18 : 36;
  for (let i = 0; i < n; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const sp = scale * (2 + Math.random() * 7);
    view.sparks.emit({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - scale * 2,
      gravity: scale * 12,
      drag: 1.2,
      decay: 0.9 + Math.random() * 0.8,
      size: scale * (0.05 + Math.random() * 0.08),
      color: i % 3 ? `hsl(${(hue + 160) % 360} 100% 70%)` : '#fff3c4',
    });
  }
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
    // Juntas entre carriles de esta banda: textura de paneles que respeta el
    // orden de dibujo (las bandas cercanas tapan a las lejanas en las curvas).
    const [rx, ry] = center(d);
    if (fog > 0.04) {
      const [nx, ny] = center(near);
      ctx.strokeStyle = `hsl(${look.hue} 60% 3% / ${0.2 + fog * 0.5})`;
      ctx.lineWidth = Math.max(1, fog * 2);
      ctx.beginPath();
      for (let side = 0; side < SIDES; side += 1) {
        const a = side * SIDE_ARC + rot;
        ctx.moveTo(rx + Math.cos(a) * radius(d), ry + Math.sin(a) * radius(d));
        ctx.lineTo(nx + Math.cos(a) * radius(near), ny + Math.sin(a) * radius(near));
      }
      ctx.stroke();
    }
    // Decoración del tramo: aros de luz, farolas en las juntas o enredaderas.
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

  // Luz de los motores sobre el suelo del túnel, bajo la nave.
  const [lx, ly] = center(CAMERA_BACK);
  addGlow(ctx, lx, ly + radius(CAMERA_BACK) * 0.95, minSide * 0.22, `hsl(${(hue + 30) % 360} 100% 60% / 0.55)`);

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
    // Cara trasera (grosor) y cara delantera con relieve: más clara junto al
    // borde interior (donde le da la luz del fondo) y más oscura contra la pared.
    const [gx, gy] = center(d);
    for (const [depth, light, alpha] of [
      [d + SLAB, 10 + fog * 16, 1],
      [d, 26 + fog * 40, 0.6 + fog * 0.4],
    ]) {
      ctx.strokeStyle = `hsl(${accent} 85% ${light}% / ${alpha})`;
      if (depth === d && fog > 0.15) {
        const face = ctx.createRadialGradient(gx, gy, radius(d) * inner, gx, gy, radius(d));
        face.addColorStop(0, `hsl(${accent} 90% ${Math.min(88, light + 22)}% / ${alpha})`);
        face.addColorStop(0.35, `hsl(${accent} 85% ${light}% / ${alpha})`);
        face.addColorStop(1, `hsl(${accent} 80% ${light * 0.55}% / ${alpha})`);
        ctx.fillStyle = face;
      } else {
        ctx.fillStyle = ctx.strokeStyle;
      }
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
    // Arista interior iluminada: separa el bloque del fondo y marca su altura.
    if (fog > 0.1) {
      ctx.strokeStyle = `hsl(${accent} 100% 85% / ${fog * 0.8})`;
      ctx.lineWidth = Math.max(1, fog * 2.5);
      for (let side = 0; side < SIDES; side += 1) {
        if (!ring.blocked[side]) continue;
        ctx.beginPath();
        ctx.arc(gx, gy, radius(d) * inner, side * SIDE_ARC + spin + rot + LANE_GAP + 0.01, (side + 1) * SIDE_ARC + spin + rot - LANE_GAP - 0.01);
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

  // Nave: siempre abajo, inclinada según el giro, con llama viva en las toberas.
  const [sx, sy0] = center(CAMERA_BACK);
  const sy = sy0 + radius(CAMERA_BACK) * 0.84;
  const s = minSide * 0.052;
  const tilt = Math.max(-0.4, Math.min(0.4, -state.omega * 0.11));
  const shipHue = Math.round(hue / 10) * 10;
  const ship = view.sprites.get(`ship${shipHue}`, s * 3.2, s * 2.4, (c, w, h) => paintShip(c, w, h, shipHue), size.dpr || 1);
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(tilt);
  const flame = view.reduced ? 0.85 : 0.75 + Math.sin(view.time * 32) * 0.2;
  // Las toberas del sprite quedan a 0,66·(ancho/3,2) bajo su centro.
  const nozzleY = s * 0.66;
  for (const k of [-1, 1]) {
    const nx = k * s * 0.3;
    const plume = ctx.createLinearGradient(0, nozzleY, 0, nozzleY + s * 1.4 * flame);
    plume.addColorStop(0, `hsl(${(hue + 30) % 360} 100% 88% / 0.95)`);
    plume.addColorStop(1, `hsl(${(hue + 30) % 360} 100% 60% / 0)`);
    ctx.fillStyle = plume;
    ctx.beginPath();
    ctx.moveTo(nx - s * 0.13, nozzleY);
    ctx.quadraticCurveTo(nx, nozzleY + s * 1.7 * flame, nx + s * 0.13, nozzleY);
    ctx.closePath();
    ctx.fill();
  }
  ctx.drawImage(ship.canvas, -ship.w / 2, -ship.h / 2, ship.w, ship.h);
  ctx.restore();

  // Chispas del choque.
  if (view.flash > view.lastFlash + 0.5) burstSparks(view, sx, sy, hue, s);
  view.lastFlash = view.flash;
  ctx.globalCompositeOperation = 'lighter';
  view.sparks.update(dt, (p) => {
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(1, p.size * p.life), 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  // Viñeta: concentra la mirada en el centro del túnel.
  const vignette = view.sprites.get(
    'vignette',
    W,
    H,
    (c, w, h) => {
      const g = c.createRadialGradient(w / 2, h * 0.44, Math.min(w, h) * 0.3, w / 2, h * 0.44, Math.max(w, h) * 0.75);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.5)');
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
    },
    1,
  );
  ctx.drawImage(vignette.canvas, 0, 0, W, H);

  // Choque: un velo rojizo breve y suave (sin destellos con movimiento reducido).
  if (view.flash > 0 && !view.reduced) {
    ctx.fillStyle = `rgb(255 80 120 / ${view.flash * 0.3})`;
    ctx.fillRect(0, 0, W, H);
  }
}
