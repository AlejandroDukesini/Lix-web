/**
 * Niveles de la IA local (separados del motor para que la biblioteca no lo cargue entero).
 *
 * Son una progresión de dificultad del juego, no una equivalencia con jugadores
 * humanos de esa edad. Cada nivel cambia el comportamiento real del buscador:
 *   depth            jugadas que calcula por adelantado (medias jugadas)
 *   quiescence       si prolonga el cálculo en las capturas (ve las recapturas)
 *   randomChance     probabilidad de jugar una jugada legal cualquiera
 *   randomness       probabilidad de elegir entre las jugadas "razonables"…
 *   margin           …que no sean peores que la mejor en más de este margen (centipeones)
 *   timeMs           tiempo máximo de cálculo
 */
export const AI_LEVELS = Object.freeze([
  {
    id: 'bebe',
    name: 'Bebé',
    description: 'Mueve casi al azar y no ve las amenazas. Para aprender sin presión.',
    depth: 1,
    quiescence: false,
    randomChance: 0.45,
    randomness: 0.9,
    margin: 350,
    timeMs: 300,
  },
  {
    id: 'nino',
    name: 'Niño',
    description: 'Captura lo que ve a primera vista, pero se olvida de defender.',
    depth: 1,
    quiescence: false,
    randomChance: 0.1,
    randomness: 0.5,
    margin: 120,
    timeMs: 400,
  },
  {
    id: 'adolescente',
    name: 'Adolescente',
    description: 'Mira las amenazas directas y protege sus piezas.',
    depth: 2,
    quiescence: true,
    randomChance: 0,
    randomness: 0.25,
    margin: 60,
    timeMs: 800,
  },
  {
    id: 'joven',
    name: 'Joven',
    description: 'Calcula tácticas sencillas y evalúa la posición con constancia.',
    depth: 3,
    quiescence: true,
    randomChance: 0,
    randomness: 0.08,
    margin: 30,
    timeMs: 1300,
  },
  {
    id: 'adulto',
    name: 'Adulto',
    description: 'Busca más hondo y casi no regala nada. Hay que pensar cada jugada.',
    depth: 4,
    quiescence: true,
    randomChance: 0,
    randomness: 0,
    margin: 0,
    timeMs: 2000,
  },
]);

/** Identificadores de versiones anteriores (3 niveles) → niveles actuales. */
const LEGACY = { novato: 'nino', intermedio: 'adolescente', avanzado: 'adulto' };

export const normalizeLevelId = (id) => LEGACY[id] ?? id;

export const findLevel = (id) => AI_LEVELS.find((level) => level.id === normalizeLevelId(id)) ?? AI_LEVELS[0];
