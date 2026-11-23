# Dependencias

Auditoría del 22 de noviembre de 2026 (versión 1.3.0). Política: **pocas dependencias**, versiones fijadas en el
lockfile, actualizaciones de parche y menores tras pasar `npm run check`, y las mayores solo con una pasada propia
que revise sus cambios incompatibles.

## npm

**Producción** (van en la web y en el APK): `react`, `react-dom`, `react-router`, `lucide-react`, `pyodide`
(fijada exacta: la rueda de Pillow de `vendor/pyodide/` está compilada para esa versión). Árbol de producción: 9
paquetes, todos MIT, ISC o MPL-2.0 (ver [THIRD_PARTY_NOTICES.md](../../THIRD_PARTY_NOTICES.md)).

**Desarrollo** (no se distribuyen): Vite, Vitest, Testing Library, jsdom, fake-indexeddb, playwright-core, sharp y
`@vitejs/plugin-react`.

| Comprobación | Resultado |
| --- | --- |
| `npm audit` (registro oficial) antes | **2 altas**: `vite` 8.3.2 (servidor de desarrollo: `launch-editor`, `server.fs`) y `undici` 8.11 (vía jsdom). Ninguna en el árbol de producción. |
| Actualizado (parches/menores, dentro de los rangos de `package.json`) | vite 8.3.8, vitest 5.1.1, react/react-dom 19.3.1, react-router 7.18.6, lucide-react 1.77.0, @vitejs/plugin-react 6.3.0, jsdom 30.1.3 (undici 8.13.1), fake-indexeddb 6.2.8, user-event 14.6.13, playwright-core 1.65.1 |
| `npm audit` después | **0 vulnerabilidades** |
| No actualizadas (mayores) | `react-router` 8, `jsdom` 31, `@testing-library/jest-dom` 8: cambios incompatibles sin beneficio de seguridad hoy; quedan para una pasada propia. `pyodide` 314.0.8: requiere recompilar/verificar la rueda de Pillow. |
| Duplicadas / sin uso | Ninguna dependencia directa sin uso; `npm ls` sin paquetes inválidos ni sobrantes. |
| Cadena de suministro | `package-lock.json` versionado; CI instala con `npm ci` desde el registro oficial y falla si `npm audit --omit=dev` encuentra algo. |

> El registro configurado en esta máquina (`registry.npmmirror.com`) no implementa la auditoría: usa
> `npm audit --registry=https://registry.npmjs.org`.

## Android (Gradle)

| Dependencia | Antes | Ahora | Última estable | Notas |
| --- | --- | --- | --- | --- |
| Android Gradle Plugin | 8.13.2 | 8.13.2 | 9.5.2 | La 9.x es mayor (nuevo DSL); no se migra en esta pasada. |
| Kotlin (+ plugin Compose) | 2.4.21 | 2.4.21 | 2.4.21 | Al día. |
| Gradle (wrapper) | 8.14.3 | 8.14.3 + suma SHA-256 | — | Compatible con AGP 8.13. |
| androidx.core:core-ktx | 1.17.0 | 1.18.0 | 1.19.1 | La 1.19 exige AGP 9.1 y `compileSdk` 37: se queda en 1.18 hasta migrar a AGP 9. |
| androidx.activity:activity-ktx | 1.11.0 | 1.13.0 | 1.13.0 | Menor. |
| androidx.webkit:webkit | 1.14.0 | 1.18.0 | 1.18.0 | Menor; `WebViewAssetLoader` y `WebViewCompat` sin cambios de API. |
| androidx.glance:glance-appwidget / material3 | 1.2.0 | 1.2.0 | 1.2.0 | Al día. |

Todas las versiones son fijas (sin `+`). Repositorios: solo `google()` y `mavenCentral()` (más el portal de plugins
para resolver plugins), con `FAIL_ON_PROJECT_REPOS`. Tras actualizar se compilaron los APK debug y release y se
repitieron las pruebas de instalación y actualización en el emulador API 34 (ver [COMPATIBILITY.md](COMPATIBILITY.md)).

Aviso de compilación conocido: R8 (AGP 8.13) advierte que no reconoce del todo los metadatos de Kotlin 2.4. El APK
se genera y funciona (probado), pero conviene migrar a AGP 9 en la próxima pasada de dependencias mayores.

## SDK

`compileSdk` y `targetSdk` 36 (Android 16), `minSdk` 26 (Android 8.0). Por qué y qué implicaría cambiarlos:
[COMPATIBILITY.md](COMPATIBILITY.md).
