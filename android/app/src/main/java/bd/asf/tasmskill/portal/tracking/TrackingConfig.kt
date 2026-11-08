package bd.asf.tasmskill.portal.tracking

import org.json.JSONObject
import java.time.Instant
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter

/** Config passed by the web page to `AsmApp.startTracking`. */
data class TrackingConfig(
    val trackId: String,
    val token: String,
    val ingestUrl: String,
    val intervalSeconds: Int,
    val title: String,
    val expiresAt: String?,
    val expiresAtMs: Long?,
) {
    fun isExpired(now: Long = System.currentTimeMillis()): Boolean =
        expiresAtMs != null && now >= expiresAtMs

    fun toJson(): String = JSONObject()
        .put("trackId", trackId)
        .put("token", token)
        .put("ingestUrl", ingestUrl)
        .put("intervalSeconds", intervalSeconds)
        .put("title", title)
        .put("expiresAt", expiresAt ?: JSONObject.NULL)
        .toString()

    companion object {
        const val DEFAULT_INTERVAL = 60
        private const val MIN_INTERVAL = 10
        private const val MAX_INTERVAL = 3600

        fun parse(json: String?): TrackingConfig? = try {
            fromObject(JSONObject(json ?: ""))
        } catch (e: Exception) {
            null
        }

        fun fromObject(o: JSONObject): TrackingConfig? {
            val trackId = o.str("trackId")
            val token = o.str("token")
            val ingestUrl = o.str("ingestUrl")
            if (trackId.isEmpty() || token.isEmpty() || ingestUrl.isEmpty()) return null
            val interval = (if (o.isNull("intervalSeconds")) DEFAULT_INTERVAL
            else o.optInt("intervalSeconds", DEFAULT_INTERVAL)).coerceIn(MIN_INTERVAL, MAX_INTERVAL)
            val expiresAt = o.str("expiresAt").ifEmpty { null }
            val expiresAtMs = expiresAt?.let { parseIso(it) ?: return null }
            return TrackingConfig(
                trackId = trackId,
                token = token,
                ingestUrl = ingestUrl,
                intervalSeconds = interval,
                title = o.str("title"),
                expiresAt = expiresAt,
                expiresAtMs = expiresAtMs,
            )
        }

        private fun JSONObject.str(key: String): String =
            if (isNull(key)) "" else optString(key).trim()

        fun parseIso(value: String): Long? =
            runCatching { Instant.parse(value).toEpochMilli() }.getOrNull()
                ?: runCatching { OffsetDateTime.parse(value).toInstant().toEpochMilli() }.getOrNull()
    }
}

object IsoTime {
    private val formatter: DateTimeFormatter =
        DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'").withZone(ZoneOffset.UTC)

    /** ISO-8601 UTC with milliseconds, e.g. 2026-11-08T08:15:30.123Z */
    fun format(epochMs: Long): String = formatter.format(Instant.ofEpochMilli(epochMs))
}
