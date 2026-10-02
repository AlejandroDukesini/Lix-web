import { Check, Palette, RotateCcw, TriangleAlert } from 'lucide-react';
import { usePreferences } from '../../../app/providers/PreferencesProvider.jsx';
import { Button } from '../../../components/common/Button.jsx';
import { Badge } from '../../../components/common/Card.jsx';
import { ColorField } from '../../../components/common/ColorField.jsx';
import { DEFAULT_PALETTE_ID, PALETTE_PRESETS } from '../../../services/preferences/defaults.js';
import { contrastRatio, readableOn } from '../../../utils/color.js';
import { cx } from '../../../utils/cx.js';
import { SettingsGroup, SettingsSection, useSavedNotice } from '../SettingsSection.jsx';

const COLOR_FIELDS = [
  { key: 'primary', label: 'Primario', description: 'Botones principales, apodos y selección.' },
  { key: 'secondary', label: 'Secundario', description: 'Degradados y detalles de apoyo.' },
  { key: 'accent', label: 'Acento', description: 'La luz de la vela, insignias y destellos.' },
  { key: 'ambient', label: 'Ambiente', description: 'Tiñe el fondo y la atmósfera general.' },
];

function matchPreset(palette) {
  return PALETTE_PRESETS.find((preset) => Object.keys(preset.colors).every((key) => preset.colors[key] === palette[key]))?.id ?? 'custom';
}

export function ColorsSection() {
  const { preferences, update } = usePreferences();
  const { palette, paletteId } = preferences.appearance;
  const notifySaved = useSavedNotice();

  const applyPalette = (next, message) => {
    const previous = { palette, paletteId };
    update('appearance', { palette: next, paletteId: matchPreset(next) });
    if (message) {
      notifySaved(message, { label: 'Deshacer', onClick: () => update('appearance', previous) });
    }
  };

  const lowContrast = contrastRatio(palette.primary, readableOn(palette.primary)) < 4.5;

  return (
    <SettingsSection
      id="colores"
      icon={Palette}
      title="Colores"
      description="Elige una paleta o crea la tuya. Los cambios se ven al momento en toda la app y se guardan solos."
    >
      <SettingsGroup title="Paletas">
        <div className="palette-grid" role="radiogroup" aria-label="Paletas predefinidas">
          {PALETTE_PRESETS.map((preset) => {
            const selected = paletteId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                role="radio"
                aria-checked={selected}
                className={cx('palette-option', selected && 'is-selected')}
                onClick={() => applyPalette({ ...preset.colors }, `Paleta «${preset.name}» aplicada`)}
              >
                <span className="palette-option__swatches" aria-hidden="true">
                  {Object.values(preset.colors).map((color) => (
                    <span key={color} style={{ background: color }} />
                  ))}
                </span>
                <span className="palette-option__name">
                  {preset.name}
                  {selected && <Check aria-hidden="true" />}
                </span>
                <span className="palette-option__description">{preset.description}</span>
              </button>
            );
          })}
        </div>
      </SettingsGroup>

      <SettingsGroup
        title={
          <>
            Personalizar {paletteId === 'custom' && <Badge tone="soon">Paleta propia</Badge>}
          </>
        }
      >
        <div className="color-grid">
          {COLOR_FIELDS.map((field) => (
            <ColorField
              key={field.key}
              label={field.label}
              description={field.description}
              value={palette[field.key]}
              onChange={(hex) => applyPalette({ ...palette, [field.key]: hex })}
            />
          ))}
        </div>
      </SettingsGroup>

      <div className="palette-preview" aria-label="Vista previa de la paleta" role="group">
        <span className="palette-preview__chip">Acento</span>
        <p className="palette-preview__title">Un año más contigo</p>
        <p className="palette-preview__text">Así se verán los botones, los detalles y el ambiente.</p>
        <div className="palette-preview__actions">
          <span className="palette-preview__button">Botón principal</span>
          <span className="palette-preview__ghost">Secundario</span>
        </div>
      </div>

      {lowContrast && (
        <p className="settings-warning" role="status">
          <TriangleAlert aria-hidden="true" />
          El color primario tiene poco contraste con el texto de los botones. Prueba un tono más claro u oscuro.
        </p>
      )}

      <div className="settings-actions">
        <Button
          variant="ghost"
          icon={RotateCcw}
          disabled={paletteId === DEFAULT_PALETTE_ID}
          onClick={() =>
            applyPalette({ ...PALETTE_PRESETS.find((p) => p.id === DEFAULT_PALETTE_ID).colors }, 'Colores predeterminados restaurados')
          }
        >
          Restaurar colores predeterminados
        </Button>
      </div>
    </SettingsSection>
  );
}
