# Game Center (desarrolladores)

Estructura, ciclo de vida, motores, niveles demostrados, modo online y cómo añadir juegos.

## Game Center

Ruta `#/juegos` (biblioteca, dentro del marco de la app) y `#/juegos/:id` (pantalla de juego a pantalla completa,
fuera del marco, como la presentación). Todo en `src/features/game-center/`.

```
game-center/
  GameCenter.jsx   biblioteca: marquesina, destacado, recientes, búsqueda, filtros, estadísticas, hoja de ruta
  GamePage.jsx     marco de partida: barra superior, presentación previa, ayuda, salida con confirmación, audio
  registry/        gameRegistry.js (lista de manifiestos; cada uno declara su fase), categories.js, roadmap.js (hoy vacía)
  online/          onlineSources.js (proveedores y fuentes online verificadas, lista permitida)
  services/        gameStorage.js (IndexedDB), gameLifecycle.js (estados, formato, RNG con semilla), gameAudio.js
  hooks/           useGameSession, useGameLoop, useKeyboard, useCanvas, useGameStatistics, useGameFrame, useGameAudio
  render/          utilidades de dibujo compartidas por los juegos en lienzo: paint.js (formas, semillas, color),
                   sprites.js (caché de sprites), particles.js (reserva fija de partículas), quality.js (DPR y calidad)
  components/      GameCard, GameLibrary, GameFilters, GameDetails, GameHUD, GameOverlay (pausa), GameResults,
                   Countdown, TouchControls (botones mantenidos, joystick, cruceta, deslizamientos, conducción,
                   plataformas con dos dedos)
  games/<id>/      manifest.js, componente del juego, Art (SVG original), engine/, styles/, tests/
  games/cocina/    excepción deliberada: tres juegos (heladeria, pizzeria, pasteleria) que comparten motor de pedidos
                   (engine/orders.js), recetas declarativas (recipes/), dibujos (components/FoodVisuals.jsx) y un
                   único componente (CookingGame.jsx); cada uno tiene su manifiesto y sus propias estadísticas.
                   La Hamburguesería vive en la misma carpeta pero tiene motor (engine/burgerEngine.js), dibujos
                   (components/BurgerParts.jsx) y componente propios (Hamburgueseria.jsx)
  styles/          game-center.css (biblioteca), game-screen.css (marco, HUD, overlays, controles táctiles)
```

**Ciclo de vida común** (`READY → PLAYING ⇄ PAUSED → COMPLETED | GAME_OVER`), usado cuando tiene sentido (el ajedrez no
pausa). La sesión mide solo el tiempo activo, se pausa sola al ocultar la pestaña, silencia el audio en pausa y, al
salir con la partida abierta, guarda el tiempo jugado como partida no terminada. Al desmontar un juego se cancelan el
`requestAnimationFrame`, los listeners de teclado, los temporizadores, el `AudioContext` y el Worker de la IA (una
prueba comprueba que no quedan fotogramas programados).

**Los juegos** (motores puros sin DOM, probados por separado de la interfaz):

