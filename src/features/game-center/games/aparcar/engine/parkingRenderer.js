/**
 * Dibujo de «Aparcar el carro» en Canvas 2D (vista cenital).
 *
 * El aparcamiento entero cabe en la zona libre del lienzo: se descuentan los
 * márgenes que ocupan el marcador y los controles táctiles (`insets`), así que
 * los botones nunca tapan la plaza ni los obstáculos. Las formas que se dibujan
 * son exactamente los rectángulos del motor: lo que se ve es lo que choca.
 */
import { CAR, PARK_HOLD, corners } from './parkingEngine.js';

export function createRenderState() {
  return { flash: 0, time: 0 };
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

function rounded(ctx, w, h, r) {
  const x = -w / 2;
  const y = -h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Un coche visto desde arriba, centrado en el origen y mirando a +x. */
function drawCar(ctx, length, width, color, { steer = 0, brake = false, reverse = false, lights = true } = {}) {
  // Ruedas (las delanteras giran con el volante).
  ctx.fillStyle = '#1b1a22';
  for (const [wx, front] of [[length * 0.3, true], [-length * 0.3, false]]) {
    for (const wy of [-width / 2, width / 2]) {
      ctx.save();
      ctx.translate(wx, wy);
      if (front) ctx.rotate(steer);
      rounded(ctx, length * 0.2, width * 0.18, width * 0.05);
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.fillStyle = color;
  rounded(ctx, length, width * 0.92, width * 0.3);
  ctx.fill();
  // Techo y lunas.
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.save();
  ctx.translate(-length * 0.05, 0);
  rounded(ctx, length * 0.45, width * 0.7, width * 0.2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = 'rgba(190,230,255,0.9)';
  ctx.save();
  ctx.translate(length * 0.2, 0);
  rounded(ctx, length * 0.12, width * 0.68, width * 0.1);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = 'rgba(190,230,255,0.6)';
  ctx.save();
  ctx.translate(-length * 0.32, 0);
  rounded(ctx, length * 0.08, width * 0.62, width * 0.08);
  ctx.fill();
  ctx.restore();
  if (!lights) return;
  // Faros, luces de freno y de marcha atrás.
  for (const wy of [-width * 0.3, width * 0.3]) {
    ctx.fillStyle = '#fff4b8';
    ctx.beginPath();
    ctx.arc(length / 2 - width * 0.08, wy, width * 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = reverse ? '#ffffff' : brake ? '#ff3b4f' : '#8c1d2a';
    ctx.beginPath();
    ctx.arc(-length / 2 + width * 0.08, wy, width * (brake || reverse ? 0.1 : 0.07), 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawObstacle(ctx, o, s) {
  ctx.save();
  ctx.translate(o.x * s, o.y * s);
  ctx.rotate(o.angle ?? 0);
  if (o.kind === 'car') {
    drawCar(ctx, o.w * s, o.h * s, `hsl(${o.hue ?? 210} 45% 55%)`, { lights: false });
  } else if (o.kind === 'cone') {
    const r = (o.w * s) / 2;
    ctx.fillStyle = '#ff7a1a';
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff7a1a';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2);
    ctx.fill();
  } else if (o.kind === 'planter') {
    ctx.fillStyle = '#8a6a4a';
    rounded(ctx, o.w * s, o.h * s, s * 0.6);
    ctx.fill();
    ctx.fillStyle = '#4f9e5c';
    rounded(ctx, o.w * s - s * 0.6, o.h * s - s * 0.6, s * 0.5);
    ctx.fill();
    ctx.fillStyle = '#3f8a4c';
    for (const [bx, by] of [[-0.25, -0.2], [0.2, 0.15], [-0.1, 0.25], [0.25, -0.25]]) {
      ctx.beginPath();
      ctx.arc(bx * o.w * s, by * o.h * s, s * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.fillStyle = '#9da3ad';
    rounded(ctx, o.w * s, o.h * s, s * 0.2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 1;
    ctx.save();
    ctx.clip();
    for (let k = -o.w; k < o.w + o.h; k += 0.8) {
      ctx.beginPath();
      ctx.moveTo((k - o.w / 2) * s, (-o.h / 2) * s);
      ctx.lineTo((k - o.w / 2 - o.h) * s, (o.h / 2) * s);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
}

function drawSpot(ctx, spot, s, progress, time) {
  ctx.save();
  ctx.translate(spot.x * s, spot.y * s);
  ctx.rotate(spot.angle);
  const w = spot.w * s;
  const h = spot.h * s;
  ctx.fillStyle = `rgba(80, 220, 140, ${0.16 + progress * 0.3})`;
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.strokeStyle = '#5ce39a';
  ctx.lineWidth = Math.max(2, s * 0.12);
  ctx.setLineDash([s * 0.5, s * 0.35]);
  ctx.lineDashOffset = -time * s;
  ctx.strokeRect(-w / 2, -h / 2, w, h);
  ctx.setLineDash([]);
  // Flecha: hacia dónde debe mirar el coche aparcado.
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
  const { level, car } = state;
  const { scale: s, ox, oy } = viewFor(size, level, insets);

  ctx.fillStyle = '#2b2d36';
  ctx.fillRect(0, 0, size.width, size.height);
  ctx.save();
  ctx.translate(ox, oy);

  // Suelo del aparcamiento y bordillo.
  ctx.fillStyle = '#4a4e5c';
  ctx.fillRect(0, 0, level.width * s, level.height * s);
  ctx.strokeStyle = '#d9dbe2';
  ctx.lineWidth = Math.max(3, s * 0.25);
  ctx.strokeRect(0, 0, level.width * s, level.height * s);
  // Líneas de las plazas ocupadas (pintura del suelo).
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = Math.max(1.5, s * 0.08);
  for (const o of level.obstacles.filter((ob) => ob.kind === 'car')) {
    ctx.save();
    ctx.translate(o.x * s, o.y * s);
    ctx.rotate(o.angle);
    ctx.strokeRect((-o.w / 2 - 0.4) * s, (-o.h / 2 - 0.5) * s, (o.w + 0.8) * s, (o.h + 1) * s);
    ctx.restore();
  }

  drawSpot(ctx, level.spot, s, Math.min(1, state.parkTimer / PARK_HOLD), view.time);
  for (const o of level.obstacles) drawObstacle(ctx, o, s);

  // El coche del jugador.
  const moving = Math.abs(car.speed) > 0.05;
  const braking = moving && input.throttle !== 0 && Math.sign(input.throttle) !== Math.sign(car.speed);
  ctx.save();
  ctx.translate(car.x * s, car.y * s);
  ctx.rotate(car.angle);
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = s * 0.6;
  drawCar(ctx, CAR.length * s, CAR.width * s, '#ff5a6e', { steer: car.steer, brake: braking || (!moving && input.throttle < 0 && car.speed === 0), reverse: car.speed < -0.05 });
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
