# Componentes de terceros

El código y los contenidos propios de Lix no se publican bajo licencia de código abierto. La app incluye estos
componentes de terceros, cada uno bajo su propia licencia (los textos completos van dentro de cada paquete en
`node_modules/` o en la URL indicada).

## Incluidos en la app web y en el APK

| Componente | Versión | Licencia |
| --- | --- | --- |
| React, React DOM, scheduler | 19.3.1 / 0.28.0 | MIT — Meta Platforms, Inc. |
| React Router (+ cookie, set-cookie-parser) | 7.18.6 | MIT |
| Lucide (lucide-react) | 1.77.0 | ISC — Lucide Contributors |
| Pyodide (incluye CPython) | 314.0.7 | MPL-2.0 (Pyodide); PSF License (CPython) |
| Pillow (rueda para Pyodide, `vendor/pyodide/`) | 12.2.0 | MIT-CMU (HPND) |
| Fuentes Fraunces, Manrope, Bricolage Grotesque, Dancing Script | — | SIL Open Font License 1.1 (ver `src/assets/fonts/LICENSE.md`) |

`ws` aparece en el árbol de dependencias de Pyodide para Node.js, pero no entra en el build web.

## Incluidos solo en el APK

| Componente | Licencia |
| --- | --- |
| AndroidX Core, Activity, WebKit, Glance (App Widget, Material 3) y sus dependencias (Compose runtime, WorkManager…) | Apache License 2.0 — The Android Open Source Project |
| Kotlin standard library | Apache License 2.0 — JetBrains s.r.o. |

## Solo para desarrollo (no se distribuyen)

Vite, Vitest, Testing Library, jsdom, fake-indexeddb, Playwright-core, sharp y el plugin de React para Vite (MIT /
Apache-2.0); Gradle, Android Gradle Plugin y Kotlin Gradle Plugin (Apache-2.0).

## Marcas

Los nombres de juegos y portales que aparecen en los enlaces externos (CrazyGames, Poki, Tetris®, Papa's…, Longcat,
etc.) pertenecen a sus dueños. La app solo enlaza a sus páginas oficiales; no incluye ni modifica su contenido, y
los juegos de la app son implementaciones propias inspiradas en sus mecánicas.
