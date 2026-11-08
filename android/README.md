# ASSDI Portal Android app

A native Kotlin app that opens the portal (`https://tasm-skill.asf.bd`) in a WebView and adds field location tracking that keeps running while the screen is locked (foreground service).
The contract with the web portal (trusted origins, user-agent suffix, the `window.AsmApp` bridge, the `asmapp:tracking` event and `POST /api/tracking/ingest`) is in [`../docs/ANDROID_PORTAL_APP_PLAN.md`](../docs/ANDROID_PORTAL_APP_PLAN.md).

- applicationId: `bd.asf.tasmskill.portal`
- minSdk 26 (Android 8.0), targetSdk / compileSdk 35
- Toolchain: Gradle 8.9 (wrapper), Android Gradle Plugin 8.7.3, Kotlin 2.0.21, JDK 17
- Libraries: AndroidX (core, appcompat, activity, swiperefreshlayout, core-splashscreen, WorkManager), Play Services Location (Fused Location), OkHttp

## Prerequisites

1. **JDK 17**, for example `C:\Program Files\Eclipse Adoptium\jdk-17.0.21.9-hotspot` or Android Studio's bundled JBR (`C:\Program Files\Android\Android Studio\jbr`). Set `JAVA_HOME` to it.
2. **Android SDK** at `C:\Users\USER\AppData\Local\Android\Sdk` (installed by the Android Studio setup wizard). The project needs:
   - `platforms;android-35`
   - `build-tools;34.0.0` (AGP 8.7's default; AGP installs it automatically during a build if the licenses are accepted) and `build-tools;35.0.0`
   - `platform-tools` (for `adb`)

   Install the missing ones in Android Studio (Settings > Languages & Frameworks > Android SDK > SDK Platforms: "Android 15.0 (API 35)"; SDK Tools: Build-Tools). Or use the command line, but only when no other SDK install is running:
   ```
   "%LOCALAPPDATA%\Android\Sdk\cmdline-tools\latest\bin\sdkmanager.bat" "platforms;android-35" "build-tools;35.0.0" "build-tools;34.0.0" "platform-tools"
   ```
3. **`android/local.properties`** (gitignored) points to the SDK:
   ```
   sdk.dir=C\:\\Users\\USER\\AppData\\Local\\Android\\Sdk
   ```
   (Another SDK that already has everything is at `F:\Android\Sdk`. To use it, set `sdk.dir=F\:/Android/Sdk`.)

If the C: drive is short on space, you can move the Gradle cache: `set GRADLE_USER_HOME=F:\dev-cache\gradle`.

## Build

From `android/` (Windows `cmd`):

```
set JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17.0.21.9-hotspot
gradlew.bat assembleDebug      :: debug APK (debug key, WebView debugging on)
gradlew.bat assembleRelease    :: release APK (R8 minified, signed with release.jks)
gradlew.bat lint               :: lint report in app/build/reports/lint-results-debug.html
```

APKs land in:
- `android/app/build/outputs/apk/debug/app-debug.apk` (about 4.8 MB)
- `android/app/build/outputs/apk/release/app-release.apk` (about 1.2 MB)

Without `keystore.properties` the release task produces `app-release-unsigned.apk`, which cannot be installed.

To publish for download, copy `app-release.apk` to the portal's download path **`/downloads/asm-portal.apk`**. The web side serves it at `/app`.

### Debug build against a local dev server

The debug build also trusts a dev origin (default `http://10.0.2.2:3000`, which is the host machine as seen from the emulator). Cleartext HTTP is allowed only for that host, and only in debug (`app/src/debug/res/xml/network_security_config.xml`). The release build is HTTPS only.

```
gradlew.bat assembleDebug -Pasm.debugStartUrl=http://10.0.2.2:3000
gradlew.bat assembleDebug -Pasm.devOrigin=http://192.168.1.20:3000 -Pasm.debugStartUrl=http://192.168.1.20:3000
```
If you change the dev host, add it to the debug network security config too.

## Changing things

| What | Where |
|---|---|
| App name | `app/src/main/res/values/strings.xml` → `app_name` |
| Start URL | `app/build.gradle.kts` → `prodStartUrl` (or `-Pasm.startUrl=https://...`) |
| Trusted root domain | `app/build.gradle.kts` → `TRUSTED_ROOT_HOST` (also update the plan doc) |
| Version | `app/build.gradle.kts` → `versionCode` / `versionName` |
| Launcher icon | `app/src/main/res/drawable/ic_launcher_foreground.xml` (vector) + `ic_launcher_background` colour in `values/colors.xml` |
| Notification text | `strings.xml` → `tracking_running` and the others |

### Releasing an update

Android installs an update only if **both** of these hold:
1. `versionCode` is higher than the installed one (1 → 2 → 3 …). Also bump `versionName` (for example `1.0.1`), which the web sees in the user agent and in `AsmApp.getInfo()`.
2. The APK is signed with **the same release key** (`release.jks`).

## Signing key: back it up now

- The release keystore is `android/release.jks`. Its passwords and alias are in `android/keystore.properties`. **Both are gitignored on purpose.**
- **Back both files up somewhere safe outside this computer** (an encrypted drive or a password manager vault). **If they are lost, no future update can be installed over the existing app.** Every user would have to uninstall and reinstall, which also loses their login and any queued tracking data.
- `keystore.properties` format:
  ```
  storeFile=release.jks
  storePassword=...
  keyAlias=assdi-portal
  keyPassword=...
  ```

## Install with adb

Enable Developer options and USB debugging on the phone, then:

```
"%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" devices
"%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" install -r app\build\outputs\apk\release\app-release.apk
```
`-r` keeps the app data when updating. A debug build and a release build have different signatures, so uninstall one before installing the other (`adb uninstall bd.asf.tasmskill.portal`).

Useful logs: `adb logcat -s AsmTracking AsmUploader chromium`.
To debug the WebView in a debug build, open `chrome://inspect` on the PC.

## Which sites are trusted (security)

Students' deployed mini-sites share the `<name>.tasm-skill.asf.bd` namespace with the course portals, so "any subdomain" is **not** trusted.

- **Trusted:** `https://tasm-skill.asf.bd` (port 443) and `https://<slug>.tasm-skill.asf.bd` only when `<slug>` is in the list from `GET https://tasm-skill.asf.bd/api/app/hosts`. The reserved labels `www`, `admin`, `api`, `mail`, `ftp`, `app` and `portal` are never trusted. The debug build also trusts the dev origin. The rules are in `OriginPolicy.kt` and unit-tested in `app/src/test/.../OriginPolicyTest.kt` (`gradlew.bat test`).
- **Host list:**
  - It is fetched at startup during the splash (4 s timeout) and again on resume when it is older than 5 minutes. It is cached in private prefs, and the cache is used when a fetch fails.
  - When a page navigates to an unlisted `<name>.tasm-skill.asf.bd`, the app refetches the list once (rate-limited) in case the course is new. If the host is still unlisted, it opens in the external browser, never in the WebView.
- **Where it applies:** main-frame navigation and redirects, a safety net in `onPageStarted`, the JS bridge, web geolocation, and `ingestUrl`. `ingestUrl` must be trusted and have exactly the path `/api/tracking/ingest`.
- **Iframes:**
  - Frames that load HTML from unlisted `<name>.tasm-skill.asf.bd` hosts are blocked with a 403 (`shouldInterceptRequest` and subframe `shouldOverrideUrlLoading`).
  - The bridge itself is frame-aware. The Java object is exposed as `__asmAppNative` and every call needs a random per-launch nonce. `window.AsmApp` is a JS wrapper that holds the nonce. It is injected with `WebViewCompat.addDocumentStartJavaScript` only into frames whose origin is on the trusted list, so any other iframe (on any domain) gets `{"error":"untrusted"}`.
  - On a very old WebView without document-start scripts, `AsmApp` is exposed directly with the top-level-page check only.
- To test against a different host-list URL: `-Pasm.hostsUrl=https://.../api/app/hosts`.

## How tracking works (short)

1. The web page calls `AsmApp.startTracking(JSON.stringify({trackId, token, ingestUrl, intervalSeconds, title, expiresAt}))`.
2. The app runs the permission flow: location → "Allow all the time" (explained in Bengali and English first) → notifications (Android 13+) → battery-optimization exemption. Tracking also starts with foreground-only permission, because the foreground service keeps it alive while the screen is locked. The status then honestly reports `permission: "granted_foreground"`.
3. `TrackingService` (a foreground service, type `location`, with an ongoing "ফিল্ড ট্র্যাকিং চালু আছে" notification) receives a fused high-accuracy fix every `intervalSeconds`. The minimum interval is half of that.
4. Each fix is stored in a local SQLite queue and then uploaded (up to 500 per request) with `Authorization: Bearer <token>`.
   - 200: the rows are deleted (accepted, duplicate and rejected alike).
   - 410 or 401: the service stops, the config is cleared and the web gets an `asmapp:tracking` event with `lastError`.
   - Network error or 5xx: WorkManager retries with exponential backoff when the network is back.
5. Calling `startTracking` again (same or new trackId, for example with a fresh token from `/api/tracking/resume`) replaces the stored config. Queued rows of the same track are sent with the new token.
6. `stopTracking` clears the config, stops the service and immediately makes one last asynchronous upload attempt. The server revokes the token about 1.5 s later.
7. After a reboot or an app update, the session resumes if it has not expired, provided "Allow all the time" was granted. Otherwise a "tap to resume" notification is shown, and opening the app resumes it. The service also stops by itself at `expiresAt`.

## Device test checklist (before rollout)

Test on real phones from several vendors: Samsung, Xiaomi/Redmi, Realme/Oppo and Vivo, on Android 10, 12, 13 and 14 or newer if possible.

- [ ] Fresh install: the splash shows, the course directory opens, login works, and the cookie survives an app restart.
- [ ] Pull-to-refresh works only at the top of the page. Back navigates history, then exits.
- [ ] `tel:`, `mailto:`, WhatsApp and Google Maps "Direction" links open the external apps. Other sites open in the browser.
- [ ] File upload: gallery, multiple files, camera photo. Downloads (certificates/PDFs) finish with a login cookie.
- [ ] Offline at launch: the error screen shows, and Retry works once online.
- [ ] Start tracking and grant "Allow all the time". **Lock the screen for at least 30 minutes** and confirm that the staff map keeps updating about every 60 s.
- [ ] Same test with only "While using the app". It should still work while locked (foreground service), and the status shows `granted_foreground`.
- [ ] **Offline replay:** turn on airplane mode for 10 minutes while tracking, then turn it off. The queued points arrive (trail has no gap), and `pending` goes back to 0.
- [ ] Stop from the web: the notification disappears, and the last points arrive before the token is revoked.
- [ ] Session ended by staff/server (410): the service stops by itself, and the web shows it stopped.
- [ ] **Reboot** while tracking: tracking resumes (with background permission), or the "tap to resume" notification appears.
- [ ] **Battery saver / vendor power management ON:** Samsung (Sleeping apps / Deep sleeping apps), Xiaomi (Autostart + Battery saver "No restrictions"), Realme/Oppo (Allow background activity, Auto-launch), Vivo (High background power consumption, Autostart). Note which settings are needed and tell the students.
- [ ] Expiry: tracking stops on its own at `expiresAt`.
- [ ] Force-stopping the app ends tracking (an expected, honest limit). The staff map shows the track as stale.
