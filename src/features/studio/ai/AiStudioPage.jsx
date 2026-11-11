import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Cpu, Download, Heart, ImageIcon, Loader2, Palette, PlugZap, RefreshCw, Sparkles, Square } from 'lucide-react';
import { Button } from '../../../components/common/Button.jsx';
import { SegmentedControl } from '../../../components/common/SegmentedControl.jsx';
import { useToast } from '../../../components/feedback/ToastProvider.jsx';
import { useOnlineStatus } from '../../../hooks/useOnlineStatus.js';
import { cx } from '../../../utils/cx.js';
import { deleteRecord, listKind, saveSettings, updateRecord } from '../../organizer/data/store.js';
import { useRecord, useSettings } from '../../organizer/data/hooks.js';
import { InputField, SelectField, TextAreaField } from '../../organizer/shared/Fields.jsx';
import { ModuleLayout, Section } from '../../organizer/shared/ui.jsx';
import { CreationGallery } from '../shared/CreationGallery.jsx';
import { downloadBlob, saveCreation, slugify } from '../shared/creations.js';
import { generateImage, MAX_PROMPT, probeServer, PROTOCOLS, SIZES, validateServerUrl } from './providers.js';
import '../../organizer/shared/organizer.css';
import '../shared/studio.css';
import './aiStudio.css';

const HISTORY_ORIGINS = ['procedural', 'ai'];
/** Las imágenes sin guardar se conservan en el historial hasta este número; las guardadas no se borran solas. */
export const HISTORY_LIMIT = 24;
const IDEAS = ['Un jardín de rosas al atardecer', 'Montañas nevadas bajo un cielo estrellado', 'Una playa con luna llena y corazones'];

async function pruneHistory() {
  const unsaved = listKind('creation')
    .filter((c) => HISTORY_ORIGINS.includes(c.origin) && !c.favorite)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  for (const old of unsaved.slice(HISTORY_LIMIT)) await deleteRecord(old.id);
}

