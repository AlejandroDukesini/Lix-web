import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ExternalLink, Maximize, RotateCw, Smartphone, WifiOff } from 'lucide-react';
import { Button } from '../../../components/common/Button.jsx';
import { useOnlineStatus } from '../../../hooks/useOnlineStatus.js';
import { useMediaQuery } from '../../../hooks/useMediaQuery.js';
import { iframeAllow, isTrustedSource } from '../online/onlineSources.js';

// Pasado este tiempo sin el evento `load` se ofrece reintentar; nunca se da por fallido.
const SLOW_MS = 20000;

/**
 * Reproductor online: el juego original del proveedor dentro de un iframe.
 *
 * Solo para fuentes 'embed' verificadas (ver onlineSources.js): la URL sale de
 * la configuración, nunca de una entrada de la persona, y se vuelve a validar
 * aquí. El iframe es contenido externo aislado: la app no lee ni controla lo
 * que pasa dentro (ni puntuaciones ni estado), no intercepta sus gestos y no
 * registra estadísticas de esta partida.
 *
 * El evento `load` solo dice que el documento del iframe cargó, no que el juego
 * esté listo: por eso el estado es «cargado» y, si tarda, se ofrece reintentar
 * o abrir la página oficial, sin declarar un error que no se puede comprobar.
 */
export function OnlineGameFrame({ source, onExit, providers }) {
  const online = useOnlineStatus();
  const portraitPhone = useMediaQuery('(orientation: portrait) and (max-width: 599px)');
  const containerRef = useRef(null);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState('loading'); // 'loading' | 'slow' | 'loaded'
  const trusted = source?.method === 'embed' && isTrustedSource(source, providers);

  useEffect(() => {
    if (!trusted || !online) return undefined;
    setStatus('loading');
    const timer = setTimeout(() => setStatus((current) => (current === 'loading' ? 'slow' : current)), SLOW_MS);
    return () => clearTimeout(timer);
  }, [trusted, online, attempt]);

  if (!trusted) {
    return (
      <div className="online-frame__notice" role="alert">
        <p className="online-frame__notice-title">Integración no disponible</p>
        <p>Este juego no tiene una versión online verificada que se pueda abrir aquí.</p>
        <Button variant="ghost" icon={ArrowLeft} onClick={onExit}>
          Volver
        </Button>
      </div>
    );
  }

  if (!online && status !== 'loaded') {
    return (
      <div className="online-frame__notice" role="alert">
        <WifiOff aria-hidden="true" className="online-frame__notice-icon" />
        <p className="online-frame__notice-title">Sin conexión</p>
        <p>La versión online necesita Internet. La versión offline funciona sin conexión.</p>
        <Button icon={ArrowLeft} onClick={onExit}>
          Volver y jugar offline
        </Button>
      </div>
    );
  }

  const fullscreen = () => containerRef.current?.requestFullscreen?.().catch(() => {});

  return (
    <div className="online-frame" ref={containerRef}>
      <div className="online-frame__bar">
        <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={onExit}>
          Salir del modo online
        </Button>
        <p className="online-frame__source">
          {source.title} · contenido externo de {source.providerName}
        </p>
        <div className="online-frame__actions">
          {document.fullscreenEnabled && (
            <Button variant="ghost" size="sm" icon={Maximize} onClick={fullscreen}>
              <span className="online-frame__label">Pantalla completa</span>
            </Button>
          )}
        </div>
      </div>

      {!online && (
        <p className="online-frame__warning" role="status">
          <WifiOff aria-hidden="true" /> Se perdió la conexión: el juego externo puede dejar de responder.
        </p>
      )}
      {portraitPhone && source.orientation === 'landscape' && (
        <p className="online-frame__hint">
          <Smartphone aria-hidden="true" /> Se ve mejor en horizontal
        </p>
      )}

      <div className="online-frame__stage">
        <iframe
          key={attempt}
          className="online-frame__iframe"
          src={source.url}
          title={`${source.title} (juego externo de ${source.providerName})`}
          allow={iframeAllow(source.permissions)}
          allowFullScreen={source.permissions?.includes('fullscreen')}
          referrerPolicy="strict-origin-when-cross-origin"
          onLoad={() => setStatus('loaded')}
        />
        {status !== 'loaded' && (
          <div className="online-frame__loading" role="status">
            <span className="game-loading__spinner" aria-hidden="true" />
            {status === 'loading' ? (
              <span>Cargando el juego desde {source.providerName}…</span>
            ) : (
              <>
                <span>Está tardando más de lo normal. Puede ser la conexión o el proveedor.</span>
                <div className="online-frame__retry">
                  <Button size="sm" icon={RotateCw} onClick={() => setAttempt((n) => n + 1)}>
                    Reintentar
                  </Button>
                  {source.officialUrl && (
                    <Button variant="ghost" size="sm" icon={ExternalLink} href={source.officialUrl}>
                      Abrir en {source.providerName}
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