| Juego | Mecánica | Controles | Se guarda |
| --- | --- | --- | --- |
| **Aquapark** | Tobogán pseudo-3D (segmentos proyectados, curvas acumuladas). Fuerza centrífuga, flotadores que frenan, flechas de impulso, rampas, tramos sin paredes con caída al agua y vuelta al punto de control, 3 bots rivales y puesto. 3 circuitos (fácil → difícil) que se desbloquean en orden. | ← → / A D; táctil: **arrastrar a izquierda/derecha** (proporcional, con zona muerta contra toques accidentales e indicador bajo el dedo) o botones ‹ › | mejor tiempo y mejor puesto por circuito |
| **Arena .io** | Tres minijuegos distintos: **Órbita** (recolectar y crecer; absorber bots ≥ 20 % menores), **Territorio** (cuadrícula 40×40, rastro, captura por relleno, cortar rastros), **Señuelo** (sobrevivir 90 s a drones de giro limitado que se destruyen al chocar entre sí). Bots locales siempre identificados como «Bot …». | Flechas/WASD, ratón (sigue al puntero), joystick táctil; Territorio: deslizar o cruceta | mejor puntuación y victoria por minijuego |
| **Gato largo** (inspirado en Longcat; sustituye a «Cubrir el espacio» desde v1.3.0) | El gato se estira en línea recta hasta chocar con un mueble, la pared o su cuerpo; hay que llenar la habitación. 30 habitaciones en 4 dificultades, todas con solución comprobada por un solucionador DFS; «atrapado» cuando no queda dirección libre, encoger (deshacer) ilimitado, pista. | Flechas/WASD, clic en casilla alineada, deslizar, cruceta; Z encoger, H pista, R | habitaciones superadas con estrellas, mejor tiempo |
| **Ajedrez** | Motor propio con todas las reglas (enroque, al paso, promoción con elección, jaque, mate, ahogado, 50 movimientos, triple repetición, material insuficiente), notación SAN, historial, capturas, giro de tablero. IA alfa-beta con búsqueda de quietud en un **Web Worker**, con **5 niveles: Bebé, Niño, Adolescente, Joven y Adulto** (cambian profundidad, quietud y probabilidad de jugadas imprecisas; Bebé es apto para aprender). Capturas compactas agrupadas por tipo con contador. | Clic/toque pieza → destino; tablero navegable con Tab y flechas; en móvil horizontal el panel va al lado del tablero | victorias/tablas/derrotas ante la IA, niveles vencidos, último modo |
| **Tunnel Runner** | Túnel de 12 caras en perspectiva; la nave gira por la pared. Velocidad y densidad crecientes por sectores, huecos más estrechos, anillos giratorios. El generador garantiza un hueco alcanzable. | ← → / A D; táctil: **arrastrar a izquierda/derecha** o botones ‹ › | récord de distancia, hitos 500 / 1 500 / 3 000 m |
| **Pollo pasando la calle sangriento** | Cuadrícula de 9 columnas con hierba, carreteras (coches, furgonetas, camiones) y ríos con troncos que arrastran. 10 rondas con más carriles y velocidad; río desde la 3.ª; nunca más de 3 carriles seguidos sin hierba. Caja de choque más estrecha que la casilla (colisiones justas). Derrota caricaturesca: plumas y ojos en espiral, sin gore. | Flechas/WASD; táctil: toque corto = avanzar, deslizar en 4 direcciones o cruceta | récord de puntos y de rondas, victorias |
| **Resolver casos** | 6 casos originales (cocina → faro) con escenario ilustrado, objetos que se examinan, declaraciones, coartadas y expediente. Para acusar hacen falta las pistas imprescindibles, y hay que elegir culpable **y** la prueba que desmiente su declaración. Fallar o pedir ayuda cuesta una estrella sin borrar lo investigado. | Toque/clic; móvil con pestañas Escena · Expediente · Resolver; teclado (Tab/Intro) | casos resueltos y estrellas |
| **Sudokus** | 4 dificultades medidas por la técnica necesaria (candidato único → suposiciones). Banco de 48 tableros con solución única + variaciones equivalentes (miles de tableros). Notas, resaltados, conflictos sin tapar el número, comprobar, 3 pistas, deshacer, pausa (oculta el tablero) y partida guardada. | Clic/toque + teclado numérico en pantalla; 1–9, flechas, Retroceso, N, Z | mejor tiempo y resueltos por dificultad, partida en curso |
| **Aparcar el carro** | Vista cenital con modelo de bicicleta (gira solo en marcha), aceleración progresiva, freno y marcha atrás; colisiones con rectángulos orientados (un golpe por contacto, 3 = fin). 8 niveles: conos, esquina, batería, marcha atrás, en línea, pasillo y final. Aparcado = dentro, orientado y parado 0,8 s. | ↑↓←→/WASD, R; táctil: volante ‹ › a la izquierda y pedales a la derecha, mantenidos (se sueltan solos al pausar o perder el foco) | estrellas y mejor tiempo por nivel |
| **Despejar el estacionamiento** | Coches de 2 o 3 casillas que solo avanzan en su eje hacia su flecha y solo salen por una salida marcada de su línea. 15 niveles (5×5 → 7×7 con pilares). Arrastrar elige cuánto avanza; tocar, todo lo posible. Detecta «sin salida» (resolvedor) y ofrece deshacer. | Arrastrar o tocar; Tab + Intro, flecha de su dirección, Z, R | estrellas, menos movimientos y mejor tiempo por nivel |
| **HexaStack** | Panal de celdas hexagonales; se colocan pilas de 3 en mano. Las vecinas con el mismo color arriba pasan sus fichas (en cascada); con 10 del mismo color arriba se despejan. Cadenas multiplican puntos y las jugadas seguidas que despejan suman racha. Partida libre y 8 desafíos (de 3 colores a 6 con celdas bloqueadas). Previsualización de dónde cae y qué se junta. Reglas al empezar la primera vez. | Clic en pila y celda, arrastrar, teclas 1-3; táctil: tocar celda = previsualizar, segundo toque = colocar, o arrastrar | récord por modo, desafíos superados, racha máxima |
| **Traffic Rider** | Moto en carretera pseudo-3D de 4 carriles: aceleración progresiva, frenada, tráfico que sigue al de delante y deja siempre 2 carriles libres, adelantamientos (ajustados a más de 100 km/h valen más). Escenario cambia cada 2,5 km. Carrera libre y 6 misiones (distancia, adelantamientos, contrarreloj, velocidad sostenida…). | ↑ acelerar, ↓ frenar, ← → carril; táctil: dirección a la izquierda y pedales a la derecha, mantenidos | récord de distancia y puntos, misiones, adelantamientos |
| **Frente Abierto** (inspirado en Open Front) | Estrategia territorial **por turnos** en una isla hexagonal generada por semilla: refuerzos (territorios ÷ 3, mínimo 3, + 2 por ciudad), mover y atacar a vecinos (cada territorio actúa una vez por turno), sin dados: el resultado se ve **antes** de confirmar. Fortalezas ×1,5. IA local con 3 niveles de comportamiento distinto; sus jugadas se ven una a una. Tutorial guiado, partida rápida (mapa S/M/L, 1–3 rivales, dificultad) y 5 escenarios en orden. | Clic/toque territorio → destino marcado → cantidad (− / + / Todas) → Atacar/Mover; Tab + Intro | victorias y derrotas por dificultad, escenarios, tutorial, mejor número de turnos |
| **Saltos de Lumi** (plataformas originales) | Lumi, una chispa de luz, recorre 8 niveles originales (pradera, bosque, cueva, nubes, noche) hasta encender la vela final. Paso fijo de 1/60 s, salto variable, margen tras el borde (*coyote time*), pulsación anticipada, plataformas finas y móviles (que te llevan), muelles, sombras que se pisan, polillas, zarzas, faroles de control y 3 vidas por nivel. | ← → / A D, Espacio/↑/W (mantener = más alto); táctil: almohadilla ‹ › en la que se desliza el pulgar + botón de salto, **con dos dedos a la vez** | niveles superados, mejor tiempo y chispas por nivel |
| **Reino de Ladrillos** (homenaje original al plataformas de los 8 bits) | Desplazamiento lateral con cámara que solo avanza, 4 niveles (pradera, subterráneo, copas de árboles, castillo de lava). Paso fijo de 1/60 s, salto variable, *coyote time*, bloques con estrella (moneda o corazón), ladrillos que se rompen siendo grande, crecer/encoger con invulnerabilidad, gorgojos que se pisan, caracoles cuyo caparazón se patea y arrasa, columnas, lava, banderas de control, mástil con bonificación por altura y por tiempo, reloj, 100 monedas = 1 vida, vidas/monedas/puntos que pasan de nivel. Gráficos, personajes y sonidos propios. | ← → / A D, Espacio/↑/W; táctil: almohadilla ‹ › + botón de salto con dos dedos | niveles superados, mejor tiempo por nivel, récord de puntos por partida |
| **Bloques que caen** (clásico de encajar piezas) | Tablero 10 × 20 (+2 ocultas), 7 piezas en bolsas de 7, rotación SRS con patadas de pared, sombra, reserva, 3 siguientes, retardo de fijación 0,5 s (15 renovaciones), caída suave/instantánea, puntuación 100/300/500/800 × nivel, ×1,5 por cuatro seguidas, combos, gravedad por nivel. Maratón de 150 líneas (nivel inicial 1/5/10) y contrarreloj de 40. | ← → (repetición), ↑/X y Z girar, ↓, Espacio, C/Mayús, R; táctil: tocar = girar, arrastrar = mover casilla a casilla, deslizar rápido abajo = soltar, y botonera | récord de puntos, líneas y nivel; mejor tiempo de contrarreloj; 5 hitos |
| **Lava y Agua** (inspirado en Lava and Aqua) | Por turnos: tras cada paso (o espera) la lava y el agua avanzan una casilla; lava + agua = piedra pisable; palancas que abren compuertas; lava espesa (1 de cada 2 turnos); la lava que cubre la salida también hace perder. Deshacer ilimitado (también tras perder). 12 niveles en 4 grupos, cada uno demostrado con un solucionador BFS. **Modo Dúo (v1.3.0):** Brasa (lava) y Gota (agua) en una cueva lateral con gravedad, saltos, placas y compuertas; cada pulsación mueve a uno; 7 niveles con mínimo por BFS y comprobación de que exigen cooperar. | Flechas/WASD, Espacio esperar, Z deshacer, R; táctil: deslizar, tocar una casilla vecina, cruceta y reloj | niveles, estrellas (3 = mínimo de turnos) y mejores turnos por nivel |
| **Stellarium** (observatorio, inspirado en el planetario libre) | Esfera celeste en proyección estereográfica con 130 estrellas reales (J2000, magnitud, distancia, color espectral), 21 constelaciones, Vía Láctea en su plano galáctico real, cuadrícula ecuatorial y eclíptica, 3 objetos de cielo profundo, ocular por debajo de 24°. Una constelación se registra al centrarla entera en la retícula; bitácora con pistas. «El cielo de nuestro día»: posición del Sol (y su constelación del zodiaco) y fase de la Luna calculadas para la fecha de inicio configurada. El asterismo «Nosotros» reutiliza la figura de la presentación y se presenta como personal, fuera de catálogo. | Arrastrar/flechas, rueda/pellizcar/+ −, clic o toque para la ficha | descubrimientos (25), estrellas observadas, última vista e interruptores |
| **Botica de colores** (v1.3.0, inspirado en los puzles de ordenar líquidos) | Frascos con capas de colores: se vierte la racha superior sobre el mismo color o en un frasco vacío, sin pasar la capacidad. 24 niveles en Fácil, Medio, Difícil (con una sola reserva) y Avanzado (frascos de 5 capas, hasta 12 tinturas), generados con semilla y comprobados por el solucionador; «sin salida» demostrado, pistas, símbolo en cada color. | Toque origen → destino; 1-9/0, Z, H, R | estrellas, movimientos y tiempo por nivel |
| **Salida de la cochera** (v1.3.0, inspirado en los puzles de tráfico tipo Bus Escape) | Tablero 6 × 6: coches (2) y autobuses (3) que solo se deslizan por su eje; el microbús dorado sale por la derecha. 30 niveles con el mínimo exacto calculado por BFS (3 a 49 movimientos), pistas del solucionador. | Arrastrar por el eje; Tab + flechas; Z, H, R | estrellas, movimientos y tiempo por nivel |
| **Hamburguesería** (v1.3.0, inspirado en los juegos de restaurante por estaciones) | Jornada en tiempo real con tres estaciones: Pedidos (clientes con paciencia), Parrilla (dos caras por carne; cruda, poco hecha, al punto, muy hecha, quemada; voltear y retirar) y Montaje (capas en orden, carnes desde la bandeja). La entrega puntúa ingredientes 40 %, orden 20 %, cocción 25 % y tiempo 15 % → Excelente / Muy bien / Correcto / Incompleto / Incorrecto. Días con más clientes, ingredientes que se desbloquean, monedas y 3 mejoras. | 1-2-3 estaciones, Tab/Intro; táctil: pestañas y botones | día, monedas, mejoras, servidos, excelentes, estrellas por día |
| **Heladería / Pizzería / Pastelería** (inspirados en los minijuegos de cocina de Purble Place) | Motor común: pedidos generados por nivel a partir de recetas declarativas (opción única, secuencia ordenada, conjunto, ingredientes por mitades y horno en tiempo real), comanda escrita y dibujada, preparación por pasos con vista previa, evaluación elemento a elemento (correcto / casi / incorrecto / falta / sobra, con icono y texto), precisión, puntos + bono de rapidez. 3 niveles: Aprendiz (4 pedidos, sin reloj), Cocinero (5, 90 s) y Chef (6, 60 s), que se desbloquean en orden. Desde v1.3.0 los pasos están numerados y avanzan solos al elegir. | Teclas 1-9 y ← →, Tab/Intro; táctil: pestañas y botones grandes | estrellas por nivel, récord de puntos y precisión, pedidos y perfectos |

