import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Download, FileText, Flower2, ImagePlus, Pause, Play, RotateCcw, Save, Shuffle, Sprout, X } from 'lucide-react';
import { Button } from '../../components/common/Button.jsx';
import { SegmentedControl } from '../../components/common/SegmentedControl.jsx';
import { useToast } from '../../components/feedback/ToastProvider.jsx';
import { useReducedMotion } from '../../hooks/useReducedMotion.js';
import { readJSON, writeJSON } from '../../services/storage/safeLocalStorage.js';
import { cx } from '../../utils/cx.js';
import { ModuleLayout, Section } from '../organizer/shared/ui.jsx';
import { CreationGallery } from '../studio/shared/CreationGallery.jsx';
import { downloadBlob, saveCreation, slugify } from '../studio/shared/creations.js';
import { AsciiPlayer } from './AsciiPlayer.jsx';
import { buildAnimation, exportGif, getEngineState, startPython, subscribeEngine } from './engine/pythonEngine.js';
import {
  BACKGROUNDS,
  CHARSETS,
  DEFAULT_FPS,
  EFFECTS,
  FPS_RANGE,
  frameToText,
  sanitizeStoredSpec,
  SIZES,
  TEMPLATES,
  THEMES,
  validateImageFile,
  validateImageSize,
} from './flowersOptions.js';
import '../organizer/shared/organizer.css';
import '../studio/shared/studio.css';
import './flowers.css';

const STORAGE_KEY = 'lix:flowers:last';
const FLOWER_ORIGINS = ['flowers'];
const STAGES = {
  idle: 'Python aún no se ha iniciado.',
  runtime: 'Preparando Python 3.14 en tu dispositivo… (la primera vez tarda unos segundos)',
  packages: 'Instalando Pillow desde los archivos de la app…',
  ready: null,
  error: null,
};

function useEngine() {
  return useSyncExternalStore(subscribeEngine, getEngineState, getEngineState);
}

