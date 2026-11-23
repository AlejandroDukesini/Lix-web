# Problemas frecuentes

| Síntoma | Causa | Solución |
| --- | --- | --- |
| `npm audit` responde «NOT_IMPLEMENTED» | El registro configurado (p. ej. un espejo) no ofrece auditoría | `npm audit --registry=https://registry.npmjs.org` |
| `npm install` falla con `EBUSY … rolldown-binding…node` (Windows) | Un `npm start`/`vite preview` abierto bloquea el binario | Ciérralo y repite |
| `ENOSPC` durante `npm install` o Gradle | Disco lleno | Libera espacio y ejecuta `npm ci` (no reutilices un `node_modules` a medio escribir) |
| `No existe ../dist/index.html` al compilar el APK | No se hizo el build web | `npm run android:build` (hace los dos pasos) |
| `Falta la firma de publicación` | Sin `android/keystore.properties` ni variables `LIX_*` | `npm run android:keystore` o define las variables (ver [BUILD.md](BUILD.md)) |
| `INSTALL_FAILED_UPDATE_INCOMPATIBLE` | El APK está firmado con otra clave que el instalado | Usa la clave de siempre. Desinstalar borra los datos: antes exporta una copia desde Configuración |
| `INSTALL_FAILED_VERSION_DOWNGRADE` | `versionCode` menor que el instalado | Sube `version` en `package.json` |
| La app abre «Hay que actualizar el WebView» | Android System WebView anterior al 111 | Actualízalo desde Google Play y vuelve a abrir Lix |
| SDK no encontrado | Falta `android/local.properties` | `sdk.dir=C:/Users/<tú>/AppData/Local/Android/Sdk` o variable `ANDROID_HOME` |
| E2E: «no se encuentra el navegador» | `npm run test:e2e` usa Edge o Chrome instalados | Instala uno de los dos |
| La web no funciona sin conexión | Se abrió con `npm run dev` o `file://` | Usa `npm start` o la app instalada |
| Juego online «Sin conexión» | La versión original necesita Internet | Juega la versión de la app (offline) |
