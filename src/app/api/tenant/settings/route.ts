export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, hasRequiredPermission, isAdmin } from "@/lib/auth";
import { invalidateCourseCache } from "@/lib/course";
import { getAiKnowledge } from "@/lib/aiAssistant";
import type { Prisma } from "@prisma/client";
import { z } from "zod";

// What a course's own admin may change about their portal. Plan, status,
// slug and feature toggles are deliberately absent — those stay with the
// super admin.
const updateSchema = z.object({
    name: z.string().min(1).max(120).optional(),
    tagline: z.string().max(200).nullable().optional(),
    logoUrl: z.string().max(2000).nullable().optional(),
    faviconUrl: z.string().max(2000).nullable().optional(),
    primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    aiKnowledge: z.string().max(8000).optional(),
});

// Matches the sidebar's own gate on the Branding page (permission: admin_panel)
// so the link never leads to a 403.
const canEditBranding = (caller: Parameters<typeof isAdmin>[0]) =>
    isAdmin(caller) || hasRequiredPermission(caller, "admin_panel");

function serialize(course: {
    id: string;
    slug: string;
    name: string;
    tagline: string | null;
    logoUrl: string | null;
    faviconUrl: string | null;
    primaryColor: string;
    accentColor: string;
    settings: Prisma.JsonValue;
}) {
    const billing = (course.settings as { billing?: { plan?: string } } | null)?.billing;
    return {
        id: course.id,
        slug: course.slug,
        name: course.name,
        tagline: course.tagline,
        logoUrl: course.logoUrl,
        faviconUrl: course.faviconUrl,
        primaryColor: course.primaryColor,
        accentColor: course.accentColor,
        aiKnowledge: getAiKnowledge(course.settings),
        plan: billing?.plan ?? "—",
    };
}

/** GET /api/tenant/settings — this course's own branding (course admin). */
export async function GET(req: NextRequest) {
    const caller = await getSessionUser(req);
    if (!caller || !caller.courseId || !canEditBranding(caller)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = caller.courseId;

    const course = await withCourseContext({ courseId, isSuperAdmin: false }, (tx) =>
        tx.course.findUnique({ where: { id: courseId } })
    );
    if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });

    return NextResponse.json({ tenant: serialize(course) });
}

/** PATCH /api/tenant/settings — update this course's own branding (course admin). */
export async function PATCH(req: NextRequest) {
    const caller = await getSessionUser(req);
    if (!caller || !caller.courseId || !canEditBranding(caller)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = caller.courseId;

    const parsed = updateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ error: "ইনপুট সঠিক নয়।" }, { status: 400 });
    }
    const { aiKnowledge, ...fields } = parsed.data;

    const updated = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
        const data: Prisma.CourseUpdateInput = { ...fields };

        if (aiKnowledge !== undefined) {
            // settings holds other keys (features, billing) owned by the super
            // admin — merge instead of replacing the whole object.
            const current = await tx.course.findUnique({ where: { id: courseId }, select: { settings: true } });
            const settings = (current?.settings as Record<string, unknown> | null) ?? {};
            data.settings = { ...settings, aiAssistant: { knowledge: aiKnowledge.trim() } } as Prisma.InputJsonValue;
        }

        return tx.course.update({ where: { id: courseId }, data });
    });

    // Slug→course lookups are cached for a minute; drop it so the new name and
    // logo show up on the next request instead of after the TTL.
    invalidateCourseCache(updated.slug);

    return NextResponse.json({ tenant: serialize(updated) });
}
