import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildSnapshot } from './snapshot.js';

// El mismo script que carga el Service Worker con importScripts.
beforeAll(() => {
  new Function(readFileSync(path.resolve('public/widgets/widget-data.js'), 'utf8'))();
});

const settings = { enabled: true, inApp: true, notifications: false, frequencyMinutes: 60, startTime: '08:00', endTime: '21:00', days: [0, 1, 2, 3, 4, 5, 6], categories: ['amor'] };
const now = new Date(2026, 10, 11, 10, 30);

describe('Widget de Windows 11 (Adaptive Card)', () => {
  it('sin instantánea pide abrir la app', () => {
    expect(globalThis.lixWidgetData(null, now)).toMatchObject({ tip: 'Abre Lix una vez para preparar este widget.', hasAcademic: false });
  });

  it('muestra el consejo vigente y la próxima clase, tarea y parcial', () => {
    const snapshot = buildSnapshot({
      subjects: [{ id: 's', name: 'Cálculo', color: '#f00', archived: false, schedule: [{ weekday: 4, start: '08:00', end: '10:00', room: '301' }], building: 'Bloque A', skipDates: [], startDate: null, endDate: null }],
      activities: [
        { id: 'a', type: 'assignment', title: 'Taller', subjectId: 's', dueDate: '2026-11-12', dueTime: null, status: 'pending' },
        { id: 'b', type: 'exam', title: 'Final', subjectId: 's', dueDate: '2026-11-20', dueTime: '09:00', status: 'pending' },
      ],
      academicDates: [],
      tipSettings: settings,
      tipState: { history: [], favorites: [], lastSlot: '' },
      customTips: [],
      now,
    });
    const data = globalThis.lixWidgetData(JSON.parse(JSON.stringify(snapshot)), now);
    expect(data.eyebrow).toBe('CONSEJO · AMOR');
    expect(data.tip).toBe(snapshot.tips.timeline[0].text);
    expect(data.nextClass).toMatch(/^Clase: Cálculo — mañana .*301 · Bloque A$/);
    expect(data.nextTask).toBe('Trabajo: Taller — mañana');
    expect(data.nextExam).toMatch(/^Examen: Final — /);
    expect(data.hasAcademic).toBe(true);
  });

  it('la plantilla es JSON válido, Adaptive Card 1.5, con la acción «open» que maneja el Service Worker', () => {
    const template = JSON.parse(readFileSync(path.resolve('public/widgets/lix-widget-template.json'), 'utf8'));
    expect(template).toMatchObject({ type: 'AdaptiveCard', version: '1.5' });
    expect(template.actions).toEqual([{ type: 'Action.Execute', title: 'Abrir Lix', verb: 'open' }]);
    const sw = readFileSync(path.resolve('public/service-worker.js'), 'utf8');
    expect(sw).toMatch(/event\.action !== 'open'/);
    const manifest = JSON.parse(readFileSync(path.resolve('public/manifest.webmanifest'), 'utf8'));
    expect(manifest.widgets[0]).toMatchObject({ tag: 'lix-dia', ms_ac_template: 'widgets/lix-widget-template.json' });
    expect(sw).toMatch(new RegExp(`WIDGET_TAG = '${manifest.widgets[0].tag}'`));
  });
});
