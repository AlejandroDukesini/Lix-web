package app.lix.web.widgets

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Typeface
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.Image
import androidx.glance.ImageProvider
import androidx.glance.LocalSize
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.provideContent
import androidx.glance.layout.ContentScale
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import app.lix.web.FlowerFrame
import app.lix.web.SnapshotStore
import app.lix.web.tips.TipScheduler
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter

private const val NO_DATA = "Abre Lix una vez para preparar este widget."

/* ---------------- Widget 1: Consejo del día ---------------- */

class TipWidget : GlanceAppWidget() {
    override val sizeMode = SizeMode.Exact

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val snapshot = SnapshotStore.read(context)
        provideContent {
            val tip = snapshot?.currentTip(Instant.now())
            val large = LocalSize.current.height >= 160.dp
            WidgetFrame(context, "/consejos") {
                Eyebrow(if (tip != null) "Consejo · ${TipScheduler.categoryLabel(tip.category)}" else "Consejo del día")
                Gap(8)
                Body(tip?.text ?: NO_DATA, size = if (large) 17.sp else 14.sp, maxLines = if (large) 7 else 4)
                Gap(6)
                Body("Lix", size = 11.sp, color = Lix.accent, bold = true)
            }
        }
    }
}

class TipWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = TipWidget()
}

/* ---------------- Widget 2: Control académico ---------------- */

class AcademicWidget : GlanceAppWidget() {
    override val sizeMode = SizeMode.Exact

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val snapshot = SnapshotStore.read(context)
        provideContent {
            val now = Instant.now()
            WidgetFrame(context, "/academico") {
                Eyebrow("Control académico")
                Gap(6)
                if (snapshot == null) {
                    Body(NO_DATA)
                } else {
                    val next = snapshot.nextClass(now)
                    val upcoming = snapshot.upcoming(now)
                    val task = upcoming.firstOrNull { !it.evaluation }
                    val exam = upcoming.firstOrNull { it.evaluation }
                    ColorRow(next?.let { parseColor(it.color) } ?: Lix.muted) {
                        Body(if (next != null) "Clase: ${next.subject}" else "Sin clases próximas", bold = true, maxLines = 1)
                        if (next != null) {
                            val place = listOf(next.room, next.building).filter { it.isNotBlank() }.joinToString(" · ")
                            Body(whenLabel(next.start, true) + if (place.isNotEmpty()) " · $place" else "", size = 11.sp, color = Lix.muted, maxLines = 1)
                        }
                    }
                    ColorRow(task?.let { parseColor(it.color) } ?: Lix.muted) {
                        Body(if (task != null) "${task.typeLabel}: ${task.title}" else "Sin tareas pendientes", bold = true, maxLines = 1)
                        if (task != null) Body(whenLabel(task.due, task.hasTime) + if (task.subject.isNotBlank()) " · ${task.subject}" else "", size = 11.sp, color = Lix.muted, maxLines = 1)
                    }
                    ColorRow(exam?.let { parseColor(it.color) } ?: Lix.muted) {
                        Body(if (exam != null) "${exam.typeLabel}: ${exam.title}" else "Sin parciales a la vista", bold = true, maxLines = 1)
                        if (exam != null) Body(whenLabel(exam.due, exam.hasTime) + if (exam.subject.isNotBlank()) " · ${exam.subject}" else "", size = 11.sp, color = Lix.muted, maxLines = 1)
                    }
                    if (snapshot.overdue > 0) Body("${snapshot.overdue} vencida(s)", size = 11.sp, color = Lix.accent, bold = true, maxLines = 1)
                }
            }
        }
    }
}

class AcademicWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = AcademicWidget()
}

/* ---------------- Widget 3: Calendario académico ---------------- */