**Niveles con solución demostrada:** los niveles de la Fase 2 no se dan por buenos a ojo. `scripts/generate-sudokus.mjs`
genera el banco de Sudokus (solución única y dificultad medida); `scripts/plan-parking.mjs` busca con el motor real
(A* sobre maniobras a 60 fps) una forma de aparcar cada nivel sin tocar nada y guarda la secuencia, que las pruebas
reproducen; `scripts/generate-parking-jam.mjs` genera y resuelve los niveles de Despejar. Pollo: un piloto automático
supera las 10 rondas con 8 semillas. Casos: un validador exige coartada para cada inocente, una prueba que desmienta
al culpable y una única conclusión correcta.
Fase 3: un piloto automático voraz supera cada uno de los 8 desafíos de HexaStack en al menos 5 de 8 semillas; Traffic Rider tiene un
piloto que recorre 6 km en 5 semillas y cumple cada misión; en Frente Abierto se juegan partidas completas IA contra IA
(Normal y Difícil ganan a Fácil ≥ 8 de 10, y la IA vence a una persona pasiva). En **Saltos de Lumi**,
`scripts/plan-lumi.mjs` busca con el **motor real** (búsqueda en haz sobre «macros» de entradas de 6 fotogramas,
con diversidad por casilla) una forma de llegar a la vela **sin perder ninguna vida** y guarda la secuencia en
`levels/solutions.js`; las pruebas la reproducen fotograma a fotograma en los 8 niveles.

