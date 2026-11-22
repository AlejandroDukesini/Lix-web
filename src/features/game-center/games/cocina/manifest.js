/**
 * Los tres juegos de cocina comparten motor (engine/orders.js), componente
 * (CookingGame.jsx) y estilos; cada uno es un juego independiente en la
 * biblioteca con su propio registro de estadísticas.
 */
import { BurgerArt, CakeArt, IceCreamArt, PizzaArt } from './CookingArt.jsx';
import { UPGRADES } from './engine/burgerEngine.js';
import { LEVEL_IDS, SHIFT } from './engine/orders.js';

const levelsProgress = (record) => {
  const stars = record?.progress?.stars ?? {};
  const done = LEVEL_IDS.filter((l) => stars[l]).length;
  return { done, total: LEVEL_IDS.length, label: `${done}/${LEVEL_IDS.length} niveles` };
};
const ordersHighlight = (record) => {
  const orders = record?.progress?.orders ?? 0;
  return orders ? `${orders} pedidos · ${record.progress.perfect ?? 0} perfectos` : null;
};
const DIFFICULTY = `Aprendiz (${SHIFT[1].orders} pedidos, sin reloj), Cocinero (${SHIFT[2].orders} pedidos, ${SHIFT[2].timeLimit} s cada uno) y Chef (${SHIFT[3].orders} pedidos, ${SHIFT[3].timeLimit} s): cada nivel pide más elementos y más precisión, y se desbloquea al superar el anterior.`;
const COMMON_HOW = [
  'Lee la comanda: el dibujo pequeño y la lista dicen exactamente lo que quiere el cliente.',
  'Ve paso a paso: al elegir, la cocina pasa sola al siguiente paso (o vuelve a cualquiera con sus pestañas). El plato muestra lo que llevas.',
  'Pulsa «Entregar». Verás cada elemento como correcto, casi, incorrecto, falta o sobra, y la precisión.',
  'Un turno se supera con la precisión media mínima del nivel. Con reloj, entregar rápido da puntos extra si la precisión es alta.',
];
const COMMON_KEYS = [
  ['1 – 9', 'Elegir una opción del paso actual'],
  ['← →', 'Paso anterior / siguiente'],
  ['Tab e Intro', 'Recorrer y pulsar botones'],
  ['Esc o P', 'Pausa (niveles con reloj)'],
];
const COMMON_TOUCH = [
  ['Toca una pestaña', 'Cambiar de paso'],
  ['Toca un ingrediente', 'Añadirlo o quitarlo'],
  ['Entregar', 'Servir el pedido'],
];
const INSPIRED = 'Inspirado en los minijuegos de cocina de Purble Place; dibujos, clientes y reglas propios.';

export const heladeriaManifest = {
  id: 'heladeria',
  phase: 4,
  badge: 'updated',
  title: 'Heladería',
  tagline: 'Helados a la carta: recipiente, bolas en orden, salsa y toppings.',
  description: `Los clientes (con nombre de estrella) traen su comanda y tú preparas el helado: el recipiente, las bolas de abajo arriba, la salsa y los toppings. Al entregar se compara elemento a elemento y se calcula la precisión. ${INSPIRED}`,
  categories: ['cocina', 'habilidad'],
  Art: IceCreamArt,
  palette: { a: '#ff9fc6', b: '#7fd0ff' },
  scene: 'day',
  facts: ['3 niveles', 'El orden de las bolas cuenta', 'Precisión elemento a elemento'],
  objective: 'Preparar cada helado exactamente como pide la comanda y superar el turno con la precisión mínima.',
  howTo: [...COMMON_HOW, 'Las bolas se apilan en el orden en que las añades; «Quitar la última» corrige un error.'],
  controls: { keyboard: COMMON_KEYS, touch: COMMON_TOUCH },
  difficulty: DIFFICULTY,
  load: () => import('./Heladeria.jsx'),
  progress: levelsProgress,
  highlight: ordersHighlight,
};

export const pizzeriaManifest = {
  id: 'pizzeria',
  phase: 4,
  badge: 'updated',
  title: 'Pizzería',
  tagline: 'Pizzas por encargo: ingredientes, mitades y el punto del horno.',
  description: `Tamaño, masa, salsa, queso e ingredientes y, al final, el horno: la aguja avanza en tiempo real y hay que sacarla en el punto pedido (poco hecha, al punto o bien hecha). En el nivel Chef hay ingredientes por mitades. ${INSPIRED}`,
  categories: ['cocina', 'habilidad'],
  Art: PizzaArt,
  palette: { a: '#ffb347', b: '#d8402b' },
  scene: 'day',
  facts: ['3 niveles', 'Horno en tiempo real', 'Ingredientes por mitades'],
  objective: 'Preparar y hornear cada pizza como pide la comanda y superar el turno con la precisión mínima.',
  howTo: [...COMMON_HOW, 'En «Cocción» mete la pizza al horno y sácala cuando la aguja esté en la zona pedida. Una zona al lado vale la mitad; quemada o cruda, nada.'],
  controls: { keyboard: COMMON_KEYS, touch: [...COMMON_TOUCH, ['Meter / Sacar del horno', 'Cocción en tiempo real']] },
  difficulty: DIFFICULTY,
  load: () => import('./Pizzeria.jsx'),
  progress: levelsProgress,
  highlight: ordersHighlight,
};

