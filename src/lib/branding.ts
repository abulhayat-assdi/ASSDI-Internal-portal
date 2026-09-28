import { cache } from 'react';
import { headers } from 'next/headers';
import { getCourseById } from './course';
import { getPlatformSettings } from './platformSettings';
import { PLATFORM_BRANDING, type CourseBranding } from '@/types/branding';

export { PLATFORM_NAME, PLATFORM_NAME_BN, PLATFORM_BRANDING } from '@/types/branding';
export type { CourseBranding } from '@/types/branding';

/** Branding for the bare root domain, with the institute's uploaded logo. */
export const getPlatformBranding = cache(async (): Promise<CourseBranding> => {
    const platform = await getPlatformSettings();
    return { ...PLATFORM_BRANDING, logoUrl: platform.logoUrl };
});

/**
 * Branding for one course id. A course that hasn't uploaded its own logo
 * shows the institute's global one; an unknown course gets the platform's.
 */
export const getBrandingForCourseId = cache(
    async (courseId: string | null): Promise<CourseBranding> => {
        if (!courseId) return getPlatformBranding();
        const [course, platform] = await Promise.all([
            getCourseById(courseId).catch(() => null),
            getPlatformSettings(),
        ]);
        if (!course) return { ...PLATFORM_BRANDING, courseId, logoUrl: platform.logoUrl };
        return {
            courseId,
            name: course.name,
            tagline: course.tagline,
            logoUrl: course.logoUrl || platform.logoUrl,
            primaryColor: course.primaryColor,
        };
    }
);

/**
 * Branding for the course this request is on.
 *
 * `x-course-id` is set by the middleware's course guard (see src/middleware.ts);
 * it is absent on the bare root domain and on the super-admin host.
 */
export async function getRequestBranding(): Promise<CourseBranding> {
    const courseId = (await headers()).get('x-course-id');
    return getBrandingForCourseId(courseId);
}
