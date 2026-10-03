/** Órbita: configuración para la arena (reglas en engine/orbitEngine.js). */
import { ARENA_RADIUS, TARGET_MASS, TIME_LIMIT, createOrbit, leaderboard, radiusOf, scoreOf, stepOrbit } from '../engine/orbitEngine.js';

const PLAYER_COLOR = '#7df9ff';

function render(ctx, size, world, view, dt) {
  if (!ctx) return;
  const { width: W, height: H } = size;
  const { player } = world;
  // La cámara se aleja a medida que creces.
  const targetZoom = Math.min(1.4, Math.max(0.45, (Math.min(W, H) / 900) * (60 / (radiusOf(player.mass) + 30)) * 1.6));
  view.zoom = view.zoom ? view.zoom + (targetZoom - view.zoom) * Math.min(1, dt * 2) : targetZoom;
  view.time = (view.time ?? 0) + dt;
  const zoom = view.zoom;
  const toScreen = (x, y) => [W / 2 + (x - player.x) * zoom, H / 2 + (y - player.y) * zoom];
  view.playerScreen = { x: W / 2, y: H / 2 };

  ctx.fillStyle = '#0f0c26';
  ctx.fillRect(0, 0, W, H);
  // Cuadrícula del mundo
  const step = 80 * zoom;
  const ox = (W / 2 - player.x * zoom) % step;
  const oy = (H / 2 - player.y * zoom) % step;
  ctx.strokeStyle = 'rgb(125 249 255 / 0.07)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = ox; x < W; x += step) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
  }
  for (let y = oy; y < H; y += step) {
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
  }
  ctx.stroke();
  // Borde de la arena
  const [cx, cy] = toScreen(0, 0);
  ctx.strokeStyle = 'rgb(255 79 216 / 0.7)';
  ctx.lineWidth = 4;
  ctx.shadowColor = '#ff4fd8';
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.arc(cx, cy, ARENA_RADIUS * zoom, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Partículas
  for (const pellet of world.pellets) {
    const [x, y] = toScreen(pellet.x, pellet.y);
    if (x < -10 || y < -10 || x > W + 10 || y > H + 10) continue;
    ctx.fillStyle = `hsl(${pellet.hue} 95% 65%)`;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(2, 4 * zoom), 0, Math.PI * 2);
    ctx.fill();
  }

  // Entidades, de menor a mayor (las grandes por encima).
  const entities = [player, ...world.bots].filter((e) => e.alive).sort((a, b) => a.mass - b.mass);
  for (const entity of entities) {
    const [x, y] = toScreen(entity.x, entity.y);
    const r = radiusOf(entity.mass) * zoom;
    if (x < -r || y < -r || x > W + r || y > H + r) continue;
    const color = entity.isBot ? entity.color : PLAYER_COLOR;
    const grad = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.35, color);
    grad.addColorStop(1, color);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgb(255 255 255 / 0.5)';
    ctx.lineWidth = Math.max(1.5, r * 0.06);
    ctx.stroke();
    if (!entity.isBot) {
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = 'rgb(125 249 255 / 0.8)';
      ctx.beginPath();
      ctx.arc(x, y, r + 7, view.time, view.time + Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // Comparación de tamaño respecto al jugador: los peligrosos llevan un anillo rojo.
    if (entity.isBot && entity.mass > player.mass * 1.2) {
      ctx.strokeStyle = 'rgb(255 70 90 / 0.9)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, r + 4, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (r > 12) {
      ctx.font = `800 ${Math.max(10, Math.min(18, r * 0.42))}px Manrope, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#0f0c26';
      ctx.fillText(entity.isBot ? entity.name.replace('Bot ', '') : 'Tú', x, y - r * 0.1);
      ctx.font = `700 ${Math.max(9, Math.min(14, r * 0.3))}px Manrope, system-ui, sans-serif`;
      ctx.fillText(String(Math.floor(entity.mass)), x, y + r * 0.32);
      ctx.textBaseline = 'alphabetic';
    }
  }
}

export const orbitMode = {
  input: 'vector',
  create: (seed) => createOrbit(seed),
  step: stepOrbit,
  render,
  sounds: {
    pellet: { wave: 'sine', from: 880, to: 1320, dur: 0.05, gain: 0.04 },
    absorb: [
      { wave: 'triangle', from: 220, to: 660, dur: 0.18, gain: 0.14 },
      { wave: 'sine', from: 660, to: 990, dur: 0.12, gain: 0.08, delay: 0.1 },
    ],
    absorbed: { wave: 'sawtooth', from: 400, to: 60, dur: 0.6, gain: 0.12 },
    win: [
      { wave: 'triangle', from: 523, dur: 0.15, gain: 0.15 },
      { wave: 'triangle', from: 784, dur: 0.3, gain: 0.15, delay: 0.14 },
    ],
  },
  hud(world) {
    const board = leaderboard(world);
    const rank = board.findIndex((row) => !row.isBot) + 1;
    const left = Math.max(0, TIME_LIMIT - world.time);
    return {
      items: [
        { id: 'mass', label: 'Masa', value: `${Math.floor(world.player.mass)} / ${TARGET_MASS}` },
        { id: 'time', label: 'Tiempo', value: `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`, tone: left < 20 ? 'warn' : undefined },
        { id: 'rank', label: 'Puesto', value: rank ? `${rank}.º` : '—' },
      ],
      board: board.slice(0, 5).map((row) => ({ id: row.id, name: row.name, value: row.mass, isBot: row.isBot })),
    };
  },
  summary(world) {
    const score = scoreOf(world);
    const won = world.result === 'win';
    return {
      won,
      score,
      outcome: won ? 'win' : 'lose',
      title: won ? '¡Dominas la órbita!' : world.result === 'absorbed' ? 'Te han absorbido' : 'Se acabó el tiempo',
      message: won
        ? `Alcanzaste ${TARGET_MASS} de masa en ${Math.floor(world.time)} s.`
        : world.result === 'absorbed'
          ? 'Un bot bastante más grande te alcanzó. Vigila los anillos rojos.'
          : `Llegaste a ${score} de masa; el objetivo era ${TARGET_MASS}.`,
      stats: [
        { label: 'Partículas', value: String(world.eaten) },
        { label: 'Bots absorbidos', value: String(world.absorbed) },
      ],
    };
  },
};