export const pasteleriaManifest = {
  id: 'pasteleria',
  phase: 4,
  badge: 'updated',
  title: 'Pastelería',
  tagline: 'Pasteles por encargo: capas, relleno, cobertura y decoración.',
  description: `Elige la forma, apila las capas de abajo arriba, rellena, cubre y decora. En el nivel Chef el cliente pide además un mensaje escrito. Al entregar se ve qué estaba bien y qué no. ${INSPIRED}`,
  categories: ['cocina', 'habilidad'],
  Art: CakeArt,
  palette: { a: '#ffb7c8', b: '#b48cff' },
  scene: 'day',
  facts: ['3 niveles', 'Capas en orden', 'Mensajes escritos en el nivel Chef'],
  objective: 'Montar cada pastel exactamente como pide la comanda y superar el turno con la precisión mínima.',
  howTo: [...COMMON_HOW, 'Las capas se apilan en el orden en que las añades (la primera es la de abajo).'],
  controls: { keyboard: COMMON_KEYS, touch: COMMON_TOUCH },
  difficulty: DIFFICULTY,
  load: () => import('./Pasteleria.jsx'),
  progress: levelsProgress,
  highlight: ordersHighlight,
};

export const hamburgueseriaManifest = {
  id: 'hamburgueseria',
  phase: 5,
  badge: 'new',
  title: 'Hamburguesería',
  tagline: 'Pedidos, plancha, montaje y entrega: un local con su ritmo.',
  description:
    'Abre «La plancha de la esquina» día tras día. Toma los pedidos en el mostrador, cocina cada carne por las dos caras en su punto, monta la hamburguesa capa a capa en el orden de la comanda y sírvela antes de que el cliente se impaciente. Cada entrega se valora por ingredientes, orden, cocción y tiempo; con las monedas mejoras la cocina. Inspirado en los juegos de restaurante por estaciones; local, clientes, dibujos y reglas propios.',
  categories: ['cocina', 'habilidad'],
  Art: BurgerArt,
  palette: { a: '#ffb347', b: '#d8402b' },
  scene: 'day',
  facts: ['3 estaciones en tiempo real', 'Ingredientes que se desbloquean', `${UPGRADES.length} mejoras de cocina`],
  objective: 'Servir a todos los clientes del día con la mejor nota: ingredientes exactos, en orden, la carne en su punto y a tiempo.',
  howTo: [
    'Pedidos: cuando llega un cliente, toma su comanda. Queda colgada en la barra de arriba, con su paciencia.',
    'Parrilla: pon carnes en la plancha. Se cocina la cara de abajo: voltéala cuando llegue a la zona verde y retírala cuando las dos estén en su punto.',
    'Montaje: elige la comanda y apila las capas de abajo arriba, igual que en la nota. Las carnes salen de la bandeja.',
    'Servir compara con la comanda: ingredientes, orden de las capas, cocción y tiempo de espera. Excelente, Muy bien, Correcto, Incompleto o Incorrecto.',
    'Cada día llegan más clientes y nuevos ingredientes. Con las monedas compras mejoras para la cocina.',
  ],
  controls: {
    keyboard: [
      ['1 · 2 · 3', 'Pedidos · Parrilla · Montaje'],
      ['Tab e Intro', 'Recorrer y pulsar botones'],
      ['Esc o P', 'Pausa'],
    ],
    touch: [
      ['Pestañas de abajo', 'Cambiar de estación'],
      ['Toca una comanda', 'Montar esa hamburguesa'],
      ['Toca un ingrediente', 'Ponerlo encima de la pila'],
    ],
  },
  difficulty: 'Día 1 con 4 clientes y 5 ingredientes; cada día llegan más clientes, menos paciencia, carnes dobles y puntos distintos.',
  load: () => import('./Hamburgueseria.jsx'),
  progress(record) {
    const days = Object.keys(record?.progress?.days ?? {}).length;
    return { done: Math.min(days, 7), total: 7, label: `${days} ${days === 1 ? 'día abierto' : 'días abiertos'}` };
  },
  highlight(record) {
    const served = record?.progress?.served ?? 0;
    return served ? `${served} hamburguesas · ${record.progress.excellent ?? 0} excelentes` : null;
  },
};
