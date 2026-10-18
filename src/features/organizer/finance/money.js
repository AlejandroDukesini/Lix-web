/**
 * Dinero. Los importes se guardan como ENTEROS en unidades mínimas (centavos):
 * 12.500,50 → 1250050. Así las sumas nunca acumulan errores de coma flotante.
 */

export const COMMON_CURRENCIES = ['COP', 'USD', 'EUR', 'MXN', 'ARS', 'CLP', 'PEN', 'GBP'];

/**
 * Convierte lo que escribe una persona en unidades mínimas, o null si no es un importe.
 * Acepta «12500», «12.500», «12.500,50», «12,500.50», «12500,5», «$ 12 500».
 * Regla para un único separador: si le siguen exactamente 3 cifras es de miles; si no, decimal.
 */
export function parseAmount(input) {
  if (typeof input === 'number') return Number.isFinite(input) ? Math.round(input * 100) : null;
  if (typeof input !== 'string') return null;
  let text = input.trim().replace(/[\s $€£]|COP|USD|EUR/gi, '');
  if (!text) return null;
  const negative = text.startsWith('-');
  if (negative) text = text.slice(1);
  if (!/^[\d.,']+$/.test(text)) return null;
  text = text.replace(/'/g, '');
  const lastDot = text.lastIndexOf('.');
  const lastComma = text.lastIndexOf(',');
  let integer = text;
  let fraction = '';
  if (lastDot !== -1 && lastComma !== -1) {
    const decimalAt = Math.max(lastDot, lastComma);
    integer = text.slice(0, decimalAt).replace(/[.,]/g, '');
    fraction = text.slice(decimalAt + 1);
  } else if (lastDot !== -1 || lastComma !== -1) {
    const sep = lastDot !== -1 ? '.' : ',';
    const parts = text.split(sep);
    const last = parts.at(-1);
    if (parts.length > 2 || last.length === 3) {
      // 1.234.567 o 12.500 → separador de miles (todas las cifras tras cada separador deben ser 3).
      if (!parts.slice(1).every((p) => p.length === 3)) return null;
      integer = parts.join('');
    } else {
      integer = parts[0];
      fraction = last;
    }
  }
  if (!/^\d*$/.test(integer) || !/^\d*$/.test(fraction) || fraction.length > 2 || (!integer && !fraction)) return null;
  const value = Number(integer || '0') * 100 + Number((fraction + '00').slice(0, 2));
  if (!Number.isSafeInteger(value)) return null;
  return negative ? -value : value;
}

const formatters = new Map();
function formatter(currency, fractionDigits) {
  const key = `${currency}:${fractionDigits}`;
  if (!formatters.has(key)) {
    let fmt;
    try {
      fmt = new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency,
        currencyDisplay: 'narrowSymbol',
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      });
    } catch {
      fmt = new Intl.NumberFormat('es-CO', { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits });
    }
    formatters.set(key, fmt);
  }
  return formatters.get(key);
}

/** 1250050 → «$ 12.500,50»; sin centavos no se muestran decimales. */
export function formatMoney(minor, currency = 'COP', { signed = false } = {}) {
  const value = Number.isFinite(minor) ? minor : 0;
  const digits = value % 100 === 0 ? 0 : 2;
  const text = formatter(currency, digits).format(Math.abs(value) / 100);
  if (value < 0) return `−${text}`;
  return signed && value > 0 ? `+${text}` : text;
}

/** Valor para un campo editable: 1250050 → «12500,5». */
export function toAmountInput(minor) {
  if (!Number.isFinite(minor)) return '';
  const sign = minor < 0 ? '-' : '';
  const abs = Math.abs(minor);
  const cents = abs % 100;
  return `${sign}${Math.floor(abs / 100)}${cents ? `,${String(cents).padStart(2, '0').replace(/0$/, '')}` : ''}`;
}

export function percentOf(part, whole) {
  if (!whole) return 0;
  return Math.round((part / whole) * 1000) / 10;
}
