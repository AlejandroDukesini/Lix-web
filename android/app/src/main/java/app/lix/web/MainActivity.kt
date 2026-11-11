package app.lix.web

import android.annotation.SuppressLint
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.webkit.WebViewAssetLoader

/**
 * Lix Web en Android: un WebView que sirve la app web (dist/, copiada a los assets del APK)
 * desde https://appassets.androidplatform.net/assets/web/. No hay servidor ni descarga: todo
 * viene del propio APK. Los datos se guardan en el almacenamiento del WebView (IndexedDB y
 * localStorage) y se mantienen al cerrar la app; se borran al desinstalarla.
 */
class MainActivity : ComponentActivity() {
    companion object {
        const val EXTRA_ROUTE = "route"
        private const val ORIGIN = "https://appassets.androidplatform.net"
        const val START_URL = "$ORIGIN/assets/web/index.html"
        private val MIME = mapOf(
            "html" to "text/html", "js" to "text/javascript", "mjs" to "text/javascript", "css" to "text/css",
            "json" to "application/json", "webmanifest" to "application/manifest+json", "wasm" to "application/wasm",
            "zip" to "application/zip", "whl" to "application/zip", "png" to "image/png", "svg" to "image/svg+xml",
            "ico" to "image/x-icon", "woff2" to "font/woff2", "md" to "text/markdown", "txt" to "text/plain", "py" to "text/x-python",
        )
    }

    lateinit var webView: WebView
        private set
    private lateinit var bridge: LixBridge
    private var fileCallback: ValueCallback<Array<Uri>>? = null

    private val pickFiles = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        fileCallback?.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data))
        fileCallback = null
    }

    val notificationPermission = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        bridge.emit("notificationPermission", if (granted) "granted" else "denied")
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Los assets se sirven con el tipo MIME correcto: WebAssembly y los módulos .mjs (Python) lo exigen.
        val assets = WebViewAssetLoader.AssetsPathHandler(this)
        val loader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/") { path ->
                val response = assets.handle(path) ?: return@addPathHandler null
                val ext = path.substringAfterLast('.', "").lowercase()
                WebResourceResponse(MIME[ext] ?: response.mimeType, null, response.data)
            }
            .build()

        // Depuración remota (chrome://inspect) solo en el APK de depuración, nunca en el de publicación.
        if (applicationInfo.flags and android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE != 0) WebView.setWebContentsDebuggingEnabled(true)
        webView = WebView(this).apply {
            setBackgroundColor(Color.parseColor("#1d1424"))
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = false
            settings.allowContentAccess = true
            settings.mediaPlaybackRequiresUserGesture = true
            settings.cacheMode = WebSettings.LOAD_DEFAULT
            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                    loader.shouldInterceptRequest(request.url)

                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                    val url = request.url
                    if (url.host == Uri.parse(ORIGIN).host) return false
                    // Enlaces externos (p. ej. páginas oficiales de juegos): en el navegador del sistema.
                    runCatching { startActivity(Intent(Intent.ACTION_VIEW, url)) }
                    return true
                }
            }
            webChromeClient = object : WebChromeClient() {
                override fun onShowFileChooser(view: WebView, callback: ValueCallback<Array<Uri>>, params: FileChooserParams): Boolean {
                    fileCallback?.onReceiveValue(null)
                    fileCallback = callback
                    return try {
                        pickFiles.launch(params.createIntent())
                        true
                    } catch (_: Exception) {
                        fileCallback = null
                        false
                    }
                }
            }
        }
        bridge = LixBridge(this)
        webView.addJavascriptInterface(bridge, "LixAndroid")
        setContentView(webView)

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) webView.goBack() else finish()
            }
        })

        if (savedInstanceState != null) webView.restoreState(savedInstanceState)
        else webView.loadUrl(startUrl(intent))
    }

    private fun startUrl(intent: Intent?): String {
        val route = intent?.getStringExtra(EXTRA_ROUTE)?.takeIf { it.startsWith("/") }
        return if (route != null) "$START_URL#$route" else START_URL
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        val route = intent.getStringExtra(EXTRA_ROUTE)?.takeIf { it.matches(Regex("^/[a-z0-9/_-]*$")) } ?: return
        webView.evaluateJavascript("window.location.hash = '#$route';", null)
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    override fun onResume() {
        super.onResume()
        bridge.emit("resume", "")
    }
}
