package bd.asf.tasmskill.portal

import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull

/**
 * "Stay logged in" decisions (pure, unit-tested on the JVM).
 *
 * The app remembers the last course dashboard the user reached ({origin, area}) and, on a
 * cold start, opens it directly while the course host is still trusted and its `__session`
 * cookie still exists. A page on that origin without `__session` (logout or revoked session)
 * forgets it, so the next launch starts at the course picker again.
 */
object LaunchPolicy {

    const val SESSION_COOKIE = "__session"
    const val AREA_STUDENT = "student"
    const val AREA_STAFF = "staff"

    data class SavedSession(val origin: String, val area: String)

    data class LaunchDecision(val url: String, val clearSaved: Boolean, val resumed: Boolean)

    sealed class PageAction {
        data class Save(val session: SavedSession) : PageAction()
        object Clear : PageAction()
        object None : PageAction()
    }

    /** "student" for /student-dashboard[/...], "staff" for /dashboard[/...], else null. */
    fun areaForPath(path: String): String? = when {
        isUnder(path, "/student-dashboard") -> AREA_STUDENT
        isUnder(path, "/dashboard") -> AREA_STAFF
        else -> null
    }

    fun pathForArea(area: String): String? = when (area) {
        AREA_STUDENT -> "/student-dashboard"
        AREA_STAFF -> "/dashboard"
        else -> null
    }

    private fun isUnder(path: String, prefix: String) = path == prefix || path.startsWith("$prefix/")

    /** scheme://host[:port] with the port only when it is not the scheme default. */
    fun originOf(url: String?): String? = url?.trim()?.toHttpUrlOrNull()?.let(::originOf)

    private fun originOf(u: HttpUrl): String {
        val defaultPort = HttpUrl.defaultPort(u.scheme)
        return if (u.port == defaultPort) "${u.scheme}://${u.host}" else "${u.scheme}://${u.host}:${u.port}"
    }

    /**
     * True when a `Cookie`-style header ("a=1; b=2", as returned by CookieManager.getCookie)
     * contains `__session` with a non-empty value. Names must match exactly, so
     * `x__session=1` or `__session_old=1` do not count.
     */
    fun hasSessionCookie(cookieHeader: String?): Boolean {
        if (cookieHeader.isNullOrBlank()) return false
        return cookieHeader.split(';').any { part ->
            val eq = part.indexOf('=')
            if (eq < 0) return@any false
            val name = part.substring(0, eq).trim()
            val value = part.substring(eq + 1).trim().removeSurrounding("\"")
            name == SESSION_COOKIE && value.isNotEmpty()
        }
    }

    /** A dashboard page on a trusted course host (never the root host or other hosts). */
    fun observe(url: String?, policy: OriginPolicy, slugs: Set<String>): SavedSession? {
        val parsed = url?.trim()?.toHttpUrlOrNull() ?: return null
        if (policy.classify(url, slugs) != OriginPolicy.Trust.TRUSTED) return null
        if (policy.subdomainLabelOf(url) == null) return null // root host or dev origin
        val area = areaForPath(parsed.encodedPath) ?: return null
        return SavedSession(originOf(parsed), area)
    }

    /**
     * What to do after a main-frame page finished (or the SPA changed its URL).
     * [cookieHeaderForUrl] is CookieManager.getCookie(origin of [url]).
     * - Dashboard on a trusted course host with a session → Save
     * - Any page on the saved origin without a session → Clear (logout / revoked)
     * - Anything else (login pages, /app, root picker, other hosts) → None
     */
    fun onMainFramePage(
        url: String?,
        saved: SavedSession?,
        cookieHeaderForUrl: String?,
        policy: OriginPolicy,
        slugs: Set<String>,
    ): PageAction {
        val hasSession = hasSessionCookie(cookieHeaderForUrl)
        val observed = observe(url, policy, slugs)
        if (observed != null && hasSession) {
            return if (observed == saved) PageAction.None else PageAction.Save(observed)
        }
        if (saved != null && originOf(url) == saved.origin && !hasSession) return PageAction.Clear
        return PageAction.None
    }

    /**
     * Cold-start URL. [cookieHeaderForSaved] is CookieManager.getCookie(saved.origin).
     * The saved dashboard is used only while its origin is a trusted course host and the
     * session cookie is present; an origin that is no longer trusted is forgotten.
     */
    fun launchUrl(
        saved: SavedSession?,
        cookieHeaderForSaved: String?,
        policy: OriginPolicy,
        slugs: Set<String>,
        defaultUrl: String,
    ): LaunchDecision {
        if (saved == null) return LaunchDecision(defaultUrl, clearSaved = false, resumed = false)
        val path = pathForArea(saved.area)
        val trustedCourse = policy.classify(saved.origin, slugs) == OriginPolicy.Trust.TRUSTED &&
            policy.subdomainLabelOf(saved.origin) != null &&
            originOf(saved.origin) == saved.origin
        if (path == null || !trustedCourse) return LaunchDecision(defaultUrl, clearSaved = true, resumed = false)
        if (!hasSessionCookie(cookieHeaderForSaved)) return LaunchDecision(defaultUrl, clearSaved = false, resumed = false)
        return LaunchDecision(saved.origin + path, clearSaved = false, resumed = true)
    }
}
