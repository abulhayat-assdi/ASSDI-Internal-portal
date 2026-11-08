package bd.asf.tasmskill.portal.web

import android.webkit.JavascriptInterface
import bd.asf.tasmskill.portal.BuildConfig
import bd.asf.tasmskill.portal.MainActivity
import bd.asf.tasmskill.portal.Origins
import bd.asf.tasmskill.portal.tracking.LocationPerms
import bd.asf.tasmskill.portal.tracking.PositionQueue
import bd.asf.tasmskill.portal.tracking.StatusBus
import bd.asf.tasmskill.portal.tracking.TrackingConfig
import bd.asf.tasmskill.portal.tracking.TrackingService
import bd.asf.tasmskill.portal.tracking.TrackingStatus
import bd.asf.tasmskill.portal.tracking.TrackingStore
import bd.asf.tasmskill.portal.tracking.Uploader
import org.json.JSONObject
import org.json.JSONTokener
import java.security.MessageDigest
import java.security.SecureRandom

/**
 * Implementation of `window.AsmApp` (docs/ANDROID_PORTAL_APP_PLAN.md). All arguments and
 * return values are JSON strings. Calls arrive on a WebView binder thread; UI work is posted
 * to the main thread. Every call checks that the top-level page is trusted.
 *
 * How the page reaches it (see MainActivity.installBridge):
 *  - Secure mode (WebView supports DOCUMENT_START_SCRIPT, i.e. practically all devices):
 *    the raw Java object is exposed as `__asmAppNative` and every method requires a per-launch
 *    random nonce. `window.AsmApp` is a small JS wrapper injected at document start only into
 *    frames whose origin is trusted, and it holds the nonce in a closure. An untrusted iframe
 *    inside a trusted page sees `__asmAppNative` but not the nonce, so every call returns
 *    {"error":"untrusted"}.
 *  - Legacy mode (very old WebView): [LegacyAsmAppBridge] is exposed directly as `AsmApp`,
 *    guarded by the top-level check plus the subframe blocking in MainActivity.
 */
class AsmAppCore(private val activity: MainActivity) {

    private val app = activity.applicationContext

    fun trusted(): Boolean = Origins.isTrusted(activity.currentUrlForBridge())

    private fun status(): String = TrackingStatus.build(app).toString()

    fun getInfo(): String = JSONObject()
        .put("app", "asm-portal")
        .put("platform", "android")
        .put("versionName", BuildConfig.VERSION_NAME)
        .put("versionCode", BuildConfig.VERSION_CODE)
        .toString()

    fun startTracking(configJson: String?): String {
        val config = TrackingConfig.parse(configJson)
        val error = when {
            config == null -> "invalid_config"
            // Runs on the bridge thread; may refetch the host list once for a brand-new course.
            !Origins.isValidIngestUrlWithRefetch(app, config.ingestUrl) -> "invalid_ingest_url"
            config.isExpired() -> "expired"
            else -> null
        }
        if (config == null || error != null) {
            TrackingStore.setLastError(app, error)
            StatusBus.notifyChanged()
            return status()
        }

        val previous = TrackingStore.getConfig(app)
        if (previous?.trackId != config.trackId) {
            TrackingStore.resetSession(app)
            if (previous != null) PositionQueue.get(app).deleteTrack(previous.trackId)
        } else {
            TrackingStore.setLastError(app, null)
        }
        TrackingStore.saveConfig(app, config)

        activity.runOnUiThread {
            activity.permissionFlow.run(onForeground = { granted ->
                if (granted) {
                    if (!TrackingService.start(app)) TrackingStore.setLastError(app, "foreground_service_blocked")
                } else {
                    TrackingStore.clearConfig(app)
                    TrackingStore.setLastError(app, "location_permission_denied")
                }
                StatusBus.notifyChanged()
            })
        }
        return status()
    }

    fun stopTracking(trackId: String?): String {
        val wanted = parseTrackId(trackId)
        val config = TrackingStore.getConfig(app)
        if (config != null && (wanted.isNullOrEmpty() || wanted == config.trackId)) {
            TrackingStore.clearConfig(app)
            TrackingService.stop(app)
            Uploader.finalFlush(app, config)
        }
        StatusBus.notifyChanged()
        return status()
    }

    fun getTrackingStatus(): String = status()

    fun requestPermissions(): String {
        activity.runOnUiThread {
            activity.permissionFlow.run(onForeground = { granted ->
                // A session waiting for permission can start now.
                if (granted && TrackingStore.getConfig(app) != null && !TrackingService.running) {
                    TrackingService.start(app)
                }
            })
        }
        return status()
    }