function EngineChoice({ value, onChange }) {
  const name = useId();
  const options = [
    { value: 'procedural', icon: Palette, title: 'Pintor procedural', tag: 'No es IA', text: 'Compone la escena con formas a partir de palabras clave. Funciona sin conexión.' },
    { value: 'server', icon: Cpu, title: 'Servidor de IA', tag: 'IA real', text: 'Stable Diffusion u otro modelo que ejecutes en tu computador o en tu red.' },
  ];
  return (
    <fieldset className="ai-engines">
      <legend>¿Con qué la creo?</legend>
      {options.map((option) => (
        <label key={option.value} className={cx('ai-engine', value === option.value && 'is-checked')}>
          <input type="radio" className="sr-only" name={name} checked={value === option.value} onChange={() => onChange(option.value)} />
          <option.icon aria-hidden="true" className="ai-engine__icon" />
          <span className="ai-engine__text">
            <span className="ai-engine__title">
              {option.title} <span className={cx('ai-tag', option.value === 'procedural' ? 'is-procedural' : 'is-ai')}>{option.tag}</span>
            </span>
            <span className="ai-engine__desc">{option.text}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

function ServerSettings({ settings, onChange }) {
  const [probe, setProbe] = useState({ state: 'idle', message: '' });
  // La dirección se edita en local y se guarda al salir del campo (no en cada tecla).
  const [url, setUrl] = useState(settings.serverUrl);
  useEffect(() => setUrl(settings.serverUrl), [settings.serverUrl]);
  const online = useOnlineStatus();
  const valid = validateServerUrl(url);
  const commitUrl = () => url.trim() !== settings.serverUrl && onChange({ serverUrl: url.trim() });
  const test = async () => {
    commitUrl();
    setProbe({ state: 'busy', message: 'Probando…' });
    try {
      const { models } = await probeServer({ url, protocol: settings.protocol });
      setProbe({ state: 'ok', message: models.length ? `Conectado. Modelos: ${models.slice(0, 3).join(', ')}${models.length > 3 ? '…' : ''}` : 'Conectado.' });
    } catch (error) {
      setProbe({ state: 'error', message: error.message });
    }
  };
  return (
    <div className="ai-server">
      <SelectField
        label="Tipo de servidor"
        value={settings.protocol}
        onChange={(protocol) => onChange({ protocol, serverUrl: PROTOCOLS[protocol].defaultUrl })}
        options={Object.entries(PROTOCOLS).map(([value, p]) => ({ value, label: p.label }))}
      />
      <InputField
        label="Dirección del servidor"
        value={url}
        onChange={setUrl}
        onBlur={commitUrl}
        placeholder={PROTOCOLS[settings.protocol].defaultUrl}
        inputMode="url"
        spellCheck={false}
        error={url && !valid.ok ? valid.error : null}
        hint="Este computador (localhost) o un equipo de tu red, p. ej. http://192.168.1.20:7860"
      />
      {settings.protocol === 'openai' && <InputField label="Modelo (opcional)" value={settings.model} onChange={(model) => onChange({ model })} spellCheck={false} />}
      <div className="ai-server__probe">
        <Button variant="secondary" size="sm" icon={PlugZap} onClick={test} disabled={!valid.ok || probe.state === 'busy'}>
          Probar conexión
        </Button>
        {probe.message && (
          <span className={cx('ai-server__status', `is-${probe.state}`)} role="status">
            {probe.message}
          </span>
        )}
      </div>
      <details className="ai-help">
        <summary>¿Cómo preparo el servidor?</summary>
        <p>
          La app no incluye ningún modelo ni usa servicios en la nube. Necesitas un programa de generación de imágenes en tu computador, por ejemplo
          Stable Diffusion WebUI (AUTOMATIC1111) o Forge, iniciado con <code>--api --listen --cors-allow-origins=*</code>.
        </p>
        <p>
          Desde otro dispositivo de tu Wi-Fi usa la IP del computador y el puerto 7860 (u 8080 para LocalAI). No hace falta Internet si ambos están en la misma red.
          {!online && ' Ahora mismo no hay conexión a Internet: un servidor de tu red local puede seguir funcionando.'}
        </p>
        <p>
          Limitación: si abres la app desde una dirección https, el navegador puede bloquear la conexión a un servidor http de tu red (contenido mixto). Desde
          <code>npm start</code> (http://localhost) funciona.
        </p>
      </details>
    </div>
  );
}

function ResultPanel({ result, generating, elapsed, onAgain, onSave, onDownload }) {
  const record = useRecord(result?.recordId ?? '');
  if (generating) {
    return (
      <div className="ai-result__state" role="status" aria-live="polite">
        <Loader2 className="ai-spin" aria-hidden="true" />
        <p>Creando la imagen… {elapsed > 1 && <span className="org-subtle">{elapsed} s</span>}</p>
      </div>
    );
  }
  if (!result) {
    return (
      <div className="ai-result__state">
        <ImageIcon aria-hidden="true" />
        <p>Tu imagen aparecerá aquí.</p>
      </div>
    );
  }
  const saved = Boolean(record?.favorite);
  return (
    <figure className="ai-result__figure">
      <img src={result.url} alt={result.prompt} width={result.width} height={result.height} />
      <figcaption>
        <span className={cx('ai-tag', result.origin === 'procedural' ? 'is-procedural' : 'is-ai')}>{result.origin === 'procedural' ? 'Procedural · no es IA' : `IA · ${result.provider}`}</span>
        {result.origin === 'procedural' && (
          <span className="ai-result__recognized">
            {result.recognized?.length ? `Palabras reconocidas: ${result.recognized.join(', ')}.` : 'No reconocí palabras clave: pinté un paisaje a partir del texto.'}
          </span>
        )}
      </figcaption>
      <div className="ai-result__actions">
        <Button variant="secondary" icon={RefreshCw} onClick={onAgain}>
          Generar otra
        </Button>
        <Button icon={Heart} onClick={onSave} aria-pressed={saved}>
          {saved ? 'Guardada' : 'Guardar'}
        </Button>
        <Button variant="ghost" icon={Download} onClick={onDownload}>
          Descargar
        </Button>
      </div>
    </figure>
  );
}

export default function AiStudioPage() {
  const settings = useSettings('studioSettings');
  const { toast } = useToast();
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);
  const variationRef = useRef(0);

  useEffect(() => {
    document.title = 'Lix AI Studio';
  }, []);
  useEffect(() => () => result?.url && URL.revokeObjectURL(result.url), [result]);
  useEffect(() => {
    if (!generating) return undefined;
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 500);
    return () => clearInterval(timer);
  }, [generating]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const change = (patch) => saveSettings('studioSettings', patch).catch((e) => toast({ tone: 'error', message: e.message }));
  const server = useMemo(() => ({ url: settings.serverUrl || PROTOCOLS[settings.protocol].defaultUrl, protocol: settings.protocol, model: settings.model, steps: settings.steps }), [settings]);

  const generate = async (variation) => {
    setError(null);
    setGenerating(true);
    setElapsed(0);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const output = await generateImage({ prompt, provider: settings.provider, server, size: settings.size, variation, signal: controller.signal });
      // Toda imagen generada entra en el historial; «Guardar» la protege de la limpieza automática.
      const record = await saveCreation(output.blob, {
        origin: output.origin,
        title: prompt.trim().slice(0, 80),
        prompt: prompt.trim(),
        provider: output.provider,
        params: { size: settings.size, variation, recognized: output.recognized },
        width: output.width,
        height: output.height,
      });
      await pruneHistory();
      setResult({ ...output, prompt: prompt.trim(), url: URL.createObjectURL(output.blob), recordId: record.id });
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerating(false);
      abortRef.current = null;
    }
  };

  const submit = (event) => {
    event.preventDefault();
    variationRef.current = 0;
    generate(0);
  };

  const charsLeft = MAX_PROMPT - prompt.length;

  return (
    <ModuleLayout
      className="ai-page"
      eyebrow="Taller creativo"
      title="Lix AI Studio"
      description="Describe una imagen y créala. Siempre verás con qué se hizo: el pintor procedural (no es IA) o tu propio servidor de IA."
    >
      <div className="ai-layout">
        <form className="ai-compose" onSubmit={submit} aria-label="Crear imagen">
          <EngineChoice value={settings.provider} onChange={(provider) => change({ provider })} />
          {settings.provider === 'server' && <ServerSettings settings={settings} onChange={change} />}
          <TextAreaField
            label="Describe la imagen"
            value={prompt}
            onChange={(value) => setPrompt(value.slice(0, MAX_PROMPT))}
            rows={4}
            maxLength={MAX_PROMPT}
            placeholder="Por ejemplo: un campo de girasoles bajo un cielo de atardecer"
            hint={`${charsLeft} caracteres disponibles`}
          />
          <div className="ai-ideas" aria-label="Ideas">
            {IDEAS.map((idea) => (
              <button key={idea} type="button" className="org-chip" onClick={() => setPrompt(idea)}>
                {idea}
              </button>
            ))}
          </div>
          <SegmentedControl label="Formato" value={settings.size} onChange={(size) => change({ size })} options={Object.entries(SIZES).map(([value, s]) => ({ value, label: s.label }))} />
          {error && (
            <p className="field__error" role="alert">
              {error}
            </p>
          )}
          <div className="ai-compose__actions">
            {generating ? (
              <Button variant="secondary" icon={Square} onClick={() => abortRef.current?.abort()}>
                Cancelar
              </Button>
            ) : (
              <Button type="submit" icon={Sparkles} disabled={!prompt.trim()}>
                Generar
              </Button>
            )}
          </div>
        </form>
        <section className="ai-result" aria-label="Resultado">
          <ResultPanel
            result={result}
            generating={generating}
            elapsed={elapsed}
            onAgain={() => {
              variationRef.current += 1;
              generate(variationRef.current);
            }}
            onSave={async () => {
              const current = listKind('creation').find((c) => c.id === result.recordId);
              if (!current) return;
              await updateRecord(current.id, { favorite: !current.favorite });
              toast({ message: current.favorite ? 'Ya no está guardada: se borrará sola cuando el historial se llene' : 'Guardada: no se borrará del historial' });
            }}
            onDownload={() => downloadBlob(result.blob, `lix-ai-${slugify(result.prompt)}.${result.blob.type.split('/')[1]}`)}
          />
        </section>
      </div>

      <Section title="Historial" description={`Las ${HISTORY_LIMIT} últimas imágenes generadas, en este dispositivo. Las que guardes (♥) se conservan siempre.`}>
        <CreationGallery origins={HISTORY_ORIGINS} icon={ImageIcon} emptyTitle="Aún no has creado imágenes" emptyText="Escribe una descripción y pulsa «Generar»." />
      </Section>
    </ModuleLayout>
  );
}
