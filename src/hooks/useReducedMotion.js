import { usePreferences } from '../app/providers/PreferencesProvider.jsx';
import { useMediaQuery } from './useMediaQuery.js';

/**
 * true si hay que reducir el movimiento:
 *  - 'reduced' (Reducidas): siempre.
 *  - 'full' (Activadas): nunca; la persona las pidió expresamente aunque el
 *    sistema tenga las animaciones desactivadas (Windows y muchos móviles).
 *  - 'system': lo que diga el sistema.
 */
export function useReducedMotion() {
  const system = useMediaQuery('(prefers-reduced-motion: reduce)');
  const { preferences } = usePreferences();
  const { motion } = preferences.appearance;
  if (motion === 'full') return false;
  return system || motion === 'reduced';
}
