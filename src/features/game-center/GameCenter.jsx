import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { History, Play, ShieldCheck } from 'lucide-react';
import { usePreferences } from '../../app/providers/PreferencesProvider.jsx';
import { Button } from '../../components/common/Button.jsx';
import { SectionHeader } from '../../components/common/Card.jsx';
import { GAMES, filterGames, findGame } from './registry/gameRegistry.js';
import { CATEGORIES, categoryLabel } from './registry/categories.js';
import { ROADMAP } from './registry/roadmap.js';
import { formatLastPlayed } from './services/gameLifecycle.js';
import { summarizeRecords, useCenterSettings, useGameRecords } from './hooks/useGameStatistics.js';
import { GameFilters } from './components/GameFilters.jsx';
import { GameLibrary } from './components/GameLibrary.jsx';
import { PlannedGameCard } from './components/GameCard.jsx';
import { GameStats, SoundSettings } from './components/GameStats.jsx';
import './styles/game-center.css';

/** Cabecera: la marquesina de un salón recreativo, con el saludo personal. */
function Marquee({ nickname, summary }) {
  return (
    <header className="gc-marquee" aria-labelledby="gc-title">
      <div className="gc-marquee__bulbs" aria-hidden="true" />
      <div className="gc-marquee__inner">
        <p className="eyebrow">Nuestra sala de juegos</p>
        <h1 id="gc-title" className="gc-marquee__title">
          <span>Game</span> <span>Center</span>
        </h1>
        <p className="gc-marquee__lead">Un universo de juegos, creado para disfrutar.</p>
        <p className="gc-marquee__greeting">{nickname ? `¿A qué jugamos hoy, ${nickname.toLowerCase()}?` : '¿A qué jugamos hoy?'}</p>
        <p className="gc-marquee__ticket">
          <span>{GAMES.length} juegos disponibles</span>
          <span aria-hidden="true">·</span>
          <span>{summary.plays === 1 ? '1 partida jugada' : `${summary.plays.toLocaleString('es')} partidas jugadas`}</span>
        </p>
      </div>
    </header>
  );
}

/** Destacado: el último juego usado o, la primera vez, una recomendación para empezar. */
function Featured({ game, record }) {
  const { Art } = game;
  const last = formatLastPlayed(record?.lastPlayedAt);
  const highlight = record ? game.highlight(record) : null;
  return (
    <section className="gc-featured" aria-labelledby="gc-featured-title" style={{ '--game-a': game.palette.a, '--game-b': game.palette.b }}>
      <div className="gc-featured__art">
        <Art className="game-art" />
      </div>
      <div className="gc-featured__copy">
        <p className="eyebrow">{last ? `Seguir jugando · ${last}` : 'Para empezar'}</p>
        <h2 id="gc-featured-title" className="gc-featured__title">
          {game.title}
        </h2>
        <p className="gc-featured__text">{game.description}</p>
        {highlight && <p className="gc-featured__highlight">{highlight}</p>}
        <Button to={`/juegos/${game.id}`} icon={Play} size="lg">
          {last ? 'Continuar' : 'Empezar a jugar'}
        </Button>
      </div>
    </section>
  );
}

function RecentGames({ games, records }) {
  return (
    <section className="gc-recent" aria-labelledby="gc-recent-title">
      <h2 id="gc-recent-title" className="gc-recent__title">
        <History aria-hidden="true" /> Jugados recientemente
      </h2>
      <ul className="gc-recent__list">
        {games.map((game) => {
          const { Art } = game;
          return (
            <li key={game.id}>
              <Link to={`/juegos/${game.id}`} className="gc-recent__item" style={{ '--game-a': game.palette.a, '--game-b': game.palette.b }}>
                <span className="gc-recent__thumb" aria-hidden="true">
                  <Art className="game-art" />
                </span>
                <span className="gc-recent__text">
                  <span className="gc-recent__name">{game.title}</span>
                  <span className="gc-recent__when">{formatLastPlayed(records[game.id].lastPlayedAt)}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Roadmap() {
  return (
    <section className="gc-roadmap" aria-labelledby="gc-roadmap-title">
      <SectionHeader
        id="gc-roadmap-title"
        eyebrow="Próximas incorporaciones"
        title="Lo que llegará a la sala"
        description="Están planificados para las siguientes fases. Todavía no se pueden jugar."
      />
      <ol className="gc-roadmap__phases">
        {ROADMAP.map((phase) => (
          <li key={phase.phase} className="gc-roadmap__phase">
            <h3 className="gc-roadmap__phase-title">
              <span>Fase {phase.phase}</span> {phase.title}
            </h3>
            <ul className="gc-roadmap__games">
              {phase.games.map((game) => (
                <li key={game.id}>
                  <PlannedGameCard game={game} phase={phase.phase} />
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Ruta /juegos — biblioteca del Game Center. */
export default function GameCenter() {
  const { preferences } = usePreferences();
  const { records } = useGameRecords();
  const [settings, updateSettings] = useCenterSettings();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');

  const summary = useMemo(() => summarizeRecords(records, GAMES), [records]);
  const results = useMemo(() => filterGames(GAMES, { query, category }, categoryLabel), [query, category]);
  const usedCategories = useMemo(() => CATEGORIES.filter((c) => GAMES.some((g) => g.categories.includes(c.id))), []);
  const recent = useMemo(
    () =>
      GAMES.filter((game) => records[game.id]?.lastPlayedAt)
        .sort((a, b) => records[b.id].lastPlayedAt.localeCompare(records[a.id].lastPlayedAt))
        .slice(0, 4),
    [records],
  );
  const featured = (summary.lastPlayed && findGame(summary.lastPlayed.id)) || GAMES[0];

  return (
    <div className="page game-center">
      <Marquee nickname={preferences.profile.nicknames[0]} summary={summary} />
      <Featured game={featured} record={records[featured.id]} />
      {recent.length > 0 && <RecentGames games={recent} records={records} />}

      <section className="gc-library" aria-labelledby="gc-library-title">
        <SectionHeader
          id="gc-library-title"
          eyebrow="Biblioteca"
          title="Todos los juegos"
          description="Elige uno para ver cómo se juega y empezar una partida. Todo funciona sin conexión."
        />
        <GameFilters
          query={query}
          onQuery={setQuery}
          category={category}
          onCategory={setCategory}
          categories={usedCategories}
          resultCount={results.length}
        />
        <GameLibrary
          games={results}
          records={records}
          onReset={() => {
            setQuery('');
            setCategory('all');
          }}
        />
      </section>

      <section className="gc-stats" aria-labelledby="gc-stats-title">
        <SectionHeader id="gc-stats-title" eyebrow="Estadísticas" title="Tu historial de juego" />
        <GameStats summary={summary} games={GAMES} records={records} />
        <SoundSettings settings={settings} onChange={updateSettings} />
      </section>

      <Roadmap />

      <p className="home__privacy">
        <ShieldCheck aria-hidden="true" />
        Partidas, récords y progreso se guardan solo en este dispositivo. Sin anuncios, sin servidores, sin jugadores conectados.
      </p>
    </div>
  );
}
