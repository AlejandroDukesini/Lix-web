plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "app.lix.web"
    compileSdk = 36

    defaultConfig {
        applicationId = "app.lix.web"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "1.2.0"
    }

    buildTypes {
        release {
            // Sin minificación: el puente JS↔Kotlin usa reflexión (@JavascriptInterface).
            isMinifyEnabled = false
            // Firma de depuración para poder instalar el APK de prueba; para publicar, configura tu propia firma.
            signingConfig = signingConfigs.getByName("debug")
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

dependencies {
    implementation("androidx.core:core-ktx:1.17.0")
    implementation("androidx.activity:activity-ktx:1.11.0")
    implementation("androidx.webkit:webkit:1.14.0")
    implementation("androidx.glance:glance-appwidget:1.2.0")
    implementation("androidx.glance:glance-material3:1.2.0")
}
