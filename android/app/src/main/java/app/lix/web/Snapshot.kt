package app.lix.web

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.time.Instant
import java.time.OffsetDateTime

/**
 * Instantánea de datos para widgets y notificaciones.
 *
 * La fuente de verdad es la app (IndexedDB dentro del WebView). Cada vez que cambian los datos,
 * la app web calcula una proyección pequeña (próximas clases y actividades, consejos de las
 * próximas franjas, la última animación de flores) y la publica por el puente JS. Los widgets
 * solo leen esta proyección y la interpretan con la hora actual: no guardan datos propios.
 */
object SnapshotStore {
    private const val FILE = "widget_snapshot.json"

    fun write(context: Context, json: String) {
        // Se valida antes de guardar: un JSON roto nunca sustituye al último bueno.
        JSONObject(json)
        val target = File(context.filesDir, FILE)
        val tmp = File(context.filesDir, "$FILE.tmp")
        tmp.writeText(json)
        if (!tmp.renameTo(target)) {
            target.writeText(json)
            tmp.delete()
        }
    }

    fun read(context: Context): Snapshot? = try {
        val file = File(context.filesDir, FILE)
        if (file.exists()) Snapshot.parse(JSONObject(file.readText())) else null
    } catch (_: Exception) {
        null
    }
}

data class TipEntry(val key: String, val at: Instant, val id: String, val text: String, val category: String)
data class ClassEntry(val subject: String, val color: String, val start: Instant, val end: Instant, val room: String, val building: String)
data class ActivityEntry(val title: String, val typeLabel: String, val subject: String, val color: String, val due: Instant, val hasTime: Boolean, val evaluation: Boolean)
data class DateEntry(val name: String, val type: String, val date: String)
data class FlowerFrame(val cols: Int, val rows: Int, val chars: String, val colors: String, val palette: List<String>, val background: String, val title: String)

data class Snapshot(
    val generatedAt: Instant?,
    val tips: List<TipEntry>,
    val tipNotifications: Boolean,
    val classes: List<ClassEntry>,
    val activities: List<ActivityEntry>,
    val overdue: Int,
    val dates: List<DateEntry>,
    val flowers: FlowerFrame?,
) {
    /** Consejo vigente: el de la última franja que ya empezó. */
    fun currentTip(now: Instant = Instant.now()): TipEntry? = tips.lastOrNull { !it.at.isAfter(now) } ?: tips.firstOrNull()

    fun nextClass(now: Instant = Instant.now()): ClassEntry? = classes.firstOrNull { it.end.isAfter(now) }

    /** Pendientes que aún no vencen. Las que no tienen hora llegan con las 23:59 de su día. */
    fun upcoming(now: Instant = Instant.now()): List<ActivityEntry> = activities.filter { it.due.isAfter(now) }

    companion object {
        private fun instant(value: String?): Instant? = try {
            if (value.isNullOrBlank()) null else OffsetDateTime.parse(value).toInstant()
        } catch (_: Exception) {
            try { Instant.parse(value) } catch (_: Exception) { null }
        }

        private inline fun <T> JSONArray?.mapObjects(block: (JSONObject) -> T?): List<T> {
            if (this == null) return emptyList()
            val out = ArrayList<T>(length())
            for (i in 0 until length()) optJSONObject(i)?.let { block(it) }?.let(out::add)
            return out
        }

        fun parse(root: JSONObject): Snapshot {
            val tips = root.optJSONObject("tips")
            val academic = root.optJSONObject("academic")
            val flowers = root.optJSONObject("flowers")
            return Snapshot(
                generatedAt = instant(root.optString("generatedAt")),
                tips = tips?.optJSONArray("timeline").mapObjects { o ->
                    val at = instant(o.optString("at")) ?: return@mapObjects null
                    TipEntry(o.optString("key"), at, o.optString("id"), o.optString("text"), o.optString("category"))
                }.sortedBy { it.at },
                tipNotifications = tips?.optBoolean("notifications") ?: false,
                classes = academic?.optJSONArray("classes").mapObjects { o ->
                    val start = instant(o.optString("start")) ?: return@mapObjects null
                    val end = instant(o.optString("end")) ?: return@mapObjects null
                    ClassEntry(o.optString("subject"), o.optString("color", "#ef6f8c"), start, end, o.optString("room"), o.optString("building"))
                }.sortedBy { it.start },
                activities = academic?.optJSONArray("activities").mapObjects { o ->
                    val due = instant(o.optString("due")) ?: return@mapObjects null
                    ActivityEntry(o.optString("title"), o.optString("typeLabel"), o.optString("subject"), o.optString("color", "#8e5bd8"), due, o.optBoolean("hasTime"), o.optBoolean("evaluation"))
                }.sortedBy { it.due },
                overdue = academic?.optInt("overdue") ?: 0,
                dates = academic?.optJSONArray("dates").mapObjects { o -> DateEntry(o.optString("name"), o.optString("type"), o.optString("date")) },
                flowers = flowers?.let {
                    val palette = it.optJSONArray("palette")
                    FlowerFrame(
                        it.optInt("cols"), it.optInt("rows"), it.optString("chars"), it.optString("colors"),
                        List(palette?.length() ?: 0) { i -> palette!!.optString(i) }, it.optString("background", "#0e0b17"), it.optString("title"),
                    )
                },
            )
        }
    }
}
