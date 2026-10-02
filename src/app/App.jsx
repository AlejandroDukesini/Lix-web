import { lazy, Suspense, useEffect, useState } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router';
import { PreferencesProvider, usePreferences } from './providers/PreferencesProvider.jsx';
import { AppearanceSync } from './providers/AppearanceSync.jsx';
import { ToastProvider } from '../components/feedback/ToastProvider.jsx';
import { ErrorBoundary } from '../components/feedback/ErrorBoundary.jsx';
import { AppShell } from '../components/layout/AppShell.jsx';
import { PresentationExperience } from '../features/presentation/PresentationExperience.jsx';
import { HomePage } from '../features/home/HomePage.jsx';

// Configuración se carga bajo demanda; el Service Worker la precachea igualmente para uso offline.
const SettingsPage = lazy(() => import('../features/settings/SettingsPage.jsx'));

function PageFallback() {
  return (
    <div className="page-loading" role="status">
      <span className="sr-only">Cargando…</span>
    </div>
  );
}

/** Primer inicio: la presentación se muestra antes que cualquier otra pantalla hasta completarla. */
function FirstRunPresentation({ onDone }) {
  const { update } = usePreferences();
  const navigate = useNavigate();
  const finish = () => {
    update('presentation', { completed: true, completedAt: new Date().toISOString() });
    onDone();
    navigate('/', { replace: true });
  };
  return <PresentationExperience mode="first" onFinish={finish} />;
}

/** Reproducción manual desde Inicio o Configuración: no modifica ninguna preferencia. */
function ReplayPresentation() {
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = location.state?.from ?? '/';
  return <PresentationExperience mode="replay" onFinish={() => navigate(returnTo, { replace: true })} />;
}

function AppRoutes() {
  const { preferences, ready } = usePreferences();
  // Se decide una sola vez al abrir la app (cuando las preferencias están listas):
  // si se restablece desde Configuración, la presentación vuelve a aparecer en el
  // siguiente inicio, no en mitad de la sesión.
  const [firstRun, setFirstRun] = useState(() => (ready ? !preferences.presentation.completed : null));

  useEffect(() => {
    if (ready && firstRun === null) setFirstRun(!preferences.presentation.completed);
  }, [ready, firstRun, preferences.presentation.completed]);

  if (firstRun === null) return <div className="boot-splash" role="status" aria-label="Cargando" />;
  if (firstRun) return <FirstRunPresentation onDone={() => setFirstRun(false)} />;

  return (
    <Routes>
      <Route path="/presentacion" element={<ReplayPresentation />} />
      <Route element={<AppShell />}>
        <Route index element={<HomePage />} />
        <Route
          path="ajustes"
          element={
            <Suspense fallback={<PageFallback />}>
              <SettingsPage />
            </Suspense>
          }
        />
        {/* Cualquier ruta desconocida (incluidos módulos futuros) vuelve al inicio. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

/**
 * Raíz de la aplicación.
 * HashRouter (#/ajustes) porque funciona igual en el servidor local, en la app
 * instalada y en cualquier carpeta, sin reglas de reescritura en el servidor.
 */
export function App() {
  return (
    <ErrorBoundary>
      <PreferencesProvider>
        <AppearanceSync />
        <ToastProvider>
          <HashRouter>
            <AppRoutes />
          </HashRouter>
        </ToastProvider>
      </PreferencesProvider>
    </ErrorBoundary>
  );
}
