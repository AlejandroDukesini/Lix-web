import { useMemo, useState } from 'react';
import { ChartColumn } from 'lucide-react';
import { usePreferences } from '../../../../app/providers/PreferencesProvider.jsx';
import { BarList, ChartFrame, Columns, DataTable } from '../../shared/Charts.jsx';
import { EmptyState, Figure, PeriodNav, Section } from '../../shared/ui.jsx';
import { periodRange, shiftPeriod } from '../../finance/ledger.js';
import { shortDate } from '../../shared/format.js';
import { MOODS, VALENCE_LABELS } from '../content.js';
import { distribution, inRange, periodSummary, series } from '../emotionStats.js';
import { useEmotions } from '../useEmotions.js';

const VALENCE_COLORS = { pleasant: '#e9b949', unpleasant: '#5b7db1', mixed: '#a78bfa', neutral: '#9a9a9a' };
const BUCKET = { week: 'day', month: 'day', year: 'month' };

function moodLabel(value) {
  if (value === null) return 'sin datos';
  const nearest = MOODS.reduce((best, m) => (Math.abs(m.value - value) < Math.abs(best.value - value) ? m : best));
  return `${nearest.label.toLowerCase()} (${value > 0 ? '+' : ''}${value})`;
}

function delta(current, previous, unit = '') {
  if (current === null || previous === null) return null;
  const d = Math.round((current - previous) * 10) / 10;
  if (!d) return 'igual que el período anterior';
  return `${d > 0 ? '+' : ''}${d}${unit} respecto al período anterior`;
}

/**
 * Gráficos del diario emocional. Cada uno dice qué cuenta. No se muestran
 * correlaciones ni «causas»: unos cuantos registros no permiten afirmarlas.
 */
