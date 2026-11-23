# Pruebas

## Pruebas

- **Game Center** (incluido en `npm test`): ciclo de vida; almacenamiento (migración v2, validación, récords, cola de
  escrituras, aislamiento); registro y búsqueda; **Aquapark** (los 3 circuitos completados por un piloto automático sin
  caídas ni choques, hueco en cada fila de flotadores, colisiones, caída y reaparición, rampas, meta, rivales);
  **Arena .io** (movimiento, recolección, absorción, captura de territorio, eliminaciones, victoria y fin, IA de los
  bots); **lógica** (reglas, límites, conteo, victoria, derrota demostrada, deshacer y **los 20 niveles resueltos con
  exactamente su límite y sin solución con uno menos**); **ajedrez** (perft de 5 posiciones de referencia, hasta
  97 862 nodos, y cada regla especial; IA que da mate y respeta el tiempo); **Tunnel Runner** (piloto automático que
  sobrevive 3 km en 20 semillas, hueco mínimo, dificultad); y pruebas funcionales de la interfaz (entrar, buscar,
  filtrar, presentación previa, ajedrez con abandono confirmado, nivel de lógica resuelto con teclado y pausa, Tunnel
  Runner con pausa y salida sin bucles activos).
  Controles táctiles: arrastre proporcional con zona muerta, un toque sobre un botón no inicia arrastre, los
  deslizamientos no se duplican como toques y la pista de controles muestra gestos o teclas según el último puntero
  usado (toque o ratón), no según la media query del dispositivo.
- **Fase 2** (incluido en `npm test`): motores de los cinco juegos (movimiento, colisiones, rondas y piloto automático
  del Pollo; coherencia, unicidad de la conclusión y validador de los casos; reglas, notas, pistas, comprobación,
  banco y variaciones del Sudoku, y guardado/reanudación con datos dañados; aceleración, frenada, marcha atrás,
  dirección, golpes, aparcado y las 8 soluciones del aparcamiento; ejes, salidas, bloqueos y los 15 niveles de
  Despejar) y pruebas de interfaz: cada juego se abre en su versión local sin iframe y con su opción online correcta,
  un caso se resuelve desde la interfaz, el Sudoku guarda la partida, y los paneles ignoran los «clics fantasma».
- **Fase 3** (incluido en `npm test`): HexaStack (transferencias, cascadas, despeje, puntos, racha, fin, desafíos
  superados por un piloto), Traffic Rider (física, carriles, tráfico que no bloquea ni embiste por detrás,
  adelantamientos, escenarios, misiones y piloto de 6 km), Frente Abierto (mapa conexo y justo —todos empiezan
  igual—, ingresos, combate y fortalezas, legalidad, victoria/derrota, IA solo con jugadas legales, niveles que
  cambian de verdad el resultado) y Saltos de Lumi (aceleración, salto variable, sin autorrepetición, paredes,
  *coyote time*, pulsación anticipada, plataformas finas y móviles, muelles, pisotón, daño lateral y reaparición en
  el farol, bordes, pinchos, caídas, chispas, determinismo y **las 8 soluciones reproducidas**). Interfaz: cada juego
  se abre en local sin iframe con su opción online correcta (o el aviso), tutorial de Frente Abierto jugado desde la
  interfaz (refuerzos, previsión antes de confirmar, turno de la IA) y niveles bloqueados de Lumi; controles de
  plataformas con dos punteros a la vez.
- **Biblioteca** (incluido en `npm test`): formato (cabecera, ids únicos sin tildes, texto en línea anidado, frases para
  escuchar, enlaces solo `http(s)`, recuadros, ejercicios, tablas, glosario y recuento de palabras sin la bibliografía);
  **calidad de cada uno de los 60 capítulos** (extensión, estructura, conceptos, fuentes, relacionados); persistencia
  (favoritos, marcadores, tamaño, «leído» que no se pierde, escrituras simultáneas, datos dañados, copia de seguridad);
  e interfaz (entrar desde el inicio, ex libris, búsqueda sin tildes, filtros por estante y dificultad, «Seguir leyendo»,
  lector con índice, favorito, marcador y tamaño, recreaciones marcadas, documento inexistente, glosario con enlaces).
