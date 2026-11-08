package bd.asf.tasmskill.portal

import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import org.json.JSONObject

/**
 * Pure trust rules (no Android dependencies, unit-tested on the JVM).
 *
 * Trusted:
 *  - https://<root> on port 443 exactly
 *  - https://<slug>.<root> on port 443 when <slug> is a single DNS label that is in the
 *    course list from GET /api/app/hosts and not a reserved label
 *  - the debug dev origin (scheme + host + port), when configured
 *
 * Student mini-sites share the <name>.<root> namespace, so an unlisted subdomain is never
 * trusted. It is reported as [Trust.UNLISTED_SUBDOMAIN] so callers can refetch the list once
 * (a course may be new) before deciding.
 *
 * URLs are parsed with OkHttp's browser-like parser, so backslashes and user-info resolve to
 * the same host a browser would use.
 */
class OriginPolicy(rootHost: String, devOrigin: String?) {

    enum class Trust { TRUSTED, UNLISTED_SUBDOMAIN, UNTRUSTED }

    private val root = rootHost.trim().lowercase()
    private val dev: HttpUrl? = devOrigin?.takeIf { it.isNotBlank() }?.toHttpUrlOrNull()

    fun classify(url: String?, slugs: Set<String>): Trust {
        if (url.isNullOrBlank()) return Trust.UNTRUSTED
        val parsed = url.trim().toHttpUrlOrNull() ?: return Trust.UNTRUSTED
        val host = parsed.host.lowercase()

        if (dev != null && parsed.scheme == dev.scheme && host == dev.host.lowercase() && parsed.port == dev.port) {
            return Trust.TRUSTED
        }
        val secure = parsed.scheme == "https" && parsed.port == 443
        if (host == root) return if (secure) Trust.TRUSTED else Trust.UNTRUSTED

        val label = subdomainLabel(host) ?: return Trust.UNTRUSTED
        if (!secure) return Trust.UNTRUSTED
        return if (label in slugs) Trust.TRUSTED else Trust.UNLISTED_SUBDOMAIN
    }

    fun isTrusted(url: String?, slugs: Set<String>): Boolean = classify(url, slugs) == Trust.TRUSTED

    /** The host of [url] when it is a candidate course subdomain (valid, non-reserved label). */
    fun subdomainLabelOf(url: String?): String? =
        url?.trim()?.toHttpUrlOrNull()?.host?.lowercase()?.let(::subdomainLabel)

    /** ingestUrl must be trusted and have exactly the path /api/tracking/ingest (no query). */
    fun isValidIngestUrl(url: String?, slugs: Set<String>): Boolean {
        if (!isTrusted(url, slugs)) return false
        val parsed = url!!.trim().toHttpUrlOrNull() ?: return false
        return parsed.encodedPath == INGEST_PATH && parsed.encodedQuery == null && parsed.fragment == null &&
            parsed.username.isEmpty() && parsed.password.isEmpty()
    }

    /** Origin rules for WebViewCompat.addDocumentStartJavaScript. */
    fun originRules(slugs: Set<String>): Set<String> {
        val rules = linkedSetOf("https://$root")
        slugs.filter { isValidSlug(it) }.forEach { rules += "https://$it.$root" }
        dev?.let { rules += "${it.scheme}://${it.host}:${it.port}" }
        return rules
    }

    private fun subdomainLabel(host: String): String? {
        if (!host.endsWith(".$root")) return null
        val label = host.removeSuffix(".$root")
        return label.takeIf { isValidSlug(it) }
    }

    /**
     * Parses `{"root":"...","courses":["slug"],"hosts":["slug.<root>"]}`.
     * Returns null when the response is malformed or for a different root.
     */
    fun parseHostsResponse(json: String): Set<String>? = try {
        val o = JSONObject(json)
        val respRoot = if (o.isNull("root")) "" else o.optString("root").trim().lowercase()
        if (respRoot.isNotEmpty() && respRoot != root) {
            null
        } else {
            val result = linkedSetOf<String>()
            o.optJSONArray("courses")?.let { arr ->
                for (i in 0 until arr.length()) {
                    val slug = arr.optString(i).trim().lowercase()
                    if (isValidSlug(slug)) result += slug
                }
            }
            o.optJSONArray("hosts")?.let { arr ->
                for (i in 0 until arr.length()) {
                    subdomainLabel(arr.optString(i).trim().lowercase())?.let { result += it }
                }
            }
            if (!o.has("courses") && !o.has("hosts")) null else result
        }
    } catch (e: Exception) {
        null
    }

    companion object {
        const val INGEST_PATH = "/api/tracking/ingest"
        val RESERVED_LABELS = setOf("www", "admin", "api", "mail", "ftp", "app", "portal")
        private val SLUG_RE = Regex("^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$")

        fun isValidSlug(label: String): Boolean =
            SLUG_RE.matches(label) && label !in RESERVED_LABELS && !label.startsWith("xn--")
    }
}
