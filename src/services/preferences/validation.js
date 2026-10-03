/**
 * Validación y saneamiento de preferencias.
 *
 * Todo dato que entra al almacenamiento (desde la interfaz, desde localStorage
 * o desde una copia importada) pasa por aquí. Un valor ausente toma el
 * predeterminado en silencio (p. ej. un campo nuevo tras una actualización);
 * un valor presente pero inválido toma el predeterminado y se registra como
 * incidencia para poder informar de la reparación.
 */
import { normalizeHex } from '../../utils/color.js';
import { parseISODate, parseTime, daysBetween } from '../../utils/dates.js';
import {
  createDefaultPreferences,
  DEFAULT_CANDLE_LETTER,
  DEFAULT_PRESENTATION_TEXTS,
  LIMITS,
  PALETTE_PRESETS,
  PREFERENCES_SCHEMA_VERSION,
} from './defaults.js';

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export const PRESENTATION_TEXT_FIELDS = Object.freeze({
  openingLine: { label: 'Primera frase', max: LIMITS.shortText, multiline: false },
  openingReveal: { label: 'Frase que aparece después de la pausa', max: LIMITS.longText, multiline: true },
  starsText: { label: 'Capítulo I · La galaxia', max: LIMITS.longText, multiline: true },
  constellationText: { label: 'Capítulo II · Constelaciones', max: LIMITS.longText, multiline: true },
  galaxyText: { label: 'Capítulo III · La Tierra', max: LIMITS.longText, multiline: true },
  telescopeText: { label: 'Capítulo IV · Telescopio', max: LIMITS.longText, multiline: true },
  eyepieceText: { label: 'Capítulo V · Asomarse', max: LIMITS.shortText, multiline: false },
  candleText: { label: 'Capítulo VI · La vela', max: LIMITS.longText, multiline: true },
  togetherTitle: { label: 'Revelación', max: LIMITS.shortText, multiline: false },
  finalMessage: { label: 'Mensaje final', max: LIMITS.longText, multiline: true },
  signature: { label: 'Firma', max: LIMITS.shortText, multiline: false },
});

const LETTER = /^\p{L}$/u;

/** La letra de la vela: exactamente una letra (se guarda en mayúscula). */
export function validateCandleLetter(raw) {
  const value = typeof raw === 'string' ? raw.trim().toLocaleUpperCase('es') : '';
  if (!value) return { value, error: 'Escribe una letra.' };
  if ([...value].length !== 1 || !LETTER.test(value)) return { value, error: 'Debe ser una sola letra, por ejemplo A.' };
  return { value, error: null };
}

export function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Limpia texto: sin caracteres de control, espacios colapsados y recortado a `max`. */
export function normalizeText(value, { max = LIMITS.longText, multiline = false } = {}) {
  if (typeof value !== 'string') return null;
  let text = value.replace(CONTROL_CHARS, '').replace(/\r\n?/g, '\n');
  text = multiline
    ? text
        .replace(/[ \t]+/g, ' ')
        .replace(/ *\n */g, '\n')
        .replace(/\n{3,}/g, '\n\n')
    : text.replace(/\s+/g, ' ');
  return text.trim().slice(0, max);
}

export function validateNickname(raw, existing = []) {
  const value = normalizeText(raw ?? '', { max: Number.MAX_SAFE_INTEGER });
  if (!value) return { value, error: 'Escribe un apodo.' };
  if (value.length > LIMITS.nicknameLength) {
    return { value, error: `Máximo ${LIMITS.nicknameLength} caracteres (ahora tiene ${value.length}).` };
  }
  const lower = value.toLocaleLowerCase('es');
  if (existing.some((item) => item.toLocaleLowerCase('es') === lower)) {
    return { value, error: 'Ese apodo ya está en la lista.' };
  }
  return { value, error: null };
}

export function validateNicknameList(list) {
  if (!Array.isArray(list) || list.length === 0) return 'Debe haber al menos un apodo.';
  if (list.length > LIMITS.nicknameCount) return `Puedes guardar hasta ${LIMITS.nicknameCount} apodos.`;
  for (let i = 0; i < list.length; i += 1) {
    const { error } = validateNickname(list[i], list.slice(0, i));
    if (error) return `Apodo ${i + 1}: ${error}`;
  }
  return null;
}

export function validatePresentationText(key, raw) {
  const field = PRESENTATION_TEXT_FIELDS[key];
  if (!field) return { value: '', error: 'Campo desconocido.' };
  const value = normalizeText(raw ?? '', { max: Number.MAX_SAFE_INTEGER, multiline: field.multiline });
  if (!value) return { value, error: 'Este texto no puede quedar vacío.' };
  if (value.length > field.max) return { value, error: `Máximo ${field.max} caracteres.` };
  return { value, error: null };
}

export function validateRelationshipStart(raw, now = new Date()) {
  if (raw === null || raw === '') return { value: null, error: null };
  const date = parseISODate(raw);
  if (!date) return { value: null, error: 'La fecha no es válida.' };
  if (date.getFullYear() < 1950) return { value: null, error: 'Elige una fecha posterior a 1950.' };
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (daysBetween(date, today) < 0) return { value: null, error: 'La fecha de inicio no puede estar en el futuro.' };
  return { value: raw, error: null };
}

export function validateCelebrationYear(raw) {
  const year = typeof raw === 'string' ? Number(raw) : raw;
  if (!Number.isInteger(year) || year < 2020 || year > 2100) {
    return { value: null, error: 'Escribe un año entre 2020 y 2100.' };
  }
  return { value: year, error: null };
}

