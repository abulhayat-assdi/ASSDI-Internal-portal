package bd.asf.tasmskill.portal

import bd.asf.tasmskill.portal.LaunchPolicy.PageAction
import bd.asf.tasmskill.portal.LaunchPolicy.SavedSession
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class LaunchPolicyTest {

    private val policy = OriginPolicy("tasm-skill.asf.bd", "")
    private val debugPolicy = OriginPolicy("tasm-skill.asf.bd", "http://10.0.2.2:3000")
    private val slugs = setOf("biz101", "typing-2026")
    private val root = "https://tasm-skill.asf.bd"
    private val course = "https://biz101.tasm-skill.asf.bd"
    private val student = SavedSession(course, LaunchPolicy.AREA_STUDENT)
    private val staff = SavedSession(course, LaunchPolicy.AREA_STAFF)
    private val cookie = "theme=dark; __session=abc.def.ghi; other=1"

    // ------------------------------------------------------------------ cookie parsing

    @Test
    fun sessionCookieDetection() {
        assertTrue(LaunchPolicy.hasSessionCookie("__session=abc"))
        assertTrue(LaunchPolicy.hasSessionCookie(cookie))
        assertTrue(LaunchPolicy.hasSessionCookie("a=1;__session=x"))
        assertFalse(LaunchPolicy.hasSessionCookie(null))
        assertFalse(LaunchPolicy.hasSessionCookie(""))
        assertFalse(LaunchPolicy.hasSessionCookie("theme=dark"))
    }

    @Test
    fun emptySessionValueDoesNotCount() {
        assertFalse(LaunchPolicy.hasSessionCookie("__session="))
        assertFalse(LaunchPolicy.hasSessionCookie("__session=; theme=dark"))
        assertFalse(LaunchPolicy.hasSessionCookie("__session=\"\""))
        assertFalse(LaunchPolicy.hasSessionCookie("__session"))
    }

    @Test
    fun substringTrapsDoNotCount() {
        assertFalse(LaunchPolicy.hasSessionCookie("x__session=1"))
        assertFalse(LaunchPolicy.hasSessionCookie("__session_old=1"))
        assertFalse(LaunchPolicy.hasSessionCookie("my__session=1; __sessionx=2"))
        assertFalse(LaunchPolicy.hasSessionCookie("theme=__session=1"))
        assertTrue(LaunchPolicy.hasSessionCookie("x__session=1; __session=real"))
    }

    // ------------------------------------------------------------------ area mapping

    @Test
    fun areaMapping() {
        assertEquals("student", LaunchPolicy.areaForPath("/student-dashboard"))
        assertEquals("student", LaunchPolicy.areaForPath("/student-dashboard/competitions/12"))
        assertEquals("staff", LaunchPolicy.areaForPath("/dashboard"))
        assertEquals("staff", LaunchPolicy.areaForPath("/dashboard/competitions/5/live"))
        assertNull(LaunchPolicy.areaForPath("/student-login"))
        assertNull(LaunchPolicy.areaForPath("/login"))
        assertNull(LaunchPolicy.areaForPath("/app"))
        assertNull(LaunchPolicy.areaForPath("/"))
        assertNull(LaunchPolicy.areaForPath("/dashboards"))
        assertNull(LaunchPolicy.areaForPath("/student-dashboardx"))
        assertEquals("/student-dashboard", LaunchPolicy.pathForArea("student"))
        assertEquals("/dashboard", LaunchPolicy.pathForArea("staff"))
        assertNull(LaunchPolicy.pathForArea("admin"))
    }

    @Test
    fun observeOnlyDashboardsOnTrustedCourseHosts() {
        assertEquals(student, LaunchPolicy.observe("$course/student-dashboard?tab=1", policy, slugs))
        assertEquals(staff, LaunchPolicy.observe("$course/dashboard/competitions", policy, slugs))
        assertEquals(staff, LaunchPolicy.observe("https://BIZ101.tasm-skill.asf.bd:443/dashboard", policy, slugs))
        assertNull(LaunchPolicy.observe("$root/dashboard", policy, slugs)) // root host
        assertNull(LaunchPolicy.observe("https://student1.tasm-skill.asf.bd/dashboard", policy, slugs)) // unlisted
        assertNull(LaunchPolicy.observe("http://biz101.tasm-skill.asf.bd/dashboard", policy, slugs))
        assertNull(LaunchPolicy.observe("$course/student-login", policy, slugs))
        assertNull(LaunchPolicy.observe("http://10.0.2.2:3000/dashboard", debugPolicy, slugs)) // dev origin
    }

    // ------------------------------------------------------------------ launch URL

    @Test
    fun nothingSavedUsesRoot() {
        val d = LaunchPolicy.launchUrl(null, cookie, policy, slugs, root)
        assertEquals(root, d.url)
        assertFalse(d.clearSaved)
        assertFalse(d.resumed)
    }

    @Test
    fun savedSessionWithCookieResumesDashboard() {
        val s = LaunchPolicy.launchUrl(student, cookie, policy, slugs, root)
        assertEquals("$course/student-dashboard", s.url)
        assertTrue(s.resumed)
        assertFalse(s.clearSaved)
        assertEquals("$course/dashboard", LaunchPolicy.launchUrl(staff, cookie, policy, slugs, root).url)
    }

    @Test
    fun untrustedOriginIsForgotten() {
        val removed = LaunchPolicy.launchUrl(student, cookie, policy, setOf("other"), root)
        assertEquals(root, removed.url)
        assertTrue(removed.clearSaved)
        val evil = LaunchPolicy.launchUrl(SavedSession("https://tasm-skill.asf.bd.evil.com", "student"), cookie, policy, slugs, root)
        assertTrue(evil.clearSaved)
        val rootSaved = LaunchPolicy.launchUrl(SavedSession(root, "student"), cookie, policy, slugs, root)
        assertTrue(rootSaved.clearSaved)
        val badArea = LaunchPolicy.launchUrl(SavedSession(course, "admin"), cookie, policy, slugs, root)
        assertTrue(badArea.clearSaved)
        val withPath = LaunchPolicy.launchUrl(SavedSession("$course/evil", "student"), cookie, policy, slugs, root)
        assertTrue(withPath.clearSaved)
    }

    @Test
    fun missingOrEmptyCookieUsesRootWithoutClearing() {
        for (c in listOf(null, "", "theme=dark", "__session=", "x__session=1")) {
            val d = LaunchPolicy.launchUrl(student, c, policy, slugs, root)
            assertEquals(c.toString(), root, d.url)
            assertFalse(d.resumed)
            assertFalse(d.clearSaved)
        }
    }

    // ------------------------------------------------------------------ page rules

    @Test
    fun dashboardWithSessionIsSaved() {
        assertEquals(PageAction.Save(student), LaunchPolicy.onMainFramePage("$course/student-dashboard", null, cookie, policy, slugs))
        // Switching area or course replaces the saved value.
        assertEquals(PageAction.Save(staff), LaunchPolicy.onMainFramePage("$course/dashboard", student, cookie, policy, slugs))
        val other = SavedSession("https://typing-2026.tasm-skill.asf.bd", "student")
        assertEquals(PageAction.Save(other), LaunchPolicy.onMainFramePage("${other.origin}/student-dashboard", student, cookie, policy, slugs))
        // Already saved: nothing to do.
        assertEquals(PageAction.None, LaunchPolicy.onMainFramePage("$course/student-dashboard/x", student, cookie, policy, slugs))
    }

    @Test
    fun logoutOrRevokedSessionClears() {
        // Explicit logout lands on the login page with the cookie deleted.
        assertEquals(PageAction.Clear, LaunchPolicy.onMainFramePage("$course/student-login", student, "theme=dark", policy, slugs))
        assertEquals(PageAction.Clear, LaunchPolicy.onMainFramePage("$course/login", staff, null, policy, slugs))
        // Even a dashboard URL without a session clears (it is not saved).
        assertEquals(PageAction.Clear, LaunchPolicy.onMainFramePage("$course/dashboard", staff, "__session=", policy, slugs))
    }

    @Test
    fun otherPagesNeitherSaveNorClear() {
        assertEquals(PageAction.None, LaunchPolicy.onMainFramePage("$course/student-login", student, cookie, policy, slugs))
        assertEquals(PageAction.None, LaunchPolicy.onMainFramePage("$course/app", null, cookie, policy, slugs))
        assertEquals(PageAction.None, LaunchPolicy.onMainFramePage("$root/", student, null, policy, slugs)) // root picker
        assertEquals(PageAction.None, LaunchPolicy.onMainFramePage("https://typing-2026.tasm-skill.asf.bd/student-login", student, null, policy, slugs))
        assertEquals(PageAction.None, LaunchPolicy.onMainFramePage(null, student, null, policy, slugs))
    }

    @Test
    fun originFormatting() {
        assertEquals(course, LaunchPolicy.originOf("https://BIZ101.tasm-skill.asf.bd:443/dashboard?x=1"))
        assertEquals("http://10.0.2.2:3000", LaunchPolicy.originOf("http://10.0.2.2:3000/x"))
        assertNull(LaunchPolicy.originOf("javascript:alert(1)"))
    }
}