Fase 4: `scripts/plan-ladrillos.mjs` demuestra los 4 niveles de Reino de Ladrillos con el motor real (búsqueda en haz, sin perder vidas; las pruebas reproducen las soluciones). Lava y Agua: los niveles salieron de un generador filtrado por el solucionador (solución con exactamente su `par`, el camino «a ciegas» pierde y cada mecánica es imprescindible en su grupo). Stellarium: cálculos del Sol y la Luna validados con el equinoccio, el solsticio y las lunas nueva y llena de 2025.

**Añadir un juego:** crear `games/<id>/` con `manifest.js` (campos en la cabecera de
`registry/gameRegistry.js`), el componente por defecto (usando `useGameSession` y los componentes compartidos), su `Art`
SVG original, su motor y sus pruebas; añadir el manifiesto a `MANIFESTS` y quitarlo de `registry/roadmap.js`. No hace
falta tocar rutas, biblioteca, estadísticas ni almacenamiento. Regla para todos: implementaciones originales, sin
personajes, nombres comerciales, sprites, música ni niveles de franquicias.

**Modo offline / online:** los juegos con una versión original online verificada muestran dos opciones en su pantalla
previa: **Offline** (el juego de la app, sin conexión, con estadísticas) y **Online · versión original** (contenido
externo del proveedor, que necesita Internet y no suma a las estadísticas: la app no puede conocer sus resultados).
Sin conexión, la opción online lo indica y no ofrece el enlace. Los juegos sin fuente verificada no muestran ninguna
opción online. Piezas:

