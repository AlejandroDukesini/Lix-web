/**
 * Verificación de extremo a extremo en un navegador real (Chromium: Edge o Chrome instalados).
 *
 * Requiere un build previo (`npm run build`). Comprueba:
 *  - Primer inicio → viaje astral completo con scroll real: escenario sticky siempre visible, cada texto
 *    dentro de la pantalla y sin pisar la ilustración, retroceso, saltos bruscos y final accesible,
 *    en varios tamaños de móvil, tableta y escritorio (incluidas ventanas bajas y apaisadas).
 *  - La configuración se aplica y persiste tras recargar.
 *  - El Service Worker precachea y la app funciona SIN conexión (incluida la ruta diferida de Configuración).
 *  - Ninguna petición sale del origen local y no hay errores en consola (incluidas violaciones de CSP).
 *  - El Game Center y sus diez juegos (fases 1 y 2) funcionan sin conexión (incluida la IA de ajedrez en su Worker).
 *  - No hay desplazamiento horizontal en móvil (iPhone XS) ni en escritorio.
 *
 * Uso: npm run test:e2e   (capturas en test-results/screenshots; SCREENSHOT_DIR para cambiarlo)
 */
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { preview } from 'vite';
import { chromium } from 'playwright-core';
import { SCENE_BOUNDS, SCENE_IDS } from '../src/features/presentation/story/timeline.js';

const SHOTS = process.env.SCREENSHOT_DIR ?? path.resolve('test-results/screenshots');
mkdirSync(SHOTS, { recursive: true });

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✔' : '✘'} ${name}${detail ? ` — ${detail}` : ''}`);
};

function findBrowser() {
  const candidates = [
    process.env.BROWSER_PATH,
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].filter(Boolean);
  return candidates.find((candidate) => existsSync(candidate));
}

if (!existsSync('dist/index.html')) {
  console.error('No existe dist/. Ejecuta primero: npm run build');
  process.exit(1);
}

const executablePath = findBrowser();
if (!executablePath) {
  console.error('No se encontró Edge ni Chrome. Define BROWSER_PATH con la ruta del navegador.');
  process.exit(1);
}

const server = await preview({ preview: { port: 4321, strictPort: false, open: false }, logLevel: 'silent' });
const baseUrl = server.resolvedUrls.local[0];
const origin = new URL(baseUrl).origin;
const browser = await chromium.launch({ executablePath, headless: true });

function watch(page, label) {
  const issues = { external: [], errors: [], failed: [] };
  page.on('requestfailed', (request) => {
    issues.failed.push(`${request.url()} (${request.failure()?.errorText})`);
    console.log(`  · petición fallida: ${request.url()} (${request.failure()?.errorText})`);
  });
  page.on('request', (request) => {
    const url = request.url();
    if (!url.startsWith(origin) && !url.startsWith('data:') && !url.startsWith('blob:')) issues.external.push(url);
  });
  page.on('console', (message) => {
    if (message.type() === 'error') issues.errors.push(`[${label}] ${message.text()}`);
  });
  page.on('pageerror', (error) => issues.errors.push(`[${label}] ${error.message}`));
  return issues;
}

// Se compara con el ancho configurado: en modo móvil, innerWidth crece si el contenido desborda.
const noHorizontalScroll = (page) =>
  page.evaluate((width) => document.documentElement.scrollWidth <= width + 1, page.viewportSize().width);

/** Lleva el scroll al punto `pose` (0–1) de un capítulo, igual que el índice de capítulos. */
const scrollToScene = (page, id, pose) =>
  page.evaluate(
    ([[start, end], pose]) => {
      const track = document.querySelector('.astral__track');
      const stage = document.querySelector('.astral__stage');
      const top = track.getBoundingClientRect().top + window.scrollY;
      const travel = track.offsetHeight - stage.offsetHeight;
      window.scrollTo(0, Math.round(top + (start + (end - start) * pose) * travel));
    },
    [SCENE_BOUNDS[SCENE_IDS.indexOf(id)], pose],
  );

