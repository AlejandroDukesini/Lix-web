package app.lix.web

import android.Manifest
import android.content.ContentValues
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import android.webkit.JavascriptInterface
import android.widget.Toast
import app.lix.web.tips.TipScheduler
import app.lix.web.widgets.WidgetUpdater
import org.json.JSONObject
import java.io.File

/**
 * Puente entre la app web y Android (window.LixAndroid). Solo expone lo necesario:
 *   publishSnapshot(json)        datos para widgets y consejos (ver Snapshot.kt)
 *   consumeDeliveredTips()        consejos mostrados con la app cerrada (para el historial)
 *   notificationPermission()      'granted' | 'denied' | 'default'
 *   requestNotificationPermission()  pide el permiso (Android 13+); responde con un evento
 *   saveFile(base64, name, mime)  guarda una descarga en Descargas
 *   info()                        versión y capacidades
 * Los eventos hacia la web se envían con window.__lixNative?.(tipo, valor).
 */
class LixBridge(private val activity: MainActivity) {
    private val context = activity.applicationContext

    @JavascriptInterface
    fun info(): String = JSONObject()
        .put("platform", "android")
        .put("version", BuildConfigInfo.versionName(context))
        .put("sdk", Build.VERSION.SDK_INT)
        .put("widgets", true)
        .toString()

    @JavascriptInterface
    fun publishSnapshot(json: String): Boolean = try {
        SnapshotStore.write(context, json)
        TipScheduler.reschedule(context)
        WidgetUpdater.updateAllAsync(context)
        true
    } catch (_: Exception) {
        false
    }

    @JavascriptInterface
    fun consumeDeliveredTips(): String = TipScheduler.consumeDelivered(context)

    /** Fija un widget en la pantalla de inicio (el lanzador pide confirmación). */
    @JavascriptInterface
    fun pinWidget(kind: String): Boolean {
        val receiver = when (kind) {
            "tip" -> app.lix.web.widgets.TipWidgetReceiver::class.java
            "academic" -> app.lix.web.widgets.AcademicWidgetReceiver::class.java
            "calendar" -> app.lix.web.widgets.CalendarWidgetReceiver::class.java
            "flowers" -> app.lix.web.widgets.FlowersWidgetReceiver::class.java
            else -> return false
        }
        val manager = android.appwidget.AppWidgetManager.getInstance(context)
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || !manager.isRequestPinAppWidgetSupported) return false
        return manager.requestPinAppWidget(android.content.ComponentName(context, receiver), null, null)
    }

    @JavascriptInterface
    fun notificationPermission(): String = when {
        TipScheduler.canNotify(context) -> "granted"
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            !activity.shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS) &&
            activity.getSharedPreferences("lix_bridge", 0).getBoolean("asked", false) -> "denied"
        else -> "default"
    }

    @JavascriptInterface
    fun requestNotificationPermission() {
        activity.runOnUiThread {
            TipScheduler.ensureChannel(context)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                activity.getSharedPreferences("lix_bridge", 0).edit().putBoolean("asked", true).apply()
                activity.notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
            } else {
                emit("notificationPermission", if (TipScheduler.canNotify(context)) "granted" else "denied")
            }
        }
    }

    @JavascriptInterface
    fun saveFile(base64: String, name: String, mime: String): Boolean {
        val safeName = name.replace(Regex("[^A-Za-z0-9._-]"), "_").take(80).ifBlank { "lix" }
        return try {
            val bytes = Base64.decode(base64, Base64.DEFAULT)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val values = ContentValues().apply {
                    put(MediaStore.Downloads.DISPLAY_NAME, safeName)
                    put(MediaStore.Downloads.MIME_TYPE, mime)
                    put(MediaStore.Downloads.RELATIVE_PATH, "${Environment.DIRECTORY_DOWNLOADS}/Lix")
                }
                val uri = context.contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values) ?: return false
                context.contentResolver.openOutputStream(uri)?.use { it.write(bytes) } ?: return false
            } else {
                val dir = File(context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), "Lix").apply { mkdirs() }
                File(dir, safeName).writeBytes(bytes)
            }
            activity.runOnUiThread { Toast.makeText(activity, activity.getString(R.string.saved_download, safeName), Toast.LENGTH_SHORT).show() }
            true
        } catch (_: Exception) {
            false
        }
    }

    /** Evento hacia la web (en el hilo principal). */
    fun emit(type: String, value: String) {
        val payload = JSONObject.quote(value)
        activity.runOnUiThread {
            if (activity.isFinishing) return@runOnUiThread
            activity.webView.evaluateJavascript("window.__lixNative && window.__lixNative(${JSONObject.quote(type)}, $payload);", null)
        }
    }
}

object BuildConfigInfo {
    fun versionName(context: android.content.Context): String =
        runCatching { context.packageManager.getPackageInfo(context.packageName, 0).versionName ?: "" }.getOrDefault("")
}
