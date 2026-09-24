import { cache } from 'react';
import { headers } from 'next/headers';
import { getCourseById } from './course';
import { PLATFORM_BRANDING, type CourseBranding } from '@/types/branding';

export { PLATFORM_NAME, PLATFORM_NAME_BN, PLATFORM_BRANDING } from '@/types/branding';
export type { CourseBranding } from '@/types/branding';

/** Branding for one course id; falls back to the platform's own when unknown. */
export const getBrandingForCourseId = cache(
    async (courseId: string | null): Promise<CourseBranding> => {
        if (!courseId) return PLATFORM_BRANDING;
        const course = await getCourseById(courseId).catch(() => null);
        if (!course) return { ...PLATFORM_BRANDING, courseId };
        return {
            courseId,
            name: course.name,
            tagline: course.tagline,
            logoUrl: course.logoUrl,
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
