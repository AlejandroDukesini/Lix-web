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
 */

export const CIRCUITS = [
  {
    id: 'bahia',
    name: 'Bahía Turquesa',
    difficulty: 'Fácil',
    description: 'Curvas amplias y paredes altas. Ideal para aprender a tomar la línea.',
    rivalPace: [0.84, 0.87, 0.9],
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
    rivalPace: [0.86, 0.89, 0.92],
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
    rivalPace: [0.88, 0.91, 0.94],
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
];

export const findCircuit = (id) => CIRCUITS.find((circuit) => circuit.id === id) ?? null;
