# Android portal app and competition field tracking

Status: in development on branch `feature/android-app` (worktree `asm-portal-v2-android`). Started 2026-11-08.

## Decisions (from the owner, 2026-11-08)

- The app is the whole portal on a phone. It opens `https://tasm-skill.asf.bd` (course directory), the user picks a course (course subdomain `<slug>.tasm-skill.asf.bd`), then logs in as student or teacher. The same portal keeps working on PC browsers.
- Inside the app, students do not see Typing Adventure or the Typing Test. Everything else in the student portal is available.
- Location tracking works for **any competition**, not only Business Incubation:
  - Normal competitions: staff turn tracking on per competition; the student taps **Start** ("ফিল্ডে যাচ্ছি") and **Stop** ("ফিরে এসেছি") in the app.
  - Business Incubation: the existing field check-in starts tracking and check-out stops it.
- The app sends a location **every 60 seconds** (the per-competition setting defaults to 60). Tracking keeps running while the screen is locked, using a foreground service.
- Staff watch from a browser: an OpenStreetMap (Leaflet) live map with every student in the field. A **Direction** button opens Google Maps directions (`https://www.google.com/maps/dir/?api=1&destination=<lat>,<lng>`) from the viewer's current location to the student. There is no Google Cloud key and no billing.
- Same portal server and same database (new tables via Prisma migration). No separate Coolify project. The APK download is served by the portal at `/app`.
- iPhone is out of scope. Tracking happens only during an active session, never outside one.

## Contract between the web portal and the Android app

### Identification
- The WebView user agent is the default UA plus ` AsmPortalApp/<versionName> (Android)`.
- Web code detects the app with `navigator.userAgent.includes("AsmPortalApp")` or `typeof window.AsmApp !== "undefined"`.

### Trusted origins
- `https://tasm-skill.asf.bd`, plus `https://<slug>.tasm-skill.asf.bd` **only for active course slugs** returned by the public endpoint `GET /api/app/hosts`. The app caches that list and refetches it once when it meets an unknown subdomain. A debug build also trusts a configurable dev origin (e.g. `http://10.0.2.2:3000`).
- Students' deployed mini-sites share the same subdomain namespace and contain arbitrary uploaded HTML. They are never trusted: they open in the external browser and can never reach the bridge.
- Any other URL opens outside the app (system browser or intent). This includes `tel:`, `mailto:`, `whatsapp:`, `intent:` and Google Maps links.
- The JS bridge `window.AsmApp` answers only when the current top-level page is on a trusted origin. Otherwise every method is a no-op that returns `{"error":"untrusted"}`.

### JS bridge `window.AsmApp` (all arguments and returns are JSON strings)
| Method | Purpose |
|---|---|
| `getInfo()` | `{"app":"asm-portal","platform":"android","versionName":"1.0.0","versionCode":1}` |
| `startTracking(configJson)` | config `{"trackId","token","ingestUrl","intervalSeconds","title","expiresAt"}`. Runs the permission flow if needed, then starts the foreground service. Returns the status. |
| `stopTracking(trackId)` | Stops the service, flushes the queue one final time, clears the stored config. Returns the status. |
| `getTrackingStatus()` | `{"active":bool,"trackId":string\|null,"permission":"granted_background"\|"granted_foreground"\|"denied","locationEnabled":bool,"batteryOptimized":bool,"notificationsAllowed":bool,"pending":int,"lastFixAt":iso\|null,"lastSentAt":iso\|null,"lastError":string\|null}` |
| `requestPermissions()` | Runs the permission flow: fine location → background "Allow all the time" → notifications (Android 13+) → battery-optimization exemption. |
| `openAppSettings()` | Opens the app's system settings page. |

Native to web: whenever the status changes, the app calls `window.dispatchEvent(new CustomEvent("asmapp:tracking",{detail:<status>}))`.

### Server endpoints
All JSON. `cookie` means the normal portal session cookie (`getSessionUser`).

1. `POST /api/tracking/start` (cookie, student) with body `{competitionId}`
   - The competition must belong to the course, be active (startDate ≤ now ≤ endDate when endDate is set), and have `trackingEnabled`. The student must belong to the competition's batch (`batchName` null = all batches).
   - Business Incubation competitions answer 409 "Use field check-in". Their tracks are created by the incubation check-in.
   - Any other open track of the same user is closed first.
   - Response: `{track, token, ingestUrl:"<origin>/api/tracking/ingest", intervalSeconds, expiresAt}`.
2. `POST /api/tracking/stop` (cookie, the student who owns the track, or staff) with body `{trackId}`. Ends the track and revokes its token.
3. `POST /api/tracking/ingest` (`Authorization: Bearer <token>`, **no cookie**) with body `{trackId, positions:[{latitude,longitude,accuracy,capturedAt,speed?,bearing?,battery?}]}` (1–500 items).
   - The token is 32 random bytes in base64url; only its SHA-256 hash is stored. It is bound to one track and expires when the track ends or at `expiresAt` (default start + 18 h), whichever comes first.
   - Accepted samples have `capturedAt` between track start − 2 min and now + 2 min. Older offline samples are accepted, so the 120-second freshness rule does not apply here.
   - Duplicates are ignored (unique on `trackId, capturedAt`).
   - The track's cached last position is updated.
   - Tracks linked to an incubation field session also get rows in `incubation_positions` (same dedupe), so the existing incubation history keeps working.
   - Response 200 `{accepted, duplicates}`. A track that has ended, or a token that is revoked or expired → **410** `{stop:true}`, and the app stops its service. A bad token → 401.
