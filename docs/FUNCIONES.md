# Funciones de la app

Descripción detallada de cada espacio, para quien quiera conocerlos a fondo. El resumen está en el [README](../README.md).

## La presentación: «Bitácora de observación»

Un viaje por el universo que se recorre desplazándose hacia abajo. No es una animación que se mira, es un registro
astronómico que se va completando: cada capítulo tiene su texto, su ilustración y su movimiento de cámara.

| Capítulo | Qué ocurre |
| --- | --- |
| **Prólogo** | Cielo profundo con estrellas en tres profundidades, nebulosas y planetas lejanos. Las frases aparecen con pausas narrativas («Hay millones de estrellas en el universo...»). Dedicatoria con los apodos animados. |
| **I · La galaxia** | Miles de puntos luminosos dispersos por el cielo se reúnen con el scroll —cada uno con su propio retardo— en los brazos de una **galaxia espiral** que gira en el centro; con el capítulo II se aleja a una esquina. Paralaje, polvo cósmico y estrellas fugaces. |
| **II · Constelaciones** | Las líneas se dibujan con el scroll como **una línea de tiempo real**: nacen en la estrella *21 jul 2025 · el comienzo* (fecha configurada) y un contador acompaña la punta del trazo sumando los días hasta *hoy*. Al cerrarse el travesaño, la constelación forma —sin decirlo— una **«A»**. |
| **III · La Tierra** | Un punto azul lejano crece hasta ser el **planeta Tierra** (océanos, continentes con coordenadas reales, nubes, casquetes, atmósfera y terminador día/noche) que gira con el scroll de África hacia las Américas. Al final la cámara desciende: el globo se inclina hacia el ecuador y su borde se convierte en el horizonte sobre el que aparece el telescopio. |
| **IV · Telescopio** | En un planeta diminuto con atmósfera y un observatorio con la rendija iluminada se alza un refractor sobre montura ecuatorial: tubo esmaltado, anillos de latón, buscador, lente con reflejos, contrapeso, trípode, una linterna roja (detalle real de astrónomos) y notas manuscritas. Del ocular escapa una luz cálida. |
| **V · Asomarse** | La cámara viaja hasta el ocular, el campo de visión se estrecha en un iris y el universo se atenúa. Aparece una vista circular con retícula graduada; el enfoque se ajusta con el scroll («Enfocando… 64 %»). |
| **VI · La vela** | En el centro, una vela de cera con textura y llama viva lleva la **letra «A» grabada en oro**. Ficha del objeto: *Objeto A · Magnitud: incalculable · Distancia: aquí*. La «A» de la constelación reaparece enmarcando el ocular. Tras una pausa: **«Otro año juntos»**. |
| **VII · La sorpresa** | El iris se abre, el universo recupera la luz y la vela queda encendida junto al mensaje final, la firma y **«Entrar a nuestro universo»**. |

Detalles de la experiencia:

- **Distancia al destino**: un contador desciende de 13.800 millones de años luz hasta «Has llegado».
- **Control total**: se avanza y retrocede con rueda, teclado, gestos o el índice de capítulos (I–VII); botón
  «Siguiente capítulo», «Saltar presentación» y «Volver a empezar el viaje». El scroll nunca se bloquea.
- **Sin permisos**: no usa micrófono ni cámara (la versión anterior de la vela tenía soplido experimental por
  micrófono; se retiró).
- **Movimiento reducido**: sin acercamientos ni cámara; cada capítulo se muestra en su composición clave.
- **Estilos y temas**: en Glass los textos van en paneles esmerilados y la lente tiene reflejos; en Maximal todo es una
  carta estelar impresa (tinta gruesa, numerales gigantes, telescopio esmaltado en el color primario). El tema claro es
  un «universo luminoso» al amanecer. Todo cambia al momento.

Aparece sola la primera vez. Después se puede repetir desde el Inicio o desde Configuración sin cambiar nada, y se
puede «restablecer» para que vuelva a aparecer en el siguiente inicio. Sus textos y la letra de la vela son editables.

