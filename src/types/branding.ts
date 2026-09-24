/**
 * Branding shown to users on a course subdomain.
 *
 * Every tenant-visible name/logo in the UI comes from here so that nothing is
 * pinned to one particular course. The values are the Course row's own
 * columns (editable from Super Admin → Courses, and from the course's own
 * Dashboard → Branding settings).
 */
export interface CourseBranding {
    courseId: string | null;
    /** Course name — "Professional Contact Center & Telesales Programme", etc. */
    name: string;
    tagline: string | null;
    logoUrl: string | null;
    primaryColor: string | null;
}

/** The institute behind every course on this platform — deliberately not per-course. */
export const PLATFORM_NAME = "As-Sunnah Skill Development Institute";
export const PLATFORM_NAME_BN = "আস-সুন্নাহ স্কিল ডেভেলপমেন্ট ইনস্টিটিউট";

/** Used on the bare root domain, where no course is in scope. */
export const PLATFORM_BRANDING: CourseBranding = {
    courseId: null,
    name: PLATFORM_NAME,
    tagline: null,
    logoUrl: null,
    primaryColor: null,
};
