/** Territorio: configuración para la arena (reglas en engine/territoryEngine.js). */
import { DIRS, PLAYER_ID, SIZE, TICK, TIME_LIMIT, WIN_SHARE, createTerritory, scoreOf, standings, steer, stepTerritory } from '../engine/territoryEngine.js';
import { drawCell, drawDeepBackground, drawVignette, ensureArt, hueOf } from './ioArt.js';

const PLAYER_COLOR = '#7df9ff';
const percent = (share, digits = 1) => (share * 100).toLocaleString('es', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const colorOf = (world, id) => (id === PLAYER_ID ? PLAYER_COLOR : world.actors.find((a) => a.id === id)?.color ?? '#888');

/**
 * Capa de territorios: se repinta solo cuando el motor avanza un paso (cada
 * TICK), no en cada fotograma. Las zonas parecen colonias en relieve: borde
 * superior iluminado y borde inferior en sombra donde cambia el dueño.
 */
function paintTerritory(layer, world, cell, dpr) {
  const ctx = layer.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const boardSize = cell * SIZE;
  ctx.clearRect(0, 0, boardSize, boardSize);
  const bevel = Math.max(1, cell * 0.16);
  for (let i = 0; i < world.owner.length; i += 1) {
    const owner = world.owner[i];
    if (!owner) continue;
    const gx = i % SIZE;
    const gy = Math.floor(i / SIZE);
    const x = gx * cell;
    const y = gy * cell;
    ctx.fillStyle = colorOf(world, owner);
    ctx.globalAlpha = 0.82;
    ctx.fillRect(x, y, cell, cell);
    ctx.globalAlpha = 1;
    const same = (dx, dy) => {
      const nx = gx + dx;
      const ny = gy + dy;
      return nx >= 0 && ny >= 0 && nx < SIZE && ny < SIZE && world.owner[ny * SIZE + nx] === owner;
    };
    ctx.fillStyle = 'rgb(255 255 255 / 0.38)';
    if (!same(0, -1)) ctx.fillRect(x, y, cell, bevel);
    if (!same(-1, 0)) ctx.fillRect(x, y, bevel, cell);
    ctx.fillStyle = 'rgb(0 0 20 / 0.35)';
    if (!same(0, 1)) ctx.fillRect(x, y + cell - bevel, cell, bevel);
    if (!same(1, 0)) ctx.fillRect(x + cell - bevel, y, bevel, cell);
    // Textura de colonia: puntos sutiles en damero.
    if ((gx + gy) % 3 === 0 && cell >= 6) {
      ctx.fillStyle = 'rgb(255 255 255 / 0.14)';
      ctx.beginPath();
      ctx.arc(x + cell / 2, y + cell / 2, cell * 0.14, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function render(ctx, size, world, view, dt = 0) {
  if (!ctx) return;
  const art = ensureArt(view);
  art.quality.sample(dt);
  view.time = (view.time ?? 0) + dt;
  const time = view.time;
  const { width: W, height: H } = size;
  const dpr = size.dpr || 1;
  // El mapa ocupa el mayor cuadrado posible, dejando sitio al marcador y a la cruceta.
  const cell = Math.floor(Math.min((W - 24) / SIZE, (H - 150) / SIZE));
  const boardSize = cell * SIZE;
  const left = Math.floor((W - boardSize) / 2);
  const top = Math.floor(Math.max(84, (H - boardSize) / 2));

  drawDeepBackground(ctx, art, W, H, 0, 0, time);
  // Tablero: placa de cristal con su sombra.
  ctx.fillStyle = 'rgb(0 0 0 / 0.35)';
  ctx.fillRect(left + 6, top + 8, boardSize, boardSize);
  const plate = ctx.createLinearGradient(left, top, left + boardSize, top + boardSize);
  plate.addColorStop(0, '#1e1a4a');
  plate.addColorStop(1, '#120f30');
  ctx.fillStyle = plate;
  ctx.fillRect(left, top, boardSize, boardSize);

  // Capa de territorios (en caché hasta el siguiente paso del motor).
  const stale = !art.layer || art.layerCell !== cell || art.layerDpr !== dpr || world.acc < (art.lastAcc ?? Infinity) || art.lastOwnerRef !== world.owner;
  if (stale) {
    if (!art.layer || art.layerCell !== cell || art.layerDpr !== dpr) {
      art.layer = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(1, 1) : document.createElement('canvas');
      art.layer.width = Math.ceil(boardSize * dpr);
      art.layer.height = Math.ceil(boardSize * dpr);
      art.layerCell = cell;
      art.layerDpr = dpr;
    }
    paintTerritory(art.layer, world, cell, dpr);
    art.lastOwnerRef = world.owner;
  }
  art.lastAcc = world.acc;
  ctx.drawImage(art.layer, left, top, boardSize, boardSize);

  // Rastros: cadena de cuentas luminosas que laten (se pueden cortar).
  const beat = view.reduced ? 1 : 0.85 + 0.15 * Math.sin(time * 8);
  for (let i = 0; i < world.trail.length; i += 1) {
    const trail = world.trail[i];
    if (!trail) continue;
    const x = left + (i % SIZE) * cell + cell / 2;
    const y = top + Math.floor(i / SIZE) * cell + cell / 2;
    ctx.fillStyle = colorOf(world, trail);
    ctx.globalAlpha = 0.35;
    ctx.fillRect(x - cell / 2, y - cell / 2, cell, cell);
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(x, y, cell * 0.3 * beat, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgb(255 255 255 / 0.7)';
    ctx.beginPath();
    ctx.arc(x - cell * 0.08, y - cell * 0.08, cell * 0.1, 0, Math.PI * 2);
    ctx.fill();
  }

  // Cuadrícula tenue y marco.
  ctx.strokeStyle = 'rgb(255 255 255 / 0.035)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let k = 0; k <= SIZE; k += 1) {
    ctx.moveTo(left + k * cell, top);
    ctx.lineTo(left + k * cell, top + boardSize);
    ctx.moveTo(left, top + k * cell);
    ctx.lineTo(left + boardSize, top + k * cell);
  }
  ctx.stroke();
  for (const [width, alpha] of [
    [8, 0.18],
    [3, 0.9],
  ]) {
    ctx.strokeStyle = `rgb(255 79 216 / ${alpha})`;
    ctx.lineWidth = width;
    ctx.strokeRect(left - 1.5, top - 1.5, boardSize + 3, boardSize + 3);
  }

  // Cabezas: criaturas que miran hacia donde avanzan, adelantadas según el
  // tiempo entre pasos para que el movimiento sea fluido.
  const progress = Math.min(1, world.acc / TICK);
  for (const actor of world.actors) {
    if (!actor.alive) continue;
    const d = DIRS[actor.next] ?? DIRS[actor.dir];
    const x = left + (actor.x + d.dx * progress * 0.6) * cell + cell / 2;
    const y = top + (actor.y + d.dy * progress * 0.6) * cell + cell / 2;
    const hue = actor.id === PLAYER_ID ? 186 : hueOf(colorOf(world, actor.id));
    drawCell(ctx, x, y, cell * 0.85, hue, { time, seed: actor.id, dir: { dx: d.dx, dy: d.dy }, calm: view.reduced });
    if (actor.isBot && cell >= 8) {
      ctx.font = `800 ${Math.max(10, cell * 0.9)}px Manrope, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgb(6 8 24 / 0.85)';
      ctx.strokeText(actor.name, x, y - cell * 1.1);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(actor.name, x, y - cell * 1.1);
    }
  }
  drawVignette(ctx, art, W, H, 0.4);
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
