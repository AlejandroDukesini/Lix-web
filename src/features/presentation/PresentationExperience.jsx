import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowRight, ChevronDown, RotateCcw, Telescope as TelescopeIcon } from 'lucide-react';
import { usePreferences } from '../../app/providers/PreferencesProvider.jsx';
import { useReducedMotion } from '../../hooks/useReducedMotion.js';
import { Button } from '../../components/common/Button.jsx';
import { NicknameCarousel } from '../../components/presentation/NicknameCarousel.jsx';
import { formatLongDate, relationshipDuration } from '../../utils/dates.js';
import { cx } from '../../utils/cx.js';
import { SkyLayers } from './story/SkyLayers.jsx';
import { CosmosCanvas } from './story/CosmosCanvas.jsx';
import { Constellation } from './story/Constellation.jsx';
import { Telescope } from './story/Telescope.jsx';
import { EyepieceView } from './story/EyepieceView.jsx';
import { useScrollStory } from './story/useScrollStory.js';
import { applyFrame, collectNodes } from './story/applyFrame.js';
import { computeFrame, LOG_NOTES, SCENE_BOUNDS, SCENES, STORY_LENGTH } from './story/timeline.js';
import './astral.css';

/*
 * Bitácora de observación — la presentación de Año Nuevo.
 *
 * Arquitectura de scroll (narrativa persistente):
 *
 *   .astral__track   contenedor alto: (duración del viaje + 1) pantallas.
 *   └─ .astral__stage   escenario `position: sticky; top: 0; height: 100dvh`
 *        ├─ backdrop      capas visuales (cielo, canvas, constelación, telescopio, iris, ocular)
 *        ├─ cabecera      marca, distancia al destino, saltar
 *        ├─ zona visual   celda vacía de la rejilla: su rectángulo define dónde se compone la ilustración
 *        ├─ narrativa     textos de todos los capítulos apilados en la misma celda (siempre visibles en pantalla)
 *        └─ progreso      línea de progreso con los capítulos y el actual
 *
 * El escenario nunca sale de la pantalla mientras dura el viaje; lo que cambia
 * con el desplazamiento es el progreso, que mueve la cámara y los textos.
 * useScrollStory → progreso; computeFrame → estado visual; applyFrame → DOM.
 */

const startDateShort = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric' });
const CHAPTER_SCENES = SCENES.slice(1);

function Caption({ scene, note, children }) {
  return (
    <section
      className={cx('caption', `caption--${scene.id}`)}
      data-caption={scene.id}
      aria-label={`Capítulo ${scene.numeral}: ${scene.title}`}
    >
      <p className="caption__chapter">
        <span className="caption__numeral">{scene.numeral}</span>
        <span className="caption__title">{scene.title}</span>
      </p>
      {children}
      {note && <p className="caption__note">{note}</p>}
    </section>
  );
}

