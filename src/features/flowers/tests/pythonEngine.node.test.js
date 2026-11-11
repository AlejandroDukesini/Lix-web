// @vitest-environment node
/**
 * El motor real: lix_flowers.py dentro de Pyodide (CPython en WebAssembly), con la misma
 * rueda de Pillow que se empaqueta en la app. Es la misma ruta que usa el Web Worker.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPyodide } from 'pyodide';
import { beforeAll, describe, expect, it } from 'vitest';
import { pyodideFiles } from '../../../../scripts/vite-plugin-pyodide.js';
import { TEMPLATES } from '../flowersOptions.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
let py;
let engine;

function pngOfFlower() {
  // Imagen de prueba hecha con Pillow dentro de Pyodide: una flor sobre fondo verde.
  return py.runPython(`
import io, math
from PIL import Image, ImageDraw
im = Image.new('RGB', (320, 240), (20, 40, 25)); d = ImageDraw.Draw(im)
for k in range(8):
    a = k * math.pi / 4
    d.ellipse((160 + math.cos(a)*40 - 30, 120 + math.sin(a)*40 - 30, 160 + math.cos(a)*40 + 30, 120 + math.sin(a)*40 + 30), fill=(240, 80, 120))
d.ellipse((135, 95, 185, 145), fill=(250, 230, 120))
buf = io.BytesIO(); im.save(buf, 'PNG'); buf.getvalue()
`);
}

beforeAll(async () => {
  py = await loadPyodide({ indexURL: `${path.join(root, 'node_modules/pyodide')}/`, packageBaseUrl: `${path.join(root, 'vendor/pyodide')}/` });
  await py.loadPackage('pillow', { messageCallback: () => {} });
  py.FS.writeFile('/home/pyodide/lix_flowers.py', readFileSync(path.join(root, 'src/features/flowers/python/lix_flowers.py'), 'utf8'));
  engine = py.pyimport('lix_flowers');
}, 120_000);

const build = (spec, image) => JSON.parse(image ? engine.build(JSON.stringify(spec), image) : engine.build(JSON.stringify(spec)));

describe('Lix Flowers · Python en Pyodide', () => {
  it('el runtime empaquetado es el que se prueba (checksum de Pillow verificado)', () => {
    const files = pyodideFiles();
    expect([...files.keys()]).toEqual(expect.arrayContaining(['pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json']));
    expect(py.runPython('import sys; list(sys.version_info[:2])').toJs()).toEqual([3, 14]);
    expect(py.runPython('import PIL; PIL.__version__')).toBe('12.2.0');
  });

  it.each(TEMPLATES.map((t) => t.id))('plantilla «%s»: fotogramas completos, colores válidos y determinista', (template) => {
    const a = build({ template, cols: 48, frames: 12 });
    expect(a.cols).toBe(48);
    expect(a.frames).toHaveLength(12);
    for (const frame of a.frames) {
      expect(frame.c).toHaveLength(a.cols * a.rows);
      expect(frame.k).toHaveLength(a.cols * a.rows);
      for (let i = 0; i < frame.k.length; i += 1) expect(frame.k.charCodeAt(i) - 0x100).toBeLessThan(a.palette.length);
    }
    expect(a.frames.some((f) => f.c.trim().length > 20)).toBe(true);
    expect(build({ template, cols: 48, frames: 12 }).frames).toEqual(a.frames);
  });

  it('las plantillas cambian con la semilla, el tema y la cantidad de caracteres', () => {
    const base = build({ template: 'jardin', cols: 48, frames: 12 });
    expect(build({ template: 'jardin', cols: 48, frames: 12, seed: 99 }).frames).not.toEqual(base.frames);
    expect(build({ template: 'jardin', cols: 48, frames: 12, colors: 'lavanda' }).palette).not.toEqual(base.palette);
    expect(build({ template: 'jardin', cols: 48, frames: 12, charset: 'detallado' }).frames).not.toEqual(base.frames);
    expect(build({ template: 'jardin', cols: 48, frames: 12, colors: 'mono', mono: '#3d8bd9' }).palette.length).toBeGreaterThan(2);
  });

  it('sanea la configuración que llega de fuera', () => {
    const a = build({ template: 'inventada', cols: 9999, frames: -4, intensity: 'mucho', background: 'javascript:' });
    expect(a.spec).toMatchObject({ template: 'jardin', cols: 120, frames: 12, intensity: 0.6, background: '#0e0b17' });
  });

  it.each(['floracion', 'brisa', 'brillo', 'petalos', 'latido'])('imagen con el efecto «%s»', (effect) => {
    const png = pngOfFlower();
    const a = build({ source: 'image', effect, cols: 40, frames: 12, colors: 'original' }, png);
    expect(a.info).toEqual({ format: 'PNG', width: 320, height: 240 });
    expect(a.frames).toHaveLength(12);
    const ink = a.frames[a.frames.length - 1].c.replace(/ /g, '').length;
    expect(ink).toBeGreaterThan(40);
    expect(ink).toBeLessThan(a.cols * a.rows * 0.8); // el fondo de la foto queda vacío
    png.destroy();
  });

  it('rechaza imágenes vacías, dañadas o en formatos no admitidos con mensajes claros', () => {
    const fail = (bytes) => {
      try {
        engine.build(JSON.stringify({ source: 'image' }), bytes);
      } catch (error) {
        return error.message.trim().split('\n').pop();
      }
      return 'sin error';
    };
    expect(fail(new Uint8Array(0))).toMatch(/FlowerError: No se recibió ninguna imagen/);
    expect(fail(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toMatch(/FlowerError: El archivo no es una imagen válida/);
    const gif = py.runPython("import io\nfrom PIL import Image\nb = io.BytesIO(); Image.new('RGB', (40, 40)).save(b, 'GIF'); b.getvalue()");
    expect(fail(gif)).toMatch(/FlowerError: Formato no admitido/);
    const tiny = py.runPython("import io\nfrom PIL import Image\nb = io.BytesIO(); Image.new('RGB', (8, 8)).save(b, 'PNG'); b.getvalue()");
    expect(fail(tiny)).toMatch(/FlowerError: La imagen es demasiado pequeña/);
  });

  it('exporta un GIF animado válido con Pillow', () => {
    build({ template: 'girasol', cols: 48, frames: 12 });
    const proxy = engine.render_gif(12, 2);
    const view = proxy.getBuffer('u8');
    const bytes = view.data.slice();
    view.release();
    proxy.destroy();
    expect(String.fromCharCode(...bytes.slice(0, 6))).toBe('GIF89a');
    py.globals.set('gif_bytes', bytes);
    const info = py.runPython("import io\nfrom PIL import Image\nim = Image.open(io.BytesIO(gif_bytes.to_bytes())); [im.n_frames, im.size[0], im.info.get('duration'), im.info.get('loop')]").toJs();
    // El GIF guarda centésimas de segundo: 1000 / 12 = 83 ms → 80 ms.
    expect(info).toEqual([12, 48 * 6 * 2, 80, 0]);
  });
});
