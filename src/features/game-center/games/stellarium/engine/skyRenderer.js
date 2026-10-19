/**
 * Dibujo del observatorio en Canvas 2D: Vía Láctea, cuadrícula ecuatorial y
 * eclíptica, estrellas de fondo, figuras, estrellas del catálogo con su color
 * real, objetos de cielo profundo, el asterismo personal, la retícula central
 * y, con mucho aumento, el círculo del ocular (como en la presentación).
 */
import { CONSTELLATIONS, DEEP_SKY, SPECTRAL, STARS, starById } from '../data/catalog.js';
import { ASTERISM } from '../data/asterism.js';
import { DEG, EYEPIECE_FOV, FRAMES, backgroundStars, basis, milkyWay, project, scaleFor, vecOf } from './sky.js';
import { createSpriteCache } from '../../../render/sprites.js';
import { seeded } from '../../../render/paint.js';

const BG = backgroundStars();
const MW = milkyWay();
const STAR_VECS = new Map(STARS.map((s) => [s.id, vecOf(s.ra, s.dec)]));
const ECLIPTIC = Array.from({ length: 121 }, (_, i) => {
  const l = (i * 3) * DEG;
  const e = 23.4393 * DEG;
  return [Math.cos(l), Math.sin(l) * Math.cos(e), Math.sin(l) * Math.sin(e)];
});
const AST_VECS = Object.fromEntries(Object.entries(ASTERISM.stars).map(([k, s]) => [k, vecOf(s.ra, s.dec)]));
const DSO_VECS = DEEP_SKY.map((o) => vecOf(o.ra, o.dec));

/*
 * Sprites (se pintan una vez y se copian con drawImage): así ningún degradado
 * se crea en cada fotograma. Tamaño de referencia: 64 px; el núcleo ocupa 1/6.
 */
const SPRITE = 64;

/** Estrella: halo del color espectral, núcleo blanco y nítido. */
function paintStar(color) {
  return (c, w) => {
    const m = w / 2;
    const g = c.createRadialGradient(m, m, 0, m, m, m);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.12, '#ffffff');
    g.addColorStop(0.18, color);
    g.addColorStop(0.32, `${color}55`);
    g.addColorStop(1, `${color}00`);
    c.fillStyle = g;
    c.fillRect(0, 0, w, w);
  };
}

/** Destello en cruz de las estrellas más brillantes (como las aspas de un telescopio). */
function paintSpikes(c, w) {
  const m = w / 2;
  for (const [dx, dy] of [[1, 0], [0, 1]]) {
    const g = c.createLinearGradient(m - dx * m, m - dy * m, m + dx * m, m + dy * m);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.85)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(dx ? 0 : m - 0.6, dy ? 0 : m - 0.6, dx ? w : 1.2, dy ? w : 1.2);
  }
}

/** Nube suave para la bruma de la Vía Láctea. */
function paintHaze(rgb) {
  return (c, w) => {
    const m = w / 2;
    const g = c.createRadialGradient(m, m, 0, m, m, m);
    g.addColorStop(0, `rgba(${rgb}, 0.5)`);
    g.addColorStop(0.5, `rgba(${rgb}, 0.18)`);
    g.addColorStop(1, `rgba(${rgb}, 0)`);
    c.fillStyle = g;
    c.fillRect(0, 0, w, w);
  };
}

/** Galaxia espiral vista de canto: disco, bulbo cálido y una franja de polvo. */
function paintGalaxy(c, w) {
  const m = w / 2;
  const disc = c.createRadialGradient(m, m, 0, m, m, m);
  disc.addColorStop(0, 'rgba(255, 244, 225, 0.95)');
  disc.addColorStop(0.12, 'rgba(255, 225, 190, 0.7)');
  disc.addColorStop(0.4, 'rgba(200, 195, 255, 0.28)');
  disc.addColorStop(1, 'rgba(160, 150, 255, 0)');
  c.fillStyle = disc;
  c.fillRect(0, 0, w, w);
  c.globalCompositeOperation = 'destination-out';
  c.fillStyle = 'rgba(0, 0, 0, 0.45)';
  c.beginPath();
  c.ellipse(m, m + w * 0.06, m * 0.85, w * 0.025, 0, 0, Math.PI * 2);
  c.fill();
  c.globalCompositeOperation = 'source-over';
}

