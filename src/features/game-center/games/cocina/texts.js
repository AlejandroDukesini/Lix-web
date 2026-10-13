/** Textos de cada juego de cocina (la mecánica es común; cambia la receta y el tono). */
export const TEXTS = Object.freeze({
  heladeria: {
    title: 'Heladería',
    heading: 'Helados a la carta',
    intro: 'Cada cliente trae su comanda: recipiente, bolas en orden, salsa y toppings. Prepáralo igual y entrégalo. El orden de las bolas cuenta (de abajo arriba).',
    levels: { 1: 'recipiente y 1-2 bolas', 2: '+ salsa y toppings', 3: '3-4 bolas y más toppings' },
    winMessage: '¡Todos los clientes se fueron con su helado!',
  },
  pizzeria: {
    title: 'Pizzería',
    heading: 'Pizzas por encargo',
    intro: 'Tamaño, masa, salsa, queso e ingredientes, y al horno: sácala en el punto pedido. En el nivel Chef hay pedidos por mitades.',
    levels: { 1: 'ingredientes y horno al punto', 2: '+ masa y puntos de cocción', 3: 'ingredientes por mitades' },
    winMessage: '¡Todas las pizzas salieron a tiempo!',
  },
  pasteleria: {
    title: 'Pastelería',
    heading: 'Pasteles por encargo',
    intro: 'Forma, capas de abajo arriba, relleno, cobertura y decoración. En el nivel Chef, además, el mensaje que piden escrito.',
    levels: { 1: 'una capa y una decoración', 2: '2 capas con relleno', 3: 'hasta 3 capas y mensaje' },
    winMessage: '¡Todos los pasteles listos para celebrar!',
  },
});
