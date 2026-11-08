package bd.asf.tasmskill.portal.update

import bd.asf.tasmskill.portal.OriginPolicy
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull

/** Pure update decisions (unit-tested on the JVM). */
object UpdatePolicy {

    enum class Decision { NONE, OPTIONAL, FORCED, SNOOZED }

    enum class Verify { OK, BAD_SIZE, BAD_SHA, UNREADABLE, WRONG_PACKAGE, OLD_VERSION }

    const val SNOOZE_MS = 24 * 60 * 60 * 1000L

    /**
     * - no newer version → NONE (also when minVersionCode is misconfigured above versionCode)
     * - current < minVersionCode → FORCED (cannot be snoozed)
     * - "Later" pressed for this versionCode less than 24 h ago → SNOOZED (unless the user
     *   asked explicitly, [ignoreSnooze])
     * - otherwise OPTIONAL
     */
    fun decide(
        info: UpdateInfo?,
        currentVersionCode: Int,
        snoozedVersionCode: Int,
        snoozedUntil: Long,
        now: Long,
        ignoreSnooze: Boolean = false,
    ): Decision {
        if (info == null || info.versionCode <= currentVersionCode) return Decision.NONE
        if (currentVersionCode < info.minVersionCode) return Decision.FORCED
        if (!ignoreSnooze && snoozedVersionCode == info.versionCode && now < snoozedUntil) return Decision.SNOOZED
        return Decision.OPTIONAL
    }

    /** The APK must come over https from the trusted root host or a listed course host. */
    fun isAcceptableApkUrl(url: String?, policy: OriginPolicy, slugs: Set<String>): Boolean {
        val parsed = url?.toHttpUrlOrNull() ?: return false
        return parsed.scheme == "https" && policy.isTrusted(url, slugs)
    }

    /** Checks a downloaded APK against the advertised release. */
    fun verify(
        info: UpdateInfo,
        actualSha256: String,
        actualSize: Long,
        archivePackage: String?,
        archiveVersionCode: Long?,
        ourPackage: String,
    ): Verify = when {
        info.size > 0 && actualSize != info.size -> Verify.BAD_SIZE
        !actualSha256.equals(info.sha256, ignoreCase = true) -> Verify.BAD_SHA
        archivePackage == null || archiveVersionCode == null -> Verify.UNREADABLE
        archivePackage != ourPackage -> Verify.WRONG_PACKAGE
        archiveVersionCode < info.versionCode -> Verify.OLD_VERSION
        else -> Verify.OK
    }
}
