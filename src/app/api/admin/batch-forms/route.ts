export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isAdmin, hasRequiredPermission } from "@/lib/auth";
import { randomUUID } from "crypto";

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function makeSlug(batchName: string): string {
  const base = slugify(batchName) || "batch";
  const rand = randomUUID().replace(/-/g, "").slice(0, 8);
  return `${base}-${rand}`;
}

// GET /api/admin/batch-forms
export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user || !user.courseId || !(isAdmin(user) || hasRequiredPermission(user, "admin_panel"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const courseId = user.courseId;

  const result = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
    const batches = await tx.batch.findMany({ where: { courseId }, orderBy: { createdAt: "desc" } });

    // Auto-create a BatchForm for any batch that doesn't have one yet
    for (const batch of batches) {
      const existing = await tx.batchForm.findUnique({
        where: { courseId_batchName: { courseId, batchName: batch.name } },
      });
      if (!existing) {
        await tx.batchForm.create({
          data: { courseId, batchName: batch.name, formSlug: makeSlug(batch.name), isActive: true },
        });
      }
    }

    const forms = await tx.batchForm.findMany({ where: { courseId }, orderBy: { createdAt: "desc" } });

    const pendingCounts = await tx.studentFormSubmission.groupBy({
      by: ["batchName"],
      where: { courseId, status: "pending" },
      _count: { id: true },
    });
    const pendingMap = new Map(pendingCounts.map((p) => [p.batchName, p._count.id]));

    return forms.map((f) => ({
      id: f.id,
      batchName: f.batchName,
      formSlug: f.formSlug,
      isActive: f.isActive,
      createdAt: f.createdAt,
      pendingCount: pendingMap.get(f.batchName) ?? 0,
    }));
  });

  return NextResponse.json(result);
}

// PATCH /api/admin/batch-forms — toggle isActive
export async function PATCH(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user || !user.courseId || !(isAdmin(user) || hasRequiredPermission(user, "admin_panel"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const courseId = user.courseId;

  const { batchName, isActive } = await req.json();

  await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
    tx.batchForm.updateMany({ where: { courseId, batchName }, data: { isActive } })
  );

  return NextResponse.json({ success: true });
}
