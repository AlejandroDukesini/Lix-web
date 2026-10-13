/**
 * Estructura de la biblioteca: estantes (categorías) → recorridos (subcategorías)
 * → documentos.
 *
 * Los documentos NO se registran aquí: cada archivo .md de content/<estante>/ se
 * coloca solo en su recorrido mediante su cabecera (`category`, `path`, `order`).
 * Este archivo solo define los estantes y el orden de sus recorridos.
 *
 * `planned` lista temas que todavía no tienen documento: se muestran como «En
 * preparación», sin enlace, para no prometer lecturas que no existen.
 */
import { Fingerprint, Languages, ScrollText, Telescope } from 'lucide-react';

export const DIFFICULTIES = Object.freeze([
  { id: 'inicial', label: 'Inicial', description: 'Sin conocimientos previos' },
  { id: 'intermedio', label: 'Intermedio', description: 'Conviene haber leído los primeros capítulos' },
  { id: 'avanzado', label: 'Avanzado', description: 'Ideas exigentes, explicadas paso a paso' },
]);

export const SHELVES = Object.freeze([
  {
    id: 'cosmos',
    label: 'Astronomía, cosmología y física',
    short: 'Cosmos',
    icon: Telescope,
    description:
      'De las tablillas babilónicas a las ondas gravitacionales: cómo aprendimos a leer el cielo y qué leyes explican su luz.',
    paths: [
      { id: 'primeros-observadores', title: 'Los primeros observadores del cielo' },
      { id: 'revolucion', title: 'La revolución astronómica' },
      { id: 'universo-observable', title: 'El universo que observamos' },
      { id: 'origen', title: 'El origen y la evolución del universo' },
      { id: 'leyes', title: 'Las leyes que gobiernan la naturaleza' },
      { id: 'grandes-preguntas', title: 'Las grandes preguntas' },
    ],
    planned: [
      'Telescopios: del vidrio de Galileo a los espejos segmentados',
      'Cometas, asteroides y el cinturón de Kuiper',
      'La Luna: origen, exploración y regreso',
      'Física de partículas: el modelo estándar en detalle',
    ],
  },
  {
    id: 'criminalistica',
    label: 'Criminalística e investigación forense',
    short: 'Criminalística',
    icon: Fingerprint,
    description:
      'Cómo se protege una escena, qué puede decir una huella y por qué el método importa más que la intuición del detective.',
    paths: [
      { id: 'origenes', title: 'Los orígenes del método' },
      { id: 'escena', title: 'La escena y sus evidencias' },
      { id: 'laboratorio', title: 'Lo que el laboratorio escucha' },
      { id: 'razonamiento', title: 'Razonar con pruebas' },
    ],
    planned: [
      'Rastros de contacto: fibras, vidrio, pintura y suelo',
      'Toxicología forense: venenos, drogas y tiempos',
      'Casos que cambiaron la investigación criminal en América Latina',
    ],
  },
  {
    id: 'idiomas',
    label: 'Idiomas: español, inglés y alemán',
    short: 'Idiomas',
    icon: Languages,
    description:
      'Tres lenguas emparentadas contadas a través de viajes, conversaciones y errores que todos cometemos alguna vez.',
    paths: [
      { id: 'raices', title: 'Raíces y sonidos' },
      { id: 'primeros-pasos', title: 'Primeros pasos' },
      { id: 'gramatica', title: 'Gramática con historia' },
      { id: 'cultura', title: 'Matices y lecturas' },
    ],
    planned: [
      'El alemán en el trabajo: correos, reuniones y cortesía',
      'Inglés para estudiar: leer artículos y tomar notas',
      'Lecturas de nivel avanzado: cuentos breves comentados',
    ],
  },
  {
    id: 'creencias',
    label: 'Religiones, mitologías y tradiciones espirituales',
    short: 'Creencias',
    icon: ScrollText,
    description:
      'Dioses, profetas y preguntas eternas, contados con respeto y separando lo que una tradición cree de lo que la historia puede establecer.',
    paths: [
      { id: 'mitologias', title: 'Mitologías antiguas' },
      { id: 'abrahamicas', title: 'Las tradiciones abrahámicas' },
      { id: 'oriente', title: 'Tradiciones de Asia' },
      { id: 'preguntas', title: 'Las preguntas de fondo' },
    ],
    planned: [
      'Sijismo, jainismo y religiones de Asia oriental',
      'Religiones africanas y afroamericanas',
      'Mística comparada: cábala, sufismo y contemplación cristiana',
    ],
  },
]);

export const findShelf = (id) => SHELVES.find((shelf) => shelf.id === id) ?? null;
export const difficultyLabel = (id) => DIFFICULTIES.find((d) => d.id === id)?.label ?? id;