export function Charts() {
  const data = useEmotions();
  const { preferences } = usePreferences();
  const options = { weekStartsOn: preferences.calendar.weekStartsOn };
  const [range, setRange] = useState(() => periodRange('month', data.today, options));

  const stats = useMemo(() => {
    const previous = shiftPeriod(range, -1, options);
    const list = inRange(data.logs, range.from, range.to);
    return {
      list,
      current: periodSummary(data.logs, range.from, range.to, data.emotionsById),
      previous: periodSummary(data.logs, previous.from, previous.to, data.emotionsById),
      distribution: distribution(list),
      series: series(data.logs, range.from, range.to, BUCKET[range.view]),
    };
    // `options` se deriva de la preferencia; basta con ella como dependencia.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, range, preferences.calendar.weekStartsOn]);

  const { current, previous } = stats;
  const label = (s) => (range.view === 'year' ? s.key.slice(5) : shortDate(s.from).replace(/ \d{4}$/, ''));

  return (
    <div className="org-stack">
      <div className="org-toolbar org-toolbar--split">
        <div className="org-segment" role="group" aria-label="Período">
          {[
            ['week', 'Semana'],
            ['month', 'Mes'],
            ['year', 'Año'],
          ].map(([value, text]) => (
            <button key={value} type="button" aria-pressed={range.view === value} onClick={() => setRange(periodRange(value, data.today, options))}>
              {text}
            </button>
          ))}
        </div>
        <PeriodNav label={range.label} onPrev={() => setRange(shiftPeriod(range, -1, options))} onNext={() => setRange(shiftPeriod(range, 1, options))} onToday={() => setRange(periodRange(range.view, data.today, options))} />
      </div>

      {!stats.list.length ? (
        <EmptyState icon={ChartColumn} title="No hay registros en este período">
          Los gráficos se calculan solo con tus registros. Cuando haya algunos, aquí verás qué emociones aparecieron y con qué intensidad.
        </EmptyState>
      ) : (
        <>
          <section className="org-panel" aria-label="Resumen del período">
            <dl className="org-figures">
              <Figure label="Registros" value={current.count} detail={delta(current.count, previous.count)} />
              <Figure label="Días con registro" value={current.days} />
              <Figure label="Intensidad media" value={current.averageIntensity === null ? '—' : `${current.averageIntensity} %`} detail={delta(current.averageIntensity, previous.averageIntensity, ' puntos')} />
              <Figure label="Ánimo medio" value={moodLabel(current.averageMood)} detail={delta(current.averageMood, previous.averageMood)} />
              <Figure label="Emoción más registrada" value={data.emotionsById.get(current.topEmotionId)?.name ?? '—'} />
            </dl>
            <p className="org-chart-note">La intensidad se expresa de 0 a 100 % según la escala con que se registró cada vez. La comparación es con el período inmediatamente anterior.</p>
          </section>

          <div className="org-two">
            <Section title="Qué emociones aparecieron">
              <ChartFrame
                title="Veces como emoción principal"
                note="Cuenta cuántos registros tuvieron cada emoción como principal; entre paréntesis, cuántas veces apareció además como secundaria."
                table={
                  <DataTable
                    caption="Distribución de emociones"
                    head={['Emoción', 'Principal', 'Secundaria']}
                    rows={stats.distribution.map((d) => [data.emotionsById.get(d.id)?.name ?? 'Eliminada', String(d.primary), String(d.secondary)])}
                  />
                }
              >
                <BarList
                  entries={stats.distribution
                    .filter((d) => d.primary)
                    .slice(0, 10)
                    .map((d) => ({ id: d.id, label: data.emotionsById.get(d.id)?.name ?? 'Eliminada', value: d.primary, color: data.emotionsById.get(d.id)?.color ?? '#999', detail: d.secondary ? `(+${d.secondary})` : undefined }))}
                  format={(n) => `${n} ${n === 1 ? 'vez' : 'veces'}`}
                />
              </ChartFrame>
            </Section>
            <Section title="Tono de los registros">
              <ChartFrame
                title="Registros por tono"
                note="Agrupa los registros según el tono de la emoción principal. Sentir emociones desagradables no es un error: también informan de lo que importa."
                table={<DataTable caption="Registros por tono" head={['Tono', 'Registros']} rows={Object.entries(current.valence).map(([v, n]) => [VALENCE_LABELS[v], String(n)])} />}
              >
                <BarList entries={Object.entries(current.valence).filter(([, n]) => n).map(([v, n]) => ({ id: v, label: VALENCE_LABELS[v], value: n, color: VALENCE_COLORS[v] }))} format={(n) => `${n} ${n === 1 ? 'registro' : 'registros'}`} />
              </ChartFrame>
            </Section>
          </div>

          <Section title="Con el tiempo">
            <ChartFrame
              title={range.view === 'year' ? 'Intensidad media por mes' : 'Intensidad media por día'}
              note="Cada barra es la media de intensidad (0–100 %) de los registros de ese intervalo; los intervalos sin registros quedan vacíos (no es lo mismo que intensidad cero)."
              table={
                <DataTable
                  caption="Evolución"
                  head={[range.view === 'year' ? 'Mes' : 'Día', 'Registros', 'Intensidad media', 'Ánimo medio']}
                  rows={stats.series.map((s) => [label(s), String(s.count), s.intensity === null ? '—' : `${s.intensity} %`, s.mood === null ? '—' : String(s.mood)])}
                />
              }
            >
              <Columns label="Intensidad media" items={stats.series.map((s) => ({ key: s.key, label: label(s), values: [s.intensity ?? 0] }))} series={[{ label: 'Intensidad media (%)', color: 'var(--c-primary)' }]} format={(v) => `${v} %`} />
            </ChartFrame>
            <ChartFrame title={range.view === 'year' ? 'Registros por mes' : 'Registros por día'} note="Frecuencia: cuántas veces registraste en cada intervalo. Registrar más no significa sentir más.">
              <Columns label="Frecuencia de registros" items={stats.series.map((s) => ({ key: s.key, label: label(s), values: [s.count] }))} series={[{ label: 'Registros', color: 'var(--c-secondary)' }]} />
            </ChartFrame>
          </Section>
        </>
      )}
    </div>
  );
}
