import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
}

// Release signing: android/keystore.properties (gitignored) with
// storeFile, storePassword, keyAlias, keyPassword. Without it the release
// APK is built unsigned.
val keystorePropsFile = rootProject.file("keystore.properties")
val keystoreProps = Properties().apply {
    if (keystorePropsFile.exists()) keystorePropsFile.inputStream().use { load(it) }
}

fun prop(name: String, default: String): String =
    (project.findProperty(name) as String?)?.takeIf { it.isNotBlank() } ?: default

// Production start page. Override with -Pasm.startUrl=https://...
val prodStartUrl = prop("asm.startUrl", "https://tasm-skill.asf.bd")

android {
    namespace = "bd.asf.tasmskill.portal"
    compileSdk = 35

    defaultConfig {
        applicationId = "bd.asf.tasmskill.portal"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"

        buildConfigField("String", "START_URL", "\"$prodStartUrl\"")
        buildConfigField("String", "TRUSTED_ROOT_HOST", "\"tasm-skill.asf.bd\"")
        // Public list of course subdomains that may load inside the app.
        buildConfigField("String", "HOSTS_URL", "\"${prop("asm.hostsUrl", "https://tasm-skill.asf.bd/api/app/hosts")}\"")
        // Empty in release: only https://tasm-skill.asf.bd and its subdomains are trusted.
        buildConfigField("String", "DEV_ORIGIN", "\"\"")
    }

    signingConfigs {
        create("release") {
            if (keystorePropsFile.exists()) {
                storeFile = rootProject.file(keystoreProps.getProperty("storeFile"))
                storePassword = keystoreProps.getProperty("storePassword")
                keyAlias = keystoreProps.getProperty("keyAlias")
                keyPassword = keystoreProps.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        debug {
            // Debug additionally trusts a dev origin (cleartext allowed only for the hosts
            // listed in src/debug/res/xml/network_security_config.xml).
            // -Pasm.devOrigin=http://10.0.2.2:3000  -Pasm.debugStartUrl=http://10.0.2.2:3000
            buildConfigField("String", "DEV_ORIGIN", "\"${prop("asm.devOrigin", "http://10.0.2.2:3000")}\"")
            buildConfigField("String", "START_URL", "\"${prop("asm.debugStartUrl", prodStartUrl)}\"")
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
            if (keystorePropsFile.exists()) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        buildConfig = true
    }
    lint {
        abortOnError = true
        checkReleaseBuilds = true
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.appcompat)
    implementation(libs.androidx.activity.ktx)
    implementation(libs.androidx.swiperefreshlayout)
    implementation(libs.androidx.core.splashscreen)
    implementation(libs.androidx.work.runtime.ktx)
    implementation(libs.play.services.location)
    implementation(libs.okhttp)
    implementation(libs.androidx.webkit)

    testImplementation(libs.junit)
    testImplementation(libs.org.json)
}
