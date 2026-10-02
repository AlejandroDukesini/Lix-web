import { useEffect, useRef } from 'react';

/**
 * Lienzo del cosmos (Canvas 2D): estrellas en tres profundidades con paralaje,
 * polvo cósmico, estrellas fugaces y una galaxia espiral de partículas.
 *
 * Lee en cada fotograma el estado calculado por la línea de tiempo (`frameRef`)
 * y los colores del tema desde variables CSS del propio lienzo, así que cambiar
 * de tema o estilo no reinicia nada.
 *
 * Rendimiento:
 *  - Presupuesto de partículas según el área y la potencia del dispositivo.
 *  - DPR limitado (1.5 en pantallas pequeñas, 2 en el resto).
 *  - Las partículas fuera de pantalla no se dibujan.
 *  - Calidad adaptativa: si los primeros fotogramas van lentos (dispositivo
 *    modesto), se reduce una vez la resolución y la densidad de partículas.
 *  - Bucle detenido con la pestaña oculta. Con movimiento reducido no hay
 *    bucle: se redibuja un fotograma estático solo cuando cambia el desplazamiento.
 */

const TAU = Math.PI * 2;

function readPalette(element) {
  const css = getComputedStyle(element);
  const get = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
  return {
    star: get('--cosmos-star', '#ffffff'),
    starWarm: get('--cosmos-star-warm', '#ffe7c2'),
    starCool: get('--cosmos-star-cool', '#cfe0ff'),
    dust: get('--cosmos-dust', '#c9b8ff'),
    core: get('--galaxy-core', '#fff2d6'),
    armA: get('--galaxy-arm-a', '#ff9ec7'),
    armB: get('--galaxy-arm-b', '#8f8cff'),
    armC: get('--galaxy-arm-c', '#bff0ff'),
    blend: get('--cosmos-blend', 'lighter'),
    sparkle: get('--cosmos-sparkle', '0') === '1',
  };
}

/** El mismo color con alfa 0: degradar hacia `transparent` (negro) ensucia los tonos claros. */
function clearOf(color) {
  const hex = /^#([0-9a-f]{6})$/i.exec(color.trim());
  if (!hex) return 'rgba(255, 255, 255, 0)';
  const int = Number.parseInt(hex[1], 16);
  return `rgba(${(int >> 16) & 255}, ${(int >> 8) & 255}, ${int & 255}, 0)`;
}

