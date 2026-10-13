/**
 * Dibujo del observatorio en Canvas 2D: Vía Láctea, cuadrícula ecuatorial y
 * eclíptica, estrellas de fondo, figuras, estrellas del catálogo con su color
 * real, objetos de cielo profundo, el asterismo personal, la retícula central
 * y, con mucho aumento, el círculo del ocular (como en la presentación).
 */
import { CONSTELLATIONS, DEEP_SKY, SPECTRAL, STARS, starById } from '../data/catalog.js';
import { ASTERISM } from '../data/asterism.js';
import { DEG, EYEPIECE_FOV, FRAMES, backgroundStars, basis, milkyWay, project, scaleFor, vecOf } from './sky.js';

const BG = backgroundStars();
const MW = milkyWay();
const STAR_VECS = new Map(STARS.map((s) => [s.id, vecOf(s.ra, s.dec)]));
const ECLIPTIC = Array.from({ length: 121 }, (_, i) => {
  const l = (i * 3) * DEG;
  const e = 23.4393 * DEG;
  return [Math.cos(l), Math.sin(l) * Math.cos(e), Math.sin(l) * Math.sin(e)];
});
const AST_VECS = Object.fromEntries(Object.entries(ASTERISM.stars).map(([k, s]) => [k, vecOf(s.ra, s.dec)]));

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
  s.time = (s.time ?? 0) + dt;
  const view = s.view;
  const b = basis(view);
  const scale = scaleFor(view, W, H);
  const P = (v) => project(b, scale, W, H, v);

  // Cielo nocturno
  const g = ctx.createRadialGradient(W / 2, H * 0.4, 0, W / 2, H / 2, Math.max(W, H) * 0.8);
  g.addColorStop(0, '#141a3d');
  g.addColorStop(1, '#05060f');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // Vía Láctea
  if (s.toggles.milky) {
    // Bruma fina: muchos puntos pequeños y muy tenues (no discos), como polvo de estrellas.
    const k = Math.min(2, Math.max(0.7, 60 / view.fov));
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
  for (const v of Object.values(AST_VECS)) {
    const p = P(v);
    if (!p) continue;
    const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 9);
    glow.addColorStop(0, astFound ? 'rgba(255, 210, 225, 0.95)' : 'rgba(255, 220, 230, 0.55)');
    glow.addColorStop(1, 'rgba(255, 180, 210, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
    ctx.fill();
  }

  // Cielo profundo
  for (const o of DEEP_SKY) {
    const p = P(vecOf(o.ra, o.dec));
    if (!p) continue;
    const r = Math.max(5, (o.size * DEG * scale) / 1.2);
    ctx.save();
    ctx.translate(p.x, p.y);
    if (o.type === 'galaxy') {
      ctx.rotate((o.angle ?? 0) * DEG);
      ctx.scale(1, 0.32);
      const gg = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      gg.addColorStop(0, 'rgba(255, 240, 220, 0.85)');
      gg.addColorStop(0.3, 'rgba(210, 200, 255, 0.35)');
      gg.addColorStop(1, 'rgba(160, 150, 255, 0)');
      ctx.fillStyle = gg;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
    } else if (o.type === 'nebula') {
      for (const [dx, dy, c] of [[0, 0, '255, 120, 170'], [r * 0.3, -r * 0.2, '120, 200, 255'], [-r * 0.3, r * 0.25, '255, 170, 120']]) {
        const gg = ctx.createRadialGradient(dx, dy, 0, dx, dy, r);
        gg.addColorStop(0, `rgba(${c}, 0.45)`);
        gg.addColorStop(1, `rgba(${c}, 0)`);
        ctx.fillStyle = gg;
        ctx.beginPath();
        ctx.arc(dx, dy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      const pts = [[0, 0], [0.5, -0.3], [-0.4, -0.2], [0.2, 0.45], [-0.55, 0.3], [0.7, 0.2], [-0.1, -0.6]];
      ctx.fillStyle = 'rgba(190, 215, 255, 0.95)';
      for (const [dx, dy] of pts) {
        ctx.beginPath();
        ctx.arc(dx * r, dy * r, Math.max(1.2, r * 0.08), 0, Math.PI * 2);
        ctx.fill();
      }
      const gg = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.2);
      gg.addColorStop(0, 'rgba(150, 190, 255, 0.25)');
      gg.addColorStop(1, 'rgba(150, 190, 255, 0)');
      ctx.fillStyle = gg;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Estrellas del catálogo
  for (const st of STARS) {
    const p = P(STAR_VECS.get(st.id));
    if (!p) continue;
    const r = starRadius(st.mag, view.fov);
    const color = SPECTRAL[st.spec]?.color ?? '#fff';
    const tw = s.reduced ? 1 : 0.88 + 0.12 * Math.sin(s.time * 2 + st.ra * 7);
    if (st.mag < 2.6) {
      const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 3.2);
      glow.addColorStop(0, color);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 0.35 * tw;
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = tw;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

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

