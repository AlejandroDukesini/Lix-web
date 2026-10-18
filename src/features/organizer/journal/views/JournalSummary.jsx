import { useMemo, useState } from 'react';
import { addMonthsClamped } from '../../data/recurrence.js';
import { BarList, ChartFrame, Columns, DataTable } from '../../shared/Charts.jsx';
import { Figure, PeriodNav, Section } from '../../shared/ui.jsx';
import { monthLabel } from '../../shared/format.js';
import { summarize } from '../journalStats.js';
import { useJournal } from '../useJournal.js';

/** Resumen mensual o anual del diario: cuánto se escribió, cuándo y sobre qué. */
export function JournalSummary() {
  const journal = useJournal();
  const [scope, setScope] = useState('month');
  const [anchor, setAnchor] = useState(journal.today.slice(0, 7));
  const prefix = scope === 'year' ? anchor.slice(0, 4) : anchor;
  const stats = useMemo(() => summarize(journal.entries, prefix), [journal.entries, prefix]);
  const label = scope === 'year' ? anchor.slice(0, 4) : monthLabel(anchor);
  const move = (step) => setAnchor(addMonthsClamped(`${anchor}-01`, scope === 'year' ? 12 * step : step).slice(0, 7));
  const months = Array.from({ length: 12 }, (_, i) => `${anchor.slice(0, 4)}-${String(i + 1).padStart(2, '0')}`);

  return (
    <div className="org-stack">
      <div className="org-toolbar org-toolbar--split">
        <div className="org-segment" role="group" aria-label="Período del resumen">
          <button type="button" aria-pressed={scope === 'month'} onClick={() => setScope('month')}>
            Mes
          </button>
          <button type="button" aria-pressed={scope === 'year'} onClick={() => setScope('year')}>
            Año
          </button>
        </div>
        <PeriodNav label={label} onPrev={() => move(-1)} onNext={() => move(1)} onToday={() => setAnchor(journal.today.slice(0, 7))} />
      </div>
      <section className="org-panel" aria-label={`Resumen de ${label}`}>
        <dl className="org-figures">
          <Figure label="Entradas" value={stats.entries.toLocaleString('es')} detail={stats.drafts ? `${stats.drafts} en borrador` : undefined} />
          <Figure label="Días escritos" value={stats.days.toLocaleString('es')} />
          <Figure label="Palabras" value={stats.words.toLocaleString('es')} />
          <Figure label="Racha más larga" value={`${stats.longestStreak} ${stats.longestStreak === 1 ? 'día' : 'días'}`} detail="días seguidos con entrada" />
          <Figure label="Favoritas" value={stats.favorites.toLocaleString('es')} />
        </dl>
      </section>
      {scope === 'year' && (
        <Section title="Entradas por mes">
          <ChartFrame title={`Entradas en ${label}`} table={<DataTable caption="Entradas por mes" head={['Mes', 'Entradas']} rows={months.map((m) => [monthLabel(m), String(stats.byMonth.get(m) ?? 0)])} />}>
            <Columns label={`Entradas por mes de ${label}`} items={months.map((m) => ({ key: m, label: monthLabel(m).slice(0, 3), values: [stats.byMonth.get(m) ?? 0] }))} series={[{ label: 'Entradas', color: 'var(--c-primary)' }]} />
          </ChartFrame>
        </Section>
      )}
      <div className="org-two">
        <Section title="Etiquetas más usadas">
          {stats.tags.length ? <BarList entries={stats.tags.map((t) => ({ id: t.tag, label: `#${t.tag}`, value: t.count, color: 'var(--c-secondary)' }))} format={(n) => `${n} ${n === 1 ? 'entrada' : 'entradas'}`} /> : <p className="org-muted">Sin etiquetas en este período.</p>}
        </Section>
        <Section title="Categorías">
          {stats.categories.length ? <BarList entries={stats.categories.map(([c, n]) => ({ id: c, label: c, value: n, color: 'var(--c-accent)' }))} format={(n) => `${n} ${n === 1 ? 'entrada' : 'entradas'}`} /> : <p className="org-muted">Sin categorías en este período.</p>}
        </Section>
      </div>
    </div>
  );
}
