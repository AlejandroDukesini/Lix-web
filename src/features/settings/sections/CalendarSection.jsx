import { CalendarDays } from 'lucide-react';
import { usePreferences } from '../../../app/providers/PreferencesProvider.jsx';
import { SegmentedControl } from '../../../components/common/SegmentedControl.jsx';
import { SettingsSection, useSavedNotice } from '../SettingsSection.jsx';

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export function CalendarSection() {
  const { preferences, update } = usePreferences();
  const { weekStartsOn } = preferences.calendar;
  const notifySaved = useSavedNotice();
  const ordered = [...DAYS.slice(weekStartsOn), ...DAYS.slice(0, weekStartsOn)];

  return (
    <SettingsSection
      id="calendario"
      icon={CalendarDays}
      title="Calendario"
      description="Primer día de la semana en el calendario, en las vistas semanales de finanzas y en los resúmenes."
    >
      <SegmentedControl
        label="La semana empieza el"
        value={weekStartsOn}
        onChange={(value) => {
          update('calendar', { weekStartsOn: value });
          notifySaved(`La semana empezará el ${value === 0 ? 'domingo' : 'lunes'}`);
        }}
        options={[
          { value: 0, label: 'Domingo' },
          { value: 1, label: 'Lunes' },
        ]}
      />
      <div className="week-preview" aria-hidden="true">
        {ordered.map((day) => (
          <span key={day} className={day === 'Dom' || day === 'Sáb' ? 'is-weekend' : undefined}>
            {day}
          </span>
        ))}
      </div>
    </SettingsSection>
  );
}