## Biblioteca

Ruta `#/documentos` (catálogo), `#/documentos/:id` (lector) y `#/documentos/glosario`. Es una biblioteca de
**conocimiento contado como literatura**: cada capítulo empieza con una escena o un caso real, explica el tema con
personajes históricos, analogías y datos, distingue lo establecido de lo dudoso y termina con un cierre narrativo,
**conceptos importantes** y **fuentes y lecturas**.

| Estante | Recorridos | Capítulos |
| --- | --- | --- |
| Astronomía, cosmología y física | primeros observadores · revolución astronómica · universo observable · origen y evolución · leyes de la naturaleza · grandes preguntas | 25 |
| Criminalística e investigación forense | orígenes del método · escena y evidencias · laboratorio · razonar con pruebas | 11 |
| Idiomas: español, inglés y alemán | raíces y sonidos · primeros pasos · gramática · matices y lecturas (A1–C1) | 10 |
| Religiones, mitologías y tradiciones espirituales | mitologías antiguas · tradiciones abrahámicas · Asia · preguntas de fondo | 14 |

Total: **60 capítulos, ≈173 000 palabras** (entre 2 500 y 3 500 palabras cada uno, unos 13–18 minutos de lectura).
Cada estante muestra al final su lista de temas **«En preparación»** (`planned` en `registry/shelves.js`), sin enlace.

**Cómo funciona**

- **Contenido = archivos.** Cada capítulo es `src/features/library/content/<estante>/NN-nombre.md` con una cabecera
  (`id`, `title`, `category`, `path`, `order`, `difficulty`, `description`, `keywords`, `related`). Añadir un capítulo
  es añadir su archivo: no hay que tocar ningún registro.
- **Índice en el build.** `scripts/vite-plugin-library.js` lee los `.md` y expone `virtual:library-index` (metadatos,
  palabras, minutos, secciones y glosario, sin el texto). El catálogo, la búsqueda (sin tildes, por título, descripción,
  secciones, palabras clave y conceptos) y el glosario funcionan sin cargar ningún documento.
- **Un recurso por capítulo.** Cada `.md` se importa con `import.meta.glob(..., '?raw')`: es un chunk aparte que se
  descarga al abrirlo y que el Service Worker precachea (offline completo, sin API remota).
- **Formato** (`engine/markdown.js`): Markdown con extensiones: recuadros `:::recreacion` (marca la ficción literaria
  frente a los hechos), `:::dato`, `:::analogia`, `:::incierto`, `:::gramatica`, `:::nota`, `:::ejercicio` (respuesta
  oculta tras `???`), tablas, citas, pausas de escena y frases para escuchar `[[de|Guten Morgen]]` (es, en, de). Se
  convierte en un árbol de bloques que React pinta: **nunca HTML como texto**, y los enlaces solo pueden ser `http(s)`.
- **Lector:** índice (desplegable en móvil, lateral fijo desde 1240 px con la sección actual resaltada), barra y
  guardado de progreso (al pausar el desplazamiento y al salir; «leído» al llegar al final), «Seguir donde lo dejé»,
  marcador por sección, favoritos, tamaño de texto (5 pasos), anterior/siguiente en el estante y lecturas relacionadas.
  En el estilo Maximalismo, las formas del fondo se atenúan mientras se lee (`data-reading`).
- **Escuchar:** las frases en otro idioma usan las voces instaladas en el dispositivo (Web Speech API, se prefieren las
  locales); si el dispositivo no tiene voz para ese idioma, el botón no aparece.

**Rigor.** Las recreaciones literarias van siempre en su recuadro; las cuestiones abiertas, en «Lo que todavía no
sabemos»; en religión se separa lo que cree cada tradición, lo que narran sus textos y lo que establece la historia.
Las fuentes citadas son libros, artículos e instituciones reales; cuando no había certeza sobre una edición en español
se cita la original. `tests/content.test.js` exige a cada capítulo al menos 2 500 palabras, introducción, 6 secciones,
4 conceptos, 3 fuentes y relacionados existentes.

