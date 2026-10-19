import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Crosshair, Grid3x3, Minus, Plus, Spline, Sun, Tags, Waves, X } from 'lucide-react';
import { Button, IconButton } from '../../../../components/common/Button.jsx';
import { Dialog } from '../../../../components/common/Dialog.jsx';
import { GameHUD } from '../../components/GameHUD.jsx';
import { ControlsHint } from '../../components/TouchControls.jsx';
import { useCanvas } from '../../hooks/useCanvas.js';
import { useGameLoop } from '../../hooks/useGameLoop.js';
import { useGameSession } from '../../hooks/useGameSession.js';
import { useGameRecord } from '../../hooks/useGameStatistics.js';
import { useGameAudio } from '../../hooks/useGameAudio.js';
import { useGameFrame } from '../../hooks/useGameFrame.js';
import { useKeyboard } from '../../hooks/useKeyboard.js';
import { updateGameSettings } from '../../services/gameStorage.js';
import { usePreferences } from '../../../../app/providers/PreferencesProvider.jsx';
import { useReducedMotion } from '../../../../hooks/useReducedMotion.js';
import { daysBetween, formatLongDate, parseISODate } from '../../../../utils/dates.js';
import { cx } from '../../../../utils/cx.js';
import { CONSTELLATIONS, DEEP_SKY, SPECTRAL, TYPE_LABELS, constellationById } from './data/catalog.js';
import { ASTERISM } from './data/asterism.js';
import { DISCOVERABLE_TOTAL, EYEPIECE_FOV, FRAMES, SELECTABLE, angularDistance, createView, isIdentified, lerpView, moonPhase, pan, pickAt, sunOnDate, zoom } from './engine/sky.js';
import { renderSky } from './engine/skyRenderer.js';
import './styles/stellarium.css';

const GAME_ID = 'stellarium';
const DEFAULT_TOGGLES = Object.freeze({ milky: true, labels: true, grid: false, allLines: false });
const SFX = {
  select: { wave: 'sine', from: 880, to: 1100, dur: 0.08, gain: 0.04 },
  discover: [
    { wave: 'sine', from: 523, dur: 0.18, gain: 0.07 },
    { wave: 'sine', from: 784, dur: 0.22, gain: 0.07, delay: 0.12 },
    { wave: 'sine', from: 1046, dur: 0.4, gain: 0.06, delay: 0.24 },
  ],
};

const fmtDist = (ly) => {
  if (ly === null || ly === undefined) return 'Incierta';
  if (ly >= 1_000_000) return `≈ ${(ly / 1_000_000).toLocaleString('es', { maximumFractionDigits: 1 })} millones de años luz`;
  return `${ly < 100 ? '' : '≈ '}${ly.toLocaleString('es')} años luz`;
};
const fmtRa = (h) => `${Math.floor(h)} h ${String(Math.round((h % 1) * 60)).padStart(2, '0')} min`;
const fmtDec = (d) => `${d >= 0 ? '+' : '−'}${Math.abs(d).toFixed(1).replace('.', ',')}°`;

