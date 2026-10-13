/**
 * Recetas de los tres juegos de cocina. Solo datos: el motor (engine/orders.js)
 * genera pedidos y evalúa; cada componente visual dibuja con estos colores.
 * `from`: primer nivel en el que aparece el paso u opción.
 */

export const HELADERIA = Object.freeze({
  id: 'heladeria',
  noun: 'helado',
  steps: [
    {
      id: 'recipiente',
      label: 'Recipiente',
      kind: 'single',
      options: [
        { id: 'cono', label: 'Cono', color: '#e3a65b' },
        { id: 'tarrina', label: 'Tarrina', color: '#f4f0ff' },
        { id: 'cono-choco', label: 'Cono de chocolate', color: '#6b3d26', from: 2 },
      ],
    },
    {
      id: 'bolas',
      label: 'Bolas',
      itemLabel: 'Bola',
      hint: 'De abajo arriba',
      kind: 'sequence',
      count: { 1: [1, 2], 2: [2, 3], 3: [3, 4] },
      maxBuild: 5,
      options: [
        { id: 'vainilla', label: 'Vainilla', color: '#fbefc9' },
        { id: 'chocolate', label: 'Chocolate', color: '#7a4a2e' },
        { id: 'fresa', label: 'Fresa', color: '#ff9fb8' },
        { id: 'menta', label: 'Menta', color: '#a8ecd2', from: 2 },
        { id: 'mango', label: 'Mango', color: '#ffc04d', from: 3 },
      ],
    },
    {
      id: 'salsa',
      label: 'Salsa',
      kind: 'single',
      from: 2,
      options: [
        { id: 'ninguna', label: 'Sin salsa', color: 'transparent' },
        { id: 'chocolate', label: 'Chocolate', color: '#4a2716' },
        { id: 'caramelo', label: 'Caramelo', color: '#d38a2a' },
        { id: 'frutos-rojos', label: 'Frutos rojos', color: '#b3123c' },
      ],
    },
    {
      id: 'toppings',
      label: 'Toppings',
      kind: 'set',
      from: 2,
      count: { 2: [0, 1], 3: [1, 3] },
      options: [
        { id: 'chispas', label: 'Chispas de colores', color: '#ff6fb1' },
        { id: 'nueces', label: 'Nueces', color: '#a86b3c' },
        { id: 'cereza', label: 'Cereza', color: '#e0102f' },
        { id: 'galleta', label: 'Galleta', color: '#c98d4a' },
        { id: 'barquillo', label: 'Barquillo', color: '#f0c27a', from: 3 },
      ],
    },
  ],
});

export const PIZZERIA = Object.freeze({
  id: 'pizzeria',
  noun: 'pizza',
  steps: [
    {
      id: 'tamano',
      label: 'Tamaño',
      kind: 'single',
      options: [
        { id: 'pequena', label: 'Pequeña' },
        { id: 'mediana', label: 'Mediana' },
        { id: 'grande', label: 'Grande' },
      ],
    },
    {
      id: 'masa',
      label: 'Masa',
      kind: 'single',
      from: 2,
      options: [
        { id: 'clasica', label: 'Clásica', color: '#e9c48a' },
        { id: 'fina', label: 'Fina', color: '#f1d5a3' },
        { id: 'integral', label: 'Integral', color: '#b98a55' },
      ],
    },
    {
      id: 'salsa',
      label: 'Salsa',
      kind: 'single',
      options: [
        { id: 'tomate', label: 'Tomate', color: '#d8402b' },
        { id: 'crema', label: 'Crema', color: '#f6ecd8' },
        { id: 'pesto', label: 'Pesto', color: '#5e9a3a', from: 3 },
      ],
    },
    {
      id: 'queso',
      label: 'Queso',
      kind: 'single',
      options: [
        { id: 'mozzarella', label: 'Mozzarella', color: '#fff4cf' },
        { id: 'doble', label: 'Doble queso', color: '#ffe79a' },
        { id: 'sin', label: 'Sin queso', color: 'transparent', from: 2 },
      ],
    },
    {
      id: 'ingredientes',
      label: 'Ingredientes',
      kind: 'placement',
      count: { 1: [1, 2], 2: [2, 3], 3: [3, 4] },
      halvesFrom: 3,
      options: [
        { id: 'pepperoni', label: 'Pepperoni', color: '#b8242a' },
        { id: 'champinones', label: 'Champiñones', color: '#d9c7b0' },
        { id: 'aceitunas', label: 'Aceitunas', color: '#2b2b2b' },
        { id: 'pimiento', label: 'Pimiento', color: '#3fa34d' },
        { id: 'cebolla', label: 'Cebolla', color: '#c99bd8' },
        { id: 'jamon', label: 'Jamón', color: '#f19aa6', from: 2 },
        { id: 'pina', label: 'Piña', color: '#ffd84d', from: 2 },
        { id: 'albahaca', label: 'Albahaca', color: '#2f7d32', from: 3 },
      ],
    },
    { id: 'coccion', label: 'Cocción', kind: 'bake' },
  ],
  // En el primer nivel siempre se pide «al punto»: se aprende el horno sin presión.
  fixOrder(order, level) {
    if (level === 1) order.coccion = 'media';
  },
});

