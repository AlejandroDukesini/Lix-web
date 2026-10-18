/**
 * Contenido del diario emocional. Sugerencias para ayudar a poner palabras, nunca
 * listas cerradas: todo se puede escribir libremente y todo es opcional.
 */

export const VALENCE_LABELS = { pleasant: 'Agradables', unpleasant: 'Desagradables', mixed: 'Mixtas', neutral: 'Neutras' };
export const VALENCE_SINGULAR = { pleasant: 'Agradable', unpleasant: 'Desagradable', mixed: 'Mixta', neutral: 'Neutra' };

export const MOODS = [
  { value: -2, label: 'Muy bajo' },
  { value: -1, label: 'Bajo' },
  { value: 0, label: 'Neutral' },
  { value: 1, label: 'Bien' },
  { value: 2, label: 'Muy bien' },
];

export const CONTEXTS = ['Universidad', 'Trabajo', 'Familia', 'Pareja', 'Amistades', 'Salud', 'Dinero', 'Casa', 'Redes sociales', 'Tiempo a solas'];
export const FACTORS = ['Poco sueño', 'Cansancio', 'Hambre', 'Clima', 'Exámenes o entregas', 'Una conversación', 'Ejercicio', 'Ciclo o salud física', 'Noticias', 'Pantallas'];
export const NEEDS = ['Descanso', 'Compañía', 'Espacio', 'Comprensión', 'Seguridad', 'Reconocimiento', 'Movimiento', 'Claridad', 'Ayuda práctica', 'Cariño'];
export const STRATEGIES = ['Respirar', 'Caminar', 'Hablar con alguien', 'Escribir', 'Música', 'Dormir', 'Llorar', 'Hacer ejercicio', 'Pausa de pantallas', 'Pedir ayuda'];

export const REFLECTION_QUESTIONS = [
  { id: 'ocurrio', text: '¿Qué ocurrió?' },
  { id: 'senti', text: '¿Qué sentí y con qué intensidad?' },
  { id: 'necesitaba', text: '¿Qué necesitaba en ese momento?' },
  { id: 'control', text: '¿Qué estuvo bajo mi control y qué no?' },
  { id: 'ayudo', text: '¿Qué me ayudó a sentirme mejor?' },
  { id: 'diferente', text: '¿Qué me gustaría hacer diferente la próxima vez?' },
];

/** Ejercicios de respiración: fases con su duración en segundos. */
export const BREATHING = [
  {
    id: 'cuadrada',
    name: 'Respiración cuadrada',
    description: 'Cuatro tiempos iguales. Ayuda a bajar el ritmo cuando todo va rápido.',
    phases: [
      { label: 'Inhala', seconds: 4, scale: 1 },
      { label: 'Sostén', seconds: 4, scale: 1 },
      { label: 'Exhala', seconds: 4, scale: 0.55 },
      { label: 'Sostén', seconds: 4, scale: 0.55 },
    ],
  },
  {
    id: 'exhalacion-larga',
    name: 'Exhalación larga',
    description: 'Soltar el aire más despacio de lo que entra suele ayudar a calmarse.',
    phases: [
      { label: 'Inhala', seconds: 4, scale: 1 },
      { label: 'Exhala despacio', seconds: 6, scale: 0.55 },
    ],
  },
];

export const GROUNDING = [
  { count: 5, text: 'cosas que puedes ver a tu alrededor' },
  { count: 4, text: 'cosas que puedes tocar (la ropa, la mesa, tus manos)' },
  { count: 3, text: 'sonidos que puedes escuchar' },
  { count: 2, text: 'olores que puedes notar (o dos que te gusten)' },
  { count: 1, text: 'cosa que puedes saborear, o una respiración profunda' },
];

export const SELF_CARE = [
  'Tomar agua y comer algo si hace rato no lo haces.',
  'Salir cinco minutos a caminar o asomarte a una ventana.',
  'Escribirle a alguien de confianza, aunque sea un mensaje corto.',
  'Darte permiso para no resolverlo todo hoy.',
  'Poner una canción que te guste y escucharla entera.',
  'Ordenar algo pequeño: el escritorio, una lista, una carpeta.',
  'Cambiar de lugar o de postura y estirar el cuello y los hombros.',
  'Preguntarte: ¿qué le diría a alguien que quiero si se sintiera así?',
];
