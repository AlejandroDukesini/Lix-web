import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';
import { ProfileSection } from './sections/ProfileSection.jsx';
import { PresentationSection } from './sections/PresentationSection.jsx';
import { AppearanceSection } from './sections/AppearanceSection.jsx';
import { ColorsSection } from './sections/ColorsSection.jsx';
import { CalendarSection } from './sections/CalendarSection.jsx';
import { DatesSection } from './sections/DatesSection.jsx';
import { InstallSection } from './sections/InstallSection.jsx';
import { DataSection } from './sections/DataSection.jsx';
import { PrivacySection } from './sections/PrivacySection.jsx';
import { HorizontalScroller } from '../../components/common/HorizontalScroller.jsx';
import { cx } from '../../utils/cx.js';
import './settings.css';

const SECTIONS = [
  { id: 'apodos', label: 'Apodos' },
  { id: 'presentacion', label: 'Presentación' },
  { id: 'apariencia', label: 'Estilo y tema' },
  { id: 'colores', label: 'Colores' },
  { id: 'calendario', label: 'Calendario' },
  { id: 'fechas', label: 'Fecha y hora' },
  { id: 'instalacion', label: 'Instalación' },
  { id: 'privacidad', label: 'Privacidad' },
  { id: 'datos', label: 'Datos' },
];

function scrollToSection(id) {
  const target = document.getElementById(id);
  if (!target) return;
  target.scrollIntoView({ behavior: document.documentElement.dataset.motion === 'reduced' ? 'auto' : 'smooth', block: 'start' });
  // Mueve el foco al título de la sección para que teclado y lector de pantalla continúen desde ahí.
  const heading = target.querySelector('h2');
  if (heading) {
    heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: true });
  }
}

/** Sección visible ahora mismo: la última cuyo título ya pasó por debajo del índice fijo. */
function useActiveSection() {
  const [active, setActive] = useState(SECTIONS[0].id);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = Math.min(window.innerHeight * 0.35, 220);
      let current = SECTIONS[0].id;
      for (const { id } of SECTIONS) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= line) current = id;
      }
      // Al final de la página, la última sección (puede ser corta y no llegar a la línea).
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) current = SECTIONS.at(-1).id;
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);
  return active;
}

export default function SettingsPage() {
  const location = useLocation();
  const active = useActiveSection();
  const scroller = useRef(null);
  const items = useRef({});

  // La pestaña activa se mantiene a la vista dentro del índice (solo se mueve la lista, no la página).
  useEffect(() => {
    scroller.current?.scrollToItem(items.current[active]);
  }, [active]);

  // Permite llegar a una sección concreta desde otras pantallas (p. ej. "Configurar la fecha").
  useEffect(() => {
    const section = location.state?.section;
    if (section) requestAnimationFrame(() => scrollToSection(section));
  }, [location.state]);

  return (
    <div className="page settings">
      <header className="settings__header">
        <p className="eyebrow">Hecho a tu medida</p>
        <h1 className="settings__title">Configuración</h1>
        <p className="settings__intro">Todo lo que cambies aquí se aplica al momento y se guarda en este dispositivo.</p>
      </header>

      <div className="settings__layout">
        <nav className="settings__nav" aria-label="Secciones de configuración">
          <HorizontalScroller ref={scroller} as="ul" className="settings__nav-scroller">
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <button
                  type="button"
                  ref={(el) => (items.current[section.id] = el)}
                  className={cx('settings__nav-item', active === section.id && 'is-active')}
                  aria-current={active === section.id ? 'true' : undefined}
                  onClick={() => scrollToSection(section.id)}
                >
                  {section.label}
                </button>
              </li>
            ))}
          </HorizontalScroller>
        </nav>

        <div className="settings__sections">
          <ProfileSection />
          <PresentationSection />
          <AppearanceSection />
          <ColorsSection />
          <CalendarSection />
          <DatesSection />
          <InstallSection />
          <PrivacySection />
          <DataSection />
        </div>
      </div>
    </div>
  );
}
