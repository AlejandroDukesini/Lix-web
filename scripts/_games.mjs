// Capturas de cada juego en partida (herramienta de revisión visual, no forma parte de `check`).
// Uso: OUT=dir GAMES=id1,id2 VP=390x844 WAIT=2500 node scripts/_games.mjs
import { mkdirSync } from 'node:fs';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';

const OUT = process.env.OUT ?? 'test-results/games';
mkdirSync(OUT, { recursive: true });
const ALL = ['aquapark', 'io-games', 'chess', 'tunnel-runner', 'cruce-del-pollo', 'resolver-casos', 'sudokus', 'aparcar', 'despejar', 'hexastack', 'traffic-rider', 'frente-abierto', 'saltos-de-lumi', 'reino-de-ladrillos', 'bloques', 'lava-y-agua', 'stellarium', 'heladeria', 'pizzeria', 'pasteleria', 'gato-largo', 'botica', 'cochera', 'hamburgueseria'];
const games = process.env.GAMES ? process.env.GAMES.split(',') : ALL;
const [w, h] = (process.env.VP ?? '390x844').split('x').map(Number);
const WAIT = Number(process.env.WAIT ?? 2500);
const mobile = w < 700;

const server = await createServer({ server: { port: 4391 }, logLevel: 'silent' });
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(base);
await page.getByRole('button', { name: 'Saltar presentación' }).click({ timeout: 20000 });
await page.locator('#home-title').waitFor();

const START = /^(Empezar|Comenzar|Jugar|Iniciar|Nueva partida|Empezar partida|Empezar nivel|Abrir|Nivel 1)/i;
for (const id of games) {
  const before = errors.length;
  await page.goto(`${base}#/juegos`);
  await page.goto(`${base}#/juegos/${id}`);
  await page.getByRole('button', { name: 'Jugar', exact: true }).click();
  await page.locator('.game-screen__body.is-playing > *:not(.game-loading)').first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(800);
  for (const name of (process.env.CLICK ?? '').split('|').filter(Boolean)) {
    const byRole = page.getByRole('button', { name }).first();
    const target = (await byRole.count()) ? byRole : page.getByText(name).first();
    await target.evaluate((el) => el.click(), undefined, { timeout: 5000 }).catch(() => console.log('  sin', name));
    await page.waitForTimeout(400);
  }
  await page.screenshot({ path: `${OUT}/${id}-a.png` });
  if (process.env.SHOTS) {
    let elapsed = 800;
    for (const [n, at] of process.env.SHOTS.split(',').map(Number).entries()) {
      await page.waitForTimeout(Math.max(0, at - elapsed));
      elapsed = at;
      await page.screenshot({ path: `${OUT}/${id}-p${n}.png` });
    }
  }
  if (process.env.KEYS) {
    await page.waitForTimeout(3200);
    for (const key of process.env.KEYS.split(',')) {
      await page.keyboard.press(key);
      await page.waitForTimeout(260);
    }
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/${id}-k.png` });
  }
  const start = page.locator('.game-screen__body button').filter({ hasText: START }).first();
  if (!process.env.CLICK && (await start.count())) {
    await start.click().catch(() => {});
    await page.waitForTimeout(WAIT);
    await page.screenshot({ path: `${OUT}/${id}-b.png` });
  }
  console.log(id, errors.slice(before).join(' | ') || 'ok');
}
await browser.close();
await server.close();
