const sharp = require('sharp');
const fs = require('fs');
const [dir, prefix, out, cols = '3', width = '460'] = process.argv.slice(2);
const files = fs.readdirSync(dir).filter((f) => f.startsWith(prefix) && f.endsWith('.png')).sort();
(async () => {
  const W = +width;
  const m = await sharp(`${dir}/${files[0]}`).metadata();
  const H = Math.round((m.height / m.width) * W);
  const C = +cols; const R = Math.ceil(files.length / C);
  const tiles = await Promise.all(files.map((f) => sharp(`${dir}/${f}`).resize(W, H).toBuffer()));
  await sharp({ create: { width: C * W + (C - 1) * 6, height: R * H + (R - 1) * 6, channels: 3, background: '#777' } })
    .composite(tiles.map((input, i) => ({ input, left: (i % C) * (W + 6), top: Math.floor(i / C) * (H + 6) }))).png().toFile(out);
})();
