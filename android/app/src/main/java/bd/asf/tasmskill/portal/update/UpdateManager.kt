package bd.asf.tasmskill.portal.update

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.util.Log
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.FileProvider
import androidx.core.content.pm.PackageInfoCompat
import bd.asf.tasmskill.portal.BuildConfig
import bd.asf.tasmskill.portal.Origins
import bd.asf.tasmskill.portal.R
import bd.asf.tasmskill.portal.TrustedHosts
import okhttp3.Call
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.IOException
import java.security.MessageDigest
import java.util.Locale
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/**
 * In-app update notice: polls GET /api/app/version, shows an optional or forced update
 * dialog, downloads the APK (with progress), verifies size + SHA-256 + package name +
 * versionCode, and hands it to the system installer. It never touches the tracking service;
 * after the update, BootReceiver (MY_PACKAGE_REPLACED) and MainActivity.onResume resume it.
 *
 * Must be constructed while the activity is being created (registers a result launcher).
 */
class UpdateManager(private val activity: AppCompatActivity) {

    private val main = Handler(Looper.getMainLooper())
    private val io = Executors.newSingleThreadExecutor()
    // Lazy: the activity has no context yet while it is being constructed.
    private val prefs by lazy {
        activity.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    }

    private val client: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(10, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .followSslRedirects(false) // never follow an https → http redirect
            .build()
    }

    @Volatile
    private var lastCheckAt = 0L
    private var checking = false
    private var downloading = false
    private var dialog: AlertDialog? = null
    private var progressDialog: AlertDialog? = null
    private var currentCall: Call? = null

    /** Set while a forced update is outstanding; re-shown whenever the activity resumes. */
    private var forcedInfo: UpdateInfo? = null
    private var pendingInstall: Triple<File, UpdateInfo, Boolean>? = null

    private val unknownSourcesLauncher =
        activity.registerForActivityResult(ActivityResultContracts.StartActivityForResult()) {
            onReturnFromUnknownSources()
        }

    // ------------------------------------------------------------------ checking

    /** Called from onResume: checks at most once per 30 minutes; re-shows a forced dialog. */
    fun onResume() {
        val forced = forcedInfo
        if (forced != null && !downloading && pendingInstall == null && dialog?.isShowing != true) {
            showUpdateDialog(forced, forced = true)
        }
        if (System.currentTimeMillis() - lastCheckAt >= RESUME_THROTTLE_MS) check(userInitiated = false)
    }

    /** [userInitiated] (bridge `checkForUpdate()`) ignores the snooze and reports "up to date". */
    fun check(userInitiated: Boolean) {
        if (checking || downloading) return
        checking = true
        lastCheckAt = System.currentTimeMillis()
        io.execute {
            val info = fetch()
            main.post {
                checking = false
                if (activity.isFinishing || activity.isDestroyed) return@post
                handle(info, userInitiated)
            }
        }
    }

    private fun fetch(): UpdateInfo? = try {
        val request = Request.Builder()
            .url(BuildConfig.VERSION_URL)
            .header("Accept", "application/json")
            .header("Cache-Control", "no-cache")
            .header("User-Agent", "AsmPortalApp/${BuildConfig.VERSION_NAME} (Android)")
            .get()
            .build()
        client.newCall(request).execute().use { resp ->
            if (resp.code != 200) null else UpdateInfo.parse(resp.body?.string(), BuildConfig.VERSION_URL)
        }
    } catch (e: Exception) {
        Log.i(TAG, "version check failed: ${e.message}") // silent by design
        null
    }

    private fun handle(info: UpdateInfo?, userInitiated: Boolean) {
        val decision = UpdatePolicy.decide(
            info,
            BuildConfig.VERSION_CODE,
            prefs.getInt(KEY_SNOOZE_CODE, 0),
            prefs.getLong(KEY_SNOOZE_UNTIL, 0L),
            System.currentTimeMillis(),
            ignoreSnooze = userInitiated,
        )
        if (decision == UpdatePolicy.Decision.NONE || decision == UpdatePolicy.Decision.SNOOZED) {
            io.execute { cleanupApks(keep = null) }
        }
        when (decision) {
            UpdatePolicy.Decision.FORCED -> {
                forcedInfo = info
                showUpdateDialog(info!!, forced = true)
            }
            UpdatePolicy.Decision.OPTIONAL -> {
                forcedInfo = null
                showUpdateDialog(info!!, forced = false)
            }
            UpdatePolicy.Decision.NONE -> {
                forcedInfo = null
                if (userInitiated && info != null) toast(R.string.update_latest)
            }
            UpdatePolicy.Decision.SNOOZED -> Unit
        }
    }

    // ------------------------------------------------------------------ dialogs

