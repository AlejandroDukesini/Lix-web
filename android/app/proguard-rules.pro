# Reglas de R8 para el APK de publicación.
# El puente window.LixAndroid se invoca por reflexión desde JavaScript: sus métodos no deben
# renombrarse ni eliminarse.
-keepclassmembers class app.lix.web.LixBridge {
    @android.webkit.JavascriptInterface <methods>;
}
-keepattributes JavascriptInterface
