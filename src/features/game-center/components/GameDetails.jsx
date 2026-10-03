import { ExternalLink, Globe, Keyboard, Play, Smartphone, Target, Gauge, WifiOff, HardDrive } from 'lucide-react';
import { Button } from '../../../components/common/Button.jsx';
import { useMediaQuery } from '../../../hooks/useMediaQuery.js';
import { useOnlineStatus } from '../../../hooks/useOnlineStatus.js';
import { formatLastPlayed } from '../services/gameLifecycle.js';
import { categoryLabel } from '../registry/categories.js';

/** Tablas de controles: primero las del dispositivo que se está usando. */
export function GameControls({ controls }) {
  const touchFirst = useMediaQuery('(pointer: coarse)');
  const groups = [
    { id: 'keyboard', title: 'Teclado y ratón', icon: Keyboard, rows: controls.keyboard },
    { id: 'touch', title: 'Pantalla táctil', icon: Smartphone, rows: controls.touch },
  ];
  if (touchFirst) groups.reverse();
  return (
    <div className="game-controls">
      {groups.map(({ id, title, icon: Icon, rows }) => (
        <div key={id} className="game-controls__group">
          <h4 className="game-controls__title">
            <Icon aria-hidden="true" /> {title}
          </h4>
          <dl className="game-controls__list">
            {rows.map(([keys, action]) => (
              <div key={keys} className="game-controls__row">
                <dt>
                  <kbd>{keys}</kbd>
                </dt>
                <dd>{action}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}

/** Objetivo, reglas y controles (se reutiliza en el diálogo de ayuda durante la partida). */
export function GameInstructions({ game }) {
  return (
    <div className="game-instructions">
      <section aria-labelledby={`${game.id}-objective`}>
        <h3 id={`${game.id}-objective`} className="game-instructions__title">
          <Target aria-hidden="true" /> Objetivo
        </h3>
        <p>{game.objective}</p>
      </section>
      <section aria-labelledby={`${game.id}-howto`}>
        <h3 id={`${game.id}-howto`} className="game-instructions__title">
          Cómo se juega
        </h3>
        <ol className="game-instructions__steps">
          {game.howTo.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>
      <section aria-labelledby={`${game.id}-controls`}>
        <h3 id={`${game.id}-controls`} className="game-instructions__title">
          Controles
        </h3>
        <GameControls controls={game.controls} />
      </section>
    </div>
  );
}

/**
 * Elección de modalidad para los juegos con versión original online verificada.
 * Offline es la principal (la app es local-first); online se marca como contenido
 * externo que necesita Internet y que no suma a las estadísticas locales.
 */
function PlayModes({ source, onStart, onPlayOnline }) {
  const online = useOnlineStatus();
  return (
    <div className="play-modes" role="group" aria-label="Modalidad de juego">
      <section className="play-mode play-mode--offline" aria-labelledby="play-mode-offline">
        <h2 id="play-mode-offline" className="play-mode__title">
          <HardDrive aria-hidden="true" /> Offline
        </h2>
        <p className="play-mode__text">Versión de la app. Funciona sin conexión y guarda tu progreso y tus récords.</p>
        <Button size="lg" icon={Play} onClick={onStart} autoFocus>
          Jugar
        </Button>
      </section>
      <section className="play-mode play-mode--online" aria-labelledby="play-mode-online">
        <h2 id="play-mode-online" className="play-mode__title">
          <Globe aria-hidden="true" /> Online · versión original
        </h2>
        <p className="play-mode__text">
          {source.title} de {source.developer}, en {source.providerName}. Necesita Internet
          {source.method === 'external' ? ' y se abre en otra pestaña' : ''}. Es contenido externo: no suma a tus
          estadísticas.
        </p>
        {!online ? (
          <p className="play-mode__offline" role="status">
            <WifiOff aria-hidden="true" /> Sin conexión. Disponible cuando vuelvas a conectarte; mientras, juega offline.
          </p>
        ) : source.method === 'external' ? (
          <Button variant="secondary" iconEnd={ExternalLink} href={source.url}>
            Abrir en {source.providerName}
          </Button>
        ) : (
          <Button variant="secondary" icon={Globe} onClick={onPlayOnline}>
            Jugar online
          </Button>
        )}
        {source.reason && <p className="play-mode__note">{source.reason}</p>}
      </section>
    </div>
  );
}

/** Pantalla previa a la partida: presentación, instrucciones y botón de inicio. */
export function GameDetails({ game, record, onStart, onlineSource = null, onPlayOnline, onlineNote = null }) {
  const { Art } = game;
  const progress = game.progress(record);
  const highlight = record ? game.highlight(record) : null;
  const last = formatLastPlayed(record?.lastPlayedAt);
  return (
    <article className="game-details" aria-labelledby="game-details-title">
      <header className="game-details__hero">
        <div className="game-details__art">
          <Art className="game-art" />
        </div>
        <div className="game-details__intro">
          <ul className="game-tags" aria-label="Categorías">
            {game.categories.map((id) => (
              <li key={id} className="game-tag">
                {categoryLabel(id)}
              </li>
            ))}
          </ul>
          <h1 id="game-details-title" className="game-details__title">
            {game.title}
          </h1>
          <p className="game-details__tagline">{game.tagline}</p>
          <p className="game-details__description">{game.description}</p>
          <ul className="game-facts" aria-label="Características">
            {game.facts.map((fact) => (
              <li key={fact}>{fact}</li>
            ))}
          </ul>
          {onlineSource ? (
            <>
              <p className="game-details__meta">
                <Gauge aria-hidden="true" /> {game.difficulty}
              </p>
              <PlayModes source={onlineSource} onStart={onStart} onPlayOnline={onPlayOnline} />
            </>
          ) : (
            <div className="game-details__start">
              <Button size="lg" icon={Play} onClick={onStart} autoFocus>
                Jugar
              </Button>
              <p className="game-details__meta">
                <Gauge aria-hidden="true" /> {game.difficulty}
              </p>
              {onlineNote && (
                <p className="game-details__online-note">
                  <Globe aria-hidden="true" /> <strong>Versión online: no disponible.</strong> {onlineNote}
                </p>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="game-details__grid">
        <div className="game-details__panel">
          <GameInstructions game={game} />
        </div>
        <aside className="game-details__panel game-details__progress" aria-labelledby="game-progress-title">
          <h3 id="game-progress-title" className="game-instructions__title">
            Tu progreso
          </h3>
          <div
            className="meter"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={progress.total}
            aria-valuenow={progress.done}
            aria-label={progress.label}
          >
            <span style={{ width: `${(progress.done / progress.total) * 100}%` }} />
          </div>
          <p className="game-details__progress-label">{progress.label}</p>
          {record?.plays ? (
            <ul className="game-details__stats">
              <li>
                <strong>{record.plays}</strong> {record.plays === 1 ? 'partida' : 'partidas'}
              </li>
              {highlight && <li>{highlight}</li>}
              {last && <li>Última vez: {last}</li>}
            </ul>
          ) : (
            <p className="game-details__empty">Todavía no has jugado. Tu primera partida empieza aquí.</p>
          )}
        </aside>
      </div>
    </article>
  );
}
