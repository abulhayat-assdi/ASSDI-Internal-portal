export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from 'next/server';
import { withCourseContext } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';
import { COOKIES, AUTH_ROLES } from '@/lib/constants';
import { getEffectivePermissions } from '@/lib/permissions';

/**
 * GET /api/auth/profile
 * Returns the enriched user profile for the currently authenticated user.
 */
export async function GET(req: NextRequest) {
    try {
        const sessionUser = await getSessionUser(req);
        if (!sessionUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const ctx = sessionUser.role === 'super_admin'
            ? { courseId: null, isSuperAdmin: true }
            : { courseId: sessionUser.courseId ?? null, isSuperAdmin: false };

        const result = await withCourseContext(ctx, async (tx) => {
            // Fetch full profile from DB
            const user = await tx.user.findUnique({
                where: { id: sessionUser.id, deletedAt: null },
            });

            if (!user) return null;

            // Enrich: for non-students, look up teacherId from teacher directory
            let enrichedTeacherId = user.teacherId;
            let enrichedProfileImageUrl = user.profileImageUrl;

            if (user.role !== AUTH_ROLES.STUDENT) {
                try {
                    const teacherMatch = await tx.teacher.findFirst({
                        where: {
                            OR: [
                                { loginEmail: user.email },
                                { email: user.email },
                            ],
                        },
                    });

                    if (teacherMatch) {
                        // Sync teacherId if missing or different
                        if (teacherMatch.teacherId && teacherMatch.teacherId !== user.teacherId) {
                            enrichedTeacherId = teacherMatch.teacherId;
                            await tx.user.update({
                                where: { id: user.id },
                                data: { teacherId: teacherMatch.teacherId },
                            }).catch(() => { /* non-critical */ });
                        }

                        if (!enrichedProfileImageUrl && teacherMatch.profileImageUrl) {
                            enrichedProfileImageUrl = teacherMatch.profileImageUrl;
                        }
                    }
                } catch (enrichError) {
                    console.error('[Profile API] Teacher enrichment failed:', enrichError);
                    // Continue — non-critical
                }
            }

            const storedPerms = Array.isArray(user.permissions) ? user.permissions as string[] : [];
            const permissions = getEffectivePermissions(user.role, storedPerms);

            return {
                id: user.id,
                email: user.email,
                displayName: user.displayName,
                role: user.role,
                teacherId: enrichedTeacherId,
                studentBatchName: user.studentBatchName,
                studentRoll: user.studentRoll,
                profileImageUrl: enrichedProfileImageUrl,
                permissions,
                createdAt: user.createdAt,
                lastLoginAt: user.lastLoginAt,
            };
        });

        if (!result) {
            return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
        }

        return NextResponse.json(result);
    } catch (error) {
        console.error('[Profile API] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