/** Ficha del objeto seleccionado. */
function InfoCard({ object, startISO, onCenter, onClose }) {
  if (object.kind === 'asterism') {
    const start = parseISODate(startISO);
    const days = start ? daysBetween(start, new Date()) : null;
    return (
      <aside className="st-card is-personal" aria-live="polite">
        <header>
          <p className="eyebrow">{TYPE_LABELS.asterism}</p>
          <h3>Nosotros</h3>
          <IconButton icon={X} label="Cerrar ficha" size="sm" onClick={onClose} />
        </header>
        <p>Cinco estrellas en Erídano que no figuran en ningún catálogo: las mismas de la presentación, la línea del tiempo que forma una «A».</p>
        <dl>
          {start && (
            <div>
              <dt>Primera estrella</dt>
              <dd>{formatLongDate(start)}</dd>
            </div>
          )}
          {days !== null && days >= 0 && (
            <div>
              <dt>Recorrido</dt>
              <dd>{days.toLocaleString('es')} días, hasta hoy</dd>
            </div>
          )}
          <div>
            <dt>Magnitud</dt>
            <dd>incalculable</dd>
          </div>
          <div>
            <dt>Distancia</dt>
            <dd>aquí</dd>
          </div>
        </dl>
      </aside>
    );
  }
  const con = object.con ? constellationById.get(object.con) : null;
  return (
    <aside className="st-card" aria-live="polite">
      <header>
        <p className="eyebrow">{object.kind === 'dso' ? `${TYPE_LABELS[object.type]} · ${object.short}` : TYPE_LABELS.star}</p>
        <h3>{object.name}</h3>
        <IconButton icon={X} label="Cerrar ficha" size="sm" onClick={onClose} />
      </header>
      {object.note && <p>{object.note}</p>}
      <dl>
        {con && (
          <div>
            <dt>Constelación</dt>
            <dd>{con.name}</dd>
          </div>
        )}
        <div>
          <dt>Magnitud</dt>
          <dd>{object.mag.toLocaleString('es')}</dd>
        </div>
        <div>
          <dt>Distancia</dt>
          <dd>{fmtDist(object.dist)}</dd>
        </div>
        {object.spec && (
          <div>
            <dt>Color</dt>
            <dd>{SPECTRAL[object.spec].label}</dd>
          </div>
        )}
        <div>
          <dt>Posición</dt>
          <dd>
            AR {fmtRa(object.ra)} · Dec {fmtDec(object.dec)}
          </dd>
        </div>
      </dl>
      <Button variant="secondary" size="sm" icon={Crosshair} onClick={onCenter}>
        Centrar con el telescopio
      </Button>
    </aside>
  );
}

function Logbook({ found, onGo }) {
  return (
    <div className="st-log">
      <p className="st-log__intro">
        Una constelación queda registrada cuando la centras en la retícula y cabe entera en la vista. Los objetos de cielo profundo, al
        seleccionarlos.
      </p>
      <h3>Constelaciones · {CONSTELLATIONS.filter((c) => found.has(c.id)).length}/{CONSTELLATIONS.length}</h3>
      <ul>
        {CONSTELLATIONS.map((c) => (
          <li key={c.id} className={cx(found.has(c.id) && 'is-found')}>
            <span aria-hidden="true">{found.has(c.id) ? '★' : '☆'}</span>
            <div>
              <strong>{found.has(c.id) ? c.name : 'Sin identificar'}</strong>
              <small>{found.has(c.id) ? c.blurb : `Pista: ${c.hint}`}</small>
            </div>
            {found.has(c.id) && (
              <Button variant="ghost" size="sm" onClick={() => onGo(FRAMES.get(c.id), c.name)}>
                Ir
              </Button>
            )}
          </li>
        ))}
      </ul>
      <h3>Cielo profundo · {DEEP_SKY.filter((o) => found.has(o.id)).length}/{DEEP_SKY.length}</h3>
      <ul>
        {DEEP_SKY.map((o) => (
          <li key={o.id} className={cx(found.has(o.id) && 'is-found')}>
            <span aria-hidden="true">{found.has(o.id) ? '★' : '☆'}</span>
            <div>
              <strong>{found.has(o.id) ? `${o.name} (${o.short})` : `${TYPE_LABELS[o.type]} sin observar`}</strong>
              <small>{found.has(o.id) ? o.note : o.id === 'm31' ? 'Pista: junto a Mirach, en Andrómeda.' : o.id === 'm42' ? 'Pista: bajo el cinturón de Orión.' : 'Pista: sobre el lomo de Tauro.'}</small>
            </div>
            {found.has(o.id) && (
              <Button variant="ghost" size="sm" onClick={() => onGo({ ra: o.ra, dec: o.dec, radius: 4 }, o.name)}>
                Ir
              </Button>
            )}
          </li>
        ))}
      </ul>
      <h3>Fuera de catálogo</h3>
      <ul>
        <li className={cx(found.has(ASTERISM.id) && 'is-found is-personal')}>
          <span aria-hidden="true">{found.has(ASTERISM.id) ? '♥' : '☆'}</span>
          <div>
            <strong>{found.has(ASTERISM.id) ? 'Nosotros' : 'Cinco estrellas cálidas'}</strong>
            <small>{found.has(ASTERISM.id) ? 'Asterismo personal. No figura en ningún catálogo.' : 'Pista: al sur de Tauro, en Erídano (hacia las 3 h y media, −19°). Céntralas.'}</small>
          </div>
          {found.has(ASTERISM.id) && (
            <Button variant="ghost" size="sm" onClick={() => onGo(ASTERISM.center, 'Nosotros', ASTERISM.radius)}>
              Ir
            </Button>
          )}
        </li>
      </ul>
    </div>
  );
}

