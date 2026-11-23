# Seguridad

Revisión de la versión 1.3.0 con los controles de [OWASP MASVS](https://mas.owasp.org/MASVS/) que aplican a esta
arquitectura: una app web local (React) servida por un WebView nativo en Kotlin, sin servidor, sin cuentas y sin
analítica.

## Superficie

| Elemento | Situación |
| --- | --- |
| Red | La web se sirve desde el propio APK (`https://appassets.androidplatform.net`, `WebViewAssetLoader`). El código nativo no hace peticiones. |
| Datos | IndexedDB + localStorage del WebView (almacenamiento privado de la app) y un JSON para widgets en `filesDir`. |
| Puente JS ↔ nativo | `window.LixAndroid` (`LixBridge.kt`): 8 métodos, sin acceso a archivos arbitrarios ni a otras apps. |
| Componentes exportados | La actividad principal (lanzador), 4 receptores de widgets (los exige el sistema) y `BootReceiver` (solo emisiones protegidas del sistema). |
| Permisos | `INTERNET`, `POST_NOTIFICATIONS` (se pide al activar los consejos), `RECEIVE_BOOT_COMPLETED`; WorkManager añade `WAKE_LOCK`, `ACCESS_NETWORK_STATE`, `FOREGROUND_SERVICE`. Sin cámara, micrófono, ubicación, contactos ni almacenamiento. |

## Controles por categoría

**MASVS-STORAGE** — Los datos personales (organización, diario, progreso de juegos) viven en el almacenamiento
privado del WebView. `allowBackup="false"`: no van a copias en la nube ni salen por `adb backup`. No hay secretos,
tokens ni claves en el código ni en el APK (comprobado: búsqueda de `password|secret|token|api_key` en `src/` y
`android/`). El PIN de privacidad es un candado de interfaz, **no cifra** los datos (documentado en la app). Las
exportaciones las inicia la persona y van a `Descargas/Lix` (Android 10+) o a la carpeta de la app (Android 8–9).

**MASVS-NETWORK** — Sin tráfico nativo. `network_security_config.xml` prohíbe HTTP en claro también en Android 8
(antes de Android 9 se permitía por defecto). El WebView bloquea el contenido mixto (modo por defecto), así que la
CSP `connect-src http://localhost:*…` que usa Lix AI Studio en el navegador no abre nada en el APK. Los enlaces
externos (versiones online de los juegos) salen al navegador del sistema; nada externo se inserta en iframes
(`frame-src` vacío en la CSP).

**MASVS-PLATFORM (WebView)**

| Ajuste | Valor | Motivo |
| --- | --- | --- |
| `javaScriptEnabled` | `true` | La app es React; solo carga código del propio APK (CSP `script-src 'self' 'wasm-unsafe-eval'`, sin `eval`). |
| `allowFileAccess` | `false` | Nada se carga desde `file://`. |
| `allowFileAccessFromFileURLs` / `allowUniversalAccessFromFileURLs` | `false` (por defecto) | — |
| `allowContentAccess` | `true` | Lo usa el selector de archivos (importar copias, adjuntos). Riesgo residual bajo: solo afecta a contenido cargado por la propia página, que no admite scripts externos. |
| Navegación | Solo el origen de la app | Cualquier otra URL se abre fuera, y solo `https`, `http` y `mailto` (nunca `intent:`, `file:` ni `javascript:`). |
| Depuración remota | Solo en el APK debug | `setWebContentsDebuggingEnabled` se activa si la app es `debuggable`. |
| Versión del motor | Mínimo 111 | Con un WebView anterior se muestra una pantalla nativa que explica cómo actualizarlo, en vez de una app rota. |

Puente JS: todos los parámetros se validan (`pinWidget` solo acepta 4 nombres, `saveFile` limpia el nombre a
`[A-Za-z0-9._-]{1,80}` y escribe solo en Descargas, `publishSnapshot` exige JSON válido de hasta 1 MB). Los eventos
hacia la web se serializan con `JSONObject.quote` (sin inyección de JavaScript). La ruta que llega en un *intent* de
widget o notificación se valida con `^/[a-z0-9/_-]{0,80}$` antes de usarla. `PendingIntent` siempre `FLAG_IMMUTABLE`.

**MASVS-CODE** — Release con R8 (`isMinifyEnabled`, `isShrinkResources`) y sin `debuggable`. Sin registros de
depuración en el código nativo y, en la web, solo bajo `import.meta.env.DEV`. Dependencias auditadas (ver
[DEPENDENCIES.md](DEPENDENCIES.md)); el wrapper de Gradle verifica la suma SHA-256 de su distribución.

**MASVS-PRIVACY** — Sin analítica, publicidad, identificadores ni servidores. Los juegos online son enlaces a la
web de su proveedor y la app lo indica antes de abrirlos.

**No aplican:** MASVS-AUTH (no hay cuentas), MASVS-CRYPTO (no se cifra ni firma nada en la app) y
MASVS-RESILIENCE (app personal sin antimanipulación; se acepta).

## Cambios de esta revisión (1.3.0)

1. Tráfico en claro prohibido explícitamente (Android 8 lo permitía por defecto).
2. Suma SHA-256 de la distribución de Gradle en el wrapper (cadena de suministro).
3. Validación de la ruta del *intent* también al arrancar en frío (antes solo en `onNewIntent`).
4. Límite de tamaño para la instantánea de widgets.
5. Aviso nativo si el WebView es anterior al 111.
6. Dependencias de desarrollo actualizadas: `npm audit` pasa de 2 vulnerabilidades altas (Vite, undici) a 0.

## Riesgos pendientes (aceptados)

- `allowContentAccess` sigue activo (ver tabla).
- El puente está disponible para cualquier página que cargue el WebView; hoy solo puede cargar la propia app. Si en
  el futuro se insertara contenido de terceros, habría que pasar a `WebViewCompat.addWebMessageListener` con lista de
  orígenes.
- Sin cifrado en reposo propio: se confía en el aislamiento de Android (y en el cifrado del dispositivo).
- El dispositivo debe mantener el WebView actualizado (lo hace Google Play); en Android 8–9 Google dejó de
  actualizarlo en la versión 138.

## Informar de un problema

Proyecto privado: avisa directamente al mantenedor (no abras una incidencia pública con detalles explotables).
