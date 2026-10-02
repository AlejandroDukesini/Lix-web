import { describe, expect, it } from 'vitest';
import {
  countdown,
  daysBetween,
  formatDuration,
  nextAnniversary,
  parseISODate,
  parseTime,
  relationshipDuration,
} from './dates.js';

describe('fechas', () => {
  it('interpreta AAAA-MM-DD como día local y rechaza fechas imposibles', () => {
    const date = parseISODate('2025-07-21');
    expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2025, 6, 21]);
    expect(parseISODate('2025-02-31')).toBeNull();
    expect(parseISODate('21/07/2025')).toBeNull();
    expect(parseISODate(null)).toBeNull();
  });

  it('valida horas HH:MM', () => {
    expect(parseTime('00:00')).toEqual({ hours: 0, minutes: 0 });
    expect(parseTime('23:59')).toEqual({ hours: 23, minutes: 59 });
    expect(parseTime('24:00')).toBeNull();
  });

  it('cuenta días naturales sin verse afectada por horas', () => {
    expect(daysBetween(new Date(2025, 6, 21, 23, 0), new Date(2025, 6, 22, 1, 0))).toBe(1);
  });

  it('calcula la duración de la relación en años, meses y días', () => {
    const duration = relationshipDuration('2025-07-21', new Date(2026, 9, 1, 20, 0));
    expect(duration).toEqual({ years: 1, months: 2, days: 10, totalDays: 437 });
    expect(formatDuration(duration)).toBe('1 año, 2 meses y 10 días');
  });

  it('no inventa duraciones con fechas vacías, inválidas o futuras', () => {
    expect(relationshipDuration(null)).toBeNull();
    expect(relationshipDuration('fecha')).toBeNull();
    expect(relationshipDuration('2030-01-01', new Date(2026, 0, 1))).toBeNull();
  });

  it('calcula el próximo aniversario', () => {
    const next = nextAnniversary('2025-07-21', new Date(2026, 9, 1));
    expect(next.daysLeft).toBe(293);
    expect(next.yearsCompleting).toBe(2);
    expect(nextAnniversary('2025-07-21', new Date(2026, 6, 21)).daysLeft).toBe(0);
  });

  it('cuenta atrás hasta Año Nuevo y detecta cuando ya pasó', () => {
    const target = new Date(2027, 0, 1, 0, 0);
    expect(countdown(target, new Date(2026, 11, 31, 23, 59, 30))).toMatchObject({ passed: false, days: 0, seconds: 30 });
    expect(countdown(target, new Date(2027, 0, 1, 0, 0, 1)).passed).toBe(true);
  });
});
