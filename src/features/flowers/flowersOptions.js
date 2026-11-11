/**
 * Opciones de Lix Flowers para la interfaz. Las claves deben coincidir con las de
 * python/lix_flowers.py (una prueba lo comprueba): Python es quien las valida.
 */

export const TEMPLATES = [
  { id: 'crecer', label: 'Flores creciendo', art: ['  @  ', ' \\|/ ', '  |  '] },
  { id: 'petalos', label: 'Pétalos cayendo', art: ['==*=-', " ' . ", '. `  '] },
  { id: 'rosa', label: 'Rosa animada', art: [' (@) ', ' ~|  ', '  |~ '] },
  { id: 'girasol', label: 'Girasol', art: ['\\|||/', '-(o)-', '/|||\\'] },
  { id: 'jardin', label: 'Jardín', art: ['@ * @', '| | |', "'\"'\"'"] },
  { id: 'lluvia', label: 'Lluvia de flores', art: ["' * '", ' o  @', "*  ' "] },
  { id: 'corazon', label: 'Corazón de flores', art: ['@@ @@', ' @@@ ', '  @  '] },
  { id: 'brillantes', label: 'Flores brillantes', art: ['° · °', '·(@)·', '° · °'] },
  { id: 'floracion', label: 'Floración progresiva', art: [' .:. ', ':(@):', ' .:. '] },
  { id: 'nocturno', label: 'Jardín nocturno', art: ['*  (@', ' ·  *', '@ | @'] },
];

export const EFFECTS = [
  { value: 'floracion', label: 'Floración', description: 'La imagen aparece desde el centro' },
  { value: 'brisa', label: 'Brisa', description: 'Se mece como con viento' },
  { value: 'brillo', label: 'Brillo', description: 'Destellos sobre lo luminoso' },
  { value: 'petalos', label: 'Pétalos', description: 'Pétalos que caen encima' },
  { value: 'latido', label: 'Latido', description: 'La intensidad respira' },
];

export const THEMES = [
  { value: 'jardin', label: 'Jardín', swatch: ['#ff6f91', '#ffc75f', '#7cc47f'] },
  { value: 'rosa', label: 'Rosas', swatch: ['#ff4d6d', '#ff8fa3', '#6aa36f'] },
  { value: 'atardecer', label: 'Atardecer', swatch: ['#ff7b54', '#ffd56b', '#b5446e'] },
  { value: 'lavanda', label: 'Lavanda', swatch: ['#9d7bff', '#d7c4ff', '#79b39a'] },
  { value: 'luna', label: 'Luz de luna', swatch: ['#dfe7ff', '#9fb4f2', '#7d9aa8'] },
];

export const BACKGROUNDS = [
  { value: '#0e0b17', label: 'Noche' },
  { value: '#25101c', label: 'Vino' },
  { value: '#0d1a14', label: 'Bosque' },
  { value: '#f6efe3', label: 'Papel' },
];

export const SIZES = [
  { value: 48, label: 'Pequeño', description: '48 columnas' },
  { value: 72, label: 'Mediano', description: '72 columnas' },
  { value: 96, label: 'Grande', description: '96 columnas' },
];

export const CHARSETS = [
  { value: 'sencillo', label: 'Pocos', description: '5 caracteres' },
  { value: 'medio', label: 'Medio', description: '10 caracteres' },
  { value: 'detallado', label: 'Muchos', description: '70 caracteres' },
];

export const DEFAULT_SPEC = Object.freeze({
  source: 'template',
  template: 'jardin',
  effect: 'brisa',
  cols: 72,
  frames: 36,
  charset: 'medio',
  colors: 'jardin',
  mono: '#ff8fa3',
  background: '#0e0b17',
  intensity: 0.6,
  seed: 7,
});

export const DEFAULT_FPS = 10;
export const FPS_RANGE = [4, 24];

