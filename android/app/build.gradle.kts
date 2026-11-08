import groovy.json.JsonSlurper
import java.security.MessageDigest
import java.time.Instant
import java.time.temporal.ChronoUnit
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

// App version. Bump BOTH for every release (see README "How to release an update").
val appVersionCode = 3
val appVersionName = "1.2.0"

// Production start page. Override with -Pasm.startUrl=https://...
val prodStartUrl = prop("asm.startUrl", "https://tasm-skill.asf.bd")

android {
    namespace = "bd.asf.tasmskill.portal"
    compileSdk = 35

    defaultConfig {
        applicationId = "bd.asf.tasmskill.portal"
        minSdk = 26
        targetSdk = 35
        versionCode = appVersionCode
        versionName = appVersionName

        buildConfigField("String", "START_URL", "\"$prodStartUrl\"")
        buildConfigField("String", "TRUSTED_ROOT_HOST", "\"tasm-skill.asf.bd\"")
        // Public list of course subdomains that may load inside the app.
        buildConfigField("String", "HOSTS_URL", "\"${prop("asm.hostsUrl", "https://tasm-skill.asf.bd/api/app/hosts")}\"")
        // In-app update check. Override with -Pasm.versionUrl=https://...
        buildConfigField("String", "VERSION_URL", "\"${prop("asm.versionUrl", "https://tasm-skill.asf.bd/api/app/version")}\"")
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

// ---------------------------------------------------------------------------------------------
// publishApk: build the signed release and publish it for the portal's in-app update check.
//
//   gradlew.bat publishApk -Pasm.notes="note one|note two" [-Pasm.minVersionCode=N] [-Pasm.force=true]
//
// Copies app-release.apk to ../public/downloads/asm-portal.apk and writes
// ../public/downloads/asm-portal.json (read by GET /api/app/version). Refuses to run unless
// versionCode is greater than the one already published, or -Pasm.force=true.
// ---------------------------------------------------------------------------------------------

fun jsonString(value: String): String = buildString {
    append('"')
    for (c in value) {
        when {
            c == '"' -> append("\\\"")
            c == '\\' -> append("\\\\")
            c == '\n' -> append("\\n")
            c == '\r' -> append("\\r")
            c == '\t' -> append("\\t")
            c < ' ' -> append(String.format("\\u%04x", c.code))
            else -> append(c) // UTF-8 as is (Bengali notes stay readable)
        }
    }
    append('"')
}

tasks.register("publishApk") {
    group = "distribution"
    description = "Builds the signed release APK and publishes it to ../public/downloads with asm-portal.json."
    dependsOn("assembleRelease")

    val apkFile = layout.buildDirectory.file("outputs/apk/release/app-release.apk")
    val downloadsDir = rootProject.layout.projectDirectory.dir("../public/downloads").asFile
    val notesProp = project.findProperty("asm.notes") as String?
    val minProp = project.findProperty("asm.minVersionCode") as String?
    val force = (project.findProperty("asm.force") as String?)?.toBoolean() == true
    val versionCode = appVersionCode
    val versionName = appVersionName

    doLast {
        val apk = apkFile.get().asFile
        if (!apk.isFile) {
            throw GradleException(
                "Signed release APK not found at $apk. Is android/keystore.properties present? " +
                    "(Without it Gradle builds app-release-unsigned.apk, which cannot be published.)"
            )
        }
        val jsonFile = File(downloadsDir, "asm-portal.json")
        @Suppress("UNCHECKED_CAST")
        val existing: Map<String, Any?> = if (jsonFile.isFile) {
            JsonSlurper().parse(jsonFile, "UTF-8") as Map<String, Any?>
        } else {
            emptyMap()
        }
        val existingCode = (existing["versionCode"] as Number?)?.toInt()
        if (!force) {
            if (existingCode == null) {
                throw GradleException("No ${jsonFile.name} yet: run once with -Pasm.force=true to create it.")
            }
            if (versionCode <= existingCode) {
                throw GradleException(
                    "versionCode $versionCode is not greater than the published $existingCode. " +
                        "Bump appVersionCode in app/build.gradle.kts (or pass -Pasm.force=true)."
                )
            }
        }

        val minVersionCode = minProp?.trim()?.toIntOrNull()
            ?: (existing["minVersionCode"] as Number?)?.toInt()
            ?: 1
        if (minVersionCode < 1 || minVersionCode > versionCode) {
            throw GradleException("minVersionCode must be between 1 and $versionCode (got $minVersionCode).")
        }
        val notes: List<String> = if (notesProp != null) {
            notesProp.split("|").map { it.trim() }.filter { it.isNotEmpty() }
        } else {
            (existing["notes"] as List<*>?)?.mapNotNull { it?.toString() } ?: emptyList()
        }

        val digest = MessageDigest.getInstance("SHA-256")
        apk.inputStream().use { input ->
            val buf = ByteArray(64 * 1024)
            while (true) {
                val n = input.read(buf)
                if (n < 0) break
                digest.update(buf, 0, n)
            }
        }
        val sha256 = digest.digest().joinToString("") { "%02x".format(it) }
        val size = apk.length()

        downloadsDir.mkdirs()
        apk.copyTo(File(downloadsDir, "asm-portal.apk"), overwrite = true)

        val json = buildString {
            append("{\n")
            append("  \"versionCode\": ").append(versionCode).append(",\n")
            append("  \"versionName\": ").append(jsonString(versionName)).append(",\n")
            append("  \"minVersionCode\": ").append(minVersionCode).append(",\n")
            append("  \"sha256\": ").append(jsonString(sha256)).append(",\n")
            append("  \"size\": ").append(size).append(",\n")
            append("  \"notes\": [")
            if (notes.isNotEmpty()) {
                append("\n")
                append(notes.joinToString(",\n") { "    " + jsonString(it) })
                append("\n  ")
            }
            append("],\n")
            append("  \"publishedAt\": ").append(jsonString(Instant.now().truncatedTo(ChronoUnit.SECONDS).toString())).append(",\n")
            append("  \"apk\": \"/downloads/asm-portal.apk\"\n")
            append("}\n")
        }
        jsonFile.writeText(json, Charsets.UTF_8)
        logger.lifecycle("Published $versionName ($versionCode), $size bytes, sha256 $sha256")
        logger.lifecycle("  -> ${File(downloadsDir, "asm-portal.apk")}")
        logger.lifecycle("  -> $jsonFile")
        logger.lifecycle("Commit public/downloads/ and deploy the portal to release it.")
    }
}
