import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

/*
 * Versión: sale de package.json (única fuente de verdad, igual que la web). versionCode =
 * mayor·10000 + menor·100 + parche, así cada versión publicada instala ENCIMA de la anterior
 * conservando los datos (1.2.0 → 10200, 1.3.0 → 10300).
 */
val appVersion: String = Regex("\"version\"\\s*:\\s*\"([0-9]+\\.[0-9]+\\.[0-9]+)\"")
    .find(rootProject.file("../package.json").readText())?.groupValues?.get(1)
    ?: throw GradleException("No se encontró la versión en package.json")
val appVersionCode: Int = appVersion.split(".").map(String::toInt).let { (a, b, c) -> a * 10000 + b * 100 + c }

/*
 * Firma de publicación. NUNCA se guarda en el repositorio: se lee de android/keystore.properties
 * (ignorado por git; lo crea `npm run android:keystore`) o de variables de entorno (CI):
 *   LIX_KEYSTORE, LIX_KEYSTORE_PASSWORD, LIX_KEY_ALIAS, LIX_KEY_PASSWORD
 */
val signing = Properties().apply {
    rootProject.file("keystore.properties").takeIf { it.exists() }?.inputStream()?.use { load(it) }
    System.getenv("LIX_KEYSTORE")?.let { setProperty("storeFile", it) }
    System.getenv("LIX_KEYSTORE_PASSWORD")?.let { setProperty("storePassword", it) }
    System.getenv("LIX_KEY_ALIAS")?.let { setProperty("keyAlias", it) }
    System.getenv("LIX_KEY_PASSWORD")?.let { setProperty("keyPassword", it) }
}
val hasReleaseSigning = listOf("storeFile", "storePassword", "keyAlias", "keyPassword").all { !signing.getProperty(it).isNullOrBlank() }

android {
    namespace = "app.lix.web"
    compileSdk = 36

    defaultConfig {
        applicationId = "app.lix.web"
        minSdk = 26
        targetSdk = 36
        versionCode = appVersionCode
        versionName = appVersion
    }

    signingConfigs {
        if (hasReleaseSigning) {
            create("release") {
                storeFile = file(signing.getProperty("storeFile"))
                storePassword = signing.getProperty("storePassword")
                keyAlias = signing.getProperty("keyAlias")
                keyPassword = signing.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        debug {
            // El APK de pruebas convive con el de publicación en el mismo teléfono.
            applicationIdSuffix = ".debug"
            versionNameSuffix = "-debug"
        }
        release {
            // R8 reduce el código nativo; proguard-rules.pro conserva el puente JS↔Kotlin.
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            if (hasReleaseSigning) signingConfig = signingConfigs.getByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        compose = true
    }

    androidResources {
        // Pyodide y la rueda de Pillow ya vienen comprimidos o deben leerse tal cual.
        noCompress += listOf("wasm", "zip", "whl")
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
    }
}

/*
 * La app web (dist/ del proyecto, generado con `npm run build`) se copia a los assets
 * del APK: la app Android funciona sin servidor ni Internet. `npm run android:build`
 * hace el build web y después compila el APK.
 */
val webDist = rootProject.file("../dist")
val syncWebAssets by tasks.registering(Sync::class) {
    description = "Copia el build web (dist/) a los assets de la app."
    from(webDist)
    into(layout.projectDirectory.dir("src/main/assets/web"))
    doFirst {
        if (!webDist.resolve("index.html").exists()) {
            throw GradleException("No existe ../dist/index.html. Ejecuta primero `npm run build` en la raíz del proyecto.")
        }
    }
}
tasks.named("preBuild") { dependsOn(syncWebAssets) }

// Sin firma propia no se genera un APK de publicación «sin firmar» que no se puede instalar.
tasks.matching { it.name == "preReleaseBuild" }.configureEach {
    doFirst {
        if (!hasReleaseSigning) {
            throw GradleException(
                "Falta la firma de publicación. Ejecuta `npm run android:keystore` (crea la clave y android/keystore.properties) " +
                    "o define LIX_KEYSTORE, LIX_KEYSTORE_PASSWORD, LIX_KEY_ALIAS y LIX_KEY_PASSWORD.",
            )
        }
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.17.0")
    implementation("androidx.activity:activity-ktx:1.11.0")
    implementation("androidx.webkit:webkit:1.14.0")
    implementation("androidx.glance:glance-appwidget:1.2.0")
    implementation("androidx.glance:glance-material3:1.2.0")
}
