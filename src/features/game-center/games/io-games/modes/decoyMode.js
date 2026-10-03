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

function render(ctx, size, world, view, dt) {
  if (!ctx) return;
  const { width: W, height: H } = size;
  const scale = Math.min((W - 24) / (ARENA_RADIUS * 2), (H - 120) / (ARENA_RADIUS * 2));
  const cx = W / 2;
  const cy = Math.max(H / 2, 70 + ARENA_RADIUS * scale);
  const toScreen = (x, y) => [cx + x * scale, cy + y * scale];
  view.time = (view.time ?? 0) + dt;
  view.pops ??= [];

  ctx.fillStyle = '#0b0818';
  ctx.fillRect(0, 0, W, H);
  // Arena con anillos concéntricos
  const floor = ctx.createRadialGradient(cx, cy, 0, cx, cy, ARENA_RADIUS * scale);
  floor.addColorStop(0, '#1d1640');
  floor.addColorStop(1, '#120e2a');
  ctx.fillStyle = floor;
  ctx.beginPath();
  ctx.arc(cx, cy, ARENA_RADIUS * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgb(255 255 255 / 0.05)';
  ctx.lineWidth = 1;
  for (let r = 100; r < ARENA_RADIUS; r += 100) {
    ctx.beginPath();
    ctx.arc(cx, cy, r * scale, 0, Math.PI * 2);
    ctx.stroke();
  }
  // El borde muestra el tiempo que falta para sobrevivir.
  const progress = Math.min(1, world.time / SURVIVE_TIME);
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgb(255 255 255 / 0.12)';
  ctx.beginPath();
  ctx.arc(cx, cy, ARENA_RADIUS * scale + 4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = '#7df9ff';
  ctx.beginPath();
  ctx.arc(cx, cy, ARENA_RADIUS * scale + 4, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
  ctx.stroke();

  // Avisos de entrada
  for (const warning of world.warnings) {
    const [x, y] = toScreen(warning.x, warning.y);
    const t = 1 - warning.in / WARNING_TIME;
    ctx.strokeStyle = `rgb(255 79 216 / ${0.4 + 0.6 * Math.abs(Math.sin(view.time * 12))})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, (DRONE_RADIUS + 10 - t * 6) * scale * 1.4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, (DRONE_RADIUS + 16) * scale * 1.4, -Math.PI / 2, -Math.PI / 2 + t * Math.PI * 2);
    ctx.stroke();
  }

  // Chispas
  for (const spark of world.sparks) {
    const [x, y] = toScreen(spark.x, spark.y);
    const r = 9 * scale * 1.3 * (1 + 0.15 * Math.sin(view.time * 6));
    ctx.fillStyle = '#ffe66d';
    ctx.beginPath();
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2 + view.time;
      const rr = i % 2 ? r * 0.45 : r;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
  }

  // Drones
  for (const drone of world.drones) {
    const [x, y] = toScreen(drone.x, drone.y);
    const r = DRONE_RADIUS * scale * 1.3;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(drone.heading);
    ctx.strokeStyle = 'rgb(255 79 216 / 0.35)';
    ctx.lineWidth = r * 0.5;
    ctx.beginPath();
    ctx.moveTo(-r, 0);
    ctx.lineTo(-r * 3, 0);
    ctx.stroke();
    ctx.fillStyle = '#ff4fd8';
    ctx.shadowColor = '#ff4fd8';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(r * 1.3, 0);
    ctx.lineTo(-r, r);
    ctx.lineTo(-r * 0.5, 0);
    ctx.lineTo(-r, -r);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Explosiones de drones que chocaron
  view.pops = view.pops.filter((p) => p.t < 1);
  for (const pop of view.pops) {
    pop.t += dt * 2;
    const [x, y] = toScreen(pop.x, pop.y);
    ctx.strokeStyle = `rgb(255 230 109 / ${1 - pop.t})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, (10 + pop.t * 40) * scale * 1.3, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Jugador
  const [px, py] = toScreen(world.player.x, world.player.y);
  view.playerScreen = { x: px, y: py };
  const pr = PLAYER_RADIUS * scale * 1.3;
  ctx.fillStyle = world.player.alive ? '#7df9ff' : '#ff6b6b';
  ctx.shadowColor = '#7df9ff';
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.arc(px, py, pr, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(px - pr * 0.3, py - pr * 0.3, pr * 0.35, 0, Math.PI * 2);
  ctx.fill();
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
