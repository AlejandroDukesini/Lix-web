/**
 * Datos iniciales de estructura (no son datos personales): categorías de gastos e
 * ingresos, categorías del calendario y un repertorio de emociones. Se crean una
 * sola vez, se pueden editar, archivar o borrar, y tienen ids fijos para que al
 * combinar copias de dos dispositivos no se dupliquen.
 */

const expense = (slug, name, icon, color, children = []) => ({ slug, name, icon, color, type: 'expense', children });
const income = (slug, name, icon, color) => ({ slug, name, icon, color, type: 'income', children: [] });

export const FINANCE_CATEGORY_SEEDS = [
  expense('alimentacion', 'Alimentación', 'utensils', '#e07a5f', [
    ['mercado', 'Mercado'],
    ['restaurantes', 'Restaurantes y domicilios'],
    ['cafe', 'Café y antojos'],
  ]),
  expense('transporte', 'Transporte', 'bus', '#3d8bd9', [
    ['transporte-publico', 'Transporte público'],
    ['taxi', 'Taxi y aplicaciones'],
  ]),
  expense('vivienda', 'Vivienda y servicios', 'home', '#6fa58b', [
    ['arriendo', 'Arriendo'],
    ['servicios', 'Servicios públicos'],
    ['internet', 'Internet y celular'],
  ]),
  expense('educacion', 'Educación', 'graduation-cap', '#8e5bd8', [
    ['matricula', 'Matrícula'],
    ['materiales', 'Libros, materiales y fotocopias'],
    ['cursos', 'Cursos'],
  ]),
  expense('salud', 'Salud', 'heart-pulse', '#d6336c'),
  expense('cuidado', 'Ropa y cuidado personal', 'shirt', '#f0a6ca'),
  expense('ocio', 'Ocio y salidas', 'film', '#f5b961'),
  expense('suscripciones', 'Suscripciones', 'music', '#a78bfa'),
  expense('regalos', 'Regalos', 'gift', '#ff7a7a'),
  expense('otros-gastos', 'Otros gastos', 'tag', '#8a8a9a'),
  income('ingresos-trabajo', 'Trabajo', 'briefcase', '#17a673'),
  income('apoyo', 'Apoyo familiar', 'heart-pulse', '#2bb3a3'),
  income('becas', 'Becas y apoyos', 'graduation-cap', '#4caf50'),
  income('ventas', 'Ventas', 'shopping-bag', '#7cb342'),
  income('otros-ingresos', 'Otros ingresos', 'coins', '#26a69a'),
];

/** Categorías como registros (principal y subcategorías), con ids estables. */
export function financeCategoryRecords() {
  const out = [];
  for (const seed of FINANCE_CATEGORY_SEEDS) {
    const id = `seed-cat-${seed.slug}`;
    out.push({ id, name: seed.name, type: seed.type, icon: seed.icon, color: seed.color, parentId: null });
    for (const [slug, name] of seed.children) {
      out.push({ id: `seed-cat-${slug}`, name, type: seed.type, icon: seed.icon, color: seed.color, parentId: id });
    }
  }
  return out;
}

export const EVENT_CATEGORY_SEEDS = [
  { id: 'seed-evc-universidad', name: 'Universidad', color: '#8e5bd8' },
  { id: 'seed-evc-personal', name: 'Personal', color: '#ef6f8c' },
  { id: 'seed-evc-salud', name: 'Salud', color: '#2bb3a3' },
  { id: 'seed-evc-familia', name: 'Familia', color: '#f5b961' },
  { id: 'seed-evc-ocio', name: 'Ocio', color: '#3d8bd9' },
];

/**
 * Repertorio de emociones. Incluye estados agradables, desagradables y mixtos:
 * no se reduce a «feliz / triste». Las descripciones orientan sin diagnosticar.
 */
export const EMOTION_SEEDS = [
  ['alegria', 'Alegría', 'pleasant', '#f5b961', 'Algo se siente bien y dan ganas de compartirlo.'],
  ['calma', 'Calma', 'pleasant', '#6fa58b', 'Tranquilidad, sin urgencia.'],
  ['gratitud', 'Gratitud', 'pleasant', '#e9c46a', 'Reconocer algo bueno que se recibió.'],
  ['entusiasmo', 'Entusiasmo', 'pleasant', '#ff9f68', 'Energía e ilusión por lo que viene.'],
  ['ternura', 'Amor y ternura', 'pleasant', '#ef6f8c', 'Cariño y cercanía con alguien.'],
  ['orgullo', 'Orgullo', 'pleasant', '#d4a23c', 'Satisfacción por algo logrado.'],
  ['esperanza', 'Esperanza', 'pleasant', '#7dd3fc', 'Confianza en que algo puede mejorar.'],
  ['alivio', 'Alivio', 'pleasant', '#8be3b8', 'Se soltó una preocupación.'],
  ['curiosidad', 'Curiosidad', 'pleasant', '#a78bfa', 'Ganas de entender o descubrir.'],
  ['tristeza', 'Tristeza', 'unpleasant', '#5b7db1', 'Algo duele o se echa de menos.'],
  ['ansiedad', 'Ansiedad', 'unpleasant', '#9d7bd8', 'Inquietud por lo que podría pasar.'],
  ['miedo', 'Miedo', 'unpleasant', '#6b5b95', 'Sensación de amenaza o peligro.'],
  ['enojo', 'Enojo', 'unpleasant', '#d6336c', 'Algo se sintió injusto o invadió un límite.'],
  ['frustracion', 'Frustración', 'unpleasant', '#c8553d', 'Algo no salió como se esperaba.'],
  ['estres', 'Estrés', 'unpleasant', '#e07a5f', 'Demasiadas exigencias a la vez.'],
  ['cansancio', 'Cansancio', 'unpleasant', '#8a8a9a', 'Falta de energía física o mental.'],
  ['soledad', 'Soledad', 'unpleasant', '#4f6d8f', 'Deseo de compañía o de ser comprendida.'],
  ['culpa', 'Culpa', 'unpleasant', '#9d2449', 'Sentir que algo que se hizo estuvo mal.'],
  ['verguenza', 'Vergüenza', 'unpleasant', '#b5838d', 'Incomodidad por cómo nos ven.'],
  ['decepcion', 'Decepción', 'unpleasant', '#6d6875', 'Una expectativa que no se cumplió.'],
  ['nostalgia', 'Nostalgia', 'mixed', '#c9a0dc', 'Echar de menos algo que fue bonito.'],
  ['ambivalencia', 'Ambivalencia', 'mixed', '#b39ddb', 'Sentir dos cosas opuestas a la vez.'],
  ['sorpresa', 'Sorpresa', 'mixed', '#4fc3f7', 'Algo inesperado, para bien o para mal.'],
  ['confusion', 'Confusión', 'mixed', '#90a4ae', 'No tener claro qué se siente o qué pasa.'],
  ['neutral', 'Neutral', 'neutral', '#a0a0a0', 'Un momento sin una emoción marcada.'],
].map(([slug, name, valence, color, description], index) => ({
  id: `seed-emo-${slug}`,
  name,
  valence,
  color,
  description,
  builtin: true,
  order: index,
}));
