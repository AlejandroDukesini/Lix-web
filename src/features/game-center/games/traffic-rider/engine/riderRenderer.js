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
 * Las curvas son solo visuales (desplazan el dibujo); la física es recta, como
 * en Aquapark. Escenarios con contraste suficiente para leer el tráfico.
 */
import { LANES, LANE_W, PHYSICS, ROAD_HALF, sceneAt } from './riderEngine.js';

const CAM_BACK = 7; // metros entre la cámara y la moto
const DRAW_DIST = 240;
const SEG = 6;

const PALETTES = {
  afueras: { skyTop: '#5fb4ff', skyBottom: '#cfeaff', grass: ['#6dbb5a', '#63b051'], road: '#545866', shoulder: ['#e8e8e8', '#d1495b'], line: '#ffffff', prop: '#3f8a4c', sun: '#fff2b0' },
  costa: { skyTop: '#ff8a65', skyBottom: '#ffd59a', grass: ['#e7c98f', '#dcbc80'], road: '#5b5560', shoulder: ['#ffffff', '#3a7bd5'], line: '#fff6e2', prop: '#2e8b6e', sun: '#ffe08a' },
  desierto: { skyTop: '#f2a65a', skyBottom: '#ffe0a3', grass: ['#e3b16a', '#d9a55c'], road: '#6a5d58', shoulder: ['#ffffff', '#e0702c'], line: '#fff1cc', prop: '#5c9a5a', sun: '#fff6cf' },
  ciudad: { skyTop: '#121735', skyBottom: '#33305a', grass: ['#2c3048', '#262a40'], road: '#3c4052', shoulder: ['#c7c9d1', '#ffb347'], line: '#ffe9a8', prop: '#ffd166', sun: '#f4f1ff' },
};
const CAR_COLORS = ['#ff6f91', '#5fb4ff', '#ffc65c', '#5fd6a0', '#b28cff', '#eef0f5', '#ff9f5c'];

export function createRenderState() {
  return { time: 0, reduced: false };
}

/** Curvatura visual de la carretera según la distancia (suave). */
const curveAt = (z) => 0.0011 * Math.sin(z / 420) + 0.0006 * Math.sin(z / 170);

function roundedRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function cameraFor(size, bottomInset) {
  const horizon = Math.round(size.height * 0.36);
  const roadPx = Math.min(size.width * 0.92, size.height * 1.3);
  const bikeScale = roadPx / (ROAD_HALF * 2); // px por metro a la distancia de la moto
  const F = bikeScale * CAM_BACK;
  const bikeY = Math.min(size.height - bottomInset - 24, size.height * 0.86);
  const camH = Math.max(0.8, (bikeY - horizon) / bikeScale);
  return { horizon, F, camH, bikeY, bikeScale };
}

