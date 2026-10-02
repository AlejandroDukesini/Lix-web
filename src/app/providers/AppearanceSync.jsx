import { useLayoutEffect } from 'react';
import { usePreferences } from './PreferencesProvider.jsx';
import { useReducedMotion } from '../../hooks/useReducedMotion.js';
import { INK, PAPER, contrastRatio, readableOn } from '../../utils/color.js';

const THEME_COLOR = { dark: '#120c18', light: '#fbf3f1' };

/** Texto legible sobre un degradado de dos colores: el que mejor contraste mínimo ofrece. */
function readableOnGradient(a, b) {
  const score = (text) => Math.min(contrastRatio(a, text), contrastRatio(b, text));
  return score(INK) >= score(PAPER) ? INK : PAPER;
}

/**
 * Traslada las preferencias de apariencia al documento:
 *  - data-style / data-theme / data-motion en <html> → seleccionan los tokens CSS.
 *  - variables --c-* con la paleta elegida y sus colores de texto derivados.
 * Los componentes nunca usan colores directos: solo leen estos tokens.
 */
export function AppearanceSync() {
  const { preferences } = usePreferences();
  const { style, theme, palette } = preferences.appearance;
  const reduced = useReducedMotion();

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.style = style;
    root.dataset.theme = theme;
    root.dataset.motion = reduced ? 'reduced' : 'full';
    root.style.colorScheme = theme;

    root.style.setProperty('--c-primary', palette.primary);
    root.style.setProperty('--c-secondary', palette.secondary);
    root.style.setProperty('--c-accent', palette.accent);
    root.style.setProperty('--c-ambient', palette.ambient);
    root.style.setProperty('--c-on-primary', readableOn(palette.primary));
    root.style.setProperty('--c-on-secondary', readableOn(palette.secondary));
    root.style.setProperty('--c-on-accent', readableOn(palette.accent));
    root.style.setProperty('--c-on-gradient', readableOnGradient(palette.primary, palette.secondary));

    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme]);
  }, [style, theme, palette, reduced]);

  return null;
}
