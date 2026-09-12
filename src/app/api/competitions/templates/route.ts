import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isTeacherOrAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const user = await getSessionUser(req);
        if (!user || !isTeacherOrAdmin(user) || !user.courseId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        const courseId = user.courseId;

        const templates = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            tx.competitionFormTemplate.findMany({
                where: { courseId },
                orderBy: { createdAt: "desc" }
            })
        );

        return NextResponse.json(templates);
    } catch (error) {
        console.error("Failed to fetch templates:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const user = await getSessionUser(req);
        if (!user || !isTeacherOrAdmin(user) || !user.courseId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        const courseId = user.courseId;

        const body = await req.json();

        const template = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
            tx.competitionFormTemplate.create({
                data: {
                    courseId,
                    name: body.name,
                    schema: body.schema,
                }
            })
        );

        return NextResponse.json(template);
    } catch (error) {
        console.error("Failed to create template:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
