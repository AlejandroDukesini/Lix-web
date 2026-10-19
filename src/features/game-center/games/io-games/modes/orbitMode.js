/** Órbita: configuración para la arena (reglas en engine/orbitEngine.js). */
import { ARENA_RADIUS, TARGET_MASS, TIME_LIMIT, createOrbit, leaderboard, radiusOf, scoreOf, stepOrbit } from '../engine/orbitEngine.js';
import { burst, drawCell, drawDeepBackground, drawParticles, drawSpore, drawVignette, ensureArt, hueOf, trackMotion } from './ioArt.js';

const PLAYER_HUE = 186;

function render(ctx, size, world, view, dt) {
  if (!ctx) return;
  const art = ensureArt(view);
  art.quality.sample(dt);
  const dpr = size.dpr || 1;
  const { width: W, height: H } = size;
  const { player } = world;
  // La cámara se aleja a medida que creces.
  const targetZoom = Math.min(1.4, Math.max(0.45, (Math.min(W, H) / 900) * (60 / (radiusOf(player.mass) + 30)) * 1.6));
  view.zoom = view.zoom ? view.zoom + (targetZoom - view.zoom) * Math.min(1, dt * 2) : targetZoom;
  view.time = (view.time ?? 0) + dt;
  const time = view.time;
  const zoom = view.zoom;
  const toScreen = (x, y) => [W / 2 + (x - player.x) * zoom, H / 2 + (y - player.y) * zoom];
  view.playerScreen = { x: W / 2, y: H / 2 };

  // Placa de cultivo con motas en suspensión (paralaje).
  drawDeepBackground(ctx, art, W, H, player.x * zoom, player.y * zoom, time);

  // Retícula del microscopio, muy tenue: da referencia de movimiento.
  const step = 80 * zoom;
  const ox = (W / 2 - player.x * zoom) % step;
  const oy = (H / 2 - player.y * zoom) % step;
  ctx.strokeStyle = 'rgb(125 249 255 / 0.05)';
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

  // Borde de la placa: membrana luminosa con fuera oscurecido.
  const [cx, cy] = toScreen(0, 0);
  const R = ARENA_RADIUS * zoom;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.arc(cx, cy, R, 0, Math.PI * 2, true);
  ctx.fillStyle = 'rgb(3 4 14 / 0.6)';
  ctx.fill();
  ctx.restore();
  for (const [width, alpha] of [
    [18, 0.12],
    [8, 0.3],
    [2.5, 0.95],
  ]) {
    ctx.strokeStyle = `rgb(255 79 216 / ${alpha})`;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Esporas.
  const sporeSize = Math.max(20, 36 * zoom);
  for (let i = 0; i < world.pellets.length; i += 1) {
    const pellet = world.pellets[i];
    const [x, y] = toScreen(pellet.x, pellet.y);
    if (x < -20 || y < -20 || x > W + 20 || y > H + 20) continue;
    const pulse = view.reduced ? 1 : 1 + Math.sin(time * 3 + i) * 0.12;
    drawSpore(ctx, art, x, y, sporeSize, pellet.hue, dpr, pulse);
  }

  // Entidades, de menor a mayor (las grandes por encima).
  const entities = [player, ...world.bots].filter((e) => e.alive).sort((a, b) => a.mass - b.mass);
  // Absorciones: una célula que desaparece estalla en partículas de su color.
  for (const [id, t] of art.track) {
    const entity = id === 'player' ? player : world.bots.find((b) => b.id === id);
    if (entity && !entity.alive && !t.gone) {
      t.gone = true;
      const [x, y] = toScreen(t.x, t.y);
      burst(art, x, y, entity.isBot ? hueOf(entity.color) : PLAYER_HUE, 1.4, 22, view.reduced);
    }
  }
  for (const entity of entities) {
    const motion = trackMotion(art, entity.id, entity.x, entity.y, dt);
    if (motion.gone) {
      // Ha reaparecido: sin destello por el «crecimiento» desde cero.
      motion.gone = false;
      motion.mass = entity.mass;
    }
    const [x, y] = toScreen(entity.x, entity.y);
    const r = radiusOf(entity.mass) * zoom;
    // Crece de golpe al absorber: un destello en su borde.
    if (motion.mass !== undefined && entity.mass - motion.mass > 4) burst(art, x, y, entity.isBot ? hueOf(entity.color) : PLAYER_HUE, 0.8, 10, view.reduced);
    motion.mass = entity.mass;
    if (x < -r * 1.5 || y < -r * 1.5 || x > W + r * 1.5 || y > H + r * 1.5) continue;
    const hue = entity.isBot ? hueOf(entity.color) : PLAYER_HUE;
    const seed = entity.isBot ? Number(String(entity.id).replace(/\D/g, '')) + 3 || 5 : 1;
    drawCell(ctx, x, y, r, hue, { time, seed, dir: motion, calm: view.reduced });
    if (!entity.isBot) {
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = 'rgb(125 249 255 / 0.8)';
      ctx.lineWidth = Math.max(1.5, r * 0.04);
      ctx.beginPath();
      ctx.arc(x, y, r + 8, time, time + Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // Comparación de tamaño respecto al jugador: los peligrosos llevan un anillo rojo que late.
    if (entity.isBot && entity.mass > player.mass * 1.2) {
      const beat = view.reduced ? 0.9 : 0.6 + 0.4 * Math.abs(Math.sin(time * 4));
      ctx.strokeStyle = `rgb(255 70 90 / ${beat})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, r + 6, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (r > 12) {
      // Etiqueta debajo de la célula (no tapa los ojos), con contorno para leerse sobre cualquier fondo.
      const name = entity.isBot ? entity.name.replace('Bot ', '') : 'Tú';
      ctx.font = `800 ${Math.max(11, Math.min(17, r * 0.36))}px Manrope, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgb(6 8 24 / 0.85)';
      const label = `${name} · ${Math.floor(entity.mass)}`;
      ctx.strokeText(label, x, y + r + 14);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, x, y + r + 14);
      ctx.textBaseline = 'alphabetic';
    }
  }
  drawParticles(ctx, art, dt);
  drawVignette(ctx, art, W, H);
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
