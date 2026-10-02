/**
 * Valores predeterminados de la aplicación. Es el único lugar donde viven los
 * textos y datos personales iniciales: todo es editable desde Configuración.
 */

export const PREFERENCES_SCHEMA_VERSION = 2;

export const LIMITS = Object.freeze({
  nicknameLength: 32,
  nicknameCount: 12,
  shortText: 80,
  longText: 280,
});

export const PALETTE_PRESETS = Object.freeze([
  {
    id: 'vela',
    name: 'Luz de vela',
    description: 'Rosa, orquídea y el oro de una llama.',
    colors: { primary: '#ef6f8c', secondary: '#8e5bd8', accent: '#f5b961', ambient: '#3a1636' },
  },
  {
    id: 'amanecer',
    name: 'Primer amanecer',
    description: 'Coral y durazno, como el 1 de enero.',
    colors: { primary: '#ff7a7a', secondary: '#ff9f68', accent: '#ffd36e', ambient: '#5a2840' },
  },
  {
    id: 'lavanda',
    name: 'Noche lavanda',
    description: 'Lilas suaves y un cielo despejado.',
    colors: { primary: '#a78bfa', secondary: '#f0a6ca', accent: '#7dd3fc', ambient: '#1e1b4b' },
  },
  {
    id: 'vino',
    name: 'Vino y oro',
    description: 'Elegante, profundo, de celebración.',
    colors: { primary: '#d6336c', secondary: '#9d2449', accent: '#e9c46a', ambient: '#3b0a1e' },
  },
  {
    id: 'jardin',
    name: 'Jardín de domingo',
    description: 'Terracota, salvia y miel.',
    colors: { primary: '#e07a5f', secondary: '#6fa58b', accent: '#f2cc8f', ambient: '#1f3a30' },
  },
]);

export const DEFAULT_PALETTE_ID = 'vela';

/** Textos del viaje astral (esquema v2). Cada uno corresponde a un capítulo de la presentación. */
export const DEFAULT_PRESENTATION_TEXTS = Object.freeze({
  openingLine: 'Hay millones de estrellas en el universo...',
  openingReveal: '...pero hoy quiero llevarte a descubrir algo que es especial para mí.',
  starsText: 'En un universo tan inmenso, existen encuentros que hacen que todo se sienta diferente.',
  constellationText: 'Algunas luces parecen estar destinadas a encontrarse.',
  galaxyText: 'Y entre tantas galaxias, hay pequeñas cosas que hacen que un universo entero tenga sentido.',
  telescopeText: 'Hay cosas que solo se descubren cuando te acercas despacio.',
  eyepieceText: 'Asómate conmigo.',
  candleText: 'De todos los lugares que podríamos encontrar en el universo, quería mostrarte uno que lleva una letra muy especial.',
  togetherTitle: 'Otro año juntos',
  finalMessage: 'Que sigamos descubriendo universos, creando recuerdos y encontrando nuevas razones para sonreír.',
  signature: 'Con amor, Alejandro Duque (COLDEX)',
});

export const DEFAULT_CANDLE_LETTER = 'A';

export const DEFAULT_NICKNAMES = Object.freeze([
  'Mi niña',
  'Mi mujer',
  'Mi esposa',
  'Mi novia',
  'Mi vida',
  'Mi amor',
  'Mi amorchito',
  'Mi amorcito',
]);

/** El Año Nuevo que se celebra: en enero, el año en curso; el resto del año, el siguiente. */
export function defaultCelebrationYear(now = new Date()) {
  return now.getMonth() === 0 ? now.getFullYear() : now.getFullYear() + 1;
}

export function createDefaultPreferences(now = new Date()) {
  const palette = PALETTE_PRESETS.find((preset) => preset.id === DEFAULT_PALETTE_ID);
  return {
    schemaVersion: PREFERENCES_SCHEMA_VERSION,
    profile: {
      nicknames: [...DEFAULT_NICKNAMES],
      rotateNicknames: true,
    },
    appearance: {
      style: 'glass',
      theme: 'dark',
      paletteId: palette.id,
      palette: { ...palette.colors },
      motion: 'system',
    },
    presentation: {
      completed: false,
      completedAt: null,
      candleLetter: DEFAULT_CANDLE_LETTER,
      texts: { ...DEFAULT_PRESENTATION_TEXTS },
    },
    calendar: {
      weekStartsOn: 1,
    },
    dates: {
      relationshipStart: '2025-07-21',
      celebrationYear: defaultCelebrationYear(now),
      celebrationTime: '00:00',
      hourCycle: '12',
    },
    updatedAt: null,
  };
}
