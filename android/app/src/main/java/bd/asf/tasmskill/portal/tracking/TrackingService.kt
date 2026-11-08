package bd.asf.tasmskill.portal.tracking

import android.annotation.SuppressLint
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.BatteryManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority

/**
 * Location foreground service. Keeps running while the screen is locked; each fix is queued
 * locally and uploaded right away (see [Uploader]).
 */
class TrackingService : Service() {

    companion object {
        private const val TAG = "AsmTracking"

        @Volatile
        var running = false
            private set

        /** Start (or refresh) the service. Caller must hold location permission. */
        fun start(ctx: Context): Boolean = try {
            ContextCompat.startForegroundService(ctx, Intent(ctx, TrackingService::class.java))
            true
        } catch (e: Exception) {
            // e.g. ForegroundServiceStartNotAllowedException when started from the background.
            Log.w(TAG, "cannot start tracking service", e)
            false
        }

        fun stop(ctx: Context) {
            ctx.stopService(Intent(ctx, TrackingService::class.java))
        }
    }

    private val handler = Handler(Looper.getMainLooper())
    private lateinit var fused: FusedLocationProviderClient
    private var activeTrackId: String? = null
    private var activeInterval = 0
    private val expiryRunnable = Runnable { checkExpiry() }

    private val callback = object : LocationCallback() {
        override fun onLocationResult(result: LocationResult) {
            val config = TrackingStore.getConfig(this@TrackingService)
            if (config == null) {
                stopNow()
                return
            }
            if (config.isExpired()) {
                expire(config)
                return
            }
            Uploader.record(this@TrackingService, config.trackId, result.locations, batteryPercent())
        }
    }

    override fun onCreate() {
        super.onCreate()
        fused = LocationServices.getFusedLocationProviderClient(this)
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val config = TrackingStore.getConfig(this)

        // Enter the foreground first: startForegroundService() requires it within a few seconds.
        try {
            val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
            } else {
                0
            }
            ServiceCompat.startForeground(
                this, Notifications.ID_TRACKING, Notifications.tracking(this, config?.title), type
            )
        } catch (e: Exception) {
            Log.w(TAG, "startForeground failed", e)
            TrackingStore.setLastError(this, "foreground_service_blocked")
            if (config != null) Notifications.showResumePrompt(this)
            stopSelf()
            StatusBus.notifyChanged()
            return START_NOT_STICKY
        }

        if (config == null) {
            stopNow()
            return START_NOT_STICKY
        }
        if (config.isExpired()) {
            expire(config)
            return START_NOT_STICKY
        }
        if (!LocationPerms.hasForeground(this)) {
            // Keep the config: MainActivity resumes tracking once permission is granted again.
            TrackingStore.setLastError(this, "location_permission_missing")
            stopNow()
            return START_NOT_STICKY
        }

        running = true
        if (activeTrackId != config.trackId || activeInterval != config.intervalSeconds) {
            startUpdates(config)
        }
        scheduleExpiry(config)
        StatusBus.notifyChanged()
        Uploader.requestFlush(this)
        return START_STICKY
    }

    @SuppressLint("MissingPermission") // checked in onStartCommand via LocationPerms.hasForeground
    private fun startUpdates(config: TrackingConfig) {
        fused.removeLocationUpdates(callback)
        val intervalMs = config.intervalSeconds * 1000L
        val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, intervalMs)
            .setMinUpdateIntervalMillis(intervalMs / 2)
            .setWaitForAccurateLocation(false)
            .build()
        try {
            fused.requestLocationUpdates(request, callback, Looper.getMainLooper())
            activeTrackId = config.trackId
            activeInterval = config.intervalSeconds
        } catch (e: SecurityException) {
            TrackingStore.setLastError(this, "location_permission_missing")
            stopNow()
        }
    }

    private fun scheduleExpiry(config: TrackingConfig) {
        handler.removeCallbacks(expiryRunnable)
        val at = config.expiresAtMs ?: return
        handler.postDelayed(expiryRunnable, (at - System.currentTimeMillis()).coerceAtLeast(0L))
    }

    private fun checkExpiry() {
        val config = TrackingStore.getConfig(this) ?: return stopNow()
        if (config.isExpired()) expire(config) else scheduleExpiry(config)
    }

    private fun expire(config: TrackingConfig) {
        TrackingStore.clearConfig(this)
        TrackingStore.setLastError(this, "expired")
        Uploader.finalFlush(this, config)
        stopNow()
    }

    private fun stopNow() {
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private fun batteryPercent(): Int? {
        val bm = getSystemService(BatteryManager::class.java) ?: return null
        return bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY).takeIf { it in 0..100 }
    }

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        fused.removeLocationUpdates(callback)
        running = false
        activeTrackId = null
        StatusBus.notifyChanged()
        super.onDestroy()
    }
}
