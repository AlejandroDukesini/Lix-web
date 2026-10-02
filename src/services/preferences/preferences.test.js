import { describe, expect, it, vi } from 'vitest';
import { createDefaultPreferences, defaultCelebrationYear, DEFAULT_NICKNAMES } from './defaults.js';
import { migratePreferences } from './migrations.js';
import {
  backupPreferences,
  deleteAllLocalData,
  loadPreferences,
  parseBackup,
  PREFERENCES_KEY,
  readPreferencesBackup,
  savePreferences,
  serializeBackup,
} from './preferencesService.js';
import {
  normalizeText,
  sanitizePreferences,
  validateCandleLetter,
  validateNickname,
  validateRelationshipStart,
} from './validation.js';
import { __resetForTests } from '../storage/safeLocalStorage.js';

const NOW = new Date(2026, 9, 1, 12, 0);

describe('valores predeterminados', () => {
  it('incluyen los apodos, la firma y la fecha configurados', () => {
    const prefs = createDefaultPreferences(NOW);
    expect(prefs.profile.nicknames).toEqual([...DEFAULT_NICKNAMES]);
    expect(prefs.profile.nicknames[0]).toBe('Mi niña');
    expect(prefs.presentation.texts.signature).toBe('Con amor, Alejandro Duque (COLDEX)');
    expect(prefs.dates.relationshipStart).toBe('2025-07-21');
    expect(prefs.appearance).toMatchObject({ style: 'glass', theme: 'dark' });
    expect(prefs.presentation.completed).toBe(false);
    expect(prefs.presentation.candleLetter).toBe('A');
    expect(prefs.presentation.texts.openingLine).toBe('Hay millones de estrellas en el universo...');
  });

  it('celebran el próximo Año Nuevo (o el actual durante enero)', () => {
    expect(defaultCelebrationYear(new Date(2026, 9, 1))).toBe(2027);
    expect(defaultCelebrationYear(new Date(2027, 0, 5))).toBe(2027);
  });
});

describe('validación', () => {
  it('limpia espacios y caracteres de control', () => {
    expect(normalizeText('  Mi   vida\u0007 ')).toBe('Mi vida');
    expect(normalizeText('a\n\n\n\nb', { multiline: true })).toBe('a\n\nb');
  });

  it('valida apodos: vacíos, largos y duplicados', () => {
    expect(validateNickname('   ').error).toMatch(/Escribe/);
    expect(validateNickname('x'.repeat(40)).error).toMatch(/Máximo/);
    expect(validateNickname('mi AMOR', ['Mi amor']).error).toMatch(/ya está/);
    expect(validateNickname('  Mi   cielo ')).toEqual({ value: 'Mi cielo', error: null });
  });

  it('no acepta fechas de inicio futuras ni inválidas, pero sí vacías', () => {
    expect(validateRelationshipStart('2030-01-01', NOW).error).toBeTruthy();
    expect(validateRelationshipStart('2025-02-30', NOW).error).toBeTruthy();
    expect(validateRelationshipStart('', NOW)).toEqual({ value: null, error: null });
    expect(validateRelationshipStart('2025-07-21', NOW).error).toBeNull();
  });

  it('repara campos inválidos sin perder los válidos', () => {
    const { value, issues } = sanitizePreferences(
      {
        profile: { nicknames: ['Mi vida', 42, 'mi vida', ''] },
        appearance: { style: 'neon', theme: 'light', palette: { primary: 'rojo' } },
        calendar: { weekStartsOn: 0 },
        dates: { relationshipStart: null, hourCycle: '25' },
      },
      NOW,
    );
    expect(value.profile.nicknames).toEqual(['Mi vida']);
    expect(value.appearance.style).toBe('glass');
    expect(value.appearance.theme).toBe('light');
    expect(value.appearance.palette.primary).toBe('#ef6f8c');
    expect(value.calendar.weekStartsOn).toBe(0);
    expect(value.dates.relationshipStart).toBeNull();
    expect(value.dates.hourCycle).toBe('12');
    expect(issues).toEqual(expect.arrayContaining(['appearance.style', 'appearance.palette', 'dates.hourCycle']));
    expect(issues).not.toContain('dates.relationshipStart');
  });

  it('valida la letra de la vela: una sola letra, en mayúscula', () => {
    expect(validateCandleLetter(' a ')).toEqual({ value: 'A', error: null });
    expect(validateCandleLetter('ñ').value).toBe('Ñ');
    expect(validateCandleLetter('AB').error).toBeTruthy();
    expect(validateCandleLetter('7').error).toBeTruthy();
    expect(validateCandleLetter('').error).toBeTruthy();
    expect(sanitizePreferences({ presentation: { candleLetter: '??' } }, NOW).value.presentation.candleLetter).toBe('A');
  });

  it('acepta cualquier entrada sin lanzar excepciones', () => {
    for (const input of [null, undefined, 3, 'texto', [], { profile: 'x', presentation: { texts: 5 } }]) {
      expect(() => sanitizePreferences(input, NOW)).not.toThrow();
    }
  });
});

