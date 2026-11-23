# Lix · Un año más contigo

Un regalo digital convertido en app: **privada**, **instalable** y **100 % local**. Juegos, lectura, organización
personal y un taller creativo, sin cuentas, sin servidores y sin Internet después de instalarla. Funciona como app
web instalable (PWA) y como **app Android** (APK).

**[⬇ Descargar para Android (Lix.apk)](https://github.com/AlejandroDukesini/Lix-web/releases/latest/download/Lix.apk)**
· [Todas las versiones](https://github.com/AlejandroDukesini/Lix-web/releases) · [Historial de cambios](CHANGELOG.md)

---

## Funciones

| Espacio | Qué ofrece |
| --- | --- |
| **Presentación** | «Bitácora de observación»: un viaje astral por capítulos que se recorre desplazándose. |
| **Inicio** | Saludo con apodos, tiempo juntos y cuenta atrás de Año Nuevo. |
| **Game Center** | 24 juegos originales sin conexión: arcade, lógica, estrategia, carreras, plataformas y cocina. Algunos enlazan también a su versión original online. |
| **Biblioteca** | 60 capítulos en 4 estantes, con lector, favoritos, marcadores, glosario y lectura en voz alta. |
| **Organización personal** | Panel del día, finanzas, calendario, tareas, notas, diario y diario emocional, con PIN opcional. |
| **Control académico** | Asignaturas, actividades, horario con choques, calendario y cuadernos. |
| **Consejos diarios** | 120 consejos en franjas, con notificaciones (en Android, también con la app cerrada). |
| **Taller creativo** | Lix Flowers (animaciones de flores con Python en el dispositivo) y Lix AI Studio. |
| **Android** | 4 widgets de pantalla de inicio, pantalla completa en las partidas y pausa automática al minimizar. |
| **Personalización** | Dos estilos (Glass y Maximal) × tema claro/oscuro, colores, textos y fechas. |

Detalle de cada espacio: [docs/FUNCIONES.md](docs/FUNCIONES.md) · Juegos: [docs/developer/GAME-CENTER.md](docs/developer/GAME-CENTER.md).

**Novedades 1.3.0:** Botica de colores (ordenar líquidos), Salida de la cochera (sacar el autobús del atasco),
Hamburguesería por estaciones (pedidos, parrilla, montaje y entrega), Gato largo (sustituye a «Cubrir el
espacio»), modo **Dúo** cooperativo en Lava y Agua, cocina más fluida y enlaces a versiones originales
(Longcat, Tunnel Runner, Tetris, Lava and Aqua…).

## Tecnologías

React 19 · Vite 8 · React Router 7 · CSS propio · IndexedDB/localStorage · Service Worker propio · Pyodide (Python
en WebAssembly) · Android nativo en Kotlin (WebView + Jetpack Glance) · Vitest, Testing Library y Playwright.

Sin backend, analítica, CDN ni peticiones externas: una Content-Security-Policy (`default-src 'self'`) lo garantiza.

## Instalación en Android

1. Descarga **[Lix.apk](https://github.com/AlejandroDukesini/Lix-web/releases/latest/download/Lix.apk)** desde el
   teléfono (o pásalo por cable, Drive o correo).
2. Ábrelo y permite «Instalar apps desconocidas» **solo** para la app con la que lo abres.
3. Toca **Instalar** y abre **Lix**. Si Play Protect avisa de una app desconocida (no se distribuye por Google Play),
   elige *Instalar de todas formas*.

**Actualizar:** instala el APK nuevo encima. Los datos se conservan (misma firma, `versionCode` mayor). Desinstalar
sí borra los datos: antes, exporta una copia desde *Configuración → Datos*.

Cada release publica el **SHA-256** del APK para comprobarlo: `certutil -hashfile Lix.apk SHA256` (Windows) o
`sha256sum Lix.apk`.

## Compatibilidad

| | Mínimo | Objetivo |
| --- | --- | --- |
| Android | **8.0 (API 26)** | API 36 (Android 16) |
| Android System WebView / Chrome | **111** (si es anterior, la app explica cómo actualizarlo) | — |
| Navegador (PWA) | Chrome/Edge 111+, Safari 16.4+, Firefox 121+ (estimado por las funciones CSS/JS usadas) | — |

Qué se ha probado y qué no: [docs/developer/COMPATIBILITY.md](docs/developer/COMPATIBILITY.md).

## Ejecutar y compilar

Requisitos: Node.js 20+; para el APK, además JDK 17+ y Android SDK (platform 36).

```bash
npm ci                  # dependencias exactas
npm start               # build + vista previa en http://localhost:4173 (instalable como PWA)
npm run check           # pruebas unitarias, build y E2E en navegador real
npm run android:build   # APK de pruebas (debug)
npm run android:release # APK de publicación (firmado; la primera vez: npm run android:keystore)
```

Guía completa: [docs/developer/BUILD.md](docs/developer/BUILD.md) · Publicar una versión:
[docs/developer/RELEASE.md](docs/developer/RELEASE.md).

## Seguridad y privacidad

Todo se guarda en el almacenamiento privado del dispositivo; no hay copias en la nube (`allowBackup="false"`), ni
cuentas, ni claves en el código. Permisos: Internet (solo para abrir las versiones online opcionales de algunos
juegos), notificaciones (solo si activas los consejos) y reprogramar consejos tras reiniciar. Revisión con OWASP
MASVS: [docs/developer/SECURITY.md](docs/developer/SECURITY.md).

## Limitaciones conocidas

- No hay sincronización entre dispositivos: los datos viven en una sola app/navegador (usa la copia JSON para moverlos).
- El APK no está en Google Play; se instala desde GitHub Releases.
- Probado en emulador Android 14 (API 34); **no** en teléfonos físicos ni en Android 8–13 (ver matriz).
- En Android 8–9, las exportaciones se guardan en la carpeta de la app, no en Descargas.
- Lix AI Studio con un servidor propio de IA solo funciona en el navegador del computador, no en el APK (el WebView
  bloquea las conexiones HTTP desde una página HTTPS).
- iPhone: solo como PWA desde Safari, sin widgets; no probado en un iPhone físico.
- Los recordatorios de la organización no llegan con la app cerrada (los consejos diarios sí, en Android).
- Las versiones online de los juegos se abren en el navegador y no suman a las estadísticas.

## Documentación para desarrolladores

[Arquitectura](docs/developer/ARCHITECTURE.md) · [Construcción](docs/developer/BUILD.md) ·
[Publicación](docs/developer/RELEASE.md) · [Seguridad](docs/developer/SECURITY.md) ·
[Dependencias](docs/developer/DEPENDENCIES.md) · [Compatibilidad](docs/developer/COMPATIBILITY.md) ·
[Pruebas](docs/developer/TESTING.md) · [Game Center](docs/developer/GAME-CENTER.md) ·
[Android, iPhone y Windows](docs/developer/MULTIPLATAFORMA.md) · [Problemas frecuentes](docs/developer/TROUBLESHOOTING.md)

## Licencia

Proyecto privado: el código y los contenidos propios no se publican bajo ninguna licencia de código abierto (todos
los derechos reservados). Componentes de terceros incluidos y sus licencias: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
