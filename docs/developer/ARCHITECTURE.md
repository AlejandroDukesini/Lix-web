# Arquitectura

Cómo está hecha la app web (la misma que va dentro del APK). Para compilar, ver [BUILD.md](BUILD.md).

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
  vite-plugin-library.js   Construye el índice de la biblioteca (virtual:library-index) desde los .md
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
    library/               Biblioteca: LibraryPage, ReaderPage, GlossaryPage
      content/<estante>/   Un .md por capítulo (cosmos, criminalistica, idiomas, creencias)
      engine/markdown.js   Formato de los documentos: parser puro (lo usan el plugin y el lector)
      registry/            shelves.js (estantes y recorridos), catalog.js (catálogo, búsqueda, glosario)
      services/            libraryStorage (favoritos, progreso, marcadores, tamaño de texto)
    organizer/             Organización personal (ver la sección propia)
      data/                entities (catálogo y relaciones), store (IndexedDB, transacciones), fields, recurrence,
                           tags, csv, attachments, seeds, hooks
      shared/              UI común (campos, formularios, borrado con integridad, gráficos), markdown seguro,
                           editor con guardado automático, papelera, PIN de privacidad
      finance/ planner/ notes/ journal/ emotions/ dashboard/ reminders/
      tests/               lógica pura, almacén, copias e interfaz de cada módulo
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

## Persistencia local

| Dónde | Qué | Clave |
| --- | --- | --- |
| localStorage | Preferencias completas (JSON validado, con `schemaVersion`, hoy **v2**) | `uamc:preferences` |
| IndexedDB `un-ano-mas-contigo` | `backups/preferences` (copia) y `meta/firstOpenedAt` (primera apertura de la app; **no** es la fecha de la relación) | — |
| IndexedDB, store `games` (migración **v2**) | Un registro por juego (`version`, partidas, terminadas, tiempo, último acceso, mejores marcas, progreso, ajustes) y `__center__` (sonido y volumen) | id del juego |
| IndexedDB, store `library` (migración **v3**) | Favoritos, progreso por capítulo (porcentaje, sección, fechas, leído), marcadores por sección y tamaño de texto; validado al leerse e incluido en la copia de seguridad completa (sección `library`) | `state` |
| IndexedDB, store `organizer` (migración **v4**) | Todos los registros de la organización: `{ id, kind, createdAt, updatedAt, rev, …campos }` (más `history` en los movimientos). Los ajustes son registros únicos (`financeSettings`, `privacySettings`…) | id |
| IndexedDB, store `attachments` (migración **v4**) | Adjuntos (imágenes y PDF ≤ 3 MB) como ArrayBuffer; los huérfanos de más de un día se limpian al abrir | id |
| IndexedDB, `backups/pre-restore` | Instantánea completa guardada justo antes de restaurar una copia («Deshacer la última restauración») | — |
| localStorage `uamc:draft:<id>`, `uamc:reminders:*` | Borradores de notas y diario aún sin guardar; avisos ya mostrados | — |

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
- **Copias (formato v3):** se puede elegir qué secciones exportar; al restaurar hay vista previa (nuevos / ya
  existentes / más recientes en la copia), elección de secciones y modo **Combinar** (añade y conserva la versión más
  reciente; no borra) o **Reemplazar** (el módulo queda como en la copia). Antes de aplicar se guarda una instantánea
  para deshacer. Los adjuntos viajan en base64. Las copias v1 y v2 se siguen aceptando.
- **Copias:** *Configuración → Datos* permite descargar y restaurar un archivo JSON, pedir almacenamiento persistente,
  restablecer la configuración (conserva el estado de la presentación, con «Deshacer») y **borrar todo** (confirmación
  escribiendo `BORRAR`).

> ⚠️ El almacenamiento del navegador **no es eterno**: se pierde si se borran los datos de navegación, se desinstala
> la app o el sistema libera espacio (en iOS, Safari puede borrar datos de sitios no usados durante semanas si no está
> instalada). Instalar la app, pulsar *Proteger mis datos* y descargar copias periódicas reduce el riesgo.

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

