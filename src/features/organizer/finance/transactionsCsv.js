/**
 * Exportar e importar movimientos en CSV.
 *
 * Columnas (la cabecera es obligatoria; el orden da igual y se aceptan sin tildes):
 *   fecha*, tipo*, valor*, cuenta*, cuenta_destino, categoria, subcategoria, hora,
 *   descripcion, notas, metodo, estado, etiquetas (separadas por «|»)
 *
 * La importación no escribe nada: devuelve una vista previa con cada fila validada,
 * sus errores y si parece un duplicado de un movimiento existente o de otra fila del
 * mismo archivo. La interfaz confirma y guarda solo las filas elegidas.
 */
import { normalizeText } from '../shared/text.js';
import { isValidDate, isValidTime } from '../data/fields.js';
import { parseCSV, toCSV } from '../data/csv.js';
import { parseAmount } from './money.js';

const TYPE_LABELS = { expense: 'gasto', income: 'ingreso', transfer: 'transferencia' };
const STATUS_LABELS = { completed: 'completado', pending: 'pendiente', cancelled: 'cancelado' };
const METHOD_LABELS = { cash: 'efectivo', debit: 'débito', credit: 'crédito', transfer: 'transferencia', wallet: 'billetera', other: 'otro' };

const invert = (map) => Object.fromEntries(Object.entries(map).flatMap(([k, v]) => [[normalizeText(v), k], [k, k]]));
const TYPE_BY_LABEL = { ...invert(TYPE_LABELS), egreso: 'expense', gastos: 'expense', ingresos: 'income' };
const STATUS_BY_LABEL = { ...invert(STATUS_LABELS), completada: 'completed', pagado: 'completed', cancelada: 'cancelled' };
const METHOD_BY_LABEL = { ...invert(METHOD_LABELS), debito: 'debit', credito: 'credit', tarjeta: 'credit', nequi: 'wallet', daviplata: 'wallet' };

export const CSV_COLUMNS = ['fecha', 'hora', 'tipo', 'estado', 'valor', 'moneda', 'cuenta', 'cuenta_destino', 'categoria', 'subcategoria', 'descripcion', 'notas', 'metodo', 'etiquetas', 'id'];
const REQUIRED = ['fecha', 'tipo', 'valor', 'cuenta'];
const ALIASES = { cuentadestino: 'cuenta_destino', 'cuenta destino': 'cuenta_destino', descripción: 'descripcion', categoría: 'categoria', método: 'metodo', monto: 'valor', importe: 'valor', date: 'fecha', amount: 'valor', type: 'tipo', account: 'cuenta' };

function amountText(minor) {
  const cents = minor % 100;
  return `${Math.floor(minor / 100)}${cents ? `.${String(cents).padStart(2, '0')}` : ''}`;
}

export function transactionsToCSV(transactions, { accountsById, categoriesById }) {
  const rows = [CSV_COLUMNS];
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? ''));
  for (const tx of sorted) {
    const cat = categoriesById.get(tx.categoryId);
    const parent = cat?.parentId ? categoriesById.get(cat.parentId) : null;
    const account = accountsById.get(tx.accountId);
    rows.push([
      tx.date,
      tx.time ?? '',
      TYPE_LABELS[tx.type],
      STATUS_LABELS[tx.status],
      amountText(tx.amount),
      account?.currency ?? '',
      account?.name ?? '',
      accountsById.get(tx.toAccountId)?.name ?? '',
      parent ? parent.name : (cat?.name ?? ''),
      parent ? cat.name : '',
      tx.description,
      tx.notes,
      METHOD_LABELS[tx.method],
      tx.tags.join('|'),
      tx.id,
    ]);
  }
  return toCSV(rows);
}

/** Clave para detectar duplicados: misma fecha, tipo, valor, cuenta y descripción. */
export function duplicateKey(tx) {
  return [tx.date, tx.type, tx.amount, tx.accountId, normalizeText(tx.description ?? '').trim()].join('|');
}

