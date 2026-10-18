/**
 * Bloqueo con PIN del diario personal y del diario emocional.
 *
 * QUÉ ES: una cortina frente a miradas casuales en un dispositivo compartido. Al abrir
 * esos módulos se pide el PIN; tras unos minutos sin actividad (o al recargar) se vuelve
 * a pedir.
 *
 * QUÉ NO ES: cifrado. Los textos siguen guardados sin cifrar en IndexedDB y alguien con
 * acceso al navegador y conocimientos técnicos podría leerlos (herramientas de desarrollo,
 * copia de seguridad). Así se explica en la interfaz.
 *
 * El PIN nunca se guarda: solo un hash PBKDF2-SHA-256 con sal aleatoria (210 000
 * iteraciones), para que no se pueda leer el PIN mirando los datos.
 */
import { getSettings, saveSettings } from '../data/store.js';

export const PIN_PATTERN = /^\d{4,8}$/;
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 30_000;

let unlockedAt = 0;
let lastActivity = 0;
let failures = 0;
let lockedOutUntil = 0;
const listeners = new Set();

const toHex = (buffer) => [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');

export async function hashPin(pin, saltHex, iterations) {
  const salt = new Uint8Array(saltHex.match(/.{2}/g).map((h) => parseInt(h, 16)));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  return toHex(bits);
}

export function cryptoAvailable() {
  return typeof crypto !== 'undefined' && Boolean(crypto.subtle);
}

function notify() {
  for (const listener of listeners) listener();
}

export function subscribePrivacy(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** ¿Está protegido el módulo y bloqueado ahora? */
export function isLocked(module, settings = getSettings('privacySettings')) {
  if (!settings.pinHash) return false;
  const protectedModule = module === 'journal' ? settings.lockJournal : module === 'emotions' ? settings.lockEmotions : settings.lockJournal || settings.lockEmotions;
  if (!protectedModule) return false;
  if (!unlockedAt) return true;
  if (Date.now() - lastActivity > settings.autoLockMinutes * 60_000) {
    unlockedAt = 0;
    return true;
  }
  return false;
}

export function touchActivity() {
  if (unlockedAt) lastActivity = Date.now();
}

export function lockNow() {
  unlockedAt = 0;
  notify();
}

export function lockoutRemaining() {
  return Math.max(0, lockedOutUntil - Date.now());
}

/** Comprueba el PIN. Tras 5 fallos seguidos hay que esperar 30 s. */
export async function unlock(pin) {
  if (lockoutRemaining()) return { ok: false, wait: lockoutRemaining() };
  const settings = getSettings('privacySettings');
  if (!settings.pinHash) return { ok: true };
  const hash = await hashPin(pin, settings.pinSalt, settings.pinIterations);
  if (hash !== settings.pinHash) {
    failures += 1;
    if (failures >= MAX_ATTEMPTS) {
      failures = 0;
      lockedOutUntil = Date.now() + LOCKOUT_MS;
      return { ok: false, wait: LOCKOUT_MS };
    }
    return { ok: false, attemptsLeft: MAX_ATTEMPTS - failures };
  }
  failures = 0;
  unlockedAt = Date.now();
  lastActivity = unlockedAt;
  notify();
  return { ok: true };
}

export async function setPin(pin, options = {}) {
  if (!PIN_PATTERN.test(pin)) throw new Error('El PIN debe tener entre 4 y 8 números.');
  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
  const iterations = 210_000;
  const pinHash = await hashPin(pin, salt, iterations);
  await saveSettings('privacySettings', { pinHash, pinSalt: salt, pinIterations: iterations, ...options });
  unlockedAt = Date.now();
  lastActivity = unlockedAt;
  notify();
}

export async function removePin() {
  await saveSettings('privacySettings', { pinHash: '', pinSalt: '' });
  unlockedAt = 0;
  notify();
}

/** Solo para pruebas. */
export function __resetPrivacyForTests() {
  unlockedAt = 0;
  lastActivity = 0;
  failures = 0;
  lockedOutUntil = 0;
}