class CalendarWidget : GlanceAppWidget() {
    override val sizeMode = SizeMode.Exact

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val snapshot = SnapshotStore.read(context)
        provideContent {
            val now = Instant.now()
            val today = LocalDate.now(ZoneId.systemDefault())
            val rows = if (LocalSize.current.height >= 200.dp) 5 else 3
            WidgetFrame(context, "/academico/calendario") {
                Eyebrow(today.format(DateTimeFormatter.ofPattern("EEEE", Lix.es)))
                Body(today.format(DateTimeFormatter.ofPattern("d 'de' MMMM", Lix.es)), size = 20.sp, bold = true, maxLines = 1)
                val holiday = snapshot?.dates?.firstOrNull { it.date == today.toString() }
                if (holiday != null) Body(holiday.name, size = 11.sp, color = Lix.gold, maxLines = 1)
                Gap(6)
                if (snapshot == null) {
                    Body(NO_DATA)
                } else {
                    val upcoming = snapshot.upcoming(now)
                    if (upcoming.isEmpty()) Body("Nada pendiente. ¡A disfrutar!", color = Lix.muted)
                    upcoming.take(rows).forEach { item ->
                        ColorRow(parseColor(item.color)) {
                            Body(item.title, size = 12.sp, bold = true, maxLines = 1)
                            Body("${item.typeLabel} · ${whenLabel(item.due, item.hasTime)}", size = 11.sp, color = Lix.muted, maxLines = 1)
                        }
                    }
                    val deliveries = upcoming.count { !it.evaluation }
                    if (deliveries > 0) Body("$deliveries entrega(s) pendiente(s)", size = 11.sp, color = Lix.accent, bold = true, maxLines = 1)
                }
            }
        }
    }
}

class CalendarWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = CalendarWidget()
}

/* ---------------- Widget 4: Lix Flowers ---------------- */

/** Ramito por defecto (hasta que se cree una animación en Lix Flowers). */
private val DEFAULT_FLOWER = FlowerFrame(
    cols = 15, rows = 7,
    chars = "   @     @     " + "  @@@   @@@  @ " + "   @  @  @  @@@" + "   |  @@@ |  | " + "   |   |  |  | " + "  \\|/ \\|/\\|/\\|/" + "  '''''''''''' ",
    colors = "",
    palette = listOf("#0e0b17", "#ff6f91", "#7cc47f"),
    background = "#1d1424",
    title = "Lix Flowers",
)

/** Dibuja el fotograma ASCII (colores de la animación) en un bitmap: Glance no anima, se muestra un fotograma. */
fun renderFlower(frame: FlowerFrame, widthPx: Int): Bitmap {
    val cellW = widthPx.toFloat() / frame.cols
    val cellH = cellW * 11f / 6f
    val bitmap = Bitmap.createBitmap(widthPx, (cellH * frame.rows).toInt().coerceAtLeast(1), Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    canvas.drawColor(android.graphics.Color.parseColor(frame.background))
    val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        typeface = Typeface.MONOSPACE
        textSize = cellH * 0.9f
        textScaleX = cellW / measureText("M").coerceAtLeast(0.1f)
    }
    for (r in 0 until frame.rows) {
        for (c in 0 until frame.cols) {
            val i = r * frame.cols + c
            val ch = frame.chars.getOrNull(i) ?: continue
            if (ch == ' ') continue
            val index = if (frame.colors.isNotEmpty()) (frame.colors.getOrNull(i)?.code ?: 0x101) - 0x100 else if (ch == '|' || ch == '/' || ch == '\\' || ch == '\'') 2 else 1
            paint.color = runCatching { android.graphics.Color.parseColor(frame.palette.getOrElse(index) { "#ffffff" }) }.getOrDefault(android.graphics.Color.WHITE)
            canvas.drawText(ch.toString(), c * cellW, r * cellH + cellH * 0.82f, paint)
        }
    }
    return bitmap
}

class FlowersWidget : GlanceAppWidget() {
    // Tamaño exacto: el dibujo se ajusta al espacio real que le da el lanzador.
    override val sizeMode = SizeMode.Exact

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val frame = SnapshotStore.read(context)?.flowers ?: DEFAULT_FLOWER
        val bitmap = renderFlower(frame, 720)
        provideContent {
            WidgetFrame(context, "/flores") {
                Image(
                    provider = ImageProvider(bitmap),
                    contentDescription = "Flores en arte ASCII: ${frame.title}",
                    contentScale = ContentScale.Fit,
                    modifier = GlanceModifier.fillMaxWidth().height((LocalSize.current.height - 52.dp).coerceAtLeast(40.dp)),
                )
                Body(frame.title, size = 11.sp, color = Lix.muted, maxLines = 1)
            }
        }
    }
}

class FlowersWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = FlowersWidget()
}
