# Publicar una versión

## Versionado

[SemVer](https://semver.org/lang/es/): **mayor** (cambios que rompen datos o instalación), **menor** (funciones
nuevas), **parche** (correcciones). La versión vive solo en `package.json`; de ahí salen la versión de la web
(`__APP_VERSION__`), el `versionName` y el `versionCode` del APK. Etiquetas Git: `vX.Y.Z`.

Ramas: el trabajo se integra en `beta`; `Principal` recibe la documentación y el cambio de versión, se etiqueta, y
`beta` se mantiene al día con `Principal`.

## Lista de comprobación

1. `beta` actualizada y fusionada en `Principal`.
2. Sube `version` en `package.json` y añade la entrada en `CHANGELOG.md`.
3. `npm ci && npm run check` en verde (pruebas, build, E2E).
4. `npm run android:release` con la clave de siempre.
5. Verifica el APK:
   ```bash
   "$ANDROID_HOME/build-tools/36.0.0/apksigner" verify --print-certs android/app/build/outputs/apk/release/app-release.apk
   "$ANDROID_HOME/build-tools/36.0.0/aapt2" dump badging android/app/build/outputs/apk/release/app-release.apk | head -3
   ```
   El certificado debe ser el de siempre (misma huella SHA-256 que la release anterior), `versionCode` mayor que el
   anterior y la app no debe ser `debuggable`.
6. Instala encima de la versión anterior (`adb install -r`) en un emulador o teléfono y comprueba que el progreso
   sigue ahí.
7. Copia el APK como `Lix.apk` (el README enlaza a `releases/latest/download/Lix.apk`) y calcula su suma:
   ```bash
   cp android/app/build/outputs/apk/release/app-release.apk Lix.apk
   sha256sum Lix.apk > Lix.apk.sha256
   ```
8. Etiqueta y publica:
   ```bash
   git tag -a vX.Y.Z -m "Lix X.Y.Z" && git push origin Principal vX.Y.Z
   gh release create vX.Y.Z Lix.apk Lix.apk.sha256 --title "Lix X.Y.Z" --notes-file notas.md
   ```

## Notas de la release (plantilla)

```markdown
## Lix X.Y.Z — AAAA-MM-DD

### Novedades
- …
### Correcciones
- …
### Compatibilidad
Android 8.0 (API 26) o superior con Android System WebView 111+. Probado en: … (ver docs/developer/COMPATIBILITY.md)
### Instalación
Descarga `Lix.apk`, ábrelo y permite «Instalar apps desconocidas» para esa app. Para actualizar, instálalo encima:
los datos se conservan.
### Verificación
SHA-256 de `Lix.apk`: `…`
```

## Automatización (GitHub Actions)

- `.github/workflows/ci.yml` — en cada *push* y *pull request*: `npm ci`, pruebas, build web y APK debug (artefacto
  descargable). No publica nada.
- `.github/workflows/release.yml` — al subir una etiqueta `v*`: repite las pruebas y, **solo si pasan**, compila el
  APK firmado, calcula su SHA-256 y crea la release como **borrador**: alguien la revisa (paso 6) antes de publicarla.
  Necesita estos *secrets* del repositorio: `LIX_KEYSTORE_BASE64` (el `.jks` en base64), `LIX_KEYSTORE_PASSWORD`,
  `LIX_KEY_ALIAS`, `LIX_KEY_PASSWORD`. Sin ellos solo valida (pruebas y build) y deja un aviso: no produce APK sin
  firmar ni crea la release, que entonces se publica a mano con los pasos 4–8. Si la release ya existe, no la toca.
  Hoy el repositorio **no** tiene esos secrets: las releases se publican a mano.

La prueba E2E (`npm run test:e2e`) usa el Edge/Chrome instalado y se ejecuta en local antes de etiquetar.
