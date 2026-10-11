export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, hasRequiredPermission, isTeacherOrAdmin } from "@/lib/auth";

// Approve or reject one correction request. Approving overwrites the
// submission's answers with the requested ones and keeps the old answers on
// the request for the record.
export async function POST(req: NextRequest, context: { params: Promise<{ correctionId: string }> }) {
    try {
        const { correctionId } = await context.params;
        const user = await getSessionUser(req);
        if (!user || !isTeacherOrAdmin(user) || !user.courseId || !hasRequiredPermission(user, "admin_panel")) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        const courseId = user.courseId;

        const body = await req.json();
        const action = body?.action;
        if (action !== "approve" && action !== "reject") {
            return NextResponse.json({ error: "Invalid action" }, { status: 400 });
        }
        const reviewNote = String(body?.note || "").trim().slice(0, 1000) || null;

        return await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            const request = await tx.competitionCorrectionRequest.findFirst({
                where: { id: correctionId, courseId },
                include: { submission: true },
            });
            if (!request) return NextResponse.json({ error: "Request not found" }, { status: 404 });
            if (request.status !== "pending") {
                return NextResponse.json({ error: `This request was already ${request.status}.` }, { status: 409 });
            }

            const review = { reviewNote, reviewedBy: user.displayName || user.email, reviewedAt: new Date() };

            if (action === "reject") {
                await tx.competitionCorrectionRequest.update({
                    where: { id: request.id },
                    data: { status: "rejected", ...review },
                });
                return NextResponse.json({ success: true, status: "rejected" });
            }

            const oldData = (request.submission.data ?? {}) as Record<string, any>;
            const newData = (request.newData ?? {}) as Record<string, any>;
            await tx.competitionSubmission.update({
                where: { id: request.submissionId },
                data: { data: newData },
            });
            await tx.competitionCorrectionRequest.update({
                where: { id: request.id },
                data: { status: "approved", oldData, ...review },
            });
            return NextResponse.json({ success: true, status: "approved" });
        });
    } catch (error) {
        console.error("Failed to review correction request:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