## Organización personal

Seis espacios agrupados en la navegación bajo «Organización». Todo se calcula a partir de los registros reales:
no hay cifras guardadas aparte ni datos de ejemplo.

| Ruta | Qué hace |
| --- | --- |
| `#/organizar` | Panel del día configurable (qué bloques y en qué orden): hoy, clases y entregas, tareas, finanzas, pagos próximos, metas, escritura rápida y actividad reciente. |
| `#/finanzas` | Resumen por día/semana/mes/año con comparación; movimientos (CRUD, gasto rápido, filtros, orden, búsqueda, duplicar, cancelar, historial de cambios, comprobantes); cuentas (efectivo, banco, billetera, tarjeta de crédito con cupo, corte y pago, ahorro; archivar; conciliar saldo); presupuestos con avisos; metas de ahorro; pagos programados (suscripciones, matrícula, servicios, cuotas, ingresos fijos); informes con CSV e impresión a PDF; categorías y subcategorías; importación CSV con vista previa, validación y duplicados. |
| `#/calendario` | Mes, semana, día, agenda y pasados; búsqueda y filtros por tipo, categoría y prioridad; eventos con repetición, recordatorios, conflictos avisados (no bloqueados) y edición «solo esta / esta y las siguientes / toda la serie»; tareas con subtareas; universidad (materias con horario, docente y salón; trabajos, exámenes, parciales, exposiciones, entregas y lecturas); categorías y ajustes. |
| `#/notas` | Notas en Markdown con guardado automático, recuperación de borradores, modo lectura con casillas marcables, carpetas (3 niveles), colecciones, categorías, etiquetas, fijadas, favoritas, archivo y papelera. |
| `#/diario` | Entradas (varias por día) con fecha del acontecimiento, borrador/publicada, fotos, vínculos con eventos/notas/tareas, preguntas y plantillas opcionales, «En un día como hoy», calendario de entradas y resumen mensual/anual. |
| `#/emociones` | Registro (emoción principal y secundarias, intensidad 1–5 o 1–10, ánimo, contexto, factores, necesidades, estrategias, reflexión guiada opcional, notas privadas), historial con calendario emocional y filtros, gráficos explicados (sin inferir causas), ejercicios de respiración y anclaje sin conexión, emociones personalizables, exportar y borrar todo. |

**Reglas contables** (`finance/ledger.js`): saldo = saldo inicial + ingresos − gastos ± transferencias, solo
movimientos completados; una transferencia nunca es ingreso ni gasto; la compra con tarjeta es el gasto y su pago es
una transferencia (no se cuenta dos veces); un aporte a una meta es una transferencia marcada (el dinero no se
duplica); cada ocurrencia de un pago programado genera como mucho un movimiento; los totales usan la moneda principal
(no hay conversión de divisas). Importes en enteros (centavos).

**Modelo de datos** (`organizer/data/entities.js`): cada tipo declara sus campos validados y sus relaciones con la
política al borrar el destino: `restrict` (se ofrece archivar o reasignar), `unlink` (se conserva sin vínculo),
`cascade` (se enumera en la confirmación) o `reparent` (carpetas). El diálogo de borrado muestra el plan antes de
ejecutarlo; nada dependiente se borra en silencio. Cada escritura es una transacción atómica de IndexedDB; varias
pestañas se sincronizan con BroadcastChannel.

**Recordatorios:** avisos dentro de la app y, con permiso, notificaciones del sistema. Solo funcionan con la app
abierta (no hay servidor push); al abrirla se muestran los de las últimas 12 horas. Opción para ocultar los detalles.
El diario emocional nunca genera notificaciones.

**Privacidad:** PIN opcional (Configuración → Privacidad) para el diario y el diario emocional, con bloqueo por
inactividad. Se guarda solo un hash PBKDF2-SHA-256 con sal. **No es cifrado**: es una barrera frente a miradas
casuales y así se explica en la interfaz. El Markdown nunca se interpreta como HTML y los enlaces solo pueden ser
`http(s)`/`mailto`.