/** Formatos y límites de las imágenes (Python vuelve a validarlos al leerlas). */
export const IMAGE_TYPES = { 'image/png': ['png'], 'image/jpeg': ['jpg', 'jpeg'], 'image/webp': ['webp'] };
export const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
export const MIN_IMAGE_SIDE = 16;
export const MAX_IMAGE_PIXELS = 40_000_000;

/** Validación previa (sin leer el contenido): tipo, extensión y peso. Devuelve un mensaje o null. */
export function validateImageFile(file) {
  if (!file) return 'No se eligió ningún archivo.';
  const ext = String(file.name ?? '').split('.').pop().toLowerCase();
  const allowed = IMAGE_TYPES[file.type];
  if (!allowed || !allowed.includes(ext)) return 'Formato no admitido. Usa una imagen PNG, JPG, JPEG o WEBP.';
  if (!file.size) return 'El archivo está vacío.';
  if (file.size > MAX_IMAGE_BYTES) return 'La imagen pesa más de 12 MB. Prueba con una más pequeña.';
  return null;
}

/** Validación de dimensiones tras decodificar la imagen. */
export function validateImageSize(width, height) {
  if (!(width >= MIN_IMAGE_SIDE && height >= MIN_IMAGE_SIDE)) return 'La imagen es demasiado pequeña (mínimo 16 × 16 píxeles).';
  if (width * height > MAX_IMAGE_PIXELS) return 'La imagen tiene demasiados píxeles (máximo 40 megapíxeles).';
  return null;
}

/** Normaliza lo guardado de una sesión anterior (localStorage puede traer cualquier cosa). */
export function sanitizeStoredSpec(raw) {
  const spec = { ...DEFAULT_SPEC };
  if (!raw || typeof raw !== 'object') return spec;
  if (TEMPLATES.some((t) => t.id === raw.template)) spec.template = raw.template;
  if (EFFECTS.some((e) => e.value === raw.effect)) spec.effect = raw.effect;
  if (SIZES.some((s) => s.value === raw.cols)) spec.cols = raw.cols;
  if (CHARSETS.some((c) => c.value === raw.charset)) spec.charset = raw.charset;
  if ([...THEMES.map((t) => t.value), 'mono', 'original'].includes(raw.colors)) spec.colors = raw.colors;
  if (/^#[0-9a-f]{6}$/i.test(raw.mono ?? '')) spec.mono = raw.mono;
  if (/^#[0-9a-f]{6}$/i.test(raw.background ?? '')) spec.background = raw.background;
  if (typeof raw.intensity === 'number' && raw.intensity >= 0.1 && raw.intensity <= 1) spec.intensity = raw.intensity;
  if (Number.isInteger(raw.seed) && raw.seed >= 0 && raw.seed < 2 ** 31) spec.seed = raw.seed;
  return spec;
}

/** Texto plano de un fotograma (para exportar como .txt). */
export function frameToText(animation, index) {
  const frame = animation.frames[index] ?? animation.frames[0];
  const rows = [];
  for (let r = 0; r < animation.rows; r += 1) rows.push(frame.c.slice(r * animation.cols, (r + 1) * animation.cols).replace(/\s+$/, ''));
  return rows.join('\n');
}

/** Tramos de un fila con el mismo color (los espacios no cortan el tramo): menos llamadas a fillText. */
export function rowRuns(frame, cols, row) {
  const runs = [];
  let start = -1;
  let color = -1;
  let text = '';
  for (let c = 0; c < cols; c += 1) {
    const i = row * cols + c;
    const ch = frame.c[i];
    if (ch === ' ') {
      if (start >= 0) text += ' ';
      continue;
    }
    const k = frame.k.charCodeAt(i) - 0x100;
    if (start >= 0 && k === color) {
      text += ch;
      continue;
    }
    if (start >= 0) runs.push({ start, color, text: text.trimEnd() });
    start = c;
    color = k;
    text = ch;
  }
  if (start >= 0) runs.push({ start, color, text: text.trimEnd() });
  return runs;
}
