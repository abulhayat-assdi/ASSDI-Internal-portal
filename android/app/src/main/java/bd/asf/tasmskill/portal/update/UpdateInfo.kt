package bd.asf.tasmskill.portal.update

import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import org.json.JSONArray
import org.json.JSONObject

/** Response of GET /api/app/version (docs/ANDROID_PORTAL_APP_PLAN.md, "In-app updates"). */
data class UpdateInfo(
    val versionCode: Int,
    val versionName: String,
    val minVersionCode: Int,
    val apkUrl: String,
    val sha256: String,
    val size: Long,
    val notes: List<String>,
    val publishedAt: String?,
) {
    companion object {
        private val SHA256_RE = Regex("^[a-fA-F0-9]{64}$")

        /**
         * Parses the version JSON. A relative `apkUrl` (or the manifest's `apk` field) is
         * resolved against [baseUrl]. Returns null for anything malformed.
         */
        fun parse(json: String?, baseUrl: String): UpdateInfo? = try {
            val o = JSONObject(json ?: "")
            val versionCode = o.optInt("versionCode", 0)
            val versionName = o.str("versionName")
            val rawApk = o.str("apkUrl").ifEmpty { o.str("apk") }
            val sha = o.str("sha256").lowercase()
            val apkUrl = resolve(baseUrl, rawApk)
            if (versionCode <= 0 || versionName.isEmpty() || apkUrl == null || !SHA256_RE.matches(sha)) {
                null
            } else {
                UpdateInfo(
                    versionCode = versionCode,
                    versionName = versionName,
                    minVersionCode = if (o.isNull("minVersionCode")) 0 else o.optInt("minVersionCode", 0),
                    apkUrl = apkUrl,
                    sha256 = sha,
                    size = if (o.isNull("size")) -1L else o.optLong("size", -1L),
                    notes = notesOf(o),
                    publishedAt = o.str("publishedAt").ifEmpty { null },
                )
            }
        } catch (e: Exception) {
            null
        }

        private fun JSONObject.str(key: String): String = if (isNull(key)) "" else optString(key).trim()

        private fun notesOf(o: JSONObject): List<String> {
            if (o.isNull("notes")) return emptyList()
            return when (val n = o.opt("notes")) {
                is JSONArray -> (0 until n.length()).mapNotNull { i ->
                    if (n.isNull(i)) null else n.optString(i).trim().takeIf { it.isNotEmpty() }
                }
                is String -> n.split("\n").map { it.trim() }.filter { it.isNotEmpty() }
                else -> emptyList()
            }.take(30)
        }

        private fun resolve(baseUrl: String, raw: String): String? {
            if (raw.isEmpty()) return null
            raw.toHttpUrlOrNull()?.let { return it.toString() }
            return baseUrl.toHttpUrlOrNull()?.resolve(raw)?.toString()
        }
    }
}
