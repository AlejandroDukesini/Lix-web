/** Territorio: configuración para la arena (reglas en engine/territoryEngine.js). */
import { DIRS, PLAYER_ID, SIZE, TICK, TIME_LIMIT, WIN_SHARE, createTerritory, scoreOf, standings, steer, stepTerritory } from '../engine/territoryEngine.js';

const PLAYER_COLOR = '#7df9ff';
const percent = (share, digits = 1) => (share * 100).toLocaleString('es', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const colorOf = (world, id) => (id === PLAYER_ID ? PLAYER_COLOR : world.actors.find((a) => a.id === id)?.color ?? '#888');

function render(ctx, size, world, view) {
  if (!ctx) return;
  const { width: W, height: H } = size;
  // El mapa ocupa el mayor cuadrado posible, dejando sitio al marcador y a la cruceta.
  const cell = Math.floor(Math.min((W - 24) / SIZE, (H - 150) / SIZE));
  const boardSize = cell * SIZE;
  const left = Math.floor((W - boardSize) / 2);
  const top = Math.floor(Math.max(84, (H - boardSize) / 2));

  ctx.fillStyle = '#100d24';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#17133a';
  ctx.fillRect(left, top, boardSize, boardSize);

  // Territorios y rastros
  for (let i = 0; i < world.owner.length; i += 1) {
    const owner = world.owner[i];
    const trail = world.trail[i];
    if (!owner && !trail) continue;
    const x = left + (i % SIZE) * cell;
    const y = top + Math.floor(i / SIZE) * cell;
    if (owner) {
      ctx.fillStyle = colorOf(world, owner);
      ctx.globalAlpha = 0.78;
      ctx.fillRect(x, y, cell, cell);
    }
    if (trail) {
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = colorOf(world, trail);
      ctx.fillRect(x + cell * 0.18, y + cell * 0.18, cell * 0.64, cell * 0.64);
    }
  }
  ctx.globalAlpha = 1;

  // Cuadrícula tenue
  ctx.strokeStyle = 'rgb(255 255 255 / 0.04)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let k = 0; k <= SIZE; k += 1) {
    ctx.moveTo(left + k * cell, top);
    ctx.lineTo(left + k * cell, top + boardSize);
    ctx.moveTo(left, top + k * cell);
    ctx.lineTo(left + boardSize, top + k * cell);
  }
  ctx.stroke();
  ctx.strokeStyle = 'rgb(255 79 216 / 0.8)';
  ctx.lineWidth = 3;
  ctx.strokeRect(left - 1.5, top - 1.5, boardSize + 3, boardSize + 3);

  // Cabezas, adelantadas según el tiempo entre pasos para que el movimiento sea fluido.
  const progress = Math.min(1, world.acc / TICK);
  for (const actor of world.actors) {
    if (!actor.alive) continue;
    const d = DIRS[actor.next] ?? DIRS[actor.dir];
    const x = left + (actor.x + d.dx * progress * 0.6) * cell;
    const y = top + (actor.y + d.dy * progress * 0.6) * cell;
    const color = colorOf(world, actor.id);
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.roundRect(x - cell * 0.2, y - cell * 0.2, cell * 1.4, cell * 1.4, cell * 0.35);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Ojos mirando hacia la dirección de avance
    ctx.fillStyle = '#100d24';
    const ex = d.dx * cell * 0.22;
    const ey = d.dy * cell * 0.22;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(x + cell * 0.5 + ex + (d.dy ? side * cell * 0.22 : 0), y + cell * 0.5 + ey + (d.dx ? side * cell * 0.22 : 0), cell * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }
    if (actor.isBot && cell >= 8) {
      ctx.font = `700 ${Math.max(10, cell * 0.9)}px Manrope, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(actor.name, x + cell * 0.5, y - cell * 0.5);
    }
  }
  view.board = { left, top, cell };
}

export const territoryMode = {
  input: 'grid',
  create: (seed) => createTerritory(seed),
  step: (world, _input, dt) => stepTerritory(world, dt),
  steer,
  render,
  sounds: {
    capture: [
      { wave: 'triangle', from: 440, to: 880, dur: 0.16, gain: 0.12 },
      { wave: 'sine', from: 880, dur: 0.12, gain: 0.06, delay: 0.1 },
    ],
    cut: { wave: 'square', from: 900, to: 300, dur: 0.2, gain: 0.08 },
    eliminated: { noise: true, from: 1500, to: 200, dur: 0.3, gain: 0.15 },
    win: [
      { wave: 'triangle', from: 523, dur: 0.15, gain: 0.15 },
      { wave: 'triangle', from: 784, dur: 0.3, gain: 0.15, delay: 0.14 },
    ],
  },
  hud(world) {
    const rows = standings(world);
    const mine = rows.find((r) => r.id === PLAYER_ID);
    const left = Math.max(0, TIME_LIMIT - world.time);
    return {
      items: [
        { id: 'share', label: 'Dominio', value: `${percent(mine.share)} % / ${Math.round(WIN_SHARE * 100)} %` },
        { id: 'time', label: 'Tiempo', value: `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`, tone: left < 20 ? 'warn' : undefined },
      ],
      board: rows.map((row) => ({ id: row.id, name: row.name, value: `${percent(row.share, 0)} %`, isBot: row.isBot })),
    };
  },
  summary(world) {
    const score = scoreOf(world);
    const won = world.result === 'win';
    return {
      won,
      score,
      outcome: won ? 'win' : 'lose',
      title: won ? '¡Territorio conquistado!' : world.result === 'eliminated' ? 'Te han eliminado' : 'Se acabó el tiempo',
      message: won
        ? `Dominaste el ${Math.round(WIN_SHARE * 100)} % del mapa en ${Math.floor(world.time)} s.`
        : world.result === 'eliminated'
          ? 'Cuidado con tu rastro: si alguien lo cruza, o lo pisas tú, se acabó.'
          : `Llegaste a dominar el ${score.toLocaleString('es')} % del mapa.`,
      stats: [{ label: 'Bots eliminados', value: String(world.cuts) }],
    };
  },
};
