import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Play, RotateCcw, Telescope } from 'lucide-react';
import { usePreferences } from '../../../app/providers/PreferencesProvider.jsx';
import { Button } from '../../../components/common/Button.jsx';
import { Badge } from '../../../components/common/Card.jsx';
import { ConfirmDialog } from '../../../components/common/Dialog.jsx';
import { TextField } from '../../../components/common/TextField.jsx';
import { Candle } from '../../../components/presentation/Candle.jsx';
import { DEFAULT_CANDLE_LETTER, DEFAULT_PRESENTATION_TEXTS } from '../../../services/preferences/defaults.js';
import {
  PRESENTATION_TEXT_FIELDS,
  validateCandleLetter,
  validatePresentationText,
} from '../../../services/preferences/validation.js';
import { formatLongDate } from '../../../utils/dates.js';
import { SettingsGroup, SettingsSection, useSavedNotice } from '../SettingsSection.jsx';

const FIELD_GROUPS = [
  { title: 'Prólogo', keys: ['openingLine', 'openingReveal'] },
  { title: 'El viaje', keys: ['starsText', 'constellationText', 'galaxyText', 'telescopeText', 'eyepieceText'] },
  { title: 'La vela y la sorpresa', keys: ['candleText', 'togetherTitle', 'finalMessage', 'signature'] },
];

function validateAll(draft, letter) {
  const errors = {};
  const values = {};
  for (const key of Object.keys(PRESENTATION_TEXT_FIELDS)) {
    const { value, error } = validatePresentationText(key, draft[key]);
    values[key] = value;
    if (error) errors[key] = error;
  }
  const candle = validateCandleLetter(letter);
  if (candle.error) errors.candleLetter = candle.error;
  return { values, letter: candle.value, errors };
}

export function PresentationSection() {
  const { preferences, update } = usePreferences();
  const { completed, completedAt, texts, candleLetter } = preferences.presentation;
  const navigate = useNavigate();
  const notifySaved = useSavedNotice();

  const [draft, setDraft] = useState(texts);
  const [letterDraft, setLetterDraft] = useState(candleLetter);
  const [errors, setErrors] = useState({});
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => setDraft(texts), [texts]);
  useEffect(() => setLetterDraft(candleLetter), [candleLetter]);

  const dirty =
    letterDraft !== candleLetter || Object.keys(PRESENTATION_TEXT_FIELDS).some((key) => draft[key] !== texts[key]);
  const isDefault =
    letterDraft === DEFAULT_CANDLE_LETTER &&
    Object.keys(DEFAULT_PRESENTATION_TEXTS).every((key) => draft[key] === DEFAULT_PRESENTATION_TEXTS[key]);
  const letterCheck = validateCandleLetter(letterDraft);
  const previewLetter = letterCheck.error ? candleLetter : letterCheck.value;

  const save = (event) => {
    event.preventDefault();
    const { values, letter, errors: found } = validateAll(draft, letterDraft);
    setErrors(found);
    if (Object.keys(found).length) return;
    update('presentation', (current) => ({ ...current, texts: values, candleLetter: letter }));
    notifySaved('Presentación guardada');
  };

  const restoreOriginals = () => {
    setDraft({ ...DEFAULT_PRESENTATION_TEXTS });
    setLetterDraft(DEFAULT_CANDLE_LETTER);
    setErrors({});
  };

  const discard = () => {
    setDraft(texts);
    setLetterDraft(candleLetter);
    setErrors({});
  };

  const resetCompletion = () => {
    update('presentation', { completed: false, completedAt: null });
    setConfirmReset(false);
    notifySaved('La presentación aparecerá la próxima vez que abras la app');
  };

  return (
    <SettingsSection
      id="presentacion"
      icon={Telescope}
      title="Presentación de Año Nuevo"
      description="El viaje astral que aparece al abrir la app por primera vez: estrellas, una constelación, una galaxia, un telescopio y una vela con una letra."
    >
      <div className="presentation-preview">
        <div
          className="presentation-preview__stage"
          role="img"
          aria-label={`Vista previa: la vela con la letra ${previewLetter} vista a través del ocular`}
        >
          <div className="presentation-preview__eyepiece">
            <Candle size="md" monogram={previewLetter} />
          </div>
          <p className="presentation-preview__title">{draft.togetherTitle || ' '}</p>
        </div>
        <div className="presentation-preview__info">
          <p className="presentation-preview__status">
            {completed ? (
              <Badge tone="success">Vista {completedAt ? `el ${formatLongDate(new Date(completedAt))}` : ''}</Badge>
            ) : (
              <Badge tone="warning">Aparecerá en el próximo inicio</Badge>
            )}
          </p>
          <p className="settings-section__description">
            Reproducirla no cambia ninguna preferencia. Restablecerla hace que vuelva a aparecer sola la próxima vez que se
            abra la app.
          </p>
          <div className="settings-actions settings-actions--start">
            <Button icon={Play} onClick={() => navigate('/presentacion', { state: { from: '/ajustes' } })}>
              Reproducir ahora
            </Button>
            <Button variant="ghost" icon={RotateCcw} onClick={() => setConfirmReset(true)} disabled={!completed}>
              Restablecer estado
            </Button>
          </div>
        </div>
      </div>

      <form className="presentation-texts" onSubmit={save} noValidate>
        <SettingsGroup title="La vela" description="La letra grabada en oro que se descubre al final del viaje.">
          <TextField
            label="Letra de la vela"
            value={letterDraft}
            onChange={(value) => {
              setLetterDraft(value.slice(0, 2));
              setErrors((e) => ({ ...e, candleLetter: undefined }));
            }}
            error={errors.candleLetter}
            autoComplete="off"
            inputClassName="letter-input"
          />
        </SettingsGroup>

        {FIELD_GROUPS.map((group) => (
          <SettingsGroup key={group.title} title={group.title}>
            {group.keys.map((key) => {
              const field = PRESENTATION_TEXT_FIELDS[key];
              return (
                <TextField
                  key={key}
                  label={field.label}
                  value={draft[key]}
                  onChange={(value) => {
                    setDraft((d) => ({ ...d, [key]: value }));
                    setErrors((e) => ({ ...e, [key]: undefined }));
                  }}
                  multiline={field.multiline}
                  maxLength={field.max}
                  error={errors[key]}
                />
              );
            })}
          </SettingsGroup>
        ))}
        <div className="settings-actions">
          <Button variant="ghost" onClick={restoreOriginals} disabled={isDefault}>
            Usar textos originales
          </Button>
          <Button variant="ghost" onClick={discard} disabled={!dirty}>
            Descartar
          </Button>
          <Button type="submit" disabled={!dirty}>
            Guardar presentación
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={confirmReset}
        title="¿Restablecer la presentación?"
        description="La presentación volverá a aparecer automáticamente la próxima vez que se abra la app. Tus textos y el resto de preferencias no cambian."
        confirmLabel="Restablecer"
        tone="primary"
        onConfirm={resetCompletion}
        onCancel={() => setConfirmReset(false)}
      />
    </SettingsSection>
  );
}
