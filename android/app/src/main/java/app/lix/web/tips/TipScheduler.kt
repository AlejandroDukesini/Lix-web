package app.lix.web.tips

import android.Manifest
import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import app.lix.web.MainActivity
import app.lix.web.R
import app.lix.web.SnapshotStore
import app.lix.web.TipEntry
import app.lix.web.widgets.WidgetUpdater
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant

/**
 * Notificaciones de los Consejos diarios en Android, con la app cerrada.
 *
 * La app web elige los consejos de las próximas franjas (misma lógica que en la web) y los
 * publica en la instantánea. Aquí solo se programa UNA alarma: la de la siguiente franja.
 * Al sonar se muestra el consejo y se programa la siguiente.
 *
 * Se usa setAndAllowWhileIdle (no exacta): Android puede retrasarla unos minutos para ahorrar
 * batería, y la app no pide el permiso de alarmas exactas. Si el teléfono estuvo dormido y se
 * pasaron varias franjas, solo se muestra la más reciente (sin avalancha). Todas las
 * notificaciones usan el mismo id: una nueva sustituye a la anterior, nunca se duplican.
 */
object TipScheduler {
    const val CHANNEL_ID = "consejos"
    private const val NOTIFICATION_ID = 4101
    private const val PREFS = "lix_tips"
    private const val KEY_DELIVERED = "delivered"
    private const val KEY_SHOWN = "shown_keys"

    fun reschedule(context: Context) {
        val alarms = context.getSystemService(AlarmManager::class.java) ?: return
        val pending = alarmIntent(context)
        alarms.cancel(pending)
        val snapshot = SnapshotStore.read(context) ?: return
        if (!snapshot.tipNotifications) return
        val shown = shownKeys(context)
        val next = snapshot.tips.firstOrNull { it.at.isAfter(Instant.now()) && it.key !in shown } ?: return
        alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next.at.toEpochMilli(), pending)
    }

    private fun alarmIntent(context: Context): PendingIntent =
        PendingIntent.getBroadcast(context, 0, Intent(context, TipAlarmReceiver::class.java), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

    /** Muestra el consejo de la franja vigente (si no se mostró ya) y programa la siguiente. */
    fun deliverDue(context: Context) {
        val snapshot = SnapshotStore.read(context)
        val now = Instant.now()
        val tip = snapshot?.tips?.lastOrNull { !it.at.isAfter(now.plusSeconds(60)) }
        if (snapshot != null && snapshot.tipNotifications && tip != null && tip.key !in shownKeys(context)) {
            if (show(context, tip)) markShown(context, tip, now)
        }
        reschedule(context)
    }

    fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(NotificationManager::class.java) ?: return
        if (manager.getNotificationChannel(CHANNEL_ID) != null) return
        manager.createNotificationChannel(
            NotificationChannel(CHANNEL_ID, context.getString(R.string.channel_tips), NotificationManager.IMPORTANCE_DEFAULT).apply {
                description = context.getString(R.string.channel_tips_description)
            },
        )
    }

    fun canNotify(context: Context): Boolean =
        (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU || ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) &&
            NotificationManagerCompat.from(context).areNotificationsEnabled()

    private fun show(context: Context, tip: TipEntry): Boolean {
        if (!canNotify(context)) return false
        ensureChannel(context)
        val open = PendingIntent.getActivity(
            context, 1,
            Intent(context, MainActivity::class.java).putExtra(MainActivity.EXTRA_ROUTE, "/consejos").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_lix)
            .setContentTitle(context.getString(R.string.tip_notification_title, categoryLabel(tip.category)))
            .setContentText(tip.text)
            .setStyle(NotificationCompat.BigTextStyle().bigText(tip.text))
            .setContentIntent(open)
            .setAutoCancel(true)
            .setOnlyAlertOnce(true)
            .build()
        return try {
            NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, notification)
            true
        } catch (_: SecurityException) {
            false
        }
    }

    private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    private fun shownKeys(context: Context): Set<String> = prefs(context).getStringSet(KEY_SHOWN, emptySet()) ?: emptySet()

    private fun markShown(context: Context, tip: TipEntry, at: Instant) {
        val p = prefs(context)
        val keys = (shownKeys(context) + tip.key).toList().takeLast(400).toSet()
        val delivered = JSONArray(p.getString(KEY_DELIVERED, "[]"))
        delivered.put(JSONObject().put("key", tip.key).put("tipId", tip.id).put("shownAt", at.toString()))
        p.edit().putStringSet(KEY_SHOWN, keys).putString(KEY_DELIVERED, delivered.toString()).apply()
    }

    /** Consejos mostrados con la app cerrada, para que la app los añada a su historial. Se vacía al leerla. */
    fun consumeDelivered(context: Context): String {
        val p = prefs(context)
        val value = p.getString(KEY_DELIVERED, "[]") ?: "[]"
        p.edit().putString(KEY_DELIVERED, "[]").apply()
        return value
    }

    fun categoryLabel(category: String): String = when (category) {
        "reflexion" -> "Reflexión"
        "disciplina" -> "Disciplina"
        "amor" -> "Amor"
        "motivacion" -> "Motivación"
        "aprendizaje" -> "Aprendizaje"
        "superacion" -> "Superación"
        "relaciones" -> "Relaciones"
        "bienestar" -> "Bienestar"
        "creatividad" -> "Creatividad"
        "sabiduria" -> "Sabiduría"
        else -> "Consejo"
    }
}

class TipAlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val result = goAsync()
        TipScheduler.deliverDue(context)
        WidgetUpdater.updateAllAsync(context) { result.finish() }
    }
}

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        TipScheduler.reschedule(context)
    }
}