export function renderRide(ctx, size, state, view, bottomInset, dt) {
  if (!ctx || !size.width) return;
  view.time += dt;
  const { width: w, height: h } = size;
  const cam = cameraFor(size, bottomInset);
  const { bike } = state;
  const scene = sceneAt(bike.z);
  const P = PALETTES[scene.id];
  const camZ = bike.z - CAM_BACK;
  const camX = bike.x * 0.75;
  const cx = w / 2;

  // Cielo y horizonte.
  const sky = ctx.createLinearGradient(0, 0, 0, cam.horizon);
  sky.addColorStop(0, P.skyTop);
  sky.addColorStop(1, P.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, cam.horizon + 1);
  ctx.fillStyle = P.sun;
  ctx.beginPath();
  ctx.arc(w * 0.78, cam.horizon * 0.45, Math.min(w, h) * 0.05, 0, Math.PI * 2);
  ctx.fill();
  // Colinas o edificios lejanos (paralaje lento con la distancia).
  ctx.fillStyle = scene.id === 'ciudad' ? '#1c2142' : 'rgba(0,0,0,0.12)';
  const shift = (bike.z * 0.02) % 80;
  for (let i = -1; i < w / 80 + 2; i += 1) {
    const x = i * 80 - shift;
    if (scene.id === 'ciudad') {
      const bh = 20 + ((i * 37) % 50 + 50) % 50;
      ctx.fillRect(x, cam.horizon - bh, 60, bh);
      ctx.fillStyle = '#ffd166';
      for (let k = 0; k < 4; k += 1) ctx.fillRect(x + 8 + (k % 2) * 24, cam.horizon - bh + 8 + Math.floor(k / 2) * 14, 6, 5);
      ctx.fillStyle = '#1c2142';
    } else {
      ctx.beginPath();
      ctx.ellipse(x + 40, cam.horizon, 70, 18 + ((i * 13) % 12), 0, Math.PI, 0);
      ctx.fill();
    }
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
  const startZ = Math.floor(camZ / SEG) * SEG + SEG;
  const segments = [];
  for (let z = startZ + DRAW_DIST; z >= startZ; z -= SEG) segments.push(z);
  for (const z of segments) {
    const far = project(0, z + SEG);
    const near = project(0, Math.max(camZ + 0.8, z));
    if (near.sy <= far.sy) continue;
    const stripe = Math.floor(z / (SEG * 2)) % 2;
    const quad = (xFar, xNear, wFar, wNear, color) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(xFar - wFar, far.sy);
      ctx.lineTo(xFar + wFar, far.sy);
      ctx.lineTo(xNear + wNear, near.sy);
      ctx.lineTo(xNear - wNear, near.sy);
      ctx.closePath();
      ctx.fill();
    };
    ctx.fillStyle = P.grass[stripe];
    ctx.fillRect(0, far.sy, w, near.sy - far.sy + 1);
    quad(far.sx, near.sx, (ROAD_HALF + 0.9) * far.scale, (ROAD_HALF + 0.9) * near.scale, P.shoulder[stripe]);
    quad(far.sx, near.sx, ROAD_HALF * far.scale, ROAD_HALF * near.scale, P.road);
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
    // Elementos del borde cada 48 m (árboles redondeados o farolas).
    if (Math.floor(z) % 48 === 0) {
      for (const side of [-1, 1]) {
        const p = project(side * (ROAD_HALF + 3.5), z);
        const s = p.scale;
        if (scene.id === 'ciudad') {
          ctx.fillStyle = '#8a8fa3';
          ctx.fillRect(p.sx - 0.12 * s, p.sy - 6 * s, 0.24 * s, 6 * s);
          ctx.fillStyle = P.prop;
          ctx.beginPath();
          ctx.arc(p.sx, p.sy - 6 * s, 0.45 * s, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = '#7a5a3a';
          ctx.fillRect(p.sx - 0.2 * s, p.sy - 2.2 * s, 0.4 * s, 2.2 * s);
          ctx.fillStyle = P.prop;
          ctx.beginPath();
          ctx.arc(p.sx, p.sy - 3 * s, 1.4 * s, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  // Tráfico (de lejos a cerca): la trasera de cada vehículo.
  const ahead = state.traffic.filter((v) => v.z - v.length / 2 > camZ + 1).sort((a, b) => b.z - a.z);
  for (const v of ahead) {
    const p = project(v.x, v.z - v.length / 2);
    const s = p.scale;
    const vw = v.width * s;
    const vh = v.height * s;
    const x = p.sx - vw / 2;
    const y = p.sy - vh;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(p.sx, p.sy, vw * 0.6, vh * 0.08 + 1, 0, 0, Math.PI * 2);
    ctx.fill();
    const color = v.kind === 'truck' ? '#eef0f5' : v.kind === 'bus' ? '#ffc65c' : CAR_COLORS[v.id % CAR_COLORS.length];
    ctx.fillStyle = color;
    roundedRect(ctx, x, y, vw, vh, Math.max(2, vw * 0.14));
    ctx.fill();
    ctx.fillStyle = scene.id === 'ciudad' ? 'rgba(20,24,48,0.85)' : 'rgba(30,40,60,0.55)';
    roundedRect(ctx, x + vw * 0.12, y + vh * 0.12, vw * 0.76, vh * (v.kind === 'car' ? 0.32 : 0.22), Math.max(1, vw * 0.06));
    ctx.fill();
    ctx.fillStyle = scene.id === 'ciudad' ? '#ff3b4f' : '#e5484d';
    for (const lx of [0.08, 0.78]) {
      roundedRect(ctx, x + vw * lx, y + vh * 0.6, vw * 0.14, vh * 0.12, 2);
      ctx.fill();
    }
    if (scene.id === 'ciudad') {
      ctx.fillStyle = 'rgba(255,59,79,0.25)';
      ctx.beginPath();
      ctx.ellipse(p.sx, y + vh * 0.66, vw * 0.7, vh * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // La moto: vista trasera, inclinada según el movimiento lateral.
  const bp = project(bike.x, bike.z);
  const s = bp.scale;
  const lean = -(bike.vx / PHYSICS.lateralMax) * 0.32;
  ctx.save();
  ctx.translate(bp.sx, bp.sy);
  ctx.rotate(lean);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 0.7 * s, 0.12 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1f1d27';
  roundedRect(ctx, -0.16 * s, -0.75 * s, 0.32 * s, 0.75 * s, 0.14 * s); // rueda trasera
  ctx.fill();
  ctx.fillStyle = '#ff5a6e';
  roundedRect(ctx, -0.34 * s, -1.25 * s, 0.68 * s, 0.6 * s, 0.22 * s); // carenado
  ctx.fill();
  ctx.fillStyle = '#ff3b4f';
  roundedRect(ctx, -0.14 * s, -0.86 * s, 0.28 * s, 0.1 * s, 0.05 * s); // piloto trasero
  ctx.fill();
  ctx.fillStyle = '#2b3a67';
  roundedRect(ctx, -0.3 * s, -1.95 * s, 0.6 * s, 0.8 * s, 0.24 * s); // espalda del piloto
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, -2.15 * s, 0.27 * s, 0, Math.PI * 2); // casco
  ctx.fill();
  ctx.fillStyle = '#5fb4ff';
  ctx.fillRect(-0.27 * s, -2.2 * s, 0.54 * s, 0.08 * s);
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
