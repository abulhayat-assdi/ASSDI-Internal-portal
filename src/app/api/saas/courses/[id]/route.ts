export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isSuperAdmin } from "@/lib/auth";
import { invalidateCourseCache } from "@/lib/course";
import { ALL_FEATURES } from "@/lib/features";
import type { Prisma } from "@prisma/client";
import { z } from "zod";

const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;
const RESERVED_SLUGS = new Set(["www", "admin", "api", "mail", "ftp", "app", "portal"]);
const VALID_FEATURE_KEYS = new Set(ALL_FEATURES.map((f) => f.key));

const updateCourseSchema = z.object({
    name: z.string().min(1).optional(),
    slug: z.string().regex(SLUG_REGEX).optional(),
    tagline: z.string().nullable().optional(),
    logoUrl: z.string().nullable().optional(),
    faviconUrl: z.string().nullable().optional(),
    primaryColor: z.string().optional(),
    accentColor: z.string().optional(),
    status: z.enum(["ACTIVE", "SUSPENDED", "TRIAL", "ARCHIVED"]).optional(),
    features: z.record(z.string(), z.boolean()).optional(),
    billing: z.object({
        plan: z.enum(["trial", "monthly", "yearly", "lifetime", "custom"]).optional(),
        expiresAt: z.string().nullable().optional(),
        maxStudents: z.number().int().min(0).nullable().optional(),
        maxTeachers: z.number().int().min(0).nullable().optional(),
        notes: z.string().max(2000).optional(),
    }).optional(),
});

/** GET /api/saas/courses/[id] — course detail + stats (super_admin only) */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const caller = await getSessionUser(req);
    if (!caller || !isSuperAdmin(caller)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await params;

    const result = await withCourseContext({ courseId: null, isSuperAdmin: true }, async (tx) => {
        const course = await tx.course.findUnique({ where: { id } });
        if (!course) return null;

        const [studentCount, teacherCount, adminCount, batchCount] = await Promise.all([
            tx.user.count({ where: { courseId: id, role: "student" } }),
            tx.user.count({ where: { courseId: id, role: "teacher" } }),
            tx.user.count({ where: { courseId: id, role: "admin" } }),
            tx.batch.count({ where: { courseId: id } }),
        ]);

        return { course, stats: { studentCount, teacherCount, adminCount, batchCount } };
    });

    if (!result) return NextResponse.json({ error: "Course not found" }, { status: 404 });
    return NextResponse.json(result);
}

/** PATCH /api/saas/courses/[id] — update branding, status, or feature toggles (super_admin only) */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const caller = await getSessionUser(req);
    if (!caller || !isSuperAdmin(caller)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await params;

    const body = await req.json();
    const parsed = updateCourseSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues.map((e) => e.message).join(", ") }, { status: 400 });
    }
    const { slug, features, billing, ...rest } = parsed.data;

    if (slug && RESERVED_SLUGS.has(slug)) {
        return NextResponse.json({ error: `"${slug}" is a reserved subdomain.` }, { status: 400 });
    }
    if (features) {
        const invalid = Object.keys(features).filter((k) => !VALID_FEATURE_KEYS.has(k));
        if (invalid.length > 0) {
            return NextResponse.json({ error: `Invalid feature keys: ${invalid.join(", ")}` }, { status: 400 });
        }
    }

    try {
        const result = await withCourseContext({ courseId: null, isSuperAdmin: true }, async (tx) => {
            const existing = await tx.course.findUnique({ where: { id } });
            if (!existing) return { error: "Course not found" as const, status: 404 };

            if (slug && slug !== existing.slug) {
                const slugTaken = await tx.course.findUnique({ where: { slug } });
                if (slugTaken) return { error: "This subdomain is already taken." as const, status: 409 };
            }

            const currentSettings = (existing.settings as Record<string, unknown>) ?? {};
            const currentFeatures = (currentSettings.features as Record<string, boolean>) ?? {};
            let nextSettings: Record<string, unknown> = features
                ? { ...currentSettings, features: { ...currentFeatures, ...features } }
                : { ...currentSettings };
            if (billing) {
                const currentBilling = (currentSettings.billing as Record<string, unknown>) ?? {};
                nextSettings = {
                    ...nextSettings,
                    billing: {
                        ...currentBilling,
                        ...Object.fromEntries(Object.entries(billing).filter(([, v]) => v !== undefined)),
                        updatedAt: new Date().toISOString(),
                        updatedBy: caller.email,
                    },
                };
            }

            const updated = await tx.course.update({
                where: { id },
                data: { ...rest, ...(slug ? { slug } : {}), settings: nextSettings as Prisma.InputJsonValue },
            });

            if (billing || rest.status) {
                await tx.activityLog.create({
                    data: {
                        courseId: id,
                        actorUid: caller.id,
                        actorRole: "ADMIN",
                        actionType: "super_admin_course_update",
                        targetType: "course",
                        targetId: id,
                        description: `Super-admin ${caller.email} updated ${[billing ? `billing(${billing.plan ?? "…"})` : "", rest.status ? `status→${rest.status}` : ""].filter(Boolean).join(" ")}`,
                    },
                }).catch(() => { /* audit must not block */ });
            }

            return { course: updated, oldSlug: existing.slug };
        });

        if ("error" in result) {
            return NextResponse.json({ error: result.error }, { status: result.status });
        }

        // The middleware's course cache is keyed by slug — invalidate both the
        // old and new slug so branding/status/slug changes take effect immediately.
        invalidateCourseCache(result.oldSlug);
        invalidateCourseCache(result.course.slug);

        return NextResponse.json({ course: result.course });
    } catch (error) {
        console.error("[SaaS Course PATCH]", error);
        const message = error instanceof Error ? error.message : "Failed to update course.";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

/** DELETE /api/saas/courses/[id] — permanently delete a course and ALL its data (super_admin only) */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const caller = await getSessionUser(req);
    if (!caller || !isSuperAdmin(caller)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await params;

    try {
        const course = await withCourseContext({ courseId: null, isSuperAdmin: true }, async (tx) => {
            const existing = await tx.course.findUnique({ where: { id } });
            if (!existing) return null;
            // onDelete: Cascade on every course-scoped table removes all of
            // this course's data along with it.
            await tx.course.delete({ where: { id } });
            return existing;
        });

        if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });

        invalidateCourseCache(course.slug);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[SaaS Course DELETE]", error);
        const message = error instanceof Error ? error.message : "Failed to delete course.";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
