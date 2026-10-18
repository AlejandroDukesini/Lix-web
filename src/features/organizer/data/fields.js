/**
 * Validadores de campos de la organización personal.
 *
 * Cada constructor devuelve una función `(valor) → { value, error }`. La misma
 * función sirve para dos cosas:
 *   - Validar lo que escribe la persona (modo estricto): `error` se muestra en el formulario.
 *   - Sanear lo que se lee de IndexedDB o de una copia (modo tolerante): si hay
 *     error, se usa `value` (el valor predeterminado) y el problema se anota.
 * Así no hay dos juegos de reglas que puedan contradecirse.
 */
import { parseISODate } from '../../../utils/dates.js';

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;
const COLOR = /^#[0-9a-f]{6}$/i;
const CURRENCY = /^[A-Z]{3}$/;
const ID = /^[A-Za-z0-9:_-]{1,80}$/;

export const MAX_MONEY = 1e13; // en unidades mínimas (centavos): diez billones de centavos.
export const MAX_TAGS = 20;
export const MAX_TAG_LENGTH = 30;

const ok = (value) => ({ value, error: null });
const fail = (value, error) => ({ value, error });
const isBlank = (value) => value === undefined || value === null || value === '';

export function isValidDate(value) {
  return typeof value === 'string' && parseISODate(value) !== null;
}

export function isValidTime(value) {
  return typeof value === 'string' && TIME.test(value);
}

export function isValidDateTime(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && !Number.isNaN(Date.parse(value));
}

export function isValidId(value) {
  return typeof value === 'string' && ID.test(value);
}

/** Texto: recorta espacios, limita longitud y, si `required`, no admite vacío. */
export function text({ max = 200, required = false, fallback = '', label = 'Este campo' } = {}) {
  return (raw) => {
    if (isBlank(raw)) return required ? fail(fallback, `${label} es obligatorio.`) : ok(fallback);
    if (typeof raw !== 'string') return fail(fallback, `${label} no es válido.`);
    const value = max > 400 ? raw.replace(/\r\n?/g, '\n') : raw.trim().replace(/\s+/g, ' ');
    if (required && !value.trim()) return fail(fallback, `${label} es obligatorio.`);
    if (value.length > max) return fail(value.slice(0, max), `${label} admite como máximo ${max.toLocaleString('es')} caracteres.`);
    return ok(value);
  };
}

export function oneOf(values, fallback = values[0], label = 'La opción') {
  return (raw) => (values.includes(raw) ? ok(raw) : isBlank(raw) ? ok(fallback) : fail(fallback, `${label} no es válida.`));
}

export function bool(fallback = false) {
  return (raw) => (typeof raw === 'boolean' ? ok(raw) : ok(fallback));
}

export function int({ min = -Infinity, max = Infinity, required = false, fallback = null, label = 'El número' } = {}) {
  return (raw) => {
    if (isBlank(raw)) return required ? fail(fallback, `${label} es obligatorio.`) : ok(fallback);
    const n = typeof raw === 'string' ? Number(raw) : raw;
    if (!Number.isInteger(n)) return fail(fallback, `${label} debe ser un número entero.`);
    if (n < min || n > max) return fail(fallback, `${label} debe estar entre ${min} y ${max}.`);
    return ok(n);
  };
}

/** Dinero en unidades mínimas (enteros). `allowNegative` solo para saldos iniciales. */
export function money({ required = false, min = 1, allowNegative = false, label = 'El valor' } = {}) {
  const lower = allowNegative ? -MAX_MONEY : min;
  return (raw) => {
    if (isBlank(raw)) return required ? fail(null, `${label} es obligatorio.`) : ok(allowNegative ? 0 : null);
    if (!Number.isSafeInteger(raw)) return fail(allowNegative ? 0 : null, `${label} no es un importe válido.`);
    if (raw < lower) return fail(allowNegative ? 0 : null, allowNegative ? `${label} es demasiado grande.` : `${label} debe ser mayor que cero.`);
    if (raw > MAX_MONEY) return fail(allowNegative ? 0 : null, `${label} es demasiado grande.`);
    return ok(raw);
  };
}

export function date({ required = false, label = 'La fecha' } = {}) {
  return (raw) => {
    if (isBlank(raw)) return required ? fail(null, `${label} es obligatoria.`) : ok(null);
    return isValidDate(raw) ? ok(raw) : fail(null, `${label} no es válida.`);
  };
}

export function time({ label = 'La hora' } = {}) {
  return (raw) => (isBlank(raw) ? ok(null) : isValidTime(raw) ? ok(raw) : fail(null, `${label} no es válida (usa HH:MM).`));
}

export function dateTime({ required = false, label = 'La fecha y hora' } = {}) {
  return (raw) => {
    if (isBlank(raw)) return required ? fail(null, `${label} es obligatoria.`) : ok(null);
    return isValidDateTime(raw) ? ok(new Date(raw).toISOString()) : fail(null, `${label} no es válida.`);
  };
}