- `online/onlineSources.js` — configuración pura: proveedores con sus **orígenes permitidos** (para enlazar y para
  insertar) y una fuente por juego con su URL exacta comprobada. `isTrustedSource` rechaza todo lo que no sea HTTPS
  en la lista del proveedor y del método; ninguna entrada de la persona llega nunca a un `href` o un `src`.
- Dos métodos: `external` (abre la página oficial en otra pestaña, `noopener noreferrer`) y `embed` (iframe dentro de
  la app con `components/OnlineGameFrame.jsx`: estado de carga, aviso prudente si tarda —el evento `load` no prueba que
  el juego esté listo—, reintentar, pantalla completa a petición, salida propia fuera del iframe, aviso sin conexión y
  permisos limitados a `fullscreen`, `autoplay` y `gamepad`).
- La CSP genera `frame-src` **solo** con los orígenes de las fuentes `embed` verificadas. Hoy no hay ninguna, así que la
  CSP es idéntica a la anterior. El Service Worker ignora las peticiones de otros orígenes (no almacena contenido externo).

**Fuentes online configuradas (las primeras verificadas el 3 de octubre de 2026 y las de v1.3.0 el 22 de noviembre de 2026; todas con el método `external`).** En la biblioteca, las tarjetas de estos juegos llevan el sello «Online» y el filtro «También online» los agrupa; las etiquetas «Nuevo» / «Actualizado» salen de `manifest.badge`.

