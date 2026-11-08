package bd.asf.tasmskill.portal.tracking

import android.content.Context
import android.location.LocationManager
import android.os.PowerManager
import androidx.core.app.NotificationManagerCompat
import androidx.core.location.LocationManagerCompat
import org.json.JSONObject

/** Builds the `getTrackingStatus()` JSON from the contract. */
object TrackingStatus {
    fun build(ctx: Context): JSONObject {
        val config = TrackingStore.getConfig(ctx)?.takeIf { !it.isExpired() }
        val hasLocation = LocationPerms.hasForeground(ctx)
        val lm = ctx.getSystemService(LocationManager::class.java)
        val pm = ctx.getSystemService(PowerManager::class.java)
        val lastFix = TrackingStore.lastFixAt(ctx)
        val lastSent = TrackingStore.lastSentAt(ctx)
        return JSONObject().apply {
            // Active = a session is configured and the service is (or can be) running.
            put("active", config != null && (TrackingService.running || hasLocation))
            put("trackId", config?.trackId ?: JSONObject.NULL)
            put("permission", LocationPerms.state(ctx))
            put("locationEnabled", lm != null && LocationManagerCompat.isLocationEnabled(lm))
            put("batteryOptimized", pm?.isIgnoringBatteryOptimizations(ctx.packageName) != true)
            put("notificationsAllowed", NotificationManagerCompat.from(ctx).areNotificationsEnabled())
            put("pending", runCatching { PositionQueue.get(ctx).count(config?.trackId) }.getOrDefault(0))
            put("lastFixAt", if (lastFix > 0) IsoTime.format(lastFix) else JSONObject.NULL)
            put("lastSentAt", if (lastSent > 0) IsoTime.format(lastSent) else JSONObject.NULL)
            put("lastError", TrackingStore.lastError(ctx) ?: JSONObject.NULL)
        }
    }
}