export function color(fallback = null) {
  return (raw) => (isBlank(raw) ? ok(fallback) : typeof raw === 'string' && COLOR.test(raw) ? ok(raw.toLowerCase()) : fail(fallback, 'El color no es válido.'));
}

export function currency(fallback = 'COP') {
  return (raw) => (isBlank(raw) ? ok(fallback) : typeof raw === 'string' && CURRENCY.test(raw.toUpperCase()) ? ok(raw.toUpperCase()) : fail(fallback, 'La moneda debe ser un código de 3 letras (COP, USD, EUR…).'));
}

/** Referencia a otra entidad (solo forma; la existencia la comprueba el almacén). */
export function ref({ required = false, label = 'El elemento relacionado' } = {}) {
  return (raw) => {
    if (isBlank(raw)) return required ? fail(null, `${label} es obligatorio.`) : ok(null);
    return isValidId(raw) ? ok(raw) : fail(null, `${label} no es válido.`);
  };
}

export function refs({ max = 50 } = {}) {
  return (raw) => {
    if (isBlank(raw)) return ok([]);
    if (!Array.isArray(raw)) return fail([], 'La lista de elementos relacionados no es válida.');
    const value = [...new Set(raw.filter(isValidId))].slice(0, max);
    return value.length === raw.length ? ok(value) : fail(value, 'Algunos elementos relacionados no son válidos.');
  };
}

/** Normaliza una etiqueta: sin espacios sobrantes ni almohadilla inicial. */
export function cleanTag(tag) {
  return typeof tag === 'string' ? tag.trim().replace(/^#+/, '').replace(/\s+/g, ' ').slice(0, MAX_TAG_LENGTH) : '';
}

/** Lista de textos cortos sin duplicados (sin distinguir mayúsculas): etiquetas, factores, necesidades… */
export function tags({ max = MAX_TAGS } = {}) {
  return (raw) => {
    if (isBlank(raw)) return ok([]);
    if (!Array.isArray(raw)) return fail([], 'La lista no es válida.');
    const seen = new Set();
    const value = [];
    for (const item of raw) {
      const tag = cleanTag(item);
      const key = tag.toLocaleLowerCase('es');
      if (!tag || seen.has(key)) continue;
      seen.add(key);
      value.push(tag);
    }
    if (value.length > max) return fail(value.slice(0, max), `Como máximo ${max} elementos.`);
    return ok(value);
  };
}

export function dates({ max = 500 } = {}) {
  return (raw) => {
    if (isBlank(raw)) return ok([]);
    if (!Array.isArray(raw)) return fail([], 'La lista de fechas no es válida.');
    return ok([...new Set(raw.filter(isValidDate))].sort().slice(-max));
  };
}

export function intList({ min = 0, max = 100000, maxItems = 5 } = {}) {
  return (raw) => {
    if (isBlank(raw)) return ok([]);
    if (!Array.isArray(raw)) return fail([], 'La lista no es válida.');
    const value = [...new Set(raw.filter((n) => Number.isInteger(n) && n >= min && n <= max))].sort((a, b) => a - b);
    if (value.length > maxItems) return fail(value.slice(0, maxItems), `Como máximo ${maxItems} elementos.`);
    return ok(value);
  };
}

/** Lista de objetos validados con `shape` (cada uno con su propio esquema de campos). */
export function list(shape, { max = 50, label = 'La lista' } = {}) {
  return (raw) => {
    if (isBlank(raw)) return ok([]);
    if (!Array.isArray(raw)) return fail([], `${label} no es válida.`);
    const value = [];
    let error = null;
    for (const item of raw.slice(0, max)) {
      const parsed = parseShape(shape, item);
      if (parsed.errors) error ??= Object.values(parsed.errors)[0];
      else value.push(parsed.value);
    }
    if (raw.length > max) error ??= `${label} admite como máximo ${max} elementos.`;
    return error ? fail(value, error) : ok(value);
  };
}

/** Objeto plano de textos (respuestas de reflexión): clave → texto. */
export function textMap({ maxKeys = 20, maxLength = 4000 } = {}) {
  return (raw) => {
    if (isBlank(raw) || typeof raw !== 'object' || Array.isArray(raw)) return ok({});
    const value = {};
    for (const [key, item] of Object.entries(raw).slice(0, maxKeys)) {
      if (isValidId(key) && typeof item === 'string' && item.trim()) value[key] = item.slice(0, maxLength);
    }
    return ok(value);
  };
}

/**
 * Aplica un esquema `{ campo: validador }` a un objeto.
 * Devuelve `{ value, errors }`: `value` siempre está completo (con valores
 * predeterminados donde algo falló) y `errors` es null si todo es válido.
 */
export function parseShape(shape, raw) {
  const source = raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const value = {};
  let errors = null;
  for (const [key, validate] of Object.entries(shape)) {
    const result = validate(source[key], source);
    value[key] = result.value;
    if (result.error) (errors ??= {})[key] = result.error;
  }
  return { value, errors };
}