| Juego de la app | Versión original | Por qué no se inserta |
| --- | --- | --- |
| Aquapark | [Aquapark.io](https://www.crazygames.com/game/aquapark-io-yky) (Voodoo, CrazyGames) | Términos de CrazyGames y `X-Frame-Options: SAMEORIGIN` |
| Pollo pasando la calle sangriento | [Go Chicken Go!](https://www.crazygames.com/game/go-chicken-go) (RAVALMATIC, CrazyGames; según la página, para escritorio) | Igual; CrazyGames lo sirve como iframe propio, pero eso no autoriza a terceros |
| Sudokus | [Sudoku.com](https://sudoku.com/) (Easybrain) | `X-Frame-Options: SAMEORIGIN`, sin inserción ofrecida |
| Aparcar el carro | [Extreme Car Parking](https://poki.com/es/g/extreme-car-parking) (QKY Games, Poki) | [Normas de Poki](https://poki.com/en/privacy/our-website-rules) y `frame-ancestors https://*.poki.io` |
| Despejar el estacionamiento | [Car Parking Jam](https://poki.com/es/g/car-parking-jam) (Refold, Poki) | Igual |
| Resolver casos | — | Case Hunter (EYEWIND) es una app móvil sin versión para navegador: la pantalla lo explica |
| HexaStack | [Hexa Stack](https://www.crazygames.com/game/hexa-stack) (SOFTGAMES, CrazyGames) | Términos de CrazyGames y `X-Frame-Options: SAMEORIGIN` |
| Traffic Rider | [Traffic Rider](https://www.crazygames.com/game/traffic-rider-vvq) (skgames, CrazyGames) | Igual |
| Frente Abierto | [OpenFront.io](https://openfront.io/) (código abierto; multijugador en tiempo real) | Su CSP `frame-ancestors` solo admite su web y algunos portales concretos |
| Saltos de Lumi | — | Juego original de la app, solo inspirado en el género: no existe versión online oficial; la pantalla lo explica |
| Tunnel Runner | [Tunnel Runner](https://www.crazygames.com/es/game/tunnel-runner) (Drmop, CrazyGames) | Términos de CrazyGames |
| Bloques que caen | [Tetris®](https://play.tetris.com/) (The Tetris Company) | Web oficial; no ofrece inserción |
| Lava y Agua | [Lava and Aqua](https://www.crazygames.com/es/game/lava-and-aqua) (Robert Alvarez, CrazyGames) | Términos de CrazyGames |
| Gato largo | [Longcat](https://poki.com/es/g/longcat) (Fancade, Poki) | Normas de Poki |
| Botica de colores | [Cups - Water Sort Puzzle](https://www.crazygames.com/es/game/cups---water-sort-puzzle) (Blury Studio) | Términos de CrazyGames |
| Salida de la cochera | [Bus Escape: Clear Jam](https://www.crazygames.com/es/game/bus-escape-clear-jam) (Mirra Games) | Términos de CrazyGames |
| Hamburguesería / Pizzería / Heladería / Pastelería | Papa's [Burgeria](https://www.crazygames.com/es/game/papa-s-burgeria), [Pizzeria](https://www.crazygames.com/es/game/papas-pizzeria), [Scooperia](https://www.crazygames.com/es/game/papa-s-scooperia), [Bakeria](https://www.crazygames.com/es/game/papas-bakeria) (Flipline Studios) | Términos de CrazyGames |

**CrazyGames:** Aquapark enlaza a la versión original,
[Aquapark.io de Voodoo](https://www.crazygames.com/game/aquapark-io-yky), con el método `external`, porque CrazyGames
**no autoriza insertar sus juegos en otras aplicaciones**: sus [Términos](https://www.crazygames.com/terms-and-conditions)
(abril de 2026, art. 6.3 C: no «provide access to the Services to any third party»; 6.3 I: no «use or copy the
Platform or the Games, except as expressly permitted») no contienen ningún permiso de inserción, sus páginas responden
`X-Frame-Options: SAMEORIGIN` (el navegador bloquea el iframe) y la ruta `/embed/` responde `401 Unauthorized`. Las
herramientas que «extraen» URLs de inserción de CrazyGames no son oficiales y no se usan.

**Añadir un juego online:**
1. Comprobar en la documentación y las condiciones del proveedor que permite el método elegido, y la URL exacta del
   juego (sin construirla a partir del nombre). Para `embed`, comprobar además sus cabeceras (`X-Frame-Options`,
   `frame-ancestors`) y los permisos que necesita.
2. Si el proveedor no está en `PROVIDERS`, añadirlo con sus `linkOrigins` y, solo si autoriza la inserción,
   `embedOrigins`.
3. Añadir la fuente en `ONLINE_SOURCES` (`gameId`, `provider`, `method`, `title`, `developer`, `url`, `verifiedOn`,
   `reason`; con `embed`, también `permissions`, `orientation` y `officialUrl`).
4. `npm run check`: la CSP incluirá el nuevo origen de inserción automáticamente y las pruebas validan la fuente.

**Sonido:** efectos sintetizados con Web Audio (sin archivos ni música de terceros), con interruptor y volumen en la
biblioteca y silencio rápido en la barra de cada juego. El `AudioContext` solo se crea tras una interacción.

**Dependencias nuevas:** ninguna. El motor de ajedrez, la IA y los demás motores son código propio.

### Rediseño visual (v1.1.0)

Una pasada de arte y rendimiento sobre los 21 juegos que solo toca **lo que se ve durante la partida**. Las reglas,
los controles, las colisiones, la puntuación y el guardado siguen igual (las pruebas de motor no cambiaron). Inicio,
biblioteca de juegos, navegación, configuración y almacenamiento quedan fuera.

**Motor por juego.** No se añadió ningún motor ni dependencia (ni PixiJS): cada juego conserva la técnica que mejor le
encaja.

| Técnica | Juegos | Por qué |
| --- | --- | --- |
| Canvas 2D | Aquapark, Arena .io, Tunnel Runner, Pollo, Traffic Rider, Aparcar, Saltos de Lumi, Reino de Ladrillos, Bloques, Stellarium | Escenas que se redibujan a 60 fps con muchos objetos: un lienzo con sprites cacheados es lo más barato |
| DOM + SVG + CSS | Ajedrez, Sudokus, Gato largo, Botica, Cochera, Lava y Agua, Frente Abierto, Resolver casos, Despejar, HexaStack, Heladería, Pizzería, Pastelería | Tableros por turnos: se redibujan solo al cambiar el estado, y conservan la accesibilidad (foco, lectores de pantalla) |

**Utilidades compartidas (`game-center/render/`):**

- `sprites.js`: `createSpriteCache(limit)` pinta cada sprite (coche, estrella, nebulosa, bloque…) **una sola vez** en un
  lienzo fuera de pantalla a la resolución real, y después solo lo copia (`blit`, `blitRotated`). Tiene un límite de
  entradas y se vacía al salir del juego.
- `particles.js`: una reserva de partículas de tamaño fijo que se reciclan, sin crear objetos durante la partida.
- `quality.js`: `initialQuality()` detecta la gama (núcleos y memoria del navegador), `maxDprFor()` limita la
  densidad de píxeles del lienzo (1,5 en gama baja, 2 en el resto) y `createQualityMonitor()` baja los efectos
  opcionales si los fotogramas se alargan. `hooks/useCanvas.js` aplica el límite a todos los lienzos.
- `paint.js`: rectángulos redondeados, color HSL y un generador con semilla (mulberry32), para que los detalles
  «aleatorios» (grietas, vetas, estrellas) salgan siempre iguales y no parpadeen.

**Qué cambió en cada juego (resumen):**

- **Lienzo:** iluminación con degradados cacheados por tamaño de pantalla, sombras de contacto, sprites con volumen y
  efectos de partículas reciclados. Reino de Ladrillos se redibujó en pixel art propio (`engine/pixelArt.js`) y Arena
  .io comparte sus dibujos en `modes/ioArt.js`. Stellarium pinta las estrellas con halos del color de su tipo
  espectral (destellos en cruz en las más brillantes), la Vía Láctea como bruma y las galaxias y nebulosas con
  sprites; antes creaba varios degradados en cada fotograma.
- **Ajedrez:** tablero de arce y nogal, piezas de estilo Staunton en marfil y ébano, jugada que se desliza desde su
  casilla de origen y anillo en las capturas.
- **Sudokus:** papel de pasatiempos; enunciado impreso y respuestas en tinta azul; destello dorado al completar una fila,
  columna o bloque.
- **Cubrir el espacio** (retirado en v1.3.0): cada movimiento queda pintado como una pincelada continua; muros con relieve; destinos con
  flecha de dirección.
- **Lava y Agua:** cueva de basalto, lava con costra y núcleo que late, agua con ondas, piedra nueva con grietas
  incandescentes y vapor, personaje que se desliza y aviso del turno en que avanza la lava espesa.
- **Frente Abierto:** isla con mar y costa, casillas con canto, fichas de tropas legibles sobre cualquier color, iconos de
  ciudad, fortaleza y capital, y borde animado en los objetivos de ataque.
- **Resolver casos:** los 6 escenarios redibujados en perspectiva, con luz, sombras y mobiliario bajo cada punto de
  interés (los datos de los casos no cambiaron).
- **Despejar, HexaStack y cocina:** coches nuevos (`components/CarArt.jsx`), fichas hexagonales con volumen y comida
  dibujada con más detalle.

### Escenarios diurnos (v1.2.1)

Segunda pasada sobre los juegos cuyo escenario era casi negro (losas al 7 % de blanco, asfalto gris, mostradores azul
marino). Mecánicas, controles, puntuación y niveles no cambian.

- **Lava y Agua → «isla volcánica a mediodía»:** senderos de arena, rocas de basalto con musgo, lava viva, agua
  turquesa, cielo cálido y el volcán humeando detrás del tablero; cruceta de terracota y botón de esperar en azul.
- **Cubrir el espacio → «taller de azulejos»** (retirado en v1.3.0): bandeja de cerámica crema sobre papel con rejilla y muros de azulejo
  vidriado azul petróleo; Deslizar pinta en violeta-rosa y Trazo en turquesa-lima (también en el menú).
- **Despejar → aparcamiento de barrio:** acera de baldosas, seto alrededor, asfalto azulado con líneas amarillas y
  jardineras como obstáculos.
- **Aparcar el carro:** acera clara y árboles de calle (fuera del aparcamiento y de los botones táctiles), pintados una
  vez en un fondo cacheado aparte (un solo elemento: no llena la caché de sprites con imágenes de pantalla completa).
- **Heladería, Pizzería y Pastelería:** cada tienda con su mostrador (damero menta y mármol blanco; azulejo de
  trattoria y madera; papel rayado rosa y mármol rosado con canto dorado), toldo a rayas y suelo propio.

En estos seis juegos el manifiesto declara `scene: 'day'`: `GamePage` añade `.game-daylight` al cuerpo durante el juego
(menú de niveles incluido), que redefine los tokens de texto y superficie (`styles/game-screen.css`). Así HUD, botones,
pausa y resultados se leen sobre fondo claro aunque la app esté en tema oscuro, sin reescribir cada componente. La
barra superior y la presentación siguen el tema de la app.

**Principios:** las animaciones se disparan solo con cambios reales del estado (claves de React o comparación con el
estado anterior), nunca en bucle sin motivo. El movimiento reducido (preferencia del sistema o de la app) las desactiva
con la regla global de `styles/base.css`. Cada juego conserva un solo bucle `requestAnimationFrame`, que se cancela al
desmontarlo.

**Cómo se validó:** `npm run check` (748 pruebas unitarias y de interfaz, build y 94 comprobaciones E2E offline) y
capturas de los 21 juegos en un móvil emulado de 390×844 con DPR 2 en Edge, sin errores de consola. **No se ha probado
en teléfonos físicos, ni se han medido los fps antes y después**: la mejora de rendimiento se deduce de que se
dibuja menos en cada fotograma, no de una medición.
