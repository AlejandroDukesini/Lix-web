# Un año más contigo

Un regalo digital de Año Nuevo: una aplicación **privada**, **instalable** y **100 % local** (sin servidores, sin
nube, sin Internet después de la primera carga) que irá creciendo por fases hasta convertirse en nuestro espacio:
juegos, documentos, diario, calendario y finanzas.

---

## Qué incluye

| Área | Estado |
| --- | --- |
| Presentación de Año Nuevo: **viaje astral** guiado por el desplazamiento (Fase 1 revisada) | ✅ Funcional |
| Inicio personalizado (saludo, apodos animados, tiempo juntos, cuenta atrás de Año Nuevo) | ✅ Funcional |
| Configuración completa (apodos, textos, estilo, tema, colores, calendario, fechas, datos) | ✅ Funcional |
| Dos estilos visuales (Glassmorphism y Maximalismo) × dos temas (claro y oscuro) | ✅ Funcional |
| Persistencia local (localStorage + copia en IndexedDB, migraciones, reparación) | ✅ Funcional |
| PWA: manifest, iconos, Service Worker con precarga total, funcionamiento sin conexión | ✅ Funcional |
| **Game Center — Fase 1**: Aquapark, Arena .io (3 minijuegos), Cubrir el espacio, Ajedrez, Tunnel Runner | ✅ Funcional (ver [Game Center](#game-center)) |
| **Game Center — Fase 2**: Pollo pasando la calle sangriento, Resolver casos, Sudokus, Aparcar el carro, Despejar el estacionamiento | ✅ Funcional |
| **Game Center — Fase 3**: HexaStack, Traffic Rider, Frente Abierto (inspirado en Open Front), Saltos de Lumi (plataformas originales) | ✅ Funcional |
| Game Center — Fase 4 (4 juegos) | 🗺️ Planificados en la hoja de ruta; sin implementar |
| Documentación, Diario y notas, Calendario, Finanzas | ⏳ Próximas fases (solo reservados, sin datos ficticios) |

### La presentación: «Bitácora de observación»

Un viaje por el universo que se recorre desplazándose hacia abajo. No es una animación que se mira, es un registro
astronómico que se va completando: cada capítulo tiene su texto, su ilustración y su movimiento de cámara.

| Capítulo | Qué ocurre |
| --- | --- |
| **Prólogo** | Cielo profundo con estrellas en tres profundidades, nebulosas y planetas lejanos. Las frases aparecen con pausas narrativas («Hay millones de estrellas en el universo...»). Dedicatoria con los apodos animados. |
| **I · La galaxia** | Miles de puntos luminosos dispersos por el cielo se reúnen con el scroll —cada uno con su propio retardo— en los brazos de una **galaxia espiral** que gira en el centro; con el capítulo II se aleja a una esquina. Paralaje, polvo cósmico y estrellas fugaces. |
| **II · Constelaciones** | Las líneas se dibujan con el scroll como **una línea de tiempo real**: nacen en la estrella *21 jul 2025 · el comienzo* (fecha configurada) y un contador acompaña la punta del trazo sumando los días hasta *hoy*. Al cerrarse el travesaño, la constelación forma —sin decirlo— una **«A»**. |
| **III · La Tierra** | Un punto azul lejano crece hasta ser el **planeta Tierra** (océanos, continentes con coordenadas reales, nubes, casquetes, atmósfera y terminador día/noche) que gira con el scroll de África hacia las Américas. Al final la cámara desciende: el globo se inclina hacia el ecuador y su borde se convierte en el horizonte sobre el que aparece el telescopio. |
| **IV · Telescopio** | En un planeta diminuto con atmósfera y un observatorio con la rendija iluminada se alza un refractor sobre montura ecuatorial: tubo esmaltado, anillos de latón, buscador, lente con reflejos, contrapeso, trípode, una linterna roja (detalle real de astrónomos) y notas manuscritas. Del ocular escapa una luz cálida. |
| **V · Asomarse** | La cámara viaja hasta el ocular, el campo de visión se estrecha en un iris y el universo se atenúa. Aparece una vista circular con retícula graduada; el enfoque se ajusta con el scroll («Enfocando… 64 %»). |
| **VI · La vela** | En el centro, una vela de cera con textura y llama viva lleva la **letra «A» grabada en oro**. Ficha del objeto: *Objeto A · Magnitud: incalculable · Distancia: aquí*. La «A» de la constelación reaparece enmarcando el ocular. Tras una pausa: **«Otro año juntos»**. |
| **VII · La sorpresa** | El iris se abre, el universo recupera la luz y la vela queda encendida junto al mensaje final, la firma y **«Entrar a nuestro universo»**. |

Detalles de la experiencia:

- **Distancia al destino**: un contador desciende de 13.800 millones de años luz hasta «Has llegado».
- **Control total**: se avanza y retrocede con rueda, teclado, gestos o el índice de capítulos (I–VII); botón
  «Siguiente capítulo», «Saltar presentación» y «Volver a empezar el viaje». El scroll nunca se bloquea.
- **Sin permisos**: no usa micrófono ni cámara (la versión anterior de la vela tenía soplido experimental por
  micrófono; se retiró).
- **Movimiento reducido**: sin acercamientos ni cámara; cada capítulo se muestra en su composición clave.
- **Estilos y temas**: en Glass los textos van en paneles esmerilados y la lente tiene reflejos; en Maximal todo es una
  carta estelar impresa (tinta gruesa, numerales gigantes, telescopio esmaltado en el color primario). El tema claro es
  un «universo luminoso» al amanecer. Todo cambia al momento.

Aparece sola la primera vez. Después se puede repetir desde el Inicio o desde Configuración sin cambiar nada, y se
puede «restablecer» para que vuelva a aparecer en el siguiente inicio. Sus textos y la letra de la vela son editables.

---

## Tecnologías

- **React 19** + **Vite** (JavaScript moderno, sin TypeScript: el dominio es pequeño y la validación en tiempo de
  ejecución ya protege los datos guardados).
- **React Router** (`HashRouter`: funciona igual en el servidor local, en la app instalada y en cualquier carpeta, sin
  configuración de servidor).
- **lucide-react** para iconos (se empaquetan localmente, solo los usados).
- **CSS propio** con tokens y variables (sin frameworks), fuentes **locales** (OFL, ver `src/assets/fonts/LICENSE.md`).
- **localStorage** (preferencias, lectura síncrona sin parpadeos) + **IndexedDB** (copia de seguridad y base para las
  próximas fases).
- **Service Worker propio** + **Web App Manifest**.
- **Vitest** + **Testing Library** (unitarias e integración) y **Playwright-core** con el Edge/Chrome instalado (E2E real).

No hay backend, API, analítica, CDN, Google Fonts ni ninguna petición externa. Una **Content-Security-Policy**
(`default-src 'self'`) lo garantiza en el build: el navegador bloquearía cualquier intento de cargar algo de fuera.

---

## Requisitos y comandos

Requiere **Node.js 20+** (probado con Node 24) y npm.

```bash
npm install          # instalar dependencias (única vez que se necesita Internet)
npm run dev          # desarrollo con recarga en caliente → http://localhost:5173  (sin Service Worker)
npm run build        # versión de producción en dist/
npm run preview      # sirve dist/ en http://localhost:4173 (con Service Worker y modo offline)
npm start            # build + preview y abre el navegador: lo más cómodo para usarla en el computador
npm test             # pruebas unitarias y de integración (Vitest)
npm run test:e2e     # verificación en navegador real (requiere build previo; usa Edge o Chrome instalados)
npm run check        # todo lo anterior: test + build + e2e
npm run icons        # regenera los iconos PNG desde el diseño SVG
```

### Desarrollo ≠ producción

- `npm run dev` es para programar: no registra el Service Worker (los archivos cambian a cada guardado).
- `npm run build` + `npm run preview` (o `npm start`) sirve la versión real. Es un servidor **local** en tu propio
  computador; no publica nada en Internet.

### Usarla sin abrir una terminal

Una PWA necesita un origen `http://localhost` o `https://` para registrar el Service Worker y poder instalarse:
abrir `dist/index.html` con doble clic (`file://`) **no** es compatible con Service Worker ni con la instalación.
Alternativas válidas:

1. **Instalarla (recomendado).** Ejecuta `npm start` una vez, instálala (ver abajo) y desde entonces ábrela desde el
   menú Inicio / escritorio / pantalla de inicio: el Service Worker la sirve desde la caché **sin servidor y sin
   Internet**.
2. **Para el teléfono**, sirve la carpeta `dist/` en la red local con HTTPS o publícala en un alojamiento estático
   privado de tu elección; tras la primera carga, la app funciona sin conexión y los datos siguen solo en el teléfono.
   (Safari exige HTTPS para el Service Worker fuera de `localhost`.)

---

## Instalación como aplicación

**Computador (Chrome / Edge):** con la app abierta (`npm start`), pulsa el icono de instalar al final de la barra de
direcciones, o *Configuración → Instalar y usar sin Internet → Instalar aplicación* cuando el navegador lo ofrece.
Firefox de escritorio no instala PWAs (se puede usar en una pestaña).

**Android (Chrome):** menú ⋮ → *Instalar aplicación* / *Añadir a pantalla de inicio*.

**iPhone / iPad:** iOS no tiene botón de instalación automático. Abre la app en **Safari** → botón **Compartir** →
**Añadir a pantalla de inicio** → **Añadir**. La app no muestra un botón «Instalar» en iOS porque no podría cumplirlo;
en su lugar enseña estos pasos. Probada en simulación de iPhone XS (375 × 812) con áreas seguras (`viewport-fit=cover`
+ `env(safe-area-inset-*)`).

---

## Arquitectura

```
public/
  service-worker.js        Ciclo de vida del SW; la lista de precarga se inyecta en el build
  manifest.webmanifest     Nombre, iconos, colores, modo standalone
  boot.js                  Aplica estilo/tema guardados antes del primer pintado (sin destellos)
  offline.html             Recuperación si se abre sin conexión antes de la primera carga completa
  icons/                   Iconos PWA (generados por scripts/generate-icons.mjs)
scripts/
  vite-plugin-offline.js   Inyecta la CSP y genera la precarga + versión del Service Worker
  generate-icons.mjs       SVG → PNG (192, 512, maskable, apple-touch-icon, favicon)
  verify-offline.mjs       E2E en navegador real
src/
  main.jsx                 Punto de entrada (estilos globales, PWA, React)
  app/
    App.jsx                Proveedores, rutas y puerta del primer inicio
    modules.js             Registro de áreas: genera navegación e inicio (activos y «próximamente»)
    providers/             PreferencesProvider (estado + guardado), AppearanceSync (tokens → <html>)
  components/
    common/                Button, IconButton, Card, Badge, SectionHeader, Dialog, ConfirmDialog,
                           TextField, SegmentedControl, Switch, ColorField
    feedback/              ToastProvider, ErrorBoundary, AppNotices
    layout/                AppShell, AmbientBackground
    navigation/            Barra lateral, barra superior, barra inferior, hoja «Espacios»
    presentation/          Candle (vela con monograma), NicknameCarousel (apodos animados)
  features/
    presentation/          PresentationExperience (orquesta el viaje) + astral.css
      story/               timeline.js        escenas, progreso por scroll y cálculo puro de cada fotograma
                           useScrollStory.js  scroll → progreso por escena (rAF, sin bloquear el scroll)
                           applyFrame.js      escribe el fotograma en el DOM (sin re-render de React)
                           CosmosCanvas.jsx   estrellas, polvo, estrellas fugaces y galaxia (Canvas 2D)
                           SkyLayers.jsx      cielo, nebulosas y planetas
                           Constellation.jsx  la línea del tiempo que forma la «A»
                           Telescope.jsx      planeta, observatorio y telescopio (SVG)
                           EyepieceView.jsx   iris, retícula, enfoque, ficha y la vela
    home/                  HomePage
    settings/              SettingsPage + una sección por archivo
  hooks/                   useMediaQuery, useReducedMotion, useNow, usePwa
  services/
    storage/               safeLocalStorage, database (IndexedDB + migraciones), storageStatus
    preferences/           defaults, validation, migrations, preferencesService
    pwa/                   pwaStore (registro del SW, actualizaciones, instalación)
  styles/                  fonts, tokens, themes, base, components, layout
  utils/                   dates, color, cx
  tests/                   setup + integración de la app
```

**Viaje astral (narrativa persistente):** un contenedor alto (`.astral__track`, (duración + 1) pantallas) con un
escenario `position: sticky` del alto de la pantalla (`.astral__stage`, `100dvh`). El escenario es una rejilla
—cabecera / zona visual / narrativa / progreso— que nunca sale de la pantalla: los textos de todos los capítulos
comparten la misma celda (siempre visibles, nunca dos a la vez) y la ilustración se compone dentro del rectángulo
medido de la zona visual, así que texto e imagen no se pisan en ningún tamaño. `useScrollStory` (un solo listener
pasivo agrupado en `requestAnimationFrame` + `ResizeObserver`) convierte el desplazamiento en un progreso global
0–1 y por capítulo; `computeFrame` (función pura y probada) lo traduce a estado visual y `applyFrame` lo escribe
directamente en el DOM, solo cuando un valor cambia. React solo se renderiza al cambiar de capítulo. En vertical
la tarjeta final se ancla abajo fuera del cálculo de la fila (no encoge la zona visual de los demás capítulos) y la
cámara sube la vela al hueco libre de encima (`finalArea`).

**Flujo de datos:** los componentes nunca tocan el almacenamiento. Llaman a `update(sección, cambios)` del
`PreferencesProvider`, que valida (`validation.js`), guarda (`preferencesService.js`) y publica el nuevo estado.
`AppearanceSync` traduce la apariencia a atributos (`data-style`, `data-theme`, `data-motion`) y variables CSS.

---

## Game Center

Ruta `#/juegos` (biblioteca, dentro del marco de la app) y `#/juegos/:id` (pantalla de juego a pantalla completa,
fuera del marco, como la presentación). Todo en `src/features/game-center/`.

```
game-center/
  GameCenter.jsx   biblioteca: marquesina, destacado, recientes, búsqueda, filtros, estadísticas, hoja de ruta
  GamePage.jsx     marco de partida: barra superior, presentación previa, ayuda, salida con confirmación, audio
  registry/        gameRegistry.js (lista de manifiestos; cada uno declara su fase), categories.js, roadmap.js (fase 4)
  online/          onlineSources.js (proveedores y fuentes online verificadas, lista permitida)
  services/        gameStorage.js (IndexedDB), gameLifecycle.js (estados, formato, RNG con semilla), gameAudio.js
  hooks/           useGameSession, useGameLoop, useKeyboard, useCanvas, useGameStatistics, useGameFrame, useGameAudio
  components/      GameCard, GameLibrary, GameFilters, GameDetails, GameHUD, GameOverlay (pausa), GameResults,
                   Countdown, TouchControls (botones mantenidos, joystick, cruceta, deslizamientos, conducción,
                   plataformas con dos dedos)
  games/<id>/      manifest.js, componente del juego, Art (SVG original), engine/, styles/, tests/
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
| **Cubrir el espacio** | Dos reglas: *Deslizar* (avanzar hasta el muro) y *Trazo único* (sin repisar). 20 niveles con límite = solución óptima demostrada. Destinos marcados, deshacer, pista (del solucionador) y «sin salida» cuando el solucionador demuestra que ya no hay solución. | Flechas/WASD, clic en celda marcada, deslizar; Z deshacer, R reiniciar | niveles superados, mejor tiempo por nivel |
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

**Añadir un juego (fase 4):** crear `games/<id>/` con `manifest.js` (campos en la cabecera de
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

**Fuentes online configuradas (verificadas el 3 de octubre de 2026; todas con el método `external`):**

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

## Persistencia local

| Dónde | Qué | Clave |
| --- | --- | --- |
| localStorage | Preferencias completas (JSON validado, con `schemaVersion`, hoy **v2**) | `uamc:preferences` |
| IndexedDB `un-ano-mas-contigo` | `backups/preferences` (copia) y `meta/firstOpenedAt` (primera apertura de la app; **no** es la fecha de la relación) | — |
| IndexedDB, store `games` (migración **v2**) | Un registro por juego (`version`, partidas, terminadas, tiempo, último acceso, mejores marcas, progreso, ajustes) y `__center__` (sonido y volumen) | id del juego |

- **Game Center:** cada registro se valida al leerse (`normalizeRecord`); las escrituras de un mismo juego se encolan
  para no pisarse; un récord solo se anuncia si supera la marca ya guardada. Sin IndexedDB funciona en memoria. No toca
  las preferencias generales. *Borrar todo* también elimina estas estadísticas; la copia JSON descargable sigue
  incluyendo solo las preferencias.

- **Carga:** se lee localStorage → se migra → se sanea campo a campo. Un valor inválido toma el predeterminado y se
  avisa («algunas preferencias se restablecieron»). JSON dañado o almacenamiento bloqueado nunca rompen la app.
- **Recuperación:** si localStorage está vacío pero existe la copia en IndexedDB, se restaura automáticamente.
- **Sin almacenamiento** (p. ej. modo privado estricto): la app funciona en memoria y avisa de que los cambios no se
  conservarán.
- **Migración v1 → v2 (viaje astral):** los textos de la vela pasan a los textos de los capítulos. Se conservan la
  firma, el título «Otro año juntos» y, si se había personalizado, el mensaje de celebración (pasa a ser el mensaje
  final). Se añade `presentation.candleLetter` («A»). El estado «presentación vista» y el resto de preferencias no
  cambian. Si se recuperan preferencias desde IndexedDB, la app espera a esa recuperación (máx. 1,5 s) antes de decidir
  si mostrar la presentación.
- **Migraciones:** preferencias en `services/preferences/migrations.js`; base de datos en
  `services/storage/database.js` (`DB_MIGRATIONS`, una función por versión, nunca se edita una ya publicada).
- **Copias:** *Configuración → Datos* permite descargar y restaurar un archivo JSON, pedir almacenamiento persistente,
  restablecer la configuración (conserva el estado de la presentación, con «Deshacer») y **borrar todo** (confirmación
  escribiendo `BORRAR`).

> ⚠️ El almacenamiento del navegador **no es eterno**: se pierde si se borran los datos de navegación, se desinstala
> la app o el sistema libera espacio (en iOS, Safari puede borrar datos de sitios no usados durante semanas si no está
> instalada). Instalar la app, pulsar *Proteger mis datos* y descargar copias periódicas reduce el riesgo.

---

## Personalización visual

- **Tokens** (`styles/tokens.css`): tipografía, espaciado, radios, duraciones, curvas, z-index, puntos de ruptura.
- **Temas y estilos** (`styles/themes.css`): dos ejes independientes. `data-theme` define colores semánticos
  (`--text`, `--border`, `--danger`…); `data-style` define el lenguaje visual (`--surface`, `--surface-shadow`,
  `--heading-font`, `--control-radius`…). Los componentes solo usan tokens semánticos.
- **Paleta personal**: `--c-primary`, `--c-secondary`, `--c-accent`, `--c-ambient` se escriben desde la configuración;
  los colores de texto sobre ellos (`--c-on-*`) se calculan por contraste WCAG. Las paletas predefinidas están en
  `services/preferences/defaults.js`.
- Sin `backdrop-filter`, el cristal pasa a superficies casi opacas (legibilidad garantizada).
- Movimiento reducido: se respeta `prefers-reduced-motion` y además existe la opción *Animaciones: Reducidas*.

---

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
- `npm run test:e2e` incluye además: Game Center y los **catorce** juegos **sin conexión**, la IA de ajedrez respondiendo
  sin red desde su Worker precacheado, catorce juegos disponibles, enlaces online oficiales de las Fases 2 y 3, fases futuras sin enlaces, sin desplazamiento
  horizontal y **casillas de ajedrez de al menos 28 px** en los 7 tamaños (incluido el móvil en horizontal).
- `npm test` — pruebas de la Fase 1 (Vitest + Testing Library + fake-indexeddb): fechas, contraste, validación, migraciones
  (incluida v1 → v2), letra de la vela, persistencia, datos corruptos, almacenamiento bloqueado, copia en IndexedDB,
  exportar/importar, borrado; línea de tiempo del viaje (progreso, escena activa, movimiento reducido, ventanas de
  texto sin solapes en todo el recorrido, constelación, distancia, iris, enfoque, eco de la «A», vela sobre el
  mensaje final); recorrido completo del viaje con escenario sticky simulado (avanzar, retroceder, saltos bruscos,
  revelación, final operable solo cuando se ve), sin permisos de micrófono/cámara, saltar, repetir sin cambiar preferencias,
  configuración y rutas.
- `npm run test:e2e` — **74 comprobaciones** en Edge/Chrome real. El viaje completo con scroll real se recorre en
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

---

## Limitaciones conocidas

- La instalación y el Service Worker requieren `localhost` o HTTPS; `file://` no está soportado por los navegadores.
- En iPhone la instalación es manual (Safari → Añadir a pantalla de inicio). **No se ha probado en un iPhone físico**:
  solo con emulación de iPhone XS en Chromium. Conviene validar en el dispositivo real el desplazamiento con la barra
  de Safari (alto de pantalla dinámico), el rendimiento de los desenfoques y la fluidez del viaje.
- Los datos viven en un solo navegador de un solo dispositivo: no hay sincronización entre teléfono y computador.
- **Modo online:** ningún juego de CrazyGames puede jugarse dentro de la app (el proveedor no lo autoriza; ver «Modo
  offline / online»): Aquapark abre la página oficial. `OnlineGameFrame` está listo y probado (unitariamente, en jsdom)
  para un proveedor que sí autorice la inserción, pero no se ha probado con un juego real en el navegador porque hoy no
  hay ninguno verificado. Las sesiones online no se registran: la app no puede medir su duración ni conocer resultados.
- **Game Center:** sin multijugador remoto por diseño (los rivales son bots locales). El ajedrez a dos jugadores es por
  turnos en el mismo dispositivo. Las estadísticas de juegos no van en la copia JSON descargable. Los controles
  táctiles se han validado con emulación móvil en Edge, **no en un Android ni en un iPhone físicos** (pendiente:
  latencia táctil, rendimiento del lienzo en gama baja, Safari iOS).
- **Fase 3:** Frente Abierto es por turnos contra una IA local; no reproduce el multijugador en tiempo real de
  OpenFront.io (para eso está el enlace a la original). En mapas grandes en un teléfono vertical el mapa se desplaza
  en horizontal dentro de su marco para que cada casilla mida al menos ~36 px. En Saltos de Lumi, en un teléfono en
  horizontal los controles quedan en las esquinas sobre el nivel (semitransparentes); en vertical se ve menos nivel a
  lo ancho (la pantalla sugiere girar). La multitáctil se ha comprobado con eventos táctiles reales de Chromium (CDP)
  y en jsdom, **no en un teléfono físico**.
- **Viaje astral en móviles muy bajos** (≈360×640): en el capítulo VII la vela se reduce bastante para caber sobre
  la tarjeta final. La transición del alto dinámico de la barra de Safari solo se ha emulado, no probado en iOS real.

---

## Próximas fases

> No se han implementado módulos nuevos ni pantallas de relleno: los puntos de extensión ya existen y se describen aquí.

- **Game Center, fase 4** (en `registry/roadmap.js`, visibles como «Próxima incorporación», sin botón de jugar;
  las Fases 2 y 3 ya están implementadas): bloques que caen (original), Stellarium, Lava and Aqua, cocina de pedidos
  (helados, pasteles y pizzas). Ver «Añadir un juego» en [Game Center](#game-center).
- **Documentación (20+):** documentos locales (Markdown/JSON) en `src/features/documentation/content/`, con
  categorías, índice de búsqueda generado en local y lector; renderizado sin `dangerouslySetInnerHTML`.
- **Diario, notas y recordatorios:** stores `journal`, `notes`, `reminders` con índices por fecha y categoría, listos
  para enlazarse con el calendario.
- **Calendario:** consumirá `preferences.calendar.weekStartsOn` (ya configurable) y las fechas de los registros.
- **Finanzas:** store propio y separado del resto.

Para activar cualquiera: crear su carpeta en `src/features/`, cambiar su `status` a `'available'` en
`src/app/modules.js`, añadir su ruta en `App.jsx` y, si guarda datos, una migración en `DB_MIGRATIONS`.