    private fun showUpdateDialog(info: UpdateInfo, forced: Boolean) {
        if (activity.isFinishing || activity.isDestroyed) return
        dialog?.dismiss()
        val message = buildString {
            if (forced) append(activity.getString(R.string.update_required)).append("\n\n")
            info.notes.forEach { append("• ").append(it).append('\n') }
            if (info.size > 0) {
                if (info.notes.isNotEmpty()) append('\n')
                append(activity.getString(R.string.update_size, formatSize(info.size)))
            }
        }.trim()
        val builder = AlertDialog.Builder(activity)
            .setTitle(activity.getString(R.string.update_title, info.versionName))
            .setCancelable(!forced)
            .setPositiveButton(R.string.update_now) { _, _ -> startUpdate(info, forced) }
        if (message.isNotEmpty()) builder.setMessage(message)
        if (forced) {
            builder.setNegativeButton(R.string.update_close_app) { _, _ -> activity.finishAffinity() }
        } else {
            builder.setNegativeButton(R.string.update_later) { _, _ -> snooze(info.versionCode) }
        }
        dialog = builder.show()
    }

    private fun showError(messageRes: Int, info: UpdateInfo, forced: Boolean) {
        if (activity.isFinishing || activity.isDestroyed) return
        dialog?.dismiss()
        dialog = AlertDialog.Builder(activity)
            .setTitle(R.string.update_error_title)
            .setMessage(messageRes)
            .setCancelable(!forced)
            .setPositiveButton(R.string.ok) { _, _ -> if (forced) showUpdateDialog(info, forced = true) }
            .show()
    }

    private fun snooze(versionCode: Int) {
        prefs.edit()
            .putInt(KEY_SNOOZE_CODE, versionCode)
            .putLong(KEY_SNOOZE_UNTIL, System.currentTimeMillis() + UpdatePolicy.SNOOZE_MS)
            .apply()
    }

    // ------------------------------------------------------------------ download + verify

    private fun startUpdate(info: UpdateInfo, forced: Boolean) {
        if (!UpdatePolicy.isAcceptableApkUrl(info.apkUrl, Origins.policy, TrustedHosts.current())) {
            showError(R.string.update_error_source, info, forced)
            return
        }
        if (downloading) return
        downloading = true

        val bar = ProgressBar(activity, null, android.R.attr.progressBarStyleHorizontal).apply {
            isIndeterminate = info.size <= 0
            max = 100
        }
        val label = TextView(activity).apply { text = activity.getString(R.string.update_downloading) }
        val pad = (20 * activity.resources.displayMetrics.density).toInt()
        val content = LinearLayout(activity).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(pad, pad, pad, pad / 2)
            addView(label)
            addView(bar, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        }
        progressDialog = AlertDialog.Builder(activity)
            .setTitle(activity.getString(R.string.update_title, info.versionName))
            .setView(content)
            .setCancelable(false)
            .setNegativeButton(R.string.update_cancel) { _, _ -> currentCall?.cancel() }
            .show()

        io.execute {
            val outcome = download(info) { done, total ->
                main.post {
                    if (total > 0) {
                        bar.isIndeterminate = false
                        bar.progress = ((done * 100) / total).toInt()
                        label.text = activity.getString(R.string.update_downloading) +
                            "\n" + formatSize(done) + " / " + formatSize(total)
                    }
                }
            }
            main.post {
                downloading = false
                progressDialog?.dismiss()
                progressDialog = null
                if (activity.isFinishing || activity.isDestroyed) return@post
                when (outcome) {
                    is Outcome.Ready -> install(outcome.file, info, forced)
                    Outcome.Cancelled -> if (forced) showUpdateDialog(info, forced = true)
                    Outcome.Failed -> showError(R.string.update_error_download, info, forced)
                    Outcome.Invalid -> showError(R.string.update_error_verify, info, forced)
                }
            }
        }
    }

    private sealed class Outcome {
        class Ready(val file: File) : Outcome()
        object Cancelled : Outcome()
        object Failed : Outcome()
        object Invalid : Outcome()
    }