    fun openAppSettings(): String {
        activity.runOnUiThread {
            runCatching { activity.startActivity(LocationPerms.appDetailsIntent(activity)) }
        }
        return JSONObject().put("ok", true).toString()
    }

    /** Accepts `abc`, `"abc"` (JSON string) or `{"trackId":"abc"}`. */
    private fun parseTrackId(raw: String?): String? {
        val s = raw?.trim().orEmpty()
        if (s.isEmpty() || s == "null" || s == "undefined") return null
        return try {
            when (val v = JSONTokener(s).nextValue()) {
                is String -> v.trim()
                is JSONObject -> if (v.isNull("trackId")) null else v.optString("trackId").trim()
                else -> s
            }
        } catch (e: Exception) {
            s
        }
    }

    companion object {
        const val UNTRUSTED = "{\"error\":\"untrusted\"}"

        fun newNonce(): String {
            val bytes = ByteArray(24)
            SecureRandom().nextBytes(bytes)
            return bytes.joinToString("") { "%02x".format(it) }
        }

        /** JS wrapper defining window.AsmApp, injected only into trusted frames. */
        fun wrapperScript(nonce: String): String = """
            (function(){
              try {
                var b = window.__asmAppNative;
                if (!b) return;
                var n = ${JSONObject.quote(nonce)};
                var api = {
                  getInfo: function(){ return b.getInfo(n); },
                  startTracking: function(c){ return b.startTracking(n, typeof c === 'string' ? c : JSON.stringify(c)); },
                  stopTracking: function(t){ return b.stopTracking(n, t == null ? '' : String(t)); },
                  getTrackingStatus: function(){ return b.getTrackingStatus(n); },
                  requestPermissions: function(){ return b.requestPermissions(n); },
                  openAppSettings: function(){ return b.openAppSettings(n); }
                };
                Object.freeze(api);
                Object.defineProperty(window, 'AsmApp', { value: api, writable: false, configurable: false, enumerable: true });
              } catch (e) {}
            })();
        """.trimIndent()
    }
}

/** Exposed as `__asmAppNative`; every call must carry the nonce. */
class SecureAsmAppBridge(private val core: AsmAppCore, nonce: String) {
    private val expected = nonce.toByteArray()

    private fun ok(nonce: String?): Boolean =
        nonce != null && MessageDigest.isEqual(expected, nonce.toByteArray()) && core.trusted()

    @JavascriptInterface
    fun getInfo(nonce: String?): String = if (ok(nonce)) core.getInfo() else AsmAppCore.UNTRUSTED

    @JavascriptInterface
    fun startTracking(nonce: String?, configJson: String?): String =
        if (ok(nonce)) core.startTracking(configJson) else AsmAppCore.UNTRUSTED

    @JavascriptInterface
    fun stopTracking(nonce: String?, trackId: String?): String =
        if (ok(nonce)) core.stopTracking(trackId) else AsmAppCore.UNTRUSTED

    @JavascriptInterface
    fun getTrackingStatus(nonce: String?): String =
        if (ok(nonce)) core.getTrackingStatus() else AsmAppCore.UNTRUSTED

    @JavascriptInterface
    fun requestPermissions(nonce: String?): String =
        if (ok(nonce)) core.requestPermissions() else AsmAppCore.UNTRUSTED

    @JavascriptInterface
    fun openAppSettings(nonce: String?): String =
        if (ok(nonce)) core.openAppSettings() else AsmAppCore.UNTRUSTED
}

/** Fallback exposed directly as `AsmApp` when document-start scripts are unsupported. */
class LegacyAsmAppBridge(private val core: AsmAppCore) {
    @JavascriptInterface
    fun getInfo(): String = if (core.trusted()) core.getInfo() else AsmAppCore.UNTRUSTED

    @JavascriptInterface
    fun startTracking(configJson: String?): String =
        if (core.trusted()) core.startTracking(configJson) else AsmAppCore.UNTRUSTED

    @JavascriptInterface
    fun stopTracking(trackId: String?): String =
        if (core.trusted()) core.stopTracking(trackId) else AsmAppCore.UNTRUSTED

    @JavascriptInterface
    fun getTrackingStatus(): String = if (core.trusted()) core.getTrackingStatus() else AsmAppCore.UNTRUSTED

    @JavascriptInterface
    fun requestPermissions(): String = if (core.trusted()) core.requestPermissions() else AsmAppCore.UNTRUSTED

    @JavascriptInterface
    fun openAppSettings(): String = if (core.trusted()) core.openAppSettings() else AsmAppCore.UNTRUSTED
}
