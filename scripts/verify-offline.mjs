/**
 * Verificación de extremo a extremo en un navegador real (Chromium: Edge o Chrome instalados).
 *
 * Requiere un build previo (`npm run build`). Comprueba:
 *  - Primer inicio → presentación completa (abrir, soplar, continuar, entrar).
 *  - La configuración se aplica y persiste tras recargar.
 *  - El Service Worker precachea y la app funciona SIN conexión (incluida la ruta diferida de Configuración).
 *  - Ninguna petición sale del origen local y no hay errores en consola (incluidas violaciones de CSP).
 *  - No hay desplazamiento horizontal en móvil (iPhone XS) ni en escritorio.
 *
 * Uso: npm run test:e2e   (capturas en test-results/screenshots; SCREENSHOT_DIR para cambiarlo)
 */
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { preview } from 'vite';
import { chromium } from 'playwright-core';

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
  await page.waitForFunction(() => document.querySelector('.astral')?.dataset.scene === 'stars', null, { timeout: 5000 });
  check('«Comenzar el viaje» lleva al capítulo I', true);

  // Recorrido con scroll real por cada capítulo.
  const scrollTo = (id, pose) =>
    page.evaluate(
      ([id, pose]) => {
        const section = document.querySelector(`.chapter--${id}`);
        const rect = section.getBoundingClientRect();
        const top = rect.top + window.scrollY;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        window.scrollTo(0, top + Math.min(rect.height, max - top) * pose);
      },
      [id, pose],
    );
  const opacity = (selector) => page.evaluate((s) => Number(getComputedStyle(document.querySelector(s)).opacity), selector);
  const tour = [
    ['stars', 0.5],
    ['constellation', 0.95],
    ['galaxy', 0.6],
    ['telescope', 0.8],
    ['eyepiece', 0.95],
    ['candle', 0.85],
    ['final', 1],
  ];
  for (const [index, [id, pose]] of tour.entries()) {
    await scrollTo(id, pose);
    await page.waitForTimeout(id === 'candle' || id === 'final' ? 3200 : 1200);
    await page.screenshot({ path: `${SHOTS}/m0${index + 1}-${id}.png` });
    if (id === 'constellation') {
      const drawn = await page.evaluate(() => [...document.querySelectorAll('[data-segment], [data-crossbar]')].every((l) => Number(l.style.strokeDashoffset) === 0));
      check('II: la constelación se dibuja completa (forma la «A»)', drawn);
    }
    if (id === 'telescope') check('IV: el telescopio se revela', (await opacity('[data-telescope]')) > 0.95);
    if (id === 'eyepiece') check('V: se mira por el ocular (iris y vista circular)', (await opacity('[data-iris]')) === 1 && (await opacity('[data-eyepiece]')) > 0.95);
    if (id === 'candle') {
      const letter = await page.locator('.candle__monogram-letter').textContent();
      check('VI: la vela con la letra A ocupa el centro del ocular', letter === 'A' && (await opacity('[data-eyepiece]')) > 0.95);
      check('VI: aparece «Otro año juntos»', await page.locator('.together.is-revealed').isVisible());
    }
    check(`Capítulo ${id}: sin desplazamiento horizontal`, await noHorizontalScroll(page));
  }

  // Volver atrás: el telescopio vuelve a verse y el iris se abre.
  await scrollTo('telescope', 0.8);
  await page.waitForTimeout(900);
  check('Se puede regresar a un capítulo anterior', (await opacity('[data-telescope]')) > 0.95 && (await opacity('[data-iris]')) === 0);
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
  await page.goto(`${baseUrl}#/presentacion`);
  await page.getByRole('heading', { level: 1, name: 'Hay millones de estrellas en el universo...' }).waitFor({ timeout: 8000 });
  check('Sin conexión: la presentación se puede reproducir', true);
  await mobile.setOffline(false);

  check('Móvil: ninguna petición externa', mobileIssues.external.length === 0, mobileIssues.external.join(', '));
  // ERR_INTERNET_DISCONNECTED es esperable mientras se simula estar sin conexión.
  const mobileErrors = mobileIssues.errors.filter((e) => !e.includes('ERR_INTERNET_DISCONNECTED'));
  check('Móvil: sin errores en consola', mobileErrors.length === 0, [...mobileErrors, ...mobileIssues.failed].join(' | '));
  await mobile.close();

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

  // Los módulos futuros no son enlaces navegables
  const soonLinks = await deskPage.locator('a[href*="juegos"], a[href*="finanzas"], a[href*="diario"]').count();
  check('Módulos futuros sin enlaces a pantallas inexistentes', soonLinks === 0);
  await deskPage.goto(`${baseUrl}#/juegos`);
  await deskPage.locator('#home-title').waitFor();
  check('Ruta de módulo futuro redirige al inicio', true);

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