export function PresentationExperience({ mode = 'first', onFinish }) {
  const { preferences } = usePreferences();
  const { texts, candleLetter } = preferences.presentation;
  const { nicknames, rotateNicknames } = preferences.profile;
  const { relationshipStart } = preferences.dates;
  const { style, theme } = preferences.appearance;
  const reduced = useReducedMotion();

  const rootRef = useRef(null);
  const trackRef = useRef(null);
  const stageRef = useRef(null);
  const areaRef = useRef(null);
  const nodesRef = useRef(null);
  const frameRef = useRef(null);
  const cosmosApi = useRef(null);
  const [introStep, setIntroStep] = useState(reduced ? 3 : 0);

  const duration = relationshipDuration(relationshipStart);
  const story = useRef({ totalDays: null, reduced });
  story.current = { totalDays: duration ? duration.totalDays : null, reduced };

  // La presentación empieza siempre desde arriba (también al reproducirla de nuevo).
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
    return () => window.scrollTo(0, 0);
  }, []);

  // Prólogo: con la página quieta, las frases aparecen con pausas narrativas. Si la
  // persona empieza a desplazarse antes, todo el prólogo se muestra y se desvanece con el scroll.
  useEffect(() => {
    if (reduced) {
      setIntroStep(3);
      return undefined;
    }
    const timers = [500, 2600, 4200].map((delay, i) => setTimeout(() => setIntroStep(i + 1), delay));
    const reveal = () => setIntroStep(3);
    window.addEventListener('scroll', reveal, { passive: true, once: true });
    return () => {
      timers.forEach(clearTimeout);
      window.removeEventListener('scroll', reveal);
    };
  }, [reduced]);

  const onFrame = useCallback(({ t, raw, progress, layout }) => {
    const frame = computeFrame(t, layout);
    frameRef.current = frame;
    if (!nodesRef.current && stageRef.current) nodesRef.current = collectNodes(stageRef.current, rootRef.current);
    if (nodesRef.current) {
      applyFrame(nodesRef.current, frame, {
        layout,
        raw,
        progress,
        reduced: story.current.reduced,
        totalDays: story.current.totalDays,
      });
    }
    if (story.current.reduced) cosmosApi.current?.draw();
  }, []);

  const { active, scrollToScene } = useScrollStory({ trackRef, stageRef, areaRef, reduced, onFrame });

  const activeScene = SCENES[active];
  const finalIndex = SCENES.length - 1;
  const startLabel = duration ? startDateShort.format(new Date(`${relationshipStart}T00:00:00`)) : null;
  const todayLabel = duration ? `hoy · ${duration.totalDays.toLocaleString('es')} días` : null;
  const constellationNote = duration ? `Primera estrella anotada: ${formatLongDate(relationshipStart)}.` : null;
  const scenesById = Object.fromEntries(SCENES.map((scene) => [scene.id, scene]));
  const goTo = (index) => scrollToScene(index, index === finalIndex ? 1 : 0.55);

  return (
    <div ref={rootRef} className={cx('astral', reduced && 'is-reduced')} data-scene={activeScene.id} data-intro={introStep}>
      <div ref={trackRef} className="astral__track" style={{ '--story-length': STORY_LENGTH }}>
        <div ref={stageRef} className="astral__stage">
          {/* ---------- Capas visuales (decorativas) ---------- */}
          <div className="astral__backdrop" aria-hidden="true">
            <SkyLayers />
            <CosmosCanvas frameRef={frameRef} apiRef={cosmosApi} reduced={reduced} themeKey={`${style}-${theme}`} />
            <div className="astral__flash" data-flash="" />
            <div className="astral__telescope" data-telescope="">
              <div className="astral__telescope-zoom" data-telescope-zoom="">
                <Telescope />
              </div>
            </div>
            <div className="astral__iris" data-iris="" />
            {/* Sobre el iris: en el capítulo VI la «A» de la constelación reaparece enmarcando el ocular. */}
            <div className="astral__constellation" data-constellation="">
              <Constellation startLabel={startLabel} todayLabel={todayLabel} />
            </div>
            <EyepieceView letter={candleLetter} />
          </div>

          {/* ---------- Cabecera ---------- */}
          <header className="astral__top">
            <span className="astral__brand">
              <TelescopeIcon aria-hidden="true" /> Bitácora<span className="astral__brand-long">&nbsp;de observación</span>
            </span>
            <p className="astral__distance" aria-hidden="true">
              <span className="astral__distance-label">Distancia al destino</span>
              <span data-distance="">13.800.000.000 años luz</span>
            </p>
            <Button variant="ghost" size="sm" onClick={onFinish} className="astral__skip">
              {mode === 'first' ? 'Saltar presentación' : 'Cerrar'}
            </Button>
          </header>

          {/* ---------- Zona visual: su tamaño lo decide el layout ---------- */}
          <div ref={areaRef} className="astral__area" aria-hidden="true" />

          {/* ---------- Prólogo (sobre toda la escena) ---------- */}
          <section className="opening" data-opening="" aria-labelledby="astral-opening-title">
            <h1 id="astral-opening-title" className="opening__line">
              {texts.openingLine}
            </h1>
            <p className="opening__reveal">{texts.openingReveal}</p>
            <p className="opening__dedication">
              Carta estelar para <NicknameCarousel nicknames={nicknames} rotate={rotateNicknames} />
            </p>
            <div className="opening__actions">
              <Button size="lg" icon={TelescopeIcon} onClick={() => scrollToScene(1, 0.35)}>
                Comenzar el viaje
              </Button>
              <span className="opening__cue" aria-hidden="true">
                <span className="opening__cue-line" />
                desliza para viajar
              </span>
            </div>
          </section>

          {/* ---------- Narrativa: todos los textos en la misma celda, en orden de lectura ---------- */}
          <div className="astral__narrative">
            {['stars', 'constellation', 'galaxy', 'telescope', 'eyepiece'].map((id) => {
              const scene = scenesById[id];
              const note = id === 'constellation' ? constellationNote : LOG_NOTES[id];
              return (
                <Caption key={id} scene={scene} note={note}>
                  <h2 className="caption__text">{texts[scene.textKey]}</h2>
                </Caption>
              );
            })}
            <Caption scene={scenesById.candle}>
              <h2 className="caption__text">{texts.candleText}</h2>
              <p className="sr-only">
                En el centro del telescopio hay una vela encendida con la letra {candleLetter} grabada en oro.
              </p>
            </Caption>
            <h2 className="together" data-together="">
              {texts.togetherTitle}
            </h2>
            <section className="finale" data-finale="" aria-label="Capítulo VII: La sorpresa" inert>
              <p className="caption__chapter">
                <span className="caption__numeral">VII</span>
                <span className="caption__title">La sorpresa</span>
              </p>
              <p className="finale__message">{texts.finalMessage}</p>
              <p className="finale__signature">{texts.signature}</p>
              <div className="finale__actions">
                <Button size="lg" iconEnd={ArrowRight} onClick={onFinish}>
                  Entrar a nuestro universo
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={RotateCcw}
                  onClick={() => window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' })}
                >
                  Volver a empezar el viaje
                </Button>
              </div>
            </section>
          </div>

          {/* ---------- Progreso narrativo ---------- */}
          <nav className="astral__progress" aria-label="Capítulos del viaje">
            <p className="astral__current">
              {activeScene.numeral ? (
                <>
                  <span className="astral__current-numeral">{activeScene.numeral}</span> {activeScene.title}
                </>
              ) : (
                'Prólogo'
              )}
            </p>
            <div className="astral__rail">
              <span className="astral__rail-line" aria-hidden="true">
                <span className="astral__rail-fill" data-progress-fill="" />
              </span>
              <ol className="astral__rail-points">
                {CHAPTER_SCENES.map((scene) => {
                  const index = SCENES.indexOf(scene);
                  return (
                    <li key={scene.id} style={{ '--at': SCENE_BOUNDS[index][0] }}>
                      <button
                        type="button"
                        className={cx('astral__point', index === active && 'is-active', index < active && 'is-past')}
                        aria-current={index === active ? 'step' : undefined}
                        aria-label={`Capítulo ${scene.numeral}: ${scene.title}`}
                        onClick={() => goTo(index)}
                      >
                        <span aria-hidden="true">{scene.numeral}</span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
            <button
              type="button"
              className="astral__next"
              onClick={() => goTo(Math.min(active + 1, finalIndex))}
              disabled={active === finalIndex}
            >
              <span className="sr-only">Siguiente capítulo</span>
              <ChevronDown aria-hidden="true" />
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
}
