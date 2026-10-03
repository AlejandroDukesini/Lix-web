/** Utilidades vectoriales mínimas para los minijuegos .io. */

export const length = (x, y) => Math.hypot(x, y);

export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** Vector unitario (o cero si es nulo). Si su longitud es menor que 1 se conserva (joystick analógico). */
export function clampUnit(x, y) {
  const l = Math.hypot(x, y);
  if (l === 0) return { x: 0, y: 0 };
  if (l <= 1) return { x, y };
  return { x: x / l, y: y / l };
}

export function normalize(x, y) {
  const l = Math.hypot(x, y);
  return l === 0 ? { x: 0, y: 0 } : { x: x / l, y: y / l };
}

/** Dirección de entrada a partir de teclas pulsadas ({ up, down, left, right }). */
export function vectorFromKeys(keys) {
  const x = (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0);
  const y = (keys.has('down') ? 1 : 0) - (keys.has('up') ? 1 : 0);
  return normalize(x, y);
}

/** Gira el ángulo `current` hacia `target` como mucho `maxStep` radianes. */
export function turnTowards(current, target, maxStep) {
  let diff = target - current;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  if (Math.abs(diff) <= maxStep) return target;
  return current + Math.sign(diff) * maxStep;
}