function gaussian() {
  return (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
}

function createGalaxy(count) {
  const arms = 3;
  const particles = [];
  for (let i = 0; i < count; i += 1) {
    const bulge = i < count * 0.22;
    if (bulge) {
      const r = Math.random() ** 2 * 0.22;
      particles.push({ r, angle: Math.random() * TAU, tone: 'core', size: 0.6 + Math.random() * 1.1, alpha: 0.5 + Math.random() * 0.5 });
      continue;
    }
    const r = 0.06 + Math.random() ** 0.85 * 0.94;
    const arm = i % arms;
    const spread = gaussian() * (0.32 + 0.25 * (1 - r));
    const angle = (arm / arms) * TAU + r * 4.6 + spread;
    const roll = Math.random();
    const tone = roll > 0.93 ? 'armC' : r < 0.45 ? 'armA' : 'armB';
    particles.push({
      r: r + gaussian() * 0.025,
      angle,
      tone,
      size: tone === 'armC' ? 1.4 + Math.random() * 1.2 : 0.5 + Math.random() * 1.2,
      alpha: 0.25 + Math.random() * 0.6,
    });
  }
  return particles;
}

function createStars(count, depth) {
  return Array.from({ length: count }, () => ({
    x: Math.random(),
    y: Math.random(),
    size: depth === 2 ? 1.2 + Math.random() * 1.6 : depth === 1 ? 0.7 + Math.random() * 0.9 : 0.35 + Math.random() * 0.6,
    base: 0.35 + Math.random() * 0.6,
    twinkle: 0.0006 + Math.random() * 0.0022,
    phase: Math.random() * TAU,
    tone: Math.random() > 0.85 ? 'starWarm' : Math.random() > 0.8 ? 'starCool' : 'star',
    depth,
  }));
}

export function CosmosCanvas({ frameRef, apiRef, reduced, themeKey }) {
  const canvasRef = useRef(null);
  const paletteRef = useRef(null);

  // Cambio de tema o estilo: solo se releen los colores.
  useEffect(() => {
    if (canvasRef.current) paletteRef.current = readPalette(canvasRef.current);
  }, [themeKey]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext?.('2d');
    if (!ctx) return undefined;
    paletteRef.current = readPalette(canvas);

    let width = 0;
    let height = 0;
    let layers = [];
    let galaxy = [];
    let dust = [];
    let meteors = [];
    let nextMeteor = 2500;
    let frame = 0;

    let lowPower =
      (navigator.hardwareConcurrency ?? 8) <= 4 || (navigator.deviceMemory ?? 8) <= 4 || window.innerWidth < 520;
    let lite = false;
    let galaxyStride = 1;
    const SAMPLE_FRAMES = 90;
    const SLOW_FRAME_MS = 24;
    let sampled = 0;
    let sampledTime = 0;

    const setup = () => {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      const dpr = lite ? 1 : Math.min(window.devicePixelRatio || 1, width < 700 ? 1.5 : 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const area = width * height;
      const budget = lite ? 0.4 : lowPower ? 0.6 : 1;
      layers = [
        createStars(Math.min(460, Math.round((area / 2400) * budget)), 0),
        createStars(Math.min(150, Math.round((area / 9000) * budget)), 1),
        createStars(Math.min(34, Math.round((area / 42000) * budget)), 2),
      ];
      if (!galaxy.length) galaxy = createGalaxy(lowPower ? 1100 : 2200);
      dust = Array.from({ length: lowPower ? 28 : 60 }, () => ({
        x: Math.random(),
        y: Math.random(),
        vx: (Math.random() - 0.5) * 0.000012,
        vy: -0.000008 - Math.random() * 0.000012,
        size: 0.8 + Math.random() * 2.2,
        alpha: 0.08 + Math.random() * 0.18,
      }));
    };

    const drawSparkle = (x, y, size) => {
      ctx.fillRect(x - size * 2.2, y - size * 0.22, size * 4.4, size * 0.44);
      ctx.fillRect(x - size * 0.22, y - size * 2.2, size * 0.44, size * 4.4);
    };

    const drawStars = (time, state, palette) => {
      const cx = width / 2;
      const cy = height / 2;
      for (const layer of layers) {
        for (const star of layer) {
          const depthSpeed = [0.04, 0.09, 0.18][star.depth];
          const zoom = state.stars.zoom ** [0.4, 1, 1.8][star.depth];
          const yWrapped = (((star.y - state.stars.drift * depthSpeed) % 1) + 1) % 1;
          const x = cx + (star.x * width - cx) * zoom;
          const y = cy + (yWrapped * height - cy) * zoom;
          if (x < -10 || x > width + 10 || y < -10 || y > height + 10) continue;
          const flicker = reduced ? 0 : Math.sin(time * star.twinkle + star.phase) * 0.3;
          ctx.globalAlpha = Math.min(1, Math.max(0, (star.base + flicker) * state.stars.brightness));
          ctx.fillStyle = palette[star.tone];
          if (star.depth === 2 && palette.sparkle) {
            drawSparkle(x, y, star.size);
          } else {
            ctx.beginPath();
            ctx.arc(x, y, star.size * Math.min(zoom, 2.5) ** 0.5, 0, TAU);
            ctx.fill();
          }
        }
      }
    };

    const drawDust = (delta, palette) => {
      ctx.fillStyle = palette.dust;
      for (const p of dust) {
        if (!reduced) {
          p.x = (p.x + p.vx * delta + 1) % 1;
          p.y = (p.y + p.vy * delta + 1) % 1;
        }
        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(p.x * width, p.y * height, p.size, 0, TAU);
        ctx.fill();
      }
    };

    const drawGalaxy = (time, state, palette) => {
      const { x: gx, y: gy, radius, opacity } = state.galaxy;
      if (opacity <= 0.01) return;
      const spin = reduced ? 0 : time * 0.000035;
      const tiltCos = Math.cos(-0.45);
      const tiltSin = Math.sin(-0.45);

      const glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, radius * 0.45);
      glow.addColorStop(0, palette.core);
      glow.addColorStop(1, clearOf(palette.core));
      ctx.globalAlpha = opacity * 0.85;
      ctx.fillStyle = glow;
      ctx.fillRect(gx - radius, gy - radius, radius * 2, radius * 2);

      // Partículas más grandes cuanto más cerca está la galaxia (radio relativo a la pantalla).
      const dotScale = Math.max(1, Math.min(2.4, (radius / (Math.min(width, height) * 0.5)) ** 0.6));
      for (let i = 0; i < galaxy.length; i += galaxyStride) {
        const p = galaxy[i];
        const angle = p.angle + spin * (1.4 - p.r);
        const px = Math.cos(angle) * p.r * radius;
        const py = Math.sin(angle) * p.r * radius * 0.46;
        const sx = gx + px * tiltCos - py * tiltSin;
        const sy = gy + px * tiltSin + py * tiltCos;
        if (sx < -4 || sx > width + 4 || sy < -4 || sy > height + 4) continue;
        ctx.globalAlpha = opacity * p.alpha;
        ctx.fillStyle = palette[p.tone];
        const size = p.size * dotScale;
        if (size < 1.8) {
          ctx.fillRect(sx - size / 2, sy - size / 2, size, size);
        } else {
          ctx.beginPath();
          ctx.arc(sx, sy, size / 2, 0, TAU);
          ctx.fill();
        }
      }
    };

    const drawMeteors = (delta, palette) => {
      meteors = meteors.filter((m) => m.life > 0);
      for (const m of meteors) {
        m.x += m.vx * delta;
        m.y += m.vy * delta;
        m.life -= delta / m.duration;
        const tailX = m.x - m.vx * 160;
        const tailY = m.y - m.vy * 160;
        const gradient = ctx.createLinearGradient(m.x, m.y, tailX, tailY);
        gradient.addColorStop(0, palette.star);
        gradient.addColorStop(1, clearOf(palette.star));
        ctx.globalAlpha = Math.sin(Math.max(0, m.life) * Math.PI);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        ctx.lineTo(tailX, tailY);
        ctx.stroke();
      }
    };

    let last = performance.now();
    const render = (time) => {
      const delta = Math.min(64, time - last);
      last = time;
      const state = frameRef.current;
      const palette = paletteRef.current;
      ctx.clearRect(0, 0, width, height);
      if (!state || !palette) return;
      ctx.globalCompositeOperation = palette.blend;

      drawStars(time, state, palette);
      drawDust(delta, palette);
      drawGalaxy(time, state, palette);

      if (!reduced && !state.iris.active) {
        nextMeteor -= delta;
        if (nextMeteor <= 0 && meteors.length < 2) {
          const speed = 0.45 + Math.random() * 0.4;
          meteors.push({ x: Math.random() * width * 0.7, y: Math.random() * height * 0.35, vx: speed, vy: speed * 0.42, life: 1, duration: 900 + Math.random() * 500 });
          nextMeteor = 2600 + Math.random() * 5200;
        }
      }
      drawMeteors(delta, palette);

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    };

    const loop = (time) => {
      const before = performance.now();
      render(time);
      if (!lite) {
        sampled += 1;
        sampledTime += performance.now() - before;
        // Ventanas de 90 fotogramas: si el dibujo se come más de un tercio del
        // presupuesto de un fotograma lento, se pasa a modo ligero (una sola vez).
        if (sampled === SAMPLE_FRAMES) {
          if (sampledTime / SAMPLE_FRAMES > SLOW_FRAME_MS / 3) {
            lite = true;
            lowPower = true;
            galaxyStride = 2;
            setup();
          }
          sampled = 0;
          sampledTime = 0;
        }
      }
      frame = requestAnimationFrame(loop);
    };

    const onVisibility = () => {
      cancelAnimationFrame(frame);
      if (document.visibilityState === 'visible' && !reduced) frame = requestAnimationFrame(loop);
    };

    const onResize = () => {
      setup();
      render(performance.now());
    };

    setup();
    if (apiRef) apiRef.current = { draw: () => render(performance.now()) };
    if (reduced) render(performance.now());
    else frame = requestAnimationFrame(loop);

    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      if (apiRef) apiRef.current = null;
    };
  }, [frameRef, apiRef, reduced]);

  return <canvas ref={canvasRef} className="cosmos" aria-hidden="true" />;
}
