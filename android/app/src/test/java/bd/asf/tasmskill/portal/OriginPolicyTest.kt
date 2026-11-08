package bd.asf.tasmskill.portal

import bd.asf.tasmskill.portal.OriginPolicy.Trust
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class OriginPolicyTest {

    private val root = "tasm-skill.asf.bd"
    private val release = OriginPolicy(root, "")
    private val debug = OriginPolicy(root, "http://10.0.2.2:3000")
    private val slugs = setOf("biz101", "typing-2026")

    private fun trust(url: String?, policy: OriginPolicy = release) = policy.classify(url, slugs)

    @Test
    fun rootHostIsTrusted() {
        assertEquals(Trust.TRUSTED, trust("https://tasm-skill.asf.bd"))
        assertEquals(Trust.TRUSTED, trust("https://tasm-skill.asf.bd/"))
        assertEquals(Trust.TRUSTED, trust("https://TASM-SKILL.ASF.BD/courses?x=1"))
        assertEquals(Trust.TRUSTED, trust("https://tasm-skill.asf.bd:443/login"))
    }

    @Test
    fun listedCourseIsTrusted() {
        assertEquals(Trust.TRUSTED, trust("https://biz101.tasm-skill.asf.bd/student"))
        assertEquals(Trust.TRUSTED, trust("https://typing-2026.tasm-skill.asf.bd"))
        assertEquals(Trust.TRUSTED, trust("https://BIZ101.tasm-skill.asf.bd/"))
    }

    @Test
    fun unlistedSubdomainIsNotTrusted() {
        assertEquals(Trust.UNLISTED_SUBDOMAIN, trust("https://evilstudent.tasm-skill.asf.bd/"))
        assertEquals(Trust.UNLISTED_SUBDOMAIN, trust("https://biz102.tasm-skill.asf.bd/"))
        // Becomes trusted once the refreshed list contains it.
        assertEquals(Trust.TRUSTED, release.classify("https://biz102.tasm-skill.asf.bd/", slugs + "biz102"))
    }

    @Test
    fun multiLevelSubdomainIsUntrusted() {
        assertEquals(Trust.UNTRUSTED, trust("https://x.biz101.tasm-skill.asf.bd/"))
        assertEquals(Trust.UNTRUSTED, trust("https://a.b.tasm-skill.asf.bd/"))
    }

    @Test
    fun reservedLabelsAreNeverTrustedEvenIfListed() {
        val withReserved = slugs + OriginPolicy.RESERVED_LABELS
        for (label in OriginPolicy.RESERVED_LABELS) {
            assertEquals(label, Trust.UNTRUSTED, release.classify("https://$label.tasm-skill.asf.bd/", withReserved))
        }
        val parsed = release.parseHostsResponse(
            """{"root":"tasm-skill.asf.bd","courses":["www","api","biz101"],"hosts":["admin.tasm-skill.asf.bd","app.tasm-skill.asf.bd"]}"""
        )
        assertEquals(setOf("biz101"), parsed)
    }

    @Test
    fun userInfoAndBackslashTricksResolveToTheRealHost() {
        assertEquals(Trust.UNTRUSTED, trust("https://tasm-skill.asf.bd@evil.com/"))
        assertEquals(Trust.UNTRUSTED, trust("https://biz101.tasm-skill.asf.bd:pw@evil.com/"))
        assertEquals(Trust.UNTRUSTED, trust("https://evil.com\\@tasm-skill.asf.bd/"))
        assertEquals(Trust.UNTRUSTED, trust("https://evil.com\\.tasm-skill.asf.bd/"))
        assertEquals(Trust.UNTRUSTED, trust("https://evil.com#@tasm-skill.asf.bd"))
        assertEquals(Trust.UNTRUSTED, trust("https://evil.com?@tasm-skill.asf.bd"))
        // User-info in front of a trusted host still resolves to the trusted host.
        assertEquals(Trust.TRUSTED, trust("https://someone@tasm-skill.asf.bd/"))
    }

    @Test
    fun httpSchemeIsUntrusted() {
        assertEquals(Trust.UNTRUSTED, trust("http://tasm-skill.asf.bd/"))
        assertEquals(Trust.UNTRUSTED, trust("http://biz101.tasm-skill.asf.bd/"))
        assertEquals(Trust.UNTRUSTED, trust("http://evilstudent.tasm-skill.asf.bd/"))
    }

    @Test
    fun nonDefaultPortIsUntrusted() {
        assertEquals(Trust.UNTRUSTED, trust("https://tasm-skill.asf.bd:8443/"))
        assertEquals(Trust.UNTRUSTED, trust("https://biz101.tasm-skill.asf.bd:444/"))
    }

    @Test
    fun lookalikeDomainsAreUntrusted() {
        assertEquals(Trust.UNTRUSTED, trust("https://tasm-skill.asf.bd.evil.com/"))
        assertEquals(Trust.UNTRUSTED, trust("https://biz101.tasm-skill.asf.bd.evil.com/"))
        assertEquals(Trust.UNTRUSTED, trust("https://eviltasm-skill.asf.bd/"))
        assertEquals(Trust.UNTRUSTED, trust("https://tasm-skill-asf.bd/"))
        assertEquals(Trust.UNTRUSTED, trust("https://asf.bd/"))
    }

    @Test
    fun otherSchemesAndGarbageAreUntrusted() {
        assertEquals(Trust.UNTRUSTED, trust(null))
        assertEquals(Trust.UNTRUSTED, trust(""))
        assertEquals(Trust.UNTRUSTED, trust("javascript:alert(1)"))
        assertEquals(Trust.UNTRUSTED, trust("file:///sdcard/x.html"))
        assertEquals(Trust.UNTRUSTED, trust("intent://tasm-skill.asf.bd#Intent;end"))
        assertEquals(Trust.UNTRUSTED, trust("data:text/html,hi"))
    }

    @Test
    fun devOriginOnlyInDebugAndExactlyMatching() {
        assertEquals(Trust.UNTRUSTED, trust("http://10.0.2.2:3000/", release))
        assertEquals(Trust.TRUSTED, trust("http://10.0.2.2:3000/", debug))
        assertEquals(Trust.UNTRUSTED, trust("http://10.0.2.2:3001/", debug))
        assertEquals(Trust.UNTRUSTED, trust("https://10.0.2.2:3000/", debug))
        assertEquals(Trust.TRUSTED, trust("https://biz101.tasm-skill.asf.bd/", debug))
    }

    @Test
    fun ingestUrlNeedsTrustedHostAndExactPath() {
        assertTrue(release.isValidIngestUrl("https://biz101.tasm-skill.asf.bd/api/tracking/ingest", slugs))
        assertTrue(release.isValidIngestUrl("https://tasm-skill.asf.bd/api/tracking/ingest", slugs))
        assertFalse(release.isValidIngestUrl("https://evilstudent.tasm-skill.asf.bd/api/tracking/ingest", slugs))
        assertFalse(release.isValidIngestUrl("https://biz101.tasm-skill.asf.bd/api/tracking/ingest/", slugs))
        assertFalse(release.isValidIngestUrl("https://biz101.tasm-skill.asf.bd/api/tracking/ingest?x=1", slugs))
        assertFalse(release.isValidIngestUrl("https://biz101.tasm-skill.asf.bd/evil/api/tracking/ingest", slugs))
        assertFalse(release.isValidIngestUrl("https://biz101.tasm-skill.asf.bd/api/tracking/../tracking/ingest2", slugs))
        assertFalse(release.isValidIngestUrl("http://biz101.tasm-skill.asf.bd/api/tracking/ingest", slugs))
        assertFalse(release.isValidIngestUrl("https://tasm-skill.asf.bd.evil.com/api/tracking/ingest", slugs))
        assertTrue(debug.isValidIngestUrl("http://10.0.2.2:3000/api/tracking/ingest", slugs))
    }

    @Test
    fun hostsResponseParsing() {
        val parsed = release.parseHostsResponse(
            """{"root":"tasm-skill.asf.bd","courses":["Biz101","bad slug","-x"],"hosts":["typing-2026.tasm-skill.asf.bd","x.y.tasm-skill.asf.bd","other.example.com"]}"""
        )
        assertEquals(setOf("biz101", "typing-2026"), parsed)
        assertNull(release.parseHostsResponse("""{"root":"evil.com","courses":["biz101"]}"""))
        assertNull(release.parseHostsResponse("not json"))
        assertNull(release.parseHostsResponse("""{"root":"tasm-skill.asf.bd"}"""))
        assertEquals(emptySet<String>(), release.parseHostsResponse("""{"root":"tasm-skill.asf.bd","courses":[],"hosts":[]}"""))
    }

    @Test
    fun originRulesListRootCoursesAndDev() {
        assertEquals(
            setOf("https://tasm-skill.asf.bd", "https://biz101.tasm-skill.asf.bd", "https://typing-2026.tasm-skill.asf.bd"),
            release.originRules(slugs),
        )
        assertTrue(debug.originRules(slugs).contains("http://10.0.2.2:3000"))
        assertFalse(release.originRules(setOf("www")).contains("https://www.tasm-skill.asf.bd"))
    }
}
