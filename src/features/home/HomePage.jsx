import { CalendarHeart, Gamepad2, Heart, Play, Settings2, ShieldCheck, Sparkles } from 'lucide-react';
import { usePreferences } from '../../app/providers/PreferencesProvider.jsx';
import { UPCOMING_MODULES } from '../../app/modules.js';
import { Button } from '../../components/common/Button.jsx';
import { Badge, Card, SectionHeader } from '../../components/common/Card.jsx';
import { Candle } from '../../components/presentation/Candle.jsx';
import { NicknameCarousel } from '../../components/presentation/NicknameCarousel.jsx';
import { useNow } from '../../hooks/useNow.js';
import {
  celebrationMoment,
  countdown,
  formatDuration,
  formatLongDate,
  formatTime,
  formatWeekdayDate,
  greetingFor,
  nextAnniversary,
  plural,
  relationshipDuration,
} from '../../utils/dates.js';
import './home.css';

function Hero() {
  const { preferences } = usePreferences();
  const { nicknames, rotateNicknames } = preferences.profile;
  const now = useNow(60_000);

  return (
    <Card as="section" className="hero" aria-labelledby="home-title">
      <div className="hero__copy">
        <p className="eyebrow">{formatWeekdayDate(now)}</p>
        <h1 id="home-title" className="hero__title">
          <span className="hero__greeting">{greetingFor(now)},</span>
          <NicknameCarousel nicknames={nicknames} rotate={rotateNicknames} className="hero__nickname" />
        </h1>
        <p className="hero__lead">
          Un año más contigo, y todos los que vienen. Este es nuestro espacio: un rincón pequeño para guardar lo que vivimos
          y todo lo que todavía nos falta por vivir.
        </p>
        <div className="hero__actions">
          <Button to="/ajustes" variant="secondary" icon={Settings2}>
            Personalizar
          </Button>
        </div>
      </div>
      <div className="hero__ornament" aria-hidden="true">
        <Heart className="hero__heart" />
        <Sparkles className="hero__sparkles" />
      </div>
    </Card>
  );
}

function TogetherCard() {
  const { preferences } = usePreferences();
  const start = preferences.dates.relationshipStart;
  const now = useNow(60_000);
  const duration = relationshipDuration(start, now);

  if (!duration) {
    return (
      <Card as="section" className="stat-card" aria-labelledby="together-title">
        <CalendarHeart className="stat-card__icon" aria-hidden="true" />
        <h2 id="together-title" className="stat-card__title">
          Nuestro tiempo juntos
        </h2>
        <p className="stat-card__text">
          Cuando configures la fecha en que empezó todo, aquí verás cuánto tiempo llevamos juntos y cuánto falta para el
          próximo aniversario.
        </p>
        <Button to="/ajustes" state={{ section: 'fechas' }} variant="secondary" size="sm">
          Configurar la fecha
        </Button>
      </Card>
    );
  }

  const anniversary = nextAnniversary(start, now);
  return (
    <Card as="section" variant="secondary" className="stat-card" aria-labelledby="together-title">
      <p className="eyebrow">Juntos desde el {formatLongDate(start)}</p>
      <h2 id="together-title" className="stat-card__value">
        {duration.totalDays.toLocaleString('es')} <span>{duration.totalDays === 1 ? 'día' : 'días'}</span>
      </h2>
      <p className="stat-card__text">{formatDuration(duration)} construyendo esto.</p>
      {anniversary && anniversary.yearsCompleting > 0 && (
        <p className="stat-card__foot">
          {anniversary.daysLeft === 0
            ? `¡Hoy cumplimos ${plural(anniversary.yearsCompleting, 'año')}!`
            : `Aniversario n.º ${anniversary.yearsCompleting}: ${formatLongDate(anniversary.date)} · faltan ${plural(anniversary.daysLeft, 'día')}`}
        </p>
      )}
    </Card>
  );
}