const opacity = (page, selector) => page.evaluate((s) => Number(getComputedStyle(document.querySelector(s)).opacity), selector);

/**
 * Estado de la composición: escenario pegado a la pantalla y textos visibles
 * (opacidad > 0.5) con su posición respecto a la ventana y a la zona visual.
 */
const storyLayout = (page) =>
  page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const stage = document.querySelector('.astral__stage').getBoundingClientRect();
    const area = document.querySelector('.astral__area').getBoundingClientRect();
    const texts = [...document.querySelectorAll('[data-opening], [data-caption], [data-together], [data-finale]')]
      .filter((node) => Number(getComputedStyle(node).opacity) > 0.5)
      .map((node) => {
        const r = node.getBoundingClientRect();
        const overlapX = Math.max(0, Math.min(r.right, area.right) - Math.max(r.left, area.left));
        const overlapY = Math.max(0, Math.min(r.bottom, area.bottom) - Math.max(r.top, area.top));
        return {
          id: node.dataset.caption ?? Object.keys(node.dataset)[0],
          inside: r.top >= -1 && r.left >= -1 && r.bottom <= vh + 1 && r.right <= vw + 1,
          overArea: overlapX * overlapY,
          rect: [r.left, r.top, r.right, r.bottom].map(Math.round).join(','),
        };
      });
    return { stagePinned: Math.abs(stage.top) <= 1 && stage.bottom <= vh + 1, texts, scene: document.querySelector('.astral').dataset.scene };
  });

const TOUR = [
  ['galaxy', 0.7],
  ['constellation', 0.88],
  ['earth', 0.65],
  ['telescope', 0.8],
  ['eyepiece', 0.88],
  ['candle', 0.3],
  ['candle', 0.75],
  ['final', 1],
];

/**
 * Recorre la historia completa (la página ya está en el prólogo) y comprueba
 * composición, revelaciones, retroceso y saltos. `tag` prefija capturas y mensajes.
 */
