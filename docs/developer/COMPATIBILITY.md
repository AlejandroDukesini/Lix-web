# Compatibilidad y rendimiento

Revisión del 23 de noviembre de 2026 (versión 1.3.0). Esta matriz separa lo **probado** de lo que solo se
**espera** que funcione por los requisitos técnicos: lo segundo no es una garantía.

## Requisitos

| | Valor | Por qué |
| --- | --- | --- |
| `minSdk` | **26** (Android 8.0) | `java.time` en el código nativo (consejos, widgets) y las APIs de notificación por canal. Bajarlo exigiría *desugaring* y probar en Android 7. |
| `targetSdk` / `compileSdk` | **36** (Android 16) | Requisito actual para publicar y comportamiento moderno (vista de borde a borde, permisos de notificación). |
| Android System WebView / Chrome | **111+** | La web usa `color-mix()` en 39 hojas de estilo (Chromium 111), además de `:has()`, consultas `@container`, unidades `dvh` y `structuredClone` (Chromium 98–108). Si el WebView es anterior, `MainActivity` muestra una pantalla nativa que explica cómo actualizarlo en vez de una app rota. |
| Arquitecturas | Todas | El APK no lleva código nativo propio (solo Kotlin + web). |

## Matriz

| Entorno | Estado | Evidencia |
| --- | --- | --- |
| Emulador Pixel, Android 14 (API 34), x86_64, WebView 113, GPU por software | **Probado** | Ver «Pruebas realizadas». |
| Chromium de escritorio (Edge) — web/PWA | **Probado** | `npm run test:e2e`: 107/107 comprobaciones (móvil, tableta, escritorio, sin conexión, CSP). |
| Android 8.0–13 (API 26–33) | **No evaluado** | No se pudo crear el emulador: la descarga de las imágenes de API 26 y 29 agotó el disco de la máquina de desarrollo. Se espera compatible por `minSdk` 26 y por la comprobación del WebView, pero **no está probado**. Lo específico de esas versiones: en 8–9 las exportaciones van a la carpeta de la app (lo avisa un mensaje propio); en 8–12 no hay permiso de notificaciones en tiempo de ejecución. |
| Android 15–16 (API 35–36) | **No evaluado** | Sin emulador. Es el `targetSdk`, así que el comportamiento de borde a borde está previsto en el código, pero no verificado. |
| Teléfonos físicos (cualquier versión) | **No evaluado** | Ninguna prueba en hardware real en esta revisión. |
| Gama baja real (≤ 2 GB de RAM) | **No evaluado** | Solo hay medidas en el emulador (abajo). |
| iPhone / Safari (PWA) | **No evaluado** | Sin dispositivo; las versiones mínimas del README son estimadas. |

### Pruebas realizadas (emulador API 34)

APK release 1.3.0 firmado con la clave de siempre (huella SHA-256 del certificado igual que la 1.2.1),
`versionCode` 10300, no `debuggable`.

1. **Actualización sin pérdida de datos:** instalación limpia de la 1.2.1 publicada → se salta la presentación y se
   cambia el tema a claro → `adb install -r` de la 1.3.0 encima → la app abre directamente en Inicio con el tema
   claro: los datos se conservan (`firstInstallTime` sin cambios).
2. **Navegación:** Inicio → Game Center (24 juegos) → ficha de Botica de colores.
3. **Rutas por intent** (las que usan widgets y notificaciones): `-e route /juegos/botica` abre el juego; rutas
   inválidas (`javascript:…`, `/juegos/../../x?a=1`) se ignoran sin cerrar la app.
4. **Rotación** a horizontal y vuelta: la pantalla se conserva.
5. **Segundo plano → primer plano:** vuelve a la misma pantalla.
6. Sin cierres (`FATAL`/`AndroidRuntime`) en `logcat`.

Las partidas en sí (los 24 juegos) se prueban en navegador real con `npm run test:e2e` y con las pruebas unitarias;
en el emulador solo se abrió la ficha de un juego.

## Rendimiento

Medidas en el emulador anterior (x86_64, renderizado por software, que es **más lento** que un teléfono con GPU):

| Medida | Valor |
| --- | --- |
| Arranque en frío (`am start -W`, `TotalTime`) | 1,4–1,8 s (3,3 s en la primera apertura tras instalar) |
| Memoria del proceso de la app (PSS) | ≈ 72 MB |
| Proceso del WebView (RSS) | ≈ 207 MB |
| Tamaño del APK release | 16,6 MB (la web ocupa 19 MB sin comprimir, sobre todo Pyodide) |
| JS inicial (gzip) | ≈ 99 kB; el Game Center (≈ 88 kB) y cada juego se cargan al abrirlos |

Lo que ya hace la app para equipos modestos:

- Carga diferida por ruta y por juego (cada juego es su propio *chunk*).
- Calidad gráfica adaptable en los juegos de lienzo (`render/quality.js`): arranca en «baja» con ≤ 4 núcleos,
  ≤ 2 GB de memoria o ahorro de datos, y baja sola si los fotogramas superan 1/40 s de media. Solo afecta a lo
  decorativo, nunca a la lógica.
- Densidad de píxeles del lienzo limitada (1,5× en calidad baja, 2× en alta).
- `prefers-reduced-motion` respetado en las animaciones de la presentación, Flowers y los juegos nuevos.
- Pausa automática de partidas, bucles y sonido al minimizar la app o bloquear la pantalla.
- R8 con reducción de recursos en el APK release.

Pendiente de medir en un teléfono de gama baja real: fluidez de los juegos de lienzo (Aquapark, carreras) y el
consumo de memoria de Pyodide en Lix Flowers, que es la función más pesada.

## Cómo repetir las pruebas

```bash
npm run android:release
adb install -r android/app/build/outputs/apk/release/app-release.apk   # encima de la versión anterior
adb shell am start -W -n app.lix.web/.MainActivity
adb shell am start -n app.lix.web/.MainActivity -e route /juegos/botica
adb shell dumpsys meminfo app.lix.web | grep "TOTAL PSS"
```

Para versiones antiguas: crea un AVD con la imagen `system-images;android-26;google_apis;x86_64` (≈ 1,5 GB libres
para la imagen y otros 2–4 GB para el disco del emulador) y repite la lista de arriba.