/** Nebulosa: varias nubes de colores (hidrógeno rosa, oxígeno azul) con estructura irregular. */
function paintNebula(c, w) {
  const rnd = seeded(42);
  const colors = ['255, 110, 160', '120, 200, 255', '255, 170, 120', '200, 130, 255'];
  for (let i = 0; i < 14; i += 1) {
    const x = w * (0.25 + rnd() * 0.5);
    const y = w * (0.25 + rnd() * 0.5);
    const r = w * (0.12 + rnd() * 0.25);
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    const col = colors[i % colors.length];
    g.addColorStop(0, `rgba(${col}, 0.32)`);
    g.addColorStop(1, `rgba(${col}, 0)`);
    c.fillStyle = g;
    c.fillRect(0, 0, w, w);
  }
}

const HAZE_STEP = 9; // una nube por cada 9 puntos de la Vía Láctea

/** Radio de una estrella según su magnitud y el aumento. */
export function starRadius(mag, fov) {
  const zoomBoost = Math.min(2.2, Math.max(1, 60 / fov) ** 0.5);
  return Math.max(0.7, (4.6 - mag * 0.9) * zoomBoost);
}

function polyline(ctx, pts) {
  let open = false;
  ctx.beginPath();
  for (const p of pts) {
    if (!p) {
      open = false;
      continue;
    }
    if (!open) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
    open = true;
  }
  ctx.stroke();
}