    private fun download(info: UpdateInfo, progress: (Long, Long) -> Unit): Outcome {
        val dir = updatesDir()
        val name = "asm-portal-${info.versionCode}.apk"
        cleanupApks(keep = null)
        val part = File(dir, "$name.part")
        val file = File(dir, name)
        val digest = MessageDigest.getInstance("SHA-256")
        var written = 0L
        try {
            val call = client.newCall(Request.Builder().url(info.apkUrl).get().build())
            currentCall = call
            call.execute().use { resp ->
                // A redirect may only land on a trusted https host.
                if (!UpdatePolicy.isAcceptableApkUrl(resp.request.url.toString(), Origins.policy, TrustedHosts.current())) {
                    return Outcome.Invalid
                }
                if (!resp.isSuccessful) return Outcome.Failed
                val body = resp.body ?: return Outcome.Failed
                val total = if (info.size > 0) info.size else body.contentLength()
                var lastReport = 0L
                body.byteStream().use { input ->
                    part.outputStream().use { output ->
                        val buf = ByteArray(64 * 1024)
                        while (true) {
                            val n = input.read(buf)
                            if (n < 0) break
                            output.write(buf, 0, n)
                            digest.update(buf, 0, n)
                            written += n
                            if (info.size > 0 && written > info.size) return Outcome.Invalid
                            val now = System.currentTimeMillis()
                            if (now - lastReport > 200) {
                                lastReport = now
                                progress(written, total)
                            }
                        }
                    }
                }
                progress(written, total)
            }
        } catch (e: IOException) {
            part.delete()
            return if (currentCall?.isCanceled() == true) Outcome.Cancelled else Outcome.Failed
        } finally {
            currentCall = null
        }

        file.delete()
        if (!part.renameTo(file)) {
            part.delete()
            return Outcome.Failed
        }
        val sha = digest.digest().joinToString("") { "%02x".format(it) }
        @Suppress("DEPRECATION")
        val archive = runCatching { activity.packageManager.getPackageArchiveInfo(file.path, 0) }.getOrNull()
        val result = UpdatePolicy.verify(
            info = info,
            actualSha256 = sha,
            actualSize = written,
            archivePackage = archive?.packageName,
            archiveVersionCode = archive?.let { PackageInfoCompat.getLongVersionCode(it) },
            ourPackage = activity.packageName,
        )
        if (result != UpdatePolicy.Verify.OK) {
            Log.w(TAG, "update rejected: $result")
            file.delete()
            return Outcome.Invalid
        }
        return Outcome.Ready(file)
    }

    // ------------------------------------------------------------------ install

    private fun install(file: File, info: UpdateInfo, forced: Boolean) {
        if (!activity.packageManager.canRequestPackageInstalls()) {
            pendingInstall = Triple(file, info, forced)
            dialog?.dismiss()
            dialog = AlertDialog.Builder(activity)
                .setTitle(R.string.update_unknown_sources_title)
                .setMessage(R.string.update_unknown_sources_msg)
                .setCancelable(false)
                .setPositiveButton(R.string.update_open_settings) { _, _ ->
                    try {
                        unknownSourcesLauncher.launch(
                            Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${activity.packageName}"))
                        )
                    } catch (e: ActivityNotFoundException) {
                        pendingInstall = null
                        showError(R.string.update_error_install, info, forced)
                    }
                }
                .setNegativeButton(R.string.update_cancel) { _, _ ->
                    pendingInstall = null
                    if (forced) showUpdateDialog(info, forced = true)
                }
                .show()
            return
        }
        val uri = FileProvider.getUriForFile(activity, "${activity.packageName}.fileprovider", file)
        val intent = Intent(Intent.ACTION_VIEW)
            .setDataAndType(uri, APK_MIME)
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        try {
            activity.startActivity(intent)
        } catch (e: Exception) {
            showError(R.string.update_error_install, info, forced)
        }
    }

    private fun onReturnFromUnknownSources() {
        val (file, info, forced) = pendingInstall ?: return
        pendingInstall = null
        if (activity.packageManager.canRequestPackageInstalls() && file.exists()) {
            install(file, info, forced)
        } else if (forced) {
            showUpdateDialog(info, forced = true)
        }
    }

    // ------------------------------------------------------------------ housekeeping

    private fun updatesDir(): File =
        File(activity.getExternalFilesDir(null) ?: activity.filesDir, UPDATES_DIR).apply { mkdirs() }

    /** Delete downloaded APKs (and partial downloads) other than [keep]. */
    private fun cleanupApks(keep: String?) {
        runCatching {
            updatesDir().listFiles()?.forEach { if (it.name != keep) it.delete() }
            // Older location fallback (no external storage at download time).
            File(activity.filesDir, UPDATES_DIR).listFiles()?.forEach { if (it.name != keep) it.delete() }
        }
    }

    fun dispose() {
        currentCall?.cancel()
        dialog?.dismiss()
        progressDialog?.dismiss()
        io.shutdown()
    }

    private fun toast(res: Int) = Toast.makeText(activity, res, Toast.LENGTH_SHORT).show()

    private fun formatSize(bytes: Long): String =
        String.format(Locale.US, "%.1f MB", bytes / (1024.0 * 1024.0))

    companion object {
        private const val TAG = "AsmUpdate"
        private const val PREFS = "asm_update"
        private const val KEY_SNOOZE_CODE = "snooze_version_code"
        private const val KEY_SNOOZE_UNTIL = "snooze_until"
        private const val RESUME_THROTTLE_MS = 30 * 60 * 1000L
        private const val UPDATES_DIR = "updates"
        private const val APK_MIME = "application/vnd.android.package-archive"
    }
}
