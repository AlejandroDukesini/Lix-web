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
| Juegos, Documentación, Diario y notas, Calendario, Finanzas | ⏳ Próximas fases (solo reservados, sin datos ficticios) |

### La presentación: «Bitácora de observación»

Un viaje por el universo que se recorre desplazándose hacia abajo. No es una animación que se mira, es un registro
astronómico que se va completando: cada capítulo tiene su texto, su ilustración y su movimiento de cámara.

| Capítulo | Qué ocurre |
| --- | --- |
| **Prólogo** | Cielo profundo con estrellas en tres profundidades, nebulosas y planetas lejanos. Las frases aparecen con pausas narrativas («Hay millones de estrellas en el universo...»). Dedicatoria con los apodos animados. |
| **I · Estrellas** | La cámara avanza lentamente; paralaje, polvo cósmico y estrellas fugaces ocasionales. |
| **II · Constelaciones** | Las líneas se dibujan con el scroll como **una línea de tiempo real**: nacen en la estrella *21 jul 2025 · el comienzo* (fecha configurada) y un contador acompaña la punta del trazo sumando los días hasta *hoy*. Al cerrarse el travesaño, la constelación forma —sin decirlo— una **«A»**. |
| **III · Galaxia** | Una galaxia espiral de partículas (núcleo, brazos, polvo) se acerca hasta atravesarla con un destello. |
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

**Viaje astral (scrollytelling):** la página es una pila de secciones, una por capítulo, con el texto real en
orden de lectura; su altura define cuánto dura cada escena. Detrás hay un escenario fijo con las capas visuales.
`useScrollStory` convierte el desplazamiento en progreso 0–1 por escena, `computeFrame` (función pura y probada)
lo traduce a estado visual y `applyFrame` lo escribe directamente en el DOM, solo cuando un valor cambia. React
solo se renderiza al cambiar de capítulo o al revelar un texto.

**Flujo de datos:** los componentes nunca tocan el almacenamiento. Llaman a `update(sección, cambios)` del
`PreferencesProvider`, que valida (`validation.js`), guarda (`preferencesService.js`) y publica el nuevo estado.
`AppearanceSync` traduce la apariencia a atributos (`data-style`, `data-theme`, `data-motion`) y variables CSS.

---

## Persistencia local

| Dónde | Qué | Clave |
| --- | --- | --- |
| localStorage | Preferencias completas (JSON validado, con `schemaVersion`, hoy **v2**) | `uamc:preferences` |
| IndexedDB `un-ano-mas-contigo` | `backups/preferences` (copia) y `meta/firstOpenedAt` (primera apertura de la app; **no** es la fecha de la relación) | — |

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

- `npm test` — **57 pruebas** (Vitest + Testing Library + fake-indexeddb): fechas, contraste, validación, migraciones
  (incluida v1 → v2), letra de la vela, persistencia, datos corruptos, almacenamiento bloqueado, copia en IndexedDB,
  exportar/importar, borrado; línea de tiempo del viaje (progreso, escena activa, movimiento reducido, ventanas de
  texto, constelación, distancia, iris, enfoque, eco de la «A»); recorrido completo del viaje con scroll simulado
  (avanzar, retroceder, revelación, final), sin permisos de micrófono/cámara, saltar, repetir sin cambiar preferencias,
  configuración y rutas.
- `npm run test:e2e` — **41 comprobaciones** en Edge/Chrome real (iPhone XS 375×812 y escritorio 1440×900): viaje
  completo con scroll real (constelación completa, telescopio revelado, iris y ocular, vela con «A» en el centro,
  «Otro año juntos»), regreso a un capítulo anterior, índice de capítulos, persistencia, Service Worker,
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

---

## Próximas fases

> La Fase 2 todavía no tiene especificaciones funcionales. No se han implementado módulos nuevos ni pantallas de
> relleno: los puntos de extensión ya existen y se describen aquí.

- **Juegos (~20):** cada juego en `src/features/games/<juego>/` con su interfaz y lógica; un registro de juegos
  (id, título, carga diferida con `lazy()`) alimentará una ruta `/juegos/:id`. Su progreso irá en un object store
  propio de IndexedDB añadido con una nueva migración.
- **Documentación (20+):** documentos locales (Markdown/JSON) en `src/features/documentation/content/`, con
  categorías, índice de búsqueda generado en local y lector; renderizado sin `dangerouslySetInnerHTML`.
- **Diario, notas y recordatorios:** stores `journal`, `notes`, `reminders` con índices por fecha y categoría, listos
  para enlazarse con el calendario.
- **Calendario:** consumirá `preferences.calendar.weekStartsOn` (ya configurable) y las fechas de los registros.
- **Finanzas:** store propio y separado del resto.

Para activar cualquiera: crear su carpeta en `src/features/`, cambiar su `status` a `'available'` en
`src/app/modules.js`, añadir su ruta en `App.jsx` y, si guarda datos, una migración en `DB_MIGRATIONS`.
