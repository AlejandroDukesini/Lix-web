import { usePreferences } from '../app/providers/PreferencesProvider.jsx';
import { useMediaQuery } from './useMediaQuery.js';

/** true si el sistema pide menos movimiento o si se eligió "Reducidas" en Configuración. */
export function useReducedMotion() {
  const system = useMediaQuery('(prefers-reduced-motion: reduce)');
  const { preferences } = usePreferences();
  return system || preferences.appearance.motion === 'reduced';
}
