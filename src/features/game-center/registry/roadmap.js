/**
 * Hoja de ruta del Game Center (fase 4; las fases 1 a 3 ya están implementadas).
 *
 * Son solo planificación: no tienen componente ni ruta, y la biblioteca los
 * muestra como "próximas incorporaciones" sin ningún botón de jugar.
 * Cuando llegue su fase, cada uno se convertirá en una carpeta en games/ con su
 * manifest.js y se añadirá a GAMES en gameRegistry.js (ver README).
 *
 * Todos serán implementaciones originales: sin personajes, nombres comerciales,
 * música, niveles ni recursos de franquicias existentes.
 */
export const ROADMAP = Object.freeze([
  {
    phase: 4,
    title: 'Juegos adicionales',
    games: [
      { id: 'bloques', title: 'Bloques que caen', note: 'Clásico de encajar piezas, con piezas y reglas propias.', categories: ['clasicos', 'logica'] },
      { id: 'stellarium', title: 'Stellarium', note: 'Explorar el cielo nocturno y sus constelaciones.', categories: ['exploracion'] },
      { id: 'lava-y-agua', title: 'Lava and Aqua', note: 'Cuadrículas donde hay que encontrar rutas seguras entre la lava.', categories: ['logica', 'aventura'] },
      { id: 'cocina', title: 'Cocina de pedidos', note: 'Helados, pasteles y pizzas según lo que pidan los clientes.', categories: ['habilidad'] },
    ],
  },
]);
