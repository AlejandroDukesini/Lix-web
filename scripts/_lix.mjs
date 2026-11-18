// Revisión visual de los módulos nuevos de Lix (herramienta local, no forma parte de `check`).
// Uso: OUT=dir STEPS=flowers VP=1280x900 THEME=dark node scripts/_lix.mjs
import { mkdirSync } from 'node:fs';
import { preview } from 'vite';
import { chromium } from 'playwright-core';

const OUT = process.env.OUT ?? 'test-results/lix';
mkdirSync(OUT, { recursive: true });
const [w, h] = (process.env.VP ?? '1280x900').split('x').map(Number);
const mobile = w < 700;
const server = await preview({ preview: { port: 4398, strictPort: false, open: false }, logLevel: 'silent' });
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1, acceptDownloads: true, colorScheme: process.env.THEME === 'light' ? 'light' : 'dark' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(base);
await page.getByRole('button', { name: 'Saltar presentación' }).click({ timeout: 20000 });
await page.locator('#home-title').waitFor();
const steps = (process.env.STEPS ?? 'flowers').split(',');
const t = (label) => console.log(`[${((performance.now()) / 1000).toFixed(1)}s] ${label}`);
const tag = `${w}x${h}`;

if (steps.includes('flowers')) {
  await page.goto(`${base}#/flores`);
  await page.locator('.flowers-player canvas').waitFor({ timeout: 60000 }).catch(async (e) => { await page.screenshot({ path: `${OUT}/fail.png` }); console.log('FALLO', errors, await page.locator('.flowers-stage').innerText().catch(() => '')); process.exit(1); });
  t('python listo + primera animación');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/flowers-${tag}-a.png`, fullPage: true });
  await page.getByText('Rosa animada').click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/flowers-${tag}-rosa.png` });
  await page.getByText('Mi imagen').click();
  await page.locator('input[type=file]').setInputFiles(process.env.IMG ?? `${process.env.TEMP}/flw/test.jpg`);
  await page.getByText('Pétalos', { exact: true }).click();
  await page.waitForTimeout(2500);
  t('imagen procesada');
  await page.screenshot({ path: `${OUT}/flowers-${tag}-img.png` });
  await page.getByRole('button', { name: 'Guardar en el herbario' }).click();
  await page.locator('.creation-card img').first().waitFor({ timeout: 30000 });
  t('guardada en herbario');
  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar GIF' }).click();
  const file = await dl;
  console.log('descarga:', file.suggestedFilename());
  await page.locator('.creation-card').first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${OUT}/flowers-${tag}-herbario.png` });
}
if (steps.includes('ai')) {
  await page.goto(`${base}#/estudio`);
  const prompts = (process.env.PROMPTS ?? 'Montañas nevadas bajo un cielo estrellado|Un jardín de rosas al atardecer|Una playa con luna llena y corazones|Ciudad bajo la lluvia de noche|Bosque con río y aves al amanecer|Campo de girasoles amarillos en un día soleado').split('|');
  for (const [i, prompt] of prompts.entries()) {
    await page.getByLabel('Describe la imagen').fill(prompt);
    await page.getByRole('button', { name: 'Generar', exact: true }).click();
    await page.getByText('Procedural · no es IA').waitFor();
    await page.waitForTimeout(300);
    await page.locator('.ai-result__figure img').screenshot({ path: `${OUT}/ai-${i}.png` });
  }
}
async function seed(records) {
  await page.evaluate(async (list) => {
    const db = await new Promise((resolve, reject) => {
      const r = indexedDB.open('un-ano-mas-contigo');
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    const tx = db.transaction('organizer', 'readwrite');
    const now = new Date().toISOString();
    for (const rec of list) tx.objectStore('organizer').put({ createdAt: now, updatedAt: now, rev: 1, ...rec }, rec.id);
    await new Promise((resolve) => (tx.oncomplete = resolve));
    db.close();
  }, records);
}
if (steps.includes('academic')) {
  await page.goto(`${base}#/organizar`);
  await page.waitForTimeout(1500);
  const today = new Date();
  const iso = (d) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + d).toLocaleDateString('sv');
  const id = () => crypto.randomUUID();
  const calc = id(), fis = id(), hist = id(), prog = id(), nb = id();
  await seed([
    { id: calc, kind: 'subject', name: 'Cálculo integral', code: 'MAT-201', teacher: 'Ana Pérez', room: '301', building: 'Bloque A', color: '#ef6f8c', description: 'Integrales, series y aplicaciones.', semester: '2026-2', schedule: [{ weekday: 1, start: '08:00', end: '10:00', room: '301' }, { weekday: 3, start: '08:00', end: '10:00', room: '301' }] },
    { id: fis, kind: 'subject', name: 'Física II', teacher: 'Luis Gómez', room: 'Lab 2', building: 'Bloque C', color: '#3d8bd9', schedule: [{ weekday: 1, start: '09:00', end: '11:00' }, { weekday: 4, start: '14:00', end: '16:00' }] },
    { id: hist, kind: 'subject', name: 'Historia del arte', teacher: 'Marta Ruiz', room: '105', building: 'Bloque B', color: '#f5b961', schedule: [{ weekday: 2, start: '10:00', end: '12:00' }, { weekday: 5, start: '07:00', end: '09:00' }] },
    { id: prog, kind: 'subject', name: 'Programación', teacher: 'Jorge Díaz', room: 'Sala 4', building: 'Bloque D', color: '#6fa58b', schedule: [{ weekday: 2, start: '14:00', end: '17:00' }, { weekday: 4, start: '10:00', end: '12:00' }] },
    { id: id(), kind: 'activity', type: 'midterm', title: 'Primer parcial', subjectId: calc, dueDate: iso(3), dueTime: '08:00', status: 'pending', priority: 'high' },
    { id: id(), kind: 'activity', type: 'assignment', title: 'Taller de integrales', subjectId: calc, dueDate: iso(1), dueTime: '23:59', status: 'pending', priority: 'normal' },
    { id: id(), kind: 'activity', type: 'presentation', title: 'Exposición: Barroco', subjectId: hist, dueDate: iso(5), status: 'in_progress', priority: 'normal' },
    { id: id(), kind: 'activity', type: 'project', title: 'App de notas', subjectId: prog, dueDate: iso(12), status: 'pending', priority: 'high' },
    { id: id(), kind: 'activity', type: 'reading', title: 'Capítulo 4', subjectId: fis, dueDate: iso(-2), status: 'pending', priority: 'low' },
    { id: id(), kind: 'academicDate', type: 'holiday', name: 'Festivo nacional', date: iso(8), yearly: false, region: 'Colombia' },
    { id: id(), kind: 'academicDate', type: 'academic', name: 'Semana de parciales', date: iso(14), endDate: iso(18), yearly: false },
    { id: nb, kind: 'notebook', name: 'Cálculo integral', subjectId: calc, color: '#ef6f8c', description: 'Apuntes de clase' },
    { id: id(), kind: 'note', title: 'Integración por partes', content: '# Por partes ∫u dv = uv − ∫v du', notebookId: nb, noteDate: iso(-5), tags: [], collectionIds: [] },
    { id: id(), kind: 'note', title: 'Sustitución trigonométrica', content: 'Casos √(a²−x²)…', notebookId: nb, noteDate: iso(-1), tags: [], collectionIds: [] },
  ]);
  for (const tab of ['', '/asignaturas', '/actividades', '/horario', '/calendario', '/cuadernos', `/cuadernos/${nb}`]) {
    await page.goto(`${base}#/academico${tab}`);
    await page.reload();
    await page.getByRole('heading', { level: 1, name: 'Control académico' }).waitFor();
    await page.waitForTimeout(700);
    if (mobile) await page.screenshot({ path: `${OUT}/acadv-${tag}-${tab.replaceAll('/', '_').slice(0, 14) || 'resumen'}.png` });
    await page.screenshot({ path: `${OUT}/acad-${tag}-${tab.replace(/\//g, '_').slice(0, 14) || 'resumen'}.png`, fullPage: true });
  }
}
if (steps.includes('tips')) {
  await page.goto(`${base}#/consejos`);
  await page.locator('.tip-card').waitFor();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'Otro consejo' }).click();
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/tips-${tag}.png` });
  await page.getByRole('radiogroup', { name: 'Sección' }).getByText('Ajustes').click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/tips-${tag}-ajustes.png`, fullPage: !mobile });
}
console.log('errores:', errors.length ? errors : 'ninguno');
await browser.close();
await server.httpServer.close();