4. `GET /api/tracking/live?competitionId=…` (cookie, staff with competition/incubation permission). Returns open tracks plus those ended in the last 12 h, each with student name, batch, team/group label, last position, `receivedAt`, battery, and a stale flag (no fix for more than 3 × interval).
6. `POST /api/tracking/resume` (cookie, owning student) with body `{trackId}` or `{incubationSessionId}`. Issues a new token for an open track (the old token then gets 401) and returns the same shape as start. The web uses it when a track is open but the app is not running it.
   - Stop order: the web calls `AsmApp.stopTracking` first, then revokes on the server about 1.5 s later, so the final flush is accepted.
   - Battery is an integer percentage 0–100. A stored track that gets 401 is treated like 410. The ingest response also contains `rejected` (samples outside the window, which are dropped and not retried).
5. `GET /api/tracking/positions?trackId=…` (cookie, staff, or the student who owns the track). Ordered positions for the trail.

### Data (new Prisma models, RLS `course_isolation` like the incubation tables)
- `competitions`: add `tracking_enabled boolean default false` and `tracking_interval_seconds int default 60`.
- `field_tracks`: id, course_id, competition_id, user_id, user_name, batch_name, label, source (`competition`|`incubation`), incubation_session_id?, started_at, ended_at?, end_reason?, interval_seconds, last_latitude/longitude/accuracy/captured_at/received_at/battery, token_hash (unique), token_expires_at, token_revoked_at.
- `field_track_positions`: id, course_id, track_id, captured_at, received_at, latitude, longitude, accuracy, speed?, bearing?, battery?, unique(track_id, captured_at).
- Retention: positions older than 90 days are deleted by the existing retention cron.

## Android app (folder `android/` in this repo)
- Kotlin, minSdk 26, targetSdk 35, applicationId `bd.asf.tasmskill.portal`, name "ASSDI Portal" (owner decision 2026-11-08; easy to change in `strings.xml`). SDK: `C:\Users\USER\AppData\Local\Android\Sdk` (installed by the Android Studio wizard).
- WebView: JS, DOM storage, cookies (third-party cookies off), file upload with camera capture, downloads via DownloadManager with the session cookie, pull-to-refresh, back navigation, an offline/error screen with Retry, a splash screen. Web geolocation permission is granted only to trusted origins.
- Tracking: `TrackingService` is a foreground service (`foregroundServiceType="location"`) with an ongoing notification. It uses FusedLocationProviderClient at high accuracy and the configured interval. Fixes go into a local SQLite queue. An uploader posts batches right after each fix, and WorkManager retries with backoff when there is no network. On 410 the service stops itself. The config persists, and a boot receiver resumes the session after a reboot if it has not expired.
- Permissions: `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `ACCESS_BACKGROUND_LOCATION`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION`, `POST_NOTIFICATIONS`, `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`, `RECEIVE_BOOT_COMPLETED`, `INTERNET`, `CAMERA`.
- Signing: release keystore outside git (`android/keystore.properties` and `*.jks` are gitignored). Build instructions are in `android/README.md`.
- Honest limits: tracking stops if the user force-stops the app, turns off location, or the phone vendor kills the service. The staff map shows such tracks as stale.

## In-app updates
- Web changes (pages, features, design) reach the app as soon as they are deployed, because the app loads the live portal. No new APK is needed.
- Native changes (tracking, permissions, name/icon, bridge) need a new APK. The release manifest `public/downloads/asm-portal.json` is written by `gradlew publishApk` together with `public/downloads/asm-portal.apk`. Both are committed and deployed with the portal.
- `GET /api/app/version` (public, no-store) returns `{versionCode, versionName, minVersionCode, apkUrl, sha256, size, notes, publishedAt}`. It returns 404 when nothing is published. `apkUrl` carries `?v=<versionCode>` to bust caches.
- The app checks on launch and on resume (at most every 30 min).
  - A newer `versionCode` shows the "নতুন আপডেট এসেছে" dialog. "পরে" snoozes it for 24 h.
  - Below `minVersionCode`, the dialog cannot be dismissed.
  - The update downloads the APK, verifies the SHA-256 and the package, then opens the system installer. The user taps Install once; Android requires that for apps installed from outside a store.
- The same release key must sign every update. Releases v1.0.0 and earlier have no updater, so their users update once by hand from `/app`.

## Validation required before rollout
Real phones from several vendors (Samsung, Xiaomi/Redmi, Realme/Oppo, Vivo). Check: locked-screen tracking for at least 30 min, offline replay, stop behaviour, reboot, battery-saver. Pilot APK first.
