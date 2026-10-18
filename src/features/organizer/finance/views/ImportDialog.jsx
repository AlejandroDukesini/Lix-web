import { useMemo, useState } from 'react';
import { Download, FileUp } from 'lucide-react';
import { Button } from '../../../../components/common/Button.jsx';
import { Dialog } from '../../../../components/common/Dialog.jsx';
import { cx } from '../../../../utils/cx.js';
import { useRunner } from '../../data/hooks.js';
import { downloadFile, toCSV } from '../../data/csv.js';
import { CheckboxField } from '../../shared/Fields.jsx';
import { importTransactions } from '../actions.js';
import { formatMoney } from '../money.js';
import { CSV_COLUMNS, previewTransactionsCSV } from '../transactionsCsv.js';
import { TYPE_LABELS, useFinance } from '../useFinance.js';

const MAX_CSV_BYTES = 5 * 1024 * 1024;

/**
 * Importación de movimientos en tres pasos: elegir archivo → vista previa con cada
 * fila validada (errores, duplicados, categorías nuevas) → confirmar. Nada se guarda
 * hasta pulsar «Importar», y entonces todo va en una sola transacción.
 */
export function ImportDialog({ open, onClose }) {
  const finance = useFinance();
  const run = useRunner();
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [createCategories, setCreateCategories] = useState(true);

  const close = () => {
    setPreview(null);
    setError(null);
    onClose();
  };

  const readFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > MAX_CSV_BYTES) {
      setError('El archivo pesa más de 5 MB.');
      return;
    }
    const result = previewTransactionsCSV(await file.text(), finance);
    if (result.missing.length) {
      setError(`Faltan columnas obligatorias: ${result.missing.join(', ')}. Descarga la plantilla para ver el formato.`);
      setPreview(null);
      return;
    }
    if (!result.rows.length) {
      setError('El archivo no tiene filas de datos.');
      return;
    }
    setError(null);
    setPreview(result);
    // Por defecto: válidas y no duplicadas.
    setSelected(new Set(result.rows.filter((r) => !r.errors.length && !r.duplicate).map((r) => r.line)));
  };

  const stats = useMemo(() => {
    if (!preview) return null;
    return {
      valid: preview.rows.filter((r) => !r.errors.length).length,
      invalid: preview.rows.filter((r) => r.errors.length).length,
      duplicates: preview.rows.filter((r) => r.duplicate).length,
      newCategories: new Set(preview.rows.filter((r) => r.unknownCategory && !r.errors.length).map((r) => r.unknownCategory)).size,
    };
  }, [preview]);

  const confirm = async () => {
    const rows = preview.rows.filter((r) => selected.has(r.line) && !r.errors.length);
    const { ok, result } = await run(() => importTransactions(rows, { createCategories }));
    if (ok) {
      run(async () => null, { success: `${result.count} movimientos importados${result.categories ? ` y ${result.categories} categorías creadas` : ''}` });
      close();
    }
  };

  const template = () =>
    downloadFile(
      'plantilla-movimientos.csv',
      toCSV([
        CSV_COLUMNS.filter((c) => c !== 'id' && c !== 'moneda'),
        ['2026-03-01', '08:30', 'gasto', 'completado', '12500', finance.accounts[0]?.name ?? 'Efectivo', '', 'Alimentación', 'Café y antojos', 'Café', '', 'efectivo', 'universidad'],
      ]),
    );

  const toggle = (line) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(line)) next.delete(line);
      else next.add(line);
      return next;
    });

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Importar movimientos (CSV)"
      size="lg"
      description="Columnas obligatorias: fecha (AAAA-MM-DD), tipo (gasto, ingreso o transferencia), valor y cuenta (con el nombre de una cuenta existente)."
      footer={
        <>
          <Button variant="ghost" icon={Download} onClick={template}>
            Plantilla
          </Button>
          <span className="org-dialog__spacer" />
          <Button variant="ghost" onClick={close}>
            Cancelar
          </Button>
          {preview && (
            <Button onClick={confirm} disabled={!selected.size}>
              Importar {selected.size}
            </Button>
          )}
        </>
      }
    >
      <label className="btn btn--secondary org-attach-btn">
        <FileUp className="btn__icon" aria-hidden="true" />
        <span className="btn__label">{preview ? 'Elegir otro archivo' : 'Elegir archivo CSV'}</span>
        <input type="file" accept=".csv,text/csv,text/plain" className="sr-only" onChange={readFile} />
      </label>
      {error && (
        <p className="org-banner org-banner--danger" role="alert">
          {error}
        </p>
      )}
      {preview && (
        <>
          <p className="org-muted" role="status">
            {preview.rows.length} filas · {stats.valid} válidas · {stats.invalid} con errores · {stats.duplicates} posibles duplicados
            {preview.truncated && ' · solo se leen las primeras 5.000 filas'}
          </p>
          {stats.newCategories > 0 && (
            <CheckboxField
              label={`Crear las ${stats.newCategories} categorías que no existen`}
              description="Si no, esos movimientos quedarán sin categoría."
              checked={createCategories}
              onChange={setCreateCategories}
            />
          )}
          <div className="org-table-wrap org-import">
            <table className="org-table">
              <thead>
                <tr>
                  <th scope="col">
                    <span className="sr-only">Importar</span>
                  </th>
                  <th scope="col">Fila</th>
                  <th scope="col">Fecha</th>
                  <th scope="col">Tipo</th>
                  <th scope="col" className="num">
                    Valor
                  </th>
                  <th scope="col">Descripción</th>
                  <th scope="col">Revisión</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row) => (
                  <tr key={row.line} className={cx(row.errors.length && 'is-error', row.duplicate && 'is-duplicate')}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selected.has(row.line)}
                        disabled={row.errors.length > 0}
                        onChange={() => toggle(row.line)}
                        aria-label={`Importar la fila ${row.line}`}
                      />
                    </td>
                    <td>{row.line}</td>
                    <td>{row.data.date}</td>
                    <td>{TYPE_LABELS[row.data.type]}</td>
                    <td className="num">{row.data.amount ? formatMoney(row.data.amount, finance.currencyOf(row.data.accountId)) : '—'}</td>
                    <td>{row.data.description || '—'}</td>
                    <td className="org-import__note">
                      {row.errors.length
                        ? row.errors.join(' ')
                        : row.duplicate === 'existing'
                          ? 'Ya existe un movimiento igual'
                          : row.duplicate === 'file'
                            ? 'Repetida en el archivo'
                            : row.unknownCategory
                              ? `Categoría nueva: ${row.unknownCategory}`
                              : 'Lista'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Dialog>
  );
}