describe('migraciones', () => {
  it('lleva a la versión actual los datos sin versión', () => {
    const { data, migrated, fromVersion } = migratePreferences({ appearance: { theme: 'light' } });
    expect(fromVersion).toBe(0);
    expect(migrated).toBe(true);
    expect(data.schemaVersion).toBe(2);
    expect(data.appearance.theme).toBe('light');
  });

  it('v1 → v2: conserva firma, título y estado; un mensaje personalizado pasa a ser el final', () => {
    const v1 = {
      schemaVersion: 1,
      profile: { nicknames: ['Mi cielo'] },
      appearance: { style: 'maximal', theme: 'light' },
      presentation: {
        completed: true,
        completedAt: '2026-10-01T20:00:00.000Z',
        texts: {
          introTitle: 'Antes de que empiece el año…',
          wishTitle: 'Antes de comenzar, pide un deseo...',
          togetherTitle: 'Un año más',
          togetherMessage: 'Gracias por cada día.',
          signature: 'Tuyo, A.',
        },
      },
    };
    const { data } = migratePreferences(v1);
    const { value, issues } = sanitizePreferences(data, NOW);
    expect(issues).toEqual([]);
    expect(value.presentation.completed).toBe(true);
    expect(value.presentation.texts.togetherTitle).toBe('Un año más');
    expect(value.presentation.texts.signature).toBe('Tuyo, A.');
    expect(value.presentation.texts.finalMessage).toBe('Gracias por cada día.');
    expect(value.presentation.texts.openingLine).toBe('Hay millones de estrellas en el universo...');
    expect(value.presentation.texts).not.toHaveProperty('wishTitle');
    expect(value.presentation.candleLetter).toBe('A');
    expect(value.profile.nicknames).toEqual(['Mi cielo']);
    expect(value.appearance).toMatchObject({ style: 'maximal', theme: 'light' });
  });

  it('v1 → v2: el mensaje predeterminado de la v1 no sustituye al nuevo', () => {
    const v1 = {
      schemaVersion: 1,
      presentation: {
        texts: {
          togetherMessage:
            'Que este nuevo año nos regale más momentos, más risas, más aventuras y muchos recuerdos que todavía nos quedan por construir.',
        },
      },
    };
    const { value } = sanitizePreferences(migratePreferences(v1).data, NOW);
    expect(value.presentation.texts.finalMessage).toMatch(/^Que sigamos descubriendo universos/);
  });

  it('conserva datos de una versión más nueva', () => {
    expect(migratePreferences({ schemaVersion: 99 }).newer).toBe(true);
  });
});

describe('persistencia en localStorage', () => {
  it('sin datos guardados devuelve los predeterminados', () => {
    const result = loadPreferences(NOW);
    expect(result.status).toBe('defaults');
    expect(result.preferences.appearance.style).toBe('glass');
  });

  it('guarda y vuelve a leer (sobrevive a una recarga)', () => {
    const prefs = createDefaultPreferences(NOW);
    prefs.appearance.style = 'maximal';
    prefs.calendar.weekStartsOn = 0;
    savePreferences(prefs);
    __resetForTests();
    const { preferences, status } = loadPreferences(NOW);
    expect(status).toBe('stored');
    expect(preferences.appearance.style).toBe('maximal');
    expect(preferences.calendar.weekStartsOn).toBe(0);
  });

  it('JSON dañado no rompe la carga: usa predeterminados y lo informa', () => {
    localStorage.setItem(PREFERENCES_KEY, '{roto');
    const { preferences, status } = loadPreferences(NOW);
    expect(status).toBe('repaired');
    expect(preferences.profile.nicknames.length).toBeGreaterThan(0);
  });

  it('si localStorage no está disponible, funciona en memoria', () => {
    __resetForTests();
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    const result = savePreferences(createDefaultPreferences(NOW));
    expect(result.persistent).toBe(false);
    expect(loadPreferences(NOW).status).toBe('stored');
    spy.mockRestore();
  });
});

describe('copia de seguridad', () => {
  it('se guarda y recupera desde IndexedDB', async () => {
    const prefs = createDefaultPreferences(NOW);
    prefs.profile.nicknames = ['Mi cielo'];
    expect(await backupPreferences(prefs)).toBe(true);
    const restored = await readPreferencesBackup(NOW);
    expect(restored.profile.nicknames).toEqual(['Mi cielo']);
  });

  it('exporta e importa un archivo válido y rechaza otros', () => {
    const prefs = createDefaultPreferences(NOW);
    prefs.appearance.theme = 'light';
    const { preferences } = parseBackup(serializeBackup(prefs));
    expect(preferences.appearance.theme).toBe('light');
    expect(() => parseBackup('no json')).toThrow(/JSON/);
    expect(() => parseBackup('{"format":"otra-app"}')).toThrow(/copia/);
  });

  it('borrar todo elimina localStorage e IndexedDB de la app, sin tocar otras claves', async () => {
    localStorage.setItem('otra-app', 'x');
    savePreferences(createDefaultPreferences(NOW));
    await backupPreferences(createDefaultPreferences(NOW));
    await deleteAllLocalData();
    expect(localStorage.getItem(PREFERENCES_KEY)).toBeNull();
    expect(localStorage.getItem('otra-app')).toBe('x');
    expect(await readPreferencesBackup(NOW)).toBeNull();
  });
});
