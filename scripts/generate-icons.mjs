/**
 * Genera los iconos de la PWA a partir de un único diseño SVG (vela + llama).
 * Uso: npm run icons  — los PNG resultantes se guardan en public/icons y se versionan.
 */
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const OUT = new URL('../public/icons/', import.meta.url);

// `inset` reduce el motivo para respetar la zona segura de los iconos "maskable" (80 %).
function iconSvg({ rounded = true, inset = 1 } = {}) {
  const s = inset;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="bg" cx="50%" cy="38%" r="75%">
      <stop offset="0" stop-color="#4a1d3d"/>
      <stop offset=".55" stop-color="#22122a"/>
      <stop offset="1" stop-color="#120c18"/>
    </radialGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#f5b961" stop-opacity=".55"/>
      <stop offset=".45" stop-color="#ef6f8c" stop-opacity=".18"/>
      <stop offset="1" stop-color="#ef6f8c" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="flame" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" stop-color="#ef6f8c"/>
      <stop offset=".45" stop-color="#f5b961"/>
      <stop offset="1" stop-color="#fff3d6"/>
    </linearGradient>
    <radialGradient id="core" cx="50%" cy="72%" r="50%">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="1" stop-color="#fff3d6" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="wax" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#e9d6cf"/>
      <stop offset=".45" stop-color="#fff7f0"/>
      <stop offset="1" stop-color="#d8bdb6"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="${rounded ? 112 : 0}" fill="url(#bg)"/>
  <g transform="translate(256 256) scale(${s}) translate(-256 -256)">
    <circle cx="256" cy="190" r="170" fill="url(#glow)"/>
    <path d="M256 92c34 46 52 78 52 108a52 52 0 0 1-104 0c0-30 18-62 52-108z" fill="url(#flame)"/>
    <ellipse cx="256" cy="212" rx="22" ry="34" fill="url(#core)"/>
    <rect x="252" y="246" width="8" height="20" rx="3" fill="#2a1a22"/>
    <path d="M196 270h120v138a22 22 0 0 1-22 22h-76a22 22 0 0 1-22-22z" fill="url(#wax)"/>
    <path d="M196 270h120v14c0 10-8 12-12 22-3 8-11 8-13 0-3-10-10-12-17-6-6 6-14 3-14-6 0-8-8-12-14-6-7 7-16 4-18-4-2-9-12-10-16-4-4 7-16 4-16-6z" fill="#fffaf5"/>
    <path d="M256 360c-12-14-30-4-24 10 4 9 24 22 24 22s20-13 24-22c6-14-12-24-24-10z" fill="#ef6f8c" opacity=".85"/>
  </g>
</svg>`;
}

await mkdir(OUT, { recursive: true });

const standard = Buffer.from(iconSvg());
const maskable = Buffer.from(iconSvg({ rounded: false, inset: 0.78 }));
const apple = Buffer.from(iconSvg({ rounded: false, inset: 0.9 }));

await writeFile(new URL('favicon.svg', OUT), iconSvg());
await sharp(standard).resize(32, 32).png().toFile(fileURLToPath(new URL('favicon-32.png', OUT)));
await sharp(standard).resize(192, 192).png().toFile(fileURLToPath(new URL('icon-192.png', OUT)));
await sharp(standard).resize(512, 512).png().toFile(fileURLToPath(new URL('icon-512.png', OUT)));
await sharp(maskable).resize(512, 512).png().toFile(fileURLToPath(new URL('icon-maskable-512.png', OUT)));
await sharp(apple).resize(180, 180).png().toFile(fileURLToPath(new URL('apple-touch-icon.png', OUT)));

console.log('Iconos generados en public/icons');
