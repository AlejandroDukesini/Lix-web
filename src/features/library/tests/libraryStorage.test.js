import { describe, expect, it } from 'vitest';
import { dbGet, STORES } from '../../../services/storage/database.js';
import { createBackup, parseFullBackup } from '../../../services/backup/backupService.js';
import { createDefaultPreferences } from '../../../services/preferences/defaults.js';
import {
  readLibraryState,
  sanitizeLibraryState,
  saveProgress,
  setFontScale,
  toggleBookmark,
  toggleFavorite,
} from '../services/libraryStorage.js';

describe('estado de la biblioteca', () => {
  it('guarda favoritos, marcadores y tamaño de texto en IndexedDB', async () => {
    await toggleFavorite('big-bang');
    await toggleBookmark('big-bang', 'radiacion-de-fondo', 'Radiación de fondo');
    await setFontScale(1.2);
    const raw = await dbGet(STORES.library, 'state');
    expect(raw.favorites).toEqual(['big-bang']);
    expect(raw.bookmarks[0]).toMatchObject({ docId: 'big-bang', sectionId: 'radiacion-de-fondo' });
    expect(raw.settings.fontScale).toBe(1.2);

    await toggleFavorite('big-bang');
    await toggleBookmark('big-bang', 'radiacion-de-fondo', 'Radiación de fondo');
    const state = await readLibraryState();
    expect(state.favorites).toEqual([]);
    expect(state.bookmarks).toEqual([]);
  });

  it('un documento terminado sigue leído aunque se vuelva arriba', async () => {
    const now = new Date('2026-10-13T10:00:00Z');
    await saveProgress('kepler', { percent: 0.5, section: 'tycho' }, now);
    expect((await readLibraryState()).progress.kepler.finishedAt).toBeNull();
    await saveProgress('kepler', { percent: 0.99, section: 'epilogo' }, now);
    await saveProgress('kepler', { percent: 0.1, section: null }, now);
    const progress = (await readLibraryState()).progress.kepler;
    expect(progress.finishedAt).toBe(now.toISOString());
    expect(progress.percent).toBe(0.1);
    expect(progress.section).toBe('epilogo');
  });

  it('las escrituras simultáneas no se pisan', async () => {
    await Promise.all([toggleFavorite('a'), toggleFavorite('b'), toggleFavorite('c')]);
    expect((await readLibraryState()).favorites.sort()).toEqual(['a', 'b', 'c']);
  });

  it('descarta datos dañados o sospechosos sin romperse', () => {
    const { value, issues } = sanitizeLibraryState({
      favorites: ['ok', '<script>', 7, 'ok'],
      progress: { bueno: { percent: 4, updatedAt: 'nunca' }, 'MAL ID': {} },
      bookmarks: [{ docId: 'x', sectionId: 'y' }, { docId: 'x', sectionId: 'y' }, 'basura'],
      settings: { fontScale: 9 },
    });
    expect(value.favorites).toEqual(['ok']);
    expect(value.progress.bueno).toEqual({ percent: 1, section: null, updatedAt: null, finishedAt: null });
    expect(value.progress['MAL ID']).toBeUndefined();
    expect(value.bookmarks).toHaveLength(1);
    expect(value.settings.fontScale).toBe(1);
    expect(issues.length).toBeGreaterThan(0);
    expect(sanitizeLibraryState('texto').value.favorites).toEqual([]);
  });

  it('forma parte de la copia de seguridad completa', async () => {
    await toggleFavorite('kepler');
    await saveProgress('kepler', { percent: 1, section: null });
    const backup = await createBackup({ preferences: createDefaultPreferences() });
    expect(backup.sections.library.favorites).toEqual(['kepler']);
    const plan = parseFullBackup(JSON.stringify(backup));
    const section = plan.sections.find((s) => s.id === 'library');
    expect(section.summary).toBe('1 lectura terminada · 1 favorito · 0 marcadores');
  });
});
