import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SPEC, EFFECTS, frameToText, rowRuns, sanitizeStoredSpec, TEMPLATES, validateImageFile, validateImageSize } from '../flowersOptions.js';

const python = readFileSync(path.resolve('src/features/flowers/python/lix_flowers.py'), 'utf8');
const pyKeys = (name) => [...python.match(new RegExp(`^${name} = \\{([\\s\\S]*?)^\\}`, 'm'))[1].matchAll(/^\s+'([a-z]+)':/gm)].map((m) => m[1]);

const file = (name, type, size = 1000) => ({ name, type, size });

describe('Lix Flowers · opciones', () => {
  it('las plantillas y efectos de la interfaz son exactamente los que valida Python', () => {
    expect(TEMPLATES.map((t) => t.id).sort()).toEqual(pyKeys('TEMPLATES').sort());
    expect(EFFECTS.map((e) => e.value).sort()).toEqual(pyKeys('EFFECTS').sort());
    expect(TEMPLATES).toHaveLength(10);
  });

  it('valida formato, extensión y peso de la imagen', () => {
    expect(validateImageFile(file('rosa.png', 'image/png'))).toBeNull();
    expect(validateImageFile(file('rosa.JPG', 'image/jpeg'))).toBeNull();
    expect(validateImageFile(file('rosa.jpeg', 'image/jpeg'))).toBeNull();
    expect(validateImageFile(file('rosa.webp', 'image/webp'))).toBeNull();
    expect(validateImageFile(file('rosa.gif', 'image/gif'))).toMatch(/Formato no admitido/);
    expect(validateImageFile(file('rosa.png', 'image/jpeg'))).toMatch(/Formato no admitido/);
    expect(validateImageFile(file('rosa.svg', 'image/svg+xml'))).toMatch(/Formato no admitido/);
    expect(validateImageFile(file('rosa.png', 'image/png', 0))).toMatch(/vacío/);
    expect(validateImageFile(file('rosa.png', 'image/png', 13 * 1024 * 1024))).toMatch(/12 MB/);
    expect(validateImageFile(null)).toMatch(/ningún archivo/);
  });

  it('valida las dimensiones', () => {
    expect(validateImageSize(640, 480)).toBeNull();
    expect(validateImageSize(15, 400)).toMatch(/pequeña/);
    expect(validateImageSize(8000, 6000)).toMatch(/demasiados píxeles/);
  });

  it('sanea la configuración guardada', () => {
    expect(sanitizeStoredSpec(null)).toEqual(DEFAULT_SPEC);
    expect(sanitizeStoredSpec({ template: 'rosa', cols: 96, intensity: 0.3, background: '#ffffff', colors: 'mono' })).toMatchObject({
      template: 'rosa',
      cols: 96,
      intensity: 0.3,
      background: '#ffffff',
      colors: 'mono',
    });
    expect(sanitizeStoredSpec({ template: 'x', cols: 1000, intensity: 7, background: 'red', seed: -1 })).toEqual(DEFAULT_SPEC);
  });

  it('agrupa cada fila en tramos de un mismo color y exporta el texto', () => {
    const k = (indices) => indices.map((i) => String.fromCharCode(0x100 + i)).join('');
    const animation = { cols: 6, rows: 2, frames: [{ c: '@@ *  ' + ' .  o ', k: k([1, 1, 0, 2, 0, 0, 0, 3, 0, 0, 3, 0]) }] };
    expect(rowRuns(animation.frames[0], 6, 0)).toEqual([
      { start: 0, color: 1, text: '@@' },
      { start: 3, color: 2, text: '*' },
    ]);
    expect(rowRuns(animation.frames[0], 6, 1)).toEqual([{ start: 1, color: 3, text: '.  o' }]);
    expect(frameToText(animation, 0)).toBe('@@ *\n .  o');
  });
});