function ImagePicker({ image, onPick, onClear, error }) {
  const id = useId();
  const [dragging, setDragging] = useState(false);
  const pick = (file) => file && onPick(file);
  return (
    <div className="flowers-picker">
      {image ? (
        <figure className="flowers-picker__preview">
          <img src={image.url} alt={`Vista previa de ${image.name}`} />
          <figcaption>
            <span className="flowers-picker__name">{image.name}</span>
            <span className="org-subtle">
              {image.width} × {image.height} px · {image.size < 1024 * 1024 ? `${Math.max(1, Math.round(image.size / 1024))} KB` : `${(image.size / 1024 / 1024).toFixed(1)} MB`}
            </span>
          </figcaption>
          <Button variant="ghost" size="sm" icon={X} onClick={onClear}>
            Quitar
          </Button>
        </figure>
      ) : (
        <label
          htmlFor={id}
          className={cx('flowers-drop', dragging && 'is-dragging')}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            pick(event.dataTransfer.files?.[0]);
          }}
        >
          <ImagePlus aria-hidden="true" />
          <span className="flowers-drop__title">Elige una foto de flores</span>
          <span className="org-subtle">PNG, JPG o WEBP · hasta 12 MB. No sale de tu dispositivo.</span>
        </label>
      )}
      <input
        id={id}
        type="file"
        accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
        className="sr-only"
        onChange={(event) => {
          pick(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      {image && (
        <label htmlFor={id} className="btn btn--secondary btn--sm flowers-picker__change">
          <ImagePlus className="btn__icon" aria-hidden="true" />
          <span className="btn__label">Cambiar imagen</span>
        </label>
      )}
      {error && (
        <p className="field__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function Swatches({ label, options, value, onChange, extra }) {
  const name = useId();
  return (
    <fieldset className="flowers-swatches">
      <legend>{label}</legend>
      <div className="flowers-swatches__list">
        {options.map((option) => (
          <label key={option.value} className={cx('flowers-swatch', value === option.value && 'is-checked')} title={option.label}>
            <input type="radio" className="sr-only" name={name} checked={value === option.value} onChange={() => onChange(option.value)} />
            <span className="flowers-swatch__chip" aria-hidden="true" style={{ background: option.swatch ? `linear-gradient(135deg, ${option.swatch.join(', ')})` : option.value }} />
            <span className="flowers-swatch__label">{option.label}</span>
          </label>
        ))}
        {extra}
      </div>
    </fieldset>
  );
}

export default function FlowersPage() {
  const engine = useEngine();
  const { toast } = useToast();
  const reducedMotion = useReducedMotion();
  const [spec, setSpec] = useState(() => sanitizeStoredSpec(readJSON(STORAGE_KEY)?.value));
  const [fps, setFps] = useState(DEFAULT_FPS);
  const [playing, setPlaying] = useState(!reducedMotion);
  const [restartKey, setRestartKey] = useState(0);
  const [animation, setAnimation] = useState(null);
  const [building, setBuilding] = useState(false);
  const [buildError, setBuildError] = useState(null);
  const [elapsed, setElapsed] = useState(null);
  const [image, setImage] = useState(null); // { name, size, width, height, url, buffer }
  const [imageError, setImageError] = useState(null);
  const [saving, setSaving] = useState(false);
  const frameRef = useRef(0);
  const requestRef = useRef(0);
  const templateName = useId();

  useEffect(() => {
    document.title = 'Lix Flowers · Animaciones';
    startPython().catch(() => {});
  }, []);

  useEffect(() => {
    writeJSON(STORAGE_KEY, { ...spec, source: 'template' });
  }, [spec]);

  useEffect(() => () => image?.url && URL.revokeObjectURL(image.url), [image]);

  const effectiveSpec = useMemo(() => {
    const next = { ...spec };
    if (next.source === 'template' && next.colors === 'original') next.colors = 'jardin';
    return next;
  }, [spec]);

  // Cada cambio vuelve a generar en Python (con una pequeña espera para no encolar trabajo al arrastrar).
  useEffect(() => {
    if (engine.stage !== 'ready') return undefined;
    if (effectiveSpec.source === 'image' && !image) {
      setAnimation(null);
      return undefined;
    }
    const ticket = ++requestRef.current;
    const timer = setTimeout(async () => {
      setBuilding(true);
      setBuildError(null);
      const started = performance.now();
      try {
        const result = await buildAnimation(effectiveSpec, effectiveSpec.source === 'image' ? image.buffer : null);
        if (ticket !== requestRef.current) return;
        setAnimation(result);
        setElapsed(Math.round(performance.now() - started));
      } catch (error) {
        if (ticket !== requestRef.current) return;
        setBuildError(error.message);
        if (effectiveSpec.source === 'image') setImageError(error.message);
      } finally {
        if (ticket === requestRef.current) setBuilding(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [effectiveSpec, image, engine.stage]);

  const update = useCallback((patch) => setSpec((current) => ({ ...current, ...patch })), []);

  const pickImage = async (file) => {
    setImageError(null);
    const problem = validateImageFile(file);
    if (problem) {
      setImageError(problem);
      return;
    }
    try {
      const bitmap = await createImageBitmap(file);
      const sizeProblem = validateImageSize(bitmap.width, bitmap.height);
      const { width, height } = bitmap;
      bitmap.close?.();
      if (sizeProblem) {
        setImageError(sizeProblem);
        return;
      }
      const buffer = await file.arrayBuffer();
      setImage({ name: file.name, size: file.size, width, height, url: URL.createObjectURL(file), buffer });
      update({ source: 'image', colors: spec.colors === 'jardin' ? 'original' : spec.colors });
    } catch {
      setImageError('No se pudo leer la imagen. ¿Está dañada?');
    }
  };

  const title = effectiveSpec.source === 'image' ? `${image?.name.replace(/\.[^.]+$/, '') ?? 'Imagen'} · ${EFFECTS.find((e) => e.value === effectiveSpec.effect)?.label}` : TEMPLATES.find((t) => t.id === effectiveSpec.template)?.label;

  const save = async () => {
    setSaving(true);
    try {
      const gif = await exportGif(fps);
      await saveCreation(gif, { origin: 'flowers', title, params: { ...effectiveSpec, fps }, width: animation.cols, height: animation.rows });
      toast({ message: 'Guardada en tu herbario' });
    } catch (error) {
      toast({ tone: 'error', message: error.message });
    } finally {
      setSaving(false);
    }
  };

  const downloadGif = async () => {
    setSaving(true);
    try {
      downloadBlob(await exportGif(fps), `lix-flowers-${slugify(title)}.gif`);
    } catch (error) {
      toast({ tone: 'error', message: error.message });
    } finally {
      setSaving(false);
    }
  };

  const downloadText = () => {
    downloadBlob(new Blob([frameToText(animation, frameRef.current)], { type: 'text/plain;charset=utf-8' }), `lix-flowers-${slugify(title)}.txt`);
  };

  const status = STAGES[engine.stage];
  const ready = engine.stage === 'ready';

  return (
    <ModuleLayout
      className="flowers-page"
      eyebrow="Taller creativo"
      title="Lix Flowers — Animaciones"
      description="Flores hechas de caracteres. Python las dibuja aquí mismo, en tu dispositivo, sin Internet."
    >
      <div className="flowers-layout">
        <section className="flowers-stage" aria-label="Animación">
          {status && (
            <p className="flowers-status" role="status">
              <Sprout aria-hidden="true" className="flowers-status__icon" />
              {status}
            </p>
          )}
          {engine.stage === 'error' && (
            <div className="org-banner org-banner--warning" role="alert">
              <p>{engine.error} Lix Flowers necesita WebAssembly (Chrome, Edge, Safari y Firefox actuales lo tienen).</p>
              <Button size="sm" variant="secondary" onClick={() => startPython().catch(() => {})}>
                Reintentar
              </Button>
            </div>
          )}
          {animation ? (
            <AsciiPlayer animation={animation} fps={fps} playing={playing} restartKey={restartKey} frameRef={frameRef} label={`Animación ASCII: ${title}`} />
          ) : (
            ready &&
            !building && (
              <div className="flowers-placeholder">
                <Flower2 aria-hidden="true" />
                <p>{effectiveSpec.source === 'image' ? 'Elige una imagen para empezar.' : 'Elige una plantilla.'}</p>
              </div>
            )
          )}
          {buildError && effectiveSpec.source === 'template' && (
            <p className="field__error" role="alert">
              {buildError}
            </p>
          )}

          <div className="flowers-transport">
            <Button variant="secondary" size="sm" icon={playing ? Pause : Play} onClick={() => setPlaying((p) => !p)} disabled={!animation} aria-pressed={playing}>
              {playing ? 'Pausar' : 'Reproducir'}
            </Button>
            <Button variant="ghost" size="sm" icon={RotateCcw} onClick={() => setRestartKey((k) => k + 1)} disabled={!animation}>
              Reiniciar
            </Button>
            <label className="flowers-range">
              <span>Velocidad</span>
              <input type="range" min={FPS_RANGE[0]} max={FPS_RANGE[1]} value={fps} onChange={(event) => setFps(Number(event.target.value))} />
              <output>{fps} fps</output>
            </label>
          </div>

          <div className="flowers-actions">
            <Button icon={Save} onClick={save} disabled={!animation || saving || building}>
              Guardar en el herbario
            </Button>
            <Button variant="secondary" icon={Download} onClick={downloadGif} disabled={!animation || saving || building}>
              Descargar GIF
            </Button>
            <Button variant="ghost" icon={FileText} onClick={downloadText} disabled={!animation}>
              Texto (.txt)
            </Button>
          </div>

          <p className="flowers-proof" aria-live="polite">
            {building
              ? 'Python está dibujando…'
              : animation
                ? `Generado con Python ${engine.version ? `(Pyodide ${engine.version})` : ''} y Pillow · ${animation.cols} × ${animation.rows} caracteres · ${animation.frames.length} fotogramas · ${elapsed} ms`
                : ' '}
          </p>
        </section>

        <section className="flowers-controls" aria-label="Ajustes de la animación">
          <SegmentedControl
            label="Origen"
            value={effectiveSpec.source}
            onChange={(source) => update({ source, colors: source === 'template' && spec.colors === 'original' ? 'jardin' : spec.colors })}
            options={[
              { value: 'template', label: 'Plantilla' },
              { value: 'image', label: 'Mi imagen' },
            ]}
          />

          {effectiveSpec.source === 'template' ? (
            <fieldset className="flowers-templates">
              <legend>Plantilla</legend>
              <div className="flowers-templates__grid">
                {TEMPLATES.map((template) => (
                  <label key={template.id} className={cx('flowers-template', effectiveSpec.template === template.id && 'is-checked')}>
                    <input type="radio" className="sr-only" name={templateName} checked={effectiveSpec.template === template.id} onChange={() => update({ template: template.id })} />
                    <pre aria-hidden="true">{template.art.join('\n')}</pre>
                    <span>{template.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : (
            <>
              <ImagePicker image={image} onPick={pickImage} onClear={() => setImage(null)} error={imageError} />
              <SegmentedControl label="Animación" layout="cards" value={effectiveSpec.effect} onChange={(effect) => update({ effect })} options={EFFECTS} />
            </>
          )}

          <Swatches
            label="Colores"
            value={effectiveSpec.colors}
            onChange={(colors) => update({ colors })}
            options={[...(effectiveSpec.source === 'image' ? [{ value: 'original', label: 'Originales', swatch: ['#888', '#c55', '#5a5'] }] : []), ...THEMES, { value: 'mono', label: 'Un color', swatch: [effectiveSpec.mono, effectiveSpec.mono] }]}
            extra={
              effectiveSpec.colors === 'mono' && (
                <label className="flowers-swatch flowers-swatch--input">
                  <input type="color" value={effectiveSpec.mono} onChange={(event) => update({ mono: event.target.value })} />
                  <span className="flowers-swatch__label">Elegir</span>
                </label>
              )
            }
          />

          <details className="flowers-more">
            <summary>Más ajustes</summary>
            <SegmentedControl label="Tamaño" value={effectiveSpec.cols} onChange={(cols) => update({ cols })} options={SIZES} />
            <SegmentedControl label="Cantidad de caracteres" value={effectiveSpec.charset} onChange={(charset) => update({ charset })} options={CHARSETS} />
            <label className="flowers-range flowers-range--block">
              <span>Intensidad</span>
              <input type="range" min="0.1" max="1" step="0.05" value={effectiveSpec.intensity} onChange={(event) => update({ intensity: Number(event.target.value) })} />
              <output>{Math.round(effectiveSpec.intensity * 100)} %</output>
            </label>
            <Swatches
              label="Fondo"
              value={effectiveSpec.background}
              onChange={(background) => update({ background })}
              options={BACKGROUNDS}
              extra={
                <label className="flowers-swatch flowers-swatch--input" title="Otro color">
                  <input type="color" value={effectiveSpec.background} onChange={(event) => update({ background: event.target.value })} aria-label="Otro color de fondo" />
                  <span className="flowers-swatch__label">Otro</span>
                </label>
              }
            />
            <Button variant="ghost" size="sm" icon={Shuffle} onClick={() => update({ seed: (effectiveSpec.seed * 7919 + 13) % 2147483647 })}>
              Otra variación
            </Button>
          </details>
        </section>
      </div>

      <Section title="Herbario" description="Las animaciones que guardes quedan en este dispositivo (y en tus copias de seguridad).">
        <CreationGallery origins={FLOWER_ORIGINS} icon={Flower2} emptyTitle="Tu herbario está vacío" emptyText="Cuando una animación te guste, pulsa «Guardar en el herbario»." />
      </Section>
    </ModuleLayout>
  );
}
