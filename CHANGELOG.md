# Historial de versiones

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
