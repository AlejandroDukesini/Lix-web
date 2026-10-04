/**
 * Circuitos originales de Aquapark.
 *
 * Un circuito es una lista de tramos. Cada tramo:
 *   len    número de segmentos (cada segmento mide SEGMENT_LENGTH metros)
 *   curve  curvatura (−1 izquierda … 1 derecha); entra y sale de forma suave
 *   drop   pendiente extra (solo visual: el tobogán siempre desciende)
 *   width  semiancho del canal (1 normal, ~0.7 estrecho)
 *   walls  false = tramo abierto: si te sales por el borde, caes al agua
 *   items  [{ at, type: 'float' | 'boost' | 'ramp', x }] posiciones dentro del tramo
 *
 * Reglas de diseño (comprobadas en tests/aquapark.test.js con un piloto automático):
 *  - toda fila de flotadores deja un hueco mayor que el ancho del jugador;
 *  - la fuerza centrífuga máxima siempre puede compensarse girando;
 *  - las rampas no aterrizan sobre flotadores.
 *
 * botScale ajusta el ritmo de los tres bots (Pro, Regular, Fácil) al circuito.
 */

export const CIRCUITS = [
  {
    id: 'bahia',
    name: 'Bahía Turquesa',
    difficulty: 'Fácil',
    description: 'Curvas amplias y paredes altas. Ideal para aprender a tomar la línea.',
    botScale: 0.93,
    theme: {
      sky: ['#5fd3f0', '#bff3ff'],
      sun: '#fff4c2',
      pool: ['#16b5d6', '#0b6f9c'],
      water: ['#3fd0f2', '#2bb8e6'],
      slide: ['#ff6f91', '#ffd166'],
      hills: '#2a9d8f',
      night: false,
    },
    sections: [
      { len: 30, curve: 0 },
      { len: 40, curve: 0.45, items: [{ at: 20, type: 'float', x: 0.45 }] },
      { len: 30, curve: 0, items: [{ at: 8, type: 'boost', x: 0 }, { at: 22, type: 'float', x: -0.4 }] },
      { len: 45, curve: -0.55, drop: 1 },
      { len: 25, curve: 0, items: [{ at: 10, type: 'ramp', x: 0 }] },
      { len: 40, curve: 0.6, items: [{ at: 12, type: 'float', x: -0.5 }, { at: 28, type: 'float', x: 0.5 }] },
      { len: 30, curve: 0, width: 0.8, items: [{ at: 14, type: 'boost', x: -0.3 }] },
      { len: 45, curve: -0.4, items: [{ at: 15, type: 'float', x: 0 }, { at: 34, type: 'float', x: -0.55 }] },
      { len: 35, curve: 0.3, drop: 1, items: [{ at: 18, type: 'boost', x: 0.3 }] },
      { len: 40, curve: 0 },
    ],
  },
  {
    id: 'cascada',
    name: 'Cascada Coral',
    difficulty: 'Media',
    description: 'Tramos sin paredes, rampas y pasos estrechos. Una mala línea acaba en la piscina.',
    botScale: 0.955,
    theme: {
      sky: ['#ff9a8b', '#ffe3b3'],
      sun: '#fff1d6',
      pool: ['#2ec4b6', '#127a83'],
      water: ['#4fd8e8', '#38bcd6'],
      slide: ['#ff5d73', '#fff07c'],
      hills: '#e76f51',
      night: false,
    },
    sections: [
      { len: 25, curve: 0 },
      { len: 40, curve: 0.65, items: [{ at: 20, type: 'float', x: 0.5 }] },
      { len: 30, curve: 0, walls: false, items: [{ at: 10, type: 'float', x: -0.45 }, { at: 22, type: 'boost', x: 0.35 }] },
      { len: 40, curve: -0.7, walls: false },
      { len: 25, curve: 0, items: [{ at: 8, type: 'ramp', x: 0 }, { at: 20, type: 'float', x: 0 }] },
      { len: 35, curve: 0.5, width: 0.7, items: [{ at: 17, type: 'float', x: -0.3 }] },
      { len: 30, curve: 0, drop: 2, items: [{ at: 6, type: 'boost', x: 0 }, { at: 20, type: 'float', x: -0.5 }, { at: 20, type: 'float', x: 0.5 }] },
      { len: 45, curve: -0.6, walls: false, items: [{ at: 22, type: 'float', x: 0.4 }] },
      { len: 30, curve: 0.75, items: [{ at: 15, type: 'float', x: -0.5 }] },
      { len: 25, curve: 0, items: [{ at: 6, type: 'ramp', x: 0 }] },
      { len: 40, curve: -0.5, width: 0.75, walls: false, items: [{ at: 26, type: 'boost', x: 0 }] },
      { len: 40, curve: 0, items: [{ at: 14, type: 'float', x: 0.45 }, { at: 26, type: 'float', x: -0.45 }] },
    ],
  },
  {
    id: 'remolino',
    name: 'Remolino Nocturno',
    difficulty: 'Difícil',
    description: 'De noche, con eses cerradas al aire libre y canales estrechos. Solo para quien domina la línea.',
    botScale: 0.985,
    theme: {
      sky: ['#1b1446', '#4a2a7a'],
      sun: '#f5e6ff',
      pool: ['#2b2d8a', '#120f3f'],
      water: ['#5b7cfa', '#3f5bd8'],
      slide: ['#ff4fd8', '#5ef2ff'],
      hills: '#1f1a52',
      night: true,
    },
    sections: [
      { len: 25, curve: 0 },
      { len: 35, curve: 0.8, items: [{ at: 18, type: 'float', x: 0.55 }] },
      { len: 35, curve: -0.85, walls: false, items: [{ at: 18, type: 'float', x: -0.5 }] },
      { len: 20, curve: 0, items: [{ at: 4, type: 'boost', x: 0 }, { at: 14, type: 'ramp', x: 0 }] },
      { len: 35, curve: 0.7, width: 0.68, walls: false },
      { len: 30, curve: 0, drop: 2, items: [{ at: 8, type: 'float', x: -0.5 }, { at: 8, type: 'float', x: 0.5 }, { at: 22, type: 'float', x: 0 }] },
      { len: 40, curve: -0.9, items: [{ at: 14, type: 'float', x: -0.55 }, { at: 30, type: 'float', x: 0.3 }] },
      { len: 30, curve: 0.6, walls: false, width: 0.75, items: [{ at: 15, type: 'boost', x: -0.3 }] },
      { len: 25, curve: 0, items: [{ at: 6, type: 'ramp', x: 0 }, { at: 19, type: 'float', x: 0.45 }] },
      { len: 40, curve: -0.75, walls: false, items: [{ at: 20, type: 'float', x: 0 }] },
      { len: 35, curve: 0.85, width: 0.7 },
      { len: 30, curve: 0, items: [{ at: 8, type: 'float', x: -0.45 }, { at: 8, type: 'float', x: 0.45 }, { at: 20, type: 'boost', x: 0 }] },
      { len: 40, curve: -0.5, walls: false, items: [{ at: 24, type: 'float', x: -0.4 }] },
      { len: 35, curve: 0 },
    ],
  },
  {
    id: 'tormenta',
    name: 'Tormenta Esmeralda',
    difficulty: 'Difícil',
    description: 'Eses encadenadas bajo la lluvia, un descenso con tres impulsos seguidos y un salto sobre flotadores.',
    botScale: 0.99,
    theme: {
      sky: ['#3d5a80', '#98c1d9'],
      sun: '#e0fbfc',
      pool: ['#2a9d8f', '#155e63'],
      water: ['#52d1c4', '#36b3a8'],
      slide: ['#80ed99', '#ffd166'],
      hills: '#1b4332',
      night: false,
    },
    sections: [
      { len: 25, curve: 0 },
      // Eses: izquierda-derecha encadenadas, cada una con su flotador en el exterior.
      { len: 24, curve: 0.7, items: [{ at: 12, type: 'float', x: 0.5 }] },
      { len: 24, curve: -0.7, items: [{ at: 12, type: 'float', x: -0.5 }] },
      { len: 24, curve: 0.7, walls: false, items: [{ at: 12, type: 'boost', x: -0.2 }] },
      { len: 24, curve: -0.7 },
      // Zona de aceleración: bajada pronunciada con tres impulsos en zigzag.
      { len: 30, curve: 0, drop: 3, items: [{ at: 4, type: 'boost', x: -0.4 }, { at: 12, type: 'boost', x: 0.4 }, { at: 20, type: 'boost', x: 0 }] },
      // Rampa: los flotadores quedan debajo del vuelo.
      { len: 25, curve: 0, items: [{ at: 5, type: 'ramp', x: 0 }, { at: 9, type: 'float', x: -0.4 }, { at: 9, type: 'float', x: 0.4 }] },
      { len: 40, curve: 0.55, width: 0.8, items: [{ at: 14, type: 'float', x: 0.3 }, { at: 28, type: 'float', x: -0.3 }] },
      { len: 30, curve: -0.8, walls: false, width: 0.85 },
      { len: 30, curve: 0, items: [{ at: 8, type: 'float', x: -0.55 }, { at: 8, type: 'float', x: 0.55 }, { at: 20, type: 'float', x: 0 }] },
      { len: 35, curve: 0.6, items: [{ at: 16, type: 'boost', x: 0.35 }] },
      { len: 30, curve: 0 },
    ],
  },
  {
    id: 'glaciar',
    name: 'Glaciar Azul',
    difficulty: 'Muy difícil',
    description: 'Canales de hielo muy estrechos con eslalon de flotadores: aquí gana la precisión, no la velocidad.',
    botScale: 0.995,
    theme: {
      sky: ['#a8dadc', '#f1faee'],
      sun: '#ffffff',
      pool: ['#457b9d', '#1d3557'],
      water: ['#bde0fe', '#a2d2ff'],
      slide: ['#caf0f8', '#48cae4'],
      hills: '#9ec9db',
      night: false,
    },
    sections: [
      { len: 25, curve: 0 },
      { len: 35, curve: 0.4, width: 0.7, items: [{ at: 18, type: 'float', x: 0.25 }] },
      // Eslalon en un canal estrecho.
      { len: 30, curve: 0, width: 0.65, items: [{ at: 8, type: 'float', x: -0.25 }, { at: 20, type: 'float', x: 0.25 }] },
      { len: 30, curve: -0.6, width: 0.7, walls: false },
      { len: 20, curve: 0, items: [{ at: 6, type: 'boost', x: 0 }] },
      { len: 35, curve: 0.75, width: 0.72, items: [{ at: 12, type: 'float', x: 0.3 }, { at: 26, type: 'float', x: -0.3 }] },
      { len: 25, curve: 0, items: [{ at: 5, type: 'ramp', x: 0 }] },
      { len: 40, curve: -0.5, width: 0.62, items: [{ at: 20, type: 'boost', x: 0 }] },
      { len: 30, curve: 0, width: 0.66, walls: false, items: [{ at: 15, type: 'float', x: 0 }] },
      { len: 35, curve: 0.85, width: 0.75 },
      { len: 30, curve: -0.85, width: 0.75, walls: false },
      { len: 35, curve: 0 },
    ],
  },
  {
    id: 'volcan',
    name: 'Volcán Termal',
    difficulty: 'Experto',
    description: 'Una espiral abierta interminable, saltos dobles y un sprint final de impulsos sobre aguas termales.',
    botScale: 1,
    theme: {
      sky: ['#2b0f0e', '#7a1f0f'],
      sun: '#ffb703',
      pool: ['#f48c06', '#9d0208'],
      water: ['#ffba08', '#faa307'],
      slide: ['#ff7b00', '#ffd000'],
      hills: '#3d0c02',
      night: true,
    },
    sections: [
      { len: 25, curve: 0 },
      // Espiral larga sin paredes: hay que sostener la línea.
      { len: 60, curve: 0.9, walls: false, width: 0.9, items: [{ at: 30, type: 'boost', x: 0.2 }] },
      { len: 25, curve: 0, items: [{ at: 6, type: 'ramp', x: 0 }, { at: 18, type: 'float', x: -0.45 }, { at: 18, type: 'float', x: 0.45 }] },
      { len: 30, curve: -0.85, width: 0.7, items: [{ at: 15, type: 'float', x: -0.25 }] },
      { len: 25, curve: 0, drop: 3, items: [{ at: 5, type: 'boost', x: 0 }, { at: 15, type: 'boost', x: 0 }] },
      { len: 40, curve: 0.95, walls: false, items: [{ at: 12, type: 'float', x: 0.4 }, { at: 28, type: 'float', x: -0.4 }] },
      // Doble salto.
      { len: 25, curve: 0, items: [{ at: 4, type: 'ramp', x: 0 }, { at: 16, type: 'ramp', x: 0 }] },
      { len: 35, curve: -0.7, width: 0.68, walls: false },
      { len: 40, curve: 0, items: [{ at: 8, type: 'float', x: -0.5 }, { at: 8, type: 'float', x: 0.5 }, { at: 22, type: 'float', x: -0.3 }, { at: 36, type: 'float', x: 0.4 }] },
      { len: 40, curve: 0.8, width: 0.72, items: [{ at: 20, type: 'boost', x: 0 }] },
      { len: 30, curve: -0.9, walls: false },
      // Sprint final.
      { len: 30, curve: 0, items: [{ at: 6, type: 'boost', x: -0.3 }, { at: 16, type: 'boost', x: 0.3 }] },
      { len: 30, curve: 0 },
    ],
  },
];

export const findCircuit = (id) => CIRCUITS.find((circuit) => circuit.id === id) ?? null;
