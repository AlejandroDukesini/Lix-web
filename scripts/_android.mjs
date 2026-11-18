// Prueba la app Android real (emulador o teléfono con depuración USB) controlando su WebView por CDP.
// Herramienta local, no forma parte de `check`. Requiere el APK de depuración instalado y abierto.
// Uso: STEPS=skip,flowers,seed,tips,settings,pin node scripts/_android.mjs
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const ADB = `${process.env.LOCALAPPDATA}/Android/Sdk/platform-tools/adb.exe`;
const OUT = process.env.OUT ?? 'test-results/android';
mkdirSync(OUT, { recursive: true });
const adb = (...args) => execFileSync(ADB, args, { encoding: 'utf8' });
const shot = (name) => writeFileSync(`${OUT}/${name}.png`, execFileSync(ADB, ['exec-out', 'screencap', '-p'], { maxBuffer: 64 * 1024 * 1024 }));
const steps = (process.env.STEPS ?? 'skip,flowers').split(',');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (msg) => console.log(`[${(performance.now() / 1000).toFixed(1)}s] ${msg}`);

const socket = adb('shell', 'cat', '/proc/net/unix').match(/webview_devtools_remote_\d+/)?.[0];
if (!socket) throw new Error('No hay ningún WebView depurable abierto (¿está la app abierta?).');
adb('forward', 'tcp:9333', `localabstract:${socket}`);
const targets = await (await fetch('http://127.0.0.1:9333/json')).json();
const target = targets.find((t) => t.type === 'page');
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = reject;
});
let nextId = 1;
const pending = new Map();
const consoleErrors = [];
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  } else if (msg.method === 'Runtime.exceptionThrown') consoleErrors.push(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text);
  else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') consoleErrors.push(msg.params.args.map((a) => a.value ?? a.description).join(' '));
};
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const id = nextId++;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
await send('Runtime.enable');
const evaluate = async (expression) => {
  const res = await send('Runtime.evaluate', { expression: `(async () => { ${expression} })()`, awaitPromise: true, returnByValue: true });
  if (res.result?.exceptionDetails) throw new Error(res.result.exceptionDetails.exception?.description ?? 'error');
  return res.result?.result?.value;
};
const waitFor = async (condition, timeout = 30000, label = condition) => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await evaluate(`return Boolean(${condition});`)) return;
    await sleep(500);
  }
  throw new Error(`Tiempo agotado esperando: ${label}`);
};
const clickText = (selector, text) => evaluate(`const el = [...document.querySelectorAll(${JSON.stringify(selector)})].find((n) => n.textContent.trim().includes(${JSON.stringify(text)})); if (!el) throw new Error('No encontrado: ${text}'); el.click(); return true;`);
const go = async (hash) => {
  await evaluate(`window.location.hash = ${JSON.stringify(hash)}; return true;`);
  await sleep(1500);
};

log(`conectado a ${target.url} · LixAndroid=${await evaluate('return typeof window.LixAndroid;')} · ${await evaluate('return navigator.userAgent.match(/Chrome\\/[\\d.]+/)?.[0];')}`);

if (steps.includes('skip')) {
  if (await evaluate(`return Boolean([...document.querySelectorAll('button')].find((b) => b.textContent.includes('Saltar presentación')));`)) await clickText('button', 'Saltar presentación');
  await waitFor(`document.querySelector('#home-title')`, 30000);
  log('inicio cargado');
  shot('01-inicio');
}

if (steps.includes('flowers')) {
  await go('#/flores');
  const started = Date.now();
  await waitFor(`/fotogramas/.test(document.querySelector('.flowers-proof')?.textContent ?? '')`, 240000, 'Python en el WebView');
  log(`Python listo en ${((Date.now() - started) / 1000).toFixed(1)} s · ${await evaluate("return document.querySelector('.flowers-proof').textContent;")}`);
  await clickText('.flowers-template', 'Girasol');
  await sleep(3000);
  shot('02-flowers');
  await clickText('button', 'Descargar GIF');
  await sleep(4000);
  log(`Descargas/Lix: ${adb('shell', 'ls', '/sdcard/Download/Lix').trim().replace(/\s+/g, ' ')}`);
}

