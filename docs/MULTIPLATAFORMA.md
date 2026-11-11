# Lix en Android, iPhone y Windows

Este documento explica qué se comparte entre plataformas, qué necesita código nativo y en qué
estado está cada una. Resumen:

| Plataforma | App | Widgets | Estado |
| --- | --- | --- | --- |
| Web / PWA (Chrome, Edge, Safari, Firefox) | La app React (`src/`) | — | Implementada y probada |
| Android | Shell nativo en Kotlin (`android/`) con WebView + puente | 4 widgets Jetpack Glance | Implementada y probada en emulador (API 34) |
| iPhone / iPad | PWA desde Safari | Requiere app nativa + WidgetKit | Análisis de viabilidad (sin implementar) |
| Windows 11 | PWA instalada desde Edge | Widget PWA en el Tablero de Widgets (Adaptive Cards) | Implementado según la documentación; no probado en el Tablero real |

## 1. Arquitectura compartida

```
                 ┌──────────────────────────────────────────────┐
                 │  App web (React) — la única lógica de negocio │
                 │  IndexedDB: materias, actividades, consejos…  │
                 └───────────────┬──────────────────────────────┘
                                 │ buildSnapshot()  (src/services/native/snapshot.js)
                                 ▼
                     Instantánea JSON, versión 1
     ┌───────────────────────────┼───────────────────────────────┐
     ▼                           ▼                               ▼
 Android: puente JS →        Windows: IndexedDB             iOS (futuro): puente JS →
 archivo en filesDir →       meta/widgetSnapshot →          App Group (UserDefaults/archivo)
 widgets Glance + alarmas    Service Worker → Adaptive Card  → WidgetKit (TimelineProvider)
```

- **Una sola fuente de verdad.** Los datos viven en la app. Los widgets no tienen copias
  editables: reciben una *proyección* (la instantánea) que la app recalcula y vuelve a publicar
  cada vez que cambian los datos, al volver a la app y cada 10 minutos.
- **Qué incluye la instantánea:** los consejos de la franja actual y de los próximos 7 días
  (elegidos con la misma función `pickTip` que la web), las clases de los próximos 14 días (sin
  festivos ni días omitidos), las actividades pendientes de los próximos 60 días, las vencidas,
  las fechas académicas del mes y el último fotograma de Lix Flowers. Las fechas van en ISO con
  zona horaria; cada widget calcula «ahora» con su propio reloj, así que avanza solo aunque la app
  no se abra durante horas.
- **Qué es nativo en cada plataforma:** la superficie del widget, la programación de
  notificaciones con la app cerrada y el acceso a archivos/descargas. Lo demás (interfaz, reglas,
  validación, Python de Lix Flowers) es el mismo código web.
- **Límite común:** si la app no se abre en más de 7 días, se agota la lista de consejos
  precalculados (el widget sigue mostrando el último) y las clases/actividades pueden quedarse
  desactualizadas si cambiaron en otro dispositivo. No hay sincronización entre dispositivos: cada
  uno tiene sus datos.

## 2. iPhone / iPad: análisis de viabilidad

**Conclusión: los widgets de iPhone son viables, pero requieren una app nativa de iOS. No se
pueden hacer con la PWA ni compilar desde el proyecto Android.**

### Qué permite hoy la PWA en iOS
- Instalar desde Safari (*Compartir → Añadir a pantalla de inicio*), funcionar sin conexión y
  guardar datos en IndexedDB.
- Notificaciones web solo con la app instalada (iOS 16.4+) y solo mientras está abierta o en
  segundo plano reciente, porque Lix no tiene servidor push.
- **No** permite widgets: WidgetKit solo acepta *widget extensions* de una app nativa.

### Qué haría falta
1. **Un proyecto Xcode** (necesita un Mac y una cuenta de Apple Developer para instalar en un
   iPhone real y para distribuir). No se puede compilar desde Windows.
2. **Una app contenedora** con `WKWebView` que cargue el mismo `dist/` empaquetado, igual que
   el shell de Android, con un `WKScriptMessageHandler` como puente (`LixIOS.publishSnapshot`).
3. **Un App Group** (`group.app.lix.web`) activado en la app y en la extensión. La app escribe la
   instantánea en el contenedor compartido (`UserDefaults(suiteName:)` o un archivo en
   `containerURL(forSecurityApplicationGroupIdentifier:)`) y llama a
   `WidgetCenter.shared.reloadAllTimelines()`.
4. **Una Widget Extension en SwiftUI** con un `TimelineProvider` que lee la instantánea y genera
   entradas para las próximas franjas (iOS decide cuándo refrescar; el presupuesto de recargas es
   limitado). Equivalentes directos de los widgets de Android: Consejo del día, Control académico,
   Calendario académico y Lix Flowers (imagen estática del fotograma).
5. **Notificaciones locales** (`UNUserNotificationCenter`) programadas desde la app con la lista
   de consejos de la instantánea: iOS permite hasta 64 pendientes, suficiente para unos días.

### Riesgos y límites en iOS
- Pyodide (Python de Lix Flowers) en `WKWebView`: WebAssembly funciona, pero la memoria
  disponible es menor que en Safari y hay que probarlo en dispositivos reales.
- El almacenamiento de un `WKWebView` es propio de la app: los datos de la PWA de Safari **no**
  pasan solos a la app nativa (hay que usar la copia de seguridad JSON para migrarlos).
- Los widgets de iOS se actualizan cuando el sistema lo permite: no hay garantía de minuto exacto.

**Estado:** solo análisis. La instantánea (`snapshot.js`, versión 1) ya es el contrato que usaría
el widget de iOS, así que no hace falta cambiar la app web para empezarlo.
