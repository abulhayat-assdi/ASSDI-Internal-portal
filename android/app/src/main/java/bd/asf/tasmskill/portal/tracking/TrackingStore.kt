package bd.asf.tasmskill.portal.tracking

import android.annotation.SuppressLint
import android.content.Context
import android.content.SharedPreferences

/**
 * Persists the active tracking config and status fields in private SharedPreferences.
 * Backups are disabled for the whole app (see data_extraction_rules.xml).
 */
// commit() is deliberate for the config: the service and bridge read it right after writing.
@SuppressLint("ApplySharedPref")
object TrackingStore {
    private const val PREFS = "asm_tracking"
    private const val KEY_CONFIG = "config"
    private const val KEY_LAST_FIX = "last_fix_at"
    private const val KEY_LAST_SENT = "last_sent_at"
    private const val KEY_LAST_ERROR = "last_error"

    private fun prefs(ctx: Context): SharedPreferences =
        ctx.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun getConfig(ctx: Context): TrackingConfig? =
        prefs(ctx).getString(KEY_CONFIG, null)?.let { TrackingConfig.parse(it) }

    fun saveConfig(ctx: Context, config: TrackingConfig) {
        prefs(ctx).edit().putString(KEY_CONFIG, config.toJson()).commit()
    }

    fun clearConfig(ctx: Context) {
        prefs(ctx).edit().remove(KEY_CONFIG).commit()
    }

    fun lastFixAt(ctx: Context): Long = prefs(ctx).getLong(KEY_LAST_FIX, 0L)
    fun setLastFixAt(ctx: Context, ms: Long) = prefs(ctx).edit().putLong(KEY_LAST_FIX, ms).apply()

    fun lastSentAt(ctx: Context): Long = prefs(ctx).getLong(KEY_LAST_SENT, 0L)
    fun setLastSentAt(ctx: Context, ms: Long) = prefs(ctx).edit().putLong(KEY_LAST_SENT, ms).apply()

    fun lastError(ctx: Context): String? = prefs(ctx).getString(KEY_LAST_ERROR, null)
    fun setLastError(ctx: Context, error: String?) =
        prefs(ctx).edit().putString(KEY_LAST_ERROR, error).apply()

    /** Reset per-session status fields when a new track starts. */
    fun resetSession(ctx: Context) {
        prefs(ctx).edit()
            .remove(KEY_LAST_FIX)
            .remove(KEY_LAST_SENT)
            .remove(KEY_LAST_ERROR)
            .apply()
    }
}
