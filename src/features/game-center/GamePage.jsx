import { Component, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { ArrowLeft, CircleHelp, Volume2, VolumeX } from 'lucide-react';
import { Button, IconButton } from '../../components/common/Button.jsx';
import { ConfirmDialog, Dialog } from '../../components/common/Dialog.jsx';
import { findGame } from './registry/gameRegistry.js';
import { createGameAudio } from './services/gameAudio.js';
import { GameAudioContext } from './hooks/useGameAudio.js';
import { GameFrameContext } from './hooks/useGameFrame.js';
import { useCenterSettings, useGameRecord } from './hooks/useGameStatistics.js';
import { GameDetails, GameInstructions } from './components/GameDetails.jsx';
import { OnlineGameFrame } from './components/OnlineGameFrame.jsx';
import { ONLINE_UNAVAILABLE, onlineSourceFor } from './online/onlineSources.js';
import './styles/game-center.css';
import './styles/game-screen.css';

/** Si un juego falla al dibujarse, se ofrece volver a la biblioteca sin afectar al resto de la app. */
class GameErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error('[game-center] Error en el juego:', error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="game-fallback" role="alert">
        <h2>Este juego se detuvo inesperadamente</h2>
        <p>Tus estadísticas guardadas no se han perdido.</p>
        <div className="game-overlay__actions">
          <Button onClick={() => this.setState({ error: null })}>Intentar de nuevo</Button>
          <Button variant="ghost" onClick={this.props.onExit}>
            Volver al Game Center
          </Button>
        </div>
      </div>
    );
  }
}

function GameLoading() {
  return (
    <div className="game-loading" role="status">
      <span className="game-loading__spinner" aria-hidden="true" />
      <span>Preparando el juego…</span>
    </div>
  );
}

const SILENT_AUDIO = { play() {}, setVolume() {}, setMuted() {}, suspend() {}, resume() {}, close() {} };

function GameScreen({ game }) {
  const navigate = useNavigate();
  const [phase, setPhase] = useState('briefing'); // 'briefing' | 'playing' | 'online'
  const onlineSource = useMemo(() => onlineSourceFor(game.id), [game.id]);
  const [inProgress, setInProgress] = useState(false);
  const [dialog, setDialog] = useState(null); // 'exit' | 'help'
  const [center, updateCenter] = useCenterSettings();
  const record = useGameRecord(game.id);
  const [audio, setAudio] = useState(SILENT_AUDIO);

  // Un dispositivo de audio por visita al juego; se cierra al salir.
  useEffect(() => {
    const instance = createGameAudio();
    setAudio(instance);
    return () => instance.close();
  }, []);
  useEffect(() => {
    audio.setMuted(!center.sound);
    audio.setVolume(center.volume);
  }, [audio, center.sound, center.volume]);

  useEffect(() => {
    document.title = `${game.title} · Game Center`;
    return () => {
      document.title = 'Un año más contigo';
    };
  }, [game.title]);

  const exit = useCallback(() => navigate('/juegos'), [navigate]);
  const requestExit = () => (inProgress ? setDialog('exit') : exit());

  const frame = useMemo(
    () => ({
      exit,
      showInstructions: () => setPhase('briefing'),
      setInProgress,
      interrupted: dialog !== null,
    }),
    [exit, dialog],
  );

  return (
    <div className="game-screen" data-game={game.id} style={{ '--game-a': game.palette.a, '--game-b': game.palette.b }}>
      <header className="game-topbar">
        <button type="button" className="game-topbar__back" onClick={requestExit}>
          <ArrowLeft aria-hidden="true" />
          <span>Game Center</span>
        </button>
        <p className="game-topbar__title">
          <span className="game-topbar__dot" aria-hidden="true" />
          <span className="game-topbar__name">{game.title}</span>
        </p>
        <div className="game-topbar__actions">
          {phase === 'playing' && <IconButton icon={CircleHelp} label="Cómo se juega" onClick={() => setDialog('help')} />}
          <IconButton
            icon={center.sound ? Volume2 : VolumeX}
            label={center.sound ? 'Silenciar efectos' : 'Activar efectos de sonido'}
            aria-pressed={!center.sound}
            onClick={() => updateCenter({ sound: !center.sound })}
          />
        </div>
      </header>

      <main id="contenido" className={`game-screen__body is-${phase}`} tabIndex={-1}>
        {phase === 'briefing' ? (
          <div className="game-screen__scroll">
            <GameDetails
              game={game}
              record={record}
              onStart={() => setPhase('playing')}
              onlineSource={onlineSource}
              onPlayOnline={() => setPhase('online')}
              onlineNote={ONLINE_UNAVAILABLE[game.id] ?? null}
            />
          </div>
        ) : phase === 'online' ? (
          // Una sola instancia: el iframe solo existe en esta fase y se desmonta al salir.
          <OnlineGameFrame source={onlineSource} onExit={() => setPhase('briefing')} />
        ) : (
          <GameAudioContext.Provider value={audio}>
            <GameFrameContext.Provider value={frame}>
              <GameErrorBoundary onExit={exit}>
                <Suspense fallback={<GameLoading />}>
                  <game.Component game={game} />
                </Suspense>
              </GameErrorBoundary>
            </GameFrameContext.Provider>
          </GameAudioContext.Provider>
        )}
      </main>

      <ConfirmDialog
        open={dialog === 'exit'}
        title="¿Salir de la partida?"
        description="La partida en curso se cerrará. Se guardará el tiempo jugado, pero no contará como terminada."
        confirmLabel="Salir"
        cancelLabel="Seguir jugando"
        onConfirm={exit}
        onCancel={() => setDialog(null)}
      />
      <Dialog open={dialog === 'help'} title={`Cómo se juega · ${game.title}`} onClose={() => setDialog(null)} size="lg">
        <GameInstructions game={game} />
      </Dialog>
    </div>
  );
}

/** Ruta /juegos/:gameId — fuera del marco general para ocupar toda la pantalla. */
export default function GamePage() {
  const { gameId } = useParams();
  const game = findGame(gameId);
  if (!game) return <Navigate to="/juegos" replace />;
  return <GameScreen key={game.id} game={game} />;
}
