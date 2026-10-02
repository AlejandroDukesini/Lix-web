import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { usePreferences } from '../../../app/providers/PreferencesProvider.jsx';
import { Button } from '../../../components/common/Button.jsx';
import { SegmentedControl } from '../../../components/common/SegmentedControl.jsx';
import { TextField } from '../../../components/common/TextField.jsx';
import { validateCelebrationYear, validateRelationshipStart } from '../../../services/preferences/validation.js';
import {
  celebrationMoment,
  formatDuration,
  formatLongDate,
  formatTime,
  parseTime,
  relationshipDuration,
  toISODate,
} from '../../../utils/dates.js';
import { SettingsGroup, SettingsSection, useSavedNotice } from '../SettingsSection.jsx';

export function DatesSection() {
  const { preferences, update } = usePreferences();
  const { relationshipStart, celebrationYear, celebrationTime, hourCycle } = preferences.dates;
  const notifySaved = useSavedNotice();

  const [startDraft, setStartDraft] = useState(relationshipStart ?? '');
  const [startError, setStartError] = useState(null);
  const [yearDraft, setYearDraft] = useState(String(celebrationYear));
  const [timeDraft, setTimeDraft] = useState(celebrationTime);
  const [celebrationErrors, setCelebrationErrors] = useState({});

  useEffect(() => setStartDraft(relationshipStart ?? ''), [relationshipStart]);
  useEffect(() => setYearDraft(String(celebrationYear)), [celebrationYear]);
  useEffect(() => setTimeDraft(celebrationTime), [celebrationTime]);

  const today = toISODate(new Date());
  const duration = relationshipDuration(startDraft);

  const saveStart = (event) => {
    event.preventDefault();
    const { value, error } = validateRelationshipStart(startDraft);
    setStartError(error);
    if (error) return;
    update('dates', { relationshipStart: value });
    notifySaved(value ? 'Fecha de inicio guardada' : 'Fecha de inicio eliminada');
  };

  const clearStart = () => {
    setStartDraft('');
    setStartError(null);
    update('dates', { relationshipStart: null });
    notifySaved('Fecha de inicio eliminada');
  };

  const saveCelebration = (event) => {
    event.preventDefault();
    const year = validateCelebrationYear(yearDraft);
    const errors = {};
    if (year.error) errors.year = year.error;
    if (!parseTime(timeDraft)) errors.time = 'Escribe una hora válida.';
    setCelebrationErrors(errors);
    if (Object.keys(errors).length) return;
    update('dates', { celebrationYear: year.value, celebrationTime: timeDraft });
    notifySaved('Momento de Año Nuevo guardado');
  };

  const previewMoment = validateCelebrationYear(yearDraft).value && parseTime(timeDraft) ? celebrationMoment(Number(yearDraft), timeDraft) : null;

  return (
    <SettingsSection
      id="fechas"
      icon={Clock}
      title="Fecha y hora"
      description="Datos que usan el inicio y la presentación. Nada se calcula si no hay una fecha válida."
    >
      <form className="settings-form" onSubmit={saveStart} noValidate>
        <SettingsGroup
          title="Cuándo empezó todo"
          description="Opcional. Es la fecha de inicio de la relación, no la fecha en que se instaló la app."
        >
          <TextField
            label="Fecha de inicio de la relación"
            type="date"
            value={startDraft}
            max={today}
            min="1950-01-01"
            onChange={(value) => {
              setStartDraft(value);
              setStartError(null);
            }}
            error={startError}
            hint={
              duration && !startError
                ? `Juntos desde el ${formatLongDate(startDraft)} · ${formatDuration(duration)}`
                : 'Si la dejas vacía, no se muestra ningún contador.'
            }
          />
          <div className="settings-actions">
            <Button variant="ghost" onClick={clearStart} disabled={!relationshipStart && !startDraft}>
              Quitar fecha
            </Button>
            <Button type="submit" disabled={startDraft === (relationshipStart ?? '')}>
              Guardar fecha
            </Button>
          </div>
        </SettingsGroup>
      </form>

      <form className="settings-form" onSubmit={saveCelebration} noValidate>
        <SettingsGroup title="Nuestro Año Nuevo" description="El momento que cuenta la tarjeta del inicio y el año que aparece en la presentación.">
          <div className="settings-row">
            <TextField
              label="Año que celebramos"
              type="number"
              inputMode="numeric"
              min={2020}
              max={2100}
              value={yearDraft}
              onChange={(value) => {
                setYearDraft(value);
                setCelebrationErrors((e) => ({ ...e, year: undefined }));
              }}
              error={celebrationErrors.year}
            />
            <TextField
              label="Hora de la celebración"
              type="time"
              value={timeDraft}
              onChange={(value) => {
                setTimeDraft(value);
                setCelebrationErrors((e) => ({ ...e, time: undefined }));
              }}
              error={celebrationErrors.time}
            />
          </div>
          {previewMoment && (
            <p className="field__hint">
              1 de enero de {yearDraft}, {formatTime(previewMoment, hourCycle)}
            </p>
          )}
          <div className="settings-actions">
            <Button type="submit" disabled={yearDraft === String(celebrationYear) && timeDraft === celebrationTime}>
              Guardar momento
            </Button>
          </div>
        </SettingsGroup>
      </form>

      <SegmentedControl
        label="Formato de hora"
        value={hourCycle}
        onChange={(value) => {
          update('dates', { hourCycle: value });
          notifySaved(value === '12' ? 'Formato de 12 horas' : 'Formato de 24 horas');
        }}
        options={[
          { value: '12', label: '12 horas', description: formatTime(new Date(2000, 0, 1, 21, 30), '12') },
          { value: '24', label: '24 horas', description: formatTime(new Date(2000, 0, 1, 21, 30), '24') },
        ]}
      />
    </SettingsSection>
  );
}
