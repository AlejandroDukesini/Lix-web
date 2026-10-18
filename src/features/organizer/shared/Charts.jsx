/**
 * Gráficos sencillos sin dependencias, pensados para leerse y no para decorar:
 *  - Barras horizontales (distribuciones): un eje, el valor escrito con tinta de texto
 *    (nunca con el color de la serie) y el color siguiendo a la entidad (la categoría).
 *  - Columnas por período (dos series como máximo): leyenda siempre visible, un solo eje.
 * Cada gráfico tiene su tabla equivalente (botón «Ver como tabla») y un aviso
 * nativo (title) por barra con el dato exacto.
 */
import { useState } from 'react';
import { Button } from '../../../components/common/Button.jsx';

export function ChartFrame({ title, note, children, table }) {
  const [asTable, setAsTable] = useState(false);
  return (
    <figure className="org-chart">
      <figcaption className="org-chart__head">
        <span className="org-chart__title">{title}</span>
        {table && (
          <Button variant="ghost" size="sm" onClick={() => setAsTable((v) => !v)} aria-pressed={asTable}>
            {asTable ? 'Ver gráfico' : 'Ver como tabla'}
          </Button>
        )}
      </figcaption>
      {asTable ? table : children}
      {note && <p className="org-chart-note">{note}</p>}
    </figure>
  );
}

/** entries: [{ id, label, value, color, detail? }] ordenadas; `format` convierte el valor a texto. */
export function BarList({ entries, format = String, max }) {
  const top = max ?? Math.max(...entries.map((e) => e.value), 0);
  return (
    <ul className="org-bars">
      {entries.map((entry) => (
        <li key={entry.id} className="org-bar" title={`${entry.label}: ${format(entry.value)}${entry.detail ? ` · ${entry.detail}` : ''}`}>
          <div className="org-bar__head">
            <span className="org-bar__label">
              <span className="org-dot" style={{ '--dot-color': entry.color }} aria-hidden="true" />
              {entry.label}
            </span>
            <span className="org-bar__value">
              {format(entry.value)}
              {entry.detail && <span className="org-subtle"> · {entry.detail}</span>}
            </span>
          </div>
          <div className="org-bar__track" aria-hidden="true">
            <span style={{ inlineSize: `${top ? Math.max(1, (entry.value / top) * 100) : 0}%`, '--bar-color': entry.color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * Columnas agrupadas: items [{ key, label, values: [n, n] }], series [{ label, color }].
 * Escala común desde cero para todas las series (un solo eje).
 */
export function Columns({ items, series, format = String, label }) {
  const top = Math.max(1, ...items.flatMap((item) => item.values));
  return (
    <>
      {series.length > 1 && (
      <div className="org-legend" aria-hidden="true">
        {series.map((s) => (
          <span key={s.label}>
            <span className="org-dot" style={{ '--dot-color': s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      )}
      <div className="org-columns" role="img" aria-label={label}>
        {items.map((item) => (
          <div key={item.key} className="org-columns__item" title={`${item.label}: ${item.values.map((v, i) => `${series[i].label} ${format(v)}`).join(' · ')}`}>
            <div className="org-columns__bars">
              {item.values.map((value, i) => (
                <span key={series[i].label} style={{ blockSize: `${(value / top) * 100}%`, background: series[i].color }} />
              ))}
            </div>
            <span className="org-columns__label">{item.label}</span>
          </div>
        ))}
      </div>
    </>
  );
}

/** Tabla equivalente a un gráfico: rows [[celdas]], la primera columna es texto y el resto números. */
export function DataTable({ caption, head, rows }) {
  return (
    <div className="org-table-wrap">
      <table className="org-table">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={h} scope="col" className={i ? 'num' : undefined}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[0]}>
              {row.map((cell, i) => (i === 0 ? <th key={i} scope="row">{cell}</th> : <td key={i} className="num">{cell}</td>))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
