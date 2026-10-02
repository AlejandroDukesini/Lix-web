import { usePreferences } from '../../app/providers/PreferencesProvider.jsx';

/**
 * Fondo decorativo fijo detrás de toda la interfaz. Nunca recibe eventos de
 * puntero ni se anuncia a lectores de pantalla.
 *  - Glass: halos de luz con los colores de la paleta, que dan sentido al cristal.
 *  - Maximal: patrón de puntos y formas geométricas grandes en los bordes.
 */
export function AmbientBackground() {
  const { preferences } = usePreferences();
  const { style } = preferences.appearance;

  return (
    <div className={`ambient ambient--${style}`} aria-hidden="true">
      {style === 'glass' ? (
        <>
          <span className="ambient__orb ambient__orb--1" />
          <span className="ambient__orb ambient__orb--2" />
          <span className="ambient__orb ambient__orb--3" />
          <span className="ambient__orb ambient__orb--4" />
          <span className="ambient__grain" />
        </>
      ) : (
        <svg className="ambient__shapes" viewBox="0 0 1200 900" preserveAspectRatio="xMidYMid slice">
          <circle className="shape shape--sun" cx="1120" cy="80" r="190" />
          <path className="shape shape--arch" d="M-60 900 V700 a170 170 0 0 1 340 0 V900 Z" />
          <path
            className="shape shape--star"
            d="M1040 640 l22 58 62 4 -48 39 16 60 -52-34 -52 34 16-60 -48-39 62-4 z"
          />
          <path className="shape shape--zigzag" d="M40 140 l40 -40 40 40 40 -40 40 40 40 -40 40 40" />
          <circle className="shape shape--ring" cx="700" cy="860" r="120" />
          <path className="shape shape--heart" d="M300 240c-20-30-70-20-70 18 0 30 70 72 70 72s70-42 70-72c0-38-50-48-70-18z" />
        </svg>
      )}
    </div>
  );
}
