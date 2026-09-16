export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isSuperAdmin } from "@/lib/auth";
import { ANNOUNCEMENT_KEY } from "@/lib/announcement";
import { z } from "zod";

const upsertSchema = z.object({
    title: z.string().min(1).max(200),
    body: z.string().min(1).max(2000),
    level: z.enum(["info", "warning", "urgent"]).default("info"),
    expiresAt: z.string().nullable().optional(),
    /** "all" or list of course ids */
    targets: z.union([z.literal("all"), z.array(z.string().min(1)).min(1)]),
});

const deleteSchema = z.object({
    targets: z.union([z.literal("all"), z.array(z.string().min(1)).min(1)]),
});

async function targetIds(targets: "all" | string[], tx: { course: { findMany: (a: { select: { id: boolean } }) => Promise<{ id: string }[]> } }): Promise<string[]> {
    if (targets === "all") {
        const rows = await tx.course.findMany({ select: { id: true } });
        return rows.map((r) => r.id);
    }
    return targets;
}

/** GET /api/saas/announcements — every course's current announcement (super_admin only) */
export async function GET(req: NextRequest) {
    const caller = await getSessionUser(req);
    if (!caller || !isSuperAdmin(caller)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const rows = await withCourseContext({ courseId: null, isSuperAdmin: true }, (tx) =>
        tx.cmsContent.findMany({
            where: { key: ANNOUNCEMENT_KEY },
            include: { course: { select: { id: true, slug: true, name: true } } },
        })
    );
    return NextResponse.json({
        announcements: rows.map((r) => ({ ...(r.value as object), courseId: r.courseId, course: r.course })),
    });
}

/** POST — publish/overwrite announcement for all or selected courses */
export async function POST(req: NextRequest) {
    const caller = await getSessionUser(req);
    if (!caller || !isSuperAdmin(caller)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const parsed = upsertSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues.map((e) => e.message).join(", ") }, { status: 400 });
    }
    const { title, body, level, expiresAt, targets } = parsed.data;

    const value = {
        title, body, level,
        expiresAt: expiresAt || null,
        createdBy: caller.email,
        createdAt: new Date().toISOString(),
    };

    const result = await withCourseContext({ courseId: null, isSuperAdmin: true }, async (tx) => {
        const ids = await targetIds(targets, tx);
        await Promise.all(
            ids.map((courseId) =>
                tx.cmsContent.upsert({
                    where: { courseId_key: { courseId, key: ANNOUNCEMENT_KEY } },
                    update: { value, updatedBy: caller.id },
                    create: { courseId, key: ANNOUNCEMENT_KEY, value, updatedBy: caller.id },
                })
            )
        );
        return { count: ids.length };
    });

    return NextResponse.json({ success: true, ...result });
}

/** DELETE — remove announcement from all or selected courses */
export async function DELETE(req: NextRequest) {
    const caller = await getSessionUser(req);
    if (!caller || !isSuperAdmin(caller)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const parsed = deleteSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

    const result = await withCourseContext({ courseId: null, isSuperAdmin: true }, async (tx) => {
        const ids = await targetIds(parsed.data.targets, tx);
        const r = await tx.cmsContent.deleteMany({ where: { key: ANNOUNCEMENT_KEY, courseId: { in: ids } } });
        return { count: r.count };
    });
    return NextResponse.json({ success: true, ...result });
}
