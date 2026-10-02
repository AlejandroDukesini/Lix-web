import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router';
import { AmbientBackground } from './AmbientBackground.jsx';
import { BottomNav, MobileTopBar, Sidebar, SpacesSheet } from '../navigation/Navigation.jsx';
import { AppNotices } from '../feedback/AppNotices.jsx';

/**
 * Estructura de las pantallas principales.
 * Móvil: barra superior + contenido + barra inferior (con área segura de iOS).
 * Escritorio (≥ 960px): barra lateral fija + contenido.
 */
export function AppShell() {
  const [spacesOpen, setSpacesOpen] = useState(false);
  const mainRef = useRef(null);
  const location = useLocation();
  const firstRender = useRef(true);

  // Al cambiar de pantalla: vuelve arriba y lleva el foco al contenido para lectores de pantalla.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (location.hash) return;
    window.scrollTo({ top: 0 });
    mainRef.current?.focus({ preventScroll: true });
  }, [location.pathname, location.hash]);

  return (
    <div className="app-shell">
      <button type="button" className="skip-link" onClick={() => mainRef.current?.focus()}>
        Saltar al contenido
      </button>
      <AmbientBackground />
      <Sidebar />
      <MobileTopBar />
      <main ref={mainRef} id="contenido" className="app-main" tabIndex={-1}>
        <Outlet />
      </main>
      <BottomNav spacesOpen={spacesOpen} onOpenSpaces={() => setSpacesOpen(true)} />
      <SpacesSheet open={spacesOpen} onClose={() => setSpacesOpen(false)} />
      <AppNotices />
    </div>
  );
}
