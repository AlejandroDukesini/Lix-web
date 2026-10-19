/** Señuelo: configuración para la arena (reglas en engine/decoyEngine.js). */
import {
  ARENA_RADIUS,
  DRONE_RADIUS,
  PLAYER_RADIUS,
  SURVIVE_TIME,
  WARNING_TIME,
  createDecoy,
  scoreOf,
  stepDecoy,
} from '../engine/decoyEngine.js';
import { burst, drawCell, drawDeepBackground, drawDrone, drawParticles, drawSpore, drawVignette, ensureArt, trackMotion } from './ioArt.js';

function render(ctx, size, world, view, dt) {
  if (!ctx) return;
  const art = ensureArt(view);
  art.quality.sample(dt);
  const dpr = size.dpr || 1;
  const { width: W, height: H } = size;
  const scale = Math.min((W - 24) / (ARENA_RADIUS * 2), (H - 120) / (ARENA_RADIUS * 2));
  const cx = W / 2;
  const cy = Math.max(H / 2, 70 + ARENA_RADIUS * scale);
  const toScreen = (x, y) => [cx + x * scale, cy + y * scale];
  view.time = (view.time ?? 0) + dt;
  const time = view.time;
  view.pops ??= [];

  drawDeepBackground(ctx, art, W, H, 0, 0, time);
  // Placa: cristal con anillos de medida y reflejo.
  const R = ARENA_RADIUS * scale;
  const floor = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.05, cx, cy, R);
  floor.addColorStop(0, 'rgb(60 70 140 / 0.55)');
  floor.addColorStop(0.7, 'rgb(28 24 70 / 0.6)');
  floor.addColorStop(1, 'rgb(14 12 40 / 0.85)');
  ctx.fillStyle = floor;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgb(160 200 255 / 0.07)';
  ctx.lineWidth = 1;
  for (let r = 100; r < ARENA_RADIUS; r += 100) {
    ctx.beginPath();
    ctx.arc(cx, cy, r * scale, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Marcas de graduación en el borde.
  ctx.strokeStyle = 'rgb(160 200 255 / 0.18)';
  ctx.beginPath();
  for (let i = 0; i < 60; i += 1) {
    const a = (i / 60) * Math.PI * 2;
    const k = i % 5 === 0 ? 0.94 : 0.97;
    ctx.moveTo(cx + Math.cos(a) * R * k, cy + Math.sin(a) * R * k);
    ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
  }
  ctx.stroke();

  // El borde muestra el tiempo que falta para sobrevivir.
  const progress = Math.min(1, world.time / SURVIVE_TIME);
  ctx.lineCap = 'round';
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgb(255 255 255 / 0.12)';
  ctx.beginPath();
  ctx.arc(cx, cy, R + 5, 0, Math.PI * 2);
  ctx.stroke();
  for (const [width, alpha] of [
    [14, 0.18],
    [6, 1],
  ]) {
    ctx.lineWidth = width;
    ctx.strokeStyle = `rgb(125 249 255 / ${alpha})`;
    ctx.beginPath();
    ctx.arc(cx, cy, R + 5, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';

  // Avisos de entrada: retícula que se cierra y se carga.
  for (const warning of world.warnings) {
    const [x, y] = toScreen(warning.x, warning.y);
    const t = 1 - warning.in / WARNING_TIME;
    const rr = (DRONE_RADIUS + 16) * scale * 1.4;
    ctx.strokeStyle = `rgb(255 79 216 / ${0.4 + 0.6 * Math.abs(Math.sin(time * 12))})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, (DRONE_RADIUS + 10 - t * 6) * scale * 1.4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, rr, -Math.PI / 2, -Math.PI / 2 + t * Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i < 4; i += 1) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      ctx.moveTo(x + Math.cos(a) * rr * 1.1, y + Math.sin(a) * rr * 1.1);
      ctx.lineTo(x + Math.cos(a) * rr * 1.35, y + Math.sin(a) * rr * 1.35);
    }
    ctx.stroke();
  }

  // Chispas: estrellas doradas que giran.
  for (const spark of world.sparks) {
    const [x, y] = toScreen(spark.x, spark.y);
    const r = 9 * scale * 1.3 * (1 + 0.15 * Math.sin(time * 6));
    drawSpore(ctx, art, x, y, r * 4.5, 48, dpr);
    ctx.fillStyle = '#fff6c0';
    ctx.beginPath();
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2 + time;
      const rr = i % 2 ? r * 0.38 : r;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
  }

  // Drones.
  for (const drone of world.drones) {
    const [x, y] = toScreen(drone.x, drone.y);
    drawDrone(ctx, art, x, y, DRONE_RADIUS * scale * 1.3, drone.heading, time, dpr);
  }

  // Explosiones de drones que chocaron: onda + chispas.
  view.pops = view.pops.filter((p) => p.t < 1);
  for (const pop of view.pops) {
    const [x, y] = toScreen(pop.x, pop.y);
    if (pop.t === 0) {
      burst(art, x, y, 320, 1.2, 18, view.reduced);
      burst(art, x, y, 48, 0.8, 8, view.reduced);
    }
    pop.t += dt * 2;
    ctx.strokeStyle = `rgb(255 230 109 / ${Math.max(0, 1 - pop.t)})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, (10 + pop.t * 40) * scale * 1.3, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Jugador: célula cian que mira hacia donde va.
  const [px, py] = toScreen(world.player.x, world.player.y);
  view.playerScreen = { x: px, y: py };
  const pr = PLAYER_RADIUS * scale * 1.3;
  const motion = trackMotion(art, 'player', world.player.x, world.player.y, dt);
  drawCell(ctx, px, py, pr * 1.15, world.player.alive ? 186 : 0, { time, seed: 1, dir: motion, calm: view.reduced });
  drawParticles(ctx, art, dt);
  drawVignette(ctx, art, W, H, 0.45);
}

export const decoyMode = {
  input: 'vector',
  create: (seed) => createDecoy(seed),
  step(world, input, dt) {
    const events = stepDecoy(world, input, dt);
    // Las explosiones son solo visuales: se pasan al dibujo del siguiente fotograma.
    world.lastPops = [...(world.lastPops ?? []), ...events.filter((e) => e.type === 'pop')];
    return events;
  },
  render(ctx, size, world, view, dt) {
    // Las explosiones se generan a partir de los eventos del paso anterior.
    for (const pop of world.lastPops ?? []) (view.pops ??= []).push({ ...pop, t: 0 });
    world.lastPops = [];
    render(ctx, size, world, view, dt);
  },
  sounds: {
    warning: { wave: 'sine', from: 1200, to: 900, dur: 0.08, gain: 0.04 },
    pop: [
      { noise: true, from: 2000, to: 300, dur: 0.25, gain: 0.25 },
      { wave: 'triangle', from: 600, to: 1200, dur: 0.15, gain: 0.08 },
    ],
    spark: { wave: 'sine', from: 1320, to: 1760, dur: 0.08, gain: 0.07 },
    caught: { wave: 'sawtooth', from: 300, to: 50, dur: 0.6, gain: 0.14 },
    win: [
      { wave: 'triangle', from: 523, dur: 0.15, gain: 0.15 },
      { wave: 'triangle', from: 784, dur: 0.3, gain: 0.15, delay: 0.14 },
    ],
  },
  hud(world) {
    const left = Math.max(0, SURVIVE_TIME - world.time);
    return {
      items: [
        { id: 'time', label: 'Sobrevive', value: `${Math.ceil(left)} s` },
        { id: 'drones', label: 'Drones', value: String(world.drones.length) },
        { id: 'score', label: 'Puntos', value: String(scoreOf(world)) },
      ],
    };
  },
  summary(world) {
    const won = world.result === 'win';
    return {
      won,
      score: scoreOf(world),
      outcome: won ? 'win' : 'lose',
      title: won ? '¡Sobreviviste!' : 'Te alcanzó un dron',
      message: won ? `${SURVIVE_TIME} segundos esquivando el enjambre.` : `Aguantaste ${Math.floor(world.time)} de ${SURVIVE_TIME} segundos. Atrae a los drones para que choquen entre ellos.`,
      stats: [
        { label: 'Drones desintegrados', value: String(world.popped) },
        { label: 'Chispas', value: String(world.collected) },
      ],
    };
  },
};
