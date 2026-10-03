/**
 * Casos originales de «Resolver casos».
 *
 * Estructura de un caso (la valida engine/caseEngine.js → validateCase):
 *   id, title, difficulty (1–5), place, intro, question
 *   scene.kind        decorado del escenario (SceneBackdrop)
 *   scene.hotspots    objetos que se pueden examinar: { id, label, icon, x, y (en %), clue }
 *   people            personas implicadas: { id, name, role, hue, statement }
 *                     interrogarlas añade su declaración al expediente (pista `t-<id>`)
 *   clues             pistas: { title, text, kind: 'object' | 'document' }
 *                     `contradicts: personId` marca la pista que desmiente una declaración;
 *                     `alibi: personId`, la que descarta a un sospechoso
 *   solution          { culprit, evidence: [ids de pistas que la desmienten],
 *                       requires: [pistas imprescindibles antes de acusar], explanation }
 *   hints             ayudas graduales (cada una cuesta una estrella)
 *   reveals           { personId: clueId } pistas que aparecen al interrogar a alguien
 *
 * Regla de diseño: cada caso se resuelve SOLO con lo que se muestra. Una
 * declaración del culpable queda desmentida por una prueba concreta, y los
 * demás sospechosos quedan descartados por otras pruebas (coartadas). Acusar
 * exige haber encontrado lo imprescindible y elegir, además del culpable, la
 * prueba que lo desmiente: no se resuelve pulsando opciones al azar.
 */