export const PASTELERIA = Object.freeze({
  id: 'pasteleria',
  noun: 'pastel',
  steps: [
    {
      id: 'forma',
      label: 'Forma',
      kind: 'single',
      options: [
        { id: 'redondo', label: 'Redondo' },
        { id: 'cuadrado', label: 'Cuadrado' },
        { id: 'corazon', label: 'Corazón', from: 2 },
      ],
    },
    {
      id: 'capas',
      label: 'Capas',
      itemLabel: 'Capa',
      hint: 'De abajo arriba',
      kind: 'sequence',
      count: { 1: [1, 1], 2: [2, 2], 3: [2, 3] },
      maxBuild: 4,
      options: [
        { id: 'vainilla', label: 'Vainilla', color: '#f7e2a8' },
        { id: 'chocolate', label: 'Chocolate', color: '#6a3b22' },
        { id: 'fresa', label: 'Fresa', color: '#f6a3b5' },
        { id: 'zanahoria', label: 'Zanahoria', color: '#e8954a', from: 3 },
      ],
    },
    {
      id: 'relleno',
      label: 'Relleno',
      kind: 'single',
      from: 2,
      options: [
        { id: 'fresa', label: 'Mermelada de fresa', color: '#d42c4f' },
        { id: 'crema', label: 'Crema', color: '#fff8ea' },
        { id: 'chocolate', label: 'Chocolate', color: '#4a2716' },
        { id: 'dulce-de-leche', label: 'Dulce de leche', color: '#c27a35' },
      ],
    },
    {
      id: 'cobertura',
      label: 'Cobertura',
      kind: 'single',
      options: [
        { id: 'vainilla', label: 'Vainilla', color: '#fff3d6' },
        { id: 'chocolate', label: 'Chocolate', color: '#5a321d' },
        { id: 'fresa', label: 'Fresa', color: '#ffb7c8' },
        { id: 'merengue', label: 'Merengue', color: '#ffffff', from: 2 },
      ],
    },
    {
      id: 'decoracion',
      label: 'Decoración',
      kind: 'set',
      count: { 1: [1, 1], 2: [1, 2], 3: [2, 3] },
      options: [
        { id: 'fresas', label: 'Fresas', color: '#e0233f' },
        { id: 'velas', label: 'Velas', color: '#7fb8ff' },
        { id: 'chispas', label: 'Chispas', color: '#ffd166' },
        { id: 'flores', label: 'Flores de azúcar', color: '#ff8fc7', from: 2 },
        { id: 'estrellas', label: 'Estrellas de azúcar', color: '#ffe27a', from: 3 },
      ],
    },
    {
      id: 'mensaje',
      label: 'Mensaje',
      kind: 'single',
      from: 3,
      options: [
        { id: 'ninguno', label: 'Sin mensaje' },
        { id: 'feliz-ano', label: '«Feliz año»' },
        { id: 'te-quiero', label: '«Te quiero»' },
        { id: 'un-ano-mas', label: '«Un año más»' },
      ],
    },
  ],
});

export const RECIPES = Object.freeze({ heladeria: HELADERIA, pizzeria: PIZZERIA, pasteleria: PASTELERIA });
