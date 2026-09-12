export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import { NextRequest, NextResponse } from 'next/server';
import { withCourseContext } from '@/lib/db';

/**
 * GET /api/auth/batches
 * Public endpoint — returns batch and student data for student registration.
 * No auth required (used in the public registration form).
 *
 * Query params:
 *   - mode: "batches" | "students" | "raw"
 *   - batchName: (required when mode=students)
 */
export async function GET(req: NextRequest) {
    try {
        const courseId = req.headers.get('x-course-id');
        if (!courseId) return NextResponse.json({ error: 'Unknown course.' }, { status: 404 });

        const { searchParams } = new URL(req.url);
        const mode = searchParams.get('mode') || 'batches';
        const batchName = searchParams.get('batchName');

        return await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            if (mode === 'batches') {
                // Return unique batch names (Running batches first)
                const students = await tx.batchStudent.findMany({
                    where: { courseId },
                    select: { batchName: true },
                    distinct: ['batchName'],
                    orderBy: { batchName: 'asc' },
                });
                return NextResponse.json({
                    batches: students.map((s: any) => s.batchName).sort(),
                });
            }

            if (mode === 'students' && batchName) {
                // Return only minimal student info for registration dropdown
                const students = await tx.batchStudent.findMany({
                    where: { courseId, batchName, isPublic: true },
                    select: { batchName: true, roll: true, name: true, batchType: true },
                    orderBy: { roll: 'asc' },
                });
                return NextResponse.json({ students });
            }

            // mode === 'raw' — return batch metadata (name + status) for public pages
            const batches = await tx.batch.findMany({
                where: { courseId },
                select: { name: true, status: true },
                orderBy: { name: 'asc' },
            });

            // Supplement: find any batch names in batch_students not in batches table
            const studentBatches = await tx.batchStudent.findMany({
                where: { courseId },
                select: { batchName: true, batchType: true },
                distinct: ['batchName'],
            });

            const batchMap = new Map<string, { name: string; status: string }>(
                batches.map((b: any) => [b.name, { name: b.name, status: b.status }])
            );

            studentBatches.forEach((s: any) => {
                if (!batchMap.has(s.batchName)) {
                    batchMap.set(s.batchName, { name: s.batchName, status: s.batchType });
                }
            });

            return NextResponse.json({ batches: Array.from(batchMap.values()) });
        });
    } catch (error) {
        console.error('[Batches API] Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
