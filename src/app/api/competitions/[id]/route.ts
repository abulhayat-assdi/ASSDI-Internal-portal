import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isTeacherOrAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;
        const user = await getSessionUser(req);
        const courseId = user?.courseId || req.headers.get("x-course-id");
        if (!courseId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const competition = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            tx.competition.findUnique({
                where: { id, courseId }
            })
        );

        if (!competition) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        return NextResponse.json(competition);
    } catch (error) {
        console.error("Failed to fetch competition:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function PUT(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;
        const user = await getSessionUser(req);
        if (!user || !isTeacherOrAdmin(user) || !user.courseId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        const courseId = user.courseId;

        const body = await req.json();

        const competition = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            tx.competition.update({
                where: { id, courseId },
                data: {
                    title: body.title,
                    description: body.description,
                    batchName: body.batchName,
                    schema: body.schema,
                    isActive: body.isActive,
                    startDate: body.startDate ? new Date(body.startDate) : undefined,
                    endDate: body.endDate ? new Date(body.endDate) : undefined,
                }
            })
        );

        return NextResponse.json(competition);
    } catch (error) {
        console.error("Failed to update competition:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function DELETE(
    req: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;
        const user = await getSessionUser(req);
        if (!user || !isTeacherOrAdmin(user) || !user.courseId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        const courseId = user.courseId;

        await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            tx.competition.delete({
                where: { id, courseId }
            })
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to delete competition:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
