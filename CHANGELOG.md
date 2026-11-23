# Historial de versiones

## 1.3.0 — 23 de noviembre de 2026

**Game Center ampliado y app Android revisada (compatibilidad, seguridad, dependencias y publicación).**

- **Juegos nuevos:** Botica de colores (ordenar líquidos, 24 niveles con solución comprobada), Salida de la cochera
  (sacar el microbús del atasco, 30 niveles con mínimo exacto), Hamburguesería por estaciones (pedidos, parrilla en
  tiempo real, montaje y entrega puntuada; días, monedas, ingredientes y mejoras) y Gato largo (30 habitaciones), que
  **sustituye a «Cubrir el espacio»** (sus estadísticas antiguas quedan guardadas pero ya no se muestran).
- **Lava y Agua:** modo **Dúo** cooperativo (Brasa y Gota): gravedad, saltos, placas y compuertas; 7 niveles que
  exigen cooperar.
- **Cocina:** Heladería, Pizzería y Pastelería con pasos numerados que avanzan solos, botón «Siguiente» y comanda
  compacta en el móvil.
- **Catálogo:** enlaces a versiones originales de Longcat, Tunnel Runner, Tetris, Lava and Aqua, Water Sort, Bus
  Escape y los juegos de Papa's; sello «Online», filtro «También online» y etiquetas Nuevo / Actualizado.
- **Android:** aviso nativo si el WebView es anterior al 111, tráfico HTTP prohibido también en Android 8, rutas de
  widgets validadas al arrancar, instantánea de widgets limitada a 1 MB, mensaje correcto al exportar en Android 8–9,
  dependencias AndroidX actualizadas (core 1.18.0, activity 1.13.0, webkit 1.18.0) y suma SHA-256 del wrapper de Gradle.
- **Dependencias web:** parches y menores (Vite 8.3.8, React 19.3.1, React Router 7.18.6…); `npm audit` pasa de 2
  vulnerabilidades altas (solo de desarrollo) a 0.
- **Documentación:** README nuevo y conciso; documentación técnica en `docs/developer/` (arquitectura, construcción,
  publicación, seguridad con OWASP MASVS, dependencias, compatibilidad, pruebas, problemas frecuentes);
  `THIRD_PARTY_NOTICES.md`; se retira `DOCUMENTACION_NUEVAS_FUNCIONES_LIX.txt` (su contenido útil pasó a `docs/`).
- **CI:** GitHub Actions para pruebas, build y APK debug en cada cambio, y release en borrador (solo si pasan las
  pruebas) al etiquetar.

Validado con `npm run check` (839 pruebas, build y 107 comprobaciones E2E) y en emulador Android 14 (API 34):
actualización encima de la 1.2.1 conservando los datos, navegación, rutas de widgets, rotación y segundo plano.
Android 8–13 y 15–16 y teléfonos físicos: **no evaluados** (ver `docs/developer/COMPATIBILITY.md`).

## 1.2.1 — 17 de noviembre de 2026

**Rediseño UI/UX de juegos (escenarios diurnos) y APK de Android descargable.**

- **Juegos:** Lava y Agua («isla volcánica a mediodía»), Cubrir el espacio («taller de azulejos»), Despejar
  (aparcamiento de barrio), Aparcar el carro (acera y árboles de calle) y Heladería, Pizzería y Pastelería (mostrador,
  toldo y suelo propios). Mecánicas, controles, puntuación y niveles sin cambios.
- **Android:** pantalla completa durante las partidas, botón Atrás con confirmación si hay partida en curso, diseño de
  borde a borde, pausa automática al minimizar, enlaces externos restringidos, APK de publicación reducido con R8 y
  firmado con clave propia (`npm run android:keystore`).
- **Descarga:** el APK se publica en GitHub Releases como `Lix.apk`; instrucciones en el README («Descargar la app»).

Validado con `npm run check` (822 pruebas, build y 104 comprobaciones E2E) y el APK release en emulador (API 34).

## 1.2.0 — 11 de noviembre de 2026

**Taller creativo, Control académico, Consejos diarios y app Android con widgets.**

- **Lix Flowers:** animaciones de flores en arte ASCII generadas con Python (Pyodide + Pillow) en el
  propio dispositivo, sin conexión: 10 plantillas, 5 efectos para fotos, personalización, GIF y herbario.
- **Lix AI Studio:** pintor procedural (etiquetado como «no es IA») e IA real con un servidor propio
  (Stable Diffusion WebUI o compatible con OpenAI) en el computador o la red local. Sin nube ni claves.
- **Control académico:** asignaturas, 8 categorías de actividades, horario semanal con choques, calendario
  con festivos registrados a mano y cuadernos por asignatura.
- **Consejos diarios:** 120 consejos en 10 categorías, propios, franjas configurables, historial,
  favoritos y notificaciones.
- **Android:** app nativa en Kotlin (`android/`) con 4 widgets Jetpack Glance y consejos con la app cerrada.
- **Windows 11:** widget PWA para el Tablero de Widgets (no verificado en el Tablero real).
- **iPhone:** análisis de viabilidad (requiere app nativa; sin implementar).

Validado con `npm run check` (822 pruebas, build y 104 comprobaciones E2E), `npm run test:python` y pruebas
en emulador Android (API 34). Detalle técnico (consolidado en 1.3.0): `docs/developer/ARCHITECTURE.md` y
`docs/developer/MULTIPLATAFORMA.md`.

## 1.1.0 — 19 de octubre de 2026

**Game Center: rediseño visual de los 21 juegos y rendimiento en móviles.**

- Arte, iluminación, sombras y animaciones nuevos en todos los juegos. Las reglas, los controles, las colisiones, la
  puntuación y el guardado no cambian.
- Nuevas utilidades de dibujo compartidas en `src/features/game-center/render/`: caché de sprites, reserva fija de
  partículas, generador con semilla y monitor de calidad.
- La densidad de píxeles de los lienzos tiene un límite (1,5 en gama baja, 2 en el resto). Los degradados y los sprites
  se pintan una vez y se reutilizan, y se liberan al salir del juego.
- Las animaciones de los tableros (Ajedrez, Sudokus, Lava y Agua, Cubrir el espacio…) se disparan solo con cambios
  reales del estado y respetan el movimiento reducido.
- Sin dependencias nuevas. Validado con `npm run check` (748 pruebas, build y 94 comprobaciones E2E offline) y con
  capturas en un móvil emulado. Aún no se ha probado en teléfonos físicos.

Detalles en el README, sección «Rediseño visual (v1.1.0)».

## 1.0.0

Primera versión completa: presentación, inicio, configuración, PWA sin conexión, Game Center (fases 1 a 4,
21 juegos), Biblioteca (60 capítulos) y Organización personal.
