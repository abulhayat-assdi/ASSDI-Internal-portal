package bd.asf.tasmskill.portal

import android.Manifest
import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.os.SystemClock
import android.provider.Settings
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import bd.asf.tasmskill.portal.tracking.LocationPerms
import bd.asf.tasmskill.portal.tracking.StatusBus

/**
 * Sequential permission flow:
 * fine/coarse location → background "Allow all the time" (Android 10+, explained first)
 * → POST_NOTIFICATIONS (13+) → battery-optimization exemption.
 *
 * Must be constructed while the activity is being created (it registers result launchers).
 */
class PermissionFlow(private val activity: AppCompatActivity) {

    private var running = false
    private var foregroundResult: Boolean? = null
    private val foregroundCallbacks = mutableListOf<(Boolean) -> Unit>()
    private val doneCallbacks = mutableListOf<() -> Unit>()
    private var backgroundRequestedAt = 0L

    private val foregroundLauncher =
        activity.registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
            val granted = LocationPerms.hasForeground(activity)
            resolveForeground(granted)
            if (granted) stepBackground() else finish()
        }

    private val backgroundLauncher =
        activity.registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            val instant = SystemClock.elapsedRealtime() - backgroundRequestedAt < 600
            if (!granted && instant) {
                // The system refused without showing anything (denied before): open settings.
                openSettings()
            } else {
                stepNotifications()
            }
        }

    private val settingsLauncher =
        activity.registerForActivityResult(ActivityResultContracts.StartActivityForResult()) {
            stepNotifications()
        }

    private val notificationLauncher =
        activity.registerForActivityResult(ActivityResultContracts.RequestPermission()) {
            stepBattery()
        }

    private val batteryLauncher =
        activity.registerForActivityResult(ActivityResultContracts.StartActivityForResult()) {
            finish()
        }

    /**
     * Run the flow. [onForeground] fires once fine/coarse location is resolved (granted or not);
     * [onDone] fires at the end. Calls while a flow is running join the running flow.
     */
    fun run(onForeground: ((Boolean) -> Unit)? = null, onDone: (() -> Unit)? = null) {
        if (onForeground != null) {
            val known = foregroundResult
            if (running && known != null) onForeground(known) else foregroundCallbacks += onForeground
        }
        if (onDone != null) doneCallbacks += onDone
        if (running) return
        running = true
        foregroundResult = null
        stepForeground()
    }

    private fun stepForeground() {
        if (LocationPerms.hasForeground(activity)) {
            resolveForeground(true)
            stepBackground()
        } else {
            foregroundLauncher.launch(
                arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)
            )
        }
    }

    private fun stepBackground() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q || LocationPerms.hasBackground(activity)) {
            stepNotifications()
            return
        }
        if (activity.isFinishing || activity.isDestroyed) {
            finish()
            return
        }
        AlertDialog.Builder(activity)
            .setTitle(R.string.bg_title)
            .setMessage(R.string.bg_message)
            .setCancelable(false)
            .setPositiveButton(R.string.bg_allow) { _, _ -> requestBackground() }
            .setNegativeButton(R.string.not_now) { _, _ -> stepNotifications() }
            .show()
    }

    private fun requestBackground() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            stepNotifications()
            return
        }
        // Android 10 shows a dialog; Android 11+ opens the app's location-permission page.
        backgroundRequestedAt = SystemClock.elapsedRealtime()
        backgroundLauncher.launch(Manifest.permission.ACCESS_BACKGROUND_LOCATION)
    }

    private fun openSettings() {
        try {
            settingsLauncher.launch(LocationPerms.appDetailsIntent(activity).apply {
                flags = 0 // must stay in our task so the result comes back
            })
        } catch (e: ActivityNotFoundException) {
            stepNotifications()
        }
    }

    private fun stepNotifications() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            !LocationPerms.hasNotificationPermission(activity)
        ) {
            notificationLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
        } else {
            stepBattery()
        }
    }

    @SuppressLint("BatteryLife") // sideloaded field-tracking app: the exemption is essential
    private fun stepBattery() {
        val pm = activity.getSystemService(PowerManager::class.java)
        if (pm == null || pm.isIgnoringBatteryOptimizations(activity.packageName)) {
            finish()
            return
        }
        val request = Intent(
            Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
            Uri.parse("package:${activity.packageName}")
        )
        try {
            batteryLauncher.launch(request)
        } catch (e: ActivityNotFoundException) {
            try {
                batteryLauncher.launch(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
            } catch (e2: ActivityNotFoundException) {
                finish()
            }
        }
    }

    private fun resolveForeground(granted: Boolean) {
        foregroundResult = granted
        val callbacks = foregroundCallbacks.toList()
        foregroundCallbacks.clear()
        callbacks.forEach { it(granted) }
    }

    private fun finish() {
        if (foregroundResult == null) resolveForeground(LocationPerms.hasForeground(activity))
        running = false
        val callbacks = doneCallbacks.toList()
        doneCallbacks.clear()
        callbacks.forEach { it() }
        StatusBus.notifyChanged()
    }
}
