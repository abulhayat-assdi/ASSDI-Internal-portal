export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isAdmin } from "@/lib/auth";

// DELETE /api/batch-info/delete-batch?batchName=...
export async function DELETE(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user || !isAdmin(user) || !user.courseId) {
      return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });
    }
    const courseId = user.courseId;

    const { searchParams } = new URL(req.url);
    const batchName = searchParams.get("batchName");

    if (!batchName?.trim()) {
      return NextResponse.json({ error: "batchName is required" }, { status: 400 });
    }

    await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
      // 1. Delete all student form submissions for this batch
      await tx.studentFormSubmission.deleteMany({ where: { courseId, batchName } });

      // 2. Delete batch form record
      await tx.batchForm.deleteMany({ where: { courseId, batchName } });

      // 3. Delete all BatchStudent records
      await tx.batchStudent.deleteMany({ where: { courseId, batchName } });

      // 4. Delete the Batch record itself
      await tx.batch.deleteMany({ where: { courseId, name: batchName } });
    });

    return NextResponse.json({ success: true, deleted: batchName });
  } catch (err) {
    console.error("[DELETE /api/batch-info/delete-batch]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
