import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { ProfileSection } from './sections/ProfileSection.jsx';
import { PresentationSection } from './sections/PresentationSection.jsx';
import { AppearanceSection } from './sections/AppearanceSection.jsx';
import { ColorsSection } from './sections/ColorsSection.jsx';
import { CalendarSection } from './sections/CalendarSection.jsx';
import { DatesSection } from './sections/DatesSection.jsx';
import { InstallSection } from './sections/InstallSection.jsx';
import { DataSection } from './sections/DataSection.jsx';
import './settings.css';

const SECTIONS = [
  { id: 'apodos', label: 'Apodos' },
  { id: 'presentacion', label: 'Presentación' },
  { id: 'apariencia', label: 'Estilo y tema' },
  { id: 'colores', label: 'Colores' },
  { id: 'calendario', label: 'Calendario' },
  { id: 'fechas', label: 'Fecha y hora' },
  { id: 'instalacion', label: 'Instalación' },
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

export default function SettingsPage() {
  const location = useLocation();

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
          <ul>
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <button type="button" className="settings__nav-item" onClick={() => scrollToSection(section.id)}>
                  {section.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="settings__sections">
          <ProfileSection />
          <PresentationSection />
          <AppearanceSection />
          <ColorsSection />
          <CalendarSection />
          <DatesSection />
          <InstallSection />
          <DataSection />
        </div>
      </div>
    </div>
  );
}
