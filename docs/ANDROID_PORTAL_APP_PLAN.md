# Android portal app — retained plan for a later implementation stage

The user's current instruction is to record this plan and build the Business Incubation web feature first. Do not claim an Android app or locked-screen tracking has been delivered with the web feature.

## Application

An institution-branded Kotlin Android application displays the existing HTTPS student portal in a trusted-origin WebView. Students use existing accounts and course selection; upload/camera/file-picker/download handling must work. Teachers continue using the web dashboard. Website and app share the portal database/API.

## Native field tracking

Explicit student check-in starts a location foreground service with an ongoing notification; check-out/sign-out ends it. Ask for the necessary runtime location permissions and display accuracy/permission state. Capture position, accuracy, captured-at/received-at timestamps and session ID. Buffer offline samples, deduplicate on sync, show stale/delayed data honestly. No tracking outside an active field session. Do not replace this requirement with a PWA or browser timer.

Use session/device-scoped revocable authorization, trusted HTTPS origins and a restricted native bridge. No embedded credentials. Respect OS restrictions; no promise of tracking after force-stop, disabled location or OS termination. Admin controls sampling/retention and authorized staff access. No GPS data in public reports.

## Build and delivery

Prepare Android SDK/JDK/Gradle, app identity/icon, signing key under institution ownership, signed APK, repeatable build/upgrade instructions and student permission/install guide. Pilot APK distribution before general rollout. Play Store publication is a separate release decision. Real Android phones from multiple vendors must demonstrate locked-screen tracking, battery restrictions, offline replay and stop behavior. Emulator-only validation is insufficient.

## Web integration boundary

The web feature provides field sessions, endpoint GPS and position history. It labels browser updates as foreground-only. Native device/token ingestion is added and tested with the Android app rather than claiming the web feature alone meets locked-screen tracking.

References: [Android location permissions](https://developer.android.com/develop/sensors-and-location/location/permissions), [WebView](https://developer.android.com/develop/ui/views/layout/webapps/webview), [Signing](https://developer.android.com/studio/publish/app-signing).
