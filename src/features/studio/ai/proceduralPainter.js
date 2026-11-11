/**
 * Pintor procedural de Lix AI Studio.
 *
 * NO ES INTELIGENCIA ARTIFICIAL. Lee la descripción, reconoce palabras clave de una
 * lista fija (cielo, mar, flores, colores…) y compone una escena con formas dibujadas
 * en un <canvas>. Todo es local y determinista: la misma descripción y la misma
 * variación producen la misma imagen. La interfaz enseña qué palabras reconoció.
 */

/** Vocabulario reconocido. Cada entrada: id, palabras (es/en, sin tildes) y tipo. */
export const VOCABULARY = [
  { id: 'sunset', kind: 'sky', label: 'atardecer', words: ['atardecer', 'ocaso', 'puesta de sol', 'anochecer', 'sunset', 'dusk'] },
  { id: 'dawn', kind: 'sky', label: 'amanecer', words: ['amanecer', 'alba', 'madrugada', 'sunrise', 'dawn'] },
  { id: 'night', kind: 'sky', label: 'noche', words: ['noche', 'nocturno', 'nocturna', 'night', 'medianoche'] },
  { id: 'storm', kind: 'sky', label: 'tormenta', words: ['tormenta', 'tempestad', 'storm', 'nublado', 'gris'] },
  { id: 'day', kind: 'sky', label: 'día', words: ['dia', 'mediodia', 'soleado', 'day', 'sunny'] },
  { id: 'sun', kind: 'element', label: 'sol', words: ['sol', 'sun'] },
  { id: 'moon', kind: 'element', label: 'luna', words: ['luna', 'moon', 'lunar'] },
  { id: 'stars', kind: 'element', label: 'estrellas', words: ['estrella', 'estrellas', 'estrellado', 'estrellada', 'estrellados', 'estrelladas', 'galaxia', 'cosmos', 'universo', 'stars', 'star'] },
  { id: 'clouds', kind: 'element', label: 'nubes', words: ['nube', 'nubes', 'cloud', 'clouds'] },
  { id: 'mountains', kind: 'element', label: 'montañas', words: ['montana', 'montanas', 'cordillera', 'volcan', 'mountain', 'mountains', 'colina', 'colinas'] },
  { id: 'sea', kind: 'element', label: 'mar', words: ['mar', 'oceano', 'playa', 'olas', 'sea', 'ocean', 'beach', 'lago', 'lake'] },
  { id: 'river', kind: 'element', label: 'río', words: ['rio', 'arroyo', 'river', 'cascada'] },
  { id: 'field', kind: 'element', label: 'pradera', words: ['campo', 'pradera', 'prado', 'cesped', 'pasto', 'field', 'meadow', 'jardin', 'garden'] },
  { id: 'trees', kind: 'element', label: 'árboles', words: ['arbol', 'arboles', 'bosque', 'selva', 'tree', 'trees', 'forest', 'pino', 'pinos'] },
  { id: 'flowers', kind: 'element', label: 'flores', words: ['flor', 'flores', 'rosa', 'rosas', 'girasol', 'girasoles', 'tulipan', 'tulipanes', 'margarita', 'margaritas', 'flower', 'flowers', 'jardin', 'garden'] },
  { id: 'city', kind: 'element', label: 'ciudad', words: ['ciudad', 'edificios', 'rascacielos', 'pueblo', 'city', 'town', 'skyline'] },
  { id: 'hearts', kind: 'element', label: 'corazones', words: ['corazon', 'corazones', 'amor', 'romantico', 'romantica', 'heart', 'hearts', 'love', 'novia', 'novio', 'te amo'] },
  { id: 'birds', kind: 'element', label: 'aves', words: ['pajaro', 'pajaros', 'ave', 'aves', 'gaviota', 'gaviotas', 'bird', 'birds'] },
  { id: 'rain', kind: 'weather', label: 'lluvia', words: ['lluvia', 'lluvioso', 'llueve', 'rain', 'rainy'] },
  { id: 'snow', kind: 'weather', label: 'nieve', words: ['nieve', 'nevado', 'nevada', 'nevados', 'nevadas', 'invierno', 'snow', 'winter', 'snowy'] },
];

