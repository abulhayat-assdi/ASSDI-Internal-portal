package bd.asf.tasmskill.portal.tracking

import android.content.Context
import androidx.work.Worker
import androidx.work.WorkerParameters

/** Retries the upload when the network comes back (CONNECTED constraint, exponential backoff). */
class UploadWorker(ctx: Context, params: WorkerParameters) : Worker(ctx, params) {
    override fun doWork(): Result = when (Uploader.flushNow(applicationContext)) {
        Uploader.Outcome.RETRY -> Result.retry()
        else -> Result.success()
    }
}
