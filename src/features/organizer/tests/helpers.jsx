import { configure, render } from '@testing-library/react';
import { ensureLoaded } from '../data/store.js';
import userEvent from '@testing-library/user-event';
import { App } from '../../../app/App.jsx';
import { createDefaultPreferences } from '../../../services/preferences/defaults.js';
import { PREFERENCES_KEY } from '../../../services/preferences/preferencesService.js';

// Estas pruebas recorren flujos completos sobre IndexedDB simulado; con toda la suite en paralelo
// (motores de juego incluidos) una espera de 8 s se queda corta. Solo afecta a los archivos que importan este módulo.
configure({ asyncUtilTimeout: 20_000 });

/** Abre la app ya presentada en la ruta indicada, con el almacén ya cargado (y sus datos iniciales creados). */
export async function openApp(hash) {
  await ensureLoaded();
  const prefs = createDefaultPreferences();
  prefs.presentation.completed = true;
  localStorage.setItem(PREFERENCES_KEY, JSON.stringify(prefs));
  window.location.hash = hash;
  const user = userEvent.setup();
  const view = render(<App />);
  return { user, ...view };
}

/**
 * Las pantallas de organización se cargan bajo demanda. Con la suite completa en
 * paralelo, transformar e importar un módulo por primera vez puede tardar más que la
 * espera de una consulta (8 s). Se importan antes, con margen, en `beforeAll`.
 */
export function preloadOrganizerPages() {
  return Promise.all([
    import('../finance/FinancePage.jsx'),
    import('../planner/PlannerPage.jsx'),
    import('../notes/NotesPage.jsx'),
    import('../journal/JournalPage.jsx'),
    import('../emotions/EmotionsPage.jsx'),
    import('../dashboard/DashboardPage.jsx'),
    import('../../settings/SettingsPage.jsx'),
  ]);
}
