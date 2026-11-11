import { describe, expect, it } from 'vitest';
import { academicProjection, buildSnapshot, SNAPSHOT_VERSION, tipTimeline } from './snapshot.js';
import { isAndroidShell, pinAndroidWidget, publishSnapshot, saveFileNative } from './androidBridge.js';

const settings = { enabled: true, inApp: true, notifications: true, frequencyMinutes: 60, startTime: '08:00', endTime: '21:00', days: [0, 1, 2, 3, 4, 5, 6], categories: ['amor', 'bienestar'] };
const state = { history: [], favorites: [], lastSlot: '' };
// Miércoles 11 de noviembre de 2026, 10:30.
const now = new Date(2026, 10, 11, 10, 30);

describe('Instantánea para widgets', () => {
  it('consejos: la franja actual y las próximas 7 jornadas, sin repetir seguidos', () => {
    const timeline = tipTimeline({ settings, state, customTips: [], now });
    expect(timeline[0]).toMatchObject({ key: '2026-11-11#2', at: new Date(2026, 10, 11, 10).toISOString() });
    expect(timeline.length).toBe(1 + 10 + 13 * 6);
    expect(timeline.every((t) => ['amor', 'bienestar'].includes(t.category))).toBe(true);
    for (let i = 1; i < timeline.length; i += 1) expect(timeline[i].id).not.toBe(timeline[i - 1].id);
  });

  it('si la franja actual ya se mostró, el widget enseña ese mismo consejo', () => {
    const shown = { ...state, lastSlot: '2026-11-11#2', history: [{ tipId: 'lix-amor-03', shownAt: now.toISOString(), channel: 'app' }] };
    expect(tipTimeline({ settings, state: shown, customTips: [], now })[0].id).toBe('lix-amor-03');
  });

  it('con los consejos desactivados hay uno por día para el widget y ninguna notificación', () => {
    const snapshot = buildSnapshot({ subjects: [], activities: [], academicDates: [], tipSettings: { ...settings, enabled: false }, tipState: state, customTips: [], now });
    expect(snapshot.tips.notifications).toBe(false);
    expect(snapshot.tips.timeline).toHaveLength(7);
    expect(snapshot.tips.timeline[0].key).toBe('dia-2026-11-11');
  });

  it('académico: clases de los próximos 14 días sin festivos, pendientes con hora y vencidas', () => {
    const subjects = [{ id: 's1', name: 'Cálculo', color: '#ef6f8c', archived: false, schedule: [{ weekday: 4, start: '08:00', end: '10:00', room: '301', building: '' }], building: 'Bloque A', room: '', skipDates: [], startDate: null, endDate: null }];
    const activities = [
      { id: 'a', type: 'midterm', title: 'Parcial', subjectId: 's1', dueDate: '2026-11-14', dueTime: '08:00', status: 'pending' },
      { id: 'b', type: 'reading', title: 'Lectura', subjectId: null, dueDate: '2026-11-12', dueTime: null, status: 'in_progress' },
      { id: 'c', type: 'assignment', title: 'Vieja', subjectId: 's1', dueDate: '2026-11-01', dueTime: null, status: 'pending' },
      { id: 'd', type: 'assignment', title: 'Hecha', subjectId: 's1', dueDate: '2026-11-13', dueTime: null, status: 'done' },
    ];
    const academicDates = [{ id: 'h', type: 'holiday', name: 'Festivo', date: '2026-11-19', endDate: null, yearly: false }];
    const projection = academicProjection({ subjects, activities, academicDates }, now);
    // Jueves dentro de los 14 días: 12 y 19; el 19 es festivo y se omite → una sola clase.
    expect(projection.classes.map((c) => c.start)).toEqual([new Date(2026, 10, 12, 8).toISOString()]);
    expect(projection.classes[0]).toMatchObject({ subject: 'Cálculo', room: '301', building: 'Bloque A' });
    expect(projection.activities.map((a) => [a.title, a.hasTime, a.evaluation])).toEqual([
      ['Lectura', false, false],
      ['Parcial', true, true],
    ]);
    expect(projection.activities[0].due).toBe(new Date(2026, 10, 12, 23, 59).toISOString());
    expect(projection.overdue).toBe(1);
    expect(projection.dates).toEqual([{ name: 'Festivo', type: 'holiday', date: '2026-11-19' }]);
  });

  it('formato versionado y serializable', () => {
    const snapshot = buildSnapshot({ subjects: [], activities: [], academicDates: [], tipSettings: settings, tipState: state, customTips: [], flowers: { cols: 2, rows: 1, chars: '@*', colors: 'āĂ', palette: ['#000000', '#ff0000', '#00ff00'], background: '#000000', title: 'x' }, now });
    expect(snapshot.version).toBe(SNAPSHOT_VERSION);
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
  });
});

describe('Puente Android fuera del APK', () => {
  it('en la web no hace nada y no falla', async () => {
    expect(isAndroidShell()).toBe(false);
    expect(publishSnapshot({})).toBe(false);
    expect(pinAndroidWidget('tip')).toBe(false);
    expect(await saveFileNative(new Blob(['x']), 'x.txt')).toBe(false);
  });

  it('dentro del APK delega en window.LixAndroid', () => {
    const calls = [];
    window.LixAndroid = { publishSnapshot: (json) => calls.push(JSON.parse(json)) && true, pinWidget: (kind) => kind === 'tip' };
    try {
      expect(isAndroidShell()).toBe(true);
      expect(publishSnapshot({ version: 1 })).toBe(true);
      expect(calls).toEqual([{ version: 1 }]);
      expect(pinAndroidWidget('tip')).toBe(true);
      expect(pinAndroidWidget('otro')).toBe(false);
    } finally {
      delete window.LixAndroid;
    }
  });
});