// ---------------------------------------------------------------------------

function createField(issues) {
  return function field(path, value, fallback, check) {
    if (value === undefined) return fallback;
    const result = check(value);
    // `null` es un valor válido en algunos campos ("sin fecha"); solo `undefined` indica error.
    if (result === undefined) {
      issues.push(path);
      return fallback;
    }
    return result;
  };
}

const oneOf = (...options) => (value) => (options.includes(value) ? value : undefined);
const bool = (value) => (typeof value === 'boolean' ? value : undefined);

function sanitizeNicknames(value) {
  if (!Array.isArray(value)) return undefined;
  const clean = [];
  for (const item of value) {
    const { value: nickname, error } = validateNickname(typeof item === 'string' ? item : '', clean);
    if (!error) clean.push(nickname);
    if (clean.length === LIMITS.nicknameCount) break;
  }
  return clean.length > 0 ? clean : undefined;
}

function sanitizePalette(value) {
  if (!isPlainObject(value)) return undefined;
  const palette = {};
  for (const key of ['primary', 'secondary', 'accent', 'ambient']) {
    const hex = normalizeHex(value[key]);
    if (!hex) return undefined;
    palette[key] = hex;
  }
  return palette;
}

function sanitizeIsoDateTime(value) {
  if (value === null) return null;
  return typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : undefined;
}

/**
 * Devuelve unas preferencias completas y válidas a partir de cualquier entrada,
 * junto con la lista de rutas que tuvieron que repararse.
 */
export function sanitizePreferences(input, now = new Date()) {
  const defaults = createDefaultPreferences(now);
  const issues = [];
  if (!isPlainObject(input)) {
    return { value: defaults, issues: input === null || input === undefined ? [] : ['(raíz)'] };
  }
  const field = createField(issues);
  const section = (name) => {
    const value = input[name];
    if (value === undefined) return {};
    if (!isPlainObject(value)) {
      issues.push(name);
      return {};
    }
    return value;
  };

  const profile = section('profile');
  const appearance = section('appearance');
  const presentation = section('presentation');
  const calendar = section('calendar');
  const dates = section('dates');
  const texts = isPlainObject(presentation.texts) ? presentation.texts : {};
  if (presentation.texts !== undefined && !isPlainObject(presentation.texts)) issues.push('presentation.texts');

  const sanitizedTexts = {};
  for (const key of Object.keys(DEFAULT_PRESENTATION_TEXTS)) {
    sanitizedTexts[key] = field(`presentation.texts.${key}`, texts[key], defaults.presentation.texts[key], (v) => {
      const { value, error } = validatePresentationText(key, v);
      return error ? undefined : value;
    });
  }

  const paletteIds = [...PALETTE_PRESETS.map((p) => p.id), 'custom'];

  const value = {
    schemaVersion: PREFERENCES_SCHEMA_VERSION,
    profile: {
      nicknames: field('profile.nicknames', profile.nicknames, defaults.profile.nicknames, sanitizeNicknames),
      rotateNicknames: field('profile.rotateNicknames', profile.rotateNicknames, true, bool),
    },
    appearance: {
      style: field('appearance.style', appearance.style, defaults.appearance.style, oneOf('glass', 'maximal')),
      theme: field('appearance.theme', appearance.theme, defaults.appearance.theme, oneOf('dark', 'light')),
      paletteId: field('appearance.paletteId', appearance.paletteId, defaults.appearance.paletteId, oneOf(...paletteIds)),
      palette: field('appearance.palette', appearance.palette, defaults.appearance.palette, sanitizePalette),
      motion: field('appearance.motion', appearance.motion, defaults.appearance.motion, oneOf('system', 'reduced')),
    },
    presentation: {
      completed: field('presentation.completed', presentation.completed, false, bool),
      completedAt: field('presentation.completedAt', presentation.completedAt, null, sanitizeIsoDateTime),
      candleLetter: field('presentation.candleLetter', presentation.candleLetter, DEFAULT_CANDLE_LETTER, (v) => {
        const { value, error } = validateCandleLetter(v);
        return error ? undefined : value;
      }),
      texts: sanitizedTexts,
    },
    calendar: {
      weekStartsOn: field('calendar.weekStartsOn', calendar.weekStartsOn, defaults.calendar.weekStartsOn, oneOf(0, 1)),
    },
    dates: {
      relationshipStart: field('dates.relationshipStart', dates.relationshipStart, defaults.dates.relationshipStart, (v) => {
        const { value: date, error } = validateRelationshipStart(v, now);
        return error ? undefined : date;
      }),
      celebrationYear: field('dates.celebrationYear', dates.celebrationYear, defaults.dates.celebrationYear, (v) => {
        const { value: year, error } = validateCelebrationYear(v);
        return error ? undefined : year;
      }),
      celebrationTime: field('dates.celebrationTime', dates.celebrationTime, defaults.dates.celebrationTime, (v) =>
        parseTime(v) ? v : undefined,
      ),
      hourCycle: field('dates.hourCycle', dates.hourCycle, defaults.dates.hourCycle, oneOf('12', '24')),
    },
    updatedAt: field('updatedAt', input.updatedAt, null, sanitizeIsoDateTime),
  };

  if (value.presentation.completed === false) value.presentation.completedAt = null;

  return { value, issues };
}
