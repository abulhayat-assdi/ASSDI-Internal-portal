import { NextRequest, NextResponse } from 'next/server';
import { withCourseContext } from '@/lib/db';
import { getSessionUser, isAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET — show counts before deletion (admin only)
export async function GET(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !isAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const courseId = user.courseId;

    const { submissions, assignments } = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
        const submissions = await tx.homeworkSubmission.count({ where: { courseId } });
        const assignments = await tx.homeworkAssignment.count({ where: { courseId } });
        return { submissions, assignments };
    });

    return NextResponse.json({
        message: 'Call POST to delete all homework. This cannot be undone.',
        homeworkSubmissions: submissions,
        homeworkAssignments: assignments,
    });
}

// POST — delete all homework submissions and assignments (admin only)
export async function POST(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !isAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const courseId = user.courseId;

    try {
        const { deletedSubmissions, deletedAssignments } = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            const deletedSubmissions = await tx.homeworkSubmission.deleteMany({ where: { courseId } });
            const deletedAssignments = await tx.homeworkAssignment.deleteMany({ where: { courseId } });
            return { deletedSubmissions, deletedAssignments };
        });
        return NextResponse.json({
            success: true,
            deleted: {
                submissions: deletedSubmissions.count,
                assignments: deletedAssignments.count,
            },
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
