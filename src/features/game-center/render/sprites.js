/**
 * Caché de sprites para los juegos en Canvas 2D.
 *
 * Los personajes, vehículos y objetos se pintan con detalle (sombreado, brillos,
 * texturas) UNA sola vez en un lienzo fuera de pantalla y después se copian con
 * `drawImage` en cada fotograma. Es el equivalente a un atlas de texturas, pero
 * generado en el propio dispositivo: no hay imágenes que descargar ni que puedan
 * faltar sin conexión, y el coste por fotograma es una copia de mapa de bits.
 *
 * Cada sprite se pinta a la densidad real de la pantalla (dpr) para verse nítido.
 * La caché es acotada (LRU sencillo) y se vacía al salir del juego.
 */

const hasDocument = typeof document !== 'undefined';

function makeCanvas(width, height) {
  if (typeof OffscreenCanvas === 'function') return new OffscreenCanvas(width, height);
  if (!hasDocument) return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/**
 * Crea una caché. `get(key, w, h, paint, dpr)` devuelve { canvas, w, h } con el
 * sprite pintado por `paint(ctx, w, h)` en coordenadas CSS (0…w, 0…h).
 */
export function createSpriteCache(limit = 200) {
  const map = new Map();
  return {
    get(key, w, h, paint, dpr = 1) {
      const fullKey = `${key}|${Math.round(w)}x${Math.round(h)}@${dpr}`;
      const hit = map.get(fullKey);
      if (hit) {
        // Se reinserta para mantener el orden de uso reciente.
        map.delete(fullKey);
        map.set(fullKey, hit);
        return hit;
      }
      const pw = Math.max(1, Math.ceil(w * dpr));
      const ph = Math.max(1, Math.ceil(h * dpr));
      const canvas = makeCanvas(pw, ph);
      const ctx = canvas?.getContext('2d');
      if (!ctx) return null;
      ctx.scale(dpr, dpr);
      paint(ctx, w, h);
      const sprite = { canvas, w, h };
      map.set(fullKey, sprite);
      if (map.size > limit) map.delete(map.keys().next().value);
      return sprite;
    },
    clear() {
      for (const sprite of map.values()) {
        // Libera la memoria del mapa de bits en cuanto sea posible.
        sprite.canvas.width = 0;
        sprite.canvas.height = 0;
      }
      map.clear();
    },
    get size() {
      return map.size;
    },
  };
}

/** Dibuja un sprite con su centro (o el ancla indicada) en (x, y). */
export function blit(ctx, sprite, x, y, ax = 0.5, ay = 0.5) {
  if (!sprite) return;
  ctx.drawImage(sprite.canvas, x - sprite.w * ax, y - sprite.h * ay, sprite.w, sprite.h);
}

/** Igual que blit pero con giro (radianes) y escala opcionales alrededor del ancla. */
export function blitRotated(ctx, sprite, x, y, angle = 0, sx = 1, sy = sx, ax = 0.5, ay = 0.5) {
  if (!sprite) return;
  ctx.save();
  ctx.translate(x, y);
  if (angle) ctx.rotate(angle);
  if (sx !== 1 || sy !== 1) ctx.scale(sx, sy);
  ctx.drawImage(sprite.canvas, -sprite.w * ax, -sprite.h * ay, sprite.w, sprite.h);
  ctx.restore();
}
