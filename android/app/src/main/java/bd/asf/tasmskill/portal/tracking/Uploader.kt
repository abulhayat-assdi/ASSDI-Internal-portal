package bd.asf.tasmskill.portal.tracking

import android.content.Context
import android.location.Location
import android.os.PowerManager
import android.util.Log
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import bd.asf.tasmskill.portal.BuildConfig
import bd.asf.tasmskill.portal.Origins
import bd.asf.tasmskill.portal.R
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/**
 * Uploads queued fixes to `POST <ingestUrl>` with `Authorization: Bearer <token>` and body
 * `{trackId, positions:[...]}` (max 500 per request).
 *
 * 200 → rows deleted. 410 → session over: stop service, clear config, notify the web.
 * 401 → lastError="unauthorized", stop. Network / 5xx → WorkManager retry with backoff.
 */
object Uploader {
    private const val TAG = "AsmUploader"
    private const val BATCH = 500
    private const val MAX_BATCHES_PER_FLUSH = 40
    private const val WORK_NAME = "asm-tracking-upload"

    enum class Outcome { IDLE, SENT, RETRY, STOPPED }

    private val executor = Executors.newSingleThreadExecutor()
    private val lock = Any()
    private val jsonType = "application/json; charset=utf-8".toMediaType()
    private val client: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .callTimeout(60, TimeUnit.SECONDS)
            .followRedirects(false)
            .build()
    }

    /** Store fixes in the queue, then try to upload. */
    fun record(ctx: Context, trackId: String, locations: List<Location>, battery: Int?) {
        val app = ctx.applicationContext
        executor.execute {
            try {
                val queue = PositionQueue.get(app)
                locations.forEach { queue.insert(trackId, it, battery) }
                if (locations.isNotEmpty()) TrackingStore.setLastFixAt(app, System.currentTimeMillis())
                StatusBus.notifyChanged()
                flushNow(app)
            } catch (e: Exception) {
                Log.e(TAG, "record failed", e)
            }
        }
    }

    fun requestFlush(ctx: Context) {
        val app = ctx.applicationContext
        executor.execute {
            try {
                flushNow(app)
            } catch (e: Exception) {
                Log.e(TAG, "flush failed", e)
            }
        }
    }

    /** Blocking flush; used by the executor and by [UploadWorker]. */
    fun flushNow(ctx: Context): Outcome = synchronized(lock) {
        withWakeLock(ctx) { flushLocked(ctx) }
    }

    /**
     * Called by stopTracking/expiry after the config was cleared: one last attempt to send what
     * is queued for this track, then the rows are discarded. The web revokes the token about
     * 1.5 s after stopTracking, so this runs immediately on its own thread instead of waiting
     * behind a possibly slow regular flush (duplicate sends are ignored by the server).
     */
    fun finalFlush(ctx: Context, config: TrackingConfig) {
        val app = ctx.applicationContext
        Thread({
            withWakeLock(app) {
                val queue = PositionQueue.get(app)
                try {
                    for (attempt in 0 until 5) {
                        val rows = queue.pending(config.trackId, BATCH)
                        if (rows.isEmpty()) break
                        if (post(config, rows) != 200) break
                        queue.delete(rows.map { it.id })
                        TrackingStore.setLastSentAt(app, System.currentTimeMillis())
                    }
                } catch (e: Exception) {
                    Log.w(TAG, "final flush failed", e)
                } finally {
                    // Unless the same track was restarted meanwhile, leftovers can never be sent.
                    if (TrackingStore.getConfig(app)?.trackId != config.trackId) {
                        queue.deleteTrack(config.trackId)
                    }
                    StatusBus.notifyChanged()
                }
            }
        }, "asm-final-flush").start()
    }

    private fun flushLocked(ctx: Context): Outcome {
        val config = TrackingStore.getConfig(ctx) ?: return Outcome.IDLE
        val queue = PositionQueue.get(ctx)
        queue.deleteOtherTracks(config.trackId)
        if (!Origins.isValidIngestUrlWithRefetch(ctx, config.ingestUrl)) {
            terminate(ctx, config, "untrusted_ingest_url", null)
            return Outcome.STOPPED
        }
        var sentAny = false
        repeat(MAX_BATCHES_PER_FLUSH) {
            val rows = queue.pending(config.trackId, BATCH)
            if (rows.isEmpty()) return if (sentAny) Outcome.SENT else Outcome.IDLE
            when (val code = post(config, rows)) {
                200 -> {
                    queue.delete(rows.map { it.id })
                    TrackingStore.setLastSentAt(ctx, System.currentTimeMillis())
                    TrackingStore.setLastError(ctx, null)
                    sentAny = true
                    StatusBus.notifyChanged()
                    if (rows.size < BATCH) return Outcome.SENT
                }
                410 -> {
                    terminate(ctx, config, "track_ended", R.string.tracking_stopped_text)
                    return Outcome.STOPPED
                }
                401 -> {
                    terminate(ctx, config, "unauthorized", R.string.tracking_unauthorized_text)
                    return Outcome.STOPPED
                }
                NETWORK_ERROR, 408, 429, in 500..599 -> {
                    TrackingStore.setLastError(ctx, if (code == NETWORK_ERROR) "network" else "http_$code")
                    StatusBus.notifyChanged()
                    scheduleRetry(ctx)
                    return Outcome.RETRY
                }
                else -> {
                    // Any other 4xx means this batch is rejected; drop it so the queue cannot jam.
                    Log.w(TAG, "batch rejected with HTTP $code, dropping ${rows.size} rows")
                    queue.delete(rows.map { it.id })
                    TrackingStore.setLastError(ctx, "http_$code")
                    StatusBus.notifyChanged()
                }
            }
        }
        return if (sentAny) Outcome.SENT else Outcome.IDLE
    }

    private const val NETWORK_ERROR = -1

    private fun post(config: TrackingConfig, rows: List<PositionQueue.Row>): Int {
        val positions = JSONArray().apply { rows.forEach { put(it.toJson()) } }
        val body = JSONObject()
            .put("trackId", config.trackId)
            .put("positions", positions)
            .toString()
        val request = Request.Builder()
            .url(config.ingestUrl)
            .header("Authorization", "Bearer ${config.token}")
            .header("User-Agent", "AsmPortalApp/${BuildConfig.VERSION_NAME} (Android)")
            .post(body.toRequestBody(jsonType))
            .build()
        return try {
            client.newCall(request).execute().use { it.code }
        } catch (e: IOException) {
            Log.i(TAG, "upload failed: ${e.message}")
            NETWORK_ERROR
        } catch (e: IllegalArgumentException) {
            NETWORK_ERROR
        }
    }

    /** End the session locally (410 / 401 / bad config). */
    private fun terminate(ctx: Context, config: TrackingConfig, reason: String, messageRes: Int?) {
        val current = TrackingStore.getConfig(ctx)
        if (current != null && current.token != config.token) {
            // The web replaced the token (e.g. via /api/tracking/resume) while this request was in
            // flight: the 401/410 belongs to the old token. Keep going with the new config.
            requestFlush(ctx)
            return
        }
        TrackingStore.setLastError(ctx, reason)
        if (current != null) TrackingStore.clearConfig(ctx)
        PositionQueue.get(ctx).deleteTrack(config.trackId)
        TrackingService.stop(ctx)
        WorkManager.getInstance(ctx).cancelUniqueWork(WORK_NAME)
        if (messageRes != null) {
            Notifications.showAlert(ctx, ctx.getString(R.string.tracking_stopped_title), ctx.getString(messageRes))
        }
        StatusBus.notifyChanged()
    }

    private fun scheduleRetry(ctx: Context) {
        val request = OneTimeWorkRequestBuilder<UploadWorker>()
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
            .build()
        WorkManager.getInstance(ctx).enqueueUniqueWork(WORK_NAME, ExistingWorkPolicy.KEEP, request)
    }

    private inline fun <T> withWakeLock(ctx: Context, block: () -> T): T {
        val pm = ctx.getSystemService(PowerManager::class.java)
        val wl = pm?.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "AsmPortal:upload")?.apply {
            setReferenceCounted(false)
            acquire(90_000L)
        }
        try {
            return block()
        } finally {
            if (wl?.isHeld == true) wl.release()
        }
    }
}
