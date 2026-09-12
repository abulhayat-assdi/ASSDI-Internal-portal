import { NextRequest, NextResponse } from 'next/server';
import { withCourseContext } from '@/lib/db';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    // Require SETUP_SECRET to prevent unauthorized access
    const setupSecret = process.env.SETUP_SECRET;
    const providedSecret = req.nextUrl.searchParams.get('secret');

    if (!setupSecret || !providedSecret || providedSecret !== setupSecret) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(req.url);
        const action = searchParams.get('action');

        const email = 'mohammadabulhayatt@gmail.com';

        // This bootstraps the platform's super_admin account, which has no
        // course — every operation here runs under the super-admin RLS bypass.
        return await withCourseContext({ courseId: null, isSuperAdmin: true }, async (tx) => {
            // action=check — just show current user state, no changes
            if (action === 'check') {
                const user = await tx.user.findUnique({
                    where: { email },
                    select: { id: true, email: true, role: true, displayName: true, teacherId: true, courseId: true }
                });
                const hwCount = await tx.homeworkSubmission.count();
                const assignCount = await tx.homeworkAssignment.count();
                return NextResponse.json({ user, homeworkSubmissions: hwCount, homeworkAssignments: assignCount });
            }

            // action=fix-role — set role to super_admin
            if (action === 'fix-role') {
                const user = await tx.user.update({
                    where: { email },
                    data: { role: 'super_admin', courseId: null },
                    select: { email: true, role: true, displayName: true }
                });
                return NextResponse.json({ success: true, message: 'Role updated to super_admin', user });
            }

            // default — create/reset admin account
            const password = 'Password@123';
            const hashedPassword = await bcrypt.hash(password, 10);

            const user = await tx.user.upsert({
                where: { email },
                update: {
                    passwordHash: hashedPassword,
                    role: 'super_admin',
                    courseId: null,
                    displayName: 'Abul Hayat',
                    permissions: [],
                },
                create: {
                    email,
                    passwordHash: hashedPassword,
                    role: 'super_admin',
                    displayName: 'Abul Hayat',
                    permissions: [],
                }
            });

            return NextResponse.json({
                success: true,
                message: 'Admin account created/reset with role: super_admin',
                user: { email: user.email, role: user.role },
            });
        });
    } catch (error: unknown) {
        console.error('Setup Error:', error);
        return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
    }
}
