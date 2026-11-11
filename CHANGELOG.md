# Historial de versiones

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
en emulador Android (API 34). Detalle completo en `DOCUMENTACION_NUEVAS_FUNCIONES_LIX.txt` y
`docs/MULTIPLATAFORMA.md`.

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
