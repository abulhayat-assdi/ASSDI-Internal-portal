package bd.asf.tasmskill.portal

import android.content.Context
import bd.asf.tasmskill.portal.LaunchPolicy.SavedSession

/** Stores the last dashboard ({origin, area}) in private prefs. The cookie itself stays in WebView. */
object SessionMemory {
    private const val PREFS = "asm_session"
    private const val KEY_ORIGIN = "origin"
    private const val KEY_AREA = "area"

    private fun prefs(ctx: Context) = ctx.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun get(ctx: Context): SavedSession? {
        val p = prefs(ctx)
        val origin = p.getString(KEY_ORIGIN, null) ?: return null
        val area = p.getString(KEY_AREA, null) ?: return null
        return SavedSession(origin, area)
    }

    fun save(ctx: Context, session: SavedSession) {
        prefs(ctx).edit().putString(KEY_ORIGIN, session.origin).putString(KEY_AREA, session.area).apply()
    }

    fun clear(ctx: Context) {
        prefs(ctx).edit().clear().apply()
    }
}
