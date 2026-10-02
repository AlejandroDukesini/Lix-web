/** Utilidades de color: validación hexadecimal y contraste WCAG 2.x. */

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function normalizeHex(value) {
  if (typeof value !== 'string') return null;
  const match = HEX.exec(value.trim());
  if (!match) return null;
  let hex = match[1].toLowerCase();
  if (hex.length === 3) hex = [...hex].map((c) => c + c).join('');
  return `#${hex}`;
}

export function hexToRgb(hex) {
  const normalized = normalizeHex(hex);
  if (!normalized) return null;
  const int = Number.parseInt(normalized.slice(1), 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

function channel(value) {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

export function contrastRatio(a, b) {
  const [l1, l2] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

export const INK = '#1a0f17';
export const PAPER = '#fffaf7';

/** Color de texto legible sobre un fondo dado (el de mayor contraste entre tinta y papel). */
export function readableOn(background) {
  return contrastRatio(background, INK) >= contrastRatio(background, PAPER) ? INK : PAPER;
}
