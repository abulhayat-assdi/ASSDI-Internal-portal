package bd.asf.tasmskill.portal.tracking

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Resumes an unexpired session after a reboot or an app update. BOOT_COMPLETED and
 * MY_PACKAGE_REPLACED are exempt from the Android 12+ background FGS-start limits, but a
 * location FGS started from the background still needs "Allow all the time". Without it we
 * post a "tap to resume" notification instead; MainActivity resumes on open.
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED &&
            intent.action != Intent.ACTION_MY_PACKAGE_REPLACED
        ) return

        val config = TrackingStore.getConfig(context) ?: return
        if (config.isExpired()) {
            TrackingStore.clearConfig(context)
            TrackingStore.setLastError(context, "expired")
            PositionQueue.get(context).deleteTrack(config.trackId)
            return
        }
        if (!LocationPerms.hasForeground(context)) {
            TrackingStore.setLastError(context, "location_permission_missing")
            return
        }
        val started = LocationPerms.hasBackground(context) && TrackingService.start(context)
        if (!started) Notifications.showResumePrompt(context)
    }
}
