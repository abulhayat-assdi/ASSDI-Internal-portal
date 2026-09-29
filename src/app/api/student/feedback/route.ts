import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { HOUR, limitFromEnv, rateLimitByIp } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CATEGORIES = ["CourseContent", "Teacher", "Facilities", "Administration", "Other"] as const;
type Category = (typeof CATEGORIES)[number];

/** POST /api/student/feedback — a signed-in student submits course feedback. */
export async function POST(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || user.role !== "student" || !user.courseId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const limited = rateLimitByIp(req, "student-feedback", limitFromEnv("STUDENT_FEEDBACK", 30), HOUR);
    if (limited) return limited;

    const courseId = user.courseId;

    try {
        const body = await req.json();
        const { category, message, rating } = body;

        if (!message || typeof message !== "string" || !message.trim()) {
            return NextResponse.json({ error: "Message is required" }, { status: 400 });
        }
        const cat: Category = CATEGORIES.includes(category) ? category : "Other";
        const ratingNum = Number(rating);
        const safeRating = Number.isFinite(ratingNum) ? Math.min(5, Math.max(1, Math.round(ratingNum))) : 5;

        const batchName = user.studentBatchName || "";

        const item = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            const batch = batchName
                ? await tx.batch.findFirst({ where: { courseId, name: batchName }, select: { id: true } })
                : null;

            return tx.feedback.create({
                data: {
                    courseId,
                    studentUid: user.id,
                    studentName: user.displayName || "",
                    studentRoll: user.studentRoll || "",
                    batchId: batch?.id || null,
                    batchName,
                    category: cat,
                    message: message.trim(),
                    rating: safeRating,
                },
                select: { id: true },
            });
        });

        return NextResponse.json({ id: item.id, success: true }, { status: 201 });
    } catch (error) {
        console.error("[Student Feedback POST]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
