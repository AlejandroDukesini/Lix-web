import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup, configure } from '@testing-library/react';
import { __resetForTests } from '../services/storage/safeLocalStorage.js';
import { __resetDatabaseForTests, DB_NAME } from '../services/storage/database.js';
import { __resetGameStorageForTests } from '../features/game-center/services/gameStorage.js';

/*
 * jsdom no implementa algunas APIs del navegador. Se simulan aquí con el
 * comportamiento mínimo necesario; las pruebas en navegador real
 * (npm run test:e2e) cubren su funcionamiento verdadero.
 */

// Las pantallas con carga diferida pueden tardar más de 1 s cuando la suite corre en paralelo.
configure({ asyncUtilTimeout: 8000 });

// Movimiento reducido activado: las animaciones y esperas de la presentación se acortan.
let reducedMotion = true;
export function setReducedMotion(value) {
  reducedMotion = value;
}

beforeEach(() => {
  window.matchMedia = vi.fn((query) => ({
    matches: query.includes('prefers-reduced-motion') ? reducedMotion : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  window.scrollTo = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
  HTMLCanvasElement.prototype.getContext = vi.fn(() => null);
});

afterEach(async () => {
  cleanup();
  window.localStorage.clear();
  __resetForTests();
  __resetDatabaseForTests();
  __resetGameStorageForTests();
  await new Promise((resolve) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = request.onerror = request.onblocked = () => resolve();
  });
  window.location.hash = '';
  document.documentElement.removeAttribute('data-style');
  document.documentElement.removeAttribute('data-theme');
  setReducedMotion(true);
});