/** El cielo de la fecha de inicio configurada (nunca se inventa una fecha). */
function useOurDay(startISO) {
  return useMemo(() => {
    const start = parseISODate(startISO);
    if (!start) return null;
    const noon = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 12);
    const sun = sunOnDate(noon);
    const moon = moonPhase(noon);
    return { date: start, sun, moon };
  }, [startISO]);
}

/** Stellarium: un pequeño observatorio para explorar el cielo. */
export default function Stellarium() {
  const frame = useGameFrame();
  const record = useGameRecord(GAME_ID);
  const session = useGameSession(GAME_ID, { autoPause: false });
  const audio = useGameAudio();
  const reduced = useReducedMotion();
  const { preferences } = usePreferences();
  const startISO = preferences.dates?.relationshipStart ?? null;
  const ourDay = useOurDay(startISO);

  const sky = useRef({ view: createView(), toggles: { ...DEFAULT_TOGGLES }, found: new Set(), selected: null, sun: null, flash: null, reduced });
  const [hud, setHud] = useState({ fov: sky.current.view.fov, found: 0 });
  const [toggles, setToggles] = useState(DEFAULT_TOGGLES);
  const [selected, setSelected] = useState(null);
  const [notice, setNotice] = useState(null);
  const [logOpen, setLogOpen] = useState(false);
  const [showDay, setShowDay] = useState(false);
  const [found, setFound] = useState(() => new Set());
  const fly = useRef(null);
  const pointers = useRef(new Map());
  const gesture = useRef(null);
  const noticeTimer = useRef(null);
  const hudClock = useRef(0);
  const checkClock = useRef(0);
  const loaded = useRef(false);
  sky.current.reduced = reduced;

  const draw = useCallback((dt = 0) => renderSky(ctxRef.current, sizeRef.current, sky.current, dt), []);
  const { canvasRef, ctxRef, sizeRef } = useCanvas(() => draw(0));

  const { start, saveProgress } = session;
  useEffect(() => {
    start();
  }, [start]);
  useEffect(() => () => clearTimeout(noticeTimer.current), []);

  // Al cargar el registro: lo ya descubierto, los interruptores y la última vista.
  useEffect(() => {
    if (!record || loaded.current) return;
    loaded.current = true;
    const saved = new Set(Object.keys(record.progress?.found ?? {}));
    sky.current.found = saved;
    setFound(new Set(saved));
    const t = { ...DEFAULT_TOGGLES, ...(record.settings?.toggles ?? {}) };
    sky.current.toggles = t;
    setToggles(t);
    if (record.settings?.view) sky.current.view = createView(record.settings.view);
    setHud({ fov: sky.current.view.fov, found: saved.size });
    draw(0);
  }, [record, draw]);

  // Guardar la vista y los interruptores al salir.
  useEffect(
    () => () => {
      const { ra, dec, fov } = sky.current.view;
      updateGameSettings(GAME_ID, { view: { ra, dec, fov }, toggles: sky.current.toggles }).catch(() => {});
      sky.current.sprites?.clear();
    },
    [],
  );

  const announce = useCallback((title, text) => {
    setNotice({ title, text });
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 4200);
  }, []);

  const discover = useCallback(
    (id, title, text) => {
      if (sky.current.found.has(id)) return;
      sky.current.found.add(id);
      sky.current.flash = { id, until: sky.current.time + 2.5 };
      const next = new Set(sky.current.found);
      setFound(next);
      setHud((h) => ({ ...h, found: next.size }));
      audio.play(SFX.discover);
      announce(title, text);
      saveProgress({
        progress: (p) => ({
          ...p,
          found: { ...(p.found ?? {}), [id]: true },
          complete: next.size >= DISCOVERABLE_TOTAL,
        }),
      });
    },
    [audio, announce, saveProgress],
  );

  const observe = useCallback(
    (object) => {
      setSelected(object);
      sky.current.selected = object;
      if (!object) return;
      audio.play(SFX.select);
      if (object.kind === 'dso') discover(object.id, `${object.name} observada`, object.note);
      if (object.kind === 'star') saveProgress({ progress: (p) => ({ ...p, observed: { ...(p.observed ?? {}), [object.id]: true } }) });
    },
    [audio, discover, saveProgress],
  );

  const flyTo = useCallback((target, fov) => {
    fly.current = { from: { ...sky.current.view }, to: createView({ ra: target.ra, dec: target.dec, fov: fov ?? sky.current.view.fov }), t: 0 };
  }, []);

  const goToFrame = useCallback(
    (f, name, radius) => {
      setLogOpen(false);
      flyTo(f, Math.min(90, Math.max(20, (radius ?? f.radius) * 2.6)));
      announce('Rumbo fijado', `Hacia ${name}.`);
    },
    [flyTo, announce],
  );

  // Comprueba qué se reconoce con la vista actual.
  const checkDiscoveries = useCallback(() => {
    const v = sky.current.view;
    for (const con of CONSTELLATIONS) {
      if (!sky.current.found.has(con.id) && isIdentified(v, FRAMES.get(con.id))) discover(con.id, `${con.name} identificada`, con.blurb);
    }
    if (!sky.current.found.has(ASTERISM.id) && isIdentified(v, { ...ASTERISM.center, radius: ASTERISM.radius })) {
      discover(ASTERISM.id, 'Un asterismo fuera de catálogo', 'Cinco estrellas que forman una «A». Se llama «Nosotros».');
      observe({ ...ASTERISM, ra: ASTERISM.center.ra, dec: ASTERISM.center.dec });
    }
    for (const o of DEEP_SKY) {
      if (!sky.current.found.has(o.id) && v.fov <= 40 && angularDistance(v.ra, v.dec, o.ra, o.dec) < Math.max(2, v.fov * 0.08)) discover(o.id, `${o.name} observada`, o.note);
    }
  }, [discover, observe]);

  const keys = useKeyboard({
    active: !logOpen && !frame.interrupted,
    onAction: (action) => {
      if (action === 'pause') observe(null);
    },
  });

  useEffect(() => {
    if (logOpen) return undefined;
    const onKey = (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === '+' || event.key === '=') applyView(zoom(sky.current.view, 0.85));
      else if (event.key === '-' || event.key === '_') applyView(zoom(sky.current.view, 1.18));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const applyView = (v) => {
    fly.current = null;
    sky.current.view = v;
  };

  useGameLoop(
    (dt) => {
      const s = sky.current;
      const pressed = keys.current;
      if (pressed.size) {
        const { width, height } = sizeRef.current;
        const step = 260 * dt;
        let v = s.view;
        if (pressed.has('left')) v = pan(v, step, 0, width, height);
        if (pressed.has('right')) v = pan(v, -step, 0, width, height);
        if (pressed.has('up')) v = pan(v, 0, step, width, height);
        if (pressed.has('down')) v = pan(v, 0, -step, width, height);
        applyView(v);
      }
      if (fly.current) {
        const f = fly.current;
        f.t = Math.min(1, f.t + dt / (reduced ? 0.01 : 1.4));
        s.view = lerpView(f.from, f.to, f.t);
        if (f.t >= 1) fly.current = null;
      }
      if (s.flash && s.time > s.flash.until) s.flash = null;
      checkClock.current += dt;
      if (checkClock.current > 0.25) {
        checkClock.current = 0;
        checkDiscoveries();
      }
      hudClock.current += dt;
      if (hudClock.current > 0.15) {
        hudClock.current = 0;
        setHud((h) => (Math.abs(h.fov - s.view.fov) > 0.4 ? { ...h, fov: s.view.fov } : h));
      }
      draw(dt);
    },
    !frame.interrupted && !logOpen,
  );

  useEffect(() => {
    sky.current.sun = showDay && ourDay ? { ra: ourDay.sun.ra, dec: ourDay.sun.dec, label: `El Sol · ${formatLongDate(ourDay.date)}` } : null;
    draw(0);
  }, [showDay, ourDay, draw]);

  const setToggle = (key) => {
    const next = { ...sky.current.toggles, [key]: !sky.current.toggles[key] };
    sky.current.toggles = next;
    setToggles(next);
    draw(0);
  };

  // --- Gestos: arrastrar (girar el cielo), pellizcar o rueda (aumento), tocar (seleccionar).
  const handlers = {
    onPointerDown: (event) => {
      if (event.target.closest?.('button, a, [data-no-gesture]')) return;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      fly.current = null;
      if (pointers.current.size === 1) gesture.current = { x: event.clientX, y: event.clientY, at: performance.now(), moved: 0 };
      else if (pointers.current.size === 2) {
        const [a, b] = [...pointers.current.values()];
        gesture.current = { pinch: Math.hypot(a.x - b.x, a.y - b.y), fov: sky.current.view.fov, moved: 99 };
      }
    },
    onPointerMove: (event) => {
      const prev = pointers.current.get(event.pointerId);
      if (!prev) return;
      const cur = { x: event.clientX, y: event.clientY };
      pointers.current.set(event.pointerId, cur);
      const { width, height } = sizeRef.current;
      if (pointers.current.size >= 2 && gesture.current?.pinch) {
        const [a, b] = [...pointers.current.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        applyView(createView({ ...sky.current.view, fov: gesture.current.fov * (gesture.current.pinch / Math.max(20, d)) }));
      } else if (gesture.current && !gesture.current.pinch) {
        const dx = cur.x - prev.x;
        const dy = cur.y - prev.y;
        gesture.current.moved += Math.abs(dx) + Math.abs(dy);
        applyView(pan(sky.current.view, dx, dy, width, height));
      }
    },
    onPointerUp: (event) => {
      const g = gesture.current;
      pointers.current.delete(event.pointerId);
      if (pointers.current.size > 0) return;
      gesture.current = null;
      if (g && !g.pinch && g.moved < 8 && performance.now() - g.at < 400) {
        const rect = event.currentTarget.getBoundingClientRect();
        const { width, height } = sizeRef.current;
        const px = event.clientX - rect.left;
        const py = event.clientY - rect.top;
        const astPick = pickAt(sky.current.view, width, height, px, py, Object.values(ASTERISM.stars), 20);
        if (astPick) {
          if (sky.current.found.has(ASTERISM.id)) observe({ ...ASTERISM, ra: ASTERISM.center.ra, dec: ASTERISM.center.dec });
          else announce('Una estrella sin nombre', 'Tenue y cálida, con cuatro compañeras cerca. Céntralas en la retícula para ver qué forman.');
          return;
        }
        observe(pickAt(sky.current.view, width, height, px, py, SELECTABLE));
      }
    },
    onPointerCancel: (event) => {
      pointers.current.delete(event.pointerId);
      gesture.current = null;
    },
    onWheel: (event) => {
      applyView(zoom(sky.current.view, event.deltaY > 0 ? 1.1 : 0.9));
    },
  };

  const constellationsFound = CONSTELLATIONS.filter((c) => found.has(c.id)).length;
  const eyepiece = hud.fov < EYEPIECE_FOV;
  const sunCon = ourDay?.sun.constellation;

  return (
    <div className={cx('game-stage', 'st')} {...handlers}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`Cielo nocturno. Campo de visión de ${Math.round(hud.fov)} grados. ${constellationsFound} de ${CONSTELLATIONS.length} constelaciones identificadas.`}
      />
      <GameHUD
        items={[
          { id: 'con', label: 'Figuras', value: `${constellationsFound}/${CONSTELLATIONS.length}` },
          { id: 'found', label: 'Hallazgos', value: `${hud.found}/${DISCOVERABLE_TOTAL}` },
          { id: 'fov', label: eyepiece ? 'Ocular' : 'Campo', value: `${Math.round(hud.fov)}°` },
        ]}
      >
        <Button variant="secondary" size="sm" icon={BookOpen} onClick={() => setLogOpen(true)} className="st-logbtn">
          Bitácora
        </Button>
      </GameHUD>

      {notice && (
        <div className="st-notice" role="status">
          <strong>{notice.title}</strong>
          <span>{notice.text}</span>
        </div>
      )}

      {selected && <InfoCard object={selected} startISO={startISO} onClose={() => observe(null)} onCenter={() => flyTo(selected, Math.min(sky.current.view.fov, 30))} />}

      {showDay && ourDay && (
        <aside className="st-day" data-no-gesture aria-live="polite">
          <header>
            <p className="eyebrow">El cielo de nuestro día</p>
            <IconButton icon={X} label="Cerrar" size="sm" onClick={() => setShowDay(false)} />
          </header>
          <h3>{formatLongDate(ourDay.date)}</h3>
          <p>
            El Sol estaba frente a <strong>{sunCon.name}</strong>
            {sunCon.borderWith ? `, muy cerca del límite con ${sunCon.borderWith}` : ''}. Lo marca el círculo dorado sobre la eclíptica.
          </p>
          <p>
            La Luna: <strong>{ourDay.moon.name.toLowerCase()}</strong>, iluminada en un {Math.round(ourDay.moon.illumination * 100)} %.
          </p>
          <p className="st-day__note">Calculado para ese día a mediodía; no depende del lugar desde el que se mire.</p>
          <Button size="sm" variant="secondary" icon={Crosshair} onClick={() => flyTo(ourDay.sun, 50)}>
            Ver dónde estaba el Sol
          </Button>
        </aside>
      )}

      <div className="st-toolbar" data-no-gesture role="toolbar" aria-label="Telescopio">
        <IconButton icon={Minus} label="Alejar (−)" onClick={() => applyView(zoom(sky.current.view, 1.25))} />
        <IconButton icon={Plus} label="Acercar (+)" onClick={() => applyView(zoom(sky.current.view, 0.8))} />
        <span className="st-toolbar__sep" aria-hidden="true" />
        <IconButton icon={Spline} label="Mostrar todas las figuras" aria-pressed={toggles.allLines} className={cx(toggles.allLines && 'is-on')} onClick={() => setToggle('allLines')} />
        <IconButton icon={Tags} label="Nombres" aria-pressed={toggles.labels} className={cx(toggles.labels && 'is-on')} onClick={() => setToggle('labels')} />
        <IconButton icon={Grid3x3} label="Cuadrícula y eclíptica" aria-pressed={toggles.grid} className={cx(toggles.grid && 'is-on')} onClick={() => setToggle('grid')} />
        <IconButton icon={Waves} label="Vía Láctea" aria-pressed={toggles.milky} className={cx(toggles.milky && 'is-on')} onClick={() => setToggle('milky')} />
        {ourDay && <IconButton icon={Sun} label="El cielo de nuestro día" aria-pressed={showDay} className={cx(showDay && 'is-on')} onClick={() => setShowDay((v) => !v)} />}
      </div>

      <ControlsHint touch="Arrastra para mover el cielo · pellizca para acercar · toca una estrella" desktop="Arrastra o usa las flechas · rueda o +/− para el aumento · clic en una estrella" />

      <Dialog open={logOpen} title="Bitácora de observación" onClose={() => setLogOpen(false)} size="lg">
        <Logbook found={found} onGo={goToFrame} />
      </Dialog>
    </div>
  );
}