async function tourStory(page, tag) {
  const problems = [];
  for (const [index, [id, pose]] of TOUR.entries()) {
    await scrollToScene(page, id, pose);
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${SHOTS}/${tag}-${String(index + 1).padStart(2, '0')}-${id}.png` });
    const layout = await storyLayout(page);
    if (!layout.stagePinned) problems.push(`${id}: el escenario no está pegado a la pantalla`);
    if (layout.scene !== id) problems.push(`${id}: capítulo activo «${layout.scene}»`);
    if (layout.texts.length !== 1) problems.push(`${id}@${pose}: ${layout.texts.length} textos visibles (${layout.texts.map((t) => t.id).join(', ')})`);
    for (const text of layout.texts) {
      if (!text.inside) problems.push(`${id}: el texto «${text.id}» sale de la pantalla (${text.rect})`);
      // En vertical la tarjeta final sube sobre la zona visual a propósito: allí se comprueba que no tape la vela.
      if (text.overArea > 0 && text.id !== 'finale') problems.push(`${id}: el texto «${text.id}» invade la zona de la ilustración (${Math.round(text.overArea)} px²)`);
    }
    if (id === 'constellation') {
      const drawn = await page.evaluate(() => [...document.querySelectorAll('[data-segment], [data-crossbar]')].every((l) => Number(l.style.strokeDashoffset) === 0));
      if (!drawn) problems.push('II: la constelación no se dibuja completa');
    }
    if (id === 'earth' && (await opacity(page, '[data-earth]')) < 0.95) problems.push('III: la Tierra no se ve');
    if (id === 'telescope' && (await opacity(page, '[data-telescope]')) < 0.95) problems.push('IV: el telescopio no se revela');
    if (id === 'eyepiece' && !((await opacity(page, '[data-iris]')) === 1 && (await opacity(page, '[data-eyepiece]')) > 0.95)) problems.push('V: no se mira por el ocular');
    if (id === 'candle' && pose > 0.5) {
      const letter = await page.locator('.candle__monogram-letter').textContent();
      if (letter !== 'A' || (await opacity(page, '[data-eyepiece]')) < 0.95) problems.push('VI: la vela con la letra A no ocupa el ocular');
      if ((await opacity(page, '[data-together]')) < 0.95) problems.push('VI: no aparece «Otro año juntos»');
    }
    if (!(await noHorizontalScroll(page))) problems.push(`${id}: desplazamiento horizontal`);
  }

  // La tarjeta final nunca tapa la vela (se compara con el cuerpo y la llama, no con su halo).
  const covered = await page.evaluate(() => {
    const finale = document.querySelector('[data-finale]').getBoundingClientRect();
    const candle = document.querySelector('[data-eyepiece-candle] .candle').getBoundingClientRect();
    return Math.max(0, Math.min(candle.bottom, finale.bottom) - Math.max(candle.top, finale.top)) * Math.max(0, Math.min(candle.right, finale.right) - Math.max(candle.left, finale.left));
  });
  if (covered > 0) problems.push(`VII: la tarjeta final tapa la vela (${Math.round(covered)} px²)`);

  const box = await page.getByRole('button', { name: 'Entrar a nuestro universo' }).boundingBox();
  if (!box || box.y < 0 || box.y + box.height > page.viewportSize().height) problems.push('VII: el botón final no está dentro de la pantalla');

  // Volver atrás: el telescopio vuelve a verse y el iris se abre.
  await scrollToScene(page, 'telescope', 0.8);
  await page.waitForTimeout(600);
  if (!((await opacity(page, '[data-telescope]')) > 0.95 && (await opacity(page, '[data-iris]')) === 0)) problems.push('No se puede regresar al telescopio');

  // Saltos bruscos: inicio ↔ final sin estados intermedios bloqueados.
  const ids = (layout) => layout.texts.map((t) => t.id).join(', ');
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(250);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(600);
  const start = await storyLayout(page);
  if (start.scene !== 'opening' || ids(start) !== 'opening') problems.push(`Salto al inicio: escena «${start.scene}», textos ${ids(start)}`);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(700);
  const end = await storyLayout(page);
  if (end.scene !== 'final' || ids(end) !== 'finale') problems.push(`Salto al final: escena «${end.scene}», textos ${ids(end)}`);

  check(`${tag}: viaje completo con escenario fijo y textos dentro de la pantalla`, problems.length === 0, problems.join(' | '));
}

try {
  // ------------------------------------------------------------------ móvil
  const mobile = await browser.newContext({
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'es-CO',
    timezoneId: 'America/Bogota',
  });
  const page = await mobile.newPage();
  const mobileIssues = watch(page, 'móvil');

  await page.goto(baseUrl);
  await page.getByRole('heading', { level: 1, name: 'Hay millones de estrellas en el universo...' }).waitFor();
  check('Primer inicio muestra el viaje astral', true);
  await page.waitForTimeout(6500);
  await page.screenshot({ path: `${SHOTS}/m00-prologo.png` });
  check('Prólogo sin desplazamiento horizontal', await noHorizontalScroll(page));

  // «Comenzar el viaje» lleva al capítulo I.
  await page.getByRole('button', { name: 'Comenzar el viaje' }).click();
  await page.waitForFunction(() => document.querySelector('.astral')?.dataset.scene === 'galaxy', null, { timeout: 5000 });
  check('«Comenzar el viaje» lleva al capítulo I', true);

  // Recorrido con scroll real por cada capítulo.
  await tourStory(page, 'm');

  await page.getByRole('button', { name: 'Capítulo VII: La sorpresa' }).click();
  await page.waitForTimeout(2600);
  await page.getByRole('button', { name: 'Entrar a nuestro universo' }).click();

  await page.locator('#home-title').waitFor();
  check('Tras la presentación se llega al inicio', true);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${SHOTS}/m7-home.png`, fullPage: true });
  check('Inicio móvil sin desplazamiento horizontal', await noHorizontalScroll(page));

  const completed = await page.evaluate(() => JSON.parse(localStorage.getItem('uamc:preferences')).presentation.completed);
  check('Estado de la presentación guardado', completed === true);

  // Service Worker listo y controlando la página
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.locator('#home-title').waitFor();
  const controlled = await page.evaluate(() => Boolean(navigator.serviceWorker.controller));
  check('Service Worker activo y controlando la página', controlled);
  check('No vuelve a mostrar la presentación tras recargar', (await page.locator('.astral').count()) === 0);

  // Configuración en móvil
  await page.getByRole('link', { name: 'Ajustes' }).click();
  await page.getByRole('heading', { name: 'Configuración', level: 1 }).waitFor();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SHOTS}/m8-settings.png`, fullPage: true });
  check('Configuración móvil sin desplazamiento horizontal', await noHorizontalScroll(page));

  // Cambios reales: estilo, tema, semana y apodo
  await page.getByText('Maximalismo', { exact: true }).click();
  await page.getByRole('radio', { name: 'Claro', exact: true }).check({ force: true });
  await page.getByRole('radio', { name: 'Domingo', exact: true }).check({ force: true });
  await page.getByLabel('Nuevo apodo').fill('Mi cielo');
  await page.getByRole('button', { name: 'Añadir' }).click();
  await page.getByRole('button', { name: 'Guardar apodos' }).click();
  await page.waitForTimeout(400);
  await page.reload();
  await page.getByRole('heading', { name: 'Configuración', level: 1 }).waitFor();
  const persisted = await page.evaluate(() => ({
    style: document.documentElement.dataset.style,
    theme: document.documentElement.dataset.theme,
    prefs: JSON.parse(localStorage.getItem('uamc:preferences')),
  }));
  check('Estilo persiste tras recargar', persisted.style === 'maximal');
  check('Tema persiste tras recargar', persisted.theme === 'light');
  check('Inicio de semana persiste', persisted.prefs.calendar.weekStartsOn === 0);
  check('Nuevo apodo persiste', persisted.prefs.profile.nicknames.includes('Mi cielo'));
  await page.waitForTimeout(900);
  check('Configuración maximal móvil sin desplazamiento horizontal', await noHorizontalScroll(page));
  await page.screenshot({ path: `${SHOTS}/m9-settings-maximal-light.png`, fullPage: true });

  // Sin conexión
  // Se espera a que terminen las cargas en curso para no abortarlas al cortar la red.
  await page.waitForLoadState('networkidle');
  await mobile.setOffline(true);
  await page.reload();
  await page.getByRole('heading', { name: 'Configuración', level: 1 }).waitFor({ timeout: 8000 });
  check('Sin conexión: Configuración (carga diferida) se abre desde la caché', true);
  await page.getByRole('link', { name: 'Inicio' }).click();
  await page.locator('#home-title').waitFor({ timeout: 8000 });
  check('Sin conexión: el inicio funciona', true);
  await page.waitForTimeout(1000);

  // Game Center sin conexión: biblioteca, juegos (carga diferida) y la IA de ajedrez en su Web Worker.
  await page.goto(`${baseUrl}#/juegos`);
  await page.getByRole('heading', { level: 1, name: /Game Center/ }).waitFor({ timeout: 8000 });
  check('Sin conexión: el Game Center se abre', true);
  // Modo online sin conexión: aviso claro, sin enlace externo y el modo offline disponible.
  await page.goto(`${baseUrl}#/juegos/aquapark`);
  await page.getByRole('group', { name: 'Modalidad de juego' }).waitFor({ timeout: 8000 });
  check(
    'Sin conexión: el modo online lo indica y no ofrece el enlace',
    (await page.getByText(/Sin conexión\. Disponible cuando vuelvas/).isVisible()) &&
      (await page.getByRole('link', { name: 'Abrir en CrazyGames' }).count()) === 0 &&
      (await page.getByRole('button', { name: 'Jugar', exact: true }).isEnabled()),
  );
  for (const id of ['aquapark', 'io-games', 'logic-grid', 'tunnel-runner', 'cruce-del-pollo', 'resolver-casos', 'sudokus', 'aparcar', 'despejar', 'hexastack', 'traffic-rider', 'frente-abierto', 'saltos-de-lumi']) {
    await page.goto(`${baseUrl}#/juegos`);
    await page.goto(`${baseUrl}#/juegos/${id}`);
    await page.getByRole('button', { name: 'Jugar', exact: true }).click();
    await page.locator('.game-screen__body.is-playing > *:not(.game-loading)').first().waitFor({ timeout: 8000 });
    check(`Sin conexión: ${id} se carga y arranca`, true);
  }
  await page.goto(`${baseUrl}#/juegos`);
  await page.goto(`${baseUrl}#/juegos/chess`);
  await page.getByRole('button', { name: 'Jugar', exact: true }).click();
  await page.getByRole('button', { name: 'Empezar partida' }).click();
  const chessBoard = page.getByRole('grid', { name: 'Tablero de ajedrez' });
  await chessBoard.getByRole('button', { name: /^e2,/ }).click();
  await chessBoard.getByRole('button', { name: /^e4,/ }).click();
  await page.getByText('Tu turno').waitFor({ timeout: 10000 });
  check('Sin conexión: la IA de ajedrez responde (Web Worker precacheado)', (await page.locator('.chess__moves li').first().textContent()).length > 4);
  await page.screenshot({ path: `${SHOTS}/m10-chess-offline.png` });

  await page.goto(`${baseUrl}#/presentacion`);
  await page.getByRole('heading', { level: 1, name: 'Hay millones de estrellas en el universo...' }).waitFor({ timeout: 8000 });
  check('Sin conexión: la presentación se puede reproducir', true);
  await mobile.setOffline(false);

  check('Móvil: ninguna petición externa', mobileIssues.external.length === 0, mobileIssues.external.join(', '));
  // ERR_INTERNET_DISCONNECTED es esperable mientras se simula estar sin conexión.
  const mobileErrors = mobileIssues.errors.filter((e) => !e.includes('ERR_INTERNET_DISCONNECTED'));
  check('Móvil: sin errores en consola', mobileErrors.length === 0, [...mobileErrors, ...mobileIssues.failed].join(' | '));
  await mobile.close();

  // ---------------------------------------- el viaje en otros tamaños de pantalla
  const viewports = [
    ['d', { width: 1440, height: 900 }],
    ['d-hd', { width: 1280, height: 720 }],
    ['d-fhd', { width: 1920, height: 1080 }],
    ['d-low', { width: 1366, height: 600 }],
    ['t', { width: 768, height: 1024 }],
    ['m-short', { width: 360, height: 640 }],
    ['m-land', { width: 812, height: 375 }],
  ];
  for (const [tag, viewport] of viewports) {
    const touch = viewport.width < 900;
    const context = await browser.newContext({ viewport, isMobile: touch, hasTouch: touch, locale: 'es-CO', timezoneId: 'America/Bogota' });
    const storyPage = await context.newPage();
    const issues = watch(storyPage, tag);
    await storyPage.goto(baseUrl);
    await storyPage.getByRole('heading', { level: 1, name: 'Hay millones de estrellas en el universo...' }).waitFor();
    await storyPage.waitForTimeout(4800);
    await storyPage.screenshot({ path: `${SHOTS}/${tag}-00-prologo.png` });
    await tourStory(storyPage, tag);
    // Ajedrez: casillas que se puedan tocar con precisión en cada tamaño (también el móvil en horizontal).
    await storyPage.getByRole('button', { name: 'Entrar a nuestro universo' }).click();
    await storyPage.locator('#home-title').waitFor();
    await storyPage.goto(`${baseUrl}#/juegos/chess`);
    await storyPage.getByRole('button', { name: 'Jugar', exact: true }).click();
    await storyPage.getByRole('button', { name: 'Empezar partida' }).click();
    const square = await storyPage.locator('.chess-square').first().boundingBox();
    check(`${tag}: casillas de ajedrez de al menos 28 px`, square.width >= 28 && Math.abs(square.width - square.height) < 1, `${Math.round(square.width)}×${Math.round(square.height)}`);
    check(`${tag} ${viewport.width}×${viewport.height}: sin errores en consola`, issues.errors.length === 0, issues.errors.join(' | '));
    await context.close();
  }

  // ------------------------------------------------------------- escritorio
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-CO', timezoneId: 'America/Bogota' });
  const deskPage = await desktop.newPage();
  const deskIssues = watch(deskPage, 'escritorio');
  await deskPage.goto(baseUrl);
  await deskPage.getByRole('heading', { level: 1, name: 'Hay millones de estrellas en el universo...' }).waitFor();
  await deskPage.waitForTimeout(2600);
  await deskPage.screenshot({ path: `${SHOTS}/d00-prologo.png` });
  await deskPage.getByRole('button', { name: 'Saltar presentación' }).click();
  await deskPage.locator('#home-title').waitFor();

  const combos = [
    ['glass', 'dark'],
    ['glass', 'light'],
    ['maximal', 'dark'],
    ['maximal', 'light'],
  ];
  for (const [style, theme] of combos) {
    await deskPage.evaluate(
      ([s, t]) => {
        const prefs = JSON.parse(localStorage.getItem('uamc:preferences'));
        prefs.appearance.style = s;
        prefs.appearance.theme = t;
        localStorage.setItem('uamc:preferences', JSON.stringify(prefs));
      },
      [style, theme],
    );
    await deskPage.goto(`${baseUrl}#/`);
    await deskPage.reload();
    await deskPage.locator('#home-title').waitFor();
    await deskPage.waitForTimeout(2600);
    await deskPage.screenshot({ path: `${SHOTS}/d-home-${style}-${theme}.png`, fullPage: true });
    check(`Escritorio ${style}/${theme}: sin desplazamiento horizontal`, await noHorizontalScroll(deskPage));
  }
  await deskPage.goto(`${baseUrl}#/ajustes`);
  await deskPage.getByRole('heading', { name: 'Configuración', level: 1 }).waitFor();
  await deskPage.waitForTimeout(800);
  await deskPage.screenshot({ path: `${SHOTS}/d-settings.png`, fullPage: true });

  // Los módulos futuros no son enlaces navegables; Juegos sí.
  const soonLinks = await deskPage.locator('a[href*="finanzas"], a[href*="diario"], a[href*="calendario"]').count();
  check('Módulos futuros sin enlaces a pantallas inexistentes', soonLinks === 0);
  await deskPage.goto(`${baseUrl}#/finanzas`);
  await deskPage.locator('#home-title').waitFor();
  check('Ruta de módulo futuro redirige al inicio', true);

  // Game Center en escritorio: biblioteca sin desplazamiento horizontal y fases futuras sin enlaces.
  await deskPage.goto(`${baseUrl}#/juegos`);
  await deskPage.getByRole('heading', { level: 1, name: /Game Center/ }).waitFor();
  await deskPage.waitForTimeout(800);
  await deskPage.screenshot({ path: `${SHOTS}/d-game-center.png`, fullPage: true });
  check('Game Center: catorce juegos disponibles (fases 1, 2 y 3)', (await deskPage.getByRole('link', { name: /^Jugar a / }).count()) === 14);
  check('Game Center: fases futuras sin enlaces de juego', (await deskPage.locator('.gc-roadmap a').count()) === 0);
  check('Game Center escritorio sin desplazamiento horizontal', await noHorizontalScroll(deskPage));

  // Modo online de Aquapark: enlace a la página oficial verificada, en otra pestaña, sin iframe ni carga externa.
  await deskPage.goto(`${baseUrl}#/juegos/aquapark`);
  await deskPage.getByRole('group', { name: 'Modalidad de juego' }).waitFor();
  const onlineLink = await deskPage.getByRole('link', { name: 'Abrir en CrazyGames' }).evaluate((a) => ({ href: a.href, target: a.target, rel: a.rel }));
  check(
    'Aquapark online: página oficial verificada en otra pestaña (noopener, noreferrer)',
    onlineLink.href === 'https://www.crazygames.com/game/aquapark-io-yky' && onlineLink.target === '_blank' && /noopener/.test(onlineLink.rel) && /noreferrer/.test(onlineLink.rel),
    JSON.stringify(onlineLink),
  );
  check('Aquapark: la pantalla del juego no inserta iframes', (await deskPage.locator('iframe').count()) === 0);
  await deskPage.goto(`${baseUrl}#/juegos/chess`);
  await deskPage.getByRole('button', { name: 'Jugar', exact: true }).waitFor();
  check('Juegos sin versión online verificada: sin opción online', (await deskPage.getByRole('group', { name: 'Modalidad de juego' }).count()) === 0);
  // Fases 2 y 3: cada versión online enlaza a su página oficial verificada; donde no la hay, se explica.
  const phase2Links = {
    'cruce-del-pollo': 'https://www.crazygames.com/game/go-chicken-go',
    sudokus: 'https://sudoku.com/',
    aparcar: 'https://poki.com/es/g/extreme-car-parking',
    despejar: 'https://poki.com/es/g/car-parking-jam',
    hexastack: 'https://www.crazygames.com/game/hexa-stack',
    'traffic-rider': 'https://www.crazygames.com/game/traffic-rider-vvq',
    'frente-abierto': 'https://openfront.io/',
  };
  const linkProblems = [];
  for (const [id, url] of Object.entries(phase2Links)) {
    await deskPage.goto(`${baseUrl}#/juegos/${id}`);
    await deskPage.getByRole('group', { name: 'Modalidad de juego' }).waitFor();
    const link = await deskPage.locator('.play-mode--online a').evaluate((a) => ({ href: a.href, target: a.target, rel: a.rel }));
    if (link.href !== url || link.target !== '_blank' || !/noopener/.test(link.rel)) linkProblems.push(`${id}: ${JSON.stringify(link)}`);
  }
  for (const id of ['resolver-casos', 'saltos-de-lumi']) {
    await deskPage.goto(`${baseUrl}#/juegos/${id}`);
    await deskPage.getByRole('button', { name: 'Jugar', exact: true }).waitFor();
    if (!(await deskPage.getByText(/Versión online: no disponible/).isVisible())) linkProblems.push(`${id} sin aviso`);
  }
  check('Fases 2 y 3: enlaces online oficiales verificados (y aviso donde no hay versión online)', linkProblems.length === 0, linkProblems.join(' | '));
  // Estadísticas: en el ancho de escritorio las fichas ocupan toda la fila y no se cortan.
  await deskPage.goto(`${baseUrl}#/juegos`);
  await deskPage.locator('.gc-stats').scrollIntoViewIfNeeded();
  const stats = await deskPage.evaluate(() => {
    const section = document.querySelector('.gc-stats').getBoundingClientRect().width;
    const tokens = document.querySelector('.game-tokens').getBoundingClientRect().width;
    const cut = [...document.querySelectorAll('.game-token__label, .game-token__value')].filter((n) => n.scrollWidth > n.clientWidth + 1).length;
    return { ratio: tokens / section, cut };
  });
  check('Estadísticas: fichas a todo el ancho y sin textos cortados', stats.ratio > 0.95 && stats.cut === 0, JSON.stringify(stats));

  // Datos corruptos no rompen la app
  await deskPage.evaluate(() => localStorage.setItem('uamc:preferences', '{esto no es json'));
  await deskPage.reload();
  await deskPage.waitForTimeout(800);
  const survived = (await deskPage.locator('.astral, #home-title').count()) > 0;
  check('Preferencias corruptas: la app arranca igualmente', survived);

  check('Escritorio: ninguna petición externa', deskIssues.external.length === 0, deskIssues.external.join(', '));
  check('Escritorio: sin errores en consola', deskIssues.errors.length === 0, deskIssues.errors.join(' | '));
  await desktop.close();
} catch (error) {
  check('Ejecución de la verificación', false, error.message);
} finally {
  await browser.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} comprobaciones superadas. Capturas: ${SHOTS}`);
process.exit(failed.length ? 1 : 0);