function findByName(list, name) {
  const key = normalizeText(name).trim();
  return key ? list.find((item) => normalizeText(item.name).trim() === key) ?? null : null;
}

/**
 * Analiza un CSV de movimientos. `context` = { accounts, categories, transactions }.
 * Devuelve { header, missing, rows: [{ line, data, errors, duplicate, unknownCategory }] }.
 */
export function previewTransactionsCSV(text, { accounts, categories, transactions }) {
  const table = parseCSV(text);
  if (!table.length) return { header: [], missing: REQUIRED, rows: [] };
  const header = table[0].map((h) => {
    const key = normalizeText(h).trim().replace(/\s+/g, ' ');
    return ALIASES[key] ?? key.replace(/ /g, '_');
  });
  const missing = REQUIRED.filter((col) => !header.includes(col));
  if (missing.length) return { header, missing, rows: [] };

  const existing = new Set(transactions.filter((t) => t.status !== 'cancelled').map(duplicateKey));
  const inFile = new Set();
  const rows = table.slice(1, 5001).map((cells, index) => {
    const cell = (name) => (cells[header.indexOf(name)] ?? '').trim();
    const errors = [];
    const type = TYPE_BY_LABEL[normalizeText(cell('tipo'))];
    if (!type) errors.push('Tipo desconocido (usa gasto, ingreso o transferencia).');
    const date = cell('fecha');
    if (!isValidDate(date)) errors.push('Fecha no válida (usa AAAA-MM-DD).');
    const timeText = cell('hora');
    if (timeText && !isValidTime(timeText)) errors.push('Hora no válida (usa HH:MM).');
    const amount = parseAmount(cell('valor'));
    if (!amount || amount <= 0) errors.push('Valor no válido (debe ser mayor que cero).');
    const account = findByName(accounts, cell('cuenta'));
    if (!account) errors.push(`No existe la cuenta «${cell('cuenta')}».`);
    let toAccount = null;
    if (type === 'transfer') {
      toAccount = findByName(accounts, cell('cuenta_destino'));
      if (!toAccount) errors.push('Una transferencia necesita una cuenta de destino existente.');
      else if (toAccount.id === account?.id) errors.push('La cuenta de destino debe ser distinta.');
    }
    let categoryId = null;
    let unknownCategory = null;
    const catName = cell('subcategoria') || cell('categoria');
    if (type && type !== 'transfer' && catName) {
      const candidates = categories.filter((c) => c.type === type);
      const parent = cell('subcategoria') ? findByName(candidates.filter((c) => !c.parentId), cell('categoria')) : null;
      const found = parent ? findByName(candidates.filter((c) => c.parentId === parent.id), catName) : findByName(candidates, catName);
      if (found) categoryId = found.id;
      else unknownCategory = catName;
    }
    const statusText = normalizeText(cell('estado'));
    const status = statusText ? STATUS_BY_LABEL[statusText] : 'completed';
    if (!status) errors.push('Estado desconocido (usa completado, pendiente o cancelado).');
    const methodText = normalizeText(cell('metodo'));
    const data = {
      type: type ?? 'expense',
      date,
      time: timeText || null,
      amount: amount ?? 0,
      accountId: account?.id ?? null,
      toAccountId: toAccount?.id ?? null,
      categoryId,
      description: cell('descripcion').slice(0, 120),
      notes: cell('notas').slice(0, 2000),
      method: METHOD_BY_LABEL[methodText] ?? 'other',
      status: status ?? 'completed',
      tags: cell('etiquetas') ? cell('etiquetas').split('|').map((t) => t.trim()).filter(Boolean) : [],
    };
    let duplicate = null;
    if (!errors.length) {
      const key = duplicateKey(data);
      if (existing.has(key)) duplicate = 'existing';
      else if (inFile.has(key)) duplicate = 'file';
      inFile.add(key);
    }
    return { line: index + 2, data, errors, duplicate, unknownCategory };
  });
  return { header, missing, rows, truncated: table.length - 1 > 5000 };
}
