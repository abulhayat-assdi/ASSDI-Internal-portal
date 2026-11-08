package bd.asf.tasmskill.portal.update

import bd.asf.tasmskill.portal.OriginPolicy
import bd.asf.tasmskill.portal.update.UpdatePolicy.Decision
import bd.asf.tasmskill.portal.update.UpdatePolicy.Verify
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class UpdatePolicyTest {

    private val base = "https://tasm-skill.asf.bd/api/app/version"
    private val sha = "a".repeat(64)
    private val now = 1_800_000_000_000L
    private val pkg = "bd.asf.tasmskill.portal"

    private fun info(versionCode: Int = 2, minVersionCode: Int = 1, size: Long = 1000) = UpdateInfo(
        versionCode = versionCode,
        versionName = "1.1.0",
        minVersionCode = minVersionCode,
        apkUrl = "https://tasm-skill.asf.bd/downloads/asm-portal.apk?v=$versionCode",
        sha256 = sha,
        size = size,
        notes = listOf("one"),
        publishedAt = null,
    )

    // ------------------------------------------------------------------ decide

    @Test
    fun noUpdateWhenNotNewer() {
        assertEquals(Decision.NONE, UpdatePolicy.decide(info(versionCode = 2), 2, 0, 0, now))
        assertEquals(Decision.NONE, UpdatePolicy.decide(info(versionCode = 1), 2, 0, 0, now))
        assertEquals(Decision.NONE, UpdatePolicy.decide(null, 2, 0, 0, now))
        // A misconfigured minimum above the published version never forces anything.
        assertEquals(Decision.NONE, UpdatePolicy.decide(info(versionCode = 2, minVersionCode = 5), 2, 0, 0, now))
    }

    @Test
    fun optionalUpdate() {
        assertEquals(Decision.OPTIONAL, UpdatePolicy.decide(info(versionCode = 3, minVersionCode = 1), 2, 0, 0, now))
        assertEquals(Decision.OPTIONAL, UpdatePolicy.decide(info(versionCode = 3, minVersionCode = 2), 2, 0, 0, now))
    }

    @Test
    fun forcedUpdateWhenBelowMinimum() {
        assertEquals(Decision.FORCED, UpdatePolicy.decide(info(versionCode = 3, minVersionCode = 3), 2, 0, 0, now))
        // Forced ignores the snooze.
        assertEquals(
            Decision.FORCED,
            UpdatePolicy.decide(info(versionCode = 3, minVersionCode = 3), 2, 3, now + UpdatePolicy.SNOOZE_MS, now),
        )
    }

    @Test
    fun snoozedFor24HoursPerVersion() {
        val until = now + UpdatePolicy.SNOOZE_MS
        assertEquals(Decision.SNOOZED, UpdatePolicy.decide(info(versionCode = 3), 2, 3, until, now))
        // Expired snooze.
        assertEquals(Decision.OPTIONAL, UpdatePolicy.decide(info(versionCode = 3), 2, 3, until, until))
        // Snooze was for another version: a newer release shows again.
        assertEquals(Decision.OPTIONAL, UpdatePolicy.decide(info(versionCode = 4), 2, 3, until, now))
        // Explicit check from the web ignores the snooze.
        assertEquals(Decision.OPTIONAL, UpdatePolicy.decide(info(versionCode = 3), 2, 3, until, now, ignoreSnooze = true))
    }

    // ------------------------------------------------------------------ verify

    @Test
    fun verifyAcceptsMatchingApk() {
        assertEquals(Verify.OK, UpdatePolicy.verify(info(), sha, 1000, pkg, 2, pkg))
        assertEquals(Verify.OK, UpdatePolicy.verify(info(), sha.uppercase(), 1000, pkg, 3, pkg))
    }

    @Test
    fun verifyRejectsBadSha() {
        assertEquals(Verify.BAD_SHA, UpdatePolicy.verify(info(), "b".repeat(64), 1000, pkg, 2, pkg))
    }

    @Test
    fun verifyRejectsSizePackageAndVersionMismatch() {
        assertEquals(Verify.BAD_SIZE, UpdatePolicy.verify(info(), sha, 999, pkg, 2, pkg))
        assertEquals(Verify.WRONG_PACKAGE, UpdatePolicy.verify(info(), sha, 1000, "com.evil.app", 2, pkg))
        assertEquals(Verify.OLD_VERSION, UpdatePolicy.verify(info(), sha, 1000, pkg, 1, pkg))
        assertEquals(Verify.UNREADABLE, UpdatePolicy.verify(info(), sha, 1000, null, null, pkg))
        // Unknown size (-1) skips only the size check.
        assertEquals(Verify.OK, UpdatePolicy.verify(info(size = -1), sha, 12345, pkg, 2, pkg))
    }

    // ------------------------------------------------------------------ apk url

    @Test
    fun apkUrlMustBeHttpsOnTrustedHost() {
        val release = OriginPolicy("tasm-skill.asf.bd", "")
        val debug = OriginPolicy("tasm-skill.asf.bd", "http://10.0.2.2:3000")
        val slugs = setOf("biz101")
        assertTrue(UpdatePolicy.isAcceptableApkUrl("https://tasm-skill.asf.bd/downloads/asm-portal.apk?v=2", release, slugs))
        assertTrue(UpdatePolicy.isAcceptableApkUrl("https://biz101.tasm-skill.asf.bd/downloads/asm-portal.apk", release, slugs))
        assertFalse(UpdatePolicy.isAcceptableApkUrl("https://student.tasm-skill.asf.bd/asm-portal.apk", release, slugs))
        assertFalse(UpdatePolicy.isAcceptableApkUrl("http://tasm-skill.asf.bd/downloads/asm-portal.apk", release, slugs))
        assertFalse(UpdatePolicy.isAcceptableApkUrl("https://tasm-skill.asf.bd.evil.com/asm-portal.apk", release, slugs))
        assertFalse(UpdatePolicy.isAcceptableApkUrl("https://evil.com/asm-portal.apk", release, slugs))
        assertFalse(UpdatePolicy.isAcceptableApkUrl(null, release, slugs))
        // The http dev origin is trusted for pages in debug, but never as an APK source.
        assertFalse(UpdatePolicy.isAcceptableApkUrl("http://10.0.2.2:3000/downloads/asm-portal.apk", debug, slugs))
    }

    // ------------------------------------------------------------------ parsing

    @Test
    fun parsesServerResponse() {
        val json = """
            {"versionCode":2,"versionName":"1.1.0","minVersionCode":1,
             "apkUrl":"https://tasm-skill.asf.bd/downloads/asm-portal.apk?v=2",
             "sha256":"${"AB".repeat(32)}","size":1213186,
             "notes":["অ্যাপের ভেতরে আপডেট-নোটিশ যোগ হয়েছে","second", ""],
             "publishedAt":"2026-11-08T10:00:00Z"}
        """.trimIndent()
        val info = UpdateInfo.parse(json, base)
        assertNotNull(info)
        info!!
        assertEquals(2, info.versionCode)
        assertEquals("1.1.0", info.versionName)
        assertEquals(1, info.minVersionCode)
        assertEquals("https://tasm-skill.asf.bd/downloads/asm-portal.apk?v=2", info.apkUrl)
        assertEquals("ab".repeat(32), info.sha256)
        assertEquals(1213186L, info.size)
        assertEquals(listOf("অ্যাপের ভেতরে আপডেট-নোটিশ যোগ হয়েছে", "second"), info.notes)
        assertEquals("2026-11-08T10:00:00Z", info.publishedAt)
    }

    @Test
    fun parsesManifestStyleWithRelativeApkAndDefaults() {
        val json = """{"versionCode":3,"versionName":"1.2.0","sha256":"$sha","apk":"/downloads/asm-portal.apk","publishedAt":null}"""
        val info = UpdateInfo.parse(json, base)!!
        assertEquals("https://tasm-skill.asf.bd/downloads/asm-portal.apk", info.apkUrl)
        assertEquals(0, info.minVersionCode)
        assertEquals(-1L, info.size)
        assertEquals(emptyList<String>(), info.notes)
        assertNull(info.publishedAt)
    }

    @Test
    fun rejectsMalformedResponses() {
        assertNull(UpdateInfo.parse("""{"error":"No release published."}""", base))
        assertNull(UpdateInfo.parse("not json", base))
        assertNull(UpdateInfo.parse(null, base))
        assertNull(UpdateInfo.parse("""{"versionCode":2,"versionName":"1.1.0","apkUrl":"https://x/y.apk","sha256":"zz"}""", base))
        assertNull(UpdateInfo.parse("""{"versionCode":0,"versionName":"1.1.0","apkUrl":"https://x/y.apk","sha256":"$sha"}""", base))
        assertNull(UpdateInfo.parse("""{"versionCode":2,"versionName":"","apkUrl":"https://x/y.apk","sha256":"$sha"}""", base))
        assertNull(UpdateInfo.parse("""{"versionCode":2,"versionName":"1.1.0","sha256":"$sha"}""", base))
    }
}