## Lix Flowers (Python en el dispositivo)

- Python corre de verdad: src/features/flowers/python/lix_flowers.py es la única implementación
  del motor. En la app se ejecuta con Pyodide (CPython 3.14 compilado a WebAssembly) dentro de un
  Web Worker; en un computador, con CPython: python lix_flowers.py --ayuda (genera GIF o reproduce
  en la terminal con color). No hay servidor: Python y Pillow van dentro de la app (≈14 MB, ≈5 MB
  comprimidos) y se precachean, así que funciona sin conexión.
- Proceso con una imagen: (1) lectura y validación con Pillow (formato PNG/JPEG/WEBP, tamaño
  ≤ 12 MB, mínimo 16×16, máximo 40 MP, orientación EXIF); (2) redimensionado a una rejilla de
  celdas (corrigiendo que una celda de texto es el doble de alta que ancha); (3) escala de grises y
  separación del fondo de la foto (distancia de color a la mediana de los bordes) para la densidad;
  colores originales cuantizados, un tema o un solo color; (4) conversión a caracteres según la
  intensidad; (5) generación de fotogramas con un efecto (floración, brisa, brillo, pétalos,
  latido); (6) secuencia animada; (7) visualización en un canvas de la app y exportación a GIF con
  Pillow (fuente de mapa de bits 6×11, monoespaciada).
- 10 plantillas sin imagen, dibujadas con Python puro: flores creciendo, pétalos cayendo, rosa
  animada, girasol (filotaxis de 137,5°), jardín, lluvia de flores, corazón de flores, flores
  brillantes, floración progresiva y jardín nocturno. Los bucles son continuos cuando procede.
- Personalización: velocidad, tamaño (48/72/96 columnas), colores, intensidad, cantidad de
  caracteres (5/10/70), fondo, tipo de animación y variación (semilla). Reproducir, pausar,
  reiniciar. Guardar en el herbario (GIF ≤ 3 MB como adjunto) y exportar GIF o TXT.
- La validación se hace dos veces: en JavaScript (tipo, extensión, peso, dimensiones) y en Python.
- La interfaz muestra la prueba: «Generado con Python (Pyodide 314.0.7) y Pillow · … ms».

## Lix AI Studio

Análisis: un modelo de imágenes en el teléfono no es viable (Stable Diffusion necesita 2-4 GB y
GPU/WebGPU; Pyodide no puede ejecutarlo). Una API en la nube rompería el principio 100 % local y
requeriría claves, así que no viene configurada.
Implementación:
- Pintor procedural (proceduralPainter.js): reconoce palabras clave (cielo, mar, montañas, flores,
  ciudad, lluvia, nieve, colores…) y compone la escena en un canvas. Siempre etiquetado «Procedural ·
  no es IA» y enseña las palabras que reconoció (o que no reconoció ninguna).
- IA real con un servidor propio (providers.js): Stable Diffusion WebUI / Forge / SD.Next
  (POST /sdapi/v1/txt2img) o servidores compatibles con OpenAI en local, como LocalAI
  (POST /v1/images/generations). Solo este computador (localhost) o equipos de la red en los
  puertos 7860/8080. Sin claves en el código ni en el repositorio; solo se hace una petición al
  pulsar «Generar» o «Probar conexión»; errores explicados (sin conexión, HTTP, respuesta sin
  imagen, firma de imagen no válida, tiempo de espera de 3 minutos, cancelación).
- Dependencias de Internet: ninguna. Un servidor de la misma Wi-Fi funciona sin Internet.
- Historial: las 24 últimas imágenes generadas; las guardadas (♥) no se borran solas.

En el APK, el WebView bloquea las peticiones HTTP desde la página HTTPS de la app (contenido mixto), así que el modo con servidor propio solo funciona en el navegador del computador.
