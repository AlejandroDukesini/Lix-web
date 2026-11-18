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
import android.widget.FrameLayout
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.SystemBarStyle
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.webkit.WebViewAssetLoader

/**
 * Lix Web en Android: un WebView que sirve la app web (dist/, copiada a los assets del APK)
 * desde https://appassets.androidplatform.net/assets/web/. No hay servidor ni descarga: todo
 * viene del propio APK. Los datos se guardan en el almacenamiento del WebView (IndexedDB y
 * localStorage) y se mantienen al cerrar la app; se borran al desinstalarla.
 *
 * Experiencia móvil:
 *  - De borde a borde (obligatorio desde Android 15): el contenido se separa de las barras del
 *    sistema, del recorte de la cámara y del teclado con márgenes calculados aquí.
 *  - Durante una partida la web pide pantalla completa (LixAndroid.setImmersive).
 *  - Al minimizar, el WebView se pausa: la página pasa a «oculta» y los juegos se ponen en pausa
 *    solos (escuchan visibilitychange); el audio y los temporizadores dejan de consumir.
 *  - El botón Atrás pregunta primero a la página (window.__lixBack): en un juego confirma la salida.
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
    private lateinit var root: FrameLayout
    private var immersive = false
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
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.dark(Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.dark(Color.TRANSPARENT),
        )
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
                    if (url.scheme == "https" && url.host == Uri.parse(ORIGIN).host) return false
                    // Enlaces externos (p. ej. páginas oficiales de juegos): en el navegador del sistema.
                    // Solo esquemas conocidos; nunca intent:, file: ni javascript: desde la página.
                    if (url.scheme in setOf("https", "http", "mailto")) {
                        runCatching { startActivity(Intent(Intent.ACTION_VIEW, url).addCategory(Intent.CATEGORY_BROWSABLE)) }
                    }
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
        root = FrameLayout(this).apply {
            setBackgroundColor(Color.parseColor("#1d1424"))
            addView(webView, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT))
        }
        setContentView(root)
        // Márgenes de las barras del sistema, el recorte de pantalla y el teclado (adjustResize ya
        // no redimensiona en modo de borde a borde). En pantalla completa las barras miden 0.
        ViewCompat.setOnApplyWindowInsetsListener(root) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            val ime = insets.getInsets(WindowInsetsCompat.Type.ime())
            view.setPadding(bars.left, bars.top, bars.right, maxOf(bars.bottom, ime.bottom))
            WindowInsetsCompat.CONSUMED
        }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                // La página decide primero (p. ej. confirmar la salida de una partida).
                webView.evaluateJavascript("(function(){try{return window.__lixBack?window.__lixBack()===true:false}catch(e){return false}})()") { handled ->
                    if (handled == "true") return@evaluateJavascript
                    if (webView.canGoBack()) webView.goBack() else finish()
                }
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

    /** Pantalla completa durante las partidas; las barras reaparecen un momento al deslizar desde el borde. */
    fun setGameFullscreen(on: Boolean) {
        immersive = on
        val controller = WindowInsetsControllerCompat(window, root)
        if (on) {
            controller.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            controller.hide(WindowInsetsCompat.Type.systemBars())
        } else {
            controller.show(WindowInsetsCompat.Type.systemBars())
        }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        // Al volver a la app (o tras un diálogo del sistema) se recupera la pantalla completa.
        if (hasFocus && immersive) setGameFullscreen(true)
    }

    override fun onPause() {
        // La página pasa a oculta (visibilitychange): los juegos se pausan y el audio se suspende.
        webView.onPause()
        super.onPause()
    }

    override fun onResume() {
        super.onResume()
        webView.onResume()
        bridge.emit("resume", "")
    }

    override fun onDestroy() {
        root.removeView(webView)
        webView.destroy()
        super.onDestroy()
    }
}
