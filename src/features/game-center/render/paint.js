/**
 * Utilidades de pintura compartidas por los renderizadores Canvas 2D:
 * formas redondeadas, sombras suaves precalculadas, colores derivados y
 * aleatoriedad estable (el mismo detalle aparece siempre en el mismo sitio,
 * sin parpadeos al mover la cámara).
 */

export function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** Número pseudoaleatorio estable en [0, 1) a partir de enteros. */
export function hash(a, b = 0, c = 0) {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Generador con semilla (mulberry32) para pintar sprites con variaciones repetibles. */
export function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Color HSL como texto; `l` se acota a 0…100. */
export const hsl = (h, s, l, a = 1) => `hsl(${h} ${s}% ${Math.max(0, Math.min(100, l))}% / ${a})`;

/** Sombra de contacto suave (degradado radial, sin `shadowBlur`, que es caro en móviles). */
export function contactShadow(ctx, x, y, rx, ry, alpha = 0.3) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, `rgba(0,0,0,${alpha})`);
  g.addColorStop(0.6, `rgba(0,0,0,${alpha * 0.55})`);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Halo luminoso aditivo (faros, chispas, brillos). */
export function glow(ctx, x, y, r, color, alpha = 1) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Degradado lineal vertical con paradas [pos, color]. */
export function vGradient(ctx, y0, y1, stops) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  for (const [pos, color] of stops) g.addColorStop(pos, color);
  return g;
}

/** Degradado lineal horizontal con paradas [pos, color]. */
export function hGradient(ctx, x0, x1, stops) {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  for (const [pos, color] of stops) g.addColorStop(pos, color);
  return g;
}

/**
 * Salpica una zona con motas de color (grano de asfalto, tierra, arena…).
 * Se usa al pintar sprites y texturas en caché, nunca en cada fotograma.
 */
export function speckle(ctx, x, y, w, h, count, colors, rand, size = [0.6, 1.6]) {
  for (let i = 0; i < count; i += 1) {
    ctx.fillStyle = colors[Math.floor(rand() * colors.length)];
    const s = size[0] + rand() * (size[1] - size[0]);
    ctx.fillRect(x + rand() * w, y + rand() * h, s, s);
  }
}
