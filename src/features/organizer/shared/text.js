import { normalizeText } from '../../library/engine/markdown.js';

export { normalizeText };

/** ¿Contienen los textos todas las palabras de la búsqueda? Sin tildes ni mayúsculas. */
export function matchesQuery(query, ...fields) {
  const words = normalizeText(query ?? '').split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const haystack = normalizeText(fields.flat().filter(Boolean).join(' '));
  return words.every((word) => haystack.includes(word));
}

export function countWords(text) {
  const matches = String(text ?? '').match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu);
  return matches ? matches.length : 0;
}

/** Primera línea útil de un texto largo (para títulos y vistas previas). */
export function excerpt(text, max = 140) {
  const clean = String(text ?? '')
    .replace(/^#+\s*/gm, '')
    .replace(/[*_`>~[\]]/g, '')
    .replace(/\(https?:[^)]*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}
