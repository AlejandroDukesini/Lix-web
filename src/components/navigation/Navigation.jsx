import { NavLink } from 'react-router';
import { LayoutGrid, Moon, ShieldCheck, Sun } from 'lucide-react';
import { MODULES } from '../../app/modules.js';
import { usePreferences } from '../../app/providers/PreferencesProvider.jsx';
import { Badge } from '../common/Card.jsx';
import { Dialog } from '../common/Dialog.jsx';
import { IconButton } from '../common/Button.jsx';
import { cx } from '../../utils/cx.js';

function BrandMark() {
  return (
    <span className="brand__mark" aria-hidden="true">
      <span className="brand__flame" />
    </span>
  );
}

export function Brand({ compact = false }) {
  return (
    <span className={cx('brand', compact && 'brand--compact')}>
      <BrandMark />
      <span className="brand__name">
        Un año más <em>contigo</em>
      </span>
    </span>
  );
}

export function ThemeToggle() {
  const { preferences, update } = usePreferences();
  const dark = preferences.appearance.theme === 'dark';
  return (
    <IconButton
      icon={dark ? Sun : Moon}
      label={dark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
      onClick={() => update('appearance', { theme: dark ? 'light' : 'dark' })}
    />
  );
}

/** Elemento de navegación: enlace real si el módulo existe; texto inerte con "Pronto" si no. */
function NavItem({ module, onNavigate, showTeaser = false }) {
  const Icon = module.icon;
  if (module.status !== 'available') {
    return (
      <li>
        <span className="nav-item is-soon" aria-disabled="true">
          <Icon className="nav-item__icon" aria-hidden="true" />
          <span className="nav-item__text">
            <span className="nav-item__label">{module.label}</span>
            {showTeaser && <span className="nav-item__teaser">{module.teaser}</span>}
          </span>
          <Badge tone="soon">Pronto</Badge>
        </span>
      </li>
    );
  }
  return (
    <li>
      <NavLink to={module.path} end className={({ isActive }) => cx('nav-item', isActive && 'is-active')} onClick={onNavigate}>
        <Icon className="nav-item__icon" aria-hidden="true" />
        <span className="nav-item__text">
          <span className="nav-item__label">{module.label}</span>
        </span>
      </NavLink>
    </li>
  );
}

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <Brand />
      </div>
      <nav aria-label="Principal" className="sidebar__nav">
        <ul className="nav-list">
          {MODULES.filter((m) => m.id !== 'settings').map((module) => (
            <NavItem key={module.id} module={module} />
          ))}
        </ul>
        <ul className="nav-list nav-list--bottom">
          <NavItem module={MODULES.find((m) => m.id === 'settings')} />
        </ul>
      </nav>
      <div className="sidebar__footer">
        <p className="privacy-note">
          <ShieldCheck aria-hidden="true" />
          <span>Todo se guarda solo en este dispositivo.</span>
        </p>
        <ThemeToggle />
      </div>
    </aside>
  );
}

export function MobileTopBar() {
  return (
    <header className="topbar">
      <Brand compact />
      <ThemeToggle />
    </header>
  );
}

export function BottomNav({ onOpenSpaces, spacesOpen }) {
  const home = MODULES.find((m) => m.id === 'home');
  const settings = MODULES.find((m) => m.id === 'settings');
  const link = (module, label) => {
    const Icon = module.icon;
    return (
      <NavLink to={module.path} end className={({ isActive }) => cx('bottom-nav__item', isActive && 'is-active')}>
        <Icon aria-hidden="true" />
        <span>{label}</span>
      </NavLink>
    );
  };

  return (
    <nav className="bottom-nav" aria-label="Principal">
      {link(home, 'Inicio')}
      <button
        type="button"
        className={cx('bottom-nav__item', spacesOpen && 'is-active')}
        onClick={onOpenSpaces}
        aria-haspopup="dialog"
        aria-expanded={spacesOpen}
      >
        <LayoutGrid aria-hidden="true" />
        <span>Espacios</span>
      </button>
      {link(settings, 'Ajustes')}
    </nav>
  );
}

export function SpacesSheet({ open, onClose }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Nuestros espacios"
      description="Así se irá llenando la app. Los que dicen «Pronto» llegarán en las próximas fases."
      className="dialog--sheet"
    >
      <nav aria-label="Todos los espacios">
        <ul className="nav-list nav-list--sheet">
          {MODULES.map((module) => (
            <NavItem key={module.id} module={module} onNavigate={onClose} showTeaser />
          ))}
        </ul>
      </nav>
    </Dialog>
  );
}
