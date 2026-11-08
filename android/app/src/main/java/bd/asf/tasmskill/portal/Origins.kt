package bd.asf.tasmskill.portal

import android.content.Context
import bd.asf.tasmskill.portal.OriginPolicy.Trust

/**
 * App-wide trust checks: [OriginPolicy] rules applied to the current course list from
 * [TrustedHosts]. Used for WebView navigation, the JS bridge, web geolocation and the
 * tracking ingestUrl.
 */
object Origins {
    val policy = OriginPolicy(BuildConfig.TRUSTED_ROOT_HOST, BuildConfig.DEV_ORIGIN)

    fun classify(url: String?): Trust = policy.classify(url, TrustedHosts.current())

    fun isTrusted(url: String?): Boolean = classify(url) == Trust.TRUSTED

    /**
     * Like [classify], but an unlisted course subdomain triggers one (rate-limited) refetch of
     * the host list before deciding. Blocking: never call on the main thread.
     */
    fun classifyWithRefetch(ctx: Context, url: String?): Trust {
        val first = classify(url)
        if (first != Trust.UNLISTED_SUBDOMAIN) return first
        val label = policy.subdomainLabelOf(url) ?: return first
        TrustedHosts.refetchForLabel(ctx, label)
        return classify(url)
    }

    fun isValidIngestUrl(url: String?): Boolean = policy.isValidIngestUrl(url, TrustedHosts.current())

    /** Blocking: refetches the host list once if the ingest host is an unlisted course. */
    fun isValidIngestUrlWithRefetch(ctx: Context, url: String?): Boolean {
        if (isValidIngestUrl(url)) return true
        if (classifyWithRefetch(ctx, url) != Trust.TRUSTED) return false
        return isValidIngestUrl(url)
    }

    fun originRules(): Set<String> = policy.originRules(TrustedHosts.current())
}
