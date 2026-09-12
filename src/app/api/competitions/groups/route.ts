import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isTeacherOrAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const courseId = req.headers.get("x-course-id");
        if (!courseId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const batchName = searchParams.get("batchName");
        const competitionId = searchParams.get("competitionId");

        const where: any = { courseId };
        if (batchName) where.batchName = batchName;
        if (competitionId) where.competitionId = competitionId;

        const groups = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            tx.competitionGroup.findMany({
                where,
                orderBy: { groupName: "asc" }
            })
        );

        return NextResponse.json(groups);
    } catch (error) {
        console.error("Failed to fetch competition groups:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const user = await getSessionUser(req);
        if (!user || !isTeacherOrAdmin(user) || !user.courseId) {
            return NextResponse.json({ error: "Forbidden: Only Teachers and Admins can manage groups." }, { status: 403 });
        }
        const courseId = user.courseId;

        const body = await req.json();
        const { id, batchName, competitionId, groupName, members } = body;

        if (!batchName || !batchName.trim()) {
            return NextResponse.json({ error: "Batch Name is required" }, { status: 400 });
        }
        if (!groupName || !groupName.trim()) {
            return NextResponse.json({ error: "Group Name is required" }, { status: 400 });
        }

        const result = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) => {
            if (id) {
                // Update existing group
                return tx.competitionGroup.update({
                    where: { id, courseId },
                    data: {
                        groupName: groupName.trim(),
                        batchName: batchName.trim(),
                        competitionId: competitionId || null,
                        members: members || [],
                    }
                });
            } else {
                // Create new group
                return tx.competitionGroup.create({
                    data: {
                        courseId,
                        groupName: groupName.trim(),
                        batchName: batchName.trim(),
                        competitionId: competitionId || null,
                        members: members || [],
                    }
                });
            }
        });

        return NextResponse.json(result);
    } catch (error: any) {
        console.error("Failed to create/update competition group:", error);
        return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const user = await getSessionUser(req);
        if (!user || !isTeacherOrAdmin(user) || !user.courseId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        const courseId = user.courseId;

        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json({ error: "Group ID is required" }, { status: 400 });
        }

        await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            tx.competitionGroup.delete({
                where: { id, courseId }
            })
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to delete competition group:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
