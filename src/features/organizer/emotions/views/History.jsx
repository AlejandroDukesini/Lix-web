import { useMemo, useState } from 'react';
import { HeartPulse } from 'lucide-react';
import { usePreferences } from '../../../../app/providers/PreferencesProvider.jsx';
import { cx } from '../../../../utils/cx.js';
import { addMonthsClamped } from '../../data/recurrence.js';
import { tagCounts } from '../../data/tags.js';
import { InputField, SelectField } from '../../shared/Fields.jsx';
import { EmptyState, PeriodNav, SearchField } from '../../shared/ui.jsx';
import { dayHeading, monthLabel } from '../../shared/format.js';
import { matchesQuery } from '../../shared/text.js';
import { monthGrid } from '../../planner/agenda.js';
import { VALENCE_LABELS, VALENCE_SINGULAR } from '../content.js';
import { dayOf, dayTones, intensityPercent } from '../emotionStats.js';
import { useEmotions } from '../useEmotions.js';
import { LogRow } from './LogRow.jsx';

const WEEKDAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

/** Calendario emocional: cada día toma el tono predominante de sus registros. */
function EmotionCalendar({ month, onMonth, selected, onSelect }) {
  const data = useEmotions();
  const { preferences } = usePreferences();
  const weekStartsOn = preferences.calendar.weekStartsOn;
  const tones = useMemo(() => dayTones(data.logs, data.emotionsById), [data.logs, data.emotionsById]);
  const [y, m] = month.split('-').map(Number);
  return (
    <div className="org-stack">
      <PeriodNav label={monthLabel(month)} onPrev={() => onMonth(addMonthsClamped(`${month}-01`, -1).slice(0, 7))} onNext={() => onMonth(addMonthsClamped(`${month}-01`, 1).slice(0, 7))} onToday={() => onMonth(data.today.slice(0, 7))} />
      <div className="org-month org-month--emotions" role="group" aria-label={`Calendario emocional de ${monthLabel(month)}`}>
        <div className="org-month__head" aria-hidden="true">
          {Array.from({ length: 7 }, (_, i) => (
            <span key={i} className="org-month__weekday">
              {WEEKDAY_SHORT[(i + weekStartsOn) % 7]}
            </span>
          ))}
        </div>
        {monthGrid(y, m, weekStartsOn).map((week) => (
          <div key={week[0]} className="org-month__week">
            {week.map((day) => {
              const tone = tones.get(day);
              return (
                <button
                  key={day}
                  type="button"
                  className={cx('org-month__day', day.slice(0, 7) !== month && 'is-outside', day === data.today && 'is-today', day === selected && 'is-selected', tone && `tone--${tone.tone}`)}
                  aria-pressed={day === selected}
                  aria-label={`${dayHeading(day)}${tone ? `, ${tone.count} ${tone.count === 1 ? 'registro' : 'registros'}, tono ${VALENCE_SINGULAR[tone.tone].toLowerCase()}` : ''}`}
                  onClick={() => onSelect(day === selected ? null : day)}
                >
                  <span className="org-month__number">{Number(day.slice(8))}</span>
                  {tone && (
                    <span className="org-tone-dots" aria-hidden="true">
                      {tone.colors.slice(0, 4).map((c, i) => (
                        <span key={i} style={{ background: c }} />
                      ))}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <p className="org-legend" aria-hidden="true">
        {Object.entries(VALENCE_LABELS).map(([v, label]) => (
          <span key={v}>
            <span className={`org-tone-swatch tone--${v}`} /> {label}
          </span>
        ))}
      </p>
      <p className="org-chart-note">El fondo de cada día muestra el tono que más se repitió en sus registros; los puntos, el color de cada emoción registrada.</p>
    </div>
  );
}

export function History() {
  const data = useEmotions();
  const [month, setMonth] = useState(data.today.slice(0, 7));
  const [day, setDay] = useState(null);
  const [query, setQuery] = useState('');
  const [emotionId, setEmotionId] = useState(null);
  const [valence, setValence] = useState(null);
  const [minIntensity, setMinIntensity] = useState('0');
  const [context, setContext] = useState(null);
  const [tag, setTag] = useState(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const contexts = useMemo(() => tagCounts(data.logs, 'contextTags'), [data.logs]);
  const tags = useMemo(() => tagCounts(data.logs), [data.logs]);
  const list = useMemo(
    () =>
      data.logs.filter((log) => {
        const d = dayOf(log);
        if (day && d !== day) return false;
        if (from && d < from) return false;
        if (to && d > to) return false;
        if (emotionId && log.primaryId !== emotionId && !log.secondaryIds.includes(emotionId)) return false;
        if (valence && data.emotionsById.get(log.primaryId)?.valence !== valence) return false;
        if (intensityPercent(log) < Number(minIntensity)) return false;
        if (context && !log.contextTags.includes(context)) return false;
        if (tag && !log.tags.includes(tag)) return false;
        return matchesQuery(query, log.description, log.context, log.privateNotes, Object.values(log.reflection), log.factors, log.needs, log.strategies, log.tags, data.emotionsById.get(log.primaryId)?.name);
      }),
    [data, day, from, to, emotionId, valence, minIntensity, context, tag, query],
  );

  return (
    <div className="org-two">
      <EmotionCalendar month={month} onMonth={setMonth} selected={day} onSelect={setDay} />
      <div className="org-stack">
        <SearchField label="Buscar en los registros" value={query} onChange={setQuery} placeholder="Palabras, situaciones, necesidades…" />
        <details className="org-more" open={Boolean(emotionId || valence || context || tag || from || to || minIntensity !== '0')}>
          <summary>Filtrar</summary>
          <div className="org-filters">
            <SelectField label="Emoción" value={emotionId} onChange={setEmotionId} placeholder="Todas" options={data.emotions.map((e) => ({ value: e.id, label: e.name }))} />
            <SelectField label="Tono" value={valence} onChange={setValence} placeholder="Todos" options={Object.entries(VALENCE_SINGULAR).map(([value, label]) => ({ value, label }))} />
            <SelectField
              label="Intensidad mínima"
              value={minIntensity}
              onChange={(v) => setMinIntensity(v ?? '0')}
              options={[
                { value: '0', label: 'Cualquiera' },
                { value: '50', label: 'Media o más' },
                { value: '75', label: 'Alta' },
              ]}
            />
            <SelectField label="Ámbito" value={context} onChange={setContext} placeholder="Todos" options={contexts.map((c) => ({ value: c.tag, label: c.tag }))} />
            <SelectField label="Etiqueta" value={tag} onChange={setTag} placeholder="Todas" options={tags.map((t) => ({ value: t.tag, label: t.tag }))} />
            <InputField label="Desde" type="date" value={from} onChange={setFrom} />
            <InputField label="Hasta" type="date" value={to} onChange={setTo} />
          </div>
        </details>
        <p className="org-subtle" aria-live="polite">
          {day ? `${dayHeading(day)} · ` : ''}
          {list.length === 1 ? '1 registro' : `${list.length} registros`}
        </p>
        {list.length ? (
          <ul className="org-list">
            {list.map((log) => (
              <LogRow key={log.id} log={log} />
            ))}
          </ul>
        ) : (
          <EmptyState icon={HeartPulse} title={data.logs.length ? 'Nada con estos filtros' : 'Todavía no hay registros'}>
            {data.logs.length ? 'Prueba con otro día o quita algún filtro.' : 'Cuando registres cómo te sientes, aquí verás tu historia.'}
          </EmptyState>
        )}
      </div>
    </div>
  );
}
