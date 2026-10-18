/**
 * CSV (RFC 4180) sin dependencias: comillas dobles, saltos de línea dentro de
 * campos y separador «,», «;» o tabulador detectado automáticamente.
 */

/** Evita que una hoja de cálculo interprete un texto como fórmula (=, +, -, @). */
function neutralize(value) {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

export function toCSV(rows, { separator = ',', protectFormulas = true } = {}) {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          if (cell === null || cell === undefined) return '';
          let text = String(cell);
          if (protectFormulas && typeof cell === 'string') text = neutralize(text);
          return /[",;\n\r\t]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
        })
        .join(separator),
    )
    .join('\r\n');
}

export function detectSeparator(text) {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const counts = [',', ';', '\t'].map((sep) => [sep, firstLine.split(sep).length - 1]);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ',';
}

/** Texto CSV → filas (arrays de textos). Quita el BOM y las filas vacías. */
export function parseCSV(input, separator = detectSeparator(input)) {
  const text = input.replace(/^﻿/, '');
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"' && field === '') quoted = true;
    else if (ch === separator) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

export function downloadFile(filename, content, type = 'text/csv;charset=utf-8') {
  const blob = content instanceof Blob ? content : new Blob([type.startsWith('text/csv') ? `﻿${content}` : content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