export const CASES = Object.freeze([
  {
    id: 'pastel',
    title: 'El pastel de la abuela',
    difficulty: 1,
    place: 'Cocina de la casa familiar',
    intro:
      'A las 17:00 el pastel de chocolate para el cumpleaños de la abuela estaba sobre la mesa de la cocina. A las 17:30 solo quedaba el plato. En esa media hora había tres personas en casa.',
    question: '¿Quién se comió el pastel?',
    scene: {
      kind: 'kitchen',
      hotspots: [
        { id: 'plato', label: 'Plato vacío', icon: 'plate', x: 50, y: 52, clue: 'migas' },
        { id: 'suelo', label: 'Suelo junto a la mesa', icon: 'footprints', x: 30, y: 82, clue: 'huellas' },
        { id: 'puerta', label: 'Puerta del jardín', icon: 'door', x: 10, y: 50, clue: 'botas' },
        { id: 'encimera', label: 'Encimera', icon: 'receipt', x: 82, y: 46, clue: 'ticket' },
      ],
    },
    people: [
      { id: 'tomas', name: 'Tomás', role: 'Primo', hue: 28, statement: 'Estuve toda la tarde en el jardín regando las plantas. No pisé la cocina.' },
      { id: 'lucia', name: 'Lucía', role: 'Hermana', hue: 300, statement: 'Estuve en mi cuarto con los auriculares puestos hasta que me llamasteis.' },
      { id: 'bruno', name: 'Bruno', role: 'Vecino', hue: 200, statement: 'Bajé a la tienda a comprar globos a las 17:00 y volví hace un momento.' },
    ],
    clues: {
      migas: { title: 'Migas de chocolate', text: 'Migas y una cuchara usada junto al plato: quien se lo comió lo hizo aquí, en la cocina.', kind: 'object' },
      huellas: {
        title: 'Huellas de barro',
        text: 'Huellas de barro fresco van desde la puerta del jardín hasta la mesa del pastel, y vuelven.',
        kind: 'object',
        contradicts: 'tomas',
      },
      botas: { title: 'Botas embarradas', text: 'Junto a la puerta del jardín están las botas de Tomás, con barro todavía húmedo en la suela.', kind: 'object' },
      ticket: {
        title: 'Ticket de la tienda',
        text: 'Ticket de la tienda de la esquina: «Globos (12) — 17:14». La tienda está a diez minutos andando.',
        kind: 'document',
        alibi: 'bruno',
      },
      videollamada: {
        title: 'Videollamada de Lucía',
        text: 'El móvil de Lucía registra una videollamada de 16:50 a 17:35 con su mejor amiga, que la vio todo el rato en su cuarto.',
        kind: 'document',
        alibi: 'lucia',
      },
    },
    solution: {
      culprit: 'tomas',
      evidence: ['huellas'],
      requires: ['huellas', 'botas', 't-tomas'],
      explanation:
        'Tomás dijo que no había pisado la cocina, pero hay huellas de barro fresco desde el jardín hasta la mesa, y el único que venía del jardín con las botas embarradas era él. Bruno estaba en la tienda (el ticket es de las 17:14) y Lucía no salió de su cuarto: estuvo en videollamada todo ese rato.',
    },
    hints: ['Fíjate en quién dice que no entró en la cocina.', 'El barro del suelo tiene que venir de alguna parte. ¿Quién estaba ahí fuera?'],
    reveals: { lucia: 'videollamada' },
  },
  {
    id: 'bicicleta',
    title: 'La bicicleta del club',
    difficulty: 2,
    place: 'Garaje del club ciclista',
    intro:
      'La bicicleta roja de la carrera del domingo desapareció del garaje del club entre las 20:00 y las 21:00. La puerta no está forzada: se abrió con llave, y solo hay tres llaves.',
    question: '¿Quién se llevó la bicicleta?',
    scene: {
      kind: 'garage',
      hotspots: [
        { id: 'registro', label: 'Cuaderno de registro', icon: 'notebook', x: 78, y: 40, clue: 'cuaderno' },
        { id: 'gancho', label: 'Gancho de llaves', icon: 'key', x: 14, y: 34, clue: 'llave' },
        { id: 'banco', label: 'Banco de trabajo', icon: 'wrench', x: 46, y: 60, clue: 'nota' },
        { id: 'camara', label: 'Cámara de la puerta', icon: 'camera', x: 88, y: 14, clue: 'pilas' },
      ],
    },
    people: [
      { id: 'marta', name: 'Marta', role: 'Entrenadora', hue: 160, statement: 'Mi llave no ha salido de mi bolso en toda la tarde. Estuve en la oficina del club hasta las 22:00, con la directiva.' },
      { id: 'ivan', name: 'Iván', role: 'Mecánico', hue: 20, statement: 'Me fui a las 19:30. Cerré yo mismo y no volví en toda la noche.' },
      { id: 'sara', name: 'Sara', role: 'Corredora', hue: 330, statement: 'Yo ni siquiera tengo llave: la perdí hace un mes.' },
    ],
    clues: {
      cuaderno: {
        title: 'Cuaderno de registro',
        text: 'Última línea, con la letra de Iván: «Iván — 20:20 — recojo herramientas».',
        kind: 'document',
        contradicts: 'ivan',
      },
      llave: {
        title: 'La llave de Sara',
        text: 'La llave de Sara cuelga del gancho con una etiqueta: «Encontrada en el vestuario. La guardo aquí. — Marta (hace 2 semanas)».',
        kind: 'object',
        alibi: 'sara',
      },
      nota: {
        title: 'Hueco en el banco',
        text: 'Falta la llave de pedal grande. En su lugar hay una nota: «Me la llevo, la devuelvo mañana. I.».',
        kind: 'document',
      },
      pilas: { title: 'Cámara sin pilas', text: 'La cámara de la puerta lleva una semana sin pilas: no grabó nada.', kind: 'object' },
      directiva: {
        title: 'Acta de la directiva',
        text: 'Acta de la reunión de la directiva: de 19:45 a 22:00. Asistentes: Marta y cuatro personas más.',
        kind: 'document',
        alibi: 'marta',
      },
    },
    solution: {
      culprit: 'ivan',
      evidence: ['cuaderno'],
      requires: ['cuaderno', 'llave', 't-ivan', 'directiva'],
      explanation:
        'Iván aseguró que no volvió después de las 19:30, pero el cuaderno tiene una entrada suya a las 20:20, en plena franja del robo, y la nota del banco confirma que estuvo allí. Sara no tenía llave (la suya está colgada en el garaje desde hace dos semanas) y Marta estuvo en la reunión de la directiva hasta las 22:00.',
    },
    hints: ['Tres llaves, tres personas: ¿quién podía abrir de verdad?', 'Uno de ellos dejó su firma en el garaje a una hora que no encaja con lo que contó.'],
    // El acta se encuentra en la oficina: aparece al interrogar a Marta.
    reveals: { marta: 'directiva' },
  },
  {
    id: 'cuadro',
    title: 'El cuadro cambiado',
    difficulty: 3,
    place: 'Museo del pueblo',
    intro:
      'Durante la noche alguien cambió el cuadro más valioso del museo por una copia. La alarma se desactivó de 03:10 a 03:25 con un código de cuatro cifras.',
    question: '¿Quién cambió el cuadro?',
    scene: {
      kind: 'museum',
      hotspots: [
        { id: 'copia', label: 'La copia', icon: 'frame', x: 50, y: 34, clue: 'fresca' },
        { id: 'panel', label: 'Panel de la alarma', icon: 'panel', x: 12, y: 40, clue: 'postit' },
        { id: 'registro', label: 'Registro de la alarma', icon: 'notebook', x: 86, y: 46, clue: 'alarma' },
        { id: 'almacen', label: 'Puerta del almacén', icon: 'brush', x: 70, y: 76, clue: 'pincel' },
      ],
    },
    people: [
      { id: 'gabriel', name: 'Gabriel', role: 'Guarda nocturno', hue: 210, statement: 'Hice la ronda a las tres y no vi nada raro. Nadie más conoce mi código.' },
      { id: 'clara', name: 'Clara', role: 'Restauradora', hue: 120, statement: 'Llegué a las ocho de la mañana y noté enseguida que la firma era distinta.' },
      { id: 'rafael', name: 'Rafael Prado', role: 'Pintor del pueblo', hue: 45, statement: 'Hace más de un año que no piso ese museo.' },
    ],
    clues: {
      fresca: { title: 'Pintura fresca', text: 'La copia todavía huele a pintura: se pintó hace menos de dos días, con azul ultramar.', kind: 'object' },
      postit: {
        title: 'Pósit en el panel',
        text: 'Un pósit pegado junto al panel con el código de la alarma escrito bien grande. Cualquiera que pasara por aquí podía leerlo.',
        kind: 'object',
      },
      alarma: { title: 'Registro de la alarma', text: 'Desactivada a las 03:10 y activada a las 03:25 con el código del guarda.', kind: 'document' },
      pincel: {
        title: 'Pincel olvidado',
        text: 'Junto a la puerta del almacén, un pincel con azul ultramar sin secar y las iniciales «R. P.» grabadas en el mango.',
        kind: 'object',
        contradicts: 'rafael',
      },
      tren: {
        title: 'Billete de Clara',
        text: 'Billete de tren de Clara: salió de la capital a las 06:15 y llegó a las 07:40. Pasó la noche a 300 km del museo.',
        kind: 'document',
        alibi: 'clara',
      },
      ronda: {
        title: 'Hoja de ronda',
        text: 'Hoja de ronda del guarda: «03:00 sala norte · 03:12 aparcamiento · 03:30 sala norte». Firmada en cada punto, en tres lugares distintos.',
        kind: 'document',
        alibi: 'gabriel',
      },
    },
    solution: {
      culprit: 'rafael',
      evidence: ['pincel'],
      requires: ['pincel', 'postit', 'fresca', 't-rafael', 'ronda'],
      explanation:
        'El código del guarda no lo señala a él: estaba en un pósit a la vista de todos, y su hoja de ronda lo sitúa en el aparcamiento a las 03:12. La copia se pintó hace dos días con azul ultramar, y junto al almacén apareció un pincel con ese azul aún fresco y las iniciales de Rafael Prado, que juraba no haber pisado el museo en un año.',
    },
    hints: ['El código de la alarma no es tan secreto como parece.', 'Alguien dejó sus iniciales cerca del almacén.'],
    reveals: { gabriel: 'ronda', clara: 'tren' },
  },
  {
    id: 'correo',
    title: 'El correo anónimo',
    difficulty: 3,
    place: 'Oficina de un estudio de diseño',
    intro:
      'El martes, alguien envió desde el ordenador de Elena un correo anónimo con el presupuesto secreto de un cliente. El correo salió a las 13:05. El ordenador se deja sin contraseña cuando está abierto.',
    question: '¿Quién envió el correo?',
    scene: {
      kind: 'office',
      hotspots: [
        { id: 'pantalla', label: 'Ordenador de Elena', icon: 'monitor', x: 36, y: 46, clue: 'enviado' },
        { id: 'taza', label: 'Taza sobre la mesa', icon: 'cup', x: 56, y: 58, clue: 'taza' },
        { id: 'corcho', label: 'Tablón de corcho', icon: 'pin', x: 82, y: 30, clue: 'acta' },
        { id: 'papelera', label: 'Papelera', icon: 'trash', x: 14, y: 78, clue: 'ticket' },
      ],
    },
    people: [
      { id: 'elena', name: 'Elena', role: 'Diseñadora', hue: 280, statement: 'El martes comí fuera con mi hermana, de 13:00 a 14:00. Ni me acerqué a la oficina.' },
      { id: 'oscar', name: 'Óscar', role: 'Jefe de cuentas', hue: 15, statement: 'De 13:00 a 14:00 estuve en la reunión de la sala B, toda la hora.' },
      { id: 'nuria', name: 'Nuria', role: 'Becaria', hue: 175, statement: 'A la una bajé a la cafetería y no subí hasta las 13:30.' },
    ],
    clues: {
      enviado: { title: 'Carpeta de enviados', text: 'Correo anónimo enviado a las 13:05 desde la cuenta de Elena. Se borró de la papelera, pero quedó en el registro.', kind: 'document' },
      taza: { title: 'Taza de la sala B', text: 'Una taza con el logo de la sala B, todavía tibia, junto al teclado de Elena.', kind: 'object' },
      acta: {
        title: 'Acta de la reunión',
        text: 'Acta de la reunión de la sala B del martes: «Empieza a las 13:20 por un retraso del cliente». Asistentes: Óscar y dos personas más.',
        kind: 'document',
        contradicts: 'oscar',
      },
      ticket: {
        title: 'Tickets de la cafetería',
        text: 'Dos tickets de la cafetería pagados con la tarjeta de Nuria: 13:02 (un café) y 13:09 (un bocadillo).',
        kind: 'document',
        alibi: 'nuria',
      },
      foto: { title: 'Foto del restaurante', text: 'Foto en el móvil de Elena con su hermana, en el restaurante, hecha a las 13:03.', kind: 'object', alibi: 'elena' },
    },
    solution: {
      culprit: 'oscar',
      evidence: ['acta'],
      requires: ['acta', 'enviado', 'ticket', 'foto', 't-oscar'],
      explanation:
        'Óscar dijo que estuvo en la reunión de la sala B desde la una, pero el acta dice que empezó a las 13:20: a las 13:05 no estaba allí. Además, su taza de la sala B seguía tibia junto al teclado de Elena. Elena estaba en el restaurante (foto de las 13:03) y Nuria pagó en la cafetería a las 13:02 y a las 13:09.',
    },
    hints: ['Comprueba dónde estaba cada uno exactamente a las 13:05.', 'Una de las coartadas depende de una reunión. ¿Empezó cuando dicen?'],
    reveals: { elena: 'foto' },
  },
  {
    id: 'collar',
    title: 'El collar de la boda',
    difficulty: 4,
    place: 'Hotel de la boda',
    intro:
      'Durante el banquete desapareció el collar de perlas de la novia de su habitación, entre las 18:00 y las 19:00. La puerta no se forzó: se abrió con tarjeta.',
    question: '¿Quién se llevó el collar?',
    scene: {
      kind: 'hotel',
      hotspots: [
        { id: 'cerradura', label: 'Cerradura electrónica', icon: 'lock', x: 12, y: 44, clue: 'aperturas' },
        { id: 'mesilla', label: 'Mesilla de noche', icon: 'lamp', x: 70, y: 56, clue: 'estuche' },
        { id: 'pasillo', label: 'Carro en el pasillo', icon: 'cart', x: 30, y: 74, clue: 'carro' },
        { id: 'alfombra', label: 'Alfombra', icon: 'sparkle', x: 52, y: 84, clue: 'perla' },
      ],
    },
    people: [
      { id: 'rosa', name: 'Rosa', role: 'Camarera de piso', hue: 340, statement: 'Limpié la habitación a las cinco y no volví a entrar en toda la tarde.' },
      { id: 'pablo', name: 'Pablo', role: 'Hermano del novio', hue: 220, statement: 'Estuve toda esa hora en el salón con los invitados. Hay fotos.' },
      { id: 'ines', name: 'Inés', role: 'Fotógrafa', hue: 95, statement: 'Entré a las 18:10 a por el ramo con la tarjeta que me dio la novia y salí enseguida. El collar seguía en la mesilla.' },
    ],
    clues: {
      aperturas: {
        title: 'Aperturas de la puerta',
        text: 'Registro de la cerradura: 17:02 tarjeta de limpieza · 18:10 tarjeta de invitada · 18:41 tarjeta de limpieza.',
        kind: 'document',
        contradicts: 'rosa',
      },
      estuche: { title: 'Estuche vacío', text: 'El estuche del collar está abierto y vacío en la mesilla.', kind: 'object' },
      carro: {
        title: 'Carro de limpieza',
        text: 'El carro de limpieza tiene su tarjeta colgada de un cordón, a la vista. En el bolsillo lateral, el uniforme de Rosa, doblado.',
        kind: 'object',
      },
      perla: { title: 'Perla en la alfombra', text: 'Una perla suelta en la alfombra, entre la mesilla y la puerta: el collar salió de aquí con prisas.', kind: 'object' },
      fotos: {
        title: 'Fotos del salón',
        text: 'En las fotos de los invitados, Pablo aparece en el salón a las 18:38, 18:40 y 18:44.',
        kind: 'document',
        alibi: 'pablo',
      },
      camara: {
        title: 'Cámara de la fotógrafa',
        text: 'Las fotos de Inés del jardín están hechas a las 18:36, 18:41 y 18:47, sin interrupciones.',
        kind: 'document',
        alibi: 'ines',
      },
    },
    solution: {
      culprit: 'rosa',
      evidence: ['aperturas'],
      requires: ['aperturas', 'carro', 'fotos', 'camara', 't-rosa'],
      explanation:
        'A las 18:41 la puerta se abrió con la tarjeta de limpieza, después de que Inés viera el collar a las 18:10. Esa tarjeta colgaba del carro y cualquiera podía cogerla, pero a las 18:41 Pablo estaba en el salón (fotos de 18:40 y 18:44) e Inés fotografiaba el jardín (18:41). Solo queda Rosa, que juró no haber vuelto a entrar.',
    },
    hints: ['La tarjeta de limpieza estaba al alcance de cualquiera: no basta con ella.', 'Mira qué hacía cada sospechoso exactamente a las 18:41.'],
    reveals: { pablo: 'fotos', ines: 'camara' },
  },
  {
    id: 'faro',
    title: 'El faro apagado',
    difficulty: 5,
    place: 'Faro del puerto',
    intro:
      'La noche del temporal, la luz del faro estuvo apagada de 22:00 a 23:00 y un velero tuvo que volver a puerto a ciegas. Alguien desconectó el interruptor a mano.',
    question: '¿Quién apagó el faro?',
    scene: {
      kind: 'lighthouse',
      hotspots: [
        { id: 'interruptor', label: 'Interruptor de la lámpara', icon: 'power', x: 66, y: 38, clue: 'arena' },
        { id: 'perchero', label: 'Perchero de la entrada', icon: 'shirt', x: 14, y: 50, clue: 'impermeable' },
        { id: 'mesa', label: 'Mesa del farero', icon: 'notebook', x: 44, y: 62, clue: 'bitacora' },
        { id: 'bolsillo', label: 'Bolsillo del impermeable', icon: 'note', x: 22, y: 72, clue: 'nota' },
      ],
    },
    people: [
      { id: 'ramon', name: 'Ramón', role: 'Farero', hue: 30, statement: 'Me quedé dormido en mi cuarto a las 21:30 y no me desperté hasta las once.' },
      { id: 'alba', name: 'Alba Mar', role: 'Pescadora', hue: 190, statement: 'Esa noche no salí de casa. Con ese temporal no sale nadie.' },
      { id: 'leo', name: 'Leo', role: 'Sobrino del farero', hue: 265, statement: 'Estuve en el bar del puerto hasta las once y media. Me vio todo el mundo.' },
    ],
    clues: {
      arena: { title: 'Interruptor mojado', text: 'El interruptor tiene arena húmeda y una escama de pescado pegada: quien lo tocó venía de fuera, del puerto.', kind: 'object' },
      impermeable: {
        title: 'Impermeable empapado',
        text: 'Colgado en la entrada, un impermeable amarillo todavía chorreando, con «A. Mar» bordado en el cuello.',
        kind: 'object',
        contradicts: 'alba',
      },
      bitacora: { title: 'Bitácora del farero', text: 'Última anotación, con la letra de Ramón: «21:25 — barómetro en caída. Me acuesto.».', kind: 'document' },
      nota: {
        title: 'Nota en el bolsillo',
        text: 'Una nota arrugada: «Si el Gaviota no sale esta noche, la regata del domingo es mía».',
        kind: 'document',
        alibi: 'ramon',
      },
      bar: { title: 'Cuenta del bar', text: 'Cuenta del bar del puerto a nombre de Leo: rondas a las 21:50, 22:20 y 22:55.', kind: 'document', alibi: 'leo' },
    },
    solution: {
      culprit: 'alba',
      evidence: ['impermeable'],
      requires: ['impermeable', 'arena', 'bitacora', 'bar', 't-alba'],
      explanation:
        'Quien tocó el interruptor venía del puerto (arena y escama). Leo estaba en el bar toda la hora (rondas de 22:20 y 22:55) y Ramón dejó escrito que se acostaba a las 21:25, dentro del faro. En la entrada colgaba el impermeable de Alba Mar todavía chorreando, aunque juró no haber salido de casa; y la nota de su bolsillo da el motivo: que el Gaviota no corriera la regata.',
    },
    hints: ['Quien apagó el faro llegó mojado desde el puerto.', 'Alguien dejó su nombre bordado en la entrada.'],
    reveals: { leo: 'bar' },
  },
]);

export const findCase = (id) => CASES.find((item) => item.id === id) ?? null;