/** Colores reconocidos → tono (grados HSL). */
export const COLOR_WORDS = {
  rojo: 355, roja: 355, rojos: 355, rojas: 355, red: 355, carmesi: 348,
  rosa: 335, rosado: 335, rosada: 335, pink: 335, fucsia: 320,
  naranja: 25, naranjas: 25, anaranjado: 25, orange: 25,
  amarillo: 50, amarilla: 50, amarillos: 50, amarillas: 50, dorado: 44, dorada: 44, dorados: 44, doradas: 44, yellow: 50, gold: 44,
  verde: 135, verdes: 135, green: 135, esmeralda: 150,
  turquesa: 175, cian: 185, teal: 175,
  azul: 215, azules: 215, blue: 215, celeste: 200, celestes: 200,
  morado: 275, morada: 275, morados: 275, moradas: 275, violeta: 270, violetas: 270, lila: 285, lavanda: 265, purple: 275,
};

export function normalizeText(text) {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ñ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hashString(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Generador pseudoaleatorio con semilla (mulberry32). */
export function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hasWord(normalized, word) {
  return new RegExp(`(^| )${word}( |$)`).test(normalized);
}

/**
 * Interpreta la descripción. Devuelve el plan de la escena y qué se reconoció.
 * Si no reconoce nada, lo dice (`recognized` vacío) y pinta un paisaje con la semilla del texto.
 */
export function interpretPrompt(prompt, variation = 0) {
  const normalized = normalizeText(prompt);
  const found = VOCABULARY.filter((entry) => entry.words.some((word) => hasWord(normalized, word)));
  const hues = Object.entries(COLOR_WORDS)
    .filter(([word]) => hasWord(normalized, word))
    .map(([word, hue]) => ({ word, hue }));
  const skyEntry = found.find((entry) => entry.kind === 'sky');
  const elements = new Set(found.filter((entry) => entry.kind !== 'sky').map((entry) => entry.id));
  const sky = skyEntry?.id ?? (elements.has('moon') || elements.has('stars') ? 'night' : 'day');
  if (sky === 'night' && !elements.has('moon') && !elements.has('sun')) elements.add('stars');
  if ((sky === 'day' || sky === 'dawn') && !elements.has('moon') && !elements.has('sun') && !elements.has('rain') && !elements.has('storm')) elements.add('sun');
  // Siempre hay un suelo: si no se pide ninguno, una pradera.
  if (!['sea', 'field', 'city', 'mountains', 'river'].some((id) => elements.has(id))) elements.add('field');
  const seed = (hashString(normalized) + Math.imul(variation, 2654435761)) >>> 0;
  return {
    seed,
    sky,
    elements: [...elements],
    hues: hues.map((h) => h.hue),
    recognized: [...found.map((entry) => entry.label), ...hues.map((h) => h.word)].filter((v, i, all) => all.indexOf(v) === i),
  };
}

/* ------------------------------------------------------------------------------------ */
/* Pintura                                                                                */
/* ------------------------------------------------------------------------------------ */

const SKIES = {
  day: ['#7ec8f2', '#bfe6fb', '#f1f8fd'],
  dawn: ['#6d78c9', '#f2a6a0', '#ffe2b8'],
  sunset: ['#3b2a63', '#c8507a', '#ffb067'],
  night: ['#05060f', '#141a3d', '#2d2a5a'],
  storm: ['#3e4652', '#68707c', '#9aa2ac'],
};

const hsl = (h, s, l, a = 1) => `hsla(${Math.round(((h % 360) + 360) % 360)}, ${Math.round(s)}%, ${Math.round(l)}%, ${a})`;

function accentHue(plan, rnd, fallback) {
  return plan.hues.length ? plan.hues[Math.floor(rnd() * plan.hues.length)] : fallback;
}

function ridge(ctx, w, h, base, amp, rnd, color, roughness = 6) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, h);
  const points = 18;
  const phase = rnd() * 10;
  for (let i = 0; i <= points; i += 1) {
    const x = (i / points) * w;
    let y = base;
    for (let o = 1; o <= 3; o += 1) y -= (amp / o) * Math.abs(Math.sin(phase * o + (i / points) * roughness * o));
    ctx.lineTo(x, y + rnd() * amp * 0.08);
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
}

function flower(ctx, x, y, r, hue, rnd) {
  const petals = 5 + Math.floor(rnd() * 3);
  ctx.fillStyle = hsl(hue, 75, 62);
  for (let i = 0; i < petals; i += 1) {
    const a = (i / petals) * Math.PI * 2 + rnd();
    ctx.beginPath();
    ctx.ellipse(x + Math.cos(a) * r * 0.7, y + Math.sin(a) * r * 0.7, r * 0.62, r * 0.38, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = hsl(45, 90, 60);
  ctx.beginPath();
  ctx.arc(x, y, r * 0.38, 0, Math.PI * 2);
  ctx.fill();
}

function heart(ctx, x, y, s, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.3);
  ctx.bezierCurveTo(x, y, x - s * 0.5, y, x - s * 0.5, y + s * 0.3);
  ctx.bezierCurveTo(x - s * 0.5, y + s * 0.6, x, y + s * 0.78, x, y + s);
  ctx.bezierCurveTo(x, y + s * 0.78, x + s * 0.5, y + s * 0.6, x + s * 0.5, y + s * 0.3);
  ctx.bezierCurveTo(x + s * 0.5, y, x, y, x, y + s * 0.3);
  ctx.fill();
}

/** Dibuja la escena del plan en un contexto 2D de `w` × `h`. */
export function paintScene(ctx, plan, w, h) {
  const rnd = seededRandom(plan.seed);
  const has = (id) => plan.elements.includes(id);
  const horizon = h * (has('mountains') ? 0.62 : 0.66);
  const dark = plan.sky === 'night' || plan.sky === 'storm';

  // Cielo
  const [top, mid, bottom] = SKIES[plan.sky];
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, top);
  sky.addColorStop(0.6, mid);
  sky.addColorStop(1, bottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  if (plan.hues.length) {
    // Los colores pedidos tiñen el cielo con un velo suave.
    const tint = ctx.createRadialGradient(w * 0.7, horizon, 10, w * 0.5, horizon, w * 0.9);
    tint.addColorStop(0, hsl(plan.hues[0], 80, 60, 0.45));
    tint.addColorStop(1, hsl(plan.hues[0], 80, 60, 0));
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, w, h);
  }

  if (has('stars') || plan.sky === 'night') {
    const count = has('stars') ? 260 : 90;
    for (let i = 0; i < count; i += 1) {
      const r = rnd() ** 3 * 1.8 + 0.3;
      ctx.fillStyle = `rgba(255,255,255,${0.35 + rnd() * 0.65})`;
      ctx.beginPath();
      ctx.arc(rnd() * w, rnd() * horizon * 0.95, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const lightX = w * (0.2 + rnd() * 0.6);
  const lightY = plan.sky === 'sunset' || plan.sky === 'dawn' ? horizon - h * 0.08 : h * (0.15 + rnd() * 0.12);
  if (has('sun') && !dark) {
    const glow = ctx.createRadialGradient(lightX, lightY, 0, lightX, lightY, h * 0.35);
    glow.addColorStop(0, 'rgba(255,240,190,0.9)');
    glow.addColorStop(1, 'rgba(255,240,190,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = plan.sky === 'sunset' ? '#ffcf7a' : '#fff6d6';
    ctx.beginPath();
    ctx.arc(lightX, lightY, h * 0.07, 0, Math.PI * 2);
    ctx.fill();
  }
  if (has('moon')) {
    const glow = ctx.createRadialGradient(lightX, lightY, 0, lightX, lightY, h * 0.25);
    glow.addColorStop(0, 'rgba(230,235,255,0.55)');
    glow.addColorStop(1, 'rgba(230,235,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#f3f1e3';
    ctx.beginPath();
    ctx.arc(lightX, lightY, h * 0.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = SKIES[plan.sky][0];
    ctx.globalAlpha = dark ? 0.9 : 0.5;
    ctx.beginPath();
    ctx.arc(lightX + h * 0.03, lightY - h * 0.015, h * 0.055, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  if (has('clouds') || plan.sky === 'storm') {
    for (let i = 0; i < (plan.sky === 'storm' ? 9 : 5); i += 1) {
      const cx = rnd() * w;
      const cy = h * (0.08 + rnd() * 0.3);
      ctx.fillStyle = plan.sky === 'storm' ? 'rgba(70,76,88,0.85)' : dark ? 'rgba(120,120,160,0.35)' : 'rgba(255,255,255,0.85)';
      for (let k = 0; k < 5; k += 1) {
        ctx.beginPath();
        ctx.ellipse(cx + (k - 2) * w * 0.035, cy + Math.sin(k) * 6, w * (0.04 + rnd() * 0.03), h * 0.035, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  if (has('birds')) {
    ctx.strokeStyle = dark ? 'rgba(240,240,255,0.7)' : 'rgba(40,40,60,0.75)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 7; i += 1) {
      const bx = w * (0.15 + rnd() * 0.7);
      const by = h * (0.12 + rnd() * 0.25);
      const s = 6 + rnd() * 8;
      ctx.beginPath();
      ctx.moveTo(bx - s, by);
      ctx.quadraticCurveTo(bx - s / 2, by - s * 0.6, bx, by);
      ctx.quadraticCurveTo(bx + s / 2, by - s * 0.6, bx + s, by);
      ctx.stroke();
    }
  }

  // Relieve
  const groundHue = accentHue(plan, rnd, has('snow') ? 210 : 130);
  if (has('mountains')) {
    ridge(ctx, w, h, horizon - h * 0.02, h * 0.28, seededRandom(plan.seed + 11), dark ? '#2a2c4a' : hsl(230, 22, 62), 4);
    if (has('snow')) {
      // Nieve en las cumbres: la misma cordillera, en blanco, solo por encima de la línea de nieve.
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, w, horizon - h * 0.17);
      ctx.clip();
      ridge(ctx, w, h, horizon - h * 0.02, h * 0.28, seededRandom(plan.seed + 11), dark ? 'rgba(225,232,255,0.82)' : 'rgba(255,255,255,0.92)', 4);
      ctx.restore();
    }
    ridge(ctx, w, h, horizon + h * 0.02, h * 0.2, rnd, dark ? '#1c1e36' : hsl(220, 20, 48), 7);
  }
  if (has('city')) {
    let x = 0;
    while (x < w) {
      const bw = w * (0.04 + rnd() * 0.06);
      const bh = h * (0.08 + rnd() * 0.26);
      ctx.fillStyle = dark ? '#151629' : hsl(225, 15, 38);
      ctx.fillRect(x, horizon - bh, bw - 2, bh + 4);
      ctx.fillStyle = dark ? 'rgba(255,214,120,0.85)' : 'rgba(255,255,255,0.35)';
      for (let wy = horizon - bh + 8; wy < horizon - 6; wy += 12) for (let wx = x + 5; wx < x + bw - 8; wx += 10) if (rnd() > 0.45) ctx.fillRect(wx, wy, 4, 6);
      x += bw;
    }
  }
  if (has('sea')) {
    const sea = ctx.createLinearGradient(0, horizon, 0, h);
    sea.addColorStop(0, dark ? '#1b2457' : hsl(accentHue(plan, rnd, 200), 60, 52));
    sea.addColorStop(1, dark ? '#070a1f' : hsl(accentHue(plan, rnd, 215), 70, 28));
    ctx.fillStyle = sea;
    ctx.fillRect(0, horizon, w, h - horizon);
    ctx.strokeStyle = dark ? 'rgba(200,210,255,0.25)' : 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 40; i += 1) {
      const y = horizon + (h - horizon) * rnd() ** 1.5;
      const x = rnd() * w;
      const len = 10 + ((y - horizon) / (h - horizon)) * 50;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + len, y);
      ctx.stroke();
    }
    if (has('sun') || has('moon')) {
      ctx.fillStyle = has('moon') || dark ? 'rgba(240,240,255,0.35)' : 'rgba(255,230,170,0.5)';
      for (let y = horizon + 4; y < h; y += 7) ctx.fillRect(lightX - 30 * (1 - (y - horizon) / h) - rnd() * 10, y, 60 * (1 - (y - horizon) / h) + rnd() * 20, 2);
    }
  }
  if (has('field') || has('river') || (!has('sea') && !has('city'))) {
    const top0 = has('sea') ? h * 0.86 : horizon;
    const field = ctx.createLinearGradient(0, top0, 0, h);
    field.addColorStop(0, has('snow') ? '#e9eef5' : dark ? hsl(groundHue, 30, 18) : hsl(groundHue, 45, 48));
    field.addColorStop(1, has('snow') ? '#c9d3e0' : dark ? hsl(groundHue, 30, 8) : hsl(groundHue, 50, 26));
    ctx.fillStyle = field;
    ctx.beginPath();
    ctx.moveTo(0, top0 + 10);
    for (let x = 0; x <= w; x += w / 12) ctx.lineTo(x, top0 + Math.sin(x / w * 5 + plan.seed) * 8);
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.fill();
  }
  if (has('river')) {
    ctx.fillStyle = dark ? 'rgba(80,100,180,0.8)' : 'rgba(120,190,235,0.9)';
    ctx.beginPath();
    ctx.moveTo(w * 0.48, horizon);
    ctx.bezierCurveTo(w * 0.4, h * 0.8, w * 0.7, h * 0.85, w * 0.55, h);
    ctx.lineTo(w * 0.85, h);
    ctx.bezierCurveTo(w * 0.95, h * 0.85, w * 0.5, h * 0.8, w * 0.52, horizon);
    ctx.fill();
  }
  if (has('trees')) {
    const count = 6 + Math.floor(rnd() * 8);
    for (let i = 0; i < count; i += 1) {
      const tx = rnd() * w;
      const ty = horizon + rnd() * (h - horizon) * 0.35;
      const s = h * (0.08 + rnd() * 0.08) * (1 + (ty - horizon) / h);
      ctx.fillStyle = dark ? '#0d1a14' : hsl(groundHue + 10, 40, 22);
      ctx.beginPath();
      ctx.moveTo(tx, ty - s * 1.6);
      ctx.lineTo(tx - s * 0.55, ty);
      ctx.lineTo(tx + s * 0.55, ty);
      ctx.fill();
      ctx.fillRect(tx - s * 0.06, ty, s * 0.12, s * 0.25);
    }
  }
  if (has('flowers')) {
    const floor = has('sea') ? h * 0.88 : horizon + 10;
    for (let i = 0; i < 70; i += 1) {
      const y = floor + (h - floor) * rnd() ** 0.8;
      const r = 3 + ((y - floor) / (h - floor)) * 14 * (0.6 + rnd() * 0.6);
      flower(ctx, rnd() * w, y, r, plan.hues.length ? plan.hues[i % plan.hues.length] + rnd() * 20 - 10 : [345, 330, 45, 280, 10][i % 5], rnd);
    }
  }
  if (has('hearts')) {
    for (let i = 0; i < 9; i += 1) {
      heart(ctx, rnd() * w, h * (0.1 + rnd() * 0.5), 14 + rnd() * 26, hsl(accentHue(plan, rnd, 345), 80, 65, 0.55 + rnd() * 0.4));
    }
  }
  if (has('rain')) {
    ctx.strokeStyle = 'rgba(200,215,240,0.55)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 260; i += 1) {
      const x = rnd() * w;
      const y = rnd() * h;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 4, y + 14);
      ctx.stroke();
    }
  }
  if (has('snow')) {
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    for (let i = 0; i < 220; i += 1) {
      ctx.beginPath();
      ctx.arc(rnd() * w, rnd() * h, 0.8 + rnd() * 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Viñeta suave
  const vignette = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, w * 0.75);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);
}

/** Pinta en un canvas nuevo y devuelve un PNG. */
export async function paintToBlob(plan, width = 768, height = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Este navegador no permite dibujar en un lienzo.');
  paintScene(ctx, plan, width, height);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('No se pudo crear la imagen.'))), 'image/png'));
}