function NewYearCard() {
  const { preferences } = usePreferences();
  const { celebrationYear, celebrationTime, hourCycle } = preferences.dates;
  const now = useNow(1000);
  const target = celebrationMoment(celebrationYear, celebrationTime);
  const left = countdown(target, now);
  const units = [
    ['días', left.days],
    ['horas', left.hours],
    ['min', left.minutes],
    ['seg', left.seconds],
  ];

  return (
    <Card as="section" variant="accent" className="stat-card stat-card--countdown" aria-labelledby="newyear-title">
      <p className="eyebrow">Nuestro Año Nuevo</p>
      <h2 id="newyear-title" className="stat-card__title">
        {left.passed ? `¡Feliz ${celebrationYear}!` : `Rumbo a ${celebrationYear}`}
      </h2>
      {left.passed ? (
        <p className="stat-card__text">Ya empezamos otro año juntos. Que sea el mejor hasta ahora.</p>
      ) : (
        <>
          <p className="countdown" role="timer" aria-live="off" aria-label={`Faltan ${plural(left.days, 'día')} y ${plural(left.hours, 'hora')}`}>
            {units.map(([label, value]) => (
              <span className="countdown__unit" key={label} aria-hidden="true">
                <span className="countdown__value">{String(value).padStart(2, '0')}</span>
                <span className="countdown__label">{label}</span>
              </span>
            ))}
          </p>
          <p className="stat-card__foot">
            1 de enero de {celebrationYear}, {formatTime(target, hourCycle)}
          </p>
        </>
      )}
    </Card>
  );
}

function ReplayCard() {
  const { preferences } = usePreferences();
  return (
    <Card as="section" className="replay-card" aria-labelledby="replay-title">
      <div className="replay-card__candle">
        <Candle size="sm" monogram={preferences.presentation.candleLetter} />
      </div>
      <div className="replay-card__copy">
        <h2 id="replay-title" className="stat-card__title">
          Nuestro viaje astral
        </h2>
        <p className="stat-card__text">Vuelve a mirar por el telescopio cuando quieras.</p>
        <Button to="/presentacion" state={{ from: '/' }} icon={Play} size="sm">
          Ver la presentación
        </Button>
      </div>
    </Card>
  );
}

function GamesCard() {
  return (
    <Card as="section" className="stat-card games-card" aria-labelledby="games-title">
      <Gamepad2 className="stat-card__icon" aria-hidden="true" />
      <h2 id="games-title" className="stat-card__title">
        Nuestra sala de juegos
      </h2>
      <p className="stat-card__text">Toboganes, ajedrez, lógica, arcade y un túnel a toda velocidad. Todo sin conexión.</p>
      <Button to="/juegos" icon={Play} size="sm">
        Entrar al Game Center
      </Button>
    </Card>
  );
}

function Upcoming() {
  return (
    <section className="upcoming" aria-labelledby="upcoming-title">
      <SectionHeader
        id="upcoming-title"
        eyebrow="Lo que estamos construyendo"
        title="Espacios que llegarán pronto"
        description="Cada uno se irá abriendo en las próximas fases. Por ahora solo están reservados: todavía no guardan nada."
      />
      <ul className="upcoming__grid">
        {UPCOMING_MODULES.map((module) => {
          const Icon = module.icon;
          return (
            <li key={module.id} className="upcoming__item">
              <Card className="upcoming__card">
                <div className="upcoming__head">
                  <span className="upcoming__icon" aria-hidden="true">
                    <Icon />
                  </span>
                  <Badge tone="soon">Próximamente</Badge>
                </div>
                <h3 className="upcoming__title">{module.label}</h3>
                <p className="upcoming__teaser">{module.teaser}</p>
              </Card>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function HomePage() {
  return (
    <div className="page home">
      <Hero />
      <div className="home__grid">
        <TogetherCard />
        <NewYearCard />
        <ReplayCard />
        <GamesCard />
      </div>
      <Upcoming />
      <p className="home__privacy">
        <ShieldCheck aria-hidden="true" />
        Todo lo que guardes aquí vive solo en este dispositivo. Nada se envía a Internet.
      </p>
    </div>
  );
}