- **Fase 4** (incluido en `npm test`): Bloques (bolsas de 7, movimiento, colisiones, patadas de pared, fijación con
  retardo y límite, 1-4 líneas y puntuación, nivel y gravedad, reserva, fin por bloqueo y por fijación arriba,
  contrarreloj), Lava y Agua (flujo, piedra, lava espesa, compuertas, derrota por lava y por salida cubierta, deshacer,
  y los 12 niveles con su `par` exacto, camino «a ciegas» perdedor y mecánica imprescindible), cocina (pedidos válidos
  por nivel, determinismo, dificultad creciente, construcción, evaluación de cada tipo de paso, horno, puntos, turno
  superado/no superado, desbloqueo), Reino de Ladrillos (aceleración, gravedad, salto variable, paredes, cámara,
  bloques, corazón, pisotón, daño, caparazón, vacío/lava/checkpoint, sin vidas, reloj, 1 vida por 100 monedas, mástil,
  determinismo y las 4 soluciones reproducidas) y Stellarium (catálogo, proyección, arrastre, aumento, selección,
  identificación de las 21 figuras, Sol/Luna con efemérides de 2025, plano galáctico). Interfaz: los 7 juegos se abren
  en local, nivel de Lava y Agua ganado con teclado, pedido perfecto en la Heladería, bitácora y «cielo de nuestro día».
- `npm run test:e2e` incluye además: Game Center y los **veintiún** juegos **sin conexión**, la IA de ajedrez respondiendo
  sin red desde su Worker precacheado, veintiún juegos disponibles, enlaces online oficiales de las Fases 2 y 3, sin hoja de ruta pendiente, sin desplazamiento
  horizontal y **casillas de ajedrez de al menos 28 px** en los 7 tamaños (incluido el móvil en horizontal).
- `npm test` — pruebas de la Fase 1 (Vitest + Testing Library + fake-indexeddb): fechas, contraste, validación, migraciones
  (incluida v1 → v2), letra de la vela, persistencia, datos corruptos, almacenamiento bloqueado, copia en IndexedDB,
  exportar/importar, borrado; línea de tiempo del viaje (progreso, escena activa, movimiento reducido, ventanas de
  texto sin solapes en todo el recorrido, constelación, distancia, iris, enfoque, eco de la «A», vela sobre el
  mensaje final); recorrido completo del viaje con escenario sticky simulado (avanzar, retroceder, saltos bruscos,
  revelación, final operable solo cuando se ve), sin permisos de micrófono/cámara, saltar, repetir sin cambiar preferencias,
  configuración y rutas.
- **Organización** (incluido en `npm test`, `src/features/organizer/tests/`): validación y relaciones de cada
  entidad, transacciones atómicas, escrituras concurrentes, integridad al borrar (restringir, desvincular, cascada,
  carpetas), historial; importes y libro contable (transferencias, tarjetas, metas, presupuestos, períodos);
  repeticiones (31 de cada mes, días de la semana, número de veces) y series («solo esta / siguientes / toda»);
  pagos sin duplicados; CSV (exportar, vista previa, errores, duplicados, importar); agenda y conflictos;
  recordatorios; Markdown sin XSS; etiquetas; papelera; guardado automático, borrador recuperado y cambios externos;
  PIN; estadísticas del diario y del diario emocional; copias (ida y vuelta, combinar, selectiva, deshacer, adjuntos);
  e interfaz de los seis espacios con recarga real.
- `npm run test:e2e` — **94 comprobaciones** (además: los seis espacios de organización sin conexión y sin
  desplazamiento horizontal en móvil, nota/tarea/registro emocional creados sin conexión que siguen tras recargar, y
  los seis espacios en los cuatro estilos de escritorio). Antes eran **90 comprobaciones** (las nuevas: biblioteca sin conexión con sus 60 capítulos, un capítulo
  completo de cada estante, favoritos tras recargar, glosario, y catálogo y lector en los 4 estilos sin desplazamiento
  horizontal) en Edge/Chrome real. El viaje completo con scroll real se recorre en
  8 tamaños (375×812, 360×640, 812×375 apaisado, 768×1024, 1280×720, 1366×600, 1440×900 y 1920×1080) comprobando en
  cada capítulo: escenario pegado a la pantalla, un único texto visible, dentro de la pantalla y fuera de la zona de
  la ilustración, constelación completa, telescopio revelado, iris y ocular, vela con «A», «Otro año juntos», tarjeta
  final sin tapar la vela y con su botón dentro de la pantalla, regreso a un capítulo anterior y saltos bruscos
  inicio ↔ final. Además: índice de capítulos, persistencia, Service Worker,
  **funcionamiento sin conexión**, sin peticiones externas, sin errores de consola (incluida la CSP) y sin desplazamiento
  horizontal en cada capítulo y en los 4 estilos/temas.
- **Rendimiento medido** (Edge, móvil emulado 375×812 a 3x): 60 fps estables durante todo el recorrido (p95 17 ms). Con
  la CPU ralentizada ×4, mediana de 17 ms y picos p95 de 50 ms. El lienzo reduce su calidad automáticamente si el dibujo
  resulta lento en el dispositivo.
