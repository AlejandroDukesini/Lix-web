package app.lix.web.widgets

import android.content.Context
import android.content.Intent
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceModifier
import androidx.glance.action.clickable
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.updateAll
import androidx.glance.background
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.width
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import app.lix.web.MainActivity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/** Colores de los widgets: los del tema oscuro de la app (ciruela, rosa, crema). */
object Lix {
    val background = Color(0xFF1D1424)
    val surface = Color(0xFF2A1D33)
    val text = Color(0xFFF7EEE6)
    val muted = Color(0xFFC9B8C9)
    val accent = Color(0xFFEF6F8C)
    val gold = Color(0xFFF5B961)
    val es: Locale = Locale.forLanguageTag("es")
}

fun parseColor(hex: String, fallback: Color = Lix.accent): Color = try {
    Color(android.graphics.Color.parseColor(hex))
} catch (_: Exception) {
    fallback
}

fun openApp(context: Context, route: String) = actionStartActivity(
    Intent(context, MainActivity::class.java)
        .putExtra(MainActivity.EXTRA_ROUTE, route)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP),
)

private val zone: ZoneId get() = ZoneId.systemDefault()
private val timeFormat = DateTimeFormatter.ofPattern("H:mm", Lix.es)
private val dayFormat = DateTimeFormatter.ofPattern("EEE d MMM", Lix.es)

/** «Hoy 10:00», «Mañana», «jue 14 nov 8:00». */
fun whenLabel(at: Instant, withTime: Boolean): String {
    val local = at.atZone(zone)
    val today = LocalDate.now(zone)
    val day = when (local.toLocalDate()) {
        today -> "Hoy"
        today.plusDays(1) -> "Mañana"
        else -> local.format(dayFormat)
    }
    return if (withTime) "$day · ${local.format(timeFormat)}" else day
}

fun clock(at: Instant): String = at.atZone(zone).format(timeFormat)

@Composable
fun WidgetFrame(context: Context, route: String, content: @Composable () -> Unit) {
    Box(
        modifier = GlanceModifier
            .fillMaxSize()
            .cornerRadius(20.dp)
            .background(Lix.background)
            .padding(14.dp)
            .clickable(openApp(context, route)),
    ) {
        Column(modifier = GlanceModifier.fillMaxSize()) { content() }
    }
}

@Composable
fun Eyebrow(text: String, color: Color = Lix.gold) {
    Text(text.uppercase(Lix.es), style = TextStyle(color = ColorProvider(color), fontSize = 10.sp, fontWeight = FontWeight.Bold))
}

@Composable
fun Body(text: String, size: TextUnit = 13.sp, color: Color = Lix.text, bold: Boolean = false, maxLines: Int = 2) {
    Text(text, maxLines = maxLines, style = TextStyle(color = ColorProvider(color), fontSize = size, fontWeight = if (bold) FontWeight.Bold else FontWeight.Normal))
}

/** Fila con una barrita del color de la asignatura. */
@Composable
fun ColorRow(color: Color, content: @Composable () -> Unit) {
    Row(modifier = GlanceModifier.fillMaxWidth().padding(vertical = 3.dp)) {
        Spacer(modifier = GlanceModifier.width(3.dp).height(34.dp).cornerRadius(2.dp).background(color))
        Spacer(modifier = GlanceModifier.width(8.dp))
        Column { content() }
    }
}

@Composable
fun Gap(height: Int = 6) = Spacer(modifier = GlanceModifier.height(height.dp))

/** Actualiza todos los widgets (tras publicar datos nuevos o al sonar una alarma de consejo). */
object WidgetUpdater {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    fun updateAllAsync(context: Context, done: (() -> Unit)? = null) {
        val app = context.applicationContext
        scope.launch {
            try {
                TipWidget().updateAll(app)
                AcademicWidget().updateAll(app)
                CalendarWidget().updateAll(app)
                FlowersWidget().updateAll(app)
            } catch (_: Exception) {
                // Un widget que falla no debe impedir que los demás se actualicen la próxima vez.
            } finally {
                done?.invoke()
            }
        }
    }
}
