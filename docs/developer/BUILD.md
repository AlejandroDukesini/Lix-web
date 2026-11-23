# Construcción

## Requisitos

| Herramienta | Versión | Para qué |
| --- | --- | --- |
| Node.js + npm | 20 o posterior (probado con 24) | App web, pruebas, build |
| JDK | 17 o posterior (probado con 21 y 25) | Gradle / Android |
| Android SDK | platform 36 y build-tools 35+ | APK (`sdk.dir` en `android/local.properties` o `ANDROID_HOME`) |
| Gradle | no se instala: va el *wrapper* 8.14.3 (con suma SHA-256 verificada) | APK |
| Edge o Chrome | cualquiera reciente | Prueba E2E (`npm run test:e2e`) |

Internet solo hace falta para `npm install` y la primera compilación de Gradle (descarga dependencias).

## App web

```bash
npm ci               # dependencias exactas del package-lock.json
npm run dev          # desarrollo → http://localhost:5173 (sin Service Worker)
npm run build        # producción en dist/ (CSP y precarga del Service Worker inyectadas)
npm run preview      # sirve dist/ → http://localhost:4173
npm start            # build + preview y abre el navegador
npm run check        # pruebas + build + E2E en navegador real
```

`npm run dev` no registra el Service Worker; para probar el modo sin conexión usa `build` + `preview`.
Abrir `dist/index.html` con doble clic (`file://`) no funciona: el Service Worker exige `localhost` o HTTPS.

## APK de Android

`android/` es un *shell* nativo en Kotlin (un WebView, ver [ARCHITECTURE.md](ARCHITECTURE.md) y
[MULTIPLATAFORMA.md](MULTIPLATAFORMA.md)). La tarea Gradle `syncWebAssets` copia `dist/` dentro del APK, así que
**siempre se compila primero la web**; los scripts lo hacen solos:

```bash
npm run android:build      # build web + APK de pruebas (debug)
npm run android:keystore   # solo la primera vez: crea la clave de publicación (fuera del repositorio)
npm run android:release    # build web + APK de publicación (release, firmado, R8)
```

| Tipo | Archivo | Paquete | Depurable | Firma |
| --- | --- | --- | --- | --- |
| Debug | `android/app/build/outputs/apk/debug/app-debug.apk` | `app.lix.web.debug` | Sí (`chrome://inspect`) | Clave de depuración del SDK |
| Release | `android/app/build/outputs/apk/release/app-release.apk` | `app.lix.web` | No | Tu clave (R8 + recursos reducidos) |

El debug lleva sufijo `.debug`: convive con el de publicación en el mismo teléfono, con datos separados.
**Nunca se publica un APK debug como versión.**

### Firma

`npm run android:keystore` crea `~/.lix-android/lix-release.jks` (RSA 4096, contraseña aleatoria) y
`android/keystore.properties`. Ninguno va a Git (`android/.gitignore`). En CI se usan las variables
`LIX_KEYSTORE`, `LIX_KEYSTORE_PASSWORD`, `LIX_KEY_ALIAS` y `LIX_KEY_PASSWORD`. Sin firma, `assembleRelease` se
detiene con un mensaje en lugar de producir un APK sin firmar. **Guarda una copia de la clave**: sin ella no se
puede publicar una actualización que se instale encima (habría que desinstalar y se perderían los datos).

### Versión

Una sola fuente: `version` de `package.json`. Gradle calcula `versionName` (= la versión) y
`versionCode` = mayor·10000 + menor·100 + parche (1.3.0 → 10300). Cada versión debe tener un `versionCode` mayor
que la anterior para instalarse encima conservando los datos.

### Reproducibilidad

- `npm ci` instala exactamente el `package-lock.json`.
- Gradle usa versiones fijas (sin `+`) en `android/build.gradle.kts` y `android/app/build.gradle.kts`, y el wrapper
  comprueba la suma SHA-256 de su distribución.
- El build web no incluye marcas de tiempo en el código; el Service Worker se versiona con un hash del contenido.
- Lo que **no** es bit a bit idéntico entre máquinas: la firma (depende de la clave) y los metadatos del ZIP del APK.
  Por eso cada release publica su SHA-256.

### Instalar en un teléfono o emulador

```bash
adb install -r android/app/build/outputs/apk/release/app-release.apk   # -r: actualiza conservando los datos
```

Sin cable: copia el APK al teléfono, ábrelo y permite «Instalar apps desconocidas» solo para la app con la que lo abres.