if (steps.includes('seed')) {
  await evaluate(`
    const db = await new Promise((resolve, reject) => { const r = indexedDB.open('un-ano-mas-contigo'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    const now = new Date();
    const iso = (d) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + d).toLocaleDateString('sv');
    const wd = (d) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + d).getDay();
    const id = () => crypto.randomUUID();
    const calc = id(), hist = id(), stamp = now.toISOString();
    const records = [
      { id: calc, kind: 'subject', name: 'Cálculo integral', teacher: 'Ana Pérez', room: '301', building: 'Bloque A', color: '#ef6f8c', schedule: [{ weekday: wd(1), start: '08:00', end: '10:00' }, { weekday: wd(3), start: '10:00', end: '12:00' }] },
      { id: hist, kind: 'subject', name: 'Historia del arte', room: '105', building: 'Bloque B', color: '#f5b961', schedule: [{ weekday: wd(2), start: '14:00', end: '16:00' }] },
      { id: id(), kind: 'activity', type: 'midterm', title: 'Primer parcial', subjectId: calc, dueDate: iso(3), dueTime: '08:00', status: 'pending', priority: 'high' },
      { id: id(), kind: 'activity', type: 'assignment', title: 'Taller de integrales', subjectId: calc, dueDate: iso(1), dueTime: '23:59', status: 'pending', priority: 'normal' },
      { id: id(), kind: 'activity', type: 'presentation', title: 'Barroco', subjectId: hist, dueDate: iso(5), status: 'pending', priority: 'normal' },
      { id: id(), kind: 'academicDate', type: 'holiday', name: 'Festivo nacional', date: iso(0), yearly: false },
    ];
    const tx = db.transaction('organizer', 'readwrite');
    for (const rec of records) tx.objectStore('organizer').put({ createdAt: stamp, updatedAt: stamp, rev: 1, ...rec }, rec.id);
    await new Promise((resolve) => (tx.oncomplete = resolve));
    db.close();
    location.hash = '#/academico';
    location.reload();
    return true;`);
  await sleep(6000);
  await waitFor(`document.querySelector('.acad-next')`, 30000, 'resumen académico');
  await sleep(2500);
  log('datos académicos sembrados (la instantánea se publica al cargar)');
  shot('03-academico');
}

if (steps.includes('tips')) {
  await go('#/consejos');
  await waitFor(`document.querySelector('.tip-card')`);
  await clickText('.segmented__option', 'Ajustes');
  await sleep(800);
  shot('04-consejos');
}

if (steps.includes('notify')) {
  // Activa las notificaciones de consejos (Android pedirá el permiso: se concede por adb).
  adb('shell', 'pm', 'grant', 'app.lix.web', 'android.permission.POST_NOTIFICATIONS');
  await go('#/consejos');
  await clickText('.segmented__option', 'Ajustes');
  await sleep(500);
  await evaluate(`const label = [...document.querySelectorAll('.switch-row')].find((n) => n.textContent.includes('Notificaciones del sistema')); label.querySelector('[role=switch]').click(); return true;`);
  await sleep(2500);
  log(`notificaciones: ${await evaluate("return window.LixAndroid.notificationPermission();")}`);
}

if (steps.includes('history')) {
  await go('#/consejos');
  await clickText('.segmented__option', 'Historial');
  await waitFor(`document.querySelector('.tip-row')`, 20000, 'historial');
  log(`historial: ${await evaluate("return [...document.querySelectorAll('.tip-row')].slice(0, 2).map((r) => r.querySelector('.tip-row__text').textContent + ' — ' + r.querySelector('.org-subtle').textContent).join(' | ');")}`);
  shot('10-historial');
}

if (steps.includes('settings')) {
  await go('#/ajustes');
  await evaluate(`document.querySelector('#instalacion').scrollIntoView(); return true;`);
  await sleep(800);
  shot('05-ajustes');
}

if (steps.includes('pin')) {
  await go('#/ajustes');
  const kind = process.env.WIDGET ?? 'Consejo del día';
  await clickText('button', `Añadir «${kind}»`);
  await sleep(2500);
  shot(`06-pin-${kind.replace(/\W+/g, '_')}`);
}

console.log('errores JS:', consoleErrors.length ? consoleErrors : 'ninguno');
ws.close();