export function renderSky(ctx, size, s, dt) {
  if (!ctx || !size.width) return;
  const { width: W, height: H } = size;
  const dpr = Math.min(2, size.dpr || 1);
  s.time = (s.time ?? 0) + dt;
  s.sprites ??= createSpriteCache(24);
  const sprite = (key, paint, px = SPRITE) => s.sprites.get(key, px, px, paint, dpr);
  const view = s.view;
  const b = basis(view);
  const scale = scaleFor(view, W, H);
  const P = (v) => project(b, scale, W, H, v);

  // Cielo nocturno y viñeta: degradados guardados mientras no cambie el tamaño.
  if (s.bgKey !== `${W}x${H}`) {
    s.bgKey = `${W}x${H}`;
    s.bg = ctx.createRadialGradient(W / 2, H * 0.4, 0, W / 2, H / 2, Math.max(W, H) * 0.8);
    s.bg.addColorStop(0, '#161c44');
    s.bg.addColorStop(0.55, '#0a0d24');
    s.bg.addColorStop(1, '#04050c');
    s.vignette = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    s.vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    s.vignette.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
  }
  ctx.fillStyle = s.bg;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // Vía Láctea
  if (s.toggles.milky) {
    const k = Math.min(2, Math.max(0.7, 60 / view.fov));
    // Bruma: nubes grandes y tenues que dan cuerpo a la banda (cálidas hacia el centro galáctico).
    const warm = sprite('haze-warm', paintHaze('255, 215, 170'), 48);
    const cool = sprite('haze-cool', paintHaze('150, 170, 255'), 48);
    const hr = 26 * k;
    for (let i = 0; i < MW.length; i += HAZE_STEP) {
      const m = MW[i];
      const p = P(m.v);
      if (!p) continue;
      ctx.globalAlpha = Math.min(1, m.a * 1.6);
      ctx.drawImage(m.a > 0.14 ? warm.canvas : cool.canvas, p.x - hr, p.y - hr, hr * 2, hr * 2);
    }
    ctx.globalAlpha = 1;
    // Polvo fino: muchos puntos pequeños y muy tenues (no discos), como polvo de estrellas.
    for (const m of MW) {
      const p = P(m.v);
      if (!p) continue;
      ctx.fillStyle = `rgba(190, 200, 255, ${m.a * 0.55})`;
      const r = m.r * k * 0.7;
      ctx.fillRect(p.x - r / 2, p.y - r / 2, r, r);
    }
  }
  // Estrellas de fondo (decorativas)
  for (const st of BG) {
    const p = P(st.v);
    if (!p) continue;
    const tw = s.reduced ? 1 : 0.7 + 0.3 * Math.sin(s.time * 1.3 + st.tw);
    ctx.fillStyle = `rgba(220, 225, 255, ${Math.max(0.08, (6.6 - st.mag) * 0.16) * tw})`;
    ctx.fillRect(p.x, p.y, starRadius(st.mag, view.fov) * 0.9, starRadius(st.mag, view.fov) * 0.9);
  }
  ctx.restore();

  // Cuadrícula ecuatorial y eclíptica
  if (s.toggles.grid) {
    ctx.strokeStyle = 'rgba(120, 150, 255, 0.22)';
    ctx.lineWidth = 1;
    for (let h = 0; h < 24; h += 2) polyline(ctx, Array.from({ length: 61 }, (_, i) => P(vecOf(h, -90 + i * 3))));
    for (let d = -60; d <= 60; d += 30) {
      ctx.strokeStyle = d === 0 ? 'rgba(120, 190, 255, 0.4)' : 'rgba(120, 150, 255, 0.22)';
      polyline(ctx, Array.from({ length: 97 }, (_, i) => P(vecOf(i * 0.25, d))));
    }
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = 'rgba(255, 205, 120, 0.4)';
    polyline(ctx, ECLIPTIC.map(P));
    ctx.setLineDash([]);
  }

  // Figuras de las constelaciones
  for (const con of CONSTELLATIONS) {
    const found = s.found.has(con.id);
    if (!found && !s.toggles.allLines) continue;
    ctx.strokeStyle = found ? (s.flash?.id === con.id ? 'rgba(255, 226, 150, 0.95)' : 'rgba(255, 214, 140, 0.55)') : 'rgba(200, 210, 255, 0.22)';
    ctx.lineWidth = found ? 1.6 : 1;
    ctx.beginPath();
    for (const [a, c] of con.lines) {
      const pa = P(STAR_VECS.get(a));
      const pc = P(STAR_VECS.get(c));
      if (!pa || !pc) continue;
      // Deja un hueco alrededor de cada estrella: las líneas no las tapan.
      const dx = pc.x - pa.x;
      const dy = pc.y - pa.y;
      const len = Math.hypot(dx, dy);
      if (len < 10) continue;
      const gap = Math.min(6, len / 4);
      ctx.moveTo(pa.x + (dx / len) * gap, pa.y + (dy / len) * gap);
      ctx.lineTo(pc.x - (dx / len) * gap, pc.y - (dy / len) * gap);
    }
    ctx.stroke();
  }

  // Asterismo personal: sus estrellas siempre (tenues y cálidas); la figura al descubrirlo.
  const astFound = s.found.has(ASTERISM.id);
  if (astFound) {
    ctx.strokeStyle = 'rgba(255, 170, 200, 0.7)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (const [a, c] of ASTERISM.lines) {
      const pa = P(AST_VECS[a]);
      const pc = P(AST_VECS[c]);
      if (pa && pc) {
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pc.x, pc.y);
      }
    }
    ctx.stroke();
  }
  const astGlow = sprite(astFound ? 'ast-on' : 'ast-off', paintStar(astFound ? '#ffd2e1' : '#ffdce6'), 32);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = astFound ? 1 : 0.6;
  for (const v of Object.values(AST_VECS)) {
    const p = P(v);
    if (p) ctx.drawImage(astGlow.canvas, p.x - 10, p.y - 10, 20, 20);
  }
  ctx.restore();

  // Cielo profundo (sprites escalados: el tamaño aparente crece con el aumento)
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  DEEP_SKY.forEach((o, i) => {
    const p = P(DSO_VECS[i]);
    if (!p) return;
    const r = Math.max(5, (o.size * DEG * scale) / 1.2);
    if (o.type === 'galaxy') {
      const gal = sprite('galaxy', paintGalaxy, 96);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((o.angle ?? 0) * DEG);
      ctx.scale(1, 0.32);
      ctx.drawImage(gal.canvas, -r, -r, r * 2, r * 2);
      ctx.restore();
    } else if (o.type === 'nebula') {
      const neb = sprite('nebula', paintNebula, 96);
      ctx.drawImage(neb.canvas, p.x - r * 1.3, p.y - r * 1.3, r * 2.6, r * 2.6);
    } else {
      const pts = [[0, 0], [0.5, -0.3], [-0.4, -0.2], [0.2, 0.45], [-0.55, 0.3], [0.7, 0.2], [-0.1, -0.6]];
      const haze = sprite('haze-cool', paintHaze('150, 170, 255'), 48);
      ctx.globalAlpha = 0.6;
      ctx.drawImage(haze.canvas, p.x - r * 1.2, p.y - r * 1.2, r * 2.4, r * 2.4);
      ctx.globalAlpha = 1;
      const dot = sprite('star-B', paintStar(SPECTRAL.B.color));
      const d = Math.max(7, r * 0.5);
      for (const [dx, dy] of pts) ctx.drawImage(dot.canvas, p.x + dx * r - d / 2, p.y + dy * r - d / 2, d, d);
    }
  });
  ctx.restore();

  // Estrellas del catálogo: halo + núcleo de un sprite por tipo espectral; aspas en las más brillantes.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const spikes = sprite('spikes', paintSpikes);
  for (const st of STARS) {
    const p = P(STAR_VECS.get(st.id));
    if (!p) continue;
    const r = starRadius(st.mag, view.fov);
    const tw = s.reduced ? 1 : 0.88 + 0.12 * Math.sin(s.time * 2 + st.ra * 7);
    const star = sprite(`star-${st.spec}`, paintStar(SPECTRAL[st.spec]?.color ?? '#ffffff'));
    // El núcleo ocupa 1/6 del sprite: con d = 6r su radio es exactamente r.
    const d = r * (st.mag < 2.6 ? 7 : 5.2);
    ctx.globalAlpha = tw;
    ctx.drawImage(star.canvas, p.x - d / 2, p.y - d / 2, d, d);
    if (st.mag < 1.2) {
      const l = r * (9 - st.mag * 3);
      ctx.globalAlpha = 0.55 * tw;
      ctx.drawImage(spikes.canvas, p.x - l / 2, p.y - l / 2, l, l);
    }
  }
  ctx.restore();

  // El Sol del día elegido
  if (s.sun) {
    const p = P(vecOf(s.sun.ra, s.sun.dec));
    if (p) {
      const pulse = s.reduced ? 1 : 1 + 0.08 * Math.sin(s.time * 2);
      const sg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 26 * pulse);
      sg.addColorStop(0, 'rgba(255, 250, 220, 1)');
      sg.addColorStop(0.25, 'rgba(255, 210, 110, 0.9)');
      sg.addColorStop(1, 'rgba(255, 170, 60, 0)');
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 26 * pulse, 0, Math.PI * 2);
      ctx.fill();
      label(ctx, p.x, p.y + 30, s.sun.label, '#ffe2a0', true);
    }
  }

  // Nombres
  ctx.textBaseline = 'middle';
  if (s.toggles.labels) {
    for (const st of STARS) {
      if (st.mag > (view.fov < 40 ? 3.2 : view.fov < 70 ? 1.9 : 1.2)) continue;
      const p = P(STAR_VECS.get(st.id));
      if (p) label(ctx, p.x + starRadius(st.mag, view.fov) + 5, p.y, st.name, 'rgba(225, 230, 255, 0.8)');
    }
    for (const o of DEEP_SKY) {
      const p = P(vecOf(o.ra, o.dec));
      if (p) label(ctx, p.x + 12, p.y - 10, o.short, 'rgba(200, 210, 255, 0.75)');
    }
  }
  for (const con of CONSTELLATIONS) {
    if (!s.found.has(con.id)) continue;
    const f = FRAMES.get(con.id);
    const p = P(vecOf(f.ra, f.dec));
    if (p) label(ctx, p.x, p.y - f.radius * DEG * scale * 0.9 - 6, con.name.toUpperCase(), 'rgba(255, 214, 140, 0.85)', true, 600);
  }
  if (astFound) {
    const p = P(vecOf(ASTERISM.center.ra, ASTERISM.center.dec));
    if (p) label(ctx, p.x, p.y + ASTERISM.radius * DEG * scale + 14, 'NOSOTROS', 'rgba(255, 180, 210, 0.9)', true, 600);
  }

  // Selección
  if (s.selected) {
    const p = P(vecOf(s.selected.ra, s.selected.dec));
    if (p) {
      const rr = 14 + (s.reduced ? 0 : Math.sin(s.time * 4) * 2);
      ctx.strokeStyle = 'rgba(255, 230, 160, 0.95)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i += 1) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, rr, i * (Math.PI / 2) + 0.25, (i + 1) * (Math.PI / 2) - 0.25);
        ctx.stroke();
      }
    }
  }

  // Viñeta: los bordes se oscurecen, como al mirar por un instrumento.
  ctx.fillStyle = s.vignette;
  ctx.fillRect(0, 0, W, H);

  // Retícula central y ocular
  const cx = W / 2;
  const cy = H / 2;
  ctx.strokeStyle = 'rgba(255, 120, 120, 0.55)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, 18, 0, Math.PI * 2);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    ctx.moveTo(cx + dx * 24, cy + dy * 24);
    ctx.lineTo(cx + dx * 34, cy + dy * 34);
  }
  ctx.stroke();
  if (view.fov < EYEPIECE_FOV) {
    const k = Math.min(1, (EYEPIECE_FOV - view.fov) / 6);
    const r = Math.min(W, H) * 0.46;
    ctx.save();
    ctx.fillStyle = `rgba(2, 3, 8, ${0.92 * k})`;
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.arc(cx, cy, r, 0, Math.PI * 2, true);
    ctx.fill('evenodd');
    ctx.strokeStyle = `rgba(160, 170, 210, ${0.5 * k})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function label(ctx, x, y, text, color, center = false, weight = 500) {
  ctx.font = `${weight} 12px Manrope, system-ui, sans-serif`;
  ctx.textAlign = center ? 'center' : 'left';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(5, 6, 15, 0.8)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

