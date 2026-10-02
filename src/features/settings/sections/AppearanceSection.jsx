import { Gauge, Layers, Moon, Sparkle, Sun } from 'lucide-react';
import { usePreferences } from '../../../app/providers/PreferencesProvider.jsx';
import { SegmentedControl } from '../../../components/common/SegmentedControl.jsx';
import { SettingsSection, useSavedNotice } from '../SettingsSection.jsx';

/** Miniatura de cada estilo dibujada con CSS, para elegir viendo el resultado. */
function StylePreview({ variant }) {
  return (
    <span className={`style-preview style-preview--${variant}`} aria-hidden="true">
      <span className="style-preview__shape" />
      <span className="style-preview__card">
        <span className="style-preview__line" />
        <span className="style-preview__line style-preview__line--short" />
        <span className="style-preview__button" />
      </span>
    </span>
  );
}

export function AppearanceSection() {
  const { preferences, update } = usePreferences();
  const { style, theme, motion } = preferences.appearance;
  const notifySaved = useSavedNotice();

  return (
    <SettingsSection
      id="apariencia"
      icon={Layers}
      title="Estilo y tema"
      description="Dos lenguajes visuales completos, cada uno con versión clara y oscura. Se aplican al instante."
    >
      <SegmentedControl
        label="Estilo visual"
        layout="cards"
        value={style}
        onChange={(value) => {
          update('appearance', { style: value });
          notifySaved(value === 'glass' ? 'Estilo Glassmorphism activado' : 'Estilo Maximalismo activado');
        }}
        options={[
          {
            value: 'glass',
            label: 'Glassmorphism',
            description: 'Cristal translúcido, luz suave y calma.',
            icon: Sparkle,
            preview: <StylePreview variant="glass" />,
          },
          {
            value: 'maximal',
            label: 'Maximalismo',
            description: 'Color intenso, formas y personalidad.',
            icon: Layers,
            preview: <StylePreview variant="maximal" />,
          },
        ]}
      />

      <SegmentedControl
        label="Tema"
        value={theme}
        onChange={(value) => {
          update('appearance', { theme: value });
          notifySaved(value === 'dark' ? 'Tema oscuro activado' : 'Tema claro activado');
        }}
        options={[
          { value: 'light', label: 'Claro', icon: Sun },
          { value: 'dark', label: 'Oscuro', icon: Moon },
        ]}
      />

      <SegmentedControl
        label="Animaciones"
        layout="cards"
        value={motion}
        onChange={(value) => {
          update('appearance', { motion: value });
          notifySaved(value === 'reduced' ? 'Animaciones reducidas' : 'Animaciones según el sistema');
        }}
        options={[
          { value: 'system', label: 'Según el sistema', description: 'Respeta la preferencia de movimiento del dispositivo.', icon: Sparkle },
          { value: 'reduced', label: 'Reducidas', description: 'Sin desplazamientos ni efectos; todo sigue funcionando.', icon: Gauge },
        ]}
      />
    </SettingsSection>
  );
}
